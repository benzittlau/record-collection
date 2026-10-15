import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Isolated SDK, clocks and HTTP stubs only. These tests never load configuration,
// credentials, storage, a real browser, Spotify's SDK, or any network resource.
const source=await readFile(new URL('../dist/spotify-player.js',import.meta.url),'utf8');
const ALBUM='a'.repeat(22), TOKEN='synthetic-access-token-do-not-display';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
const response=(data,status=200)=>({status,ok:status>=200&&status<300,json:async()=>data});
const track=(n,extra={})=>({id:`track${n}`,name:`Song ${n}`,artists:[{name:'The Artist'}],duration_ms:180000,track_number:n,disc_number:1,...extra});

function harness({sdkPresent=true,autoReady=true,connectResult=true,fetcher=async()=>response({items:[],next:null}),tokenProvider=async()=>TOKEN}={}){
  const instances=[],requests=[],scripts=[],states=[],errors=[],ready=[],tokenCalls=[];
  let timerId=0;const timeouts=new Map(),intervals=new Map();
  class FakePlayer{
    constructor(options){this.options=options;this.listeners=new Map();this.calls=[];this.disconnections=0;instances.push(this);}
    addListener(event,callback){this.listeners.set(event,callback);return true;}
    emit(event,value){this.listeners.get(event)?.(value);}
    connect(){this.calls.push(['connect']);if(autoReady)queueMicrotask(()=>this.emit('ready',{device_id:'device:1 /room'}));return typeof connectResult==='function'?connectResult(this):Promise.resolve(connectResult);}
    disconnect(){this.disconnections++;this.calls.push(['disconnect']);}
    async activateElement(){this.calls.push(['activate']);}
    async getCurrentState(){this.calls.push(['getCurrentState']);return this.currentState??null;}
    async pause(){this.calls.push(['pause']);}
    async resume(){this.calls.push(['resume']);}
    async previousTrack(){this.calls.push(['previousTrack']);}
    async nextTrack(){this.calls.push(['nextTrack']);}
    async seek(value){this.calls.push(['seek',value]);}
  }
  const win=sdkPresent?{Spotify:{Player:FakePlayer}}:{};
  for(const storage of ['localStorage','sessionStorage'])Object.defineProperty(win,storage,{get(){throw new Error('Adapter must not access storage');}});
  const context=vm.createContext({window:win,document:{head:{append(script){scripts.push(script);}},createElement(){return {removed:false,remove(){this.removed=true;}};}},
    fetch:async(url,options)=>{assert(String(url).startsWith('https://api.spotify.com/v1/'),'Only the fixed Spotify API origin is allowed');requests.push({url,options});return fetcher(url,options,requests.length);},
    setTimeout:(fn,ms)=>{const id=++timerId;timeouts.set(id,{fn,ms});return id;},clearTimeout:id=>timeouts.delete(id),
    setInterval:(fn,ms)=>{const id=++timerId;intervals.set(id,{fn,ms});return id;},clearInterval:id=>intervals.delete(id)});
  vm.runInContext(source.replace('export function createPremiumPlayer','function createPremiumPlayer')+'\nglobalThis.makePlayer=createPremiumPlayer;',context,{filename:'spotify-player.js'});
  const make=()=>context.makePlayer({getAccessToken:async options=>{tokenCalls.push(options??null);return tokenProvider(options);},onReady:()=>ready.push(true),onState:state=>states.push(state),onError:message=>errors.push(message)});
  const adapter=make();
  return {adapter,make,instances,requests,scripts,states,errors,ready,tokenCalls,timeouts,intervals,window:win,FakePlayer,
    async expire(){for(const [id,timer] of [...timeouts])if(timeouts.delete(id))timer.fn();await flush();},
    async poll(){for(const timer of [...intervals.values()])await timer.fn();await flush();}};
}
const tests=[];const test=(name,run)=>tests.push({name,run});

test('connect coalesces into one silent device, with no transfer or autoplay',async()=>{
  const h=harness();await Promise.all([h.adapter.connect(),h.adapter.connect()]);
  assert.equal(h.instances.length,1);assert.equal(h.ready.length,1);assert.equal(h.requests.length,0);
  assert.equal(h.instances[0].options.name,'Dad’s record room');assert.equal(h.instances[0].options.enableMediaSession,true);
  assert.equal(h.intervals.size,1);h.adapter.disconnect();assert.equal(h.intervals.size,0);
});
test('SDK token callback forwards only an ephemeral access token, with no storage',async()=>{
  const h=harness();await h.adapter.connect();let forwarded;
  h.instances[0].options.getOAuthToken(token=>forwarded=token);await flush();assert.equal(forwarded,TOKEN);
  assert(!JSON.stringify(h.states).includes(TOKEN));assert(!JSON.stringify(h.errors).includes(TOKEN));h.adapter.disconnect();
});
test('loads the trusted SDK once and resolves only on the ready callback',async()=>{
  const h=harness({sdkPresent:false});const second=h.make();const both=Promise.all([h.adapter.connect(),second.connect()]);await flush();
  assert.equal(h.scripts.length,1);assert.equal(h.instances.length,0);assert.equal(h.scripts[0].src,'https://sdk.scdn.co/spotify-player.js');
  h.window.Spotify={Player:h.FakePlayer};h.window.onSpotifyWebPlaybackSDKReady();await both;assert.equal(h.instances.length,2);
  h.adapter.disconnect();second.disconnect();assert.equal(h.timeouts.size,0);assert.equal(h.intervals.size,0);
});
test('SDK script error is safe and leaves no device or timer',async()=>{
  const h=harness({sdkPresent:false});const rejected=assert.rejects(h.adapter.connect(),/player could not load/i);await flush();h.scripts[0].onerror(new Error(TOKEN));await rejected;
  assert.equal(h.instances.length,0);assert.equal(h.timeouts.size,0);assert(h.scripts[0].removed);
});
test('SDK load timeout is safe and can be retried by a new adapter',async()=>{
  const h=harness({sdkPresent:false});const rejected=assert.rejects(h.adapter.connect(),/player did not load/i);await flush();await h.expire();await rejected;
  assert.equal(h.timeouts.size,0);assert(h.scripts[0].removed);
  h.window.Spotify={Player:h.FakePlayer};const another=h.make();await another.connect();another.disconnect();
});
test('malformed SDK-ready notification produces a safe load error',async()=>{
  const h=harness({sdkPresent:false});const rejected=assert.rejects(h.adapter.connect(),/player.*load|protected player|could not start/i);await flush();h.window.onSpotifyWebPlaybackSDKReady();await rejected;
  assert.equal(h.instances.length,0);assert.equal(h.timeouts.size,0);
});
test('failed device connect cleans polling/device and permits a fresh attempt',async()=>{
  let attempt=0;const h=harness({autoReady:false,connectResult:instance=>{attempt++;if(attempt>1)queueMicrotask(()=>instance.emit('ready',{device_id:'retry-device'}));return Promise.resolve(attempt>1);}});
  await assert.rejects(h.adapter.connect(),/could not connect/i);assert.equal(h.intervals.size,0);assert.equal(h.instances[0].disconnections,1);
  await h.adapter.connect();assert.equal(h.instances.length,2);assert.equal(h.ready.length,1);h.adapter.disconnect();
});
test('SDK initialization failure rejects once, sanitizes payload and releases resources',async()=>{
  const h=harness({autoReady:false,connectResult:()=>deferred().promise});const rejected=assert.rejects(h.adapter.connect(),/protected player/i);await flush();
  h.instances[0].emit('initialization_error',{message:TOKEN});await rejected;assert.equal(h.intervals.size,0);assert.equal(h.timeouts.size,0);assert.equal(h.instances[0].disconnections,1);assert(!h.errors.join('').includes(TOKEN));
  h.instances[0].emit('ready',{device_id:'late'});assert.equal(h.ready.length,0);h.adapter.disconnect();
});
test('device-ready timeout cleans its SDK device and ignores late callbacks',async()=>{
  const h=harness({autoReady:false});const rejected=assert.rejects(h.adapter.connect(),/did not connect/i);await flush();await h.expire();await rejected;
  assert.equal(h.intervals.size,0);assert.equal(h.instances[0].disconnections,1);h.instances[0].emit('ready',{device_id:'late'});assert.equal(h.ready.length,0);h.adapter.disconnect();
});
test('stop during SDK load never constructs a device or auto-plays later',async()=>{
  const h=harness({sdkPresent:false});const rejected=assert.rejects(h.adapter.connect(),/stopped/i);await flush();h.adapter.disconnect();
  h.window.Spotify={Player:h.FakePlayer};h.window.onSpotifyWebPlaybackSDKReady();await rejected;assert.equal(h.instances.length,0);assert.equal(h.requests.length,0);
});
test('stop during device connection rejects pending work and suppresses late state',async()=>{
  const h=harness({autoReady:false,connectResult:()=>deferred().promise});const rejected=assert.rejects(h.adapter.playAlbum(ALBUM),/stopped/i);await flush();h.adapter.disconnect();await rejected;
  assert.equal(h.intervals.size,0);assert.equal(h.timeouts.size,0);assert.equal(h.instances[0].disconnections,1);
  h.instances[0].emit('ready',{device_id:'late'});h.instances[0].emit('player_state_changed',{paused:false,position:99});assert.equal(h.ready.length,0);assert.equal(h.states.length,0);assert.equal(h.requests.length,0);
});
test('plays the exact verified album on its own encoded device at global offset',async()=>{
  const h=harness({fetcher:async()=>response(null,204)});await h.adapter.playAlbum(ALBUM,51);
  assert.equal(h.requests.length,1);const {url,options}=h.requests[0];assert.equal(url,'https://api.spotify.com/v1/me/player/play?device_id=device%3A1%20%2Froom');assert.equal(options.method,'PUT');
  assert.deepEqual(JSON.parse(options.body),{context_uri:`spotify:album:${ALBUM}`,offset:{position:51}});assert.equal(options.headers.Authorization,`Bearer ${TOKEN}`);h.adapter.disconnect();
});
test('rejects unverified album IDs and invalid global offsets before network/SDK',async()=>{
  const h=harness();for(const id of ['bad','https://spotify.com/album/'+ALBUM,'../me/player',null])await assert.rejects(h.adapter.playAlbum(id),/verified/);
  for(const offset of [-1,1.5,NaN,Infinity,'2'])await assert.rejects(h.adapter.playAlbum(ALBUM,offset),/verified/);
  await assert.rejects(h.adapter.tracks('bad'),/verified/);assert.equal(h.requests.length,0);assert.equal(h.instances.length,0);
});
test('401 forces one token refresh then retries exactly once',async()=>{
  let refreshed=false;const h=harness({tokenProvider:async options=>{if(options?.forceRefresh)refreshed=true;return refreshed?'fresh-synthetic-token':TOKEN;},fetcher:async(url,options,n)=>response(n===1?{}:{items:[track(1)],next:null},n===1?401:200)});
  const tracks=await h.adapter.tracks(ALBUM);assert.equal(tracks.length,1);assert.equal(h.requests.length,2);assert.equal(h.tokenCalls.filter(x=>x?.forceRefresh).length,1);assert.equal(h.requests[1].options.headers.Authorization,'Bearer fresh-synthetic-token');h.adapter.disconnect();
});
test('a second401 rejects safely without a refresh loop',async()=>{
  const h=harness({fetcher:async()=>response({error:{message:TOKEN}},401)});await assert.rejects(h.adapter.tracks(ALBUM),/reconnect/);assert.equal(h.requests.length,2);assert.equal(h.tokenCalls.filter(x=>x?.forceRefresh).length,1);h.adapter.disconnect();
});
test('token provider failures are sanitized without leaking its exception',async()=>{
  const h=harness({tokenProvider:async()=>{throw new Error(TOKEN);}});await assert.rejects(h.adapter.tracks(ALBUM),error=>!error.message.includes(TOKEN)&&/reconnect/i.test(error.message));assert.equal(h.requests.length,0);h.adapter.disconnect();
});
test('pagination flattens all discs and preserves global indices, not disc-local numbers',async()=>{
  const first=Array.from({length:50},(_,i)=>track(i+1));const h=harness({fetcher:async(url)=>url.includes('/tracks')?response(url.includes('offset=0')?{items:first,next:'https://unexpected.example/page'}:{items:[track(1,{id:'disc2-track1',disc_number:2,is_playable:false}),track(2,{id:'disc2-track2',disc_number:2})],next:null}):response(null,204)});
  const tracks=await h.adapter.tracks(ALBUM);assert.equal(tracks.length,52);assert.equal(tracks[50].disc,2);assert.equal(tracks[50].number,1);assert.equal(tracks[50].playable,false);assert(h.requests[1].url.endsWith('limit=50&offset=50'));
  await h.adapter.playAlbum(ALBUM,51);assert.equal(JSON.parse(h.requests.at(-1).options.body).offset.position,51);h.adapter.disconnect();
});
test('empty or excessive pagination rejects rather than silently truncating',async()=>{
  const empty=harness({fetcher:async()=>response({items:[],next:'more'})});await assert.rejects(empty.adapter.tracks(ALBUM),/complete track list/);assert.equal(empty.requests.length,1);empty.adapter.disconnect();
  const endless=harness({fetcher:async()=>response({items:[track(1)],next:'more'})});await assert.rejects(endless.adapter.tracks(ALBUM),/complete track list/);assert.equal(endless.requests.length,40);endless.adapter.disconnect();
});
test('stop while fetch is pending prevents its result from becoming a track list',async()=>{
  const pending=deferred();const h=harness({fetcher:()=>pending.promise});const rejected=assert.rejects(h.adapter.tracks(ALBUM),/stopped/i);await flush();h.adapter.disconnect();pending.resolve(response({items:[track(1)],next:null}));await rejected;assert.equal(h.requests.length,1);
});
test('stop while JSON body is pending also prevents a late track result',async()=>{
  const body=deferred();const h=harness({fetcher:async()=>({status:200,ok:true,json:()=>body.promise})});const rejected=assert.rejects(h.adapter.tracks(ALBUM),/stopped/i);await flush();h.adapter.disconnect();body.resolve({items:[track(1)],next:null});await rejected;
});
test('stop during forced refresh prevents the retry request',async()=>{
  const refresh=deferred();const h=harness({tokenProvider:options=>options?.forceRefresh?refresh.promise:Promise.resolve(TOKEN),fetcher:async()=>response({},401)});
  const rejected=assert.rejects(h.adapter.tracks(ALBUM),/stopped/i);await flush();h.adapter.disconnect();refresh.resolve('fresh');await rejected;assert.equal(h.requests.length,1);
});
test('404 recovery transfers the device with playfalse before retrying album offset',async()=>{
  const h=harness({fetcher:async(url,options,n)=>response({},n===1?404:204)});await h.adapter.playAlbum(ALBUM,3);assert.equal(h.requests.length,3);
  assert.equal(h.requests[1].url,'https://api.spotify.com/v1/me/player');assert.deepEqual(JSON.parse(h.requests[1].options.body),{device_ids:['device:1 /room'],play:false});assert.equal(JSON.parse(h.requests[2].options.body).offset.position,3);h.adapter.disconnect();
});
test('network/API errors are concise and never expose response bodies or credentials',async()=>{
  for(const status of [400,401,403,404,429,500]){
    const h=harness({fetcher:async()=>response({error:{message:TOKEN}},status)});await assert.rejects(h.adapter.tracks(ALBUM),error=>!error.message.includes(TOKEN)&&error.message.length<180);h.adapter.disconnect();
  }
  const h=harness({fetcher:async()=>{throw new Error(TOKEN);}});await assert.rejects(h.adapter.tracks(ALBUM),/Could not reach Spotify/);h.adapter.disconnect();
});
test('SDK playback errors preserve a usable device while sanitizing payloads',async()=>{
  const h=harness();await h.adapter.connect();h.instances[0].emit('playback_error',{message:TOKEN});assert.equal(h.errors.length,1);assert(!h.errors[0].includes(TOKEN));assert.equal(h.instances[0].disconnections,0);
  await h.adapter.pause();assert(h.instances[0].calls.some(x=>x[0]==='pause'));h.adapter.disconnect();assert.equal(h.intervals.size,0);
});
test('polling reports track state, avoids overlap and suppresses stopped results',async()=>{
  const h=harness();await h.adapter.connect();const pending=deferred();let reads=0;h.instances[0].getCurrentState=()=>{reads++;return pending.promise;};
  const first=h.poll();await h.poll();assert.equal(reads,1);h.adapter.disconnect();pending.resolve({paused:false,position:123,duration:456,track_window:{current_track:{id:'x',name:'Song',artists:[{name:'Artist'}]}}});await first;assert.equal(h.states.length,0);
});
test('SDK controls require readiness and shutdown is idempotent',async()=>{
  const h=harness();await assert.rejects(h.adapter.pause(),/Wait/);await h.adapter.connect();await h.adapter.pause();await h.adapter.resume();await h.adapter.previous();await h.adapter.next();await h.adapter.seek(12.6);
  assert(h.instances[0].calls.some(x=>x[0]==='seek'&&x[1]===13));h.adapter.disconnect();h.adapter.disconnect();assert.equal(h.instances[0].disconnections,1);await assert.rejects(h.adapter.resume(),/stopped/);assert.equal(h.intervals.size,0);
});
test('malformed HTTP bodies and missing tokens produce safe errors',async()=>{
  const missing=harness({tokenProvider:async()=>''});await assert.rejects(missing.adapter.tracks(ALBUM),/reconnect/);assert.equal(missing.requests.length,0);missing.adapter.disconnect();
  const invalid=harness({fetcher:async()=>({status:200,ok:true,json:async()=>{throw new Error(TOKEN);}})});
  await assert.rejects(invalid.adapter.tracks(ALBUM),error=>!error.message.includes(TOKEN)&&/response could not be read/.test(error.message));invalid.adapter.disconnect();
  const empty=harness({fetcher:async()=>response(null)});await assert.rejects(empty.adapter.tracks(ALBUM),/track list could not be read/);empty.adapter.disconnect();
});
test('SDK construction errors cannot expose implementation or token details',async()=>{
  const h=harness();h.window.Spotify.Player=class{constructor(){throw new Error(TOKEN);}};
  await assert.rejects(h.adapter.connect(),error=>!error.message.includes(TOKEN)&&/protected player/.test(error.message));assert.equal(h.intervals.size,0);h.adapter.disconnect();
});
test('token delivery and command completion are suppressed after Stop',async()=>{
  const token=deferred();const h=harness({tokenProvider:()=>token.promise});await h.adapter.connect();let delivered=false;
  h.instances[0].options.getOAuthToken(()=>delivered=true);await flush();h.adapter.disconnect();token.resolve(TOKEN);await flush();assert.equal(delivered,false);assert.equal(h.errors.length,0);
  const control=harness();await control.adapter.connect();const pause=deferred();control.instances[0].pause=()=>pause.promise;
  const rejected=assert.rejects(control.adapter.pause(),/stopped/);control.adapter.disconnect();pause.resolve();await rejected;
});

let failed=0;
for(const {name,run} of tests){try{await run();console.log(`PASS ${name}`);}catch(error){failed++;console.error(`FAIL ${name}\n${error.stack}`);}}
console.log(`Spotify playback adapter: ${tests.length-failed}/${tests.length} passed (no network or credentials).`);
if(failed)process.exitCode=1;

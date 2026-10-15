import {spotifySession} from './spotify-session.js?v=edf6cf4ffb19';
import {createPremiumPlayer} from './spotify-player.js?v=7f6b900a1534';
const $ = id => document.getElementById(id);
const dialog = $('listen-dialog'), widget = $('turntable-widget');
const supportsPopover = typeof widget.showPopover==='function';
const widgetIsOpen = () => supportsPopover&&widget.matches(':popover-open');
let record = null, controller = null, generation = 0, apiPromise = null, spotifyApi = null;
let playback = {ready:false,isPaused:true,isBuffering:false,position:0,duration:0};
let modalStack = [], previousFocus = null, observesPlayback = false;
let premium=null,usingPremium=false,playerMessage='',requesting=false,trackRows=[];

function loadSpotifyApi(){
  if(spotifyApi)return Promise.resolve(spotifyApi);
  if(apiPromise)return apiPromise;
  apiPromise=new Promise(resolve=>{
    const script=document.createElement('script');
    const fail=()=>{script.remove();resolve(null);};
    const timer=setTimeout(fail,12000);
    window.onSpotifyIframeApiReady=api=>{clearTimeout(timer);spotifyApi=api;resolve(api);};
    script.src='https://open.spotify.com/embed/iframe-api/v1';script.async=true;
    script.onerror=()=>{clearTimeout(timer);fail();};document.head.append(script);
  }).then(api=>{if(!api)apiPromise=null;return api;});
  return apiPromise;
}

function timestamp(ms){const seconds=Math.floor(Math.max(0,ms)/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}

function renderPlayback(){
  const loaded=!usingPremium||selectedAlbumIsLoaded();
  const playing=loaded&&playback.ready&&!playback.isPaused&&!playback.isBuffering;
  dialog.classList.toggle('is-playing',playing);widget.classList.toggle('is-playing',playing);
  const status=!playback.ready?(usingPremium?'Connecting Spotify…':'Loading Spotify…'):!loaded?'Choose a track':!observesPlayback?'Use Spotify controls':playback.isBuffering?'Buffering…':playback.isPaused?(playback.position?`Paused · ${timestamp(playback.position)}`:'Ready to play'):`Playing · ${timestamp(playback.position)}`;
  $('mini-player-status').textContent=status;
  $('spotify-player-status').textContent=playback.ready?'':status;
  $('spotify-player-status').hidden=playback.ready;
  const canPause=loaded&&!!(controller||premium)&&playback.ready&&!playback.isPaused;
  const button=$('mini-player-pause');button.textContent=canPause?'Ⅱ':'▶';
  const label=canPause?'Pause playback':usingPremium&&playback.ready?'Play music':'Open Spotify playback controls';button.setAttribute('aria-label',label);button.title=label;
  if(usingPremium)renderPremiumControls();
}

function renderSession(){
  const status=spotifySession.getStatus();
  $('spotify-session-title').textContent=status.connected?'Spotify connected':'Full albums with Premium';
  $('spotify-session-description').textContent=status.connected?'Play the album here with your Spotify Premium account.':status.configured?'Connect your Spotify account to play full albums in this room.':'Spotify’s embedded player may offer a preview. Open the album in Spotify for more playback options.';
  $('spotify-connect').hidden=!status.configured||status.connected;
  $('spotify-disconnect').hidden=!status.connected;
  $('spotify-sign-in').hidden=status.configured;
  $('spotify-refresh').textContent=status.connected?'Reconnect player':'Refresh preview';
  $('spotify-refresh').title=status.connected?'Reconnect the turntable; current playback stops':'Reload Spotify’s preview; current playback stops';
  $('spotify-sign-in-note').textContent=status.error|| (status.connected?'Connected in this tab. Minimize the turntable to keep listening.':'You’ll sign in securely with Spotify and return to this album.');
  $('spotify-note').textContent=usingPremium?'Choose Play album or a track. Minimize to keep listening while you browse.':'Use Spotify’s play button to start. Minimize to keep listening while you browse.';
}

function selectedAlbumIsLoaded(){
  const track=playback.track;
  if(!track)return false;
  if(playback.contextUri)return playback.contextUri===`spotify:album:${record?.spotifyId}`;
  return track.albumId?track.albumId===record?.spotifyId:trackRows.some(row=>row.track.id===track.id);
}

function renderPremiumControls(){
  const play=$('premium-play');if(!play)return;
  play.disabled=!playback.ready||requesting;
  play.textContent=requesting?'Working…':!selectedAlbumIsLoaded()?'Play album':playback.isPaused?'Resume':'Pause';
  for(const id of ['premium-previous','premium-next'])$(id).disabled=!playback.ready||!selectedAlbumIsLoaded()||requesting;
  const track=selectedAlbumIsLoaded()?playback.track:null;
  $('premium-track').textContent=track?`${track.name} · ${track.artists.join(', ')}`:'The full Spotify album';
  $('premium-message').textContent=playerMessage;
  const position=track?playback.position:0,duration=track?playback.duration:0;
  const seek=$('premium-seek');seek.disabled=!playback.ready||!track||!duration;seek.max=String(duration||1);
  if(document.activeElement!==seek)seek.value=String(position);
  $('premium-time').textContent=`${timestamp(position)} / ${timestamp(duration)}`;
  for(const row of trackRows){row.button.disabled=!playback.ready||requesting||!row.track.playable;row.button.classList.toggle('current-track',row.track.id===track?.id);row.button.setAttribute('aria-current',row.track.id===track?.id?'true':'false');}
}

async function premiumAction(action){
  if(!premium||requesting)return;
  const selected=premium;requesting=true;playerMessage='';renderPlayback();
  try{await action(selected);}catch(error){if(premium===selected)playerMessage=error.message||'Spotify could not update playback. Try again.';}
  finally{if(premium===selected){requesting=false;renderPlayback();}}
}

function playPremium(){
  premium?.activate();
  return premiumAction(player=>!selectedAlbumIsLoaded()?player.playAlbum(record.spotifyId):playback.isPaused?player.resume():player.pause());
}

async function createFullPlayer(ticket,selected){
  usingPremium=true;trackRows=[];
  $('spotify-player').innerHTML='<section class="premium-player" aria-label="Spotify full album player"><div class="premium-controls"><button id="premium-previous" aria-label="Previous track" disabled>‹</button><button id="premium-play" disabled>Connecting…</button><button id="premium-next" aria-label="Next track" disabled>›</button></div><p id="premium-track">The full Spotify album</p><input id="premium-seek" type="range" min="0" max="1" value="0" aria-label="Playback position" disabled><span id="premium-time">0:00 / 0:00</span><p id="premium-message" role="status"></p><ol id="premium-tracks" aria-label="Album tracks"><li class="premium-loading">Loading tracks…</li></ol></section>';
  $('premium-play').onclick=playPremium;
  $('premium-previous').onclick=()=>premiumAction(player=>player.previous());
  $('premium-next').onclick=()=>premiumAction(player=>player.next());
  $('premium-seek').onchange=event=>premiumAction(player=>player.seek(Number(event.target.value)));
  const player=createPremiumPlayer({getAccessToken:options=>spotifySession.getAccessToken(options),
    onReady:()=>{if(ticket===generation){playback.ready=true;renderPlayback();}},
    onState:state=>{if(ticket===generation){playback=state;renderPlayback();}},
    onError:message=>{if(ticket===generation){playerMessage=message;renderPlayback();}}});
  premium=player;observesPlayback=true;renderSession();renderPlayback();
  player.tracks(selected.spotifyId).then(tracks=>{
    if(ticket!==generation||premium!==player||!usingPremium)return;
    const list=$('premium-tracks');if(!list)return;list.replaceChildren();
    tracks.forEach((track,index)=>{
      const item=document.createElement('li'),button=document.createElement('button');
      const name=document.createElement('span'),duration=document.createElement('small');
      name.textContent=`${index+1}. ${track.name}`;duration.textContent=track.playable?timestamp(track.duration):'Unavailable';
      button.append(name,duration);button.setAttribute('aria-label',`Play ${track.name}`);
      button.onclick=()=>{premium?.activate();premiumAction(active=>active.playAlbum(selected.spotifyId,index));};
      item.append(button);list.append(item);trackRows.push({button,track});
    });renderPlayback();
  }).catch(()=>{if(ticket===generation&&premium===player&&usingPremium&&$('premium-tracks')){$('premium-tracks').textContent='The track list could not load. You can still try Play album.';}});
  try{await player.connect();}
  catch(error){
    if(ticket!==generation)return;
    player.disconnect();premium=null;usingPremium=false;trackRows=[];
    playerMessage='';playback={ready:false,isPaused:true,isBuffering:false,position:0,duration:0};
    $('spotify-player').replaceChildren();renderSession();
    $('spotify-sign-in-note').textContent=`${error.message||'Full playback could not start in this browser.'} You can use the preview or open the album in Spotify.`;
    await createEmbeddedPlayer(ticket,selected);
  }
}

function syncWidget(){
  modalStack=modalStack.filter(d=>d.isConnected&&d.open);
  const show=!!record&&!dialog.open;
  if(!show){if(widgetIsOpen())widget.hidePopover();widget.hidden=true;return;}
  // Only this iframe-free control surface moves. Spotify's document never moves
  // or reloads when minimizing, reopening, or changing the collection view.
  const host=modalStack.at(-1)||document.body;
  if(widget.parentElement!==host){if(widgetIsOpen())widget.hidePopover();host.append(widget);}
  widget.hidden=false;
  if(supportsPopover&&!widgetIsOpen())widget.showPopover();
}

new MutationObserver(changes=>{
  for(const {target} of changes){
    if(target.tagName!=='DIALOG')continue;
    modalStack=modalStack.filter(d=>d!==target);
    if(target.open)modalStack.push(target);
  }
  syncWidget();
}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});

function setRecordDetails(r){
  $('playing-title').textContent=r.title;$('playing-artist').textContent=r.artist;
  $('mini-player-title').textContent=r.title;$('mini-player-artist').textContent=r.artist;
  for(const id of ['playing-cover','mini-player-cover']){const image=$(id);image.hidden=!r.cover;if(r.cover)image.src=r.cover;else image.removeAttribute('src');}
  $('expand-turntable').setAttribute('aria-label',`Expand turntable: ${r.title} by ${r.artist}`);
  const album=`https://open.spotify.com/album/${r.spotifyId}`;
  $('spotify-open').href=album;
  $('spotify-sign-in').href=`https://accounts.spotify.com/en/login?continue=${encodeURIComponent(album)}`;
  renderSession();
}

function destroyPlayer(){
  generation++;
  controller?.destroy();controller=null;premium?.disconnect();premium=null;usingPremium=false;requesting=false;trackRows=[];playerMessage='';$('spotify-player').replaceChildren();
}

async function createPlayer(){
  destroyPlayer();
  const ticket=generation, selected=record;
  observesPlayback=false;
  playback={ready:false,isPaused:true,isBuffering:false,position:0,duration:0};renderPlayback();
  await spotifySession.ready;
  if(ticket!==generation||!record)return;
  if(spotifySession.getStatus().connected)return createFullPlayer(ticket,selected);
  renderSession();return createEmbeddedPlayer(ticket,selected);
}

async function createEmbeddedPlayer(ticket,selected){
  observesPlayback=false;
  const mount=document.createElement('div');$('spotify-player').append(mount);
  const api=await loadSpotifyApi();
  if(ticket!==generation||!record)return;
  const fallback=()=>{
    const frame=document.createElement('iframe');frame.src=`https://open.spotify.com/embed/album/${selected.spotifyId}?utm_source=generator&theme=0`;
    frame.title=`Spotify player for ${selected.title} by ${selected.artist}`;
    frame.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';frame.allowFullscreen=true;
    frame.addEventListener('load',()=>{if(ticket!==generation)return;playback.ready=true;renderPlayback();});mount.replaceWith(frame);
  };
  if(!api){fallback();return;}
  try{api.createController(mount,{url:`https://open.spotify.com/album/${selected.spotifyId}?theme=0`,width:'100%',height:352},embed=>{
    if(ticket!==generation){embed.destroy();return;}
    controller=embed;observesPlayback=true;
    const frame=$('spotify-player').querySelector('iframe');if(frame)frame.title=`Spotify player for ${selected.title} by ${selected.artist}`;
    embed.addListener('ready',()=>{if(ticket!==generation)return;playback.ready=true;renderPlayback();});
    embed.addListener('playback_update',event=>{
      if(ticket!==generation)return;
      const data=event.data||{};
      playback={ready:true,isPaused:!!data.isPaused,isBuffering:!!data.isBuffering,position:Number(data.position)||0,duration:Number(data.duration)||0};renderPlayback();
    });
    embed.addListener('playback_started',()=>{if(ticket!==generation)return;playback.ready=true;playback.isPaused=false;renderPlayback();});
  });}catch{fallback();}
}

function expandPlayer(){
  if(!record||dialog.open)return;
  previousFocus=document.activeElement;
  if(widgetIsOpen())widget.hidePopover();widget.hidden=true;
  dialog.showModal();
}

function minimizePlayer(){if(dialog.open)dialog.close();}

function stopPlayer(){
  const focusWasPlayer=widget.contains(document.activeElement)||dialog.contains(document.activeElement);
  record=null;destroyPlayer();playback={ready:false,isPaused:true,isBuffering:false,position:0,duration:0};renderPlayback();
  if(dialog.open)dialog.close();syncWidget();
  if(focusWasPlayer){const host=modalStack.at(-1);(host?.querySelector('button')||$('all-button')).focus({preventScroll:true});}
}

export function openTurntable(r){
  if(r.confidence!=='confirmed'||!r.spotifyId||!/^[A-Za-z0-9]{22}$/.test(r.spotifyId))return;
  const sameAlbum=record?.spotifyId===r.spotifyId;record=r;setRecordDetails(r);
  expandPlayer();if(!sameAlbum)createPlayer();
}

export async function restoreTurntable(records){
  await spotifySession.ready;
  const id=spotifySession.consumeReturnRecordId();
  const selected=records.find(item=>item.id===id);
  if(selected)openTurntable(selected);
}

$('close-listen').onclick=minimizePlayer;
dialog.addEventListener('cancel',event=>{event.preventDefault();minimizePlayer();});
dialog.addEventListener('close',()=>{syncWidget();if(record&&previousFocus?.isConnected)previousFocus.focus({preventScroll:true});});
$('expand-turntable').onclick=expandPlayer;
$('mini-player-pause').onclick=()=>{
  if(usingPremium){playPremium();return;}
  if(controller&&playback.ready&&!playback.isPaused)controller.pause();
  else expandPlayer(); // Start/resume with Spotify's own controls and account context.
};
$('stop-listen').onclick=stopPlayer;$('stop-turntable').onclick=stopPlayer;
$('spotify-refresh').onclick=()=>{if(record)createPlayer();};
$('spotify-connect').onclick=async()=>{
  const button=$('spotify-connect');button.disabled=true;
  try{await spotifySession.connect({recordId:record?.id});}catch{renderSession();button.disabled=false;}
};
$('spotify-disconnect').onclick=()=>{spotifySession.disconnect();if(record)createPlayer();};
window.addEventListener('spotify-session-change',renderSession);
spotifySession.ready.then(renderSession);
$('spotify-sign-in').addEventListener('click',()=>{$('spotify-sign-in-note').textContent='After signing in, return here and choose Refresh player. This resets playback; choose a track again.';});
widget.addEventListener('click',event=>event.stopPropagation());

const $ = id => document.getElementById(id);
const dialog = $('listen-dialog'), widget = $('turntable-widget');
const supportsPopover = typeof widget.showPopover==='function';
const widgetIsOpen = () => supportsPopover&&widget.matches(':popover-open');
let record = null, controller = null, generation = 0, apiPromise = null, spotifyApi = null;
let playback = {ready:false,isPaused:true,isBuffering:false,position:0,duration:0};
let modalStack = [], previousFocus = null, observesPlayback = false;

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
  const playing=playback.ready&&!playback.isPaused&&!playback.isBuffering;
  dialog.classList.toggle('is-playing',playing);widget.classList.toggle('is-playing',playing);
  const status=!playback.ready?'Loading Spotify…':!observesPlayback?'Use Spotify controls':playback.isBuffering?'Buffering…':playback.isPaused?(playback.position?`Paused · ${timestamp(playback.position)}`:'Ready to play'):`Playing · ${timestamp(playback.position)}`;
  $('mini-player-status').textContent=status;
  $('spotify-player-status').textContent=playback.ready?'':status;
  $('spotify-player-status').hidden=playback.ready;
  const canPause=!!controller&&playback.ready&&!playback.isPaused;
  const button=$('mini-player-pause');button.textContent=canPause?'Ⅱ':'▶';
  const label=canPause?'Pause playback':'Open Spotify playback controls';button.setAttribute('aria-label',label);button.title=label;
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
}

function destroyPlayer(){
  generation++;
  controller?.destroy();controller=null;$('spotify-player').replaceChildren();
}

async function createPlayer(){
  destroyPlayer();
  const ticket=generation, selected=record;
  observesPlayback=false;
  playback={ready:false,isPaused:true,isBuffering:false,position:0,duration:0};renderPlayback();
  return createEmbeddedPlayer(ticket,selected);
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
  // Finish in-flight authorizations from the earlier player, but always return
  // to Spotify's own widget. An app connection never replaces its controls.
  const params=new URLSearchParams(location.search);
  if(!params.has('code')&&!params.has('error'))return;
  const {spotifySession}=await import('./spotify-session.js?v=edf6cf4ffb19');
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
  if(controller&&playback.ready&&!playback.isPaused)controller.pause();
  else expandPlayer(); // Start/resume with Spotify's own controls and account context.
};
$('stop-listen').onclick=stopPlayer;$('stop-turntable').onclick=stopPlayer;
$('spotify-refresh').onclick=()=>{if(record)createPlayer();};
widget.addEventListener('click',event=>event.stopPropagation());

let sdkPromise;
const albumIdPattern=/^[A-Za-z0-9]{22}$/;
const failureMessages={
  initialization_error:'This browser cannot start Spotify’s protected player. Try Safari, Chrome, or Open album in Spotify.',
  authentication_error:'Spotify needs you to reconnect your account.',
  account_error:'Full playback requires Spotify Premium and an account allowed in this Spotify app.',
  playback_error:'Spotify could not play this track. Try another track or open the album in Spotify.',
};

function loadSdk(){
  if(window.Spotify?.Player)return Promise.resolve(window.Spotify);
  if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    let settled=false;
    const finish=error=>{
      if(settled)return;settled=true;
      if(!error&&!window.Spotify?.Player)error=new Error('Spotify’s player could not load. Check your connection and try again.');
      clearTimeout(timer);script.onerror=null;if(error){script.remove();reject(error);}else resolve(window.Spotify);
    };
    const timer=setTimeout(()=>finish(new Error('Spotify’s player did not load. Check your connection and try again.')),15000);
    window.onSpotifyWebPlaybackSDKReady=()=>finish();
    script.src='https://sdk.scdn.co/spotify-player.js';script.async=true;
    script.onerror=()=>finish(new Error('Spotify’s player could not load. Check your connection and try again.'));
    document.head.append(script);
  }).catch(error=>{sdkPromise=null;throw error;});
  return sdkPromise;
}

// A single SDK device survives minimizing and browsing. Only Stop, an album
// change or Disconnect releases it; no access tokens are stored by this layer.
export function createPremiumPlayer({getAccessToken,onReady=()=>{},onState=()=>{},onError=()=>{}}){
  let player=null,deviceId=null,closed=false,connection=null,pollTimer=null,polling=false,rejectConnection=null;
  const active=()=>{if(closed)throw new Error('The turntable was stopped.');};
  const releasePlayer=()=>{
    clearInterval(pollTimer);pollTimer=null;polling=false;deviceId=null;
    const previous=player;player=null;
    try{previous?.disconnect();}catch{} // Stopping still completes if the SDK is already unavailable.
  };
  async function accessToken(options){
    active();
    try{const token=await getAccessToken(options);active();if(typeof token!=='string'||!token)throw new Error();return token;}
    catch{active();throw new Error(failureMessages.authentication_error);}
  }
  const receive=state=>{
    if(closed||!state)return;
    const track=state.track_window?.current_track;
    onState({ready:true,isPaused:!!state.paused,isBuffering:false,position:Number(state.position)||0,duration:Number(state.duration)||0,
      contextUri:typeof state.context?.uri==='string'?state.context.uri:null,
      track:track?{id:track.id,name:track.name,artists:track.artists?.map(artist=>artist.name)??[],
        albumId:/^spotify:album:[A-Za-z0-9]{22}$/.test(track.album?.uri??'')?track.album.uri.split(':')[2]:null}:null});
  };
  async function api(path,{method='GET',data}={},retry=true){
    active();
    const token=await accessToken();
    let response;
    try{response=await fetch('https://api.spotify.com/v1'+path,{method,headers:{Authorization:`Bearer ${token}`,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});}
    catch{active();throw new Error('Could not reach Spotify. Check your connection and try again.');}
    active();
    if(response.status===401&&retry){await accessToken({forceRefresh:true});return api(path,{method,data},false);}
    if(!response.ok){
      const message=response.status===403?'Spotify declined this request. Check Premium and that your account is allowed in the Spotify app.':
        response.status===401?'Spotify needs you to reconnect your account.':response.status===429?'Spotify is busy. Wait a moment before trying again.':
        response.status===404?'Spotify could not find this turntable or album. Try reconnecting the player.':'Spotify could not complete that request. Try again or open the album in Spotify.';
      const error=new Error(message);error.status=response.status;throw error;
    }
    let result;
    try{result=response.status===204?null:await response.json();}
    catch{active();throw new Error('Spotify’s response could not be read. Try again.');}
    active();return result;
  }
  async function connect(){
    active();if(connection)return connection;
    connection=(async()=>{
      const sdk=await loadSdk();active();
      try{player=new sdk.Player({name:'Dad’s record room',volume:.7,enableMediaSession:true,
        getOAuthToken:callback=>{accessToken().then(token=>{if(!closed)callback(token);}).catch(()=>{if(!closed)onError(failureMessages.authentication_error);});}});}
      catch{throw new Error(failureMessages.initialization_error);}
      const instance=player,current=()=>!closed&&player===instance;
      return new Promise((resolve,reject)=>{
        let settled=false;
        const settle=(error)=>{if(settled)return;settled=true;clearTimeout(timer);rejectConnection=null;error?reject(error):resolve();};
        rejectConnection=()=>settle(new Error('The turntable was stopped.'));
        const timer=setTimeout(()=>settle(new Error('Spotify did not connect this turntable. Try again.')),15000);
        instance.addListener('ready',({device_id})=>{if(!current())return;deviceId=device_id;settle();onReady();});
        instance.addListener('not_ready',()=>{if(current()){deviceId=null;onError('The Spotify player went offline. Reconnect the player to continue.');}});
        instance.addListener('player_state_changed',state=>{if(current())receive(state);});
        instance.addListener('autoplay_failed',()=>{if(current())onError('Tap Play again to allow audio in this browser.');});
        for(const [event,message] of Object.entries(failureMessages))instance.addListener(event,()=>{if(current()){settle(new Error(message));onError(message);}});
        instance.connect().then(connected=>{if(!connected)settle(new Error('Spotify could not connect this turntable.'));}).catch(()=>settle(new Error('Spotify could not connect this turntable.')));
        pollTimer=setInterval(async()=>{
          if(!current()||polling||!deviceId)return;
          polling=true;try{const state=await instance.getCurrentState();if(current())receive(state);}catch{}finally{polling=false;}
        },1000);
      });
    })().catch(error=>{releasePlayer();connection=null;throw error;});
    return connection;
  }
  function activate(){if(!closed&&player)player.activateElement().catch(()=>{});}
  async function playAlbum(albumId,offset=0){
    if(!albumIdPattern.test(albumId)||!Number.isInteger(offset)||offset<0)throw new Error('Choose a verified Spotify album and track.');
    activate();await connect();active();
    if(!deviceId)throw new Error('The Spotify player is offline. Reconnect the player.');
    const path=`/me/player/play?device_id=${encodeURIComponent(deviceId)}`,data={context_uri:`spotify:album:${albumId}`,offset:{position:offset}};
    try{await api(path,{method:'PUT',data});}
    catch(error){
      if(error.status!==404)throw error;
      await api('/me/player',{method:'PUT',data:{device_ids:[deviceId],play:false}});
      await api(path,{method:'PUT',data});
    }
  }
  async function tracks(albumId){
    if(!albumIdPattern.test(albumId))throw new Error('Choose a verified Spotify album.');
    const result=[];
    for(let page=0;page<40;page++){
      const data=await api(`/albums/${albumId}/tracks?limit=50&offset=${result.length}`);
      if(!Array.isArray(data?.items))throw new Error('Spotify’s track list could not be read.');
      result.push(...data.items.map(track=>({id:track.id,name:track.name,artists:track.artists?.map(artist=>artist.name)??[],
        duration:Number(track.duration_ms)||0,number:track.track_number,disc:track.disc_number,playable:track.is_playable!==false})));
      if(!data.next)return result;
      if(!data.items.length)break;
    }
    throw new Error('Spotify’s complete track list could not be loaded.');
  }
  const command=async(method,...args)=>{
    active();if(!player||!deviceId)throw new Error('Wait for Spotify to connect the turntable.');
    try{await player[method](...args);active();}catch{active();throw new Error('Spotify could not update playback. Try again.');}
  };
  function disconnect(){
    if(closed)return;closed=true;rejectConnection?.();releasePlayer();
  }
  return{connect,playAlbum,tracks,activate,
    pause:()=>command('pause'),resume:()=>{activate();return command('resume');},
    previous:()=>command('previousTrack'),next:()=>command('nextTrack'),
    seek:position=>command('seek',Math.max(0,Math.round(position))),disconnect};
}

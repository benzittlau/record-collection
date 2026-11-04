import {createBoxBrowsing} from './box-browsing.js?v=52463fa8fc93';
import {fitHomography,cssProjection,sourceClip,projectPoint} from './photo-projection.js?v=a275d56a7eaf';
import {projectSpineMasks} from './spine-masks.js?v=75a96f6a5f99';
import {openTurntable,restoreTurntable} from './turntable.js?v=9724e9847d80';
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const boxes = {
  'upper-left': {number:1,name:'The upper left box',photo:'IMG_3569.jpg',description:'Pink Floyd, Joni Mitchell, Genesis and more. The sleeves stay in their original order, from left to right.'},
  'lower-left': {number:2,name:'The lower left box',photo:'IMG_3571.jpg',description:'Bob Dylan, Fleetwood Mac, Brian Eno and more. A well-loved box, with a few mysteries still between the familiar names.'},
  'upper-middle': {number:3,name:'The upper middle box',photo:'IMG_3570.jpg',description:'Talking Heads, Elton John, The Police and more. Pull out a sleeve and see what comes next.'},
  'lower-middle': {number:4,name:'The lower middle box',photo:'IMG_3572.jpg',description:'David Bowie, The Beatles, classical music and Christmas records. An eclectic box, just as it was kept.'},
  'right': {number:5,name:'The right-hand box',photo:'IMG_3573.jpg',description:'Jazz, Tom Waits, Neil Young and more. There’s even a Roger Dean art book tucked in among the records.'}
};
const roomGeometry = {
 'upper-left':{polygon:'194,243 588,248 598,525 249,590 207,510',face:[[253,281],[584,270],[587,510],[290,571]],center:[410,421],height:347},
 'lower-left':{polygon:'211,590 563,528 572,747 249,845',face:[[233,599],[555,548],[564,738],[266,816]],center:[391,686],height:317},
 'upper-middle':{polygon:'618,235 921,236 915,478 657,504 621,470',face:[[662,258],[909,249],[899,465],[671,491]],center:[775,370],height:269},
 'lower-middle':{polygon:'631,493 921,468 913,667 675,713 638,690',face:[[679,513],[908,490],[902,662],[686,696]],center:[778,590],height:245},
 'right':{polygon:'951,520 1020,446 1294,477 1262,814 946,747',face:[[962,540],[1277,580],[1244,792],[958,740]],center:[1110,635],height:368}
};
let cameraReturnTimer;
let cameraBase = null;
let records = [], sourceRecords = [], previewAnchor = {}, currentView = 'front', ignoreJacketClick = false;
const browsing = createBoxBrowsing({document, window, renderRecord, renderPreview, onOpen: showBox, onClose: leaveBox});
const spotifyIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="currentColor"/><path d="M5 8c5-1.6 10-1.3 14 1M6 12c4-1.2 8-1 12 .8M7 16c3-.7 6-.5 9 .6" fill="none" stroke="#d8e0cb" stroke-width="1.6" stroke-linecap="round"/></svg>';
const turntableIcon = '<svg class="turntable-button-icon" viewBox="0 0 48 32" aria-hidden="true"><rect x="1" y="1" width="46" height="30" rx="2" fill="#999e8e" stroke="#777e6e"/><circle cx="17" cy="16" r="12.5" fill="#171b16"/><g fill="none" stroke="#434b3d" stroke-width=".7"><circle cx="17" cy="16" r="10.5"/><circle cx="17" cy="16" r="8.5"/><circle cx="17" cy="16" r="6.5"/></g><circle cx="17" cy="16" r="4" fill="#e6c993"/><circle cx="17" cy="16" r=".9" fill="#202420"/><path d="M40 6 33 23" fill="none" stroke="#dce1d2" stroke-width="2.2" stroke-linecap="round"/><path d="m33 22-1.5 4" stroke="#333a2d" stroke-width="3"/><circle cx="40" cy="6" r="2" fill="#6e7864"/></svg>';
const photoCalibrationReady=fetch('box-photos.json?v=8d2f41a45e65',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
const spineMasksReady=fetch('spine-masks.json?v=51fd67f9dfb8',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
let photoProjectionRequest=0;
const catalogReady = fetch('catalog.json?v=34b6abcb6a93',{cache:'no-store'}).then(r => {if(!r.ok)throw new Error('catalog');return r.json();}).then(data => {
  sourceRecords = (data.records ?? data).map(r => ({...r,cover:r.cover ?? r.coverPath ?? null,back:r.back ?? r.backPath ?? r.backCover ?? null,kind:r.kind ?? 'record'}));
  records = sourceRecords.filter(r => !r.mergedInto);
  const identified = records.filter(r => r.confidence === 'confirmed').length;
  const unknown = records.filter(r => r.confidence === 'unknown').length;
  $('record-total').textContent = `${records.length} catalogued sleeves & books`;
  $('identified-total').textContent = `Five boxes · ${identified} identified`;
  $('about-stats').innerHTML = `<span>${identified} identified</span><span>${unknown} awaiting a closer look</span>`;
  const linked = records.filter(r => r.spotifyId).length;
  $('about-stats').title = `${linked} verified Spotify album links. Positions are reconstructed from visible spines; very thin worn sleeves may need confirmation.`;
  const hash = decodeURIComponent(location.hash.slice(1));
  if(hash.startsWith('record=')){const r = records.find(r => r.id === resolveRecordId(hash.slice(7)));if(r)openBox(r.box,r.id);}else if(hash.startsWith('box=')&&boxes[hash.slice(4)])openBox(hash.slice(4));
  return records;
}).catch(() => {
  const banner = document.createElement('div');banner.className='load-error';banner.innerHTML='The collection could not load. <button>Try again</button>';banner.querySelector('button').onclick=()=>location.reload();$('room').append(banner);
  return [];
});
function boxRecords(){return browsing.records;}
catalogReady.then(restoreTurntable);
function resolveRecordId(id){const seen=new Set();let row=sourceRecords.find(r=>r.id===id);while(row?.mergedInto&&!seen.has(row.id)){seen.add(row.id);row=sourceRecords.find(r=>r.id===row.mergedInto);}return row?.id??id;}
function sleeveNumber(r){return r.positionLabel??r.position;}
function isFamilyArtwork(r,side){return r.artworkProvenance?.[side]?.source==='Family photograph';}
function artworkNote(r,side='front'){
  if(!artworkPath(r,side))return side==='back'?'The original back cover is still to come':'A placeholder until the cover is found';
  if(isFamilyArtwork(r,side))return `The family copy · ${side==='back'?'back':'front'} of the original sleeve`;
  return side==='back'?'Sourced back artwork · exact pressing may differ':'Album artwork · original sleeve edition may differ';
}
function artworkPath(r, side='front'){return side==='front' ? r.cover : r.back || (r.backUrl?.startsWith('https:') ? r.backUrl : r.backUrl?.replace('http:','https:'));}
function placeholder(r,small=false){
  if(small)return `<span class="strip-placeholder">${escapeHtml(r.confidence==='unknown'?'Unidentified sleeve':r.title)}</span>`;
  return `<div class="placeholder-cover"><span class="small-label">${r.confidence==='unknown'?'Waiting to be rediscovered':'Artwork still to come'}</span><strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(r.artist)}<br>${r.confidence==='unknown'?'This sleeve keeps its place in the box.':'Album identified from the spine.'}</small></div>`;
}
function mountCover(container,r,side='front',small=false,lazy=false){
  container.classList.remove('cover-missing');
  const path = artworkPath(r,side);
  if(!path){container.innerHTML=placeholder(r,small);return;}
  const img=document.createElement('img');img.className='cover-image';img.alt=side==='front'?`${r.artist} — ${r.title}, front cover`:`${r.title}, sourced back cover`;img.loading=lazy?'lazy':'eager';img.decoding='async';img.src=path;
  let usingThumbnail=small&&side==='front'&&!!r.coverThumbnail;
  if(usingThumbnail)img.src=r.coverThumbnail;
  img.onerror=()=>{if(usingThumbnail){usingThumbnail=false;img.src=path;return;}container.innerHTML=side==='back'?backPlaceholder():placeholder(r,small);container.classList.add('cover-missing');};
  container.replaceChildren(img);
}
function backPlaceholder(){return '<div class="back-placeholder"><span class="brand-disc" aria-hidden="true"></span><p>A little more<br>to rediscover.</p><small>The back of this sleeve hasn’t been photographed yet. It’ll be here when it is.</small></div>';}
async function openBox(box,id){
  await catalogReady;
  if(!records.length)return;
  const list=records.filter(r=>r.box===box).sort((a,b)=>a.position-b.position);
  browsing.open(box,list,id?resolveRecordId(id):null);
}
function showBox(box,list){
  clearTimeout(cameraReturnTimer);
  const meta=boxes[box];$('box-number').textContent=`Box ${meta.number} of 5 · ${list.length} catalogued items`;$('box-name').textContent=meta.name;
  $('box-photo').src=`assets/${meta.photo}`;$('box-photo').alt=`Original photograph of ${meta.name.toLowerCase()}`;$('box-description').textContent=meta.description;
  $('box-tooltip').classList.remove('visible');
  cameraBase=getCameraBase();
  focusCamera(box,list);buildStrip(list);
}
function leaveBox(){
  returnCameraToRoom();$('scene-plane').classList.remove('camera-zoomed');
  cameraReturnTimer=setTimeout(()=>{if(!$('box-dialog').open)$('scene').classList.remove('camera-active');},reducedMotion?0:900);
  $('room').classList.remove('at-box');cameraBase=null;
}
function buildStrip(list){
  const strip=$('record-strip');strip.replaceChildren();
  list.forEach((r,i)=>{const b=document.createElement('button');b.className='strip-record';b.dataset.index=i;b.title=`${sleeveNumber(r)}. ${r.artist} — ${r.title}`;b.setAttribute('aria-label',`Sleeve ${sleeveNumber(r)}. ${r.artist}, ${r.title}`);mountCover(b,r,'front',true,true);b.addEventListener('mouseenter',()=>previewSpine(r,{element:b}));b.addEventListener('mouseleave',browsing.hidePreview);b.addEventListener('focus',()=>previewSpine(r,{element:b}));b.addEventListener('blur',browsing.hidePreview);
    const num=document.createElement('small');num.textContent=sleeveNumber(r);b.append(num);b.onclick=()=>{if(strip.dataset.dragged==='true')return;browsing.pull(i);};strip.append(b);});requestAnimationFrame(browsing.refresh);
}
function renderRecord(){
  const list=boxRecords(),r=list[browsing.index];if(!r)return;
  currentView='front';$('jacket').classList.remove('is-back');$('jacket-front').setAttribute('aria-hidden','false');$('jacket-back').setAttribute('aria-hidden','true');$('record-view').classList.remove('show-vinyl');
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view==='front');b.setAttribute('aria-pressed',String(b.dataset.view==='front'));});
  mountCover($('jacket-front'),r);
  if(artworkPath(r,'back'))mountCover($('jacket-back'),r,'back');else $('jacket-back').innerHTML=backPlaceholder();
  $('vinyl-label-image').src=r.label||r.cover||'';$('vinyl-label-image').style.display=r.label||r.cover?'block':'none';$('vinyl-label-image').style.opacity=r.label?'1':'';$('vinyl-label-image').parentElement.style.border=r.label?'1px solid #25231e':'';$('vinyl-label-title').textContent=r.label?'':r.title;
  $('vinyl-button').hidden=r.kind==='book';
  $('jacket').setAttribute('aria-label',`Turn over ${r.title}`);
  $('record-location').textContent=`Box ${boxes[browsing.box].number} · ${r.kind==='book'?'Art book':'Sleeve'} ${sleeveNumber(r)}${r.compartment?` · Section ${r.compartment}`:''}`;
  $('album-position').textContent=`${browsing.index+1} / ${list.length}`;
  $('album-position').title=`${browsing.index+1} of ${list.length} in this box`;
  document.querySelector('.sleeve-stage').dataset.view='front';
  $('record-title').textContent=r.title;$('record-artist').textContent=r.artist;
  $('record-tags').innerHTML=[r.year,r.kind==='book'?'Art book':'Vinyl',r.confidence==='unknown'?'Unidentified':r.confidence==='probable'?'Likely identification':null].filter(Boolean).map(t=>`<span>${escapeHtml(t)}</span>`).join('');
  $('record-evidence').textContent=r.familyCapture?'Identified from the front and back of the family sleeve.':r.confidence==='confirmed'?'Identified from the photographed spine.':r.confidence==='probable'?'A likely match from the visible spine. A closer photograph will help confirm it.':'The spine is too worn to identify yet. Its place in the collection is preserved.';
  $('record-notes').textContent=[r.spineText?`Spine: “${r.spineText}”.`:null,r.notes,r.artworkEdition||r.coverNotes||(r.cover?'Cover art represents the album; the exact pressing is unverified.':null),r.backArtworkEdition||r.backEdition||r.backNotes||(r.back?'The sourced back cover may be from a different pressing.':null),r.label?(r.labelEdition||'The pictured label is sourced from a documented LP edition; the family disc and its condition have not been photographed.'):null,r.spotifyId&&r.spotifyEdition?`Spotify edition: ${r.spotifyEdition}`:null].filter(Boolean).join(' ');
  const sourceLinks=(r.sources??[]).map(s=>typeof s==='string'?s:s.url).filter(s=>/^https?:\/\//.test(s??''));
  $('record-sources').innerHTML=sourceLinks.slice(0,6).map((url,i)=>`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceName(url,i))} ↗</a>`).join('');
  const search=`https://open.spotify.com/search/${encodeURIComponent(`${r.artist} ${r.title}`)}`;
  if(r.kind==='book'){$('listen-actions').innerHTML='<p class="record-evidence">An art book, tucked in with the records.</p>';}
  else if(r.spotifyId&&/^[A-Za-z0-9]{22}$/.test(r.spotifyId)&&r.confidence==='confirmed'){
    $('listen-actions').innerHTML=`<button class="spotify-button turntable-button" id="listen-album" aria-haspopup="dialog" aria-controls="listen-dialog">${turntableIcon} Put on the turntable</button><a class="spotify-link" href="https://open.spotify.com/album/${r.spotifyId}" target="_blank" rel="noopener noreferrer">Open the verified album ↗</a>${r.spotifyAvailabilityNote?`<p class="spotify-link">${escapeHtml(r.spotifyAvailabilityNote)}</p>`:''}`;
    $('listen-album').onclick=()=>openTurntable(r);
  }else if(r.confidence!=='unknown'){$('listen-actions').innerHTML=`<a class="spotify-button" href="${search}" target="_blank" rel="noopener noreferrer">${spotifyIcon} Find on Spotify ↗</a><p class="spotify-link">Search only · an exact album link hasn’t been verified.</p>`;}
  else{$('listen-actions').innerHTML='<p class="record-evidence">Listening will be available once this record is identified.</p>';}
  for(const [dir,el] of [[-1,$('previous-sleeve')],[1,$('next-sleeve')]]){const neighbor=list[browsing.index+dir];el.hidden=!neighbor;if(neighbor)mountCover(el,neighbor,'front',true);}
  for(const [dir,id,label] of [[-1,'album-prev','Previous'],[1,'album-next','Next']]){
    const button=$(id),neighbor=list[browsing.index+dir],art=button.querySelector('.nav-cover');
    button.disabled=!neighbor;button.setAttribute('aria-label',neighbor?`${label} record: ${neighbor.title} by ${neighbor.artist}`:`${label} record`);
    button.title=neighbor?`${neighbor.artist} — ${neighbor.title}`:'';
    button.querySelector('.nav-title').textContent=neighbor?neighbor.title:dir<0?'Start of box':'End of box';
    if(neighbor)mountCover(art,neighbor,'front',true);else art.replaceChildren();
  }
  $('record-info')?.scrollTo?.(0,0);
  $('view-note').textContent=artworkNote(r);
  $('announcement').textContent=`${browsing.index+1} of ${list.length}. ${r.title} by ${r.artist}`;
  document.querySelector('.identification').open=false;
}
function sourceName(url,i){try{const host=new URL(url).hostname;return host.includes('musicbrainz')?'Album details':host.includes('coverartarchive')?'Cover archive':host.includes('spotify')?'Spotify album':host.includes('discogs')?'Release details':`Source ${i+1}`;}catch{return 'Source';}}
function changeView(view){
  const r=boxRecords()[browsing.index];currentView=view;document.querySelector('.sleeve-stage').dataset.view=view;$('jacket-front').setAttribute('aria-hidden',String(view==='back'));$('jacket-back').setAttribute('aria-hidden',String(view!=='back'));$('jacket').classList.toggle('is-back',view==='back');$('record-view').classList.toggle('show-vinyl',view==='vinyl');
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view));});
  $('view-note').textContent=view==='vinyl'?(r.label?'Illustrated vinyl · sourced LP label, exact pressing may differ':'Illustrated vinyl · original disc label hasn’t been photographed'):artworkNote(r,view==='back'?'back':'front');
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>changeView(b.dataset.view));
$('jacket').onclick=()=>{if(ignoreJacketClick)return;changeView(currentView==='back'?'front':'back');};
for(const hotspot of document.querySelectorAll('.box-hotspot')){
  hotspot.addEventListener('click',()=>openBox(hotspot.dataset.box));
  hotspot.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openBox(hotspot.dataset.box);}});
  const tooltip=()=>{const b=boxes[hotspot.dataset.box],count=records.filter(r=>r.box===hotspot.dataset.box).length;$('box-tooltip').innerHTML=`<strong>${escapeHtml(b.name)}</strong><span>${count?`${count} catalogued items · `:''}Click to browse</span>`;$('box-tooltip').classList.add('visible');};
  hotspot.addEventListener('mouseenter',tooltip);hotspot.addEventListener('focus',()=>{tooltip();const rect=hotspot.getBoundingClientRect();$('box-tooltip').style.left=`${Math.min(rect.right,innerWidth-220)}px`;$('box-tooltip').style.top=`${Math.max(100,rect.top)}px`;});
  hotspot.addEventListener('mousemove',e=>{$('box-tooltip').style.left=`${Math.min(e.clientX+20,innerWidth-220)}px`;$('box-tooltip').style.top=`${Math.max(90,Math.min(e.clientY-70,innerHeight-100))}px`;});
  hotspot.addEventListener('mouseleave',()=> $('box-tooltip').classList.remove('visible'));hotspot.addEventListener('blur',()=> $('box-tooltip').classList.remove('visible'));
}
async function openLibrary(focusSearch=false){await catalogReady;if(!$('library-dialog').open)$('library-dialog').showModal();renderLibrary();if(focusSearch)$('search-input').focus();}
$('find-button').onclick=()=>openLibrary(true);$('all-button').onclick=()=>openLibrary();$('box-search').onclick=()=>openLibrary(true);$('close-library').onclick=()=> $('library-dialog').close();
function renderLibrary(){
  const q=$('search-input').value.trim().toLocaleLowerCase(),filter=$('box-filter').value;
  const results=records.filter(r=>(filter==='all'||r.box===filter)&&`${r.title} ${r.artist} ${r.spineText}`.toLocaleLowerCase().includes(q));
  $('search-results').textContent=`${results.length} ${results.length===1?'item':'items'}${q?' found':''} · kept in the order of the boxes`;
  const grid=$('library-grid');grid.replaceChildren();
  if(!results.length){grid.innerHTML='<p class="empty-results">No records found.<br>Try a different title, artist, or box.</p>';return;}
  results.forEach(r=>{const b=document.createElement('button');b.className='library-record';const cover=document.createElement('div');mountCover(cover,r,'front',true,true);b.append(cover);b.insertAdjacentHTML('beforeend',`<strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(r.artist)}</small><span class="small-label">Box ${boxes[r.box].number} · ${r.kind==='book'?'Art book':r.confidence==='unknown'?'Unidentified sleeve':r.confidence==='probable'?'Likely match':`Sleeve ${sleeveNumber(r)}`}</span>`);b.onclick=()=>{$('library-dialog').close();openBox(r.box,r.id);};grid.append(b);});
}
$('search-input').addEventListener('input',renderLibrary);$('box-filter').onchange=renderLibrary;
$('about-button').onclick=()=> $('about-dialog').showModal();$('close-about').onclick=()=> $('about-dialog').close();
function showOriginalPhoto(){
  const meta=boxes[browsing.box];const d=document.createElement('dialog');d.className='photo-dialog';d.setAttribute('aria-label','Original photograph of the selected box');d.innerHTML=`<button class="icon-button" aria-label="Close photograph">✕</button><img src="assets/boxes/${browsing.box}.jpg" alt="Original photograph of ${escapeHtml(meta.name.toLowerCase())}"><p>${escapeHtml(meta.name)} · original family photograph. Positions reconstructed from the visible spines.</p>`;
  document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());d.showModal();
}
$('source-photo-button').onclick=showOriginalPhoto;$('record-photo').onclick=showOriginalPhoto;
for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
// Swipe the large sleeve; native touch scrolling remains available on the strip.
let swipeStart=null;
$('record-view').addEventListener('pointerdown',e=>{if(e.pointerType==='touch')swipeStart={x:e.clientX,y:e.clientY};});
$('record-view').addEventListener('pointerup',e=>{if(!swipeStart)return;const dx=e.clientX-swipeStart.x,dy=e.clientY-swipeStart.y;swipeStart=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4){ignoreJacketClick=true;browsing.move(dx<0?1:-1);setTimeout(()=>ignoreJacketClick=false,350);}});
$('record-view').addEventListener('pointercancel',()=>swipeStart=null);
let drag=null;
const strip=$('record-strip');
strip.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')return;drag={x:e.clientX,scroll:strip.scrollLeft};strip.dataset.dragged='false';});
window.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>7){strip.dataset.dragged='true';strip.scrollLeft=drag.scroll-dx;}});
window.addEventListener('pointerup',()=>{if(drag){drag=null;setTimeout(()=>strip.dataset.dragged='false',0);}});

function getCameraBase(){
  const scene=$('scene').getBoundingClientRect(),p=$('scene-plane'),width=p.offsetWidth,height=p.offsetHeight;
  return {width,height,left:scene.left+(scene.width-width)/2,top:scene.top+(scene.height-height)/2,sceneLeft:scene.left,sceneTop:scene.top};
}
function returnCameraToRoom(instant=false){
  const base=getCameraBase(),p=$('scene-plane');
  if(instant)p.style.transition='none';
  p.style.transform=`translate(${base.left-base.sceneLeft}px,${base.top-base.sceneTop}px) scale(1)`;
  if(instant){p.offsetWidth;p.style.transition='';}
}
function focusCamera(box,list,instant=false){
  const g=roomGeometry[box],rect=getCameraBase(),mobile=innerWidth<=650;
  cameraBase=rect;
  const targetHeight=mobile?Math.min(innerWidth*.97,innerHeight*.48):Math.min(innerHeight*.64,570);
  const heightScale=targetHeight/(g.height/948*rect.height);
  const xs=g.polygon.split(' ').map(point=>Number(point.split(',')[0]));
  const widthScale=(innerWidth-44)/((Math.max(...xs)-Math.min(...xs))/1659*rect.width);
  const scale=mobile?Math.min(heightScale,widthScale):heightScale;
  const tx=innerWidth*(mobile?.5:.44)-g.center[0]/1659*rect.width*scale;
  const ty=innerHeight*(mobile?.38:.45)-g.center[1]/948*rect.height*scale;
  const fp=$('focus-plane'),sp=$('spine-layer'),p=$('scene-plane');
  const current=new DOMMatrixReadOnly(getComputedStyle(p).transform);
  for(const el of [fp,sp]){
    el.style.transition='none';el.style.width=`${rect.width}px`;el.style.height=`${rect.height}px`;el.style.left='0';el.style.top='0';el.style.transformOrigin='0 0';
    el.style.transform=`translate(${current.e+rect.sceneLeft}px,${current.f+rect.sceneTop}px) scale(${current.a})`;
  }
  $('focus-image').style.clipPath=`polygon(${g.polygon.split(' ').map(point=>{const [x,y]=point.split(',');return `${x/1659*100}% ${y/948*100}%`;}).join(',')})`;
  buildSpines(list,g.face);applyBoxPhoto(box,rect,list,instant);fp.offsetWidth;
  const move=()=>{
    for(const el of [fp,sp]){el.style.transition=instant?'none':'';el.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;}
    if(instant)p.style.transition='none';
    p.style.transform=`translate(${tx-rect.sceneLeft}px,${ty-rect.sceneTop}px) scale(${scale})`;
    p.classList.add('camera-zoomed');$('scene').classList.add('camera-active');$('room').classList.add('at-box');
    if(instant){p.offsetWidth;for(const el of [p,fp,sp])el.style.transition='';}
  };
  if(instant)move();else requestAnimationFrame(move);
}
returnCameraToRoom(true);
function buildSpines(list,face,traced=new Map()){
  const svg=$('spine-layer');svg.replaceChildren();const [tl,tr,br,bl]=face;
  const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const compartmentCount=list[0]?.compartmentCount||3;
  const compartmentOf=r=>(r.compartment||Math.min(compartmentCount,Math.floor((r.position-1)/(list.length/compartmentCount))+1))-1;
  const weightOf=r=>r.spineWidth||(r.kind==='book'?4:1);
  const weights=Array.from({length:compartmentCount},(_,c)=>list.filter(r=>compartmentOf(r)===c).reduce((s,r)=>s+weightOf(r),0));
  const positions=Array(compartmentCount).fill(0);
  list.forEach((r,i)=>{const c=compartmentOf(r),local=positions[c],weight=weightOf(r),count=weights[c]||1;positions[c]+=weight;
    const a=c/compartmentCount+.009+(local/count)*(1/compartmentCount-.018),b=c/compartmentCount+.009+((local+weight)/count)*(1/compartmentCount-.018);
    const outline=traced.get(r.id),points=outline?.polygon??[lerp(tl,tr,a),lerp(tl,tr,b),lerp(bl,br,b),lerp(bl,br,a)];
    const anchor=outline?.anchor??[(points[2][0]+points[3][0])/2,(points[2][1]+points[3][1])/2];
    const extraOutlines=sourceRecords.filter(source=>source.mergedInto&&resolveRecordId(source.id)===r.id).map(source=>traced.get(source.id)?.polygon).filter(Boolean);
    const poly=document.createElementNS('http://www.w3.org/2000/svg','path');poly.setAttribute('d',[points,...extraOutlines].map(outline=>`M${outline.map(p=>p.join(',')).join(' L')} Z`).join(' '));poly.setAttribute('class','spine-hit');poly.dataset.index=i;poly.dataset.recordId=r.id;poly.dataset.maskSource=outline?'photo':'estimated';poly.dataset.slotAnchor=anchor.join(',');poly.setAttribute('role','button');poly.setAttribute('aria-label',`Pull out ${r.title} by ${r.artist}`);
    poly.addEventListener('mouseenter',e=>previewSpine(r,{event:e}));poly.addEventListener('mouseleave',browsing.hidePreview);
    poly.addEventListener('focus',()=>previewSpine(r));poly.addEventListener('blur',browsing.hidePreview);poly.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();browsing.pull(i);}});poly.addEventListener('click',e=>{e.stopPropagation();browsing.pull(i);});svg.append(poly);
  });
  browsing.refresh();
}
function previewSpine(r,anchor={}){browsing.preview(boxRecords().findIndex(item=>item.id===r.id),anchor);}
function renderPreview(r,anchor){
  const card=$('record-preview');card.innerHTML='<div class="preview-art"></div><div class="preview-caption"></div>';
  mountCover(card.querySelector('.preview-art'),r,'front',true);
  card.querySelector('.preview-caption').innerHTML=`<span class="small-label">Sleeve ${sleeveNumber(r)} · ${r.confidence==='unknown'?'Unidentified':'Pull out to explore'}</span><strong>${escapeHtml(r.title)}</strong><span>${escapeHtml(r.artist)}</span>`;
  previewAnchor=anchor;positionPreview();
}
function positionPreview(){
  const card=$('record-preview'),anchor=previewAnchor;
  const mobile=innerWidth<=650;
  if(mobile){card.style.left='50%';card.style.top='auto';card.style.bottom='132px';card.style.transform='translateX(-50%)';}
  else{
    const width=card.offsetWidth||220,height=card.offsetHeight||295;let x=innerWidth*.57,y=innerHeight*.32;
    if(anchor.event){x=anchor.event.clientX+26;y=anchor.event.clientY-100;}
    if(anchor.element){const rect=anchor.element.getBoundingClientRect();x=rect.left+rect.width/2-width/2;y=rect.top-height-16;}
    if(x+width>innerWidth-25)x=(anchor.event?.clientX||innerWidth)-width-28;
    x=Math.max(24,Math.min(innerWidth-width-24,x));y=Math.max(100,Math.min(innerHeight-height-140,y));
    const slot=$('spine-layer').querySelector('.spine-slot-marker')?.getBoundingClientRect();
    if(slot&&x<slot.right+8&&x+width>slot.left-8&&y<slot.bottom+8&&y+height>slot.top-8){
      const left=slot.left-width-14,right=slot.right+14;
      if(left>=24)x=left;else if(right+width<=innerWidth-24)x=right;else y=Math.max(100,slot.top-height-14);
    }
    card.style.left=`${x}px`;card.style.top=`${y}px`;card.style.bottom='auto';card.style.transform='none';
  }
}
let resizeTimer;
window.addEventListener('resize',()=>{
  clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{
    if($('box-dialog').open)focusCamera(browsing.box,boxRecords(),true);else returnCameraToRoom(true);
  },100);
});
$('spine-layer').addEventListener('transitionend',e=>{if(e.propertyName==='transform'&&$('box-dialog').classList.contains('has-preview'))positionPreview();});

async function applyBoxPhoto(box,rect,list,preserve=false){
  const request=++photoProjectionRequest,photo=$('box-detail-image');
  if(!preserve){photo.style.transition='none';photo.classList.remove('source-ready');photo.offsetWidth;photo.style.transition='';}
  const [config,masks]=await Promise.all([photoCalibrationReady,spineMasksReady]);
  if(request!==photoProjectionRequest||browsing.box!==box||!config?.boxes?.[box])return;
  const calibration=config.boxes[box];
  try{
    const h=fitHomography(calibration.sourceQuad,calibration.targetQuad);
    photo.style.width=`${calibration.width}px`;photo.style.height=`${calibration.height}px`;
    photo.style.clipPath=sourceClip(calibration.clipPolygon||calibration.sourceQuad,calibration.width,calibration.height);
    photo.style.transform=cssProjection(h,rect.width/config.roomWidth,rect.height/config.roomHeight);
    photo.onload=()=>{if(request===photoProjectionRequest&&browsing.box===box)photo.classList.add('source-ready');};
    photo.onerror=()=>photo.classList.remove('source-ready');
    if(photo.getAttribute('src')!==calibration.path)photo.src=calibration.path;
    else if(photo.complete&&photo.naturalWidth)photo.classList.add('source-ready');
    if(calibration.openingQuad){const face=calibration.openingQuad.map(p=>projectPoint(h,p));roomGeometry[box].face=face;const traced=projectSpineMasks(h,masks?.boxes?.[box],calibration.width,calibration.height);buildSpines(list,face,traced);}
  }catch(error){console.warn('Box photograph projection could not load',error.message);}
}

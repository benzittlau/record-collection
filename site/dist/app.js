import {fitHomography,cssProjection,sourceClip,projectPoint} from './photo-projection.js';
import {projectSpineMasks} from './spine-masks.js';
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
let cameraBase = null, carouselIndex = 0, manualCarouselScroll = false, scrollSettleTimer;
let records = [], currentBox = null, currentIndex = 0, previewIndex = null, previewAnchor = {}, currentView = 'front', lastRoomFocus = null, ignoreJacketClick = false;
const spotifyIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="currentColor"/><path d="M5 8c5-1.6 10-1.3 14 1M6 12c4-1.2 8-1 12 .8M7 16c3-.7 6-.5 9 .6" fill="none" stroke="#d8e0cb" stroke-width="1.6" stroke-linecap="round"/></svg>';
const photoCalibrationReady=fetch('box-photos.json?v=2',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
const spineMasksReady=fetch('spine-masks.json?v=4',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
let photoProjectionRequest=0;
const catalogReady = fetch('catalog.json?v=spine-traces-318-263-92',{cache:'no-store'}).then(r => {if(!r.ok)throw new Error('catalog');return r.json();}).then(data => {
  records = data.records ?? data;
  records = records.map(r => ({...r,cover:r.cover ?? r.coverPath ?? null,back:r.back ?? r.backPath ?? r.backCover ?? null,kind:r.kind ?? 'record'}));
  const identified = records.filter(r => r.confidence === 'confirmed').length;
  const unknown = records.filter(r => r.confidence === 'unknown').length;
  $('record-total').textContent = `${records.length} catalogued sleeves & books`;
  $('identified-total').textContent = `Five boxes · ${identified} identified`;
  $('about-stats').innerHTML = `<span>${identified} identified</span><span>${unknown} awaiting a closer look</span>`;
  const linked = records.filter(r => r.spotifyId).length;
  $('about-stats').title = `${linked} verified Spotify album links. Positions are reconstructed from visible spines; very thin worn sleeves may need confirmation.`;
  const hash = decodeURIComponent(location.hash.slice(1));
  if(hash.startsWith('record=')){const r = records.find(r => r.id === hash.slice(7));if(r)openBox(r.box,r.id);}else if(hash.startsWith('box=')&&boxes[hash.slice(4)])openBox(hash.slice(4));
  return records;
}).catch(() => {
  const banner = document.createElement('div');banner.className='load-error';banner.innerHTML='The collection could not load. <button>Try again</button>';banner.querySelector('button').onclick=()=>location.reload();$('room').append(banner);
  return [];
});
function boxRecords(){return records.filter(r=>r.box===currentBox).sort((a,b)=>a.position-b.position);}
function artworkPath(r, side='front'){return side==='front' ? r.cover : r.back || (r.backUrl?.startsWith('https:') ? r.backUrl : r.backUrl?.replace('http:','https:'));}
function placeholder(r,small=false){
  if(small)return `<span class="strip-placeholder">${escapeHtml(r.confidence==='unknown'?'Unidentified sleeve':r.title)}</span>`;
  return `<div class="placeholder-cover"><span class="small-label">${r.confidence==='unknown'?'Waiting to be rediscovered':'Artwork still to come'}</span><strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(r.artist)}<br>${r.confidence==='unknown'?'This sleeve keeps its place in the box.':'Album identified from the spine.'}</small></div>`;
}
function mountCover(container,r,side='front',small=false,lazy=false){
  const path = artworkPath(r,side);
  if(!path){container.innerHTML=placeholder(r,small);return;}
  const img=document.createElement('img');img.className='cover-image';img.alt=side==='front'?`${r.artist} — ${r.title}, front cover`:`${r.title}, sourced back cover`;img.loading=lazy?'lazy':'eager';img.decoding='async';img.src=path;
  img.onerror=()=>{container.innerHTML=side==='back'?backPlaceholder():placeholder(r,small);container.classList.add('cover-missing');};
  container.replaceChildren(img);
}
function backPlaceholder(){return '<div class="back-placeholder"><span class="brand-disc" aria-hidden="true"></span><p>A little more<br>to rediscover.</p><small>The back of this sleeve hasn’t been photographed yet. It’ll be here when it is.</small></div>';}
async function openBox(box,id){
  await catalogReady;
  clearTimeout(cameraReturnTimer);
  if(!records.length)return;
  currentBox=box;const list=boxRecords();currentIndex=id?Math.max(0,list.findIndex(r=>r.id===id)):0;
  const meta=boxes[box];$('box-number').textContent=`Box ${meta.number} of 5 · ${list.length} catalogued items`;$('box-name').textContent=meta.name;
  $('box-photo').src=`assets/${meta.photo}`;$('box-photo').alt=`Original photograph of ${meta.name.toLowerCase()}`;$('box-description').textContent=meta.description;
  if(!$('box-dialog').open)lastRoomFocus=document.activeElement;
  $('box-tooltip').classList.remove('visible');
  if(!$('box-dialog').open){ cameraBase=getCameraBase(); $('box-dialog').showModal(); }
  focusCamera(box,list); buildStrip(list);
  if(id){renderRecord();pullRecord();}else{renderRecord();putRecordBack(false);}
}
function buildStrip(list){
  const strip=$('record-strip');strip.replaceChildren();
  list.forEach((r,i)=>{const b=document.createElement('button');b.className='strip-record';b.dataset.index=i;b.title=`${i+1}. ${r.artist} — ${r.title}`;b.setAttribute('aria-label',`${i+1}. ${r.artist}, ${r.title}`);mountCover(b,r,'front',true,true);b.addEventListener('mouseenter',()=>previewSpine(r,{element:b}));b.addEventListener('mouseleave',hidePreview);b.addEventListener('focus',()=>previewSpine(r,{element:b}));b.addEventListener('blur',hidePreview);
    const num=document.createElement('small');num.textContent=i+1;b.append(num);b.onclick=()=>{if(strip.dataset.dragged==='true')return;openRecord(i);};strip.append(b);});requestAnimationFrame(styleCarousel);
}
function renderRecord(){
  const list=boxRecords(),r=list[currentIndex];if(!r)return;
  currentView='front';$('jacket').classList.remove('is-back');$('jacket-front').setAttribute('aria-hidden','false');$('jacket-back').setAttribute('aria-hidden','true');$('record-view').classList.remove('show-vinyl');
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view==='front');b.setAttribute('aria-pressed',String(b.dataset.view==='front'));});
  mountCover($('jacket-front'),r);
  if(artworkPath(r,'back'))mountCover($('jacket-back'),r,'back');else $('jacket-back').innerHTML=backPlaceholder();
  $('vinyl-label-image').src=r.cover||'';$('vinyl-label-image').style.display=r.cover?'block':'none';$('vinyl-label-title').textContent=r.title;
  $('vinyl-button').hidden=r.kind==='book';
  $('jacket').setAttribute('aria-label',`Turn over ${r.title}`);
  $('record-location').textContent=`Box ${boxes[currentBox].number} · ${r.kind==='book'?'Art book':'Sleeve'} ${r.position}${r.compartment?` · Section ${r.compartment}`:''}`;
  $('album-position').textContent=`${currentIndex+1} / ${list.length}`;
  $('album-position').title=`${currentIndex+1} of ${list.length} in this box`;
  document.querySelector('.sleeve-stage').dataset.view='front';
  $('record-title').textContent=r.title;$('record-artist').textContent=r.artist;
  $('record-tags').innerHTML=[r.year,r.kind==='book'?'Art book':'Vinyl',r.confidence==='unknown'?'Unidentified':r.confidence==='probable'?'Likely identification':null].filter(Boolean).map(t=>`<span>${escapeHtml(t)}</span>`).join('');
  $('record-evidence').textContent=r.confidence==='confirmed'?'Identified from the photographed spine.':r.confidence==='probable'?'A likely match from the visible spine. A closer photograph will help confirm it.':'The spine is too worn to identify yet. Its place in the collection is preserved.';
  $('record-notes').textContent=[r.spineText?`Spine: “${r.spineText}”.`:null,r.notes,r.cover?'Cover art represents the album; the exact pressing is unverified.':null,r.back?'The sourced back cover may be from a different pressing.':null].filter(Boolean).join(' ');
  const sourceLinks=(r.sources??[]).map(s=>typeof s==='string'?s:s.url).filter(s=>/^https?:\/\//.test(s??''));
  $('record-sources').innerHTML=sourceLinks.slice(0,6).map((url,i)=>`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceName(url,i))} ↗</a>`).join('');
  const search=`https://open.spotify.com/search/${encodeURIComponent(`${r.artist} ${r.title}`)}`;
  if(r.kind==='book'){$('listen-actions').innerHTML='<p class="record-evidence">An art book, tucked in with the records.</p>';}
  else if(r.spotifyId&&/^[A-Za-z0-9]{22}$/.test(r.spotifyId)&&r.confidence==='confirmed'){
    $('listen-actions').innerHTML=`<button class="spotify-button" id="listen-album">${spotifyIcon} Listen on Spotify</button><a class="spotify-link" href="https://open.spotify.com/album/${r.spotifyId}" target="_blank" rel="noopener noreferrer">Open the verified album ↗</a>`;
    $('listen-album').onclick=()=>openListen(r);
  }else if(r.confidence!=='unknown'){$('listen-actions').innerHTML=`<a class="spotify-button" href="${search}" target="_blank" rel="noopener noreferrer">${spotifyIcon} Find on Spotify ↗</a><p class="spotify-link">Search only · an exact album link hasn’t been verified.</p>`;}
  else{$('listen-actions').innerHTML='<p class="record-evidence">Listening will be available once this record is identified.</p>';}
  for(const [dir,el] of [[-1,$('previous-sleeve')],[1,$('next-sleeve')]]){const neighbor=list[currentIndex+dir];el.hidden=!neighbor;if(neighbor)mountCover(el,neighbor,'front',true);}
  for(const [dir,id,label] of [[-1,'album-prev','Previous'],[1,'album-next','Next']]){
    const button=$(id),neighbor=list[currentIndex+dir],art=button.querySelector('.nav-cover');
    button.disabled=!neighbor;button.setAttribute('aria-label',neighbor?`${label} record: ${neighbor.title} by ${neighbor.artist}`:`${label} record`);
    button.title=neighbor?`${neighbor.artist} — ${neighbor.title}`:'';
    button.querySelector('.nav-title').textContent=neighbor?neighbor.title:dir<0?'Start of box':'End of box';
    if(neighbor)mountCover(art,neighbor,'front',true);else art.replaceChildren();
  }
  $('prev-record').disabled=currentIndex===0;$('next-record').disabled=currentIndex===list.length-1;$('album-prev').disabled=currentIndex===0;$('album-next').disabled=currentIndex===list.length-1;
  carouselIndex=currentIndex;updateCarouselCaption(r);
  $('position-label').textContent=`${currentIndex+1} / ${list.length} · left to right`;
  document.querySelectorAll('.spine-hit').forEach((p,i)=>{p.setAttribute('tabindex',i===currentIndex&&!$('box-dialog').classList.contains('album-open')?'0':'-1');p.classList.toggle('selected-spine',i===currentIndex);});updateSlotMarker();
  document.querySelectorAll('.strip-record').forEach((b,i)=>{b.classList.toggle('selected',i===currentIndex);b.setAttribute('aria-pressed',String(i===currentIndex));b.tabIndex=i===currentIndex?0:-1;});
  const strip=$('record-strip');const selected=strip.children[currentIndex];if(selected){manualCarouselScroll=false;const target=selected.getBoundingClientRect().left-strip.getBoundingClientRect().left+strip.scrollLeft-(strip.clientWidth-selected.clientWidth)/2;strip.scrollTo({left:Math.max(0,target),behavior:reducedMotion?'instant':'smooth'});}
  $('record-info')?.scrollTo?.(0,0);
  $('view-note').textContent=r.cover?'Album artwork · original sleeve edition may differ':'A placeholder until the cover is found';
  $('announcement').textContent=`${currentIndex+1} of ${list.length}. ${r.title} by ${r.artist}`;
  if($('box-dialog').classList.contains('album-open'))history.replaceState(null,'',`${location.pathname}${location.search}#record=${encodeURIComponent(r.id)}`);
  document.querySelector('.identification').open=false;
}
function sourceName(url,i){try{const host=new URL(url).hostname;return host.includes('musicbrainz')?'Album details':host.includes('coverartarchive')?'Cover archive':host.includes('spotify')?'Spotify album':host.includes('discogs')?'Release details':`Source ${i+1}`;}catch{return 'Source';}}
function openRecord(index){
  clearTimeout(scrollSettleTimer);manualCarouselScroll=false;currentIndex=index;previewIndex=null;
  renderRecord();pullRecord();
}
function changeRecord(step){const focusWasSpine=document.activeElement?.classList.contains('spine-hit'),focusWasStrip=document.activeElement?.classList.contains('strip-record');const list=boxRecords();const next=Math.min(list.length-1,Math.max(0,currentIndex+step));if(next!==currentIndex){currentIndex=next;renderRecord();if($('box-dialog').classList.contains('album-open'))pullRecord(false);else previewSpine(list[next]);if(focusWasStrip)$('record-strip').children[currentIndex]?.focus({preventScroll:true});if(focusWasSpine)$('spine-layer').children[currentIndex]?.focus({preventScroll:true});}}
function changeView(view){
  const r=boxRecords()[currentIndex];currentView=view;document.querySelector('.sleeve-stage').dataset.view=view;$('jacket-front').setAttribute('aria-hidden',String(view==='back'));$('jacket-back').setAttribute('aria-hidden',String(view!=='back'));$('jacket').classList.toggle('is-back',view==='back');$('record-view').classList.toggle('show-vinyl',view==='vinyl');
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view));});
  $('view-note').textContent=view==='vinyl'?'Illustrated vinyl · original disc label hasn’t been photographed':view==='back'?(artworkPath(r,'back')?'Sourced back artwork · exact pressing may differ':'The original back cover is still to come'):(r.cover?'Album artwork · original sleeve edition may differ':'A placeholder until the cover is found');
}
function closeBox(){if($('box-dialog').open)$('box-dialog').close();}
$('box-dialog').addEventListener('close',()=>{returnCameraToRoom();$('scene-plane').classList.remove('camera-zoomed');cameraReturnTimer=setTimeout(()=>{if(!$('box-dialog').open)$('scene').classList.remove('camera-active');},reducedMotion?0:900);$('room').classList.remove('at-box');$('box-dialog').classList.remove('album-open');hidePreview();cameraBase=null;history.replaceState(null,'',location.pathname+location.search);lastRoomFocus?.focus();});
$('album-prev').onclick=()=>changeRecord(-1);$('album-next').onclick=()=>changeRecord(1);
$('close-box').onclick=closeBox;$('prev-record').onclick=()=>navigateCarousel(-1);$('next-record').onclick=()=>navigateCarousel(1);$('previous-sleeve').onclick=()=>changeRecord(-1);$('next-sleeve').onclick=()=>changeRecord(1);
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>changeView(b.dataset.view));
$('put-back').onclick=()=>putRecordBack();
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
  results.forEach(r=>{const b=document.createElement('button');b.className='library-record';const cover=document.createElement('div');mountCover(cover,r,'front',true,true);b.append(cover);b.insertAdjacentHTML('beforeend',`<strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(r.artist)}</small><span class="small-label">Box ${boxes[r.box].number} · ${r.kind==='book'?'Art book':r.confidence==='unknown'?'Unidentified sleeve':r.confidence==='probable'?'Likely match':`Sleeve ${r.position}`}</span>`);b.onclick=()=>{$('library-dialog').close();openBox(r.box,r.id);};grid.append(b);});
}
$('search-input').addEventListener('input',renderLibrary);$('box-filter').onchange=renderLibrary;
function openListen(r){
  $('playing-title').textContent=r.title;$('playing-artist').textContent=r.artist;$('playing-cover').src=r.cover||'';$('playing-cover').hidden=!r.cover;
  $('spotify-open').href=`https://open.spotify.com/album/${r.spotifyId}`;
  const iframe=document.createElement('iframe');iframe.src=`https://open.spotify.com/embed/album/${r.spotifyId}?utm_source=generator&theme=0`;iframe.title=`Spotify player for ${r.title} by ${r.artist}`;iframe.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';iframe.loading='lazy';
  $('spotify-player').replaceChildren(iframe);$('listen-dialog').showModal();
}
$('close-listen').onclick=()=> $('listen-dialog').close();$('listen-dialog').addEventListener('close',()=> $('spotify-player').replaceChildren());
$('about-button').onclick=()=> $('about-dialog').showModal();$('close-about').onclick=()=> $('about-dialog').close();
function showOriginalPhoto(){
  const meta=boxes[currentBox];const d=document.createElement('dialog');d.className='photo-dialog';d.setAttribute('aria-label','Original photograph of the selected box');d.innerHTML=`<button class="icon-button" aria-label="Close photograph">✕</button><img src="assets/boxes/${currentBox}.jpg" alt="Original photograph of ${escapeHtml(meta.name.toLowerCase())}"><p>${escapeHtml(meta.name)} · original family photograph. Positions reconstructed from the visible spines.</p>`;
  document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());d.showModal();
}
$('source-photo-button').onclick=showOriginalPhoto;$('record-photo').onclick=showOriginalPhoto;
// Native dialogs trap focus and provide Escape on both desktop and mobile keyboards.
document.addEventListener('keydown',e=>{
  const dialogs=[...document.querySelectorAll('dialog[open]')];const top=dialogs.at(-1);
  if(top!==$('box-dialog')||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  if(e.key==='ArrowLeft'){e.preventDefault();changeRecord(-1);}if(e.key==='ArrowRight'){e.preventDefault();changeRecord(1);}
});
for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
// Swipe the large sleeve; native touch scrolling remains available on the strip.
let swipeStart=null;
$('record-view').addEventListener('pointerdown',e=>{if(e.pointerType==='touch')swipeStart={x:e.clientX,y:e.clientY};});
$('record-view').addEventListener('pointerup',e=>{if(!swipeStart)return;const dx=e.clientX-swipeStart.x,dy=e.clientY-swipeStart.y;swipeStart=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4){ignoreJacketClick=true;changeRecord(dx<0?1:-1);setTimeout(()=>ignoreJacketClick=false,350);}});
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
    const poly=document.createElementNS('http://www.w3.org/2000/svg','polygon');poly.setAttribute('points',points.map(p=>p.join(',')).join(' '));poly.setAttribute('class',`spine-hit${i===currentIndex?' selected-spine':''}`);poly.dataset.index=i;poly.dataset.recordId=r.id;poly.dataset.maskSource=outline?'photo':'estimated';poly.dataset.slotAnchor=anchor.join(',');poly.setAttribute('role','button');poly.setAttribute('aria-label',`Pull out ${r.title} by ${r.artist}`);poly.setAttribute('tabindex',i===currentIndex&&!$('box-dialog').classList.contains('album-open')?'0':'-1');
    poly.addEventListener('mouseenter',e=>previewSpine(r,{event:e}));poly.addEventListener('mouseleave',hidePreview);
    poly.addEventListener('focus',()=>previewSpine(r));poly.addEventListener('blur',hidePreview);poly.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openRecord(i);}});poly.addEventListener('click',e=>{e.stopPropagation();openRecord(i);});svg.append(poly);
  });
}
function previewSpine(r,anchor={}){
  if($('box-dialog').classList.contains('album-open'))return;
  previewIndex=boxRecords().findIndex(item=>item.id===r.id);updateSlotMarker();
  const card=$('record-preview');card.innerHTML='<div class="preview-art"></div><div class="preview-caption"></div>';
  mountCover(card.querySelector('.preview-art'),r,'front',true);
  card.querySelector('.preview-caption').innerHTML=`<span class="small-label">Sleeve ${r.position} · ${r.confidence==='unknown'?'Unidentified':'Pull out to explore'}</span><strong>${escapeHtml(r.title)}</strong><span>${escapeHtml(r.artist)}</span>`;
  previewAnchor=anchor;positionPreview();
  card.classList.add('visible');$('box-dialog').classList.add('has-preview');
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
function hidePreview(){ previewIndex=null;$('record-preview').classList.remove('visible');$('box-dialog').classList.remove('has-preview');updateSlotMarker(); }

function pullRecord(focus=true){
  hidePreview();$('box-dialog').classList.add('album-open');$('box-invitation').setAttribute('aria-hidden','true');$('spine-layer').setAttribute('aria-hidden','true');$('spine-layer').querySelectorAll('.spine-hit').forEach(p=>p.setAttribute('tabindex','-1'));
  if(focus)$('jacket').focus({preventScroll:true});
  updateSlotMarker();
  const r=boxRecords()[currentIndex];history.replaceState(null,'',`${location.pathname}${location.search}#record=${encodeURIComponent(r.id)}`);
}
function putRecordBack(focus=true){
  $('box-dialog').classList.remove('album-open');hidePreview();$('box-invitation').removeAttribute('aria-hidden');$('spine-layer').removeAttribute('aria-hidden');$('spine-layer').querySelectorAll('.spine-hit').forEach((p,i)=>p.setAttribute('tabindex',i===currentIndex?'0':'-1'));
  history.replaceState(null,'',`${location.pathname}${location.search}#box=${currentBox}`);
  requestAnimationFrame(()=>{const strip=$('record-strip'),selected=strip.children[currentIndex];if(selected){const target=selected.getBoundingClientRect().left-strip.getBoundingClientRect().left+strip.scrollLeft-(strip.clientWidth-selected.clientWidth)/2;strip.scrollTo({left:Math.max(0,target),behavior:'instant'});styleCarousel();if(focus)selected.focus({preventScroll:true});}});
}

let resizeTimer;
window.addEventListener('resize',()=>{
  clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{
    if($('box-dialog').open)focusCamera(currentBox,boxRecords(),true);else returnCameraToRoom(true);
  },100);
});
function nearestCarouselRecord(){
  const bounds=strip.getBoundingClientRect(),center=bounds.left+bounds.width/2;
  return [...strip.children].reduce((best,b)=>{const r=b.getBoundingClientRect(),distance=Math.abs(r.left+r.width/2-center);return !best||distance<best.distance?{b,distance}:best;},null)?.b;
}
function navigateCarousel(step){currentIndex=carouselIndex;changeRecord(step);}
function updateCarouselCaption(r){
  $('prev-record').disabled=r.position===1;$('next-record').disabled=r.position===boxRecords().length;
  $('carousel-title').textContent=r.title;$('carousel-artist').textContent=r.artist;
  $('position-label').textContent=`${r.position} / ${boxRecords().length} · ${$('box-dialog').classList.contains('album-open')?'Browse this box':'Pull out a sleeve'}`;
}
function styleCarousel(){
  const bounds=strip.getBoundingClientRect(),center=bounds.left+bounds.width/2;
  for(const b of strip.children){const r=b.getBoundingClientRect(),distance=(r.left+r.width/2-center)/90,amount=Math.min(Math.abs(distance),3);b.style.opacity=String(1-amount*.17);b.style.transform=`perspective(600px) rotateY(${Math.sign(distance)*Math.min(amount*18,38)}deg) scale(${1.08-amount*.11})`;}
}
$('carousel-selected').onclick=()=>openRecord(carouselIndex);
strip.addEventListener('wheel',e=>{manualCarouselScroll=true;if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();strip.scrollLeft+=e.deltaY;}},{passive:false});
strip.addEventListener('pointerdown',()=>manualCarouselScroll=true);
strip.addEventListener('scroll',()=>{
  styleCarousel();
  if(!manualCarouselScroll||!$('box-dialog').open)return;
  const nearest=nearestCarouselRecord();if(!nearest)return;
  carouselIndex=Number(nearest.dataset.index);const r=boxRecords()[carouselIndex];updateCarouselCaption(r);
  if(!$('box-dialog').classList.contains('album-open'))previewSpine(r);
  clearTimeout(scrollSettleTimer);scrollSettleTimer=setTimeout(()=>{
    if(!manualCarouselScroll)return;
    if(currentIndex!==carouselIndex){const open=$('box-dialog').classList.contains('album-open');currentIndex=carouselIndex;renderRecord();if(open)pullRecord(false);else previewSpine(boxRecords()[currentIndex]);}
  },180);
});
$('box-dialog').addEventListener('click',e=>{
  if(!$('box-dialog').classList.contains('album-open'))return;
  if(e.target.closest('.sleeve-object,.view-controls,.album-navigation,.album-nav,.record-info,.crate-browser,.box-header,.put-back'))return;
  putRecordBack();
});
$('box-dialog').addEventListener('cancel',e=>{if($('box-dialog').classList.contains('album-open')){e.preventDefault();putRecordBack();}});

function updateSlotMarker(){
  const svg=$('spine-layer'),index=$('box-dialog').classList.contains('album-open')?currentIndex:previewIndex;
  const poly=index===null?null:svg.querySelector(`.spine-hit[data-index="${index}"]`);
  svg.classList.toggle('has-highlight',!!poly);
  svg.querySelectorAll('.spine-hit').forEach(p=>p.classList.toggle('is-highlighted',p===poly));
  if(!poly)return;
  let marker=svg.querySelector('.spine-slot-marker');
  if(!marker){marker=document.createElementNS('http://www.w3.org/2000/svg','g');marker.setAttribute('class','spine-slot-marker');marker.setAttribute('aria-hidden','true');marker.innerHTML='<path d="M-3 0 L0 -5 L3 0"/><rect x="-10" y="1" width="20" height="13" rx="2"/><text x="0" y="10"></text>';svg.append(marker);}
  const [x,y]=poly.dataset.slotAnchor.split(',').map(Number);
  marker.setAttribute('transform',`translate(${x} ${y+5})`);marker.querySelector('text').textContent=boxRecords()[index].position;
  if(previewIndex!==null&&$('record-preview').classList.contains('visible'))positionPreview();
}
$('spine-layer').addEventListener('transitionend',e=>{if(e.propertyName==='transform'&&$('box-dialog').classList.contains('has-preview'))positionPreview();});

async function applyBoxPhoto(box,rect,list,preserve=false){
  const request=++photoProjectionRequest,photo=$('box-detail-image');
  if(!preserve){photo.style.transition='none';photo.classList.remove('source-ready');photo.offsetWidth;photo.style.transition='';}
  const [config,masks]=await Promise.all([photoCalibrationReady,spineMasksReady]);
  if(request!==photoProjectionRequest||currentBox!==box||!config?.boxes?.[box])return;
  const calibration=config.boxes[box];
  try{
    const h=fitHomography(calibration.sourceQuad,calibration.targetQuad);
    photo.style.width=`${calibration.width}px`;photo.style.height=`${calibration.height}px`;
    photo.style.clipPath=sourceClip(calibration.clipPolygon||calibration.sourceQuad,calibration.width,calibration.height);
    photo.style.transform=cssProjection(h,rect.width/config.roomWidth,rect.height/config.roomHeight);
    photo.onload=()=>{if(request===photoProjectionRequest&&currentBox===box)photo.classList.add('source-ready');};
    photo.onerror=()=>photo.classList.remove('source-ready');
    if(photo.getAttribute('src')!==calibration.path)photo.src=calibration.path;
    else if(photo.complete&&photo.naturalWidth)photo.classList.add('source-ready');
    if(calibration.openingQuad){const face=calibration.openingQuad.map(p=>projectPoint(h,p));roomGeometry[box].face=face;const traced=projectSpineMasks(h,masks?.boxes?.[box],calibration.width,calibration.height);buildSpines(list,face,traced);updateSlotMarker();}
  }catch(error){console.warn('Box photograph projection could not load',error.message);}
}

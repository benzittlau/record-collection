import {clipToPhoto} from './spine-masks.js';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let plan,currentShot=1,wholeBox=false,mapsBuilt=false;
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
function bounds(pairs,box,whole=false,detail=false){
  if(whole)return [0,0,box.width,box.height];
  if(detail){
    const polygon=pairs[0].outlines[0].polygon;
    const centerX=(polygon[2][0]+polygon[5][0])/2,centerY=(polygon[2][1]+polygon[5][1])/2;
    const width=1300,height=1500;
    return [clamp(centerX-width/2,0,box.width-width),clamp(centerY-height/2,0,box.height-height),width,height];
  }
  const points=pairs.flatMap(p=>p.outlines.flatMap(o=>o.polygon));
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const left=clamp(Math.min(...xs)-220,0,box.width),right=clamp(Math.max(...xs)+220,0,box.width);
  const top=clamp(Math.min(...ys)-110,0,box.height),bottom=clamp(Math.max(...ys)+210,0,box.height);
  return [left,top,right-left,bottom-top];
}
function mapSvg(pairs,box,{whole=false,interactive=false,section=false}={}){
  const detail=!whole&&!section;
  const b=section?[0,0,box.width,box.height+300]:bounds(pairs,box,whole,detail);
  const count=pairs.length;
  const labelWidth=section||whole?280:105,labelHeight=section||whole?180:64;
  const shapes=pairs.map((p,i)=>{
    const outline=p.outlines[0];let a=outline.anchor??outline.polygon.at(-2);
    if(a[1]>box.height||a[0]<0||a[0]>box.width){
      const clipped=clipToPhoto(outline.polygon,box.width,box.height);const footY=Math.max(...clipped.map(v=>v[1]));const foot=clipped.filter(v=>Math.abs(v[1]-footY)<1);
      a=[foot.reduce((sum,v)=>sum+v[0],0)/foot.length,footY];
    }
    if(detail){
      const y=b[1]+b[3]-180;const crossings=[];
      outline.polygon.forEach((v,index)=>{const next=outline.polygon[(index+1)%outline.polygon.length];if((v[1]<=y&&next[1]>y)||(next[1]<=y&&v[1]>y))crossings.push(v[0]+(y-v[1])*(next[0]-v[0])/(next[1]-v[1]));});
      a=[crossings.length?(Math.min(...crossings)+Math.max(...crossings))/2:(outline.polygon[2][0]+outline.polygon[5][0])/2,y];
    }
    const x=section?b[0]+(i+.5)*b[2]/count:a[0];
    const y=section?box.height+50:whole?Math.min(box.height-190,a[1]+65):Math.min(box.height-65,a[1]+65);
    return `<g${interactive?` data-pair="${p.pair}" role="button" tabindex="0" aria-label="Sleeve ${p.position}: ${escape(p.title)}, photos ${p.frontShot} and ${p.backShot}"`:''}>${p.outlines.map(o=>`<polygon class="${interactive?'map-spine':'mask'}" points="${clipToPhoto(o.polygon,box.width,box.height).map(v=>v.join(',')).join(' ')}"/>`).join('')}<g class="map-tag"><line x1="${a[0]}" y1="${Math.min(a[1],box.height)}" x2="${x}" y2="${y}"/><rect x="${x-labelWidth/2}" y="${y}" width="${labelWidth}" height="${labelHeight}" rx="6"/><text x="${x}" y="${y+labelHeight*.72}" style="font-size:${section||whole?128:38}px">${p.position}</text></g></g>`;
  }).join('');
  const clip=`crop-${box.id}-${pairs[0].pair}-${whole?'whole':'detail'}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.join(' ')}" aria-label="${escape(box.name)} box, highlighted sleeve positions" role="${interactive?'group':'img'}"><defs><clipPath id="${clip}"><rect x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}"/></clipPath></defs><g clip-path="url(#${clip})"><image href="${escape(box.photo)}" x="0" y="0" width="${box.width}" height="${box.height}"/>${shapes}</g></svg>`;
}
function showShot(number,{focus=false}={}){
  currentShot=clamp(Number(number)||1,1,plan.shotCount);wholeBox=false;
  const shot=plan.shots[currentShot-1];const pair=plan.pairs[shot.pair-1];const box=plan.boxes.find(b=>b.id===pair.box);
  $('intro').classList.add('collapsed');document.querySelector('.guide-nav').classList.add('compact');
  $('step-view').hidden=false;$('map-view').hidden=true;$('complete').hidden=true;
  $('step-tab').setAttribute('aria-pressed','true');$('maps-tab').setAttribute('aria-pressed','false');
  $('shot-number').textContent=String(currentShot).padStart(2,'0');$('shot-heading').textContent=shot.face==='front'?'Front cover':'Back cover';
  $('face-instruction').textContent=shot.face==='front'?(pair.kind==='book'?'Take out the highlighted book and photograph its actual front.':'Pull out the highlighted sleeve and photograph its front.'):(pair.kind==='book'?'Turn the same book over and photograph its outer back.':'Turn the same sleeve over and photograph its back.');
  $('location').textContent=`Box ${box.number} · ${box.name} · Section ${pair.compartment} · ${pair.kind==='book'?'Book':'Sleeve'} ${pair.position}`;
  $('record-title').textContent=pair.confidence==='unknown'?'Unidentified sleeve':pair.title;
  $('record-artist').textContent=pair.confidence==='unknown'?'Your photographs will help identify it.':pair.artist+(pair.confidence==='probable'?' · likely match':'');
  $('spine-text').textContent=pair.spineText?`Visible spine: ${pair.spineText}`:'';
  $('reference-cover').hidden=!pair.cover;$('reference-cover').src=pair.cover??'';
  $('reference-cover').alt=`Reference front artwork for ${pair.title}; the physical edition may differ`;
  $('reference-cover').onerror=()=>{$('reference-cover').hidden=true;};
  $('special-instruction').hidden=!pair.instruction;$('special-instruction').textContent=pair.instruction??'';
  $('skip-fold').hidden=!pair.optional&&!pair.allowDuplicateSkip;$('skip-fold').textContent=pair.optional?'This is part of the neighboring sleeve · skip pair':'Already photographed this jacket · skip pair';
  $('focus-map').innerHTML=mapSvg([pair],box);
  $('whole-box').textContent='Show the whole box';
  $('neighbors').innerHTML=[['Immediately left',pair.previous],['Immediately right',pair.next]].map(([label,r])=>`<div><span class="neighbor-label">${label}</span><span class="neighbor-name">${r?`${r.position} · ${escape(r.title)}${r.confidence!=='unknown'?`<br>${escape(r.artist)}`:''}`:'Edge of the box'}</span></div>`).join('');
  $('reasons').innerHTML=pair.reasons.map(reason=>`<li>${escape(reason)}</li>`).join('');
  $('open-record').href=`./#record=${encodeURIComponent(pair.recordId)}`;
  $('box-jump').value=pair.box;
  $('previous-shot').disabled=currentShot===1;
  $('next-shot').textContent=currentShot===plan.shotCount?'Finish the sequence ✓':shot.face==='front'?'Next: back of this sleeve →':'Put it back · next sleeve →';
  $('progress-label').textContent=`Photo ${currentShot} / ${plan.shotCount}`;
  try{localStorage.setItem(`record-capture-${plan.version}`,String(currentShot));}catch{}
  history.replaceState(null,'',`#shot=${currentShot}`);
  if(focus){$('shot-heading').setAttribute('tabindex','-1');$('shot-heading').focus({preventScroll:true});scrollTo({top:0,behavior:'instant'});}
}
function buildMaps(){
  if(mapsBuilt)return;mapsBuilt=true;
  $('all-maps').innerHTML=plan.boxes.map(box=>{
    const pairs=plan.pairs.filter(p=>p.box===box.id);
    const sections=Array.from(new Set(pairs.map(p=>p.compartment)));
    return `<section class="box-map-group"><h2>Box ${box.number} · ${escape(box.name)}</h2><p>${pairs.length} items${pairs.length?` · Photos ${box.firstShot}–${box.lastShot}`:' · No photos needed in this pass'}</p><div class="section-maps">${sections.flatMap(section=>{
      const subset=pairs.filter(p=>p.compartment===section);
      const chunks=Array.from({length:Math.ceil(subset.length/10)},(_,i)=>subset.slice(i*10,i*10+10));
      return chunks.map(chunk=>`<div class="section-map"><h3>Section ${section} · ${chunk.length===1?`Sleeve ${chunk[0].position}`:`Sleeves ${chunk[0].position}–${chunk.at(-1).position}`}</h3>${mapSvg(chunk,box,{interactive:true,section:true})}<ol>${chunk.map(p=>`<li><button class="pair-link" data-pair="${p.pair}"><span class="sleeve-number">${p.position}${p.optional?'*':''}</span><span><strong>${escape(p.title)}</strong><small>${escape(p.artist)}<br>Photos ${p.frontShot} / ${p.backShot} · front / back${p.optional?'<br>Only if a separate jacket':''}</small></span></button></li>`).join('')}</ol></div>`);
    }).join('')}</div></section>`;
  }).join('');
  $('all-maps').addEventListener('click',event=>{const target=event.target.closest('[data-pair]');if(target)showShot(plan.pairs[Number(target.dataset.pair)-1].frontShot,{focus:true});});
  $('all-maps').addEventListener('keydown',event=>{const target=event.target.closest('g[data-pair]');if(target&&['Enter',' '].includes(event.key)){event.preventDefault();showShot(plan.pairs[Number(target.dataset.pair)-1].frontShot,{focus:true});}});
}
function showMaps(){buildMaps();$('map-view').hidden=false;$('step-view').hidden=true;$('complete').hidden=true;$('step-tab').setAttribute('aria-pressed','false');$('maps-tab').setAttribute('aria-pressed','true');history.replaceState(null,'','#maps');}
async function load(){
  try{
    const response=await fetch('capture-manifest.json?v=7ac3efbb41aa',{cache:'no-store'});if(!response.ok)throw Error('Manifest load failed');plan=await response.json();
    $('plan-summary').textContent=`Up to ${plan.pairCount} items · ${plan.shotCount} planned photos · five boxes. ${plan.optionalPairCount||0} entries may be folded or overlapping edges.`;
    $('manifest-label').textContent=`Saved sequence · ${plan.created}`;
    $('box-jump').innerHTML=plan.boxes.filter(b=>b.pairCount).map(b=>`<option value="${b.id}">${b.number} · ${escape(b.name)}</option>`).join('');
    let resume=1;try{resume=Number(localStorage.getItem(`record-capture-${plan.version}`))||1;}catch{}
    currentShot=clamp(resume,1,plan.shotCount);
    $('start').disabled=false;$('start').textContent=currentShot>1?`Resume at photo ${currentShot} →`:'Start the photo sequence →';
    $('start').onclick=()=>showShot(currentShot,{focus:true});
    $('step-tab').onclick=()=>showShot(currentShot);
    $('maps-tab').onclick=showMaps;
    $('box-jump').onchange=()=>showShot(plan.boxes.find(b=>b.id===$('box-jump').value).firstShot,{focus:true});
    $('previous-shot').onclick=()=>showShot(currentShot-1);
    $('skip-fold').onclick=()=>{const pair=plan.pairs[plan.shots[currentShot-1].pair-1];if(pair.backShot<plan.shotCount)showShot(pair.backShot+1,{focus:true});else{$('step-view').hidden=true;$('complete').hidden=false;$('complete-copy').textContent='The remaining photo pairs are complete. Folded edges do not need separate photos.';history.replaceState(null,'','#complete');}};
    $('next-shot').onclick=()=>{
      if(currentShot<plan.shotCount)showShot(currentShot+1,{focus:plan.shots[currentShot-1].face==='back'});
      else{$('step-view').hidden=true;$('complete').hidden=false;$('complete-copy').textContent=`Up to ${plan.pairCount} items, ${plan.shotCount} planned photos. Skipped folds do not need separate pictures.`;history.replaceState(null,'','#complete');scrollTo(0,0);}
    };
    $('reset-progress').onclick=()=>showShot(1,{focus:true});
    $('review-last').onclick=()=>showShot(plan.shotCount);
    $('whole-box').onclick=()=>{wholeBox=!wholeBox;const p=plan.pairs[plan.shots[currentShot-1].pair-1];$('focus-map').innerHTML=mapSvg([p],plan.boxes.find(b=>b.id===p.box),{whole:wholeBox});$('whole-box').textContent=wholeBox?'Show the sleeve close up':'Show the whole box';};
    if(location.hash==='#maps')showMaps();
    else if(/^#shot=\d+$/.test(location.hash))showShot(Number(location.hash.slice(6)));
  }catch(error){console.error(error);$('error').hidden=false;}
}
load();

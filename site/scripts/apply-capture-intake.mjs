import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';

const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const folder='../research/capture-intake-2026-10-14/';
const [receipt,baseline,artwork,spotify]=await Promise.all([
  'reconciliation.json','baseline-catalog.json','artwork-assets.json','spotify-decisions.json'
].map(name=>read(folder+name)));
const rows=structuredClone(baseline.records);
const byId=new Map(rows.map(record=>[record.id,record]));
const selections=new Map(artwork.records.map(row=>[row.id,row]));
const decisions=new Map(spotify.records.map(row=>[row.id,row]));
const titleKey=value=>String(value??'').normalize('NFKD').replace(/[^a-z0-9]/gi,'').toLowerCase();
const dependent=['cover','coverPath','coverUrl','coverNotes','coverThumbnail','back','backPath','backCover','backUrl','backSourceUrl','backNotes','backArtworkEdition',
  'label','labelPath','labelUrl','labelNotes','labelEdition','frontEdition','backEdition','artworkEdition','artworkProvenance','artworkEditions',
  'spotifyId','spotifyNotes','spotifyEdition','spotifyProvenance','spotifyAvailabilityNote','digitalReleaseDate','digitalCopyright','musicbrainzGroup'];
for(const insertion of receipt.insertions){
  assert(!byId.has(insertion.id));
  const before=byId.get(insertion.afterId),after=byId.get(insertion.beforeId);
  assert(before&&after&&before.box===insertion.box&&after.box===insertion.box);
  assert(before.position<insertion.position&&insertion.position<after.position);
  const record={id:insertion.id,box:insertion.box,position:insertion.position,positionLabel:insertion.positionLabel,
    insertAfter:insertion.afterId,insertBefore:insertion.beforeId,photo:before.photo,compartment:before.compartment??1,
    compartmentPosition:insertion.position,compartmentCount:before.compartmentCount??1,kind:'record',sources:[]};
  rows.push(record);byId.set(record.id,record);
}
const changedIdentities=[];
for(const pair of receipt.pairs){
  const record=byId.get(pair.id);assert(record&&record.box===pair.box,`Invalid capture binding ${pair.id}`);
  const identity=pair.identity;
  const sameTitle=titleKey(record.title)===titleKey(identity.title);
  const sameArtist=titleKey(record.artist)===titleKey(identity.artist);
  // Confirmed anchors retain their existing display wording and listening audit.
  // The exact newly printed wording is retained below as physical evidence.
  const replaceIdentity=!pair.previous||pair.previous.confidence!=='confirmed';
  const identityChanged=replaceIdentity&&(!sameTitle||!sameArtist);
  if(replaceIdentity){
    if(identityChanged){
      if(pair.previous)changedIdentities.push(pair.id);
      for(const key of dependent)delete record[key];
      record.sources=[];record.spineText='';
    }
    record.title=identity.title;record.artist=identity.artist;
    if(identity.year!==null&&identity.year!==undefined)record.year=identity.year;
    else if(identityChanged)record.year=null;
    else record.year??=null;
  }
  record.kind=identity.kind??record.kind??'record';record.confidence='confirmed';
  const catalogues=identity.visibleCatalogues??identity.catalogue??[];
  record.familyCapture={batch:receipt.batch,guideVersion:receipt.guideVersion,printedTitle:identity.title,printedArtist:identity.artist,
    catalogueNumbers:Array.isArray(catalogues)?catalogues:[catalogues],bindingConfidence:pair.bindingConfidence,
    evidence:pair.evidence,faces:pair.faces.map(face=>({face:face.face,filename:face.filename,sha256:face.originalSha256})),
    auditFile:'research/capture-intake-2026-10-14/reconciliation.json'};
  record.notes='The front and back of the family copy confirm this album.';
  if(record.id==='upper-left-56')record.notes+=' The family jacket is the mono London LL3499 edition.';
  if(record.id==='right-04b')record.notes+=' The photographed Brazil Blues jacket is a 1972 reissue of Brazil, Bossa Nova & Blues.';
  if(record.kind==='book'){record.year=null;record.notes='The front and back confirm the historical Dragon’s Dream / Big O paperback design. The exact printing year of the family copy has not been established.';}
  const selection=selections.get(record.id);
  if(selection){
    record.artworkProvenance??={};
    for(const face of ['front','back']){
      const chosen=selection[face];if(!chosen)continue;
      const family=chosen.source==='Family photograph';
      const captureFace=pair.faces.find(source=>source.face===face);
      assert(chosen.path&&(family?chosen.captureFilename===captureFace?.filename:chosen.sourceUrl&&chosen.releaseUrl),`Unattributed ${face} ${record.id}`);
      // A newly selected face supersedes older notes and edition records for
      // that face; keep unrelated label provenance from the same album.
      delete record[face==='front'?'coverNotes':'backNotes'];
      if(face==='front')delete record.coverThumbnail;
      if(Array.isArray(record.artworkEditions))record.artworkEditions=record.artworkEditions.filter(edition=>edition.face!==face);
      const key=face==='front'?'cover':'back';record[key]=chosen.path;record[`${key}Path`]=chosen.path;record[`${key}Url`]=family?null:chosen.sourceUrl;
      if(face==='back'){record.backSourceUrl=family?null:chosen.sourceUrl;delete record.backCover;}
      record.artworkProvenance[face]={source:chosen.source??'Documented physical sleeve scan',sourceUrl:family?null:chosen.sourceUrl,
        releaseUrl:chosen.releaseUrl,releaseId:chosen.releaseId,catalogue:chosen.catalogue,path:chosen.path,localPath:chosen.path,
        dimensions:chosen.dimensions,sha256:chosen.sha256,sourceSha256:chosen.sourceSha256,face:`outer ${record.kind==='book'?'book':'LP'} ${face}`,
        exactFamilyPressingVerified:family,...(family?{imageSourceType:'family-capture',captureFilename:chosen.captureFilename,captureOriginalSha256:captureFace.originalSha256}:{}),
        editionNote:chosen.editionNote,processing:chosen.processing,visualReview:chosen.visualReview,
        auditFile:'research/capture-intake-2026-10-14/artwork-assets.json'};
      const field=face==='front'?'artworkEdition':'backArtworkEdition';record[field]=chosen.editionNote;
      record[face==='front'?'frontEdition':'backEdition']=chosen.editionNote;
      if(chosen.thumbnail&&face==='front')record.coverThumbnail=chosen.thumbnail;
      record.sources??=[];if(chosen.releaseUrl&&!record.sources.includes(chosen.releaseUrl))record.sources.push(chosen.releaseUrl);
    }
  }
  assert(record.cover&&record.back,`The photographed item still needs a usable front/back pair: ${record.id}`);
  const decision=decisions.get(record.id);
  if(decision?.status==='matched'){
    const proof=await read(`../research/spotify-link-verification/${decision.spotifyId}.json`);
    assert(proof.verified&&proof.id===decision.spotifyId&&proof.title===decision.spotifyTitle);
    assert(proof.trackCount===proof.tracks.length&&proof.trackCount===decision.spotifyTrackCount);
    if(pair.previous?.spotifyId&&!identityChanged){assert.equal(decision.spotifyId,pair.previous.spotifyId,`An existing verified link must be reviewed explicitly before replacement: ${record.id}`);}
    else{
      record.spotifyId=proof.id;record.spotifyEdition=decision.editionNote;
      if(decision.availabilityNote)record.spotifyAvailabilityNote=decision.availabilityNote;
      record.spotifyProvenance={url:proof.url,trackArtists:[...new Set(proof.tracks.flatMap(track=>track.artists))],
        auditFile:'research/capture-intake-2026-10-14/spotify-decisions.json',evidenceFile:`research/spotify-link-verification/${proof.id}.json`,
        editionNotes:decision.editionNote,verifiedAgainstFamilyCapture:true};
      record.sources??=[];if(!record.sources.includes(proof.url))record.sources.push(proof.url);
    }
  }
}
for(const merge of receipt.merges){
  const row=byId.get(merge.id),parent=byId.get(merge.mergedInto);
  assert(row&&parent&&row.box===parent.box&&parent.familyCapture);
  for(const key of dependent)delete row[key];
  Object.assign(row,{title:parent.title,artist:parent.artist,year:parent.year,confidence:'confirmed',kind:'sleeve-edge',mergedInto:parent.id,
    cover:parent.cover,back:parent.back,sources:[],notes:merge.reason,familyCapture:{...parent.familyCapture,relationship:'folded edge of the same physical sleeve'}});
}
const order=['upper-left','lower-left','upper-middle','lower-middle','right'];
rows.sort((a,b)=>order.indexOf(a.box)-order.indexOf(b.box)||a.position-b.position);
for(const [shard,boxes] of [['left',['upper-left','lower-left']],['middle',['upper-middle','lower-middle']],['right',['right']]]){
  const targetRows=rows.filter(row=>boxes.includes(row.box));
  const audit=await read(`../research/deep-${shard}-audit.json`);const auditRows=Array.isArray(audit)?audit:audit.records;
  for(const record of targetRows.filter(row=>row.familyCapture)){
    let outcome=auditRows.find(row=>row.id===record.id);
    if(!outcome){outcome={id:record.id};auditRows.push(outcome);}
    if(!outcome.beforeCapture)outcome.beforeCapture={status:outcome.status,title:outcome.title,confidence:outcome.confidence,neededFaces:outcome.neededFaces};
    Object.assign(outcome,{box:record.box,position:record.position,title:record.title,artist:record.artist,confidence:record.confidence,
      status:record.mergedInto?'resolved-fold-from-family-capture':'confirmed-from-family-capture',neededFaces:[],
      reason:record.mergedInto?record.notes:'Family front/back photographs confirm identity; selected clean external artwork is documented separately.',
      captureReceipt:'research/capture-intake-2026-10-14/reconciliation.json'});
  }
  auditRows.sort((a,b)=>order.indexOf(a.box??byId.get(a.id)?.box)-order.indexOf(b.box??byId.get(b.id)?.box)||a.position-b.position);
  await writeFile(new URL(`../research/${shard}.json`,import.meta.url),JSON.stringify(targetRows,null,2)+'\n');
  await writeFile(new URL(`../research/deep-${shard}-audit.json`,import.meta.url),JSON.stringify(audit,null,2)+'\n');
}
receipt.status='integrated';receipt.changedIdentities=changedIdentities;
const physical=rows.filter(row=>!row.mergedInto);
receipt.result={sourcePositions:rows.length,physicalItems:physical.length,confirmed:physical.filter(row=>row.confidence==='confirmed').length,
  probable:physical.filter(row=>row.confidence==='probable').length,unknown:physical.filter(row=>row.confidence==='unknown').length,
  spotify:physical.filter(row=>row.spotifyId).length,photographedPhysicalItems:receipt.pairs.length};
await writeFile(new URL(folder+'reconciliation.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
console.log(receipt.result);

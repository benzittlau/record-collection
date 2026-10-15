import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const [baseline,summary,catalog,originalCatalog,supplement,receipt]=await Promise.all([
  '../research/spotify-link-baseline.json','../research/spotify-link-audit-summary.json','../dist/catalog.json',
  '../research/capture-intake-2026-10-14/baseline-catalog.json',
  '../research/capture-intake-2026-10-14/spotify-decisions.json',
  '../research/capture-intake-2026-10-14/reconciliation.json',
].map(read));
// Additional captures supplement the sealed audit; they do not rewrite it.
const sealed={
  'spotify-link-baseline.json':'11fe157821732ccf44262f1cc1782b52ca03a7fad0c204f2aa813a1eb1548177',
  'spotify-link-audit-summary.json':'e0a86b82e91bc56a6eb52a4b20a3e50ce29367ada940852532133fa42d03f256',
  'spotify-link-audit-left.json':'af220768612e4cc69b91697db639d8ce49206a91635d402224397259d4ce41cf',
  'spotify-link-audit-middle.json':'f66126b274bda775ae23638914ff091f8814ce0eb37ecbf0df2893d40525ddae',
  'spotify-link-audit-right.json':'72d3bcfc4ed561f7453aec4cad95fe2eceb333f38c1d00692c1fc659f75de1ca',
};
for(const [name,expected] of Object.entries(sealed)){
  const bytes=await readFile(new URL(`../research/${name}`,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,`Sealed Spotify audit changed: ${name}`);
}
const originalById=new Map(originalCatalog.records.map(row=>[row.id,row]));
const currentById=new Map(catalog.records.map(row=>[row.id,row]));
async function verifyDecision(record,decision,{checkProvenance=true,checkAvailabilityNote=false}={}){
  assert(/^[a-zA-Z0-9]{22}$/.test(decision.spotifyId),`Invalid Spotify ID ${record.id}`);
  const proof=await read(`../research/spotify-link-verification/${decision.spotifyId}.json`);
  assert(proof.verified&&proof.id===decision.spotifyId&&proof.url===`https://open.spotify.com/album/${proof.id}`,`Missing independent Spotify proof ${record.id}`);
  assert.equal(decision.url??decision.spotifyUrl,proof.url,`Spotify URL differs ${record.id}`);
  assert.equal(decision.spotifyTitle,proof.title,`Spotify title differs ${record.id}`);
  assert.equal(decision.spotifyTrackCount,proof.trackCount,`Spotify track count differs ${record.id}`);
  assert(proof.artists.length&&proof.tracks.length&&record.spotifyEdition,`Incomplete edition evidence ${record.id}`);
  assert.equal(proof.tracks.length,proof.trackCount,`Incomplete Spotify programme ${record.id}`);
  const credits=(Array.isArray(decision.spotifyArtists)?decision.spotifyArtists:[decision.spotifyArtists]).filter(Boolean).join(' / ').toLocaleLowerCase();
  for(const artist of proof.artists)assert(credits.includes(artist.toLocaleLowerCase()),`Spotify artist decision disagrees with proof ${record.id}`);
  assert.equal(record.spotifyId,proof.id,`Catalogue Spotify ID differs ${record.id}`);
  if(checkProvenance){
    assert.equal(record.spotifyProvenance?.url,proof.url,`Missing Spotify provenance ${record.id}`);
    assert.deepEqual(record.spotifyProvenance.trackArtists,[...new Set(proof.tracks.flatMap(track=>track.artists))],`Incomplete performer provenance ${record.id}`);
  }
  if(decision.availabilityObservation?.unplayableRows>0||(checkAvailabilityNote&&decision.availabilityNote))assert(record.spotifyAvailabilityNote,`Missing observed Spotify restrictions ${record.id}`);
  return proof;
}
const eligible=new Set(baseline.eligibleUnlinked.map(row=>row.id));
const ids=new Set();
assert.equal(summary.outcomes.length,eligible.size,'Spotify audit must account for every originally unlinked confirmed slot');
for(const outcome of summary.outcomes){
  assert(eligible.has(outcome.id)&&!ids.has(outcome.id),`Unexpected or duplicate Spotify outcome ${outcome.id}`);ids.add(outcome.id);
  const record=originalById.get(outcome.id);
  assert(record&&record.confidence==='confirmed'&&record.kind!=='book');
  assert.equal(record.title,outcome.title);assert.equal(record.artist,outcome.artist);
  if(outcome.status==='unresolved'){
    assert(outcome.reason&&!record.spotifyId,`Unresolved Spotify case incorrectly linked ${outcome.id}`);
    continue;
  }
  assert.equal(outcome.status,'matched');
  assert.equal(record.spotifyId,outcome.spotifyId);
  const audit=await read(`../${record.spotifyProvenance.auditFile}`);
  const decision=(Array.isArray(audit)?audit:audit.records).find(row=>row.id===record.id);
  assert.equal(decision?.spotifyId,outcome.spotifyId);
  assert.equal(decision.spotifyTitle,outcome.spotifyTitle);
  await verifyDecision(record,decision);
}
for(const [id,spotifyId] of Object.entries(baseline.existingLinks))assert.equal(originalById.get(id)?.spotifyId,spotifyId,`Existing Spotify baseline changed ${id}`);
assert.equal(summary.added,summary.outcomes.filter(row=>row.status==='matched').length);
assert.equal(summary.linkedAfter,baseline.linkedBefore+summary.added);
const oldLinks=new Map(originalCatalog.records.filter(row=>row.spotifyId).map(row=>[row.id,row.spotifyId]));
assert.equal(oldLinks.size,summary.linkedAfter,'The capture baseline must retain all sealed Spotify matches');
for(const [id,spotifyId] of oldLinks){
  const current=currentById.get(id),original=originalById.get(id);
  assert.equal(current?.spotifyId,spotifyId,`Previously verified Spotify link changed ${id}`);
  for(const key of ['spotifyProvenance','spotifyEdition','spotifyAvailabilityNote'])
    assert.deepEqual(current[key],original[key],`Previously verified Spotify evidence changed ${id}: ${key}`);
}
const captureIds=new Set(receipt.pairs.map(row=>row.id)),supplementIds=new Set();
assert.equal(supplement.status,'reviewed','Unreviewed supplemental Spotify decisions');
for(const decision of supplement.records){
  assert(captureIds.has(decision.id)&&!supplementIds.has(decision.id),`Unexpected or duplicate capture Spotify decision ${decision.id}`);supplementIds.add(decision.id);
  const record=currentById.get(decision.id);
  assert(record&&record.confidence==='confirmed'&&record.kind!=='book'&&!record.mergedInto,`Nonphysical Spotify match ${decision.id}`);
  if(decision.status==='unresolved'){
    assert(decision.reason&&!decision.spotifyId&&!record.spotifyId,`Unresolved capture case incorrectly linked ${decision.id}`);
  }else if(decision.status==='preserve-existing'){
    assert(decision.reason&&oldLinks.get(record.id)===decision.spotifyId&&record.spotifyId===decision.spotifyId,`Incorrect retained link ${decision.id}`);
  }else{
    assert.equal(decision.status,'matched',`Unfinished capture Spotify decision ${decision.id}`);
    assert(decision.editionNote,`Missing capture edition explanation ${decision.id}`);
    await verifyDecision(record,decision,{checkProvenance:!oldLinks.has(record.id),checkAvailabilityNote:true});
    if(!oldLinks.has(record.id)){
      assert.equal(record.spotifyProvenance.auditFile,'research/capture-intake-2026-10-14/spotify-decisions.json',`Wrong supplemental audit ${record.id}`);
      assert.equal(record.spotifyProvenance.evidenceFile,`research/spotify-link-verification/${record.spotifyId}.json`, `Wrong supplemental proof ${record.id}`);
    }
  }
}
for(const record of catalog.records.filter(row=>row.spotifyId&&!oldLinks.has(row.id))){
  assert(supplement.records.some(row=>row.id===record.id&&row.status==='matched'&&row.spotifyId===record.spotifyId),`Unaudited capture Spotify link ${record.id}`);
}
for(const [status,count] of Object.entries(supplement.counts))assert.equal(count,supplement.records.filter(row=>row.status===status).length,`Supplement count ${status}`);
const added=supplement.records.filter(row=>row.status==='matched'&&!oldLinks.has(row.id)).length;
assert.equal(catalog.meta.spotify,oldLinks.size+added);
console.log(`Validated ${oldLinks.size} unchanged Spotify links and ${added} independently proved capture additions (${supplement.records.filter(row=>row.status==='unresolved').length} supplemental searches retained).`);

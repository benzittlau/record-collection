import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const [baseline,summary,catalog]=await Promise.all([
  '../research/spotify-link-baseline.json','../research/spotify-link-audit-summary.json','../dist/catalog.json',
].map(read));
const eligible=new Set(baseline.eligibleUnlinked.map(row=>row.id));
const ids=new Set();
assert.equal(summary.outcomes.length,eligible.size,'Spotify audit must account for every originally unlinked confirmed slot');
for(const outcome of summary.outcomes){
  assert(eligible.has(outcome.id)&&!ids.has(outcome.id),`Unexpected or duplicate Spotify outcome ${outcome.id}`);ids.add(outcome.id);
  const record=catalog.records.find(row=>row.id===outcome.id);
  assert(record&&record.confidence==='confirmed'&&record.kind!=='book');
  assert.equal(record.title,outcome.title);assert.equal(record.artist,outcome.artist);
  if(outcome.status==='unresolved'){
    assert(outcome.reason&&!record.spotifyId,`Unresolved Spotify case incorrectly linked ${outcome.id}`);
    continue;
  }
  assert.equal(outcome.status,'matched');
  assert.equal(record.spotifyId,outcome.spotifyId);
  assert.equal(record.spotifyProvenance.url,outcome.url);
  const proof=await read(`../research/spotify-link-verification/${outcome.spotifyId}.json`);
  assert(proof.verified&&proof.id===outcome.spotifyId&&proof.url===outcome.url,`Missing independent Spotify proof ${outcome.id}`);
  assert.equal(proof.title,outcome.spotifyTitle);
  assert(proof.artists.length&&proof.tracks.length&&record.spotifyEdition,`Incomplete edition evidence ${outcome.id}`);
  assert.equal(proof.tracks.length,proof.trackCount,`Incomplete Spotify programme ${outcome.id}`);
  const audit=await read(`../${record.spotifyProvenance.auditFile}`);
  const decision=(Array.isArray(audit)?audit:audit.records).find(row=>row.id===record.id);
  assert.equal(decision?.spotifyId,proof.id);
  assert.equal(decision.spotifyTitle,proof.title);
  assert.equal(decision.spotifyTrackCount,proof.trackCount);
  const credits=(Array.isArray(decision.spotifyArtists)?decision.spotifyArtists:[decision.spotifyArtists]).filter(Boolean).join(' / ').toLocaleLowerCase();
  for(const artist of proof.artists)assert(credits.includes(artist.toLocaleLowerCase()),`Spotify artist decision disagrees with proof ${outcome.id}`);
  assert.deepEqual(record.spotifyProvenance.trackArtists,[...new Set(proof.tracks.flatMap(track=>track.artists))]);
  if(decision.availabilityObservation?.unplayableRows>0)assert(record.spotifyAvailabilityNote,`Missing observed Spotify restrictions ${outcome.id}`);
}
for(const [id,spotifyId] of Object.entries(baseline.existingLinks))assert.equal(catalog.records.find(record=>record.id===id)?.spotifyId,spotifyId,`Existing Spotify link changed ${id}`);
assert.equal(summary.added,summary.outcomes.filter(row=>row.status==='matched').length);
assert.equal(summary.linkedAfter,baseline.linkedBefore+summary.added);
assert.equal(catalog.meta.spotify,summary.linkedAfter);
console.log(`Validated ${summary.added} new Spotify matches, ${summary.remainingConfirmedSearches} documented unresolved cases, and ${baseline.linkedBefore} existing links.`);

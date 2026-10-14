import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';

const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const baseline=await read('../research/spotify-link-baseline.json');
const eligible=new Map(baseline.eligibleUnlinked.map(record=>[record.id,record]));
const outcomes=[], merged=[], updates=[], allRecords=[];

for(const shard of ['left','middle','right']){
  const data=await read(`../research/spotify-link-audit-${shard}.json`);
  const audit=Array.isArray(data)?data:data.records;
  const rows=await read(`../research/${shard}.json`);
  for(const result of audit){
    const original=eligible.get(result.id);
    assert(original,`Unexpected Spotify audit slot ${result.id}`);
    assert(['matched','unresolved'].includes(result.status),`Incomplete Spotify outcome ${result.id}`);
    const record=rows.find(row=>row.id===result.id);
    assert(record&&record.confidence==='confirmed'&&record.kind!=='book');
    assert.equal(record.title,original.title);assert.equal(record.artist,original.artist);
    assert.equal(record.box,original.box);assert.equal(record.position,original.position);
    if(result.status==='unresolved'){
      const reason=result.unresolvedReason||result.reason;
      assert(reason&&!/progress|pending|not yet|awaiting/i.test(reason),`Unfinished Spotify research ${result.id}`);
      assert(!record.spotifyId,`Unresolved slot unexpectedly linked ${result.id}`);
      outcomes.push({id:result.id,status:'unresolved',title:record.title,artist:record.artist,reason});
      continue;
    }
    assert(/^[A-Za-z0-9]{22}$/.test(result.spotifyId),`Invalid Spotify ID ${result.id}`);
    const verified=await read(`../research/spotify-link-verification/${result.spotifyId}.json`);
    assert(verified.verified,`Unverified primary Spotify page ${result.id}`);
    assert.equal(verified.id,result.spotifyId);
    assert.equal(verified.url,result.spotifyUrl);
    assert(verified.title&&verified.artists.length&&verified.tracks.length,`Incomplete Spotify evidence ${result.id}`);
    assert.equal(verified.tracks.length,verified.trackCount,`Incomplete Spotify track list ${result.id}`);
    assert.equal(verified.trackCount,result.spotifyTrackCount,`Audit and independent Spotify track counts differ ${result.id}`);
    assert.equal(verified.title,result.spotifyTitle,`Audit and independent Spotify titles differ ${result.id}`);
    const auditArtists=(Array.isArray(result.spotifyArtists)?result.spotifyArtists:[result.spotifyArtists]).filter(Boolean).join(' / ').toLocaleLowerCase();
    for(const artist of verified.artists)assert(auditArtists.includes(artist.toLocaleLowerCase()),`Audit and independent Spotify artists differ ${result.id}: ${artist}`);
    assert(result.editionNotes,`Missing digital edition decision ${result.id}`);
    assert(!record.spotifyId||record.spotifyId===result.spotifyId,`Conflicting existing link ${result.id}`);
    record.spotifyId=result.spotifyId;
    record.spotifyEdition=`${verified.title}. ${result.editionNotes}`;
    record.digitalReleaseDate=result.spotifyDate||String(verified.date?.year||'');
    record.digitalCopyright=verified.copyright.map(entry=>entry.text).join(' · ');
    record.spotifyProvenance={
      source:'Spotify public album metadata',url:verified.url,
      verifiedAt:verified.verifiedAt,title:verified.title,artists:verified.artists,
      trackArtists:[...new Set(verified.tracks.flatMap(track=>track.artists))],
      trackCount:verified.trackCount,editionMatch:'original-album-programme',
      editionNotes:result.editionNotes,
      evidenceFile:`research/spotify-link-verification/${result.spotifyId}.json`,
      auditFile:`research/spotify-link-audit-${shard}.json`,
    };
    delete record.spotifyAvailabilityNote;
    if(result.availabilityNote&&!/^(Availability reflects|All .*playable)/.test(result.availabilityNote))record.spotifyAvailabilityNote=result.availabilityNote;
    const availability=result.availabilityObservation;
    if(availability?.unplayableRows>0)record.spotifyAvailabilityNote=`Spotify’s ${availability.publicPageCountry==='CA'?'Canadian':availability.publicPageCountry} album page marked ${availability.unplayableRows} of ${availability.trackRowsObserved} tracks unavailable when checked on ${verified.verifiedAt.slice(0,10)}.`;
    record.sources??=[];
    if(!record.sources.some(source=>(typeof source==='string'?source:source.url)===verified.url))record.sources.push(verified.url);
    merged.push(record.id);
    outcomes.push({id:record.id,status:'matched',title:record.title,artist:record.artist,spotifyId:result.spotifyId,spotifyTitle:verified.title,url:verified.url,editionNotes:result.editionNotes});
  }
  // Preserve the physical catalogue and all artwork; only verified listening
  // metadata and its source URL are added by this pass.
  updates.push({url:new URL(`../research/${shard}.json`,import.meta.url),source:JSON.stringify(rows,null,2)+'\n'});
  allRecords.push(...rows);
}

assert.equal(outcomes.length,baseline.eligibleUnlinkedCount,'Incomplete Spotify audit coverage');
assert.equal(new Set(outcomes.map(row=>row.id)).size,outcomes.length,'Duplicate Spotify audit outcomes');
for(const [id,spotifyId] of Object.entries(baseline.existingLinks))assert.equal(allRecords.find(record=>record.id===id)?.spotifyId,spotifyId,`Existing Spotify link changed ${id}`);
const total=baseline.linkedBefore+merged.length;
const summary={
  linkedBefore:baseline.linkedBefore,added:merged.length,linkedAfter:total,
  confirmedSlotsAudited:outcomes.length,remainingConfirmedSearches:outcomes.length-merged.length,
  verification:'Each accepted ID was independently fetched from its primary Spotify album page; original artist/recording/programme and digital edition notes were reviewed.',
  outcomes,
};
for(const {url,source} of updates)await writeFile(url,source);
await writeFile(new URL('../research/spotify-link-audit-summary.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
console.log({linkedBefore:baseline.linkedBefore,added:merged.length,linkedAfter:total,remainingConfirmedSearches:summary.remainingConfirmedSearches});

import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';

const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const decisions=new Map();
for(const shard of ['left','middle','right','root']){
  const proposalFile=`research/capture-intake-spotify-${shard}-2026-10-14.json`;
  const proposal=await read('../'+proposalFile);
  for(const source of proposal.records){
    const id=source.recordId??source.id;
    if(decisions.has(id)){
      assert.equal(decisions.get(id).status,source.status,`Reviewers disagree: ${id}`);
      assert.equal(decisions.get(id).spotifyId??null,source.spotifyId??null,`Reviewers disagree: ${id}`);
      decisions.get(id).additionalReview=proposalFile;
      continue;
    }
    const result={id,status:source.status.startsWith('unresolved')?'unresolved':source.status,spotifyId:source.spotifyId??null,proposalFile,
      editionNote:source.editionNote??source.editionNotes??null,reason:source.reason??source.unresolvedReason??null,
      sources:source.sources??source.evidence?.map(row=>row.url)??[],
      programmeEvidence:source.programmeProof??source.programmeEvidence??source.physicalIdentityEvidence??null};
    if(result.status==='matched'){
      const proof=await read(`../research/spotify-link-verification/${result.spotifyId}.json`);
      assert(proof.verified&&proof.tracks.length===proof.trackCount);
      assert.equal(proof.title,source.spotifyTitle??source.title);
      assert.equal(proof.trackCount,source.spotifyTrackCount??source.trackCount);
      Object.assign(result,{spotifyTitle:proof.title,spotifyArtists:proof.artists,spotifyTrackCount:proof.trackCount,url:proof.url,
        proofFile:`research/spotify-link-verification/${proof.id}.json`});
      if(source.availability?.unplayableTitles?.length)result.availabilityNote=`Spotify’s public metadata marked ${source.availability.unplayableTitles.join(', ')} unavailable when checked. Availability may differ by account or region.`;
      assert(result.editionNote,`Missing edition explanation: ${id}`);
    }else assert(result.reason,`Missing unresolved/preservation reason: ${id}`);
    decisions.set(id,result);
  }
}
const records=[...decisions.values()];
const result={version:1,batch:'2026-10-14',status:'reviewed',
  policy:'Link only verified original album programmes and performances. Expanded releases and mastering differences are disclosed. Partial anthologies and uncertain alternate takes retain search.',
  counts:Object.fromEntries(['matched','unresolved','preserve-existing'].map(status=>[status,records.filter(row=>row.status===status).length])),records};
await writeFile(new URL('../research/capture-intake-2026-10-14/spotify-decisions.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(result.counts);

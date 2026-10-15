import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';

const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const [middle,right,bream,rightProposal]=await Promise.all([
  '../research/spine-masks-middle.json','../research/spine-masks-right.json',
  '../research/capture-intake-bream-mask-review-2026-10-14.json','../research/capture-intake-right-2026-10-14.json'
].map(read));
const changes=[];
assert(![middle,right].some(shard=>Object.values(shard.boxes).some(box=>box.records.some(record=>record.captureReview))),
  'Capture geometry is already integrated; preserve the archived before/after corrections and edit the source mask shards directly.');
for(const [shard,box,proposals] of [
  [middle,'lower-middle',[...bream.records,bream.requiredNeighborAdjustment]],
  [right,'right',rightProposal.maskSplitProposal.records]
]){
  const target=shard.boxes[box];assert(target);
  for(const proposal of proposals){
    const existing=target.records.find(row=>row.id===proposal.id);
    assert(existing||proposal.id.endsWith('04b'));
    const before=existing?{outline:existing.polygon,anchor:existing.anchor}:null;
    const after={outline:proposal.polygon,anchor:proposal.anchor};
    changes.push({id:proposal.id,box,before,after,reason:proposal.changeReason??proposal.notes});
    const replacement={...existing,id:proposal.id,polygon:proposal.polygon,anchor:proposal.anchor,
      traceConfidence:'measured',notes:proposal.changeReason??proposal.notes,
      captureReview:'research/capture-intake-2026-10-14/mask-corrections.json'};
    if(existing)target.records[target.records.indexOf(existing)]=replacement;
    else target.records.push(replacement);
  }
  target.records.sort((a,b)=>parseFloat(a.id.split('-').at(-1).replace('b','.5'))-parseFloat(b.id.split('-').at(-1).replace('b','.5')));
}
const corrections={version:1,guideVersion:'7ac3efbb41aa',
  reason:'Front/back captures establish two separate sleeves inside previously combined regions. Original IDs and frozen guide are retained.',
  records:changes};
for(const [name,data] of [['spine-masks-middle.json',middle],['spine-masks-right.json',right],['capture-intake-2026-10-14/mask-corrections.json',corrections]])
  await writeFile(new URL('../research/'+name,import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(`Integrated ${changes.length} reviewed masks, including two separately photographed sleeves.`);

"""Prepare reviewed sleeve faces, preferring documented external artwork."""
from pathlib import Path
import hashlib
import json
import io
import numpy as np
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[2]
RESEARCH=ROOT/'site/research'
OUTPUT=ROOT/'site/dist/assets/covers'
OUTPUT.mkdir(parents=True,exist_ok=True)

def digest(data): return hashlib.sha256(data).hexdigest()

def rectify(image, corners):
    side=min(2200,round(max(np.linalg.norm(np.asarray(corners[i])-np.asarray(corners[(i+1)%4])) for i in range(4))))
    a=[];b=[]
    for (x,y),(u,v) in zip([[0,0],[side,0],[side,side],[0,side]],corners):
        a.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]])
        b.extend([u,v])
    return image.transform((side,side),Image.Transform.PERSPECTIVE,np.linalg.solve(a,b),Image.Resampling.BICUBIC)

proposals=[RESEARCH/'capture-intake-artwork-left-2026-10-14.json',
           RESEARCH/'capture-intake-artwork-middle-2026-10-14.json',
           RESEARCH/'capture-intake-clean-art-right-2026-10-14.json']
fallback=RESEARCH/'capture-intake-2026-10-14/fallback-artwork.json'
if fallback.exists(): proposals.append(fallback)
records=[]
for proposal in proposals:
    data=json.loads(proposal.read_text())
    for record in data['records']:
        selected={'id':record['recordId'],'proposalFile':str(proposal.relative_to(ROOT/'site'))}
        for face in ['front','back']:
            source=record.get(face)
            if not source: continue
            local=ROOT/source['localPath']
            raw=local.read_bytes()
            if source.get('sha256'): assert source['sha256']==digest(raw),f'Source changed: {local}'
            image=ImageOps.exif_transpose(Image.open(io.BytesIO(raw)))
            original_size=image.size
            assert min(image.size)>=250,f'Artwork too small: {local}'
            crop=source.get('suggestedOuterQuad')
            if crop: image=rectify(image,crop['pixels'])
            if source.get('clockwiseRotation'): image=image.rotate(-source['clockwiseRotation'],expand=True)
            reuse=str(local).startswith(str(ROOT/'site/dist')+'/') and not crop and not source.get('clockwiseRotation')
            if reuse:
                asset=str(local.relative_to(ROOT/'site/dist')); result_bytes=raw
            else:
                image.thumbnail((2200,2200),Image.Resampling.LANCZOS)
                image=image.convert('RGB')
                buffer=io.BytesIO();image.save(buffer,format='JPEG',quality=94,optimize=True,icc_profile=image.info.get('icc_profile'))
                result_bytes=buffer.getvalue()
                asset=f"assets/covers/{record['recordId']}-intake-{face}-{digest(result_bytes)[:10]}.jpg"
                (ROOT/'site/dist'/asset).write_bytes(result_bytes)
            dimensions=list(Image.open(io.BytesIO(result_bytes)).size)
            accepted={**source,'path':asset,'originalDimensions':list(original_size),'dimensions':dimensions,
              'sourceSha256':digest(raw),'sha256':digest(result_bytes),
              'processing':'Existing verified artwork retained byte-for-byte.' if reuse else
                'EXIF orientation normalized; documented outer-face crop applied where needed; resized only above 2200px; capture metadata omitted. No generated or retouched printed content.'}
            if face=='front':
                thumb=Image.open(io.BytesIO(result_bytes)).convert('RGB');thumb.thumbnail((560,560),Image.Resampling.LANCZOS)
                buffer=io.BytesIO();thumb.save(buffer,format='WEBP',quality=91,method=6)
                thumb_bytes=buffer.getvalue();thumb_asset=f"assets/covers/{record['recordId']}-intake-thumb-{digest(thumb_bytes)[:10]}.webp"
                (ROOT/'site/dist'/thumb_asset).write_bytes(thumb_bytes)
                accepted['thumbnail']=thumb_asset;accepted['thumbnailSha256']=digest(thumb_bytes)
            selected[face]=accepted
        records.append(selected)
# Fallbacks may add a missing rear while retaining a reviewed external front.
combined={}
for row in records:
    target=combined.setdefault(row['id'],{'id':row['id'],'proposalFiles':[]})
    target['proposalFiles'].append(row['proposalFile'])
    for face in ['front','back']:
        if face not in row: continue
        assert face not in target,f'Duplicate {face} artwork selection: {row["id"]}'
        target[face]=row[face]
records=list(combined.values())
result={'version':1,'policy':'Clean documented external LP and book faces preferred. Family photographs supply documented fallbacks only where clean outer-face scans remain unavailable.',
        'records':records}
target=RESEARCH/'capture-intake-2026-10-14/artwork-assets.json'
target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
family_faces=sum(row[face].get('source')=='Family photograph' for row in records for face in ['front','back'] if face in row)
print(f'Prepared {len(records)} reviewed artwork selections ({sum(face in row for row in records for face in ["front","back"])} faces, {family_faces} family-photo fallbacks).')

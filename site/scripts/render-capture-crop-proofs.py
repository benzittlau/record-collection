"""Render reproducible crop proofs. Source originals and their metadata stay untouched."""
from pathlib import Path
import json
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[2]
inspection = root / 'tmp/capture-intake-2026-10-14'
calibration_path = root / 'site/research/capture-intake-2026-10-14/crops.json'
proof_dir = inspection / 'crop-proofs'
proof_dir.mkdir(exist_ok=True)

if not calibration_path.exists():
    entries = []
    for path in sorted((inspection / 'previews').glob('*.jpg')):
        data = json.loads((inspection / (path.stem + '.json')).read_text())
        candidates = data.get('documentRectangles') or data.get('rectangles') or []
        if candidates:
            candidate = candidates[0]
            points = [[candidate[key][0], 1-candidate[key][1]] for key in ['topLeft','topRight','bottomRight','bottomLeft']]
        else:
            points = [[0,0],[1,0],[1,1],[0,1]]
        entries.append({'filename': data['filename'], 'corners': points, 'clockwiseRotation': 0,
                        'candidateSource': 'Vision document segmentation' if data.get('documentRectangles') else 'Vision rectangles',
                        'reviewed': False})
    calibration_path.write_text(json.dumps({'coordinateSpace':'oriented-image-normalized-top-left','files':entries}, indent=2)+'\n')

def rectify(image, points, side=1000):
    source = np.array(points, dtype=float) * [image.width, image.height]
    destination = [[0,0],[side,0],[side,side],[0,side]]
    a=[]; b=[]
    for (x,y),(u,v) in zip(destination,source):
        a.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]])
        b.extend([u,v])
    coefficients=np.linalg.solve(np.asarray(a),np.asarray(b))
    return image.transform((side,side),Image.Transform.PERSPECTIVE,coefficients,Image.Resampling.BICUBIC)

data=json.loads(calibration_path.read_text())
for entry in data['files']:
    image=Image.open(inspection / 'previews' / (Path(entry['filename']).stem + '.jpg')).convert('RGB')
    proof=rectify(image,entry['corners'])
    if entry.get('clockwiseRotation'): proof=proof.rotate(-entry['clockwiseRotation'],expand=True)
    proof.save(proof_dir/(Path(entry['filename']).stem+'.jpg'),quality=93)

font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',18)
for offset in range(0,len(data['files']),12):
    page=Image.new('RGB',(1440,1170),(230,226,215)); draw=ImageDraw.Draw(page)
    for index, entry in enumerate(data['files'][offset:offset+12]):
        x=index%4*360; y=index//4*390
        image=Image.open(proof_dir/(Path(entry['filename']).stem+'.jpg')).resize((348,348),Image.Resampling.LANCZOS)
        page.paste(image,(x+6,y+4))
        draw.text((x+10,y+360),Path(entry['filename']).stem,font=font,fill=(25,30,25))
    page.save(inspection/f'crop-contact-{offset//12+1:02d}.jpg',quality=94)
print(f"Rendered {len(data['files'])} crop proofs and eight crop contact sheets.")

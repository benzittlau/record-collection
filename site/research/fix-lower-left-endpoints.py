"""Reproducible, idempotent lower-left cap/foot refinement.

Run with imaging Python from any working directory; add --review for /tmp QA.
Coordinates describe EXIF-oriented 4032x3024 source pixels. Only lower-left
endpoint vertices 0/1/3/4 and marker anchors change, plus one documented divider
overlap correction at lower-left-46 vertex5. Canonical JSON supplies all other
preserved middle-body vertices, IDs, metadata, and the corrected upper-left box.
"""
from pathlib import Path
import copy, json, sys
from PIL import Image, ImageOps, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
CANONICAL = ROOT / 'site/research/spine-masks-left.json'
SOURCE = ROOT / 'site/dist/assets/boxes/lower-left.jpg'
REVIEW = Path('/tmp/box2-endpoint-review')
# ID -> [cap-left, cap-right, foot-left, foot-right]. These are photographed
# sleeve-face corners, inset from paper edges, not common shelf/divider lines.
MEASURED_ENDPOINTS = {
 'lower-left-01': [[582,370],[626,370],[953,2590],[972,2590]],
 'lower-left-02': [[635,348],[709,345],[979,2591],[1037,2582]],
 'lower-left-03': [[710,361],[724,351],[1042,2576],[1059,2576]],
 'lower-left-04': [[729,351],[754,350],[1062,2578],[1080,2581]],
 'lower-left-05': [[761,344],[816,338],[1086,2573],[1116,2570]],
 'lower-left-06': [[818,341],[895,343],[1120,2577],[1161,2577]],
 'lower-left-07': [[900,360],[929,348],[1167,2576],[1191,2576]],
 'lower-left-08': [[932,368],[966,365],[1195,2575],[1212,2576]],
 'lower-left-09': [[969,367],[1008,366],[1216,2576],[1243,2576]],
 'lower-left-10': [[1010,349],[1072,347],[1246,2576],[1281,2584]],
 'lower-left-11': [[1074,349],[1097,351],[1284,2583],[1298,2582]],
 'lower-left-12': [[1103,342],[1127,343],[1301,2580],[1320,2577]],
 'lower-left-13': [[1129,353],[1169,345],[1324,2575],[1353,2578]],
 'lower-left-14': [[1174,343],[1232,342],[1356,2576],[1409,2567]],
 'lower-left-15': [[1235,352],[1335,355],[1415,2569],[1475,2572]],
 'lower-left-16': [[1338,356],[1372,354],[1482,2582],[1502,2583]],
 'lower-left-17': [[1375,356],[1438,357],[1506,2583],[1540,2582]],
 'lower-left-18': [[1443,355],[1490,356],[1544,2575],[1575,2575]],
 'lower-left-19': [[1493,362],[1516,365],[1581,2583],[1610,2584]],
 'lower-left-20': [[1518,389],[1548,384],[1615,2576],[1644,2578]],
 'lower-left-21': [[1550,359],[1563,358],[1649,2586],[1666,2586]],
 'lower-left-22': [[1615,379],[1670,380],[1717,2580],[1740,2576]],
 'lower-left-23': [[1673,382],[1715,381],[1745,2584],[1766,2584]],
 'lower-left-24': [[1718,378],[1749,377],[1769,2585],[1793,2584]],
 'lower-left-25': [[1751,378],[1797,377],[1797,2578],[1825,2578]],
 'lower-left-26': [[1800,395],[1834,395],[1830,2583],[1856,2583]],
 'lower-left-27': [[1836,327],[1889,327],[1859,2602],[1900,2602]],
 'lower-left-28': [[1892,375],[1920,375],[1903,2584],[1915,2584]],
 'lower-left-29': [[1925,375],[1958,374],[1918,2588],[1940,2588]],
 'lower-left-30': [[1960,394],[1995,394],[1943,2577],[1963,2578]],
 'lower-left-31': [[1998,379],[2033,379],[1966,2587],[1994,2587]],
 'lower-left-32': [[2035,379],[2055,379],[1996,2584],[2014,2584]],
 'lower-left-33': [[2058,388],[2096,388],[2018,2583],[2040,2583]],
 'lower-left-34': [[2100,366],[2136,376],[2044,2587],[2073,2587]],
 'lower-left-35': [[2138,401],[2168,401],[2077,2589],[2094,2589]],
 'lower-left-36': [[2171,375],[2195,379],[2098,2589],[2112,2589]],
 'lower-left-37': [[2197,370],[2240,367],[2115,2589],[2154,2589]],
 'lower-left-38': [[2244,361],[2277,374],[2159,2598],[2181,2595]],
 'lower-left-39': [[2280,396],[2329,397],[2185,2590],[2220,2586]],
 'lower-left-40': [[2334,377],[2366,378],[2225,2593],[2248,2593]],
 'lower-left-41': [[2369,385],[2398,391],[2252,2593],[2271,2593]],
 'lower-left-42': [[2401,391],[2451,392],[2275,2592],[2300,2592]],
 'lower-left-43': [[2454,382],[2503,383],[2305,2581],[2346,2583]],
 'lower-left-44': [[2508,371],[2602,380],[2349,2580],[2393,2583]],
 'lower-left-45': [[2606,378],[2622,378],[2396,2592],[2411,2593]],
 'lower-left-46': [[2695,398],[2720,398],[2480,2584],[2499,2585]],
 'lower-left-47': [[2718,380],[2746,382],[2505,2591],[2537,2595]],
 'lower-left-48': [[2749,386],[2794,394],[2540,2602],[2567,2602]],
 'lower-left-49': [[2797,418],[2822,419],[2571,2596],[2589,2596]],
 'lower-left-50': [[2836,367],[2873,369],[2593,2590],[2613,2590]],
 'lower-left-51': [[2877,392],[2939,391],[2617,2619],[2672,2621]],
 'lower-left-52': [[2943,414],[2960,416],[2675,2608],[2689,2608]],
 'lower-left-53': [[2960,416],[2994,417],[2693,2594],[2704,2594]],
 'lower-left-54': [[2998,348],[3092,352],[2709,2595],[2770,2595]],
 'lower-left-55': [[3095,386],[3140,390],[2775,2595],[2804,2595]],
 'lower-left-56': [[3143,400],[3182,400],[2809,2607],[2840,2607]],
 'lower-left-57': [[3186,409],[3207,412],[2846,2596],[2864,2596]],
 'lower-left-58': [[3210,424],[3260,418],[2868,2597],[2897,2598]],
 'lower-left-59': [[3263,417],[3332,413],[2902,2600],[2960,2600]],
 'lower-left-60': [[3336,390],[3393,383],[2967,2614],[3007,2614]],
 'lower-left-61': [[3397,425],[3430,416],[3012,2598],[3026,2599]],
 'lower-left-62': [[3434,409],[3468,422],[3031,2610],[3048,2610]],
 'lower-left-63': [[3471,394],[3532,408],[3053,2600],[3086,2601]],
 'lower-left-64': [[3536,408],[3554,422],[3091,2601],[3109,2601]],
 'lower-left-65': [[3558,417],[3603,408],[3112,2607],[3150,2606]],
 'lower-left-66': [[3610,427],[3648,435],[3155,2608],[3183,2608]],
}
# The sole body exception fixes a pre-existing white-divider overlap, measured
# independently in source pixels. All 131 other body vertices remain unchanged.
BODY_CORRECTIONS = {'lower-left-46': {5: [2572,1475]}}
ENDPOINT_NOTE = ('Six-point clockwise masks follow individually measured spine cap/foot corners. '
 'Endpoint corners sit approximately 2–4 source pixels inside the main visible sleeve face; '
 'tiny folded/worn tips and rounded heels use straight-edge approximations. '
 'Original middle-body side vertices are preserved exactly except Neiges sleeve46 '
 'left vertex5, corrected from white divider [2556,1475] to visible paper [2572,1475]. '
 'Sleeve28 black cap has an indistinct boundary against the dark background; its '
 'conservative endpoint estimate follows neighboring visible cap heights.')
FUSE_NOTE = ('Longer Fuse sleeve 06: cap [818,341]/[895,343], foot [1120,2577]/[1161,2577]. '
 'The worn tan paper cap belongs to the sleeve; tiny folded peaks near y333 and rounded '
 'heel pixels near y2584 lie outside the conservative straight edges. Markers anchor '
 'to each individual foot midpoint. Divider and side-wall shadows are excluded.')

def apply():
 original = CANONICAL.read_text(); data = json.loads(original)
 preserved_upper = copy.deepcopy(data['boxes']['upper-left'])
 records = data['boxes']['lower-left']['records']
 assert [r['id'] for r in records] == list(MEASURED_ENDPOINTS)
 body = {r['id']: [copy.deepcopy(r['polygon'][2]), copy.deepcopy(r['polygon'][5])] for r in records}
 for r in records:
  tl,tr,bl,br = MEASURED_ENDPOINTS[r['id']]
  r['polygon'][0]=list(tl); r['polygon'][1]=list(tr)
  r['polygon'][4]=list(bl); r['polygon'][3]=list(br)
  r['anchor']=[(bl[0]+br[0])/2,(bl[1]+br[1])/2]
  for vertex,point in BODY_CORRECTIONS.get(r['id'],{}).items():
   r['polygon'][vertex]=list(point)
  assert r['polygon'][2]==body[r['id']][0]
  expected_left=BODY_CORRECTIONS.get(r['id'],{}).get(5,body[r['id']][1])
  assert r['polygon'][5]==expected_left
 notes=data['boxes']['lower-left']['notes']
 notes[:]=[n for n in notes if not n.startswith(('Six-point clockwise masks follow','Longer Fuse sleeve'))]
 notes.insert(2,ENDPOINT_NOTE); notes.append(FUSE_NOTE)
 assert data['boxes']['upper-left']==preserved_upper
 updated=json.dumps(data,indent=2)+'\n'
 if updated!=original: CANONICAL.write_text(updated)
 print('Lower-left 66 measured caps/feet applied; sole46 divider body correction retained; other bodies and upper-left unchanged.')
 return data

def review(data):
 REVIEW.mkdir(parents=True,exist_ok=True)
 source=ImageOps.exif_transpose(Image.open(SOURCE)).convert('RGBA')
 layer=Image.new('RGBA',source.size,(0,0,0,0)); draw=ImageDraw.Draw(layer)
 font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',22)
 for r in data['boxes']['lower-left']['records']:
  p=[tuple(v) for v in r['polygon']]
  draw.polygon(p,fill=(102,235,190,22),outline=(255,216,67,225),width=3)
  draw.text((sum(x for x,y in p[:2])/2-10,min(y for x,y in p[:2])+20),r['id'].rsplit('-',1)[1],font=font,fill='white',stroke_width=2,stroke_fill='black')
  for j in [0,1,3,4]:
   x,y=p[j]; draw.ellipse((x-2,y-2,x+2,y+2),fill=(45,255,210,255))
 result=Image.alpha_composite(source,layer).convert('RGB')
 result.resize((1512,1134)).save(REVIEW/'lower-left-endpoints-overlay.jpg',quality=98)
 for name,bounds in [('06-cap-final-qa',(790,320,930,395)),('06-foot-final-qa',(1090,2535,1190,2610)),('01-cap-final-qa',(560,335,650,425)),('01-foot-final-qa',(940,2550,1040,2620)),('21-22-foot-final-qa',(1620,2540,1775,2650)),('45-46-foot-final-qa',(2370,2540,2530,2660)),('46-mid-final-qa',(2520,1400,2630,1530)),('66-foot-final-qa',(3125,2550,3200,2640))]:
  c=result.crop(bounds); c.resize((c.width*7,c.height*7)).save(REVIEW/(name+'.jpg'),quality=98)
 for sec,(cx0,cx1,fx0,fx1,cy0,cy1,fy0,fy1) in enumerate([(550,1575,925,1685,290,455,2530,2630),(1590,2630,1690,2430,300,460,2530,2630),(2640,3690,2420,3210,325,495,2520,2640)],1):
  for name,b in [('cap',(cx0,cy0,cx1,cy1)),('foot',(fx0,fy0,fx1,fy1))]:
   c=result.crop(b); c.resize((c.width*2,c.height*2)).save(REVIEW/f'section-{sec}-{name}-final.jpg',quality=98)
 print('Source-photo overlays saved to',REVIEW)

if __name__=='__main__':
 data=apply()
 if '--review' in sys.argv: review(data)

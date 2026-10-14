"""Reproducible, idempotent upper-left endpoint refinement.

Run with the bundled imaging Python from repository root:
  python site/research/fix-upper-left-endpoints.py
Add --review to save source-photo QA overlays under /tmp/box1-endpoint-review.

Measured coordinates are in EXIF-transposed 4032 × 3024 source space.
Only upper-left endpoint vertices 0,1,3,4 and foot marker anchors are updated.
The canonical research JSON supplies stable IDs and preserved body/lower-left data.
No temporary baseline, served pixels, or application source is used or modified.
"""
from pathlib import Path
import copy,json,sys
from PIL import Image,ImageOps,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[2]
CANONICAL=ROOT/'site/research/spine-masks-left.json'
SOURCE=ROOT/'site/dist/assets/boxes/upper-left.jpg'
REVIEW=Path('/tmp/box1-endpoint-review')
# ID -> [cap-left, cap-right, foot-left, foot-right]. Main visible face corners
# are inset from ragged paper; straight caps/feet approximate tiny folds/heels.
MEASURED_ENDPOINTS={'upper-left-01': [[553, 416], [588, 429], [814, 2740], [835, 2738]],
 'upper-left-02': [[586, 392], [620, 392], [838, 2774], [854, 2773]],
 'upper-left-03': [[622, 394], [630, 402], [858, 2767], [869, 2767]],
 'upper-left-04': [[632, 406], [697, 423], [876, 2766], [923, 2766]],
 'upper-left-05': [[697, 396], [786, 402], [932, 2774], [980, 2768]],
 'upper-left-06': [[790, 420], [823, 430], [982, 2749], [1019, 2733]],
 'upper-left-07': [[821, 390], [853, 390], [1022, 2748], [1030, 2749]],
 'upper-left-08': [[855, 396], [870, 393], [1032, 2749], [1060, 2747]],
 'upper-left-09': [[873, 413], [909, 414], [1062, 2752], [1090, 2753]],
 'upper-left-10': [[910, 399], [939, 398], [1091, 2745], [1125, 2742]],
 'upper-left-11': [[942, 413], [988, 412], [1127, 2745], [1151, 2742]],
 'upper-left-12': [[990, 408], [1024, 417], [1153, 2742], [1182, 2741]],
 'upper-left-13': [[1026, 418], [1054, 409], [1184, 2742], [1214, 2741]],
 'upper-left-14': [[1058, 424], [1089, 428], [1216, 2742], [1236, 2739]],
 'upper-left-15': [[1089, 396], [1132, 406], [1237, 2737], [1267, 2736]],
 'upper-left-16': [[1134, 413], [1178, 420], [1269, 2741], [1321, 2734]],
 'upper-left-17': [[1178, 394], [1221, 405], [1323, 2729], [1350, 2726]],
 'upper-left-18': [[1223, 405], [1278, 406], [1353, 2729], [1379, 2730]],
 'upper-left-19': [[1280, 403], [1330, 401], [1380, 2719], [1418, 2733]],
 'upper-left-20': [[1332, 403], [1360, 421], [1420, 2731], [1433, 2727]],
 'upper-left-21': [[1362, 431], [1399, 430], [1435, 2717], [1475, 2705]],
 'upper-left-22': [[1400, 395], [1452, 395], [1476, 2696], [1527, 2722]],
 'upper-left-23': [[1448, 396], [1481, 398], [1529, 2720], [1546, 2718]],
 'upper-left-24': [[1518, 425], [1574, 430], [1617, 2682], [1642, 2682]],
 'upper-left-25': [[1577, 436], [1609, 434], [1648, 2678], [1666, 2678]],
 'upper-left-26': [[1610, 406], [1672, 404], [1670, 2679], [1710, 2679]],
 'upper-left-27': [[1675, 429], [1708, 433], [1720, 2692], [1751, 2693]],
 'upper-left-28': [[1710, 438], [1737, 437], [1753, 2684], [1774, 2682]],
 'upper-left-29': [[1739, 434], [1794, 440], [1777, 2683], [1813, 2679]],
 'upper-left-30': [[1795, 397], [1841, 404], [1815, 2687], [1846, 2684]],
 'upper-left-31': [[1843, 403], [1908, 406], [1848, 2684], [1890, 2684]],
 'upper-left-32': [[1910, 430], [1947, 430], [1892, 2673], [1928, 2670]],
 'upper-left-33': [[1953, 403], [2004, 401], [1931, 2686], [1964, 2688]],
 'upper-left-34': [[2015, 454], [2053, 455], [1973, 2677], [1987, 2678]],
 'upper-left-35': [[2050, 422], [2110, 436], [1992, 2673], [2029, 2671]],
 'upper-left-36': [[2113, 395], [2154, 403], [2031, 2667], [2067, 2662]],
 'upper-left-37': [[2155, 432], [2181, 418], [2069, 2662], [2090, 2667]],
 'upper-left-38': [[2183, 424], [2220, 430], [2092, 2664], [2108, 2656]],
 'upper-left-39': [[2222, 425], [2244, 415], [2111, 2648], [2142, 2666]],
 'upper-left-40': [[2246, 414], [2263, 421], [2144, 2663], [2159, 2654]],
 'upper-left-41': [[2263, 451], [2295, 452], [2162, 2640], [2211, 2652]],
 'upper-left-42': [[2298, 439], [2359, 438], [2213, 2644], [2274, 2654]],
 'upper-left-43': [[2361, 432], [2383, 437], [2276, 2638], [2334, 2640]],
 'upper-left-44': [[2457, 401], [2487, 407], [2400, 2608], [2410, 2608]],
 'upper-left-45': [[2488, 421], [2532, 419], [2415, 2614], [2444, 2614]],
 'upper-left-46': [[2534, 420], [2579, 422], [2449, 2619], [2469, 2619]],
 'upper-left-47': [[2582, 417], [2675, 419], [2479, 2610], [2511, 2611]],
 'upper-left-48': [[2677, 426], [2760, 423], [2518, 2607], [2588, 2609]],
 'upper-left-49': [[2761, 446], [2791, 446], [2596, 2609], [2619, 2606]],
 'upper-left-50': [[2792, 448], [2871, 434], [2627, 2607], [2674, 2604]],
 'upper-left-51': [[2873, 433], [2906, 435], [2677, 2625], [2711, 2624]],
 'upper-left-52': [[2907, 450], [2938, 442], [2714, 2614], [2729, 2604]],
 'upper-left-53': [[2939, 446], [2973, 455], [2731, 2605], [2763, 2604]],
 'upper-left-54': [[2979, 420], [3019, 424], [2767, 2586], [2814, 2596]],
 'upper-left-55': [[3021, 430], [3068, 446], [2817, 2585], [2861, 2590]],
 'upper-left-56': [[3071, 442], [3099, 452], [2863, 2589], [2891, 2593]],
 'upper-left-57': [[3101, 449], [3130, 450], [2894, 2590], [2927, 2593]],
 'upper-left-58': [[3132, 442], [3169, 438], [2930, 2585], [2967, 2570]],
 'upper-left-59': [[3171, 432], [3186, 428], [2970, 2557], [2995, 2572]],
 'upper-left-60': [[3188, 429], [3225, 429], [2997, 2578], [3037, 2577]]}

ENDPOINT_NOTE=('Six-point clockwise masks follow individually measured spine cap/foot corners. '
    'Endpoint corners sit approximately 2–4 source pixels inside the main visible sleeve face; '
    'tiny folded/worn tips and rounded heels use straight-edge approximations. '
    'Original middle-body side vertices are preserved exactly.')
PRISONER_NOTE=('Prisoner in Disguise sleeve 33: cap [1953,403]/[2004,401], '
    'foot [1931,2686]/[1964,2688]. Its rounded final heel reaches about y2694, '
    'a few pixels outside the conservative straight foot edge. '
    'Markers anchor to each individual foot midpoint, not a common shelf line.')

def apply():
    original=CANONICAL.read_text();data=json.loads(original)
    saved_lower=copy.deepcopy(data['boxes']['lower-left'])
    records=data['boxes']['upper-left']['records']
    assert [r['id'] for r in records]==list(MEASURED_ENDPOINTS)
    saved_body={r['id']:[copy.deepcopy(r['polygon'][2]),copy.deepcopy(r['polygon'][5])] for r in records}
    for r in records:
        tl,tr,bl,br=MEASURED_ENDPOINTS[r['id']]
        r['polygon'][0]=list(tl);r['polygon'][1]=list(tr)
        r['polygon'][4]=list(bl);r['polygon'][3]=list(br)
        r['anchor']=[round((bl[0]+br[0])/2),round((bl[1]+br[1])/2)]
        assert [r['polygon'][2],r['polygon'][5]]==saved_body[r['id']]
    notes=data['boxes']['upper-left']['notes']
    notes[:]=[n for n in notes if not n.startswith(('Six-point clockwise masks follow','Prisoner in Disguise'))]
    notes.insert(2,ENDPOINT_NOTE);notes.append(PRISONER_NOTE)
    assert data['boxes']['lower-left']==saved_lower
    updated=json.dumps(data,indent=2)+'\n'
    if updated!=original:CANONICAL.write_text(updated)
    print('Upper-left 60 measured caps/feet applied; body vertices and lower-left unchanged.')
    return data

def review(data):
    REVIEW.mkdir(parents=True,exist_ok=True)
    source=ImageOps.exif_transpose(Image.open(SOURCE)).convert('RGBA')
    layer=Image.new('RGBA',source.size,(0,0,0,0));draw=ImageDraw.Draw(layer)
    font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',22)
    for r in data['boxes']['upper-left']['records']:
        p=[tuple(v) for v in r['polygon']]
        draw.polygon(p,fill=(102,235,190,22),outline=(255,216,67,220),width=3)
        draw.text((sum(x for x,y in p[:2])/2-10,min(y for x,y in p[:2])+20),r['id'].rsplit('-',1)[1],font=font,fill='white',stroke_width=2,stroke_fill='black')
        for j in [0,1,3,4]:
            x,y=p[j];draw.ellipse((x-2,y-2,x+2,y+2),fill=(45,255,210,255))
    result=Image.alpha_composite(source,layer).convert('RGB')
    result.resize((1512,1134)).save(REVIEW/'upper-left-endpoints-final-overlay.jpg',quality=96)
    for name,bounds in [('33-cap-final',(1935,370,2020,450)),('33-foot-final',(1910,2640,1990,2720))]:
        c=result.crop(bounds);c.resize((c.width*8,c.height*8)).save(REVIEW/(name+'.jpg'),quality=96)
    # Wider context shows caps/feet of all slots without changing source pixels.
    for sec,(x0,x1,cap0,cap1,foot0,foot1) in enumerate([(520,1575,350,535,2700,2810),(1500,2410,350,535,2620,2730),(2380,3260,350,535,2550,2650)],1):
        for name,y0,y1 in [('cap',cap0,cap1),('foot',foot0,foot1)]:
            c=result.crop((x0,y0,x1,y1));c.resize((c.width*2,c.height*2)).save(REVIEW/f'section-{sec}-{name}-final.jpg',quality=96)
    print('Source-photo overlays saved to',REVIEW)

if __name__=='__main__':
    data=apply()
    if '--review' in sys.argv:review(data)

"""Measure sleeve-edge anchors in EXIF-oriented original photos, with conservative insets.

This script only writes tracing data and diagnostic overlays, never served photo pixels.
The measured x cuts are at source y=700,1500,2400. Where a worn seam is
indistinct its boundary is estimated between adjacent readable sleeve faces.
"""
import json
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'site/research/spine-masks-middle.json'
CAT=json.load(open(ROOT/'site/dist/catalog.json'))['records']
DATA={
 'lower-middle':{
 'top':[600,642,714,760,849,879,914,949,992,1034,1058,1080,1118,1156,1197,1268,1281,1309,1337,1406,1454,1495,1500,1530,1568,1597,1666,1698,1721,1758,1796,1851,1906,1927,1961,1992,2028,2056,2212,2236,2256,2276,2334,2366,2397,2424,2458,2495,2542,2572,2607,2635,2686,2708,2748,2780,2804,2872,2895,2921,2944,2988,3019,3049,3087,3111,3145,3191,3211,3269,3337],
 'middle':[714,770,838,881,936,965,996,1026,1064,1096,1140,1164,1207,1257,1290,1364,1393,1419,1461,1484,1535,1573,1595,1618,1655,1665,1723,1750,1783,1810,1842,1889,1932,1958,1986,2019,2047,2070,2211,2236,2255,2279,2332,2370,2386,2433,2465,2495,2554,2585,2614,2647,2686,2714,2746,2777,2802,2855,2883,2906,2930,2968,2995,3019,3054,3088,3101,3138,3174,3198,3242],
 'bottom':[851,910,969,1007,1040,1067,1117,1134,1181,1216,1258,1278,1319,1361,1397,1461,1491,1514,1540,1567,1609,1646,1664,1700,1716,1724,1780,1807,1840,1866,1905,1938,1973,2001,2033,2062,2094,2102,2239,2263,2287,2301,2363,2398,2416,2450,2484,2518,2569,2600,2634,2655,2691,2719,2743,2777,2796,2854,2872,2889,2906,2931,2967,2983,3018,3046,3051,3086,3111,3130,3153],
 'y':[650,1500,2600],
 'notes':'Sleeve boundaries measured at y700, y1500 and y2400 in the EXIF-oriented 4032x3024 original. Endpoints conservatively inset to y650..2600 and extrapolated only 50px above /200px below the measured cuts. Each side is independently traced; wide Mahler box and leaning Rampal/Laskine spine use measured seams. Thin, heavily worn or overlapping sleeve edges are estimates bounded by adjacent visible sleeves; all catalog IDs are retained, with the three Bowie titles mapped to photographed physical order. Shapes deliberately avoid exposed interior wall and the white outer frame. The last sleeves end far left of the opening right boundary; slot67 specifically follows the cream Japanese Melodies sleeve. Central strips are represented, excluding ragged folded tips and some sleeve ends.'
 },
 'upper-middle':{
 'groups':[
  {'positions':list(range(1,34)),
   'top':[600,640,667,711,839,870,891,905,921,948,1002,1052,1085,1124,1170,1196,1224,1257,1293,1311,1355,1398,1439,1472,1499,1538,1599,1644,1685,1719,1777,1808,1845,1888],
   'bottom':[711,742,770,803,891,919,950,973,988,1017,1055,1101,1138,1174,1205,1229,1257,1285,1315,1343,1372,1406,1442,1476,1520,1549,1602,1642,1675,1703,1768,1803,1841,1875]},
  {'positions':list(range(34,69)),
   'top':[1900,1954,1979,2019,2076,2117,2155,2213,2245,2273,2308,2349,2374,2408,2458,2490,2510,2546,2570,2601,2639,2660,2700,2740,2768,2808,2840,2872,2911,2926,2969,3007,3026,3064,3090,3140],
   'bottom':[1885,1933,1961,1993,2048,2089,2111,2157,2191,2228,2258,2298,2315,2386,2398,2432,2450,2499,2511,2546,2558,2568,2603,2628,2664,2699,2735,2774,2789,2800,2846,2880,2894,2924,2939,2963]}
 ],
 'y':[650,1500,2550],
 'notes':'Two physical compartments. Individually measured source x seam anchors at y700 and y2400, with side-edge interpolation at y1500. Endpoints are conservatively inset to y650..2550, excluding the front divider, exposed interior and folded ragged tips. Nitty Gritty Dirt Band three-record box, Pink Floyd double sleeve and Elton John sleeve retain their measured larger widths. Unreadable, heavily worn or partly overlapping seams use bounded estimates; all68 original catalog IDs are retained. The rightmost cream sleeve is inset from the angled exposed white interior wall.'
 }
}
def edge(a,b,c,y):
 if y<=1500:return a+(b-a)*(y-700)/800
 return b+(c-b)*(y-1500)/900
boxes={}
for box,dat in DATA.items():
 records=sorted([r for r in CAT if r['box']==box],key=lambda r:r['position'])
 groups=dat.get('groups',[dict(positions=list(range(1,len(records)+1)),top=dat.get('top'),middle=dat.get('middle'),bottom=dat.get('bottom'))])
 traced=[]
 for group in groups:
  top,bottom=group['top'],group['bottom']
  mid=group.get('middle',[(a+(c-a)*800/1700) for a,c in zip(top,bottom)])
  assert len(top)==len(bottom)==len(mid)==len(group['positions'])+1,(box,len(top),len(bottom),len(group['positions']))
  for k,position in enumerate(group['positions']):
   mapped_position={18:19,19:20,20:18}.get(position,position) if box=='lower-middle' else position
   rec=records[mapped_position-1]
   ys=dat['y']; sides=[]
   for n,sgn in [(k,1),(k+1,-1)]:
    sides.append([[round(edge(top[n],mid[n],bottom[n],y)+sgn*min(2,(edge(top[k+1],mid[k+1],bottom[k+1],y)-edge(top[k],mid[k],bottom[k],y))/6),1),y] for y in ys])
   L,R=sides
   poly=[L[0],R[0],R[1],R[2],L[2],L[1]]
   measured=box=='lower-middle' and position in [1,3,14,26,28,34,36,38,46,47,48,49,50,52,55,56,57,59,60,61,64,65,67,70]
   anchorY=ys[-1]
   anchor=[round((poly[3][0]+poly[4][0])/2,1),anchorY]
   traced.append({'id':rec['id'],'polygon':poly,'anchor':anchor,'traceConfidence':'measured' if measured else 'estimated','notes':'Photographed side seams measured at three source heights.' if measured else 'Boundary estimate constrained to visible sleeve band; some thin or worn neighboring edges remain ambiguous.'})
 boxes[box]={'records':sorted(traced,key=lambda r:r['id']),'notes':dat['notes'],'sourceSize':[4032,3024],'sourceOrientation':'EXIF orientation3 applied; browser displayed pixels','sampleYs':[700,1500,2400]}
result={'version':1,'coordinateSpace':'source-photo','boxes':boxes,'positionCorrections':{'lower-middle-19':18,'lower-middle-20':19,'lower-middle-18':20},'method':'Manual sleeve-edge anchor measurements on analysis crops from the original EXIF-oriented photos. Piecewise-linear sides, conservative2px inset. These are interactive central-face masks, not pixel-perfect sleeve segmentation. No original photo pixels are changed.'}
OUT.write_text(json.dumps(result,indent=2)+'\n')
for box,data in boxes.items():
 im=ImageOps.exif_transpose(Image.open(ROOT/f'site/dist/assets/boxes/{box}.jpg')).convert('RGBA')
 overlay=Image.new('RGBA',im.size)
 d=ImageDraw.Draw(overlay)
 for i,r in enumerate(data['records']):
  color=((i*79)%230+25,(i*131)%230+25,(i*191)%230+25,70)
  d.polygon([tuple(p) for p in r['polygon']],fill=color,outline=(*color[:3],220),width=3)
  x,y=r['anchor'];d.text((x,y),r['id'].split('-')[-1],fill='white',stroke_width=2,stroke_fill='black')
 im=Image.alpha_composite(im,overlay).convert('RGB')
 im.resize((1344,1008)).save(ROOT/f'site/research/crops/masks-{box}-overlay.jpg')
 if box=='lower-middle':im.crop((2880,580,3400,2690)).save(ROOT/'site/research/crops/masks-lower-middle-right-detail.jpg')
print('Wrote',OUT,[(b,len(v['records'])) for b,v in boxes.items()])

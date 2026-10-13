"""Manually traced right-box sleeve contours, in EXIF-transposed photo pixels.

Each row supplies left/right edges at y=500, y=1500, and the visible foot.
Top corners are trimmed to each sleeve's visible cap. Intermediate edges are
measured independently; the shape is not a subdivision of the box opening.
The script writes only dedicated research output and optional /tmp diagnostics.
"""
from pathlib import Path
import hashlib,json
from PIL import Image,ImageOps,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'site/dist/assets/boxes/right.jpg'
# position: xL500,xR500,xL1500,xR1500,xLfoot,xRfoot,yTopL,yTopR,yFootL,yFootR
SPECS={
1:(516,540,674,709,850,873,454,449,2584,2585),
2:(542,594,711,757,875,922,449,443,2583,2584),
3:(596,714,759,854,924,999,447,436,2585,2589),
4:(716,776,856,909,1001,1046,430,427,2610,2606),
5:(778,846,911,965,1048,1098,428,440,2595,2597),
6:(848,917,967,1022,1100,1138,465,451,2587,2584),
7:(919,978,1024,1089,1140,1198,453,460,2582,2588),
8:(980,1005,1091,1128,1200,1228,482,475,2598,2595),
9:(1007,1077,1130,1171,1230,1273,480,443,2610,2613),
10:(1079,1172,1173,1250,1275,1328,443,440,2618,2617),
11:(1174,1205,1252,1276,1330,1356,458,454,2583,2588),
12:(1207,1289,1278,1333,1358,1420,439,444,2584,2588),
13:(1291,1317,1335,1364,1422,1452,443,451,2582,2586),
14:(1319,1348,1366,1389,1454,1477,492,490,2574,2583),
15:(1350,1405,1391,1443,1479,1521,449,455,2582,2585),
16:(1407,1442,1445,1484,1523,1542,480,478,2586,2585),
17:(1506,1557,1529,1554,1570,1622,463,460,2584,2588),
18:(1559,1601,1556,1620,1624,1662,462,465,2583,2592),
19:(1603,1643,1622,1639,1664,1680,450,468,2580,2586),
20:(1645,1681,1641,1671,1682,1710,485,470,2589,2600),
21:(1683,1718,1673,1726,1712,1736,465,456,2584,2582),
22:(1720,1780,1728,1772,1738,1780,455,456,2589,2594),
23:(1782,1801,1774,1800,1782,1800,485,478,2589,2595),
24:(1803,1851,1802,1843,1802,1830,469,465,2587,2590),
25:(1853,1875,1845,1870,1832,1847,463,473,2587,2586),
26:(1877,1911,1872,1898,1849,1887,474,474,2586,2600),
27:(1913,1976,1900,1954,1889,1928,457,461,2613,2616),
28:(1978,2030,1956,2003,1930,1972,461,460,2602,2601),
29:(2032,2074,2005,2045,1974,2000,485,488,2604,2608),
30:(2076,2083,2047,2054,2002,2009,482,484,2580,2582),
31:(2085,2127,2056,2084,2011,2037,465,473,2588,2594),
32:(2129,2171,2086,2119,2039,2064,468,476,2587,2591),
33:(2173,2210,2121,2149,2066,2097,488,493,2592,2603),
34:(2212,2260,2151,2202,2099,2133,474,478,2616,2622),
35:(2262,2319,2204,2249,2135,2167,481,489,2605,2602),
36:(2321,2376,2251,2303,2169,2224,485,485,2615,2616),
37:(2378,2413,2305,2335,2226,2254,490,491,2608,2607),
38:(2415,2456,2337,2375,2256,2282,508,516,2630,2638),
39:(2530,2566,2435,2468,2345,2376,493,506,2595,2603),
40:(2568,2600,2470,2496,2378,2403,494,481,2597,2595),
41:(2602,2663,2498,2537,2405,2441,482,486,2594,2595),
42:(2665,2707,2539,2583,2443,2488,485,500,2607,2607),
43:(2709,2745,2585,2632,2490,2520,506,504,2597,2599),
44:(2747,2797,2634,2664,2522,2562,501,500,2606,2608),
45:(2799,2834,2666,2704,2564,2596,494,500,2609,2617),
46:(2836,2877,2706,2738,2598,2633,480,487,2601,2608),
47:(2879,2932,2740,2779,2635,2667,509,511,2604,2606),
48:(2934,2980,2781,2821,2670,2702,497,501,2604,2608),
49:(2982,3025,2823,2863,2704,2740,511,514,2609,2609),
50:(3027,3061,2865,2892,2742,2762,516,531,2609,2608),
51:(3063,3095,2894,2938,2764,2788,496,484,2605,2605),
52:(3100,3230,2940,3052,2790,2869,574,587,2577,2585),
53:(3232,3373,3054,3180,2871,2972,513,514,2626,2623),
54:(3375,3420,3182,3212,2974,3009,510,511,2612,2604),
}
SPECIAL={
 4:'Unidentified cream edge retained as its catalogue slot. Its pale contour is traced, but it may be an adjacent sleeve/box-set fold; title and exact ownership remain unresolved.',
 9:'The projecting torn grey flap above the actual titled Bolling spine is excluded; the mask starts at the main spine cap.',
 19:'Very worn narrow Apostrophe spine: title anchor fixes identification; pale borders between adjacent dark sleeves are conservatively inset.',
 23:'Thin Yesterdays spine between Close to the Edge and Together. Border locations are estimated from the visible pale/blue line and readable catalogue text.',
 30:'Conservative narrow pale-edge mask between Journey and Six Wives. This is the catalogue placeholder; the edge may be a folded part of Journey rather than an independent sleeve.',
 52:'Wide Views art-book spine measured separately; short cap starts below adjacent records. Width is not borrowed from the wider Solo Concerts box set.',
 53:'Wide Solo Concerts 3-LP box measured separately, including its strong leftward lean and taper.',
}
raw=json.loads((ROOT/'site/dist/catalog.json').read_text())
rows=raw['records'] if isinstance(raw,dict) else raw
rows=sorted((r for r in rows if r['box']=='right'),key=lambda r:r['position'])
records=[]
for r in rows:
 p=r['position'];xl,xr,ml,mr,bl,br,tyl,tyr,byl,byr=SPECS[p]
 # Interpolate only the short cap-to-y500 offset along separately measured edges.
 # A small inset keeps uncertain tears/black gaps out of neighboring sleeves.
 inset=1 if p==30 else 2
 tl=round(xl+(ml-xl)*(tyl-500)/1000)+inset
 tr=round(xr+(mr-xr)*(tyr-500)/1000)-inset
 polygon=[[tl,tyl],[tr,tyr],[mr-inset,1500],[br-inset,byr],[bl+inset,byl],[ml+inset,1500]]
 record={'id':r['id'],'polygon':polygon,'anchor':[round((bl+br)/2),round((byl+byr)/2)],'notes':SPECIAL.get(p,'Visible cap, middle, and foot independently traced against readable title/label anchors. Small intervening gaps and torn fringe are excluded; short unresolvable edge portions are interpolated between those anchors.')}
 records.append(record)
assert [r['id'] for r in records]==[r['id'] for r in rows]
assert len(records)==54
for r in records:
 poly=r['polygon'];area=sum(poly[i][0]*poly[(i+1)%len(poly)][1]-poly[(i+1)%len(poly)][0]*poly[i][1] for i in range(len(poly)))/2
 assert area>0,(r['id'],area)
 assert all(0<=x<4032 and 0<=y<3024 for x,y in poly)
out={'version':1,'coordinateSpace':'source-photo','boxes':{'right':{'sourcePhoto':'assets/boxes/right.jpg','width':4032,'height':3024,'sourcePhotoSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'records':records,'notes':'Manual conservative 6-point sleeve traces in EXIF-transposed (browser displayed) 4032x3024 photo coordinates. Top caps, y1500 middle edges, and individual bottom contours are measured independently from visible spines and readable artist/title/catalogue anchors. These masks exclude white box framing, divider gaps, empty top/bay regions, and inter-sleeve black gaps; they are not uniform compartment subdivisions. Very small worn-edge sections between measured anchors are interpolated, with a 2px inset (1px on unresolved slot30). Slots04/30 retain the catalogue uncertainties. Book52 and 3LP box53 have separately measured broad tapered contours. Top-cap x positions use short local interpolation from the measured y500 edge; microcreases and torn fringe are not pixel-perfect segmentation.'}}}
(ROOT/'site/research/spine-masks-right.json').write_text(json.dumps(out,indent=2)+'\n')
# Diagnostic only: tint each masked band in the transposed image, never served pixels.
im=ImageOps.exif_transpose(Image.open(SOURCE)).convert('RGB');overlay=Image.new('RGBA',im.size,(0,0,0,0));d=ImageDraw.Draw(overlay);font=ImageFont.truetype('/System/Library/Fonts/Monaco.ttf',23)
palette=[(255,196,68,55),(60,224,216,55),(240,92,179,55),(149,229,84,55)]
for i,r in enumerate(records):
 col=palette[i%len(palette)];d.polygon([tuple(p) for p in r['polygon']],fill=col,outline=col[:3]+(220,),width=3)
 x,y=r['anchor'];d.rectangle((x-17,y+2,x+17,y+31),fill=(15,15,15,240));d.text((x-14,y+3),str(i+1),font=font,fill=(255,255,235,255))
result=Image.alpha_composite(im.convert('RGBA'),overlay).convert('RGB')
for name,box in [('full',(300,350,3470,2710)),('left',(480,410,1590,2670)),('middle',(1490,430,2470,2670)),('right',(2320,440,3440,2670))]:
 result.crop(box).save('/tmp/right-masks-'+name+'.jpg',quality=95)
print('Wrote54 masks and /tmp diagnostics')

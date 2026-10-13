from PIL import Image,ImageOps,ImageDraw,ImageFont
from pathlib import Path
import numpy as np

Path('/tmp/record-left-spine-review').mkdir(parents=True,exist_ok=True)
FONT=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',20)
def find_lines(box,xmin,xmax,ymin=520,ymax=2640,min_slope=-.18,max_slope=.18):
    im=ImageOps.exif_transpose(Image.open(f'site/dist/assets/boxes/{box}.jpg')).convert('RGB')
    arr=np.array(im).astype(float)
    grad=np.sqrt(((arr[:,4:]-arr[:,:-4])**2).mean(axis=2))
    grad=np.pad(grad,((0,0),(2,2)),mode='edge')
    ys=np.arange(ymin,ymax,10);xs=np.arange(xmin,xmax);mid=(ymin+ymax)/2
    best=np.zeros(len(xs));slopes=np.zeros(len(xs))
    for slope in np.arange(min_slope,max_slope+.001,.002):
        xx=np.rint(xs[None,:]+(ys[:,None]-mid)*slope).astype(int)
        vals=grad[ys[:,None],xx]
        score=np.minimum(vals,55).mean(axis=0)
        ok=score>best;best[ok]=score[ok];slopes[ok]=slope
    order=np.argsort(best)[::-1];chosen=[]
    for i in order:
        if all(abs(xs[i]-xs[j])>9 for j in chosen): chosen.append(i)
        if len(chosen)>=70:break
    chosen.sort(key=lambda i:xs[i])
    print(box, 'mid',mid)
    for j,i in enumerate(chosen):print(j, int(xs[i]),round(float(slopes[i]),3),round(float(best[i]),1))
    out=im.copy();d=ImageDraw.Draw(out)
    for j,i in enumerate(chosen):
        x=float(xs[i]);s=float(slopes[i]);color='#00ffff' if best[i]>17 else '#ffff00'
        d.line([(x+(ymin-mid)*s,ymin),(x+(ymax-mid)*s,ymax)],fill=color,width=2)
        d.text((x-5,950+(j%4)*90),str(j),font=FONT,fill=color,stroke_width=1,stroke_fill='#000')
    out.crop((xmin-170,350,xmax+170,2800)).resize((max(700,(xmax-xmin+340)),1800)).save(f'/tmp/record-left-spine-review/mask-{box}-detected.jpg')
    return chosen

# find_lines is available for optional diagnostic passes.

# Title-anchored source-photo border seeds. Each boundary is independently
# measured from continuous photographic edges; slopes are dx/dy in source px.
SECTIONS={
'upper-left':[
(1,23,1580,[681,711,743,753,810,884,921,944,967,1001,1037,1075,1107,1136,1165,1202,1250,1288,1332,1372,1398,1434,1486,1522],[.114,.108,.102,.100,.096,.078,.082,.073,.080,.076,.078,.070,.068,.070,.064,.058,.060,.052,.044,.036,.036,.034,.032,.018],460,2670),
(24,43,1580,[1572,1613,1651,1697,1730,1758,1804,1847,1904,1940,1982,2017,2070,2109,2138,2161,2191,2215,2250,2313,2356],[.044,.032,.036,.020,.020,.014,.008,0,-.008,-.008,-.018,-.026,-.036,-.038,-.040,-.048,-.044,-.046,-.038,-.036,-.020],480,2530),
(44,60,1520,[2423,2454,2494,2528,2596,2673,2706,2773,2809,2836,2873,2913,2966,2999,3032,3067,3092,3134],[-.024,-.034,-.040,-.046,-.070,-.078,-.078,-.086,-.088,-.092,-.098,-.095,-.094,-.098,-.094,-.096,-.086,-.088],490,2540)],
'lower-left':[
(1,21,1460,[750,791,875,899,922,962,1033,1061,1092,1131,1179,1199,1220,1264,1327,1413,1441,1490,1535,1566,1599,1618],[.178,.172,.154,.154,.152,.144,.124,.122,.118,.108,.102,.096,.094,.090,.082,.068,.060,.052,.044,.046,.046,.052],420,2500),
(22,45,1460,[1660,1707,1741,1769,1809,1849,1893,1915,1945,1973,2013,2036,2066,2106,2129,2156,2196,2225,2273,2308,2337,2371,2425,2499,2513],[.050,.034,.028,.022,.016,.012,.008,-.004,-.006,-.012,-.018,-.020,-.022,-.028,-.032,-.040,-.040,-.048,-.052,-.056,-.068,-.072,-.074,-.102,-.100],430,2500),
(46,66,1475,[2555,2609,2642,2676,2708,2739,2806,2825,2850,2930,2970,3010,3038,3079,3149,3201,3230,3254,3311,3333,3381,3416],[-.106,-.106,-.098,-.106,-.112,-.126,-.130,-.132,-.140,-.154,-.160,-.166,-.166,-.176,-.182,-.186,-.200,-.204,-.216,-.216,-.220,-.230],450,2500)]
}

def build_masks():
    import json
    catalog=json.loads(Path('site/dist/catalog.json').read_text())['records']
    result={'version':1,'coordinateSpace':'source-photo','boxes':{}}
    for box,sections in SECTIONS.items():
        im=ImageOps.exif_transpose(Image.open(f'site/dist/assets/boxes/{box}.jpg')).convert('RGB')
        arr=np.asarray(im).astype(float)
        grad=np.sqrt(((arr[:,4:]-arr[:,:-4])**2).mean(axis=2));grad=np.pad(grad,((0,0),(2,2)),mode='edge')
        records=[];overlay=Image.new('RGBA',im.size,(0,0,0,0));draw=ImageDraw.Draw(overlay,'RGBA')
        for first,last,mid,xs,slopes,yt,yb in sections:
            assert len(xs)==last-first+2
            # Refine a measured border against persistent nearby image edges.
            # The narrow search cannot jump to another sleeve or the white frame.
            rows=[yt,mid,yb]; borders=[]
            for bx,slope in zip(xs,slopes):
                points=[]
                for y in rows:
                    estimate=bx+(y-mid)*slope
                    candidates=np.arange(round(estimate)-5,round(estimate)+6)
                    sy=np.arange(max(0,round(y)-35),min(3023,round(y)+36),4)
                    # Follow the candidate line through a short vertical window.
                    xx=np.rint(candidates[None,:]+(sy[:,None]-y)*slope).astype(int)
                    val=np.minimum(grad[sy[:,None],xx],55).mean(axis=0)
                    xxbest=int(candidates[int(np.argmax(val))])
                    points.append([xxbest,y])
                borders.append(points)
            # Prevent a damaged narrow sleeve's two border estimates crossing.
            for row in range(3):
                for j in range(1,len(borders)):
                    borders[j][row][0]=max(borders[j][row][0],borders[j-1][row][0]+8)
            for local,pos in enumerate(range(first,last+1)):
                left=borders[local];right=borders[local+1]
                # Clockwise 6-point outline. A small inset avoids shared edges.
                polygon=[[left[0][0]+1,yt],[right[0][0]-1,yt],[right[1][0]-1,mid],[right[2][0]-1,yb],[left[2][0]+1,yb],[left[1][0]+1,mid]]
                r=next(r for r in catalog if r['box']==box and r['position']==pos)
                records.append({'id':r['id'],'polygon':polygon,'anchor':[round((left[2][0]+right[2][0])/2),yb]})
                color=(255,206,55,36) if pos%2 else (110,230,255,36)
                draw.polygon([tuple(p) for p in polygon],fill=color,outline=(255,225,90,170),width=2)
                labelY=820+(local%3)*190
                lx=left[1][0]+(labelY-mid)*slopes[local];rx=right[1][0]+(labelY-mid)*slopes[local+1]
                draw.text(((lx+rx)/2-12,labelY),str(pos),font=FONT,fill=(255,255,255,255),stroke_width=2,stroke_fill=(0,0,0,255))
        expected=[r['id'] for r in catalog if r['box']==box]
        assert [r['id'] for r in records]==expected
        result['boxes'][box]={'records':records,'notes':[
          'Coordinates refer to the EXIF-transposed original 4032 × 3024 photograph, as displayed by the browser.',
          'Readable title/artist/cat-number spines anchor the catalog IDs and left-to-right order. Border seeds follow continuous photographed edges, with separate top/middle/bottom measurements refined within ±5 source pixels.',
          'Six-point clockwise masks follow the leaning record band. The top/bottom caps are deliberately inset from ragged tips and the shelf floor; white frame, compartment dividers and empty side space are excluded.',
          'Worn/unidentified sleeves retain every catalog ID. Borders adjoining damaged or partly hidden spines are estimates guided by neighboring readable anchors; exact physical pressing and thin-sleeve counts remain uncertain.',
          'Mask geometry is a photographic trace with local edge refinement, not equal subdivisions of the room face.',
          'Interpolated/worn slots: '+', '.join(r['id'] for r in catalog if r['box']==box and r['confidence']=='unknown')+'.',
          'Partial readable anchors (identity/title uncertain in catalog): '+', '.join(r['id'] for r in catalog if r['box']==box and r['confidence']=='probable')+'.'
        ]}
        Image.alpha_composite(im.convert('RGBA'),overlay).convert('RGB').resize((1512,1134)).save(f'/tmp/record-left-spine-review/mask-{box}-final-overlay.jpg',quality=95)
    Path('site/research/spine-masks-left.json').write_text(json.dumps(result,indent=2)+'\n')
    print('Wrote',sum(len(v['records']) for v in result['boxes'].values()),'left masks')

if __name__=='__main__':build_masks()

# Builds assets/pets/*.webp from the user's 即梦 side-view sheets (2560x1440 PNGs: ubai/bear/kylin/sunny).
# Cuts out the side view, removes the paper background + watermark, splits four leg layers and writes meta (pivots).
# Usage: put the four PNGs in SRC, run python3 pets_build.py [names...]; then copy out/*.webp to assets/pets/.
import numpy as np, json
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

SRC='/tmp/claude-0/pets/'
X0=1250  # every side view lives in the right part of the sheet
# leg polygons in crop coords (crop = original x - 1250). Top edge of each polygon = hip/shoulder cut; pivot = middle of it.
# a/b = gait phase (diagonal pairs move together); far legs listed first (drawn first).
PETS={
 'ubai':dict(wm_keep=[[(740,1262),(828,1262),(828,1300),(822,1336),(740,1340)]],flip=False,legs=[
   ('bf','b',[(282,800),(383,800),(383,1150),(400,1205),(300,1205),(250,1150),(230,1000),(240,900)]),
   ('ff','b',[(640,905),(785,905),(765,990),(757,1150),(835,1240),(835,1335),(660,1335),(652,1233),(643,1000)]),
   ('bn','a',[(106,790),(282,790),(240,900),(230,1000),(250,1150),(250,1240),(70,1240),(78,1150),(92,1000),(100,900)]),
   ('fn','a',[(383,880),(522,880),(500,990),(495,1067),(535,1283),(535,1365),(375,1365),(383,1275)]),
 ]),
 'bear':dict(wm_keep=[[(740,1262),(772,1262),(772,1362),(740,1362)],[(785,1262),(948,1262),(948,1300),(928,1330),(798,1330),(785,1300)]],flip=False,seal=12,legs=[
   ('bf','b',[(322,990),(482,990),(437,1075),(440,1180),(492,1190),(492,1255),(330,1255),(290,1150),(290,1060)]),
   ('ff','b',[(735,1000),(905,1000),(860,1240),(925,1250),(925,1335),(760,1335),(765,1100)]),
   ('bn','a',[(140,945),(352,945),(322,1000),(290,1060),(290,1150),(320,1290),(140,1290)]),
   ('fn','a',[(505,1000),(735,1000),(735,1275),(752,1290),(752,1360),(590,1360),(585,1270),(535,1256),(505,1100)]),
 ]),
 'kylin':dict(wm_keep=[[(740,1262),(806,1262),(806,1318),(740,1318)],[(782,1262),(950,1262),(950,1275),(912,1335),(880,1343),(800,1342),(782,1325)],[(948,1262),(1210,1262),(1210,1296),(948,1296)]],flip=True,seal=30,ink_only=[[(0,100),(150,100),(148,222),(93,266),(74,311),(61,366),(38,398),(0,398)],[(0,400),(36,400),(38,430),(45,457),(67,497),(100,518),(140,540),(0,560)]],legs=[   # cat faces left in the source; mirrored at the end
   ('ff','a',[(225,960),(349,960),(349,1260),(300,1262),(300,1340),(240,1340),(245,1100)]),
   ('bf','a',[(640,985),(735,960),(880,1105),(812,1250),(805,1320),(668,1320),(672,1240),(738,1232),(770,1112)]),
   ('fn','b',[(349,960),(545,960),(500,1100),(475,1250),(472,1358),(298,1362),(300,1265),(349,1258)]),
   ('bn','b',[(866,1110),(905,1110),(900,1180),(910,1255),(945,1270),(940,1350),(790,1350),(795,1262),(812,1250)]),
 ]),
 'sunny':dict(wm_keep=[[(740,1262),(852,1262),(852,1296),(740,1296)],[(915,1262),(1084,1262),(1084,1318),(1068,1340),(1000,1342),(930,1338),(915,1318)]],flip=True,legs=[   # puppy body faces left in the source; mirrored at the end
   ('ff','a',[(110,900),(272,900),(272,1255),(205,1262),(205,1330),(85,1330),(100,1200)]),
   ('bf','a',[(684,935),(797,926),(905,1062),(900,1110),(855,1280),(855,1300),(690,1300),(690,1215),(760,1210),(770,1110),(670,940)]),
   ('fn','b',[(274,935),(468,935),(462,990),(440,1100),(415,1240),(412,1365),(198,1365),(200,1262),(274,1255)]),
   ('bn','b',[(905,1072),(1100,1072),(1100,1260),(1095,1345),(915,1345),(918,1262),(955,1250),(950,1120)]),
 ]),
}
WM=(740,1262,1290,1420)   # "即梦AI" watermark box, crop coords
OUT_H=360                 # output pixel height per animal (CSS shows ~60-100px; enough for 3x screens)

def process(name,cfg):
    im=np.asarray(Image.open(SRC+name+'.png').convert('RGB')).astype(np.int16)[:, X0:]
    H,W,_=im.shape
    mx,mn=im.max(2),im.min(2); L=im.mean(2); sat=mx-mn
    # 1) watermark box: its semi-transparent overlay turns paw outlines grey, so inside the box grey counts as ink
    #    (keeps the outline sealed); everything in the box outside the hand-marked paw regions is forced to background
    x0,y0,x1,y1=WM
    box=np.zeros((H,W),bool); box[y0:y1,x0:x1]=True
    keep=np.zeros((H,W),bool)
    for poly in cfg.get('wm_keep',[]):
        km=Image.new('L',(W,H),0); ImageDraw.Draw(km).polygon(poly,fill=255); keep|=np.asarray(km)>0
    wm_ink=box&keep&(sat<16)&(L<238)
    force_bg=box&~keep
    # 2) background = paper-white reachable from the border without crossing (slightly thickened) ink lines
    dark=(L<150)|wm_ink
    R=cfg.get('seal',4)
    ink=ndi.binary_dilation(dark,structure=ndi.generate_binary_structure(2,1),iterations=R) if R<=4 else (ndi.distance_transform_edt(~dark)<=R)
    bright=(mn>226)&(sat<18)
    cand=bright&~ink
    lab,_=ndi.label(cand)
    border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg0=np.isin(lab,list(border))
    soft=(mn>200)&(sat<26)
    if R<=4:
        bg=ndi.binary_dilation(bg0,iterations=6)&soft
    else:
        # grow back toward the ink, but only a limited distance, so a gap in the outline can't flood the white fur
        grow=bg0.copy()
        for _ in range(R+3):
            grow=ndi.binary_dilation(grow)&(soft|bg0)
        bg=grow
    bg|=bg0
    fg=~bg&~force_bg
    lab2,n=ndi.label(fg); sizes=ndi.sum(fg,lab2,range(1,n+1))
    keep=np.zeros(n+1,bool); keep[1+np.argmax(sizes)]=True
    keep[1:][sizes>4000]=True
    fg=keep[lab2]
    # 3) thicken the ink a little so lines survive downscaling (~0.07x)
    rgb=im.astype(np.float32)
    inkmask=(L<120)&fg
    thick=ndi.binary_dilation(inkmask,iterations=2)&fg&~inkmask
    if thick.any():
        # colour the new pixels with the darkest neighbouring ink
        dl=ndi.grey_erosion(L,size=5)
        rgb[thick]=np.stack([ndi.grey_erosion(im[...,c],size=5) for c in range(3)],-1)[thick]
    # 4) alpha: solid inside, matte-removed edge band against white
    dist=ndi.distance_transform_edt(fg)
    alpha=np.where(fg,1.0,0.0).astype(np.float32)
    band=fg&((dist<=3)|(box&(dist<=7)))
    Lb=rgb.mean(2)
    a=np.clip((255-Lb)/(255-70),0,1)
    alpha[band]=np.maximum(a[band], np.where((dist[band]>2.5)&~box[band],1,0))
    with np.errstate(divide='ignore',invalid='ignore'):
        un=(rgb-(1-alpha[...,None])*255)/np.maximum(alpha[...,None],1e-3)
    rgb=np.where(band[...,None],np.clip(un,0,255),rgb)
    # whisker zones: outside the head only the ink lines themselves are kept
    for poly in cfg.get('ink_only',[]):
        zm=Image.new('L',(W,H),0); ImageDraw.Draw(zm).polygon(poly,fill=255); z=(np.asarray(zm)>0)&fg
        az=np.clip((230-L)/(230-60),0,1).astype(np.float32)
        alpha[z]=az[z]
        with np.errstate(divide='ignore',invalid='ignore'):
            unz=(im.astype(np.float32)-(1-az[...,None])*255)/np.maximum(az[...,None],1e-3)
        rgb[z]=np.clip(unz,0,255)[z]
    rgba=np.dstack([np.clip(rgb,0,255),alpha*255]).astype(np.uint8)
    # 5) split legs
    legmasks=[]
    for key,ph,poly in cfg['legs']:
        m=Image.new('L',(W,H),0); ImageDraw.Draw(m).polygon(poly,fill=255)
        legmasks.append(np.asarray(m)>0)
    union=np.zeros((H,W),bool)
    for m in legmasks: union|=m
    BAND=26
    body_keep=~union
    for (key,ph,poly),m in zip(cfg['legs'],legmasks):
        top=min(p[1] for p in poly)
        rows=np.zeros((H,W),bool); rows[top:top+BAND]=True
        body_keep|=(m&rows)    # body keeps a short strip of each leg top so swinging never opens a gap
    layers={'body':rgba.copy()}
    layers['body'][~body_keep,3]=0
    # drop tiny leftovers (bits of leg outline that fell outside every polygon)
    bl,bn=ndi.label(layers['body'][...,3]>0)
    if bn>1:
        bs=ndi.sum(np.ones_like(bl),bl,range(1,bn+1))
        small=np.zeros(bn+1,bool); small[1:]=bs<600
        layers['body'][small[bl],3]=0
    pivots={}
    for (key,ph,poly),m in zip(cfg['legs'],legmasks):
        lay=rgba.copy(); lay[~m,3]=0; layers[key]=lay
        top=min(p[1] for p in poly); xs=[p[0] for p in poly if p[1]<=top+12]
        pivots[key]=((min(xs)+max(xs))/2,top)
    # crop to the animal
    A=rgba[...,3]>8
    ys,xs=np.where(A); bx0,bx1,by0,by1=max(0,xs.min()-4),min(W,xs.max()+5),max(0,ys.min()-4),min(H,ys.max()+2)
    bw,bh=bx1-bx0,by1-by0
    sc=OUT_H/bh; ow=round(bw*sc)
    meta={'w':ow,'h':OUT_H,'legs':[]}
    for k,lay in layers.items():
        img=Image.fromarray(lay[by0:by1,bx0:bx1],'RGBA')
        if cfg['flip']: img=img.transpose(Image.FLIP_LEFT_RIGHT)
        img=img.convert('RGBa').resize((ow,OUT_H),Image.LANCZOS).convert('RGBA')
        img.save(f'{SRC}out/{name}-{k}.webp','WEBP',quality=88,method=6)
    for key,ph,poly in cfg['legs']:
        px,py=pivots[key]; px-=bx0; py-=by0
        if cfg['flip']: px=bw-px
        meta['legs'].append({'k':key,'ph':'a' if key in ('fn','bf') else 'b','ox':round(100*px/bw,2),'oy':round(100*py/bh,2)})
    # debug: tint legs
    dbg=np.asarray(Image.fromarray(layers['body'][by0:by1,bx0:bx1])).copy()
    canvas=Image.new('RGBA',(bw,bh),(5,38,40,255)); canvas.alpha_composite(Image.fromarray(layers['body'][by0:by1,bx0:bx1]))
    tints={'bn':(255,60,60),'bf':(60,120,255),'fn':(60,220,90),'ff':(240,200,40)}
    for key,ph,poly in cfg['legs']:
        l=layers[key][by0:by1,bx0:bx1].copy().astype(np.float32)
        l[...,:3]=l[...,:3]*0.55+np.array(tints[key])*0.45
        canvas.alpha_composite(Image.fromarray(l.astype(np.uint8)))
    canvas.resize((bw//3,bh//3)).save(f'{SRC}out/dbg-{name}.png')
    bodyonly=Image.new('RGBA',(bw,bh),(5,38,40,255)); bodyonly.alpha_composite(Image.fromarray(layers['body'][by0:by1,bx0:bx1]))
    bodyonly.resize((bw//3,bh//3)).save(f'{SRC}out/dbgbody-{name}.png')
    return meta

import sys
only=sys.argv[1:] or list(PETS)
meta={n:process(n,PETS[n]) for n in only}
old=json.load(open(SRC+'out/meta.json')) if __import__('os').path.exists(SRC+'out/meta.json') else {}
old.update(meta); json.dump(old,open(SRC+'out/meta.json','w'),indent=1)
print(json.dumps(meta))

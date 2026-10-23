"""Build walking-pet layers from the user's 即梦 sheets (2560x1440: front view left, side view right).
Side view -> body + 4 legs, each leg split at the knee (upper / lower) so the paw can fold during the swing.
Front view -> one cut-out, same scale as the side view (shown when a pet is clicked).
All polygon coordinates are absolute pixel coords in the source sheet."""
import numpy as np, json, math, sys, os
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
import cv2

SRC = os.environ.get('PETS_SRC', '/tmp/claude-0/pets/')
OUT = os.environ.get('PETS_OUT', SRC + 'out2/')
OUT_H = 360            # px height of each side-view layer (CSS shows 60-104 px)
WM = (1990, 1262, 2540, 1420)   # "即梦AI" watermark box (abs coords)
K = 0.55               # ground speed, in "lanes" (Ubai's height) per second — app.js uses the same number
DUTY = 0.6             # fraction of the step cycle a paw is on the ground

def P(off, pts): return [(x + off, y) for x, y in pts]

PETS = {
 'kylin': dict(file='kylin.png', side=(1250, 2560), flip=True, seal=30, s=.6, a_ref=24,
   ink_only=P(1250, [(0,100),(150,100),(148,222),(93,266),(74,311),(61,366),(38,398),(0,398)]) and
            [P(1250, [(0,100),(150,100),(148,222),(93,266),(74,311),(61,366),(38,398),(0,398)]),
             P(1250, [(0,400),(36,400),(38,430),(45,457),(67,497),(100,518),(140,540),(0,560)])],
   wm_keep=[P(1250, [(740,1262),(806,1262),(806,1318),(740,1318)]),
            P(1250, [(782,1262),(950,1262),(950,1275),(912,1335),(880,1343),(800,1342),(782,1325)]),
            P(1250, [(948,1262),(1210,1262),(1210,1296),(948,1296)])],
   legs=[('ff', P(1250, [(225,960),(349,960),(349,1260),(300,1262),(300,1340),(240,1340),(245,1100)])),
         ('bf', P(1250, [(640,985),(735,960),(880,1105),(812,1250),(805,1320),(668,1320),(672,1240),(738,1232),(770,1112)])),
         ('fn', P(1250, [(349,960),(545,960),(500,1100),(475,1250),(472,1358),(298,1362),(300,1265),(349,1258)])),
         ('bn', P(1250, [(866,1110),(905,1110),(900,1180),(910,1255),(945,1270),(940,1350),(790,1350),(795,1262),(812,1250)]))],
   front=dict(x=(0, 1200), seal=30,
     ink_only=[[(470,430),(552,430),(552,497),(470,512)],
               [(1005,420),(1120,420),(1120,600),(1038,600),(1036,545),(1008,525)]])),
 'bear': dict(file='bear.png', side=(1250, 2560), flip=False, seal=12, s=.72, a_ref=22,
   wm_keep=[P(1250, [(740,1262),(772,1262),(772,1362),(740,1362)]),
            P(1250, [(785,1262),(948,1262),(948,1300),(928,1330),(798,1330),(785,1300)])],
   legs=[('bf', P(1250, [(322,990),(482,990),(437,1075),(440,1180),(492,1190),(492,1255),(330,1255),(290,1150),(290,1060)])),
         ('ff', P(1250, [(735,1000),(905,1000),(860,1240),(925,1250),(925,1335),(760,1335),(765,1100)])),
         ('bn', P(1250, [(140,945),(352,945),(322,1000),(290,1060),(290,1150),(320,1290),(140,1290)])),
         ('fn', P(1250, [(505,1000),(735,1000),(735,1275),(752,1290),(752,1360),(590,1360),(585,1270),(535,1256),(505,1100)]))],
   front=dict(x=(0, 1240), seal=12)),
 'sunny': dict(file='sunny2.png', side=(880, 2560), flip=False, seal=6, s=.58, a_ref=24,
   wm_keep=[[(1990,1262),(2042,1262),(2042,1352),(1990,1352)],
            [(2042,1262),(2125,1262),(2125,1310),(2042,1310)]],
   force_fg=[[(2044,1262),(2116,1262),(2116,1300),(2070,1300),(2044,1292)]],
   legs=[('bf', [(1397,905),(1490,905),(1475,960),(1372,1100),(1352,1200),(1410,1235),(1465,1265),(1465,1335),(1255,1335),(1252,1079)]),
         ('ff', [(1992,905),(2085,905),(2078,1230),(2125,1268),(2125,1330),(2044,1330),(2044,1270),(1992,1250)]),
         ('bn', [(1060,1030),(1293,1030),(1252,1079),(1252,1352),(1050,1352),(1062,1100)]),
         ('fn', [(1785,960),(1990,960),(1990,1250),(2042,1268),(2042,1352),(1840,1352),(1835,1250),(1790,1100)])],
   front=dict(x=(0, 880), seal=6)),
 'ubai': dict(file='ubai.png', side=(1250, 2560), flip=False, seal=4, s=1, a_ref=17, fold=.8,
   wm_keep=[P(1250, [(740,1262),(828,1262),(828,1300),(822,1336),(740,1340)])],
   legs=[('bf', P(1250, [(282,800),(383,800),(383,1150),(400,1205),(300,1205),(250,1150),(230,1000),(240,900)])),
         ('ff', P(1250, [(640,905),(785,905),(765,990),(757,1150),(835,1240),(835,1335),(660,1335),(652,1233),(643,1000)])),
         ('bn', P(1250, [(106,790),(282,790),(240,900),(230,1000),(250,1150),(250,1240),(70,1240),(78,1150),(92,1000),(100,900)])),
         ('fn', P(1250, [(383,880),(522,880),(500,990),(495,1067),(535,1283),(535,1365),(375,1365),(383,1275)]))],
   front=dict(x=(0, 1220), seal=4)),
}
DRAW_ORDER = ['ff', 'bf', 'fn', 'bn']   # far legs behind, near legs in front (drawn after the body)
KNEE = {'ff': .62, 'fn': .62, 'bf': .58, 'bn': .58}
FOLD = {'ff': 36, 'fn': 36, 'bf': 24, 'bn': 24}

def poly_mask(polys, off, W, H):
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    for poly in polys: d.polygon([(x - off, y) for x, y in poly], fill=255)
    return np.asarray(m) > 0

def cutout(region, off, seal, ink_only=(), wm_keep=None, force_fg=()):
    """region: HxWx3 int16 slice of the sheet; off: its x offset in the sheet. Returns RGBA float (0-255), fg mask."""
    im = region.copy(); H, W, _ = im.shape
    mx, mn = im.max(2), im.min(2); L = im.mean(2); sat = mx - mn
    box = np.zeros((H, W), bool)
    force_bg = np.zeros((H, W), bool); wm_ink = np.zeros((H, W), bool)
    if wm_keep is not None:
        x0, y0, x1, y1 = WM
        a, b = max(0, x0 - off), max(0, min(W, x1 - off))
        if b > a:
            box[y0:y1, a:b] = True
            keep = poly_mask(wm_keep, off, W, H)
            wm_ink = box & keep & (sat < 16) & (L < 238)
            force_bg = box & ~keep
    dark = (L < 150) | wm_ink
    R = seal
    ink = ndi.binary_dilation(dark, structure=ndi.generate_binary_structure(2, 1), iterations=R) if R <= 4 \
        else (ndi.distance_transform_edt(~dark) <= R)
    bright = (mn > 226) & (sat < 18)
    lab, _ = ndi.label(bright & ~ink)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg0 = np.isin(lab, list(border))
    soft = (mn > 200) & (sat < 26)
    if R <= 4:
        bg = ndi.binary_dilation(bg0, iterations=6) & soft
    else:
        bg = bg0.copy()
        for _ in range(R + 3): bg = ndi.binary_dilation(bg) & (soft | bg0)
    bg |= bg0
    fg = ~bg & ~force_bg
    ff = poly_mask(force_fg, off, W, H) if force_fg else np.zeros((H, W), bool)
    fg |= ff
    lab2, n = ndi.label(fg); sizes = ndi.sum(fg, lab2, range(1, n + 1))
    keepc = np.zeros(n + 1, bool); keepc[1 + np.argmax(sizes)] = True; keepc[1:][sizes > 4000] = True
    fg = keepc[lab2]
    rgb = im.astype(np.float32)
    if ff.any():   # repaint watermark streaks inside forced paws
        m = (ff & (sat < 22) & (L > 196)).astype(np.uint8) * 255
        rgb = cv2.inpaint(np.clip(rgb, 0, 255).astype(np.uint8), m, 6, cv2.INPAINT_TELEA).astype(np.float32)
    # thicken ink a little so lines survive downscaling
    inkmask = (L < 120) & fg
    thick = ndi.binary_dilation(inkmask, iterations=2) & fg & ~inkmask
    if thick.any():
        rgb[thick] = np.stack([ndi.grey_erosion(im[..., c], size=5) for c in range(3)], -1)[thick]
    dist = ndi.distance_transform_edt(fg)
    alpha = fg.astype(np.float32)
    band = fg & ((dist <= 3) | (box & (dist <= 7)))
    Lb = rgb.mean(2)
    a = np.clip((255 - Lb) / (255 - 70), 0, 1)
    alpha[band] = np.maximum(a[band], np.where((dist[band] > 2.5) & ~box[band], 1, 0))
    with np.errstate(divide='ignore', invalid='ignore'):
        un = (rgb - (1 - alpha[..., None]) * 255) / np.maximum(alpha[..., None], 1e-3)
    rgb = np.where(band[..., None], np.clip(un, 0, 255), rgb)
    for poly in ink_only:   # whiskers: keep only the lines, not the paper between them
        z = poly_mask([poly], off, W, H) & fg
        az = np.clip((230 - L) / (230 - 60), 0, 1).astype(np.float32)
        alpha[z] = az[z]
        with np.errstate(divide='ignore', invalid='ignore'):
            unz = (im.astype(np.float32) - (1 - az[..., None]) * 255) / np.maximum(az[..., None], 1e-3)
        rgb[z] = np.clip(unz, 0, 255)[z]
    return np.dstack([np.clip(rgb, 0, 255), alpha * 255]), fg

def save(arr, box, size, flip, path):
    x0, y0, x1, y1 = box
    img = Image.fromarray(arr[y0:y1, x0:x1].astype(np.uint8), 'RGBA')
    if flip: img = img.transpose(Image.FLIP_LEFT_RIGHT)
    img.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA').save(path, 'WEBP', quality=88, method=6)

def process(name, cfg):
    sheet = np.asarray(Image.open(SRC + cfg['file']).convert('RGB')).astype(np.int16)
    sx0, sx1 = cfg['side']
    rgba, fg = cutout(sheet[:, sx0:sx1], sx0, cfg['seal'], cfg.get('ink_only', ()), cfg.get('wm_keep', []), cfg.get('force_fg', ()))
    H, W = fg.shape
    legs = {k: poly for k, poly in cfg['legs']}
    masks = {k: poly_mask([poly], sx0, W, H) for k, poly in legs.items()}
    union = np.zeros((H, W), bool)
    for m in masks.values(): union |= m
    body_keep = ~union
    for k, poly in legs.items():
        top = min(p[1] for p in poly); rows = np.zeros((H, W), bool); rows[top:top + 32] = True
        body_keep |= masks[k] & rows
    body = rgba.copy(); body[~body_keep, 3] = 0
    bl, bn = ndi.label(body[..., 3] > 0)
    if bn > 1:
        bs = ndi.sum(np.ones_like(bl), bl, range(1, bn + 1)); small = np.zeros(bn + 1, bool); small[1:] = bs < 600
        body[small[bl], 3] = 0
    A = rgba[..., 3] > 8; ys, xs = np.where(A)
    bx0, bx1, by0, by1 = max(0, xs.min() - 4), min(W, xs.max() + 5), max(0, ys.min() - 4), min(H, ys.max() + 2)
    bw, bh = bx1 - bx0, by1 - by0
    sc = OUT_H / bh; ow = round(bw * sc); size = (ow, OUT_H); flip = cfg['flip']
    def fx(x): return (bw - (x - bx0)) if flip else (x - bx0)    # x in output-frame source px
    save(body, (bx0, by0, bx1, by1), size, flip, f'{OUT}{name}-body.webp')
    meta = {'w': ow, 'h': OUT_H, 's': cfg['s'], 'legs': []}
    for k in DRAW_ORDER:
        poly = legs[k]; m = masks[k]
        lay = rgba.copy(); lay[~m, 3] = 0
        top = min(p[1] for p in poly)
        xs_top = [p[0] - sx0 for p in poly if p[1] <= top + 12]
        hip = ((min(xs_top) + max(xs_top)) / 2, top)
        la = lay[..., 3] > 40
        rows = np.where(la.any(1))[0]; bottom = rows.max()
        ky = int(round(top + KNEE[k] * (bottom - top)))
        cols = np.where(la[ky])[0]; kx = (cols.min() + cols.max()) / 2
        # round knee: both halves share a disc centred on the knee, so the folding lower leg never shows a cut corner
        r = (cols.max() - cols.min()) / 2 + 3
        yy, xx = np.ogrid[:H, :W]
        disc = (yy - ky) ** 2 + (xx - kx) ** 2 <= r * r
        above = np.zeros((H, W), bool); above[:ky] = True
        up = lay.copy(); up[~(above | disc), 3] = 0
        lo = lay.copy(); lo[above & ~disc, 3] = 0
        save(up, (bx0, by0, bx1, by1), size, flip, f'{OUT}{name}-{k}-u.webp')
        save(lo, (bx0, by0, bx1, by1), size, flip, f'{OUT}{name}-{k}-l.webp')
        meta['legs'].append({'k': k, 'ox': round(100 * fx(hip[0] + sx0 - sx0 + 0) / bw if not flip else 100 * (bw - (hip[0] - bx0)) / bw, 2),
                             'oy': round(100 * (hip[1] - by0) / bh, 2),
                             'kx': round(100 * ((bw - (kx - bx0)) if flip else (kx - bx0)) / bw, 2),
                             'ky': round(100 * (ky - by0) / bh, 2),
                             'L': (bottom - hip[1]) / bh})
    # fix ox for non-flipped (fx above handles both, keep simple)
    for l, k in zip(meta['legs'], DRAW_ORDER):
        poly = legs[k]; top = min(p[1] for p in poly); xs_top = [p[0] - sx0 for p in poly if p[1] <= top + 12]
        hx = (min(xs_top) + max(xs_top)) / 2
        l['ox'] = round(100 * ((bw - (hx - bx0)) if flip else (hx - bx0)) / bw, 2)
    # gait: pick the cycle so the reference (longest front) leg swings a_ref degrees, then match every leg's stride
    s = cfg['s']; Lref = max(l['L'] for l in meta['legs'] if l['k'] in ('ff', 'fn'))
    period = 2 * Lref * s * math.sin(math.radians(cfg['a_ref'])) / (DUTY * K)
    d = period * DUTY * K
    for l in meta['legs']:
        l['a'] = round(min(cfg['a_ref'] + 5, math.degrees(math.asin(min(.95, d / (2 * l['L'] * s))))), 1)
        l['f'] = round(FOLD[l['k']] * cfg.get('fold', 1))
        del l['L']
    meta['t'] = round(period, 3)
    # body debug
    dbg = Image.new('RGBA', size, (5, 38, 40, 255))
    for f in [f'{name}-{k}-u' for k in ('ff', 'bf')] + [f'{name}-{k}-l' for k in ('ff', 'bf')] + [f'{name}-body'] + \
             [f'{name}-{k}-l' for k in ('fn', 'bn')] + [f'{name}-{k}-u' for k in ('fn', 'bn')]:
        dbg.alpha_composite(Image.open(f'{OUT}{f}.webp'))
    dbg.save(f'{OUT}dbg-{name}.png')
    # front view, same scale
    fc = cfg['front']; fx0, fx1 = fc['x']
    frgba, ffg = cutout(sheet[:, fx0:fx1], fx0, fc['seal'], fc.get('ink_only', ()))
    A = frgba[..., 3] > 8; ys, xs = np.where(A)
    b = (max(0, xs.min() - 4), max(0, ys.min() - 4), min(ffg.shape[1], xs.max() + 5), min(ffg.shape[0], ys.max() + 2))
    fsize = (round((b[2] - b[0]) * sc), round((b[3] - b[1]) * sc))
    save(frgba, b, fsize, False, f'{OUT}{name}-front.webp')
    meta['front'] = {'w': fsize[0], 'h': fsize[1]}
    dbgf = Image.new('RGBA', fsize, (5, 38, 40, 255)); dbgf.alpha_composite(Image.open(f'{OUT}{name}-front.webp')); dbgf.save(f'{OUT}dbgf-{name}.png')
    return meta

if __name__ == '__main__':
    only = sys.argv[1:] or list(PETS)
    path = OUT + 'meta.json'
    meta = json.load(open(path)) if os.path.exists(path) else {}
    for n in only: meta[n] = process(n, PETS[n]); print(n, json.dumps(meta[n]))
    json.dump(meta, open(path, 'w'), indent=1)

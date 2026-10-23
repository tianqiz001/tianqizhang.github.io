"""Split each {name}-front.webp into a top part and left/right leg halves so the facing pet can mark time in place.
Writes {name}-front-t.webp, -fl.webp, -fr.webp and prints the band/split positions (percent) for index.html."""
import numpy as np, json, sys
from PIL import Image
D = sys.argv[1] if len(sys.argv) > 1 else 'assets/pets/'
BAND = .8          # legs = bottom 20% of the front view
out = {}
for n in ['kylin', 'bear', 'sunny', 'ubai']:
    im = np.asarray(Image.open(f'{D}{n}-front.webp').convert('RGBA')).copy()
    H, W, _ = im.shape
    by = int(H * BAND)
    a = im[..., 3] > 40
    xs = np.where(a[H - int(H * .08):].any(0))[0]          # paws on the ground
    cx = int(np.median(xs))
    top = im.copy(); top[by + 4:, :, 3] = 0                 # 4px overlap hides the seam
    l = im.copy(); l[:by, :, 3] = 0; l[:, cx:, 3] = 0
    r = im.copy(); r[:by, :, 3] = 0; r[:, :cx, 3] = 0
    for k, arr in (('t', top), ('fl', l), ('fr', r)):
        Image.fromarray(arr, 'RGBA').save(f'{D}{n}-front-{k}.webp', 'WEBP', quality=88, method=6)
    out[n] = {'band': round(100 * by / H, 2)}
print(json.dumps(out))

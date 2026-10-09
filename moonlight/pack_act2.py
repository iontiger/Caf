"""2막 그림을 게임용 아틀라스로 묶는다.

박선규가 올린 원본(적 6명의 PNG+JSON 아틀라스, 주인공 모션 24장)을 받아
assets/act2-enemies.webp, assets/hero-motion.webp, assets/act2-frames.json을 만든다.

- 적 아틀라스는 프레임 사각형이 서로 겹칠 수 있어 JSON의 clipPolygon으로 잘라 낸 뒤 다시 배치한다.
  그래서 게임에서는 클리핑 없이 사각형만 그리면 된다.
- 주인공 모션 시트는 격자가 고르지 않아 알파 실루엣의 연결 영역으로 24장을 찾는다.
  윗줄부터 달리기 6장, 점프 6장, 오르기 12장 순서다.

사용법: python3 pack_act2.py <enemy-atlases 폴더> <hero-motion.png>
필요한 것: Pillow, numpy, scipy
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).parent
ENEMIES = ['kettle', 'postman', 'sailor', 'photographer', 'illusionist', 'mechanic']
ENEMY_SCALE = 0.6
HERO_SCALE = 0.5
STATES = ['idle', 'walk', 'attack', 'hurt', 'death']


def trim(img, px, py):
    box = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if not box:
        return img, px, py
    return img.crop(box), px - box[0], py - box[1]


def shelf_pack(images, width=2048, pad=2):
    x = y = row = 0
    spots = []
    for im in images:
        if x + im.width + pad > width:
            x, y, row = 0, y + row + pad, 0
        spots.append((x, y))
        x += im.width + pad
        row = max(row, im.height)
    sheet = Image.new('RGBA', (width, y + row), (0, 0, 0, 0))
    for im, (sx, sy) in zip(images, spots):
        sheet.paste(im, (sx, sy))
    return sheet, spots


def enemy_frames(folder):
    pieces, index = [], {}
    for name in ENEMIES:
        data = json.loads((folder / f'enemy-{name}.json').read_text())
        sheet = Image.open(folder / data['meta']['image']).convert('RGBA')
        info = {'standing': round(data['meta']['standingHeight'] * ENEMY_SCALE, 1), 'anims': {}}
        for state in STATES:
            anim = data['animations'][state]
            info['anims'][state] = {'fps': anim['fps'], 'loop': anim['loop'], 'frames': []}
            for key in anim['frames']:
                f = data['frames'][key]
                r = f['frame']
                crop = sheet.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
                mask = Image.new('L', crop.size, 0)
                ImageDraw.Draw(mask).polygon([tuple(p) for p in f['clipPolygon']], fill=255)
                alpha = Image.fromarray(np.minimum(np.array(crop.getchannel('A')), np.array(mask)))
                crop.putalpha(alpha)
                size = (max(1, round(crop.width * ENEMY_SCALE)), max(1, round(crop.height * ENEMY_SCALE)))
                crop = crop.resize(size, Image.LANCZOS)
                crop, px, py = trim(crop, f['pivotPx']['x'] * ENEMY_SCALE, f['pivotPx']['y'] * ENEMY_SCALE)
                info['anims'][state]['frames'].append(len(pieces))
                pieces.append((crop, px, py))
        index[name] = info
    return pieces, index


def hero_frames(path):
    sheet = Image.open(path).convert('RGBA')
    solid = np.array(sheet.getchannel('A')) > 40
    labels, count = ndimage.label(ndimage.binary_dilation(solid, iterations=1))
    sizes = ndimage.sum(solid, labels, range(1, count + 1))
    boxes = [(i + 1, s) for i, s in enumerate(ndimage.find_objects(labels)) if sizes[i] > 3000]
    if len(boxes) != 24:
        raise SystemExit(f'주인공 모션 24장을 기대했는데 {len(boxes)}장을 찾았습니다.')
    # 줄은 위에서부터, 같은 줄에서는 왼쪽부터. 줄 구분은 아래쪽 끝(발)의 높이로 한다.
    boxes.sort(key=lambda b: (round(b[1][0].stop / 256), b[1][1].start))
    alpha = np.array(sheet.getchannel('A'))
    pieces = []
    for label, (ys, xs) in boxes:
        own = ndimage.binary_dilation(labels[ys, xs] == label, iterations=3)
        crop = sheet.crop((xs.start, ys.start, xs.stop, ys.stop))
        crop.putalpha(Image.fromarray(np.where(own, alpha[ys, xs], 0).astype(np.uint8)))
        size = (round(crop.width * HERO_SCALE), round(crop.height * HERO_SCALE))
        crop = crop.resize(size, Image.LANCZOS)
        # 발 아래 가운데를 기준점으로 삼는다.
        pieces.append(trim(crop, crop.width / 2, crop.height))
    return pieces


def write_sheet(pieces, out):
    sheet, spots = shelf_pack([p[0] for p in pieces])
    sheet.save(out, 'WEBP', quality=86, method=6)
    return [[x, y, p[0].width, p[0].height, round(p[1], 1), round(p[2], 1)] for p, (x, y) in zip(pieces, spots)]


def main():
    folder, hero = Path(sys.argv[1]), Path(sys.argv[2])
    pieces, enemies = enemy_frames(folder)
    enemy_rects = write_sheet(pieces, ROOT / 'assets/act2-enemies.webp')
    hero_rects = write_sheet(hero_frames(hero), ROOT / 'assets/hero-motion.webp')
    frames = {'enemies': {'rects': enemy_rects, 'chars': enemies}, 'hero': hero_rects}
    (ROOT / 'assets/act2-frames.json').write_text(json.dumps(frames, ensure_ascii=False, separators=(',', ':')))
    for f in ['act2-enemies.webp', 'hero-motion.webp', 'act2-frames.json']:
        print(f, (ROOT / 'assets' / f).stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()

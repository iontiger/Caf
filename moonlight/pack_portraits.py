"""2막 대화 장면의 초상화를 만든다.

박선규가 올린 주민 여섯 명 그림(3열 2줄, 1536x1024)과 1막 주인공 아틀라스의 서 있는 자세를 잘라
assets/portraits/<이름>.webp로 저장한다.

사용법: python3 pack_portraits.py <villagers-six.png>
필요한 것: Pillow, numpy, scipy
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).parent
GRID = [['kettle', 'postman', 'mechanic'], ['sailor', 'illusionist', 'photographer']]
HEIGHT = 480


def trim(img):
    # 옆 칸 그림의 조각이 섞여 들어오지 않게, 가장 큰 덩어리의 일부가 아닌 작은 조각은 지운다
    alpha = np.array(img.getchannel('A'))
    labels, count = ndimage.label(alpha > 8)
    if count > 1:
        sizes = ndimage.sum(alpha > 8, labels, range(1, count + 1))
        keep = np.isin(labels, [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.02])
        img.putalpha(Image.fromarray(np.where(keep, alpha, 0).astype(np.uint8)))
    box = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    return img.crop(box) if box else img


def save(img, name):
    img = trim(img)
    if img.height > HEIGHT:
        img = img.resize((round(img.width * HEIGHT / img.height), HEIGHT), Image.LANCZOS)
    out = ROOT / 'assets/portraits' / f'{name}.webp'
    img.save(out, 'WEBP', quality=86, method=6)
    print(name, img.size, out.stat().st_size // 1024, 'KB')


def main():
    (ROOT / 'assets/portraits').mkdir(exist_ok=True)
    sheet = Image.open(sys.argv[1]).convert('RGBA')
    cw, ch = sheet.width // 3, sheet.height // 2
    for row, names in enumerate(GRID):
        for col, name in enumerate(names):
            save(sheet.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch)), name)
    # 주인공은 1막 아틀라스의 다섯 번째 칸(서 있는 자세, 오른쪽을 본다)
    x0, y0, x1, y1 = json.loads((ROOT / 'assets/atlas-frames.json').read_text())['hero-atlas'][4]
    save(Image.open(ROOT / 'assets/hero-atlas.png').convert('RGBA').crop((x0, y0, x1, y1)), 'hero')


if __name__ == '__main__':
    main()

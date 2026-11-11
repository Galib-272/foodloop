"""Draws a realistic donor note (scanned/photographed paper) used by `npm run test:ocr`. Run once: python3 scripts/fixtures/make-ocr-label.py"""
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

random.seed(7)
LINES = ['Biryani House - surplus food', '20 boxes of chicken biryani', 'Ready at 8pm, good until 11pm',
         'Keep in the fridge', 'Contains: nuts', 'Call 01712-345678']
W, H = 900, 520
img = Image.new('L', (W, H), 236)
px = img.load()
for _ in range(9000):                               # paper grain
    x, y = random.randrange(W), random.randrange(H)
    px[x, y] = max(0, px[x, y] - random.randint(10, 35))
d = ImageDraw.Draw(img)
bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 40)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 36)
for i, line in enumerate(LINES):
    d.text((60, 50 + i * 72), line, fill=25, font=bold if i == 0 else font)
img = img.rotate(-2.0, resample=Image.BICUBIC, fillcolor=236).filter(ImageFilter.GaussianBlur(0.7))
out = Path(__file__).with_name('ocr-donor-note.png')
img.convert('RGB').save(out, optimize=True)
print(f'[fixture] {out} ({out.stat().st_size // 1024} KB)')

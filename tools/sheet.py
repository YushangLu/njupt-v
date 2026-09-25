"""Tile frames into a labelled contact sheet: sheet.py out.png cols f1 f2 ..."""
import sys
from PIL import Image, ImageDraw, ImageFont

out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
tw, th = 480, 270
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * th), "black")
font = ImageFont.truetype(".cache/fonts/JetBrainsMono-700.ttf", 18)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((tw, th), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    label = f.split("/")[-1][1:-4].lstrip("0") + "s"
    d.rectangle([4, 4, 12 + 11 * len(label), 30], fill=(0, 0, 0))
    d.text((8, 6), label, fill=(255, 230, 0), font=font)
    sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
sheet.save(out)
print(out)

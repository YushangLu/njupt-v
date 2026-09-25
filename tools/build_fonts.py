"""Subset the web fonts to exactly the glyphs the animation uses.

Full CJK fonts are ~10 MB each; the subsets are a few hundred KB, small enough
to commit. Source TTFs are fetched by tools/fetch_fonts.sh into .cache/fonts.
"""
import pathlib
import string
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
CACHE = ROOT / ".cache" / "fonts"
OUT = SRC / "fonts"

chars = set(string.printable)
for p in list(SRC.rglob("*.js")) + list(SRC.rglob("*.html")) + list(SRC.rglob("*.css")):
    if "vendor" in p.parts:
        continue
    chars |= set(p.read_text(encoding="utf-8"))
chars |= set("·—–−‰°′″“”‘’《》，。、：；！？（）▸●…")
text = "".join(sorted(c for c in chars if c.isprintable()))

OUT.mkdir(parents=True, exist_ok=True)
for ttf in sorted(CACHE.glob("*.ttf")):
    if ttf.stem.startswith(("ZhiMangXing", "LiuJianMaoCao")):
        continue
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    font = TTFont(ttf)
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    out = OUT / (ttf.stem + ".woff2")
    font.flavor = "woff2"
    font.save(out)
    print(f"{out.name:28s} {out.stat().st_size/1024:8.1f} KB")

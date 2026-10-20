"""
Barlow has no peso sign (U+20B1). Left alone, every "₱" on the dashboard would
fall back to a system font and look pasted in. This builds a one-glyph font per
weight from Barlow's own P plus two crossbars at its stroke weight, and
src/styles/fonts.css loads it with unicode-range: U+20B1 under the same family
name — so the browser draws ₱ in Barlow's design.

    python scripts/build-peso-glyph.py

Needs fontTools (pip install fonttools). Output is committed; rerun only if the
weights in fonts.css change.
"""
from pathlib import Path

from fontTools import subset
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "node_modules" / "@fontsource"
OUT = ROOT / "src" / "assets" / "fonts"

FACES = [
    ("barlow", 400),
    ("barlow", 500),
    ("barlow", 600),
    ("barlow", 700),
    ("barlow-semi-condensed", 500),
    ("barlow-semi-condensed", 600),
]

PESO = 0x20B1


def build(family: str, weight: int) -> Path:
    font = TTFont(SOURCES / family / "files" / f"{family}-latin-{weight}-normal.woff")
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    glyf = font["glyf"]
    cap = font["OS/2"].sCapHeight or 700

    p_name = cmap[ord("P")]
    p = glyf[p_name]
    p_advance, p_lsb = font["hmtx"][p_name]
    i = glyf[cmap[ord("I")]]
    stem = i.xMax - i.xMin  # vertical stem width at this weight

    bar = round(stem * 0.78)  # horizontals are a touch lighter than stems
    reach = round(stem * 0.95)  # how far the bars poke out left of the stem

    pen = TTGlyphPen(glyphs)
    glyphs[p_name].draw(TransformPen(pen, (1, 0, 0, 1, reach, 0)))

    left = p_lsb
    right = p.xMax + reach
    for centre in (0.79 * cap, 0.58 * cap):
        y0, y1 = round(centre - bar / 2), round(centre + bar / 2)
        # Clockwise, like TrueType outer contours, so the overlap fills solid.
        pen.moveTo((left, y0))
        pen.lineTo((left, y1))
        pen.lineTo((right, y1))
        pen.lineTo((right, y0))
        pen.closePath()

    glyph = pen.glyph()
    glyph.recalcBounds(glyf)
    font.setGlyphOrder(font.getGlyphOrder() + ["peso"])
    glyf["peso"] = glyph
    font["hmtx"]["peso"] = (p_advance + reach, p_lsb)
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[PESO] = "peso"

    options = subset.Options()
    options.flavor = "woff"
    options.layout_features = []
    options.name_IDs = ["*"]
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=[PESO])
    subsetter.subset(font)

    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f"{family}-peso-{weight}.woff"
    font.flavor = "woff"
    font.save(target)
    return target


if __name__ == "__main__":
    for family, weight in FACES:
        path = build(family, weight)
        print(f"{path.relative_to(ROOT)}  {path.stat().st_size} bytes")

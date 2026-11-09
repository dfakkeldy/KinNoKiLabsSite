"""Trace the KinNoKi circuit tree (gold left, silver right) from
Resources/logo.png into flat SVGs in several saturated colour schemes.

  python3 docs/brand/kinnoki-tree/trace_tree.py [out_dir]

Needs numpy, Pillow, contourpy and shapely. Writes one SVG per scheme in
SCHEMES; edit the hex values there to add or change a scheme."""
import sys
from pathlib import Path

import numpy as np
import contourpy
from PIL import Image, ImageFilter
from shapely import affinity
from shapely.geometry import Polygon, MultiPolygon, Point
from shapely.ops import unary_union

SRC = Path(__file__).resolve().parents[3] / "Resources/logo.png"
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent)
TREE_ROWS = (140, 722)  # the tree; the "KinNoKi Labs" text starts at 740

im = Image.open(SRC).convert("RGB")
a = np.asarray(im).astype(float)
y0, y1 = TREE_ROWS
a = a[y0:y1]
v = a.max(2)
# Warmth (red minus blue) tells gold from silver even in gold's pale highlights.
sat = (a[:, :, 0] - a[:, :, 2]) / np.maximum(v, 1)

# Smooth brightness a touch so traced edges are clean, not pixel-stepped.
vs = np.asarray(Image.fromarray(v.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(float)
ink = (v > 125).astype(float)
# Gold-ness: saturation averaged over nearby ink only, so dark gaps don't dilute it.
def blur(z, r):
    k = np.exp(-0.5 * (np.arange(-3 * r, 3 * r + 1) / r) ** 2)
    k /= k.sum()
    z = np.apply_along_axis(lambda row: np.convolve(row, k, mode="same"), 1, z)
    return np.apply_along_axis(lambda col: np.convolve(col, k, mode="same"), 0, z)
# Colour from trace centres only: the edges carry a warm fringe from the 3D sides.
core = (np.asarray(Image.fromarray((ink * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))) > 0).astype(float)
g = blur(sat * core, 8) / np.maximum(blur(core, 8), 1e-3)
g[blur(core, 8) < 0.01] = 0.15  # far from any trace: undecided
# Left half is gold, right half silver: colour decides only near the trunk,
# so warm reflections on the silver side don't turn into gold flecks.
xs = np.arange(v.shape[1])[None, :]
g = g + 0.0006 * (512 - xs)


def filled(z, lo, hi=1e9):
    gen = contourpy.contour_generator(z=np.pad(z, 2, constant_values=lo - 1), fill_type="OuterOffset")
    pts, offs = gen.filled(lo, hi)
    polys = []
    for p, o in zip(pts, offs):
        rings = [p[o[i]:o[i + 1]] - 2 for i in range(len(o) - 1)]
        if len(rings[0]) >= 4:
            polys.append(Polygon(rings[0], [r for r in rings[1:] if len(r) >= 4]).buffer(0))
    return unary_union(polys)


up = lambda z: np.asarray(Image.fromarray(z.astype(np.float32), mode="F").resize((z.shape[1] * 2, z.shape[0] * 2), Image.BICUBIC))
half = lambda geom: affinity.scale(geom, 0.5, 0.5, origin=(0, 0))
tree = half(filled(up(vs), 125))
tree = unary_union([p for p in getattr(tree, "geoms", [tree]) if p.area > 6])  # drop specks
goldzone = half(filled(up(g), 0.15))
gold = tree.intersection(goldzone)
silver = tree.difference(goldzone)
# Small islands of one metal on the other metal's side are reflections, not design.
parts = lambda geom: [p for p in getattr(geom, "geoms", [geom]) if p.geom_type == "Polygon"]
stray_g = [p for p in parts(gold) if p.area < 600 and p.centroid.x > 505]
stray_s = [p for p in parts(silver) if p.area < 600 and p.centroid.x < 515]
gold = unary_union([p for p in parts(gold) if p not in stray_g] + stray_s)
silver = unary_union([p for p in parts(silver) if p not in stray_s] + stray_g)
# Thin slivers along the seam: open each metal; what falls off joins the other.
for _ in range(2):
    g_open = gold.buffer(-1.2).buffer(1.2)
    silver = unary_union([silver, gold.difference(g_open)]); gold = g_open.intersection(tree)
    s_open = silver.buffer(-1.2).buffer(1.2)
    gold = unary_union([gold, silver.difference(s_open)]).intersection(tree); silver = s_open.intersection(tree)
print("reassigned", len(stray_g), "gold and", len(stray_s), "silver islands")
clean = lambda geom: geom.buffer(0.35).buffer(-0.35).simplify(0.35)
tree = clean(tree)
gold, silver = clean(gold.intersection(tree)), clean(silver.intersection(tree))
print("tree parts", len(getattr(tree, "geoms", [tree])), "bounds", [round(b) for b in tree.bounds])


def d_of(geom):
    out = []
    for p in getattr(geom, "geoms", [geom]):
        if p.is_empty or p.geom_type != "Polygon":
            continue
        for ring in [p.exterior, *p.interiors]:
            c = list(ring.coords)
            out.append("M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in c[:-1]) + "Z")
    return "".join(out)


def bevel(region, s):
    """Flat two-tone metal: a light rim on the upper-left edges and a dark rim
    on the lower-right, by subtracting shifted copies."""
    hi = region.difference(affinity.translate(region, s, s))
    lo = region.difference(affinity.translate(region, -s, -s))
    return hi.simplify(0.3), lo.simplify(0.3)


SCHEMES = {
    "money-bin": dict(gold=("#FFC000", "#FFE95C", "#C97A00"), silver=("#D3DDE8", "#FFFFFF", "#7E8DA3"),
                      outline="#2A1800", bg=None),
    "vault-navy": dict(gold=("#FFC800", "#FFF27A", "#D08600"), silver=("#DCE6F1", "#FFFFFF", "#8494AD"),
                       outline="#060C22", bg=("#0B1638", "#FFC800")),
    "doubloon-black": dict(gold=("#FFB000", "#FFDD4A", "#B56500"), silver=("#C2CEDB", "#F8FBFD", "#6C7A8F"),
                           outline="#000000", bg=("#0A0A0A", "#C2CEDB")),
    "emerald-vault": dict(gold=("#FFD000", "#FFF280", "#CC8C00"), silver=("#E1E8EF", "#FFFFFF", "#8A97A9"),
                          outline="#04301E", bg=("#0A5C3A", "#FFD000")),
}

x0, y0b, x1, y1b = tree.bounds
cx, cy = (x0 + x1) / 2, (y0b + y1b) / 2
OUTLINE = 4.0
s = 1.6
ghi, glo = bevel(gold, s)
shi, slo = bevel(silver, s)
outline_shape = tree.buffer(OUTLINE, quad_segs=6).buffer(-0.5).buffer(0.5).simplify(0.4)

for name, c in SCHEMES.items():
    parts = []
    if c["bg"]:
        r = max(x1 - x0, y1b - y0b) / 2 + 26
        vb = (cx - r - 4, cy - r - 4, 2 * r + 8, 2 * r + 8)
        parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{c["bg"][0]}"/>')
        parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r - 7:.1f}" fill="none" stroke="{c["bg"][1]}" stroke-width="4"/>')
    else:
        pad = OUTLINE + 4
        vb = (x0 - pad, y0b - pad, x1 - x0 + 2 * pad, y1b - y0b + 2 * pad)
    parts.append(f'<path fill="{c["outline"]}" fill-rule="evenodd" d="{d_of(outline_shape)}"/>')
    for region, hi, lo, (base, light, dark) in ((gold, ghi, glo, c["gold"]), (silver, shi, slo, c["silver"])):
        parts.append(f'<path fill="{base}" fill-rule="evenodd" d="{d_of(region)}"/>')
        parts.append(f'<path fill="{light}" fill-rule="evenodd" d="{d_of(hi)}"/>')
        parts.append(f'<path fill="{dark}" fill-rule="evenodd" d="{d_of(lo)}"/>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb[0]:.1f} {vb[1]:.1f} {vb[2]:.1f} {vb[3]:.1f}">\n'
           + "\n".join(parts) + "\n</svg>\n")
    p = OUT / f"kinnoki-tree-{name}.svg"
    p.write_text(svg)
    print(p.name, f"{len(svg) // 1024} KB")

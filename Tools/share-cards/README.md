# Share cards

HTML sources for the 1200x630 social preview images. Open a file in Chrome
(it loads Lexend from Google Fonts), render it in a 1200x630 viewport at
device scale 1, and save the screenshot as PNG.

| Source | Output |
| --- | --- |
| `og-default.html` | `Resources/images/og-default.png` (fallback for pages without their own image) |
| `games.html` | `Resources/images/games/og.png` (Arcade Hall and every game page) |

`Tests/games/routes.test.mjs` pins the games card's size and hash; update it
when the card changes.

`Resources/fishing/og.png` and `Resources/images/taxsale/og.png` were patched
from earlier raster art on 2026-10-28 (new text panel on the fishing card; the
book cover over the placeholder panels and VIDEO removed on the tax-sale
card), so they have no HTML source here.

# Web Utilities ("Tools") Design

**Date:** 2026-07-18
**Status:** Approved design, pre-implementation
**Route:** `/tools` hub + seven tool pages

## Purpose

A brand/portfolio showcase in the same spirit as the Arcade Hall: privacy-first,
offline-capable, accessible utilities that demonstrate KinNoKi Labs craft. Every
tool runs entirely in the browser — files, text, and colors never leave the
device. Mobile-friendly throughout.

## Tool lineup (v1)

| Route | Tool | Size |
|---|---|---|
| `/tools/qr-code` | QR code generator | medium |
| `/tools/epub-reader` | EPUB reader with on-device library | large |
| `/tools/dilution` | Dilution calculator (3 modes) | small |
| `/tools/contrast` | WCAG contrast checker | small |
| `/tools/word-count` | Word counter + reading time | small |
| `/tools/unit-converter` | Unit converter | small |
| `/tools/passphrase` | Passphrase generator | small |

## Architecture

**Pattern:** the Arcade Hall pattern, mirrored exactly.

- `Content/tools.md` (hub meta) + `Content/tools/<slug>.md` stubs supply
  title/description/og meta per page. `tools` is *not* a `SectionID`; the pages
  are free-form Pages the theme recognizes by path, like `Content/games/`.
- `KinNoKiTheme.swift` gains `toolsMain(page:)` plus `makePageHTML` cases for
  `tools` and each `tools/<slug>`, following the existing explicit-case style.
  Each page emits the shared chrome, a `#tools-app` container, an `aria-live`
  region, and `<script defer>` tags for **only that tool's** JS
  (`core.js` + `<slug>.js` + `<slug>-ui.js`; hub loads `hub-ui.js`).
- Nav gains a **Tools** link between Games and Services (desktop + mobile menu).

**Files under `Resources/tools/`:**

| File | Role |
|---|---|
| `core.js` | Shared: namespaced `localStorage` prefs (`kinnoki-tools:*`), clipboard helper, live-region announcer, locale-tolerant number parsing, SW registration |
| `sw.js` | Section-scoped service worker (see Offline) |
| `manifest.webmanifest` | PWA manifest (see Offline) |
| `hub-ui.js` | Hub-only behavior: offline chip + "available offline" state on cards once the SW has precached |
| `<slug>.js` / `<slug>-ui.js` | DOM-free engine / thin DOM controller, per tool |
| `epub-store.js` | IndexedDB wrapper for the EPUB library |
| `wordlist.js` | EFF large wordlist data (attributed) for passphrases |

**Dependency policy:** zero third-party code, matching the rest of the site.
The QR encoder is implemented in-repo; EPUB unzipping uses the browser-native
`DecompressionStream('deflate-raw')`.

## Tool specifications

### QR code generator

- Engine: full QR model 2 spec — byte mode, EC levels L/M/Q/H (default M),
  automatic smallest-version selection through version 40, Reed–Solomon,
  mask evaluation. Output: 2D boolean module matrix (testable against known
  vectors).
- UI: text/URL input with live capacity hint ("fits version N"); SVG render
  (always dark-modules-on-light regardless of site theme — scanners need it);
  PNG/SVG download; copy to clipboard.

### EPUB reader

- **Import:** file picker (`.epub`) + drag-and-drop; file read locally to an
  `ArrayBuffer`; original blob stored in IndexedDB so the library persists.
- **ZIP layer (ours):** End-of-Central-Directory → central directory → entries;
  *stored* and *deflate* methods, inflated on demand via
  `DecompressionStream('deflate-raw')`. Encrypted/DRM entries rejected with a
  plain-language message. Chapters decompress lazily; a large book never fully
  lives in memory.
- **EPUB layer:** `META-INF/container.xml` → OPF (title, author, cover,
  manifest, spine) → TOC from EPUB 3 nav doc, falling back to EPUB 2 NCX.
  All XML parsed with `DOMParser`.
- **Rendering:** chapter XHTML sanitized (scripts, event handlers, external
  network references stripped; images resolved from the ZIP as blob URLs) and
  injected into a reader pane styled by our CSS; book CSS is dropped
  (reader-mode choice: publisher styles fight the dark theme and font
  controls). Controls: font size, line height, serif/sans/OpenDyslexic,
  site light/dark theme.
- **Navigation & position:** TOC drawer, prev/next chapter; per-book position
  (spine index + scroll fraction) saved debounced to IndexedDB.
- **Library:** cover grid (cover extracted from the EPUB) with title, author,
  progress %, delete. Requests `navigator.storage.persist()` and shows a
  storage-use line.

### Dilution calculator

One engine, three mode tabs:

- **General** — C₁V₁ = C₂V₂: stock %, target %, target volume → concentrate +
  water.
- **Cleaning** — ratio-first (1:10, 1:32, 1:64, 1:128 quick-picks + custom)
  with bottle presets (500 ml, 750 ml, 1 L, 5 L, custom).
- **Plant feed** — dose-per-volume (ml/L or tsp/gal) with weak/normal/strong
  multipliers.

Engine converts percent↔ratio↔factor and ml/L/tsp/tbsp/fl oz/gal; rounds to
honest precision; a target stronger than stock is flagged as an error, never
silently clamped. Last-used mode/units remembered in prefs.

### Contrast checker

- WCAG 2.x relative luminance + contrast ratio; verdicts for AA/AAA at
  normal/large text and the 3:1 UI-component threshold.
- Live preview swatches in both polarities; hex input + native color pickers.
- Suggestion function nudges one color's lightness until the pair passes the
  chosen target.
- Deliberately WCAG 2 (not APCA) — matches the standard the existing
  listen-token tests assert against.

### Word counter + reading time

- Characters (with/without spaces), words (`Intl.Segmenter` for correct CJK
  and punctuation handling), sentences, paragraphs.
- Silent-reading (~240 wpm) and read-aloud (~155 wpm, narration pace) time
  estimates. Nothing persisted.

### Unit converter

- Categories: length, mass, temperature, volume, area, speed, data size.
- Engine: factor table to an SI base per category; temperature as affine
  pairs. UI: two linked fields converting live in either direction.
  Last category/units remembered.

### Passphrase generator

- Diceware mode: EFF large wordlist, 3–8 words, separator choice,
  capitalization/digit options.
- Random-string mode: length + charset toggles.
- `crypto.getRandomValues` with rejection sampling (no modulo bias); the
  engine takes an injectable random source for deterministic tests.
- Entropy shown in bits with a plain-language strength line. Generated only
  on demand; never stored.

## Offline & installability

- **Service worker** `/tools/sw.js`, scoped to `/tools/`. Precaches the hub,
  all seven tool pages, all `Resources/tools/` assets, shared `/styles.css`
  and `/site.js`, and the OpenDyslexic font (SW scope limits controlled
  *pages*, not which same-origin assets may be cached).
- **Strategy:** network-first with cache fallback for everything in scope —
  fresh when online, fully functional offline, no cache-version bookkeeping
  (the repo has no asset-hashing pipeline; a publish is picked up on the next
  online visit).
- **Offline chip:** "Offline — everything here still works" appears when the
  connection drops.
- **Manifest** `/tools/manifest.webmanifest`: name "KinNoKi Tools",
  `start_url: /tools`, `display: standalone`, site theme colors, 192/512 px
  icons derived from brand art. Add to Home Screen on iPhone yields an
  app-like offline-capable icon — this is the "download for offline use"
  answer.

## Testing

`Tests/tools/` run by `make test-tools`, folded into `make test`.

- **Engines (pure Node):** QR matrices vs known vectors; dilution math incl.
  rounding and the stronger-than-stock error; contrast ratios vs published
  WCAG pairs; unit round-trips; word counts incl. CJK; passphrase entropy +
  rejection sampling with a stubbed random source; ZIP/OPF/NCX parsers
  against tiny fixture EPUBs built byte-by-byte in the tests.
- **Controllers:** fake-DOM technique already used by the games/listen suites.
- **Routes:** a `hub-seven-tools`-style test asserting all seven hub cards,
  per-page script tags, and that `sw.js` + `manifest.webmanifest` land in
  `Output/`.

## Error handling & accessibility

- Calculators validate inline and never render NaN.
- Clipboard/download failures degrade to visible fallbacks.
- Missing `DecompressionStream` (pre-16.4 Safari) feature-detected; clear
  "needs a newer browser" notice on the EPUB tool only.
- Malformed or DRM EPUBs get specific, human messages.
- All result updates announced via the live region; everything
  keyboard-operable; reduced motion respected.

## Out of scope (v1) / future candidates

- QR *scanning* (camera)
- EPUB search, highlights, bookmarks, reading stats
- Single-file downloadable tool builds
- APCA contrast mode
- Image tools (resize/compress)

## Docs

CLAUDE.md gains a Tools section (mirroring the Arcade Hall entry) in the same
PR that ships the feature.

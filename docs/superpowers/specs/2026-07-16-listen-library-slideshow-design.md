# Listening Room: full public library + visual listening (slideshow) — design

**Date:** 2026-07-16
**Surface:** kinnokilabs.com/listen/ (Echo Listening Room)
**Prior decisions honored:** KB 2026-07-09 Listening Room promotion (demo-not-product; "Slideshow included" mirroring Echo PR #417 semantics), KB 2026-07-11 approved playable set (exactly chicken-predators, rodents-in-the-walls, the-new-deal), honesty-note + no-vaporware copy gates.

## Problem

1. All 11 public explainer-audiobooks are *listed* at /listen, but only the 3
   narrated books have covers; the other 8 appear as bare text links in the
   "Also in the library" strip. The library does not look like a library.
2. The slideshow is designed but unwired: `listen-core.js` fully ports Echo's
   `VisualListeningCueResolver` (tested), but `listen.js` ignores
   `snapshot.imageCue`, no figure assets are staged, and no book carries
   interior figures yet. There is no renderer and no data path, so the first
   figure-bearing book would ship with a dead feature.

## Non-goals (explicitly out of scope)

- Making the 8 audio-less books playable. That requires published narrations in
  the public library repo and an explicit AUDIO_EXPECTED approval — Dan's call.
- Publishing `gold-panning-nova-scotia` (untracked/private) or
  `the-best-job-you-can-get-from-here` (manuscript-only WIP).
- Reworking /learn's hard-coded 6-card grid (follow-up; noted in PR).
- Any change to Echo native or the explainer-audiobooks repo.

## Design

### A. Catalog: covers for every public book

`Tools/build-listen-catalog.sh` changes:

- Stage `Resources/listen/books/<slug>/cover.jpg` (sips, quality 80, max 768px)
  for **all** allow-listed books, not just playable ones.
- Every catalog entry gains `cover` + `coverAlt` + `coverWidth`/`coverHeight`
  (measured from the staged file). Playable entries keep their richer shape
  unchanged.

  Covers are not uniformly shaped: `Tools/sync-paired-cover-assets.sh` installs
  **square 768×768** player derivatives for the two paired-cover books
  (chicken-predators, the-new-deal) after the builder runs, while the other nine
  are 480×768 portraits. The player must therefore size thumbnails from the
  per-book dimensions instead of assuming a ratio — forcing one crops the square
  artwork. The sync script owns the final bytes for its slugs, so it re-patches
  their dimensions and re-verifies them against what it installs.
- Validation: staged asset dirs must equal the **full** allow-list; per-slug
  expected entries are `cover.jpg` for links-only books and
  `alignment.json blocks.json cover.jpg` (+ optional `figures/`) for playable.

Player (`listen.js` `renderLibrary`) renders the strip as a visual grid: cover
thumbnail (lazy-loaded, `coverAlt` alt text, `width`/`height` set from the
catalog dimensions so each cover keeps its natural shape and still reserves its
space), title, subtitle when present, writtenBy byline, and the existing actions
(Listen → EPUB → Read). The selected book stays excluded; the no-streamable
empty state reuses the same grid. This matches `.room-cover-frame img`, the
established convention for the main player cover.

### B. Slideshow: figure pipeline + stage renderer

Data contract (builder):

- Image blocks in staged `blocks.json` get `imagePath` rewritten to
  **catalog-relative** paths:
  - cover image block (`chapterIndex == null`) → `books/<slug>/cover.jpg`
  - interior figures (`chapterIndex != null`) → `books/<slug>/figures/<basename>`,
    bytes extracted from the book's EPUB by basename (fail on missing or
    ambiguous basenames; fail >20 MB per file — Cloudflare Pages limit is
    25 MiB; warn >2 MB).
- Playable entries gain `visuals: { figures: N }` — N = interior image blocks.
  All three current books are cover-only, so N = 0 and nothing changes live.
- Validation: every image block's `imagePath` must resolve to a staged file.

Renderer (`listen.js` + `index.html` + `listen.css`):

- New stage element above the captions:
  `<figure id="figurePanel" hidden><img id="figureImg"><figcaption id="figureCaption">`.
- `tick()` consumes `snapshot.imageCue` (already computed): cue present → set
  src to the catalog-relative `imagePath`, show panel with a short crossfade,
  caption = `cue.caption` (figcaption hidden when empty; also used as alt,
  falling back to "Figure from this chapter"). Cue null → hide panel
  (captions-only; exactly today's behavior for cover-only books).
- Image `error` → hide the panel quietly (captions keep running), log via
  `console.debug`. MediaSession artwork stays the book cover.
- Preload: when a figure shows, warm the next figure by sequence order.
- No `listen-core.js` changes — the resolver is complete and tested.

### C. Source pins

Regenerating the catalog pins `source.commit` to the current library HEAD
`8482eae…`. `git diff 18a7ad0..8482eae -- books/` is **empty** (docs-only
commits), so all paired-cover manifest hashes remain valid;
`Resources/learn/paired-cover-source-manifest.json` `sourceCommit` is bumped to
match (the sync script re-verifies every hash and fails closed on drift).

## Testing

- `Tests/listen/catalog.test.mjs`: all 11 entries carry `cover`/`coverAlt` and
  the staged cover exists; playable set unchanged; `visuals.figures` present
  and 0 for the three current books; every image-block `imagePath` resolves to
  a staged file; no absolute paths (existing).
- `Tests/listen/player-dom.test.mjs`: with a synthetic figure-bearing catalog —
  figure appears inside its display window with caption + alt, hides outside
  it, image error hides the panel without breaking captions; library grid shows
  covers for audio-less books; cover-only books never show the panel.
- `Tests/listen/contrast.test.mjs`: extended only if new color tokens are
  introduced (prefer reusing existing room tokens).
- `Tests/site/paired-cover-*.test.mjs` + `learn-library.test.mjs` stay green
  after the manifest bump and regeneration.

Verification: `make listen-catalog` (ECHO_CLI = Echo's Release binary),
`make test`, `make generate`, browser check of /listen (grid + player), plus a
DOM-level slideshow exercise using a synthetic catalog.

## Rollout

Single PR to `main` (site repo convention). Public copy changes are minimal
(library grid labels); Dan reviews at PR time per the copy gate. Live behavior
of the three narrated books is unchanged except the richer library grid; the
slideshow activates automatically for the first figure-bearing catalog entry.

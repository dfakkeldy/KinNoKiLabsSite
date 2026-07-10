# Echo Listening Room — design (v1)

**Date:** 2026-07-09 · **Status:** awaiting Dan's approval · **Branch:** `claude/echo-listening-room-demo-983e1c`

v2 of `kinnokilabs.com/learn`: a browser demo of Echo's core listening
experience — stream a tier-1 public learning book with read-along captions
and the visual-listening stage, framed as a launch-funnel asset
(*try in the browser → `/echo-beta` → App Store*). Not a parallel product.
KB record: knowledge-base PR #234 (promotion decision), building on the
2026-07-09 Echo web version assessment.

---

## 1. Ground truth this design is built on

Verified live against `~/Developer/Echo` (nightly), the public
`dfakkeldy/explainer-audiobooks` repo, and this site repo:

1. **Catalog reality.** `explainer-audiobooks` has **no GitHub Releases and
   no tags**. Of the 10 public books, **exactly one has audio**:
   *The Living Knowledge Base* — a single 29.7 MB m4b with 15 embedded
   chapters (2 h 03 m 37 s by ffprobe), committed in-repo, plus a
   324-anchor `*.alignment.json`. The other nine are EPUB + Markdown +
   cover only. All ten are cover-only (no interior figures).
2. **CORS/Range reality** (live `curl`, `Origin: https://kinnokilabs.com`):
   - `raw.githubusercontent.com` → `Access-Control-Allow-Origin: *`,
     `Accept-Ranges: bytes`, ranged GET returns **206**. Streaming,
     scrubbing, and `fetch()` all work cross-origin today.
   - GitHub **release assets** (characterized on another public repo) →
     Range honored via a signed ~1 h redirect to
     `release-assets.githubusercontent.com`, but **no CORS header**: bare
     `<audio src>` works, `fetch()`/`crossorigin` fails.
3. **Sidecar schema** (`EchoCore/Services/AlignmentSidecar.swift`): a bare
   JSON array of `{blockId: "s<i>-b<j>", timestamp, confidence?}` anchors —
   `s<i>` = EPUB spine index, `b<j>` = block index within that spine item;
   only the suffix is portable. The word-level `words: [{word, start, end}]`
   field is **optional and not yet merged to Echo nightly** (lives in the
   `claude-sidecar-word-timings` worktree). The one real sidecar has no
   `words`.
4. **Echo's pure logic ports cleanly.**
   `Shared/WordTimingInterpolator.swift` (character-weighted word timing
   inside a block window, trailing-space weighting, last word ends exactly
   at block end) and `Shared/VisualListeningCueResolver.swift` (shipped in
   Echo PR #417: image cues from image blocks via explicit-timeline or
   derived-from-nearby-text windows, begin/midpoint sync, subtitle karaoke
   as *display-ordinal* word progress, snapshot = `{imageCue?, subtitleCue?,
   activeBlockID?}`) are both pure and small. The **tokenizer contract**
   (`Shared/WordTokenizer.swift`: Unicode-whitespace split, punctuation
   stays attached) must be replicated exactly or word indices desync.
5. **`echo-cli` structure.** swift-argument-parser subcommands in
   `Tools/echo-cli/`; `SidecarSourceBlockLoader` runs the app's *actual*
   import stack against an in-memory DB and returns `EPubBlockRecord`s
   (portable id, kind `heading|paragraph|sentence|image`, text, imagePath,
   chapterIndex, sequenceIndex, wordCount…). An `export-blocks` subcommand
   is a thin mapping over what already exists.

---

## 2. Decisions (with alternatives considered)

### D1 — Per-block text JSON: `echo-cli export-blocks` ✅ (as recommended in the brief)

New small subcommand in the Echo repo (separate PR to Echo `nightly`):
`echo-cli export-blocks --epub <path> --out <blocks.json>`. Calls
`SidecarSourceBlockLoader.blocks(from:)`, maps each visible block to
`{id: portableSuffix, kind, text, imagePath?, chapterIndex, sequenceIndex,
wordCount}`, writes pretty-printed sorted-keys JSON.

*Alternative rejected:* reimplementing EPUB block extraction in a site
build script. Block ids depend on Echo's exact segmentation rules in
`EPUBBlockParser` (visible-block filtering, heading/paragraph/sentence/image
splitting); any drift silently breaks every sidecar anchor. The loader
already guarantees parity because it runs the same parser the app runs.

### D2 — Asset strategy: bake small assets into the site; only audio is remote

A catalog build step (Makefile target, see §4) generates, per playable book,
into `Resources/listen/books/<slug>/`:

- `blocks.json` — from `echo-cli export-blocks` (D1)
- `alignment.json` — copied verbatim from the book package
- `cover.jpg` — downscaled to ~480×768 (source PNGs are 1600×2560)

plus the top-level `Resources/listen/books.json` catalog. The player then
`fetch()`es **same-origin only**; the only cross-origin request is
`<audio src>` (which needs no CORS). Parity between `blocks.json` and
`alignment.json` is guaranteed because both come from the same local
checkout at the same commit, at build time.

*Alternative rejected:* fetching sidecar/blocks/covers from
`raw.githubusercontent.com` at runtime. Works (CORS `*`), but couples the
page to raw's rate limits and 5-minute cache, and allows text/sidecar drift
if the book regenerates between deploys.

### D3 — v1 audio URL: the existing raw URL (deviation from the brief, with reason)

The brief assumed GitHub Releases URLs; **no releases exist**, and release
assets have no CORS anyway. The committed m4b already streams perfectly from
`raw.githubusercontent.com`, so v1 `books.json` points there — **pinned to
the same commit SHA the catalog was built from**, not `main`:

```
https://raw.githubusercontent.com/dfakkeldy/explainer-audiobooks/<sha>/books/the-living-knowledge-base/the-living-knowledge-base.m4b
```

Pinning matters: the baked `blocks.json`/`alignment.json` are frozen at
build time, so if the book were ever re-narrated on `main`, a `main`-ref
audio URL would silently desync from the captions. Zero new publishing
actions are needed before Dan's review. `books.json` abstracts the URL
exactly as the brief requires: when Dan cuts a release (or moves to R2),
it's a one-field change plus a catalog rebuild, no player changes. Bare
`<audio>` works against all three hosts.

### D4 — One surface, the stage (not a full scrolling reader)

v1's read-along is the **visual-listening stage**: cover (or figure) +
karaoke subtitle for the active block, mirroring the shipped Echo feature
this demo advertises. With the only playable book cover-only and its
anchors block-level (~23 s/block), the stage is honest and calm; a full
paragraph-feed reader is future scope. Caption style follows Echo's
`VisualListeningSubtitleView` three-tier model: already-heard wash
(~0.72 opacity), full-strength active word (soft cross-fade, no jumpy
karaoke), dim upcoming.

### D5 — Books without audio are listed, never playable-looking

`books.json` entries carry `audio.status: "available" | "none"`. The
Listening Room hero is the playable book; the other nine render as a
compact "Also in the library — EPUB & text" strip linking to GitHub (same
links `/learn` already uses). No "audio coming soon" copy — that's
vaporware until narration actually lands.

### D6 — Pure-logic ports get micro-tests (recommended, cheap)

`listen.js` keeps the ports (`tokenizer`, `interpolator`, `timeline`,
`cueResolver`) as pure functions on a namespace object; a small
`node --test` file mirrors Echo's own unit tests (e.g. `"ab cde"` over
`[0,10)` → split at 5.0; sparse-index display-ordinal remap; begin `[10,20]`
vs midpoint `[5,25]` windows). Run via `make test-listen`; no dependencies,
no framework — the repo stays framework-free (node is a dev-only tool, like
ffprobe).

---

## 3. Architecture

### New files (site repo)

```
Resources/listen/index.html          player page → served at /listen/
Resources/listen/listen.css          player styles (site tokens only)
Resources/listen/listen.js           player logic (vanilla, IIFE, site.js style)
Resources/listen/books.json          generated catalog (committed)
Resources/listen/books/<slug>/       generated per-book assets (committed)
    blocks.json · alignment.json · cover.jpg
Tools/build-listen-catalog.sh        catalog builder (ffprobe + echo-cli + jq)
Tests/listen/listen.test.mjs         node --test micro-tests for the pure ports
```

`Resources/` is copied verbatim to the output root, so everything survives
`make generate` and deploys with the committed `Output/`. No theme changes
are needed to *serve* the page; the only theme edit is the `/learn` link-in
(§6).

### Page structure (`/listen/`)

Minimal, room-like chrome rather than the full site nav: brand mark linking
home, "← Learn" back link, theme + OpenDyslexic toggles (reusing the site's
`.theme-toggle` / `.font-toggle` classes so `/site.js` wires them
unchanged), then the stage. `<head>` inlines the same no-flash `data-theme`
snippet documented in `site.js`, loads `/styles.css` then `listen.css`,
and `site.js` + `listen.js` with `defer`.

Stage layout (mobile-first, single column; two columns ≥760 px):

- **Stage** — cover art (or figure, when a future book has image blocks)
  with the karaoke subtitle beneath on a soft surface; gold `--grad-gold`
  progress hairline.
- **Transport** — play/pause, ±30 s, prev/next chapter, scrubber
  (`<input type="range">`), elapsed/remaining, speed (1×/1.25×/1.5×).
- **Chapters** — collapsible chapter list (from `books.json`), current
  chapter highlighted; tapping seeks.
- **Footer strip** — honesty note, "Made with Echo" + `btn-gold` CTA to
  `/echo-beta`, library strip (D5).

### `books.json` contract (v1)

```jsonc
{
  "version": 1,
  "generated": "2026-07-09T00:00:00Z",
  "source": { "repo": "dfakkeldy/explainer-audiobooks", "commit": "<sha>" },
  "books": [
    {
      "slug": "the-living-knowledge-base",
      "title": "The Living Knowledge Base",
      "subtitle": "LLM Wikis, Research Notebooks, and Company Memory",
      "curator": "Dan Fakkeldy",
      "writtenBy": "GPT-5 Codex",            // model attribution, per honesty pattern
      "cover": "books/the-living-knowledge-base/cover.jpg",
      "coverAlt": "…",
      "durationSeconds": 7416.917,
      "audio": {
        "status": "available",               // "available" | "none" — NEVER assumed
        "url": "https://raw.githubusercontent.com/…/the-living-knowledge-base.m4b",
        "mimeType": "audio/mp4"
      },
      "chapters": [ { "title": "ch. 1: When Notes Start Working Back",
                      "start": 0.0, "end": 498.52 }, … ],
      "text":      { "blocks": "books/the-living-knowledge-base/blocks.json" },
      "alignment": { "sidecar": "books/the-living-knowledge-base/alignment.json",
                     "hasWordTimings": false },
      "links": { "folder": "https://github.com/…", "epub": "…", "read": "…" }
    },
    { "slug": "findable", "title": "Findable", …, "audio": { "status": "none" },
      "links": { … } }                        // nine of these render as library strip
  ]
}
```

### Playback engine

`<audio preload="metadata">` + MediaSession:

- `setActionHandler` for `play/pause/seekbackward/seekforward/seekto/
  previoustrack/nexttrack` (prev/next = chapter nav, mirroring Echo);
  `metadata` = title, "Dan Fakkeldy · written by <model>", site-hosted
  cover artwork; `setPositionState` on `timeupdate`.
- Scrubbing relies on the verified HTTP Range support.
- Position persisted per book in `localStorage`
  (`kinnoki-listen-<slug>`, same key style as `kinnoki-theme`), resume on
  return.

### Read-along pipeline (all pure, all in `listen.js`)

1. **Timeline build** (once per book): sort anchors by timestamp; block *i*
   spans `[anchor[i].timestamp, anchor[i+1].timestamp)`, the last block
   ends at `durationSeconds`. Join to `blocks.json` rows by portable id;
   anchors whose block id is missing are dropped (and counted — see
   diagnostics note in §7).
2. **Tokenizer port** — Unicode-whitespace split, runs collapse,
   punctuation attached (mirrors `WordTokenizer`; `\s` in JS regex with the
   `u` flag matches the same class closely; NBSP included explicitly).
3. **Word timing** — if the sidecar anchor has `words`, use it (array
   position = display ordinal, absolute times); else port of
   `WordTimingInterpolator`: weight = `word.length + 1` (last word
   `word.length`), cumulative fractions over the block window. Ready for
   the `words` field the moment Echo's sidecar PR merges — no format change.
4. **Active resolution** — binary search for active block on `timeupdate`
   (~4 Hz is enough; also on `seeked`); linear scan within the block for
   the active word.
5. **Cue resolution** — `VisualListeningCueResolver` port: image cues from
   visible image blocks (explicit timeline row if the block has an anchor
   window of its own, else derived from the nearest same-chapter text
   block; begin/midpoint windows, `midpoint` = `[mid − dur, mid + dur]`);
   latest-applicable-figure-wins; subtitle prefers the active text block,
   falls back to the cue's reference block. Cover-only books short-circuit
   to `imageCue: null` → stage shows the cover, captions still run. This
   matches Echo's shipped behavior exactly (its resolver never synthesizes
   a cover cue either; the renderer owns the cover).
6. **Rendering** — subtitle words as `<span>`s, three CSS classes
   (`heard` / `active` / `upcoming`); transitions ~250 ms ease, disabled
   under `prefers-reduced-motion`. Block changes cross-fade the subtitle;
   figure changes cross-fade the image (250 ms, as in Echo's stage).

---

## 4. Catalog build (`make listen-catalog`)

`Tools/build-listen-catalog.sh`, inputs pinned by flags with defaults:

```
BOOKS_REPO ?= $(HOME)/Developer/explainer-audiobooks
ECHO_CLI   ?= swift run --package-path $(HOME)/Developer/Echo/Tools/echo-cli echo-cli
```

Per allow-listed book slug (the allow-list is *in the script*, tier-1
public only — nothing is published by accident):

1. `ffprobe -print_format json -show_chapters -show_format` → duration +
   chapter titles/start/end.
2. `echo-cli export-blocks --epub <slug>.epub --out blocks.json` (D1).
3. Copy `*.alignment.json`; record `hasWordTimings` by probing for a
   `words` key.
4. `sips` (macOS-native) downscale cover → `cover.jpg`.
5. Assemble `books.json` (jq), stamping the source repo commit SHA.
6. Fail loudly if a book claims audio but the m4b/sidecar is missing —
   the audio-state flag is set from what's actually on disk, never assumed.

The generated files are committed (they deploy via `Output/`). Books
without audio get catalog entries with `audio.status: "none"` and links
only. Until the `export-blocks` PR lands in Echo, the script has a
`--no-blocks` mode for development — but note the sidecar carries **ids and
timestamps only, no text**, so without `blocks.json` there are no captions
at all (the stage degrades to cover + chapter title + progress). Captions
— block-level *and* word-level — require D1.

## 5. Accessibility & brand

- Site tokens only (`--bg`, `--surface`, `--gold-*`, `--text-*`); dark
  default + light via the standard toggle; OpenDyslexic toggle affects
  captions too (`body.font-opendyslexic` cascade already handles it).
- All transport controls are real `<button>`s with `aria-label`s;
  the scrubber is a labelled `<input type="range">` announcing
  time via `aria-valuetext` ("12 minutes 30 seconds of 2 hours 3 minutes");
  chapter list is a `<nav><ol>` with `aria-current`. Keyboard: Space
  play/pause, ←/→ ±30 s (with the standard "not while typing" guard),
  visible `:focus-visible` (site default).
- Captions region is `aria-hidden` word-spans inside a container that
  exposes the plain block text once per block change (a `aria-live="off"`
  static text node — VoiceOver reads the paragraph on demand without
  75 announcements/minute of karaoke spam).
- `prefers-reduced-motion` disables cross-fades and the reveal animation.
- Honesty note verbatim pattern: *"Written by GPT-5 Codex, grounded in real
  source — spot-checked, not expert-reviewed"*, linking the collection's
  honest-disclosure anchor. KinNoKi Labs casing throughout. CTA:
  `btn-gold` → `/echo-beta`. No feature promises beyond what plays.

## 6. `/learn` link-in (theme edit, copy for Dan's review)

In `learnMain()` (`KinNoKiTheme.swift`): add a third hero CTA
**"Listen in your browser"** (`btn-gray`, `href="/listen/"`) and a short
gold-tinted band above the sample-books grid:

> **Echo Listening Room** — Stream *The Living Knowledge Base* right here,
> with the same read-along captions Echo uses. No install, no signup.
> [Open the Listening Room]

All public-facing copy (this band, the player page strings, the honesty
note placement) ships in the PR **for Dan's review before merge**.

## 7. Verification plan

- `swift build` clean; `make generate` clean; no manual `Output/` edits.
- `node --test Tests/listen/` green (pure-port tests, D6).
- Local preview (`make preview`): stream the real m4b from raw — play,
  scrub (Range), chapter next/prev, speed; captions track a spot-checked
  chapter start against the m4b chapter table; diagnostics counter shows 0
  dropped anchors (dev-only `console.debug`, no UI).
- Browser matrix: Safari + Chrome minimum (m4b served as
  `application/octet-stream` should sniff as MP4/AAC; **if Safari balks,
  fallback is a renamed `.m4a` copy** — noted risk, checked first).
- Mobile viewport (375 px), light + dark, OpenDyslexic on/off,
  reduced-motion.
- Keyboard-only pass and a VoiceOver pass over every control.
- Lock-screen/MediaSession check on macOS Safari/Chrome (Now Playing
  widget shows artwork/chapter actions).

## 8. Out of scope (v1)

Full scrolling reader with tap-to-seek; figure-bearing books (the resolver
port is ready, but no public book has figures yet); authored
`visual-track.json`; R2 migration (one `books.json` field when it happens);
narrating the other nine books (content-pipeline work, not site work);
Echo-side `words` sidecar merge (player consumes it automatically once
present).

## 9. Dependencies & sequencing

1. **Echo PR** (small, separate, to Echo `nightly`): `export-blocks`
   subcommand. **Captions depend on it entirely** — the sidecar has no
   text (§4) — so it merges first. It's a thin mapping over
   `SidecarSourceBlockLoader`.
2. **This site PR** (after design approval): player + catalog builder +
   generated assets for the one playable book + `/learn` link-in + this
   spec. Built in parallel with (1); the catalog build consumes (1)'s
   output before the site PR is marked ready.
3. Later, Dan-gated: cut `explainer-audiobooks` releases or R2 bucket;
   update `books.json` audio URLs and rebuild the catalog.

Both PRs are prepared together after design approval; the Echo one merges
first so the site ships with captions complete on day one.

# Echo Listening Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/listen/` — a browser demo of Echo's listening experience streaming *The Living Knowledge Base* with read-along captions — plus the `echo-cli export-blocks` companion, per the approved spec (`docs/superpowers/specs/2026-07-09-echo-listening-room-design.md`).

**Architecture:** Two workstreams. **A (Echo repo):** a thin `export-blocks` subcommand over `SidecarSourceBlockLoader`, PR to Echo `nightly` — merges first because captions have no text without it. **B (site repo):** pure-logic ports with node tests, catalog builder, static player page under `Resources/listen/`, `/learn` link-in, then catalog generation + browser verification + PR to `main`.

**Tech Stack:** Swift (ArgumentParser, EchoCore) for A; vanilla JS (UMD-style dual export), plain CSS on site tokens, `node --test`, `ffprobe`, `sips`, `jq` for B. No frameworks, no npm dependencies.

## Global Constraints

- Site repo is deliberately framework-free; JS matches `Resources/site.js` style (strict IIFE, `var`-free is fine, no build step). Node is dev-only tooling.
- Never hand-edit `Output/` — regenerate with `make generate`.
- Tier-1 public books only; the catalog allow-list is explicit in the builder script.
- `audio.status` is set from what exists on disk — never assumed.
- Public-facing copy is draft-for-Dan's-review; honesty-note wording follows the collection pattern: "Written by GPT-5 Codex, grounded in real source — spot-checked, not expert-reviewed."
- "KinNoKi Labs" casing; CTA points to `/echo-beta`; no vaporware copy ("audio coming soon" is forbidden).
- Echo repo: branch from `origin/nightly`, PR to `nightly`, SPDX `GPL-3.0-or-later` headers, Conventional Commits, Xcode build gate (`~/.claude/bin/xcode-build-gate.sh --wait && <build>`) before heavy builds.
- Audio URL in `books.json` is pinned to the `explainer-audiobooks` commit SHA the catalog was built from (never `main`).

## Shared contracts (both workstreams read this)

**`blocks.json`** (produced by A, consumed by B's catalog builder and player):

```jsonc
{
  "version": 1,
  "source": { "epub": "the-living-knowledge-base.epub" },
  "blocks": [
    {
      "id": "s2-b0",              // portable suffix via AlignmentSidecar.portableSuffix
      "kind": "paragraph",        // "heading" | "paragraph" | "sentence" | "image"
      "text": "When notes start…",// plain text; for kind=="image" this is the caption (may be "")
      "chapterIndex": 0,          // Int?; null for front matter
      "sequenceIndex": 12,        // monotonic across the book; sort key
      "wordCount": 34,            // Int?; null allowed
      "imagePath": "OEBPS/fig1.png" // ONLY present when kind=="image"
    }
  ]
}
```

Blocks are **visible blocks only** (the loader's `visibleBlocks` filtering), sorted by `sequenceIndex`, pretty-printed with sorted keys.

**`books.json`** (produced by B2, consumed by B4): schema exactly as spec §3, `text.blocks` / `alignment.sidecar` / `cover` are site-relative paths under `/listen/`.

**`listen-core.js` public API** (produced by B1, consumed by B4 and tests):

```js
// UMD dual export: window.EchoListenCore in browsers, module.exports in node.
EchoListenCore = {
  words(text),                          // -> [String]; Unicode-whitespace split, punctuation attached
  interpolateWords(text, blockStart, blockEnd),
                                        // -> [{index, word, start, end}]  (WordTimingInterpolator port)
  buildTimeline(anchors, blocks, durationSeconds),
                                        // -> {rows: [{start, end, blockId, chapterIndex, sequenceIndex}], droppedAnchorCount}
  activeRowIndex(rows, time),           // -> Int (-1 if none); binary search over rows
  wordProgress(wordRows, time),         // -> {activeWordIndex|null, alreadyHeardWordCount}
  resolveSnapshot(input),               // VisualListeningCueResolver port; see B1 for exact shape
}
```

---

## Workstream A — Echo repo (subagent; repo `~/Developer/Echo`, base `origin/nightly`)

### Task A1: `echo-cli export-blocks`

**Files:**
- Create: `Tools/echo-cli/ExportBlocksCommand.swift` (or co-locate in `Tools/echo-cli/SidecarCommands.swift` if that matches the file's role better — follow the repo's own layout)
- Modify: `Tools/echo-cli/EchoCLI.swift` (add `ExportBlocksCommand.self` to `subcommands`)

**Interfaces:**
- Consumes: `SidecarSourceBlockLoader.blocks(from:audiobookID:)` (`EchoCore/Services/SidecarSourceBlockLoader.swift`), `AlignmentSidecar.portableSuffix(of:)`, `EPubBlockRecord` fields (`blockKind`, `text`, `imagePath`, `chapterIndex`, `sequenceIndex`, `wordCount`).
- Produces: `blocks.json` per the shared contract above.

- [ ] **Step 1: Discover how echo-cli builds and runs.** Read `Tools/echo-cli/` (is there a `Package.swift`, or is it an Xcode target added via the Ruby helpers?). Record the exact build + run commands in the PR description — Workstream B invokes them from a Makefile.
- [ ] **Step 2: Implement the subcommand** mirroring `VerifySidecarCommand`'s structure (`AsyncParsableCommand`, `@Option var epub: String`, `@Option var out: String`, `@MainActor run()`):
  - Load blocks via `SidecarSourceBlockLoader.blocks(from: URL(fileURLWithPath: epub))`.
  - Map to the shared contract: `id = AlignmentSidecar.portableSuffix(of: block.id)`, `kind = block.blockKind`, `text = block.text ?? ""`, include `imagePath` only for image blocks, carry `chapterIndex`/`sequenceIndex`/`wordCount`.
  - Encode `JSONEncoder` with `[.prettyPrinted, .sortedKeys]`, write atomically to `--out`.
  - Print a one-line summary: `EXPORTED <n> blocks (<paragraphs>p/<headings>h/<sentences>s/<images>i) -> <out>`.
- [ ] **Step 3: Add a unit test if there is an existing low-friction slot** (a pure mapping function testable in `EchoTests` without booting the CLI). If echo-cli has no test target and wiring one is disproportionate, skip — Step 4 is the acceptance gate either way.
- [ ] **Step 4: Acceptance run against the real book.**
  Run export-blocks on `~/Developer/explainer-audiobooks/books/the-living-knowledge-base/the-living-knowledge-base.epub`, then verify with a small script (jq/python): every one of the **324** `blockId`s in the sibling `the-living-knowledge-base.alignment.json` exists in the exported `blocks` ids. Expected: 0 unresolved anchors. Also `verify-sidecar` on the same inputs still passes (`SIDECAR_OK`).
- [ ] **Step 5: Commit + PR.** Conventional Commit (`feat(cli): add export-blocks subcommand`), push branch `claude/echo-cli-export-blocks`, `gh pr create --base nightly`. PR body includes the acceptance evidence (block/anchor counts) and the build/run commands from Step 1.

---

## Workstream B — site repo (this session)

### Task B1: pure-logic ports + node tests

**Files:**
- Create: `Resources/listen/listen-core.js`
- Test: `Tests/listen/listen-core.test.mjs`
- Modify: `Makefile` (add `test-listen: node --test Tests/listen/`)

**Interfaces:** Produces the `EchoListenCore` API in the shared contract. `resolveSnapshot` input/output:

```js
resolveSnapshot({
  blocks,            // blocks.json .blocks (sorted by sequenceIndex)
  rows,              // buildTimeline().rows
  wordsByBlockId,    // Map blockId -> [{index, word, start, end}]
  time,              // seconds
  syncPoint,         // "begin" | "midpoint" (player uses "midpoint", Echo's default feel)
}) -> {
  imageCue: null | { blockId, imagePath, caption, subtitleBlockId,
                     displayStartTime, displayEndTime, source },   // source: "explicitTimeline"|"derivedFromNearbyText"
  subtitleCue: null | { blockId, text, activeWordIndex, alreadyHeardWordCount },
  activeBlockId: null | String,
}
```

Port semantics (from `Shared/VisualListeningCueResolver.swift` + `Shared/WordTimingInterpolator.swift` + `Shared/WordTokenizer.swift`):
- `words()`: split on Unicode whitespace (`/\s+/u` plus explicit NBSP ` `), collapse runs, punctuation attached.
- `interpolateWords()`: weight `word.length + 1` (last word `word.length`); cumulative fractions over `[blockStart, blockEnd)`; `span = max(0, end-start)`; empty text → `[]`.
- `buildTimeline()`: anchors sorted by timestamp; row end = next anchor's timestamp, last = `durationSeconds`; unknown blockIds dropped and counted.
- `wordProgress()`: active = row containing `time` in `[start,end)`; ordinal indices are **display ordinals** (array positions), never sparse source indices.
- `resolveSnapshot()`: image cues from visible `kind=="image"` blocks with non-empty `imagePath`; explicit window when the image block has its own timeline row (`end > start`), else derived from nearest same-chapter text block (first at-or-after `sequenceIndex`, else last before); `begin` window = reference row `[start,end)`, `midpoint` = `[mid − dur, mid + dur]`; among applicable cues latest `sequenceIndex` wins; subtitle prefers active text block's words, falls back to cue's `subtitleBlockId`; cover-only books (no image blocks) → `imageCue: null`, captions still resolve.

- [ ] **Step 1: Write failing tests** — mirror Echo's own suites:

```js
// Tests/listen/listen-core.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../../Resources/listen/listen-core.js';

test('interpolate splits proportionally by character length', () => {
  const w = core.interpolateWords('ab cde', 0, 10);   // weights 3 & 3
  assert.equal(w.length, 2);
  assert.equal(w[0].word, 'ab');
  assert.ok(Math.abs(w[0].end - 5.0) < 1e-9);
  assert.ok(Math.abs(w[1].start - 5.0) < 1e-9);
  assert.ok(Math.abs(w[1].end - 10.0) < 1e-9);
});

test('empty text produces no words', () => {
  assert.deepEqual(core.interpolateWords('   ', 0, 10), []);
});

test('monotonic non-overlapping times, exact tiling', () => {
  const w = core.interpolateWords('the quick brown fox', 2, 6);
  for (let i = 1; i < w.length; i++) assert.ok(w[i].start >= w[i - 1].end - 1e-4);
  assert.ok(w[0].start >= 2);
  assert.ok(w[w.length - 1].end <= 6 + 1e-4);
});

test('timeline drops unknown anchors and tiles to duration', () => {
  const blocks = [
    { id: 's2-b0', kind: 'paragraph', text: 'a', chapterIndex: 0, sequenceIndex: 0 },
    { id: 's2-b1', kind: 'paragraph', text: 'b', chapterIndex: 0, sequenceIndex: 1 },
  ];
  const anchors = [
    { blockId: 's2-b0', timestamp: 0 },
    { blockId: 'ghost-b9', timestamp: 5 },
    { blockId: 's2-b1', timestamp: 10 },
  ];
  const { rows, droppedAnchorCount } = core.buildTimeline(anchors, blocks, 20);
  assert.equal(droppedAnchorCount, 1);
  assert.deepEqual(rows.map(r => [r.blockId, r.start, r.end]),
    [['s2-b0', 0, 10], ['s2-b1', 10, 20]]);
});

test('activeRowIndex binary search honors [start,end)', () => {
  const rows = [{ start: 0, end: 10 }, { start: 10, end: 20 }];
  assert.equal(core.activeRowIndex(rows, 0), 0);
  assert.equal(core.activeRowIndex(rows, 9.999), 0);
  assert.equal(core.activeRowIndex(rows, 10), 1);
  assert.equal(core.activeRowIndex(rows, 25), -1);
  assert.equal(core.activeRowIndex(rows, -1), -1);
});

test('word progress uses display ordinals even for sparse source indices', () => {
  const wordRows = [
    { index: 0, word: 'alpha', start: 0, end: 1 },
    { index: 10000, word: 'beta', start: 1, end: 2 },
    { index: 20000, word: 'gamma', start: 2, end: 3 },
  ];
  const p = core.wordProgress(wordRows, 1.5);
  assert.equal(p.activeWordIndex, 1);
  assert.equal(p.alreadyHeardWordCount, 1);
});

test('begin and midpoint derived windows differ ([10,20] vs [5,25])', () => {
  const blocks = [
    { id: 'img', kind: 'image', text: 'cap', imagePath: 'x.png', chapterIndex: 0, sequenceIndex: 0 },
    { id: 'txt', kind: 'paragraph', text: 'hello world', chapterIndex: 0, sequenceIndex: 1 },
  ];
  const rows = [{ start: 10, end: 20, blockId: 'txt', chapterIndex: 0, sequenceIndex: 1 }];
  const wordsByBlockId = new Map();
  const begin = core.resolveSnapshot({ blocks, rows, wordsByBlockId, time: 15, syncPoint: 'begin' });
  assert.equal(begin.imageCue.displayStartTime, 10);
  assert.equal(begin.imageCue.displayEndTime, 20);
  const mid = core.resolveSnapshot({ blocks, rows, wordsByBlockId, time: 6, syncPoint: 'midpoint' });
  assert.equal(mid.imageCue.displayStartTime, 5);
  assert.equal(mid.imageCue.displayEndTime, 25);
  assert.equal(mid.imageCue.source, 'derivedFromNearbyText');
});

test('cover-only book yields null imageCue but live captions', () => {
  const blocks = [{ id: 't1', kind: 'paragraph', text: 'one two three', chapterIndex: 0, sequenceIndex: 0 }];
  const rows = [{ start: 0, end: 3, blockId: 't1', chapterIndex: 0, sequenceIndex: 0 }];
  const wordsByBlockId = new Map([['t1', core.interpolateWords('one two three', 0, 3)]]);
  const s = core.resolveSnapshot({ blocks, rows, wordsByBlockId, time: 1.6, syncPoint: 'midpoint' });
  assert.equal(s.imageCue, null);
  assert.equal(s.subtitleCue.blockId, 't1');
  assert.equal(s.subtitleCue.activeWordIndex, 1);
  assert.equal(s.subtitleCue.alreadyHeardWordCount, 1);
  assert.equal(s.activeBlockId, 't1');
});

test('subtitle falls back to full block text without word timing', () => {
  const blocks = [{ id: 't1', kind: 'paragraph', text: 'plain block', chapterIndex: 0, sequenceIndex: 0 }];
  const rows = [{ start: 0, end: 3, blockId: 't1', chapterIndex: 0, sequenceIndex: 0 }];
  const s = core.resolveSnapshot({ blocks, rows, wordsByBlockId: new Map(), time: 1, syncPoint: 'begin' });
  assert.equal(s.subtitleCue.text, 'plain block');
  assert.equal(s.subtitleCue.activeWordIndex, null);
  assert.equal(s.subtitleCue.alreadyHeardWordCount, 0);
});
```

- [ ] **Step 2: Run to verify failure.** `node --test Tests/listen/` → `Cannot find module ... listen-core.js`.
- [ ] **Step 3: Implement `listen-core.js`** (UMD dual export; pure functions only, no DOM).
- [ ] **Step 4: Run to verify pass.** `node --test Tests/listen/` → all pass.
- [ ] **Step 5: Commit** `feat(listen): pure ports of Echo word timing + visual cue resolution`.

### Task B2: catalog builder + Makefile targets

**Files:**
- Create: `Tools/build-listen-catalog.sh` (executable)
- Modify: `Makefile` (add `listen-catalog` target; `test-listen` from B1)

**Interfaces:** Consumes `echo-cli export-blocks` (A1) and `~/Developer/explainer-audiobooks`. Produces `Resources/listen/books.json` + `Resources/listen/books/<slug>/{blocks.json,alignment.json,cover.jpg}` per spec §3/§4.

- [ ] **Step 1: Write the script.** Env-overridable `BOOKS_REPO`, `ECHO_CLI` (default command recorded from A1 Step 1). Explicit allow-list table (slug|title|subtitle|writtenBy) for all ten public books; only `the-living-knowledge-base` has audio. Steps per spec §4: ffprobe chapters+duration, export-blocks, copy sidecar (+ probe `hasWordTimings`), `sips -Z 768` cover → jpg, assemble with jq, stamp `source.commit` (`git -C $BOOKS_REPO rev-parse HEAD`) and pin the audio URL to that SHA. Fail loudly (`set -euo pipefail`) if declared audio is missing on disk; `--no-blocks` dev mode skips export-blocks.
- [ ] **Step 2: Dry-run with `--no-blocks`** (before A1 lands): expect `books.json` + sidecar + cover for the playable book, `status:"none"` entries for the other nine.
- [ ] **Step 3: Commit** `feat(listen): catalog builder (make listen-catalog)`.

### Task B3: player page markup + styles

**Files:**
- Create: `Resources/listen/index.html`, `Resources/listen/listen.css`

Per spec §3/§5: minimal room chrome (brand mark → `/`, "← Learn" → `/learn`, `.theme-toggle`/`.font-toggle` reused so `/site.js` wires them); inline no-flash `data-theme` snippet from `site.js`'s documented header; loads `/styles.css`, `listen.css`, `/site.js` + `listen-core.js` + `listen.js` (defer). Stage (cover + karaoke subtitle), transport (`<button>`s with `aria-label`s, `<input type="range">` scrubber with `aria-valuetext`), collapsible chapter `<nav><ol>` with `aria-current`, footer strip (honesty note verbatim pattern, `btn-gold` CTA → `/echo-beta`, library strip for no-audio books). Site tokens only; `prefers-reduced-motion` guards; caption spans `aria-hidden` with a parallel plain-text node for screen readers.

- [ ] **Step 1: Build `index.html` with a hard-coded loading state** (no JS yet), correct meta/OG tags, `<title>Echo Listening Room — KinNoKi Labs</title>`.
- [ ] **Step 2: Write `listen.css`** (mobile-first single column; two-column ≥760px; three caption tiers `.heard/.active/.upcoming`; gold progress hairline).
- [ ] **Step 3: Commit** `feat(listen): player page markup and styles`.

### Task B4: player logic (`listen.js`)

**Files:**
- Create: `Resources/listen/listen.js`

**Interfaces:** Consumes `EchoListenCore`, `books.json`. Behavior per spec §3: fetch catalog → pick playable book (querystring `?book=<slug>` future-proofing, default first `status:"available"`); build timeline + per-block word rows (sidecar `words` when `hasWordTimings`, else interpolation); `<audio preload="metadata">`; MediaSession (`play/pause/seekbackward/seekforward/seekto/previoustrack/nexttrack` = chapter nav, metadata artwork from site cover, `setPositionState`); scrubber ↔ `timeupdate` (rAF-throttled ~4Hz for captions); chapter list seek; speed cycle 1×/1.25×/1.5×; `localStorage` resume `kinnoki-listen-<slug>`; keyboard Space/←/→ with not-while-typing guard; caption render via snapshot diffing (only touch DOM on block/word change); dropped-anchor `console.debug`; graceful error state if audio fails to load.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Manual smoke in preview** (B7 does the full pass): page loads, no console errors with catalog present.
- [ ] **Step 3: Commit** `feat(listen): player logic (audio, MediaSession, captions)`.

### Task B5: `/learn` link-in (copy for Dan's review)

**Files:**
- Modify: `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift` (`learnMain()`, lines ~829–839 hero CTAs + new band above the sample-books section)

- [ ] **Step 1: Add third hero CTA** `<a class="btn btn-gray" href="/listen/">Listen in your browser</a>` and the gold-tinted Listening Room band per spec §6 draft copy.
- [ ] **Step 2: `swift build`** → clean.
- [ ] **Step 3: Commit** `feat(learn): link the Echo Listening Room`.

### Task B6: real catalog generation

- [ ] **Step 1: Build echo-cli from the A1 branch** (or merged nightly if already landed) using A1's recorded commands, behind the build gate.
- [ ] **Step 2: `make listen-catalog`** (full mode). Verify: 324/324 anchors resolve (0 dropped), 15 chapters match the spec's ffprobe table, `hasWordTimings:false`, audio URL pinned to SHA.
- [ ] **Step 3: Commit generated assets** `feat(listen): generated catalog for The Living Knowledge Base`.

### Task B7: full verification pass

- [ ] `node --test Tests/listen/` green; `swift build` clean; `make generate` clean; `git status` shows only expected `Output/` additions.
- [ ] Browser pass via preview server (`make preview`): play/scrub/chapter-nav/speed against the real raw-URL m4b; captions spot-checked against chapter starts; console clean; network shows Range requests.
- [ ] Mobile viewport 375px; dark + light; OpenDyslexic on/off; reduced-motion.
- [ ] Keyboard-only operation; accessibility-tree snapshot of all controls (labels, roles, `aria-current`).
- [ ] Safari check for m4b-as-octet-stream playback (risk item; fallback = renamed `.m4a` copy as a release/raw asset — decide only if it actually fails).
- [ ] Fix-and-recheck loop until clean; commit fixes.

### Task B8: review + PR

- [ ] Dispatch a focused code-review subagent over the full diff; triage findings per superpowers:receiving-code-review; fix what's real.
- [ ] `make generate` one final time; commit.
- [ ] `gh pr create --base main` with: summary, verification evidence, screenshots, **"public copy awaiting Dan's review"** callout, link to spec + KB promotion note, dependency note on the Echo PR.

## Self-review

Spec coverage: D1→A1; D2/D3→B2/B6; D4→B1/B3/B4; D5→B2/B3; D6→B1; §5→B3/B4/B7; §6→B5; §7→B7; §9 sequencing→A1 before B6, both PRs prepared together. Types cross-checked: `EchoListenCore` names match between B1 contract, tests, and B4 consumption; `blocks.json` keys match between A1 and B1/B2. No placeholders — B3/B4 implementation detail lives in the approved spec §3/§5, which is the source of truth for those tasks.

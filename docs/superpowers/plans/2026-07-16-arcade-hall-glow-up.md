# Arcade Hall Glow-Up and Kinnoki Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all Arcade Hall surfaces prettier and smoother (shared chrome polish plus per-game motion/feedback) and add a sixth game, the Kinnoki Charts nonogram, per the approved design spec.

**Architecture:** Extend the existing dependency-free ES-module game system in place: pure additions to `core.js` (records diff), new shared modules (`celebration.js`), CSS-only polish in the Arcade Hall block of `styles.css`, in-place-patching refactors of the three puzzle controllers, overlay/one-shot animation layers for Stack and Yard, and one new DOM-free engine + content catalog + controller pair for Kinnoki Charts wired through the established six-file registration contract.

**Tech Stack:** Browser-native JavaScript ES modules, Web Audio API, CSS, Swift Publish (Plot) for routes, Node's built-in test runner with the repo's `dom-fixture.mjs`.

**Design Spec:** [Arcade Hall Glow-Up and Kinnoki Charts Design](../specs/2026-07-16-arcade-hall-glow-up-design.md)

## Global Constraints

- No third-party runtime dependencies; no accounts, backend, analytics, or new storage keys. The store stays device-local under `kinnoki-games:v2`.
- Never edit `Output/` by hand; run `make generate` only in the final integration task, before route tests.
- Every new CSS animation/transition class MUST have a matching override in the reduced-motion block of `Resources/styles.css` (currently lines 966–982) AND a regex assertion added to `Tests/games/accessibility.test.mjs` (mirror the existing `.stack-cargo-active` / `.cargo-dispatching` patterns).
- Every new color-coded game state needs a non-color cue (pattern `background-image`, outline style, or text), per the accessibility suite.
- Controllers must keep the dom-fixture rules: build DOM with `element()`/`createElement`/`append` only (the fixture throws on non-empty `innerHTML`), register listeners/frames only through `api.listenActive`/`api.requestActiveFrame` or session equivalents, no `setTimeout`-driven logic (fixture ticks only `setInterval`/rAF — use `animationend`/`transitionend` events or ticked intervals for one-shot effects), no layout reads (`getBoundingClientRect` etc. — position overlays with percentage math from cell indices).
- `Tests/games/routes.test.mjs` asserts literal source strings in `Resources/games/ui.js`; new entries must copy the existing textual pattern exactly. Don't reformat existing lines.
- Class names asserted by tests are a public contract; any rename lands with its test update in the same commit.
- Game-title casing: **Kinnoki Charts** (matches Kinnoki Stack/Yard); studio casing stays **KinNoKi Labs**.
- Existing game rules, reducers, and storage schema shapes stay untouched except for the additive changes named here.
- Conventional Commits; stage only task-owned files; run `make test-games` after every task (route tests may be skipped until Output is regenerated in Task 13 — they read `Output/` directly; if they fail on stale output mid-plan, exclude them by running the focused test files listed per task instead).

## Execution Boundary

Implement on the current worktree branch `claude/kinnokilabs-games-improve-254cc3` (already cut from `main`; this repo has no nightly/weekly ladder — the final PR targets `main`). The spec and this plan are already committed on it.

## Planned File Structure

### Create

- `Resources/games/celebration.js` — shared, reduced-motion-aware win celebration (gold shimmer + CSS confetti), disposable, no timers.
- `Resources/games/kinnoki-charts-content.js` — curated pictogram catalog (5×5 easy, 10×10 medium, 15×15 hard) with titles.
- `Resources/games/kinnoki-charts.js` — DOM-free nonogram engine: clue building, line solver, puzzle factory, reducer, validator.
- `Resources/games/kinnoki-charts-ui.js` — Charts controller on `createSession`, build-once/patch-in-place grid, clue strips, reveal sequence.
- `Content/games/kinnoki-charts.md` — frontmatter-only page metadata.
- `Tests/games/celebration.test.mjs` — celebration lifecycle (mount, reduced-motion no-op, dispose, no leaked nodes).
- `Tests/games/kinnoki-charts.test.mjs` — engine: clues, solver, full-catalog line-solvability, reducer, determinism, validator.
- `Tests/games/kinnoki-charts-ui.test.mjs` — controller on the DOM fixture: mount, input, clue satisfaction, completion, save/resume, disposal.
- `Tests/games/hub-six-games.test.mjs` — renamed and updated from `hub-five-games.test.mjs` (six cards, Charts entry, updated copy).

### Modify

- `Resources/games/core.js` — add `recordsBrokenBy` helper; add `kinnoki-charts` to `GAME_IDS` and `MODE_RECORDS`.
- `Resources/games/controller-common.js` — `prefersReducedMotion()`, shared confirm dialog replacing `window.confirm`, `completionPanel` records line + celebration hook, `createSession.finish()` returns `recordsBroken`.
- `Resources/games/game-audio.js` — additive puzzle effect names; `createAudioControls` channel filtering for effect-only games.
- `Resources/games/sudoku-ui.js`, `crossword-ui.js`, `word-search-ui.js` — build-once/patch-in-place `draw()`, micro-feedback, celebration, audio effects; crossword numbering fix and active-entry highlight.
- `Resources/games/kinnoki-stack-ui.js` — motion overlay, dispatch/tide one-shots, landing ghost, cargo thumbnails, tide telegraph, score pops.
- `Resources/games/kinnoki-yard-ui.js` — ghost footprint preview, tray thumbnails, full-footprint hints, one-shot invalid feedback, score pops, throttled timer writes.
- `Resources/games/hub-ui.js` — Charts card entry; `.game-mode-actions` unchanged markup (CSS handles anchoring); copy “five” → “six”.
- `Resources/games/ui.js` — Charts controller + validator entries (literal pattern).
- `Resources/styles.css` — all polish rules and the Charts block, inside the Arcade Hall section; reduced-motion additions.
- `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift` — `games/kinnoki-charts` route; skeleton + `<noscript>` in `gamesMain`.
- `Content/games.md` — “five” → “six” description.
- `Tests/games/core.test.mjs`, `Tests/games/controllers.test.mjs` (only if class assertions change), `Tests/games/accessibility.test.mjs`, `Tests/games/routes.test.mjs`, `Tests/games/game-audio.test.mjs`.
- `AGENTS.md`, `CLAUDE.md` — document the sixth game and celebration module (Task 13).

## Shared Interface Contracts (all tasks refer here)

```js
// core.js (Task 1) — pure, non-breaking companion to completeRun.
// Returns the record types the given completion request would break
// (first-ever records count as broken). [] when run missing, mode
// mismatched, assisted, or no finite candidates improve on the stored
// records. Same guard semantics as completeRun.
export function recordsBrokenBy(store, request) // -> string[] e.g. ['time']

// controller-common.js (Task 2)
export function prefersReducedMotion() // -> boolean, false when matchMedia absent
export function createConfirmDialog(root, { title, body, confirmLabel, cancelLabel, onConfirm, onCancel }) // -> { open(), close(), dialog }

// createSession (Task 2): session.finish() return value gains
// recordsBroken: string[] (computed with recordsBrokenBy against the
// store state immediately before completeRun applies).

// celebration.js (Task 3)
export function celebrate({ root, reducedMotion, particleCount = 20 } = {}) // -> { dispose() }
// Mounts one aria-hidden .game-celebration overlay in root, removes
// itself when the last particle fires animationend, no-ops (returns a
// dispose that is a no-op) under reduced motion. Never uses setTimeout.

// controller-common.js completionPanel (Task 3) — new signature:
export function completionPanel({ elapsed, assisted, recordsBroken = [], playAnother })
// renders "New best time!" / "New best score!" etc. via
// RECORD_LABELS = { time: 'New best time!', moves: 'Fewest moves!', score: 'New best score!', combo: 'Best combo!' }
// in a p.game-complete-record when recordsBroken is non-empty.

// game-audio.js (Task 5 pre-req, done in Task 3): EFFECT map gains
// 'puzzle-place', 'puzzle-found', 'puzzle-error' names (semitones chosen
// in-key with the existing map); the existing 'completion' cue is reused
// for puzzle wins. createAudioControls(options) accepts
// { channels: ['music','effects'] } (default both) and renders only the
// listed channel rows — puzzle games pass { channels: ['effects'] }.

// kinnoki-charts.js (Task 10)
export function clueRuns(line)                    // number[] run lengths of a 0/1 array
export function buildClues(cells, size)           // { rows: number[][], columns: number[][] }
export function solveChart(clues, size)           // { solvable: boolean, grid: Int8Array|null } — line-solve to fixpoint; solvable=true only if EVERY cell is determined (0 or 1)
export function createChartsPuzzle({ difficulty, seed, previousSignatures }) // -> { definition } with { id, title, size, solution: number[] (0/1), clues }
export function createChartsPlay()                // -> { marks: [], selected: 0, completed: false, pencil-free }
export function reduceCharts(state, action)       // pure; actions below
export function validateChartsState(play, difficulty) // -> { valid: boolean }
// Charts reducer actions: { type:'select', index } { type:'move', dx, dy }
// { type:'cycle', index }  (blank -> filled -> marked -> blank)
// { type:'fill', index } { type:'mark', index } { type:'erase', index }
// { type:'hint' } (fills one incorrect-or-blank solution cell, marks run assisted upstream)
// { type:'check' } (flags wrong fills as errors, assisted upstream)
// marks values: 0 = blank, 1 = filled, 2 = marked-empty.
// completed === true iff the set of marks===1 exactly equals solution===1.

// kinnoki-charts-ui.js (Task 11)
export function renderCharts(root, store) // session game id 'kinnoki-charts'
```

CSS class contract (new classes; all defined in the Arcade Hall section of `Resources/styles.css`, all animated ones mirrored in the reduced-motion block):

| Class | Purpose |
| --- | --- |
| `.game-mode-actions` | hub card action wrapper: flex column, gap, `margin-top:auto` |
| `.game-celebration`, `.game-celebration-particle` | celebration overlay + particles |
| `.game-complete` (existing) | gains fade-up entrance keyframes |
| `.game-complete-record` | gold “New best!” line |
| `.is-celebrating` | staggered gold wave on puzzle cells at completion |
| `.is-rejected` | word-search invalid-drag shake/flash one-shot |
| `.is-active-entry` | crossword current-entry tint |
| `.is-same-digit` | sudoku same-digit highlight |
| `.sudoku-notes-grid`, `.sudoku-note` | 3×3 pencil-note mini-grid |
| `.stack-active-overlay`, `.stack-overlay-cell` | Stack tweened active piece |
| `.stack-cell.is-ghost` | Stack landing ghost footprint |
| `.stack-dock.is-tide-left`, `.stack-dock.is-tide-right` | tide telegraph edge glow |
| `.cargo-thumb`, `.cargo-thumb-cell` | mini shape thumbnails (Stack previews + Yard tray) |
| `.game-score-pop` | floating `+N ×combo` one-shot |
| `.yard-cell.is-ghost-valid`, `.yard-cell.is-ghost-invalid` | Yard footprint preview (invalid keeps stripe pattern cue) |
| `.yard-tray-piece.is-hint-flash` | hint tray flash |
| `.charts-*` | Charts board, clue strips (`.charts-clue.is-satisfied`), reveal (`.charts-cell.is-reveal`) |
| `.games-skeleton` styles via `.games-app:empty::before/::after` | CSS-only first-paint shimmer |

---

### Task 1: `recordsBrokenBy` in core.js

**Files:**
- Modify: `Resources/games/core.js` (below `completeRun`, ~line 404)
- Test: `Tests/games/core.test.mjs`

**Interfaces:**
- Consumes: existing `MODE_RECORDS`, `RECORD_STRATEGY`, `optionalSafeInteger`, store shape.
- Produces: `recordsBrokenBy(store, request) -> string[]` used by Task 2 (`session.finish`) and Task 8/9 (arcade completion flows).

- [ ] **Step 1: Write failing tests** in `Tests/games/core.test.mjs` (new `describe('recordsBrokenBy', ...)`), covering: first completion returns every supplied record type; better time (min strategy) returns `['time']`; worse time returns `[]`; assisted run returns `[]`; missing run returns `[]`; mode mismatch returns `[]`; max-strategy (`score`) improvement detection; non-finite candidates ignored.

```js
import { recordsBrokenBy } from '../../Resources/games/core.js';

test('first unassisted completion breaks every supplied record', () => {
  const store = storeWithRun('sudoku', { difficulty: 'easy', assisted: false });
  assert.deepEqual(
    recordsBrokenBy(store, { game: 'sudoku', now: NOW, records: { time: 120 } }),
    ['time'],
  );
});
test('slower time breaks nothing', () => {
  const store = storeWithRecord('sudoku', 'default', 'time', 'easy', 90);
  assert.deepEqual(
    recordsBrokenBy(store, { game: 'sudoku', now: NOW, records: { time: 120 } }),
    [],
  );
});
```

(Reuse the fixture builders already present in `core.test.mjs` — it has helpers that build v2 stores with runs; follow its local naming.)

- [ ] **Step 2: Run** `node --test Tests/games/core.test.mjs` — expect the new tests to FAIL (`recordsBrokenBy is not a function`).
- [ ] **Step 3: Implement** in `core.js`:

```js
export function recordsBrokenBy(store, request) {
  const { game, mode = 'default', records = {} } = request ?? {};
  const run = store.runs?.[game];
  if (!run || run.mode !== mode || run.assisted) return [];
  const bucket = store.stats?.games?.[game]?.modes?.[mode];
  if (!bucket) return [];
  const broken = [];
  for (const recordType of MODE_RECORDS[game][mode]) {
    const candidate = optionalSafeInteger(records[recordType]);
    if (candidate === null) continue;
    const current = bucket.records[recordType][run.difficulty];
    const improves = current === null
      || (RECORD_STRATEGY[recordType] === 'min' ? candidate < current : candidate > current);
    if (improves) broken.push(recordType);
  }
  return broken;
}
```

- [ ] **Step 4: Run** `node --test Tests/games/core.test.mjs` — all PASS.
- [ ] **Step 5: Commit** `feat(games): add recordsBrokenBy records-diff helper to core`

### Task 2: Motion helper, shared confirm dialog, finish() records

**Files:**
- Modify: `Resources/games/controller-common.js`
- Test: `Tests/games/controllers.test.mjs` (extend), `Tests/games/game-lifecycle.test.mjs` (only if lifecycle text changes — it should not)

**Interfaces:**
- Consumes: Task 1 `recordsBrokenBy`; existing `element()`, hub dialog pattern from `hub-ui.js` (`openConfirmationDialog`/`closeConfirmationDialog`, lines ~302–326) as the visual reference.
- Produces: `prefersReducedMotion()`, `createConfirmDialog(root, options)`, `session.finish()` result including `recordsBroken` (consumed by Tasks 3, 5–9, 11).

- [ ] **Step 1: Write failing tests**: `prefersReducedMotion` returns false on the fixture (no `matchMedia`) and true when a stubbed `matchMedia` reports `matches: true`; `createConfirmDialog` mounts a `dialog.game-dialog` with the given labels, `onConfirm` fires on confirm click, `onCancel` on cancel click, and `close()` removes it; `session.finish()` result contains `recordsBroken: ['time']` for a first unassisted completion (drive an existing puzzle session fixture from `controllers.test.mjs`).
- [ ] **Step 2: Run** `node --test Tests/games/controllers.test.mjs` — new tests FAIL.
- [ ] **Step 3: Implement.**

```js
export function prefersReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

export function createConfirmDialog(root, { title, body, confirmLabel = 'Continue', cancelLabel = 'Cancel', onConfirm, onCancel }) {
  const heading = element('h2', { text: title });
  const confirm = element('button', { type: 'button', 'data-dialog-confirm': '', text: confirmLabel });
  const cancel = element('button', { type: 'button', 'data-dialog-cancel': '', text: cancelLabel });
  const dialog = element('dialog', { class: 'game-dialog' }, heading,
    element('p', { text: body }),
    element('div', { class: 'game-dialog-actions' }, cancel, confirm));
  confirm.addEventListener('click', () => { close(); onConfirm?.(); });
  cancel.addEventListener('click', () => { close(); onCancel?.(); });
  function open() { root.append(dialog); dialog.showModal?.(); dialog.setAttribute('open', ''); }
  function close() { dialog.close?.(); dialog.remove(); }
  return { open, close, dialog };
}
```

  In `createSession` (~line 354), replace the `window.confirm(...)` guard: when a differing valid run exists and the user did not arrive via `continue=1`, open `createConfirmDialog(root, { title: 'Replace saved progress?', body: <existing confirm copy>, confirmLabel: 'Start new', cancelLabel: 'Keep playing', onConfirm: startFresh, onCancel: resumeExisting })` where `startFresh`/`resumeExisting` are the two existing branches. The session mount becomes: mount the shell first, then either proceed directly (no conflict) or open the dialog and defer the conflicting branch into the callbacks. Preserve current behavior exactly when no saved run conflict exists.
  In `finish()`, immediately before the `completeRun` call, compute `const recordsBroken = recordsBrokenBy(currentStore, request)` with the same request object, and include `recordsBroken` in the returned result object.
- [ ] **Step 4: Run** `node --test Tests/games/controllers.test.mjs Tests/games/controller-review.test.mjs Tests/games/controller-second-review.test.mjs Tests/games/final-review.test.mjs Tests/games/game-lifecycle.test.mjs` — all PASS (the review suites guard the confirm-flow regressions; if one pins `window.confirm`, update that assertion to the dialog in the same commit).
- [ ] **Step 5: Commit** `feat(games): reduced-motion helper, styled replace-progress dialog, records-aware finish`

### Task 3: Celebration module + completion panel + audio additions

**Files:**
- Create: `Resources/games/celebration.js`, `Tests/games/celebration.test.mjs`
- Modify: `Resources/games/controller-common.js` (`completionPanel`), `Resources/games/game-audio.js` (+ `Tests/games/game-audio.test.mjs`), `Resources/styles.css`, `Tests/games/accessibility.test.mjs`

**Interfaces:**
- Consumes: `prefersReducedMotion` (Task 2).
- Produces: `celebrate()` and the new `completionPanel` signature + `createAudioControls({ channels })` + effect names `puzzle-place|puzzle-found|puzzle-error` (consumed by Tasks 5–9, 11).

- [ ] **Step 1: Write failing tests.** `celebration.test.mjs`: `celebrate({ root })` mounts exactly one `.game-celebration[aria-hidden="true"]` containing `particleCount` particles; simulating `animationend` on every particle removes the overlay; `dispose()` removes it early; `celebrate({ root, reducedMotion: true })` mounts nothing. `game-audio.test.mjs`: new effect names schedule without throwing under the fake context; `createAudioControls({ channels: ['effects'] })` renders only the effects row. `controllers.test.mjs`: completion flow renders `.game-complete-record` with “New best time!” when `finish()` reports `recordsBroken: ['time']`, and no record line otherwise.
- [ ] **Step 2: Run** the three focused test files — FAIL.
- [ ] **Step 3: Implement.**

```js
// Resources/games/celebration.js
import { prefersReducedMotion } from './controller-common.js';

export function celebrate({ root, reducedMotion = prefersReducedMotion(), particleCount = 20 } = {}) {
  if (!root || reducedMotion) return { dispose: () => {} };
  const overlay = document.createElement('div');
  overlay.className = 'game-celebration';
  overlay.setAttribute('aria-hidden', 'true');
  let remaining = particleCount;
  const done = () => { remaining -= 1; if (remaining <= 0) dispose(); };
  for (let index = 0; index < particleCount; index += 1) {
    const particle = document.createElement('span');
    particle.className = 'game-celebration-particle';
    particle.style.setProperty('--particle-index', String(index));
    particle.addEventListener('animationend', done, { once: true });
    overlay.append(particle);
  }
  function dispose() { overlay.remove(); }
  root.append(overlay);
  return { dispose };
}
```

  `completionPanel`: add the `recordsBroken` parameter and, when non-empty, insert `element('p', { class: 'game-complete-record', text: labels })` (join multiple with ' · ') between the heading and the elapsed line, using the `RECORD_LABELS` map from the contracts section.
  `game-audio.js`: add the three `puzzle-*` names to the effect semitone map (pick semitones consistent with the existing musical key — reuse neighboring values, e.g. place = the existing placement effect's value, found = a fifth above, error = the existing invalid value); add the `channels` option to `createAudioControls` (default `['music','effects']`), rendering only listed rows and leaving preference wiring untouched.
  CSS (Arcade Hall section): `.game-celebration` = absolutely positioned inset-0 overlay, `pointer-events: none`; particles = small gold squares/diamonds animated with a `games-confetti-fall` keyframe (translateY + rotate + fade, duration staggered via `calc(var(--particle-index) * 40ms)` delay); `.game-complete` gains a `games-fade-up` entrance animation (~240 ms); `.game-complete-record` = gold accent text. Reduced-motion block: `.game-celebration { display: none }`, `.game-complete { animation: none }`.
  `accessibility.test.mjs`: add regex assertions that the reduced-motion block covers `.game-celebration` and `.game-complete`.
- [ ] **Step 4: Run** `node --test Tests/games/celebration.test.mjs Tests/games/game-audio.test.mjs Tests/games/controllers.test.mjs Tests/games/accessibility.test.mjs` — PASS.
- [ ] **Step 5: Commit** `feat(games): shared celebration module, record-aware completion panel, puzzle audio effects`

### Task 4: Shared CSS polish, hub fixes, first paint

**Files:**
- Modify: `Resources/styles.css`, `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift` (`gamesMain`), `Tests/games/accessibility.test.mjs`
- Test: `Tests/games/accessibility.test.mjs` (CSS assertions); visual verification deferred to Task 13.

**Interfaces:**
- Consumes: existing tokens (`--gold-500`, `--separator`, `--surface`, `--game-text-*`).
- Produces: the shared control-feedback rules and hub styles later tasks' classes slot into.

- [ ] **Step 1: Write failing accessibility-test additions**: reduced-motion coverage for `.game-card` entrance and the shared control transition rule; a pattern asserting `.game-mode-actions` exists in CSS with `margin-top: auto`.
- [ ] **Step 2: Run** `node --test Tests/games/accessibility.test.mjs` — FAIL.
- [ ] **Step 3: Implement CSS** (all inside the Arcade Hall block):
  - Shared control feedback: one grouped selector for `.game-toolbar button, .game-toolbar select, .game-controls button, .sudoku-number-pad button, .word-search-pan button, .stack-controls button, .yard-controls button, .yard-pan-controls button, .yard-tray-piece, .difficulty-links a, .charts-controls button` → `transition: border-color .15s ease, background-color .15s ease, transform .15s ease;` hover → `border-color: var(--gold-500);` active → `transform: scale(.97);` (44 px targets unchanged).
  - `.game-mode-actions { display: flex; flex-direction: column; gap: 0.75rem; margin-top: auto; }` and remove the now-dead `margin-top: auto` from `.difficulty-links` (styles.css:601).
  - Hover shadow fix at styles.css:594: compose `box-shadow: <existing resting shadow>, 0 0 0 1px <gold hairline>, <gold glow>` instead of replacing with `--shadow-card-hover`.
  - Per-card accents: for each of `game-card-sudoku|crossword|word-search|kinnoki-stack|kinnoki-yard|kinnoki-charts`, set `--card-accent` (six hues in the warm-metal family, all meeting 4.5:1 for the eyebrow text token they tint) and apply to `.game-card-eyebrow` color and a 2px top hairline on the card.
  - Staggered entrance: `@keyframes games-card-in` (fade-up 12px); `.games-hub .game-card { animation: games-card-in .4s ease both; }` with `nth-child(n)`-based `animation-delay` steps of 60 ms up to the sixth card.
  - Audio panel: `fieldset.game-audio-controls { border: 1px solid var(--separator); border-radius: 12px; background: var(--surface); padding: 0.75rem 1rem; }`, `.game-audio-channel { display: flex; align-items: center; gap: 0.75rem; }`, `.game-audio-channel input[type="range"] { accent-color: var(--gold-500); }`.
  - Dialog motion: `dialog.game-dialog[open] { animation: games-fade-up .2s ease; } dialog.game-dialog::backdrop { background: rgb(0 0 0 / 0.6); }`.
  - Board frames: change `.game-board` (:673), `.stack-dock` (:772), `.yard-board-scroll` (:856) borders from the 2px full-contrast color to `1px solid var(--separator)` plus an inset gold hairline via box-shadow, keeping ≥3:1 boundary contrast (verify the chosen hairline color against both themes with the tokens already measured in the accessibility test).
  - Skeleton: `.games-app:empty { min-height: 40vh; } .games-app:empty::before { content: ''; display: block; height: 200px; border-radius: 16px; background: linear-gradient(100deg, var(--surface) 40%, var(--fill) 50%, var(--surface) 60%); background-size: 200% 100%; animation: games-shimmer 1.2s linear infinite; }` + reduced-motion override.
  - Reduced-motion block additions for: card entrance, shimmer, dialog animation, shared control transitions.
- [ ] **Step 4: Modify `gamesMain`** in `KinNoKiTheme.swift`: append a `<noscript><p class="game-storage-notice">The Arcade Hall needs JavaScript. Everything runs and stays on your device.</p></noscript>` node inside `.games-app`'s parent `<main>` (Plot: `.element(named: "noscript", nodes: [...])`).
- [ ] **Step 5: Run** `node --test Tests/games/accessibility.test.mjs` — PASS. (`swift build` compiles; route-output assertions re-verified in Task 13 after `make generate`.)
- [ ] **Step 6: Commit** `feat(games): shared control feedback, hub card fixes and entrance, audio/dialog chrome, first-paint skeleton`

### Task 5: Sudoku patch-in-place + juice

**Files:**
- Modify: `Resources/games/sudoku-ui.js`, `Resources/styles.css`, `Tests/games/accessibility.test.mjs`
- Test: `Tests/games/sudoku.test.mjs` (engine untouched — must stay green), `Tests/games/controllers.test.mjs`

**Interfaces:**
- Consumes: `celebrate`, new `completionPanel`, `createAudioControls({ channels: ['effects'] })`, `puzzle-*` effects, `prefersReducedMotion`.
- Produces: the build-once/patch pattern the other two puzzle tasks copy.

- [ ] **Step 1: Write failing controller tests**: after mount, the board's 81 cell buttons are created once — dispatching a `select` action patches classes without replacing nodes (assert same object identity via `board.querySelector('[data-cell="0"]') === before`); same-digit highlight class `.is-same-digit` appears on cells sharing the selected value; pencil notes render as `.sudoku-notes-grid` with 9 `.sudoku-note` slots; completion adds `.is-celebrating` to cells and renders `.game-complete-record` on record runs.
- [ ] **Step 2: Run** `node --test Tests/games/controllers.test.mjs` — FAIL.
- [ ] **Step 3: Refactor `draw()`** in `sudoku-ui.js`: hoist cell/button creation out of `draw()` into mount (keep the exact DOM shape: row nodes, gridcell wrappers, buttons with `data-cell`, listeners bound once); `draw()` iterates 81 cells and patches `className`, `aria-label`, `tabindex`, `aria-selected`, and content. Content: when the cell has notes and no value, patch in a `.sudoku-notes-grid` (9 fixed `.sudoku-note` spans, text set per digit) instead of joined text; otherwise set plain text. Add `.is-same-digit` for cells whose value equals the selected cell's non-zero value; dim number-pad buttons via `disabled` once their digit appears 9 times in `state.values`. On completion (existing `state.completed && !completed` branch): add `.is-celebrating` to each cell with `style.setProperty('--cell-delay', ...)` staggered by distance from the last-placed cell, call `celebrate({ root })`, keep the existing panel/terminal flow (panel now shows records via Task 3). Wire audio: instantiate the shared game audio (effects only) at mount behind the store's audio preferences, fire `puzzle-place` on value placement, `puzzle-error` when new errors appear from `check`, `completion` cue on finish; mount `createAudioControls({ channels: ['effects'] })` into the toolbar area.
- [ ] **Step 4: CSS**: `.sudoku-cell { transition: background-color .12s ease, color .12s ease, outline-color .12s ease; }`; `.is-same-digit` tint (non-color cue: also `font-weight` bump); error shake keyframe `games-cell-shake` (~200 ms) applied on `.is-error`; `.is-celebrating { animation: games-cell-bloom .5s ease both; animation-delay: var(--cell-delay); }`; notes mini-grid (3×3 grid, tiny mono digits). Reduced-motion overrides + accessibility test patterns for `.is-celebrating` and the shake.
- [ ] **Step 5: Run** `node --test Tests/games/controllers.test.mjs Tests/games/sudoku.test.mjs Tests/games/accessibility.test.mjs Tests/games/final-review.test.mjs` — PASS.
- [ ] **Step 6: Commit** `feat(games): sudoku in-place rendering, same-digit and note polish, celebration and effects`

### Task 6: Crossword patch-in-place + active entry + numbering fix

**Files:**
- Modify: `Resources/games/crossword-ui.js`, `Resources/styles.css`, `Tests/games/accessibility.test.mjs`
- Test: `Tests/games/crossword.test.mjs`, `Tests/games/controllers.test.mjs`

**Interfaces:**
- Consumes: Task 5's pattern; engine helpers `entryFor(state)`/`positions()` already exported by `crossword.js`.
- Produces: nothing new shared.

- [ ] **Step 1: Write failing tests**: cell nodes stable across dispatches; every cell of the active entry carries `.is-active-entry` and the matching clue button `[data-clue]` carries `.is-active`; clue list items no longer render the double number (assert list item text does NOT match `/^\d+\.\s*\d+\./` — fix by removing the manual number prefix from the item text and letting the `<ol>` markers own numbering, or by switching the list to `<ul class="crossword-clues">` and keeping the clue's own number in the text; pick whichever matches current markup — the manual prefix lives in the clue-item construction in `crossword-ui.js`).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**: same build-once refactor as Task 5 for the crossword grid; in `draw()`, compute the active entry via `entryFor(state)` and patch `.is-active-entry` across its cells and `.is-active` on its clue button; scroll-free (no layout reads). Fix the numbering per the test. Completion: `.is-celebrating` wave along reading order + `celebrate` + audio (`puzzle-place` on letter entry, `puzzle-error` on check-found errors, `completion` on finish); mount effects-only audio controls.
- [ ] **Step 4: CSS**: `.crossword-cell` transition (same triple as sudoku); `.is-active-entry` tint mirroring sudoku's `.is-related` (styles.css:717); `.crossword-clues [data-clue].is-active` gold hairline; error shake reuse. Reduced-motion + accessibility patterns.
- [ ] **Step 5: Run** `node --test Tests/games/controllers.test.mjs Tests/games/crossword.test.mjs Tests/games/accessibility.test.mjs` — PASS.
- [ ] **Step 6: Commit** `feat(games): crossword active-entry highlight, clean clue numbering, in-place rendering`

### Task 7: Word Search feedback + patch-in-place

**Files:**
- Modify: `Resources/games/word-search-ui.js`, `Resources/styles.css`, `Tests/games/accessibility.test.mjs`
- Test: `Tests/games/word-search.test.mjs`, `Tests/games/controllers.test.mjs`, `Tests/games/controller-second-review.test.mjs` (pointer/pan regressions)

**Interfaces:**
- Consumes: Task 5's pattern.
- Produces: nothing new shared.

- [ ] **Step 1: Write failing tests**: cell nodes stable across `pointermove` preview updates (this is also the perf fix — no rebuild per move); an invalid endpoint selection applies `.is-rejected` to the previewed cells and announces “Not a word here.” via the live region, clearing on `animationend`; found words pop `.is-found` and the word-list item gains `.is-found-item` (strike-in).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**: build-once refactor; in the `select-endpoints` reject branch of the dispatch path (reducer stays pure — UI reads that the action produced no state change while a preview existed), apply `.is-rejected` to the preview cells, announce via the existing announcer, and remove the class on each cell's `animationend` (bind once at mount with a delegated listener on the board). Found-state: patch `.is-found` (cells) and `.is-found-item` (list). Completion wave + `celebrate` + audio (`puzzle-found` per found word, `completion` at finish); effects-only audio controls.
- [ ] **Step 4: CSS**: cell transitions; `games-cell-shake` reuse for `.is-rejected` plus a warning outline (non-color cue); `.is-found` pop keyframe (`games-cell-pop`, scale 1→1.08→1); `.word-search-list li.is-found-item { text-decoration: line-through; opacity: .7; transition: opacity .3s ease; }`. Reduced-motion + accessibility patterns.
- [ ] **Step 5: Run** `node --test Tests/games/controllers.test.mjs Tests/games/word-search.test.mjs Tests/games/controller-second-review.test.mjs Tests/games/accessibility.test.mjs` — PASS.
- [ ] **Step 6: Commit** `feat(games): word-search rejection cue, found-word pop, in-place rendering`

### Task 8: Kinnoki Stack juice

**Files:**
- Modify: `Resources/games/kinnoki-stack-ui.js`, `Resources/styles.css`, `Tests/games/accessibility.test.mjs`
- Test: `Tests/games/kinnoki-stack-ui.test.mjs`, `Tests/games/kinnoki-stack-loop.test.mjs`, `Tests/games/kinnoki-stack.test.mjs` (engine untouched)

**Interfaces:**
- Consumes: `celebrate`, `recordsBrokenBy` (via the terminal flow), `canPlace`/`placedCells` from `cargo-geometry.js`, existing events from `StackController.accept` (`dispatch`, `tide-shift`, `tide-warning`).
- Produces: `.cargo-thumb` thumbnail builder shared with Task 9 — implement it as `export function cargoThumb(cells, { patternClass, rotation = 0 })` in `Resources/games/controller-common.js` returning a `.cargo-thumb` element of positioned `.cargo-thumb-cell` divs (percentage-positioned from cell coordinates; no layout reads).

- [ ] **Step 1: Write failing UI tests**: active piece renders in a `.stack-active-overlay` positioned by CSS variables (`--piece-col`, `--piece-row`) rather than per-cell active classes (settled cells keep their classes); a `dispatch` event applies `.cargo-dispatching` to the dispatched cells and a `.game-score-pop` element appears with text `+<scoreAdded> ×<combo>` and removes itself on `animationend`; a `tide-warning` event sets `.is-tide-left` or `.is-tide-right` on `.stack-dock`; the hard-drop destination cells carry `.is-ghost`; next-cargo previews contain `.cargo-thumb` with the text label present as visually-hidden accessible text.
- [ ] **Step 2: Run** `node --test Tests/games/kinnoki-stack-ui.test.mjs` — FAIL.
- [ ] **Step 3: Implement** in `kinnoki-stack-ui.js`:
  - Overlay: one absolutely positioned `.stack-active-overlay` inside `.stack-dock`, containing the active piece's cells as `.stack-overlay-cell` divs (pattern class preserved). Position with `style.setProperty('--piece-col', column)` / `--piece-row`; CSS translates via `transform: translate(calc(var(--piece-col) * var(--stack-cell-size)), ...)` where `--stack-cell-size` is already derivable from the dock grid (define it in CSS as a percentage of dock width divided by column count — pure CSS math, no JS layout reads). `transition: transform .15s ease-out` gives the glide; tide shifts set a temporary `.is-tide-sliding` class for a longer eased transition. Gate all transitions behind `prefersReducedMotion()` (skip adding the transition class).
  - Keep `paintStack`'s settled-cell painting; stop painting the active piece into grid cells (the overlay owns it). Preserve `isClockOnlyTransition` fast path and the checkpoint throttle untouched.
  - Ghost: derive the hard-drop row with the same descent loop as `reduceActiveStack`'s `hard-drop` branch using `canPlace`; patch `.is-ghost` onto destination cells (dashed outline, low contrast, non-color cue = dashed style).
  - Events: in `StackController.accept`, on `dispatch` add `.cargo-dispatching` to cleared cells (remove on `animationend`), spawn the `.game-score-pop` (append near the dock header, positioned by CSS only, removed on `animationend`); on `tide-shift` add `.cargo-tide-shifting` to shifted cells; on `tide-warning` set the dock edge class per direction and clear it after the shift resolves.
  - Previews: replace text-only preview pills with `cargoThumb(...)` + `element('span', { class: 'visually-hidden', text: <existing label> })`.
  - Terminal flow: pass `recordsBroken` (computed with `recordsBrokenBy` before `completeRun`) into the terminal summary and fire `celebrate` on new records.
- [ ] **Step 4: CSS**: overlay + cell-size variables on `.stack-dock`; `.is-ghost` dashed outline; `.cargo-dispatching` flash/fade keyframe (`games-dispatch-flash`, ~350 ms); `.cargo-tide-shifting` nudge keyframe; `.is-tide-left/.is-tide-right` inset edge glow (gold, direction-side); `.game-score-pop` float-up-and-fade keyframe (~700 ms); `.cargo-thumb` mini-grid sizing. All in reduced-motion block (overlay transition → none; one-shots → none; the existing `.cargo-dispatching`/`.cargo-tide-shifting` reduced-motion entries at styles.css:972–982 already anticipate two of these). Accessibility test patterns for each new animated class.
- [ ] **Step 5: Run** `node --test Tests/games/kinnoki-stack-ui.test.mjs Tests/games/kinnoki-stack-loop.test.mjs Tests/games/kinnoki-stack.test.mjs Tests/games/accessibility.test.mjs` — PASS.
- [ ] **Step 6: Commit** `feat(games): stack motion overlay, dispatch and tide effects, landing ghost, cargo thumbnails, score pops`

### Task 9: Kinnoki Yard juice

**Files:**
- Modify: `Resources/games/kinnoki-yard-ui.js`, `Resources/styles.css`, `Tests/games/accessibility.test.mjs`
- Test: `Tests/games/kinnoki-yard-ui.test.mjs`, engine suites untouched

**Interfaces:**
- Consumes: `cargoThumb` (Task 8), `placedCells` from `cargo-geometry.js`, `celebrate`, `recordsBrokenBy`.
- Produces: nothing new shared.

- [ ] **Step 1: Write failing UI tests**: hovering/focusing a board cell with a selected tray piece applies `.is-ghost-valid` (placeable) or `.is-ghost-invalid` (not placeable) to the piece's full rotated footprint; tray pieces render `.cargo-thumb` with visually-hidden labels; a hint highlights every footprint cell (`.is-hint`) and flashes the tray piece (`.is-hint-flash`); an invalid placement applies a one-shot `.yard-cell-invalid-flash` cleared on `animationend` (the persistent `invalidCellKey` state write is removed in favor of the one-shot); the timer node's `textContent` is written at most once per displayed second (spy on the setter via the fixture pattern used by the Stack throttle test in `kinnoki-stack-ui.test.mjs`).
- [ ] **Step 2: Run** `node --test Tests/games/kinnoki-yard-ui.test.mjs` — FAIL.
- [ ] **Step 3: Implement**: ghost preview derives footprint via `placedCells(piece, rotation, origin)` on cell focus/hover (`focusin` + `pointerenter` delegated on the board, cleared on leave); patch classes only — reducer untouched. Tray: `cargoThumb` per piece honoring current rotation. Hint: extend the existing hint paint branch (`paintYardBoard` ~line 267) from origin-only to the full footprint + tray flash. Invalid placement: replace the persistent stripe state with the one-shot class + `animationend` cleanup (reduced motion: apply the existing static stripe class for one paint cycle instead, cleared on next event). Timer throttle: cache the last formatted string in `YardController.frame` (~line 796) and skip identical writes. Endless dispatch: reuse `.game-score-pop` and `.cargo-dispatching` from Task 8. Terminal: records-aware summary + `celebrate` on new records.
- [ ] **Step 4: CSS**: `.is-ghost-valid` (gold tint + solid outline), `.is-ghost-invalid` (reuses the existing invalid stripe `background-image` for the non-color cue + muted red tint), `.yard-cell-invalid-flash` shake keyframe, `.is-hint-flash` pulse keyframe, yard cell transitions. Reduced-motion + accessibility patterns.
- [ ] **Step 5: Run** `node --test Tests/games/kinnoki-yard-ui.test.mjs Tests/games/kinnoki-yard-contracts.test.mjs Tests/games/kinnoki-yard-endless.test.mjs Tests/games/accessibility.test.mjs` — PASS.
- [ ] **Step 6: Commit** `feat(games): yard ghost preview, tray thumbnails, footprint hints, one-shot invalid feedback`

### Task 10: Kinnoki Charts engine + catalog

**Files:**
- Create: `Resources/games/kinnoki-charts-content.js`, `Resources/games/kinnoki-charts.js`, `Tests/games/kinnoki-charts.test.mjs`

**Interfaces:**
- Consumes: `createRng`, `deriveSeed`, `chooseFreshDefinition` from `core.js`.
- Produces: the full engine API from the contracts section (consumed by Tasks 11–12).

- [ ] **Step 1: Write the catalog.** `kinnoki-charts-content.js` exports `CHART_CATALOG = Object.freeze({ easy: [...], medium: [...], hard: [...] })`. Entries use readable row strings (`'.'` empty, `'X'` filled) converted to arrays at module load. Minimums: 10 easy (5×5), 8 medium (10×10), 6 hard (15×15). Every picture must be line-solvable (Step 4's test is the gate — expect to iterate on the art until it passes). Harbour/brand motifs; each has `id` (kebab-case) and `title`. Seed examples (verify solvability via the test, adjust pixels if needed):

```js
{ id: 'anchor', title: 'Anchor', rows: ['..X..', '.XXX.', '..X..', 'X.X.X', '.XXX.'] },
{ id: 'crate', title: 'Cargo crate', rows: ['XXXXX', 'X..XX', 'X.X.X', 'XX..X', 'XXXXX'] },
{ id: 'buoy',  title: 'Harbour buoy', rows: ['..X..', '.XXX.', 'XXXXX', '.XXX.', '..X..'] },
{ id: 'hook',  title: 'Crane hook', rows: ['.XXX.', '.X.X.', '..X..', '.XX..', 'X.X..'] },
```

- [ ] **Step 2: Write failing engine tests** covering: `clueRuns([1,1,0,1]) → [2,1]` and `clueRuns([0,0]) → []`; `buildClues` round-trips a known picture; `solveChart` solves every catalog entry to completion and the solved grid equals the picture (THE quality gate — loop the whole catalog in one test); `solveChart` reports `solvable: false` for a known ambiguous pair (e.g. the 2×2 checkerboard clues `rows: [[1],[1]], columns: [[1],[1]]`); `createChartsPuzzle` is deterministic for a fixed seed and avoids the previous signature via `chooseFreshDefinition`; `reduceCharts` cycle/fill/mark/erase/move semantics and immutability (frozen state in, new object out); completion detection ignores marked-empty cells; `hint` fills one incorrect-or-blank solution cell; `check` flags wrong fills in `state.errors`; `validateChartsState` rejects hostile shapes (wrong length, non-array, bad mark values) and accepts a valid save.
- [ ] **Step 3: Run** `node --test Tests/games/kinnoki-charts.test.mjs` — FAIL.
- [ ] **Step 4: Implement the engine.** Line solver core (the only nontrivial algorithm — implement exactly this approach):

```js
// All arrangements of runs in a line of `size`, intersected to deductions.
// Returns null if no arrangement fits, else Int8Array of -1 unknown / 0 empty / 1 filled.
function lineDeductions(clue, line, size) {
  const always = new Int8Array(size).fill(-1);
  let any = false;
  const place = (runIndex, start, acc) => {
    if (runIndex === clue.length) {
      for (let i = start; i < size; i += 1) { if (line[i] === 1) return; acc[i] = 0; }
      merge(acc); any = true;
      return;
    }
    const run = clue[runIndex];
    for (let offset = start; offset + remaining(clue, runIndex) <= size; offset += 1) {
      if (line[offset - 1] === undefined || true) { /* boundary handled below */ }
      // cells before the run must be empty-compatible
      if (line[offset - 1] === 1) break; // can't skip past a known filled cell
      const acc2 = acc.slice();
      let ok = true;
      for (let i = start; i < offset; i += 1) { if (line[i] === 1) { ok = false; break; } acc2[i] = 0; }
      if (!ok) break;
      for (let i = offset; i < offset + run; i += 1) { if (line[i] === 0) { ok = false; break; } acc2[i] = 1; }
      if (ok && (offset + run === size || line[offset + run] !== 1)) {
        const acc3 = acc2.slice();
        if (offset + run < size) acc3[offset + run] = 0;
        place(runIndex + 1, offset + run + 1, acc3);
      }
    }
  };
  const merge = (candidate) => {
    for (let i = 0; i < size; i += 1) {
      if (always[i] === -1 && !any) always[i] = candidate[i];
      else if (always[i] !== candidate[i]) always[i] = -1;
    }
  };
  place(0, 0, new Array(size).fill(-1));
  return any ? always : null;
}
```

  (`remaining(clue, runIndex)` = sum of runs from `runIndex` plus one gap between each. `line` holds -1/0/1 current knowledge. `solveChart` builds a -1-filled grid, repeatedly applies `lineDeductions` to every row and column until a full pass changes nothing, then reports `solvable: grid.every(v => v !== -1)`. Cap iterations at `size * 4` passes as a safety bound — deterministic input makes runaway impossible, the cap just guards catalog mistakes.)
  Puzzle factory: pick from `CHART_CATALOG[difficulty]` via `chooseFreshDefinition` with a definition signature of the picture id; definition = `{ id, title, size, solution, clues: buildClues(solution, size) }`. Reducer and validator per the contracts section (plain object state `{ marks, selected, errors: [], completed }`).
- [ ] **Step 5: Run** `node --test Tests/games/kinnoki-charts.test.mjs` — PASS (iterate on catalog pixels until the solvability gate passes for every entry).
- [ ] **Step 6: Commit** `feat(games): kinnoki charts nonogram engine and pictogram catalog`

### Task 11: Kinnoki Charts controller + styles

**Files:**
- Create: `Resources/games/kinnoki-charts-ui.js`, `Tests/games/kinnoki-charts-ui.test.mjs`
- Modify: `Resources/styles.css`, `Tests/games/accessibility.test.mjs`

**Interfaces:**
- Consumes: engine API (Task 10), `createSession`, `sharedShell`, `completionPanel`, `makeGameTerminal`, `celebrate`, effects-only audio, `element()`.
- Produces: `renderCharts(root, store)` for Task 12's `ui.js` entry.

- [ ] **Step 1: Write failing controller tests** on the fixture: mount renders toolbar, clue strips (`.charts-clue-row` per row, `.charts-clue-column` per column, each clue rendered as text), and a `size×size` grid of `button.charts-cell` (44 px enforced via accessibility suite); grid built once, patched in place; arrow keys move selection (roving tabindex like sudoku); primary action cycles blank→filled→marked→blank; a satisfied line's clue gains `.is-satisfied`; hint/check mark the session assisted; completion applies `.is-reveal` to filled cells, shows the pictogram title in the completion flow, renders the records line, and disposes cleanly (no leaked listeners/frames per the `game-lifecycle` pattern); save/resume round-trips through `validateChartsState`.
- [ ] **Step 2: Run** `node --test Tests/games/kinnoki-charts-ui.test.mjs` — FAIL.
- [ ] **Step 3: Implement** `kinnoki-charts-ui.js` following `sudoku-ui.js`'s structure (session options: `game: 'kinnoki-charts'`, `createPuzzle: createChartsPuzzle`, `createPlay: createChartsPlay`, `validateRun: validateChartsState`, `progressed` = any non-blank mark). Board: build-once grid; cells show filled (block), marked (·/× glyph, `aria-label` “marked empty”), blank. Clue strips: row clues left of the grid, column clues above it (flex/grid layout, mono font); after each dispatch, compare `clueRuns` of the current line against the definition clue and toggle `.is-satisfied`. Completion sequence: set `--cell-delay` staggered by index on filled cells, add `.is-reveal` (bloom to gold), fade `.is-marked` cells via `.is-reveal-clear`, then `celebrate({ root })`, `makeGameTerminal(root)`, and `completionPanel({ ...result, playAnother })` with a heading line naming the pictogram (`Chart revealed: ${definition.title}`) — under reduced motion skip the stagger (cells swap state instantly). Audio: `puzzle-place` on fill, `puzzle-error` on check-flagged errors, `completion` cue at finish; effects-only controls.
- [ ] **Step 4: CSS** (new `Kinnoki Charts` subsection in the Arcade Hall block): `.charts-board` grid with clue gutters; `.charts-cell` states (`.is-filled` gold block, `.is-marked` dim glyph, `.is-error` reuse shake, `.is-related` crosshair tint on the selected row/column); `.charts-clue.is-satisfied { opacity: .45; text-decoration: line-through; }` (non-color cue = strikethrough); `.is-reveal` bloom keyframe; responsive sizing so 15×15 fits mobile (reuse the board-scroll pattern from sudoku). Reduced-motion overrides + accessibility patterns (`.is-reveal`, crosshair transition) + add `.charts-cell` and `.charts-controls button` to the 44 px selector loop in `accessibility.test.mjs`.
- [ ] **Step 5: Run** `node --test Tests/games/kinnoki-charts-ui.test.mjs Tests/games/accessibility.test.mjs Tests/games/game-lifecycle.test.mjs` — PASS.
- [ ] **Step 6: Commit** `feat(games): kinnoki charts controller, clue strips, reveal celebration`

### Task 12: Registration wiring + hub + route/test updates

**Files:**
- Modify: `Resources/games/core.js`, `Resources/games/ui.js`, `Resources/games/hub-ui.js`, `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift`, `Content/games.md`, `Tests/games/routes.test.mjs`, `Tests/games/core.test.mjs`
- Create: `Content/games/kinnoki-charts.md`
- Rename: `Tests/games/hub-five-games.test.mjs` → `Tests/games/hub-six-games.test.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: the public route `/games/kinnoki-charts`.

- [ ] **Step 1: Update tests first** (they define the contract):
  - `routes.test.mjs`: add `games/kinnoki-charts` to the route array, `kinnoki-charts.js` / `kinnoki-charts-ui.js` / `kinnoki-charts-content.js` / `celebration.js` to the resource array, the metadata-only assertion for the new content file, and the literal `ui.js` source assertions for the new controller + validator entries (copy the existing textual shape).
  - `git mv Tests/games/hub-five-games.test.mjs Tests/games/hub-six-games.test.mjs`; update the frozen `GAMES` deepEqual to include the Charts entry, the card count 5 → 6, and the “five” copy assertions to “six”.
  - `core.test.mjs`: `GAME_IDS` includes `kinnoki-charts`; store initialization materializes its `default` mode with a `time` record slot.
- [ ] **Step 2: Run** `node --test Tests/games/hub-six-games.test.mjs Tests/games/core.test.mjs` — FAIL.
- [ ] **Step 3: Implement wiring.**

```js
// core.js
export const GAME_IDS = Object.freeze([
  'sudoku', 'crossword', 'word-search', 'kinnoki-stack', 'kinnoki-yard', 'kinnoki-charts',
]);
// MODE_RECORDS gains:
  'kinnoki-charts': { default: ['time'] },
```

```js
// ui.js — runValidators gains (exact textual pattern):
  'kinnoki-charts': (run) => (
    validateChartsState(run?.puzzle?.play, run?.difficulty).valid
  ),
// controllers map gains:
    'kinnoki-charts': () => import('./kinnoki-charts-ui.js')
      .then(({ renderCharts }) => renderCharts(root, store)),
// plus the static import line:
import { validateChartsState } from './kinnoki-charts.js';
```

```swift
// KinNoKiTheme.swift, beside the existing cases:
case "games/kinnoki-charts":
    main = gamesMain(page: "kinnoki-charts")
    active = "/games"
```

```markdown
<!-- Content/games/kinnoki-charts.md (frontmatter-only, unquoted, ends after ---) -->
---
title: Kinnoki Charts
description: Fill row and column cargo tallies to reveal a small harbour chart, with three difficulty levels and local records.
image: /images/games/og.png
---
```

  `hub-ui.js` `GAMES` entry (match the existing object shape exactly — copy sudoku's field set):

```js
  {
    id: 'kinnoki-charts',
    title: 'Kinnoki Charts',
    eyebrow: 'Picture logic',
    blurb: 'Fill quiet row and column tallies until a small harbour chart appears.',
    modes: [{ id: 'default', label: 'New chart' }],
  },
```

  (`statsModel`/`recordMarkup`: the generic single-`time`-record branch used by the puzzle trio should apply; extend the per-game branches only if the suite shows Charts falling into a wrong branch.) Update the hub hero copy and `Content/games.md` description from “five” to “six” games.
- [ ] **Step 4: Run** `node --test Tests/games/hub-six-games.test.mjs Tests/games/core.test.mjs Tests/games/storage-v2.test.mjs` and `swift build` — PASS/compiles (route tests still pending Output regeneration).
- [ ] **Step 5: Commit** `feat(games): register kinnoki charts across store, router, theme, hub, and tests`

### Task 13: Integration — generate, full suite, browser verification, docs, PR

**Files:**
- Modify: `AGENTS.md`, `CLAUDE.md` (games sections: six games, celebration module, charts files), `Output/**` (generated only)

- [ ] **Step 1:** `make generate` (never hand-edit Output).
- [ ] **Step 2:** `make test-games` — the FULL suite including `routes.test.mjs` must PASS.
- [ ] **Step 3:** Serve locally (`make preview` or the launch.json dev server) and verify in the browser pane: hub (six cards, accents, entrance, anchored actions), each puzzle game (transitions, celebration, records line), Stack (gliding piece, dispatch flash, ghost, thumbnails, score pop), Yard (ghost preview, legible tray, hint footprint), Charts (full play-through on easy: clue satisfaction dimming, completion reveal). Screenshot the hub, Stack mid-run, and a completed Charts board as PR evidence. Check dark AND light themes plus a `prefers-reduced-motion` pass (emulate via the pane's colorScheme/media options or a quick CSS override sanity check).
- [ ] **Step 4:** Update `AGENTS.md` + `CLAUDE.md` Arcade Hall bullets (six games, new files, celebration module, `hub-six-games` test name).
- [ ] **Step 5:** Commit `docs: update agent docs for six-game arcade hall`, then `chore: regenerate site` for Output.
- [ ] **Step 6:** Push the branch and open the PR to `main` (`gh pr create --base main`), body summarizing the glow-up + Charts with the screenshots, and the standard Claude Code footer.

## Self-Review

- **Spec coverage:** Part 1 items 1–7 → Tasks 2–4; Part 2 puzzle trio → Tasks 5–7; Stack → Task 8; Yard → Task 9; Part 3 engine/controller/wiring → Tasks 10–12; testing/constraints → embedded per task + Task 13. No gaps found.
- **Placeholders:** none — every step names exact files, classes, functions, and commands; algorithmic core (line solver) is spelled out.
- **Type consistency:** `recordsBrokenBy` (Tasks 1/2/8/9), `celebrate` (3/5–9/11), `cargoThumb` (8/9), `renderCharts`/`validateChartsState`/`createChartsPuzzle`/`createChartsPlay` (10/11/12) — names match across tasks.

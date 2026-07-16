# Arcade Hall Glow-Up and Kinnoki Charts Design

**Date:** 2026-07-16
**Status:** Draft — awaiting approval by Dan Fakkeldy

**Public destinations:** all existing `/games` pages plus a new
`https://kinnokilabs.com/games/kinnoki-charts`

## Objective

Make the six Arcade Hall surfaces prettier, smoother, and more rewarding
without changing game rules, storage schema shape, or the privacy posture
(device-local, no accounts, no analytics, no third-party runtime
dependencies), and add a sixth game:

- **Kinnoki Charts**, a calm nonogram (picture-logic) puzzle where solving
  row and column cargo tallies reveals a small harbour pictogram drawn in
  the site's gold-on-black language.

Dan approved the direction on 2026-07-16: new game = nonogram
("Kinnoki Charts"), polish depth = full glow-up (shared layer plus
per-game juice; ambient extras such as view transitions, haptics, and
count-up stats are explicitly out of scope).

## Part 1 — Shared-layer polish (all games benefit)

1. **Control feedback.** One shared rule block in `Resources/styles.css`
   for `.game-toolbar button/select`, `.game-controls button`,
   `.sudoku-number-pad button`, `.word-search-pan button`,
   `.stack-controls button`, `.yard-controls button`,
   `.yard-pan-controls button`, `.yard-tray-piece`, `.difficulty-links a`,
   and the new Charts controls: hover moves borders to the gold hairline,
   `:active` scales to 0.97, transitions run ~150 ms, and every rule is
   covered by the reduced-motion block.
2. **Hub card fixes and identity.**
   - Style the `.game-mode-actions` wrapper (flex column, gap,
     `margin-top: auto`) so card actions anchor to the bottom again; the
     current `margin-top: auto` on `.difficulty-links` is dead
     (`styles.css:601` vs `hub-ui.js:271`).
   - Compose the hover shadow (resting shadow + gold glow) instead of
     replacing it with a smaller one (`styles.css:591,594`).
   - Use the emitted-but-unused `game-card-<id>` hook for a per-game
     accent custom property (symbol tint, eyebrow, top hairline) so the
     six cards stop reading as clones.
   - CSS-only staggered fade-up entrance for cards via `nth-child`
     animation delays (not the site `.reveal` observer, which runs before
     the hub DOM exists), gated by reduced motion.
3. **Celebration and records.**
   - `completeRun` in `Resources/games/core.js` (lines 366–404) already
     computes record updates but discards whether one was beaten; return a
     records diff (for example `recordsBroken: ['time']`) as a pure,
     backward-compatible addition.
   - New `Resources/games/celebration.js`: a small, dependency-free
     celebration utility (gold shimmer sweep plus CSS confetti particles)
     that no-ops under reduced motion and disposes cleanly through the
     session/lifecycle APIs.
   - `completionPanel` (`controller-common.js:690`) gains an entrance
     animation, "New best!" record context, and triggers the celebration
     plus the existing `completion` audio cue.
4. **Motion plumbing.** Export a `prefersReducedMotion()` helper from
   `controller-common.js` (no games JS checks it today) and gate every
   JS-driven animation on it. Every new CSS animation class gets a
   matching override in the reduced-motion block and a pattern assertion
   in `Tests/games/accessibility.test.mjs`.
5. **Chrome smoothness.** Style `fieldset.game-audio-controls` and
   `.game-audio-channel` rows (surface background, radius,
   `accent-color: var(--gold-500)` sliders); add open/backdrop transitions
   to the hub reset dialog; extract that styled dialog into a shared
   helper and use it to replace the `window.confirm` guard in
   `createSession` (`controller-common.js:354–361`).
6. **First paint.** `gamesMain` in `KinNoKiTheme.swift` (lines 380–397)
   gains a CSS-only skeleton shimmer and a `<noscript>` notice so /games
   pages are never a blank void before the module loads.
7. **Board frames.** Soften the harsh 2 px full-contrast borders on
   `.game-board`, `.stack-dock`, and `.yard-board-scroll` to the
   surface + separator + gold-hairline treatment used elsewhere, keeping
   at least 3:1 non-text contrast for play-area boundaries.

## Part 2 — Per-game juice

**Puzzle trio (Sudoku, Crossword, Word Search).**

- Replace the per-action `board.replaceChildren()` rebuild in all three
  `draw()` functions with build-once, patch-in-place rendering so CSS
  transitions can exist at all (also fixes Word Search's full-grid rebuild
  per `pointermove` on Hard). Reducers stay untouched.
- Cell micro-transitions (~120–150 ms) for selection, related, found, and
  preview states; brief shake keyframe when `.is-error` appears and fade
  when it clears; a staggered gold "wave" across the board on completion
  before the completion panel appears.
- Sudoku: same-digit highlighting, number-pad digits dim once placed nine
  times, pencil notes render as a 3×3 mini-grid instead of space-joined
  text.
- Crossword: highlight the full active entry and the matching clue button;
  fix the double numbering in clue lists (ordered-list numbers clash with
  clue numbers, rendering "1. 2. Rodent…").
- Word Search: rejected drags get a brief shake/flash cue plus a polite
  live-region note; found words get a cell pop and a strike-in transition
  in the word list.
- Wire `game-audio.js` one-shot effects (place, found, error, complete)
  into all three, mounting the existing `createAudioControls` fieldset so
  preferences reuse the shared store channels. No music arrangements for
  the puzzle games.

**Kinnoki Stack.**

- Active-piece motion overlay: an absolutely positioned layer above
  `.stack-dock` tweens `transform` between cells (~150 ms ease-out steps;
  a longer eased slide for tide shifts) instead of teleporting cell
  classes; the existing rAF loop, `isClockOnlyTransition` fast path, and
  checkpoint throttle are preserved.
- Implement the dispatch flash/fade and tide-shift nudge the CSS and
  accessibility tests already anticipate (`.cargo-dispatching`,
  `.cargo-tide-shifting`).
- Landing ghost: dashed low-contrast footprint at the hard-drop
  destination, derived with `canPlace` from `cargo-geometry.js`.
- Tide telegraphing: directional edge glow on the dock side the tide will
  push toward, intensifying through the existing warning thresholds.
- Next-cargo previews become mini shape thumbnails (small CSS-grid cells
  with the pattern fill) with the current text kept as accessible labels.
- Score juice: transient floating `+N ×combo` near dispatched manifests
  and a brief scale pop on the score stat.

**Kinnoki Yard.**

- Ghost footprint preview on hover/focus: the selected piece's full
  rotated footprint tints valid/invalid before committing (non-color
  pattern cue for invalid, per the accessibility contract).
- Tray pieces become the same mini shape thumbnails (fixes the
  text-over-pattern legibility problem); labels move to accessible text.
- Hints highlight the whole placement footprint and flash the matching
  tray piece.
- Invalid placement becomes a ~300 ms one-shot shake/flash cleared on a
  timer (reduced motion keeps the static stripe).
- Floating score popups on dispatch, and timer text writes throttled to
  changed strings.

## Part 3 — Kinnoki Charts (nonogram)

**Rules.** Fill a grid so each row and column matches its run-length
tallies. Cells cycle filled / marked-empty / blank. Finishing reveals a
named harbour pictogram.

**Engine** (`Resources/games/kinnoki-charts.js`, DOM-free):

- Curated pictogram catalog in `kinnoki-charts-content.js` (mirroring the
  crossword content pattern): hand-designed pixel art per difficulty —
  5×5 Easy, 10×10 Medium, 15×15 Hard — each with a title shown on reveal.
- A line solver proves every catalog entry has a unique solution; a test
  asserts this for the whole catalog, so unfair puzzles cannot ship.
- Seeded selection through `createRng`/`deriveSeed` with anti-repeat via
  `chooseFreshDefinition`; exports `validateChartsState` for saved-run
  validation; hints and checks mark the run assisted, like Sudoku.

**Controller** (`kinnoki-charts-ui.js`):

- Uses the `createSession` puzzle harness (autosave, timer, visibility
  pause) and builds the grid once with in-place patching from day one.
- Row/column clue strips that dim as their line is satisfied; crosshair
  row/column highlight from the focused cell; keyboard and pointer input
  with 44 px targets.
- Completion: marked-empty cells fade away, filled cells bloom to gold,
  the pictogram title is revealed, then the shared celebration and
  completion panel run. Reduced motion swaps this for a simple state swap.
- Puzzle-trio audio effect set (no music arrangement).

**Wiring (the eight-step contract).** Add the id to `GAME_IDS` and
`MODE_RECORDS` (time records, like Sudoku) in `core.js`; add the
controller entry and `runValidators` entry in `ui.js` following the
literal source patterns `routes.test.mjs` asserts; add the
`case "games/kinnoki-charts"` route in `KinNoKiTheme.swift`; add
frontmatter-only `Content/games/kinnoki-charts.md`
(`image: /images/games/og.png`); add the hub `GAMES` entry (eyebrow
"Picture logic", monogram tile) plus `statsModel`/`recordMarkup`
branches; update hub copy and `Content/games.md` description from "five"
to "six".

## Testing and constraints

- Run `make generate` before `make test-games`; routes tests read
  `Output/` directly.
- Update the hard-coded arrays in `routes.test.mjs`, the frozen `GAMES`
  deep-equal and five-card count in `hub-five-games.test.mjs` (renamed to
  `hub-six-games.test.mjs`), and the 44 px selector loop in
  `accessibility.test.mjs`, all in the same change as the code they pin.
- New tests: Charts engine (generation determinism, line solver,
  uniqueness of the full catalog, validators), Charts controller
  behavior on the DOM fixture, celebration module lifecycle (no leaked
  listeners/frames after dispose), `completeRun` records-diff.
- Controllers keep the fixture rules: `createElement`/`append` only (no
  `innerHTML`), listeners and frames only through `api.listenActive` /
  `api.requestActiveFrame` or session equivalents, no `setTimeout`-driven
  logic (the fixture ticks only `setInterval`/rAF), no layout reads.
- Every animation ships with its reduced-motion override; every new
  color-coded state ships a non-color cue.
- All records remain device-local; no new storage keys (store v2 slots
  materialize from `MODE_RECORDS`).

## Out of scope

- Cross-page view transitions, count-up hub stats, mobile haptics, a
  music arrangement for Charts, per-game og:image artwork, and any
  change to the shared og.png (its dimensions and hash are pinned by
  tests).
- Rule changes to existing games; storage schema breaking changes;
  third-party runtime dependencies.

## Risks

- The in-place-patching refactor of the three puzzle `draw()` functions is
  the widest-reaching change; reducers and controller contracts stay
  untouched, and the existing controller tests guard behavior.
- The Stack motion overlay must not regress the rAF fast path or
  checkpoint throttling; it layers above the existing cell painting
  rather than replacing it.
- Class names asserted by tests are a public contract; renames land with
  their test updates in the same commit.

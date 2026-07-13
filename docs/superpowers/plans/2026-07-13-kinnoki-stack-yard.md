# Kinnoki Stack and Kinnoki Yard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Kinnoki Stack and Kinnoki Yard to the KinNoKi Arcade Hall as original, accessible, deterministic browser games with three difficulty levels, local save/records, and adaptive procedural music.

**Architecture:** Extend the existing dependency-free ES-module game system with one shared versioned store, one pure cargo-geometry layer, two DOM-free game engines, one injectable Web Audio adapter, and two thin semantic-DOM controllers. Keep the current Sudoku, Crossword, and Word Search behavior intact; generate public routes and `Output/` through the Swift Publish pipeline only.

**Tech Stack:** Swift tools 5.5, macOS 12 package support, Publish 0.8, Plot, browser-native JavaScript ES modules, Web Audio API, CSS, Node's built-in test runner, and Cloudflare Pages.

**Design Spec:** [Kinnoki Stack and Kinnoki Yard Design](../specs/2026-07-12-kinnoki-stack-yard-design.md)

## Global Constraints

- Public routes are exactly `/games/kinnoki-stack` and `/games/kinnoki-yard`, in addition to the existing hub and three puzzle routes.
- Public studio casing remains **KinNoKi Labs**; **Kinnoki Stack** and **Kinnoki Yard** are the approved game-title spellings.
- Cargo clusters contain two through five cells and use a custom catalogue; do not use the standard seven four-cell pieces as the complete or defining set.
- Public copy, code, controls, art, music, effects, metadata, and generated output must not use Tetris branding, assets, branded terminology, copied scoring, copied trade dress, or affiliation language.
- Both games provide Easy, Medium, and Hard difficulty, deterministic replayable state, unlimited new runs, local save/resume, and device-local records.
- Kinnoki Yard includes both `contracts` and `endless` modes; saved Yard progress always retains its exact mode and difficulty.
- Initial audio preferences are music enabled at normalized volume `0.35` and effects enabled at normalized volume `0.50`; finite stored volumes are clamped to the inclusive `0...1` range.
- Audio, timing, gravity, animation, and gameplay listeners remain dormant until an explicit Start, Continue, or Resume gesture.
- Assisted completions count toward totals and streaks but cannot replace unassisted time, move, score, or combo records.
- Terminal Stack and Endless runs count even with zero dispatches; abandoned and replaced runs never count.
- All state remains on the device. Add no accounts, backend, cloud sync, online leaderboard, multiplayer, anti-cheat, analytics, ads, user uploads, paid content, downloadable music, or third-party runtime dependency.
- Preserve keyboard, touch, pointer, screen-reader, visible-focus, dark/light, OpenDyslexic, reduced-motion, large-text, and 44-by-44 CSS-pixel target behavior.
- Preserve the current Swift tools version, macOS deployment floor, Publish dependency, and site-wide brand casing.
- Never edit `Output/` by hand. Run `make generate` only after source and focused tests pass.
- Use Conventional Commits, stage only task-owned files, and keep the implementation branch separate from this plan branch.

## Execution Boundary

This document intentionally covers both games in one plan because storage, geometry, deterministic indexing, lifecycle, audio, records, hub rendering, and release verification are shared contracts. At execution time, first use `superpowers:using-git-worktrees` to create a clean `codex/kinnoki-stack-yard` feature branch from the latest `origin/main` after this plan PR has merged. Do not implement on `codex/kinnoki-stack-yard-plan`.

## Planned File Structure

### Create

- `Content/games/kinnoki-stack.md` — Stack title, description, and shared Games social image metadata.
- `Content/games/kinnoki-yard.md` — Yard title, description, and shared Games social image metadata.
- `Resources/games/cargo-geometry.js` — cargo catalogue, rotations, collision, placement, manifest shapes, connected components, serialization, and validation.
- `Resources/games/kinnoki-stack.js` — pure Stack state, reducer, cargo stream, tides, manifests, scoring, timing, Step Mode, validation, and text description.
- `Resources/games/kinnoki-stack-ui.js` — Stack semantic DOM, controls, lifecycle, persistence, audio mapping, announcements, and terminal summary.
- `Resources/games/kinnoki-yard.js` — Contract generator/solver/fallbacks, Contract reducer, Endless reducer, Yard facade, validation, and hints.
- `Resources/games/kinnoki-yard-ui.js` — Yard mode UI, roving focus, tray/cell controls, pan controls, persistence, audio mapping, and terminal summaries.
- `Resources/games/game-audio.js` — synthesized shared motif, Stack/Yard arrangements, effects, preference controls, scheduling, rate limiting, and silent fallback.
- `Tests/games/storage-v2.test.mjs` — v1-to-v2 migration, write-failure retention, idempotence, hostile data, typed records, and reset boundaries.
- `Tests/games/cargo-geometry.test.mjs` — catalogue, rotations, bounds, collision, identities, manifests, components, and hostile serialization.
- `Tests/games/kinnoki-stack.test.mjs` — Stack deterministic resolution, tides, scoring, dispatch, spawn, crane line, top-out, and immutability.
- `Tests/games/kinnoki-stack-loop.test.mjs` — automatic gravity, lock delay, pause, capped delta, Hard Drop, and Step Mode.
- `Tests/games/kinnoki-yard-solver.test.mjs` — fixed-placement exact-cover solving, dead ends, deterministic order, and operation bounds.
- `Tests/games/kinnoki-yard-generator.test.mjs` — generator bounds, solver proof, fallback diversity, transforms, difficulty, and repeat rejection.
- `Tests/games/kinnoki-yard-contracts.test.mjs` — Contract placement, rotations, exact moves, Undo, Hint, assistance, completion, and immutability.
- `Tests/games/kinnoki-yard-endless.test.mjs` — batches, placement, manifests, scoring, exhaustive terminal detection, Undo snapshots, and immutability.
- `Tests/games/game-audio.test.mjs` — fake-context audio lifecycle, motif, arrangements, intensity, effects, volume, rate limits, and fallback.
- `Tests/games/game-lifecycle.test.mjs` — explicit gesture boundary, active timing, visibility pause, once-only finish, and cleanup.
- `Tests/games/controller-common-cargo.test.mjs` — event announcements, separate audio controls, and recoverable cargo-game errors.
- `Tests/games/kinnoki-stack-ui.test.mjs` — Stack pre-play, semantics, controls, focus, events, save/resume, audio, and disposal.
- `Tests/games/kinnoki-yard-ui.test.mjs` — both Yard modes, roving focus, pan, Hint/Undo differences, save/resume, audio, and disposal.
- `Tests/games/hub-five-games.test.mjs` — five cards, mode-aware Continue, typed records, reset copy, and updated hub language.

### Modify

- `Content/games.md` — replace the three-game metadata description.
- `Resources/games/core.js` — v2 store, migration, typed records, audio preferences, deterministic stream seeds, and five-game state.
- `Resources/games/controller-common.js` — object-based core calls, explicit-start lifecycle, event announcements, recoverable errors, and cleanup helpers.
- `Resources/games/hub-ui.js` — five cards, Yard mode links, typed records, totals, and reset messaging.
- `Resources/games/ui.js` — validator-aware store opening and lazy dispatch for both new controllers.
- `Resources/styles.css` — five-card hub, cargo-family presentation, non-colour patterns, boards, controls, focus, responsive layout, and reduced motion.
- `Resources/images/games/og.png` — replace the raster that says “Three classics” with original five-game KinNoKi artwork.
- `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift` — route both new pages through `gamesMain(page:)`.
- `Tests/games/core.test.mjs` — v2 fixtures, typed record behavior, five-game stats, and legacy regressions.
- `Tests/games/dom-fixture.mjs` — deterministic animation frames and listener/frame inspection.
- `Tests/games/controllers.test.mjs` — use v2 storage fixtures while preserving existing puzzle behavior.
- `Tests/games/controller-review.test.mjs` — use v2 storage fixtures and retain cleanup/replacement regressions.
- `Tests/games/controller-second-review.test.mjs` — use v2 storage fixtures and retain pointer/pan regressions.
- `Tests/games/final-review.test.mjs` — use v2 storage fixtures and retain timing/completion/repeat regressions.
- `Tests/games/accessibility.test.mjs` — cargo selectors, patterns, target sizes, focus, overflow, and reduced motion.
- `Tests/games/routes.test.mjs` — two controllers, six destinations, updated metadata, and stale-copy rejection.
- `AGENTS.md` and `CLAUDE.md` — document both routes/modules and the v2 local-only game system.
- `Output/**` — generated by Publish in the final integration task only.

## Shared Data and Interface Contracts

### Store v2

```js
{
  version: 2,
  runs: {
    [gameId]: {
      game: 'sudoku' | 'crossword' | 'word-search' | 'kinnoki-stack' | 'kinnoki-yard',
      mode: 'default' | 'contracts' | 'endless',
      difficulty: 'easy' | 'medium' | 'hard',
      seed: 0,
      signature: 'stable-definition-signature',
      puzzle: { definition: {}, play: {} },
      startedAt: 0,
      elapsedBeforeStartMs: 0,
      assisted: false
    }
  },
  previousSeeds: { [historyKey]: 0 },
  previousSignatures: { [historyKey]: 'stable-definition-signature' },
  audio: {
    musicEnabled: true,
    musicVolume: 0.35,
    effectsEnabled: true,
    effectsVolume: 0.50
  },
  stats: {
    totalCompleted: 0,
    currentStreak: 0,
    lastCompletedDate: null,
    games: {
      [gameId]: {
        modes: {
          [mode]: {
            completed: 0,
            completedByDifficulty: { easy: 0, medium: 0, hard: 0 },
            records: {
              [recordType]: { easy: null, medium: null, hard: null }
            }
          }
        }
      }
    }
  }
}
```

Use `default` mode for Sudoku, Crossword, Word Search, and Stack; use `contracts` and `endless` for Yard. `historyKey(game, mode)` returns the game ID for `default` and `game + ':' + mode` otherwise. Time and moves records minimize; score and combo records maximize. Every accepted record is a non-negative safe integer.

### Core exports

```js
export const STORE_KEYS = Object.freeze({ v1: 'kinnoki-games:v1', v2: 'kinnoki-games:v2' });
export const GAME_IDS = Object.freeze([
  'sudoku', 'crossword', 'word-search', 'kinnoki-stack', 'kinnoki-yard',
]);
export const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
export const AUDIO_DEFAULTS = Object.freeze({
  musicEnabled: true, musicVolume: 0.35, effectsEnabled: true, effectsVolume: 0.50,
});

export function createEmptyGameStore();
export function createRng(seed);
export function deriveSeed(seed, attempt);
export function indexedSeed(seed, stream, index);
export function saturatingAdd(...values);
export function sanitizeAudioPreferences(value);
export function historyKey(game, mode = 'default');
export function legacyRunSignature(game, seed, definition);
export function chooseFreshDefinition(options);
export function openGameStore(storage, { runValidators = {} } = {});
// -> { store, migration: { state: 'v2'|'migrated'|'memory-only'|'empty', error?: Error } }
export function loadGameStore(storage, options);
export function saveGameStore(storage, store);
export function resetGameStore(storage);
export function startRun(store, {
  game, mode = 'default', difficulty, seed, signature, puzzle, now,
});
export function abandonRun(store, { game, expectedSignature = null });
export function markAssisted(store, game);
export function completeRun(store, {
  game, mode = 'default', now, records,
});
export function visibleElapsedMs(run, now, hiddenSince = null);
```

`indexedSeed` accepts only the named streams `cargo`, `manifest`, `tide`, `yard-batch`, `contract`, and `fallback`. It combines a fixed per-stream salt, the unsigned base seed, and a non-negative sequence index. Engines persist indices rather than hidden RNG closure state, so save/resume and Endless Undo reproduce exact future output.

### Geometry representation

Coordinates are plain objects shaped as `{ row: integer, column: integer }`. `pieceId` is one non-negative safe-integer type in every game, definition, action, placement, history snapshot, and board cell; string cargo IDs are invalid. Boards are rectangular arrays of rows; each entry is `null` or `{ pieceId, typeId }`. Rotations are canonical quarter-turn indices `0...3` after duplicate normalized rotations are removed.

A manifest carries the exact translated cells of one catalogue shape. `rotation` is a canonical rotation for that shape, and `cells` must equal `placedCells(rotationsForManifest(shapeId)[rotation].cells, origin)` after row-major sorting. A valid example is:

```js
{
  id: 'manifest-7',
  shapeId: 'step-five',
  rotation: 0,
  origin: { row: 12, column: 4 },
  label: 'Stepped five-cell manifest',
  pattern: 'diagonal',
  cells: [
    { row: 12, column: 4 },
    { row: 13, column: 4 },
    { row: 13, column: 5 },
    { row: 14, column: 5 },
    { row: 14, column: 6 },
  ],
}
```

Manifest shape pools are contractual and reused by Stack and Endless:

```js
export const MANIFEST_POOLS = Object.freeze({
  stack: Object.freeze({
    easy: Object.freeze(['rectangle-eight']),
    medium: Object.freeze([
      'rectangle-six', 'rectangle-eight', 'step-five', 'step-seven',
    ]),
    hard: Object.freeze(['step-five', 'step-seven', 'corner-six', 'harbour-seven']),
  }),
  endless: Object.freeze({
    easy: Object.freeze(['rectangle-eight']),
    medium: Object.freeze(['rectangle-six', 'step-five', 'step-seven']),
    hard: Object.freeze(['step-five', 'corner-six', 'harbour-seven']),
  }),
});
```

Public geometry exports:

```js
export const CARGO_CATALOG;
export const MANIFEST_SHAPES;
export class ManifestGenerationError extends Error;
export function normalizeCells(cells);
export function rotateCells(cells, quarterTurns = 1);
export function rotationsFor(typeId, allowedRotations = null);
export function rotationsForManifest(shapeId);
export function boundsFor(cells);
export function placedCells(cells, origin);
export function canPlace(board, cells, origin, { ignorePieceId = null } = {});
export function placePiece(board, piece);
export function removePiece(board, pieceId);
export function connectedComponents(board);
export function isManifestComplete(board, manifest);
export function dispatchCompletedManifests(board, manifests);
export function selectManifestZones({
  board, width, height, shapeIds, seed, index, count, occupied = [],
});
export function selectNextManifestZones({
  board, width, height, shapeIds, seed, startIndex, count,
  occupied = [], maxAttempts = 64,
});
export function validateBoard(value, { width, height });
export function validateManifest(value, { width, height });
```

### Definitions, signatures, and non-repeating selection

Definitions are immutable and saved separately from mutable play state:

```js
// StackDefinition
{
  version: 1,
  game: 'kinnoki-stack',
  mode: 'default',
  difficulty: 'easy' | 'medium' | 'hard',
  seed: 0,
  width: 12,
  height: 18,
}

// ContractDefinition
{
  version: 1,
  game: 'kinnoki-yard',
  mode: 'contracts',
  difficulty: 'easy' | 'medium' | 'hard',
  seed: 0,
  width: 3,
  height: 4,
  target: [0, 1, 2, 3].flatMap((row) => (
    [0, 1, 2].map((column) => ({ row, column }))
  )),
  pieces: [0, 1, 2, 3].map((pieceId) => ({
    pieceId,
    typeId: 'barge-three',
    allowedRotations: [0, 1],
    initialRotation: 0,
    trayIndex: pieceId,
  })),
  witness: [0, 1, 2, 3].map((pieceId) => ({
    pieceId, rotation: 0, row: pieceId, column: 0,
  })),
  generation: {
    usedFallback: false,
    attempt: 0,
    sourceId: null,
    transformId: 'identity',
    operations: 0,
  },
}

// EndlessDefinition
{
  version: 1,
  game: 'kinnoki-yard',
  mode: 'endless',
  difficulty: 'easy' | 'medium' | 'hard',
  seed: 0,
  width: 10,
  height: 10,
}
```

`stackDefinitionSignature` is stable JSON of `[version, game, mode, difficulty, seed, width, height]`. `endlessSignature` uses the same ordered fields. `contractSignature` is stable JSON of the version/mode/difficulty, row-major target cells, and pieces sorted by numeric `pieceId` with `[pieceId, typeId, allowedRotations, initialRotation, trayIndex]`; it deliberately excludes `witness` and `generation` metadata.

```js
export function createStackDefinition({ difficulty, seed });
export function stackDefinitionSignature(definition);
export function createStackState(definition);
export function createEndlessDefinition({ difficulty, seed });
export function endlessSignature(definition);
export function createEndlessState(definition);
export function contractSignature(definition);
export function yardDefinitionSignature(definition);

export function chooseFreshDefinition({
  game,
  mode,
  difficulty,
  initialSeed,
  previousSeed = null,
  previousSignature = null,
  abandonedSignature = null,
  createDefinition,
  signatureOf,
});
// -> { definition, seed, signature }
```

`chooseFreshDefinition` evaluates exactly 64 candidates: candidate zero is `initialSeed`; candidate `n` for `1...63` is `deriveSeed(initialSeed, n - 1)`. It rejects a candidate when its seed equals `previousSeed` or its signature equals `previousSignature` or `abandonedSignature`; it throws a recoverable generation error after 64 rejected candidates. Existing puzzle controllers use the same helper with `puzzleSignature`. Restart recreates play from the current saved definition and keeps its seed/signature. New Run/New Puzzle/New Yard invokes this helper and therefore replaces the current definition with a non-repeating candidate. A declined replacement makes no engine, store, seed, or lifecycle change. An accepted replacement first calls `abandonRun` with the current signature, persists removal without touching history/totals/streaks, then renders an unsaved inert preview; `startRun` is called only on the next explicit Start.

### Engine actions, events, and transitions

Every reducer returns `{ state, events }`, never mutates input, and returns the identical state plus `[]` for actions after `terminal`, `error`, or `disposed`. `advanceStackTime(state, deltaMs)` is the only automatic-clock entry point; there is no second `tick` action.

```js
// StackAction
{ type: 'start' }
{ type: 'pause', reason: 'user' | 'hidden' }
{ type: 'resume' }
{ type: 'move', deltaColumn: -1 | 1 }
{ type: 'rotate', quarterTurns: 1 }
{ type: 'soft-drop' }
{ type: 'hard-drop' }
{ type: 'set-step-mode', enabled: boolean }
{ type: 'advance-step' }

// YardAction, shared by both modes unless noted
{ type: 'start' }
{ type: 'pause', reason: 'user' | 'hidden' }
{ type: 'resume' }
{ type: 'select-piece', pieceId: non-negative-safe-integer }
{ type: 'rotate-piece', quarterTurns: 1 }
{ type: 'place-piece', row: integer, column: integer }
{ type: 'undo' }
{ type: 'hint' } // Contract only; Endless emits invalid
```

All controllers use the following exact event payloads and never infer domain changes by comparing DOM, score, or state snapshots:

```js
// Common lifecycle and error events
{ type: 'started' }
{ type: 'paused', reason: 'user' | 'hidden' }
{ type: 'resumed' }
{ type: 'assisted', reason: 'step-mode' | 'hint' | 'endless-undo' }
{ type: 'invalid', action: string, reason: string }
{ type: 'error', code: 'manifest-generation' | 'invalid-state', message: string }

// Stack events
{ type: 'moved', source: 'player' | 'gravity' | 'step', row: integer, column: integer }
{ type: 'rotated', pieceId: integer, rotation: 0 | 1 | 2 | 3 }
{ type: 'placed', pieceId: integer, cellCount: integer, scoreAdded: integer }
{ type: 'spawned', pieceId: integer, typeId: string, preview: Array<object> }
{ type: 'tide-warning', direction: 'left' | 'right', placementsRemaining: integer }
{ type: 'tide-shift', direction: 'left' | 'right', movedComponents: integer }
{ type: 'dispatch', manifestIds: Array<string>, cells: integer, combo: integer,
  scoreAdded: integer }
{ type: 'combo-reset', previousCombo: integer }
{ type: 'terminal', reason: 'crane-line' | 'spawn-blocked' }

// Yard events
{ type: 'selected', pieceId: integer }
{ type: 'rotated', pieceId: integer, rotation: 0 | 1 | 2 | 3 }
{ type: 'placed', mode: 'contracts', pieceId: integer, row: integer, column: integer,
  rotation: integer, move: integer }
{ type: 'placed', mode: 'endless', pieceId: integer, row: integer, column: integer,
  rotation: integer, scoreAdded: integer }
{ type: 'repositioned', mode: 'contracts', pieceId: integer, row: integer,
  column: integer, rotation: integer, move: integer }
{ type: 'undone', mode: 'contracts', move: integer, assisted: false }
{ type: 'undone', mode: 'endless', assisted: true }
{ type: 'hint', pieceId: integer, row: integer, column: integer, rotation: integer }
{ type: 'hint-dead-end', message: string }
{ type: 'dispatch', manifestIds: Array<string>, cells: integer, combo: integer,
  scoreAdded: integer }
{ type: 'combo-reset', previousCombo: integer }
{ type: 'completed', moves: integer }
{ type: 'terminal', reason: 'no-placement' }
```

Action-to-event mapping is exact: accepted Stack `move`/`soft-drop` and an `advance-step` that changes the active row produce `moved`; `rotate` produces `rotated`; a lock produces `placed`; Contract and Endless `place-piece` use the state’s selected rotation and produce `placed` for a new piece or `repositioned` for an existing piece. The first blocked Step Advance changes `grounded` to `{ kind: 'step', blockedOnce: true }` with no event, and the second blocked Step Advance locks and therefore produces `placed` plus any lock-resolution events. A rejected action produces only `invalid`. Automatic gravity may produce `moved` but controllers exclude `source: 'gravity'` from announcements and effects.

The state transition table is shared by both engines: `preview + start -> active`; `active + pause -> paused`; `paused + resume -> active`; successful completion/top-out/no-placement moves to `terminal`; internal validation or exhausted manifest selection moves to `error` and emits one `error`; New Run is a controller operation that discards the state and creates a fresh definition. Gameplay actions outside `active` return `invalid`, except lifecycle actions that are already in their target state return unchanged state and no events. Stack `set-step-mode` is the sole settings exception: it is accepted in `active` or `paused` so a keyboard user can configure Step Mode before an explicit Resume; it never advances play while paused.

### State and completion payloads

Stack state contains its definition, board, active piece, and a `preview` queue holding exactly `STACK_CONFIG[difficulty].previewCount` upcoming cargo descriptors. `sequenceIndex` is the stream index of `active`; spawning shifts `preview[0]` into active, increments `sequenceIndex`, and appends exactly one descriptor at `sequenceIndex + previewCount`. Save/resume therefore preserves active cargo and the exact future queue.

Contract state uses `placements: { [pieceId]: { pieceId, typeId, rotation, row, column } }`; the solver returns `{ status: 'solved', placements, operations }`, `{ status: 'dead-end', placements: [], operations }`, or `{ status: 'limit', placements: [], operations }`. Existing placements are fixed constraints. A solved Hint always chooses the first solver placement for an unplaced piece; it never proposes moving a placed piece.

Completion helpers return these exact serializable shapes:

```js
// stackCompletionPayload
{
  game: 'kinnoki-stack',
  mode: 'default',
  records: { score: state.score, combo: state.bestCombo },
  summary: {
    score: state.score,
    dispatchedManifests: state.dispatchedManifests,
    bestCombo: state.bestCombo,
    elapsedMs,
    assisted: state.assisted,
    reason: state.terminalReason,
  },
}

// yardCompletionPayload for a completed Contract
{
  game: 'kinnoki-yard',
  mode: 'contracts',
  records: { time: elapsedMs, moves: state.moves },
  summary: {
    elapsedMs,
    moves: state.moves,
    assisted: state.assisted,
    piecesPlaced: Object.keys(state.placements).length,
    totalPieces: state.definition.pieces.length,
  },
}

// yardCompletionPayload for terminal Endless Yard
{
  game: 'kinnoki-yard',
  mode: 'endless',
  records: { score: state.score, combo: state.bestCombo },
  summary: {
    score: state.score,
    dispatchedManifests: state.dispatchedManifests,
    bestCombo: state.bestCombo,
    elapsedMs,
    assisted: state.assisted,
    reason: 'no-placement',
  },
}
```

Engine assistance and record assistance are one invariant, stored in two places for validation and resume: whenever a successful reducer transition changes `state.assisted` from false to true, the controller must call `markAssisted(store, game)` before saving the updated `puzzle.play`. Before `completeRun`, controllers assert `run.assisted === state.assisted`; if a validated resumed play is already assisted while its generic envelope is false, normalize the envelope with `markAssisted` before the run can resume. Hint and Endless Undo therefore count toward totals/streaks but can never replace unassisted records.

### Audio and explicit lifecycle

```js
export function createGameAudio({
  audioContextFactory,
  preferences,
  onNotice,
  monotonicNow,
  setIntervalFn,
  clearIntervalFn,
  setTimeoutFn,
  clearTimeoutFn,
});
// -> {
//   start({ arrangement: 'stack'|'yard' }),
//   resume(),
//   pause(),
//   stop(),
//   dispose(),
//   finish({ outcome: 'completion'|'terminal' }),
//   setPreferences(preferences),
//   setIntensity({ height, tidePressure }),
//   playEffect(name),
//   debugState()
// }

export function createGameLifecycle({
  root,
  initialElapsedMs,
  monotonicNow,
  onActivate,
  onPause,
  onSnapshot,
  onError,
  onDispose,
});
// -> {
//   state, elapsed(), start(kind), pause(reason), finish(), fail(error), dispose(),
//   listenActive(target, type, listener), requestActiveFrame(callback)
// }
```

The lifecycle states are `preview`, `active`, `paused`, `terminal`, `disposed`, and `error`. `start(kind)` accepts `start`, `continue`, or `resume`, and is the only path that may initialize/resume audio, start active timing, attach gameplay listeners, or schedule frames. `fail(error)` cancels active frames/listeners, snapshots elapsed state once, enters `error`, and calls `onError` once; New Game disposes the failed controller before constructing a new definition. Hiding the document pauses and snapshots; becoming visible never resumes automatically.

`debugState()` is a test-only immutable snapshot `{ started, arrangement, tempo, contextState, schedulerActive, activeSources, activeEffectVoices, musicGain, effectsGain, layerGains, intensity, nextNoteIndex, nextNoteTime, noticeShown, disposed }`. `finish()` is the sole owner of normal completion/terminal audio: it plays exactly one completion cadence or terminal effect, ramps both gains to zero over 900 ms, and self-disposes at 1000 ms. Controller event-to-effect mapping must skip engine `completed` and `terminal` events and call only `audio.finish({ outcome })` for those transitions; it must not call `playEffect('completion')` or `playEffect('terminal')` on the same path. Controllers call lifecycle `finish()` immediately to freeze state/listeners, but do not call audio `stop()` or `dispose()` on that terminal path; navigation/replacement may still dispose audio early. Fake-clock tests advance 1000 ms and assert exactly one ending request plus zero timers/sources, preventing the required ending sound from being duplicated, cancelled, or leaked.

---

### Task 1A: Versioned local storage, typed records, and three-game hub compatibility

**Files:**
- Create: `Tests/games/storage-v2.test.mjs`
- Modify: `Resources/games/core.js:1-251`
- Modify: `Resources/games/hub-ui.js:1-105`
- Modify: `Tests/games/core.test.mjs`

**Interfaces:**
- Consumes: `Storage`-compatible objects, the existing sanitized v1 schema, per-game `runValidators[game](run) -> boolean`, and the existing puzzle session.
- Produces: every core export and the exact Store v2 contract above. Later engines rely on `indexedSeed`, `saturatingAdd`, object-form `startRun`, and object-form `completeRun`.

- [ ] **Step 1: Write failing migration transaction tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_DEFAULTS, STORE_KEYS, openGameStore,
} from '../../Resources/games/core.js';

const memoryStorage = (initial = {}, failV2Write = false) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (failV2Write && key === STORE_KEYS.v2) throw new Error('quota');
      values.set(key, String(value));
    },
    removeItem: (key) => values.delete(key),
  };
};

const legacy = {
  version: 1,
  runs: {
    sudoku: {
      difficulty: 'medium', seed: 41, puzzle: { definition: { puzzle: [], solution: [] } },
      startedAt: 1000, elapsedBeforeStartMs: 8000, assisted: false,
    },
  },
  previousSeeds: { sudoku: 40 },
  stats: {
    totalCompleted: 7, currentStreak: 3, lastCompletedDate: '2026-07-12',
    games: {
      sudoku: { completed: 4, bestMs: { easy: 20000, medium: 30000, hard: null } },
      crossword: { completed: 2, bestMs: { easy: null, medium: 45000, hard: null } },
      'word-search': { completed: 1, bestMs: { easy: 18000, medium: null, hard: null } },
    },
  },
};

test('v1 migrates once and is removed only after v2 persists', () => {
  const storage = memoryStorage({ [STORE_KEYS.v1]: JSON.stringify(legacy) });
  const opened = openGameStore(storage);
  assert.equal(opened.migration.state, 'migrated');
  assert.equal(opened.store.version, 2);
  assert.equal(opened.store.stats.totalCompleted, 7);
  assert.equal(opened.store.stats.games.sudoku.modes.default.records.time.easy, 20000);
  assert.equal(opened.store.runs.sudoku.game, 'sudoku');
  assert.equal(opened.store.runs.sudoku.mode, 'default');
  assert.match(opened.store.runs.sudoku.signature, /^legacy:v1:sudoku:/);
  assert.equal(opened.store.previousSeeds.sudoku, 40);
  assert.deepEqual(opened.store.previousSignatures, {});
  assert.deepEqual(opened.store.audio, AUDIO_DEFAULTS);
  assert.equal(storage.getItem(STORE_KEYS.v1), null);
  assert.ok(storage.getItem(STORE_KEYS.v2));
  assert.deepEqual(openGameStore(storage).store, opened.store);
});

test('failed v2 write preserves v1 and returns the in-memory migration', () => {
  const storage = memoryStorage({ [STORE_KEYS.v1]: JSON.stringify(legacy) }, true);
  const opened = openGameStore(storage);
  assert.equal(opened.migration.state, 'memory-only');
  assert.match(opened.migration.error.message, /quota/);
  assert.ok(storage.getItem(STORE_KEYS.v1));
  assert.equal(storage.getItem(STORE_KEYS.v2), null);
  assert.equal(opened.store.stats.totalCompleted, 7);
});

test('loading migrated v2 is idempotent and never re-reads stale v1', () => {
  const storage = memoryStorage({ [STORE_KEYS.v1]: JSON.stringify(legacy) });
  const first = openGameStore(storage);
  storage.setItem(STORE_KEYS.v1, JSON.stringify({ ...legacy, stats: { totalCompleted: 99 } }));
  const second = openGameStore(storage);
  assert.deepEqual(second.store, first.store);
  assert.equal(second.migration.state, 'v2');
});
```

- [ ] **Step 2: Write failing typed-record, isolation, reset, and audio-sanitization tests**

```js
import {
  completeRun, createEmptyGameStore, resetGameStore,
  sanitizeAudioPreferences, startRun,
} from '../../Resources/games/core.js';

test('record strategies are explicit and assisted completions never replace records', () => {
  let store = createEmptyGameStore();
  store = startRun(store, {
    game: 'kinnoki-yard', mode: 'contracts', difficulty: 'hard',
    seed: 9, signature: 'contract-9', puzzle: {}, now: 100,
  });
  store = completeRun(store, {
    game: 'kinnoki-yard', mode: 'contracts', now: 2100,
    records: { time: 2000, moves: 31, score: 999 },
  });
  const bucket = store.stats.games['kinnoki-yard'].modes.contracts;
  assert.equal(bucket.completed, 1);
  assert.equal(bucket.completedByDifficulty.hard, 1);
  assert.equal(bucket.records.time.hard, 2000);
  assert.equal(bucket.records.moves.hard, 31);
  assert.equal(bucket.records.score, undefined);
});

test('audio values clamp without touching site theme preferences', () => {
  assert.deepEqual(sanitizeAudioPreferences({
    musicEnabled: false, musicVolume: 7, effectsEnabled: true, effectsVolume: -2,
  }), {
    musicEnabled: false, musicVolume: 1, effectsEnabled: true, effectsVolume: 0,
  });
  const storage = memoryStorage({
    [STORE_KEYS.v2]: JSON.stringify(createEmptyGameStore()),
    'kinnoki-theme': 'light',
    'kinnoki-dyslexic': 'true',
  });
  assert.equal(resetGameStore(storage).ok, true);
  assert.equal(storage.getItem(STORE_KEYS.v2), null);
  assert.equal(storage.getItem('kinnoki-theme'), 'light');
  assert.equal(storage.getItem('kinnoki-dyslexic'), 'true');
});

test('one hostile run is dropped without touching unrelated runs or stats', () => {
  const value = createEmptyGameStore();
  value.runs.sudoku = {
    game: 'sudoku', mode: 'default', difficulty: 'easy', seed: 3,
    signature: 'sudoku-3', puzzle: { definition: {}, play: {} },
    startedAt: 10, elapsedBeforeStartMs: 20, assisted: false,
  };
  value.runs['kinnoki-stack'] = {
    game: 'kinnoki-stack', mode: 'default', difficulty: 'hard', seed: 4,
    signature: 'stack-4', puzzle: { definition: {}, play: { board: [['forged']] } },
    startedAt: 10, elapsedBeforeStartMs: 20, assisted: false,
  };
  value.stats.totalCompleted = 9;
  const storage = memoryStorage({ [STORE_KEYS.v2]: JSON.stringify(value) });
  const opened = openGameStore(storage, {
    runValidators: {
      sudoku: () => true,
      'kinnoki-stack': () => false,
    },
  });
  assert.ok(opened.store.runs.sudoku);
  assert.equal(opened.store.runs['kinnoki-stack'], undefined);
  assert.equal(opened.store.stats.totalCompleted, 9);
  assert.deepEqual(opened.store.audio, AUDIO_DEFAULTS);
});
```

- [ ] **Step 3: Run the focused store tests and verify the red state**

Run: `node --test Tests/games/storage-v2.test.mjs Tests/games/core.test.mjs`
Expected: FAIL because Store v2 constants, migration status, typed buckets, and object-form completion do not exist.

- [ ] **Step 4: Add Store v2 constants, safe integers, deterministic stream seeds, and audio sanitization**

Use these exact salts so adding a manifest draw never changes the cargo stream:

```js
export const STORE_KEYS = Object.freeze({
  v1: 'kinnoki-games:v1',
  v2: 'kinnoki-games:v2',
});
export const GAME_IDS = Object.freeze([
  'sudoku', 'crossword', 'word-search', 'kinnoki-stack', 'kinnoki-yard',
]);
export const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
export const AUDIO_DEFAULTS = Object.freeze({
  musicEnabled: true,
  musicVolume: 0.35,
  effectsEnabled: true,
  effectsVolume: 0.50,
});

const STREAM_SALTS = Object.freeze({
  cargo: 0xA341316C,
  manifest: 0xC8013EA4,
  tide: 0xAD90777D,
  'yard-batch': 0x7E95761E,
  contract: 0x9E3779B9,
  fallback: 0xD1B54A35,
});

export function indexedSeed(seed, stream, index) {
  if (!Object.hasOwn(STREAM_SALTS, stream) || !Number.isSafeInteger(index) || index < 0) {
    throw new TypeError('Invalid deterministic stream request');
  }
  return ((seed >>> 0) ^ STREAM_SALTS[stream]
    ^ Math.imul(index + 1, 0x9E3779B1)) >>> 0;
}

export function saturatingAdd(...values) {
  let result = 0;
  for (const value of values) {
    const safe = Number.isFinite(value) && value > 0
      ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER) : 0;
    result = Math.min(Number.MAX_SAFE_INTEGER, result + safe);
  }
  return result;
}

const normalizedVolume = (value, fallback) => (
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback
);

export function sanitizeAudioPreferences(value) {
  return {
    musicEnabled: typeof value?.musicEnabled === 'boolean'
      ? value.musicEnabled : AUDIO_DEFAULTS.musicEnabled,
    musicVolume: normalizedVolume(value?.musicVolume, AUDIO_DEFAULTS.musicVolume),
    effectsEnabled: typeof value?.effectsEnabled === 'boolean'
      ? value.effectsEnabled : AUDIO_DEFAULTS.effectsEnabled,
    effectsVolume: normalizedVolume(value?.effectsVolume, AUDIO_DEFAULTS.effectsVolume),
  };
}
```

- [ ] **Step 5: Build the complete empty v2 schema from one mode configuration**

```js
const MODE_RECORDS = Object.freeze({
  sudoku: { default: ['time'] },
  crossword: { default: ['time'] },
  'word-search': { default: ['time'] },
  'kinnoki-stack': { default: ['score', 'combo'] },
  'kinnoki-yard': { contracts: ['time', 'moves'], endless: ['score', 'combo'] },
});
const RECORD_STRATEGY = Object.freeze({
  time: 'min', moves: 'min', score: 'max', combo: 'max',
});

const emptyDifficultyMap = (value = null) => Object.fromEntries(
  DIFFICULTIES.map((difficulty) => [difficulty, value]),
);

const emptyModeStats = (recordTypes) => ({
  completed: 0,
  completedByDifficulty: emptyDifficultyMap(0),
  records: Object.fromEntries(recordTypes.map((recordType) => (
    [recordType, emptyDifficultyMap()]
  ))),
});

const emptyGameStats = (modes) => ({
  modes: Object.fromEntries(Object.entries(modes).map(([mode, recordTypes]) => (
    [mode, emptyModeStats(recordTypes)]
  ))),
});

export function createEmptyGameStore() {
  return {
    version: 2,
    runs: {},
    previousSeeds: {},
    previousSignatures: {},
    audio: { ...AUDIO_DEFAULTS },
    stats: {
      totalCompleted: 0,
      currentStreak: 0,
      lastCompletedDate: null,
      games: Object.fromEntries(Object.entries(MODE_RECORDS).map(
        ([game, modes]) => [game, emptyGameStats(modes)],
      )),
    },
  };
}
```

Every mode bucket has `completed`, `completedByDifficulty`, and only its configured record maps. Preserve v1 `completed` in the migrated default bucket even though historical per-difficulty counts are unknowable; initialize `completedByDifficulty` to zero rather than inventing a distribution.

- [ ] **Step 6: Add stable signatures and bounded non-repeating definition selection**

Insert these helpers after `deriveSeed`:

```js
const isObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const stableSerialize = (value) => {
  if (Array.isArray(value)) return '[' + value.map(stableSerialize).join(',') + ']';
  if (isObject(value)) {
    return '{' + Object.keys(value).sort().map((key) => (
      JSON.stringify(key) + ':' + stableSerialize(value[key])
    )).join(',') + '}';
  }
  return JSON.stringify(value);
};

export function historyKey(game, mode = 'default') {
  return mode === 'default' ? game : game + ':' + mode;
}

export function legacyRunSignature(game, seed, definition) {
  return 'legacy:v1:' + game + ':' + stableSerialize([seed >>> 0, definition]);
}

export function chooseFreshDefinition({
  game,
  mode = 'default',
  difficulty,
  initialSeed,
  previousSeed = null,
  previousSignature = null,
  abandonedSignature = null,
  createDefinition,
  signatureOf,
}) {
  if (!MODE_RECORDS[game]?.[mode] || !DIFFICULTIES.includes(difficulty)
      || typeof createDefinition !== 'function' || typeof signatureOf !== 'function') {
    throw new TypeError('Invalid definition selection request');
  }
  for (let candidateIndex = 0; candidateIndex < 64; candidateIndex += 1) {
    const seed = candidateIndex === 0
      ? initialSeed >>> 0
      : deriveSeed(initialSeed, candidateIndex - 1);
    const definition = createDefinition({ game, mode, difficulty, seed });
    const signature = signatureOf(definition);
    if (seed === previousSeed || signature === previousSignature
        || signature === abandonedSignature) continue;
    return { definition, seed, signature };
  }
  throw new Error('Unable to create a non-repeating definition after 64 candidates');
}
```

- [ ] **Step 7: Implement the v2 sanitizer and v1 conversion**

Insert these private sanitizers before `openGameStore`:

```js
const nonNegativeSafeInteger = (value, fallback = 0) => (
  Number.isFinite(value) && value >= 0
    ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER)
    : fallback
);

const optionalSafeInteger = (value) => (
  Number.isFinite(value) && value >= 0
    ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER)
    : null
);

const validMode = (game, mode) => Object.hasOwn(MODE_RECORDS[game] ?? {}, mode);

const sanitizeRunEnvelope = (value, expectedGame) => {
  if (!isObject(value)
      || value.game !== expectedGame
      || !validMode(expectedGame, value.mode)
      || !DIFFICULTIES.includes(value.difficulty)
      || !Number.isFinite(value.seed) || value.seed < 0
      || typeof value.signature !== 'string' || value.signature.length === 0
      || !isObject(value.puzzle)
      || !Number.isFinite(value.startedAt)
      || !Number.isFinite(value.elapsedBeforeStartMs)
      || value.elapsedBeforeStartMs < 0) return null;
  return {
    game: expectedGame,
    mode: value.mode,
    difficulty: value.difficulty,
    seed: Math.floor(value.seed) >>> 0,
    signature: value.signature,
    puzzle: value.puzzle,
    startedAt: Math.floor(value.startedAt),
    elapsedBeforeStartMs: nonNegativeSafeInteger(value.elapsedBeforeStartMs),
    assisted: value.assisted === true,
  };
};

const sanitizeModeStats = (value, recordTypes) => {
  const source = isObject(value) ? value : {};
  const sourceByDifficulty = isObject(source.completedByDifficulty)
    ? source.completedByDifficulty : {};
  const sourceRecords = isObject(source.records) ? source.records : {};
  return {
    completed: nonNegativeSafeInteger(source.completed),
    completedByDifficulty: Object.fromEntries(DIFFICULTIES.map((difficulty) => [
      difficulty, nonNegativeSafeInteger(sourceByDifficulty[difficulty]),
    ])),
    records: Object.fromEntries(recordTypes.map((recordType) => {
      const record = isObject(sourceRecords[recordType]) ? sourceRecords[recordType] : {};
      return [recordType, Object.fromEntries(DIFFICULTIES.map((difficulty) => [
        difficulty, optionalSafeInteger(record[difficulty]),
      ]))];
    })),
  };
};

const sanitizeV2Store = (value, runValidators = {}) => {
  const empty = createEmptyGameStore();
  if (!isObject(value) || value.version !== 2) return empty;
  const runs = {};
  for (const game of GAME_IDS) {
    const run = sanitizeRunEnvelope(isObject(value.runs) ? value.runs[game] : null, game);
    if (!run) continue;
    try {
      if (runValidators[game] && runValidators[game](run) !== true) continue;
    } catch {
      continue;
    }
    runs[game] = run;
  }
  const previousSeeds = {};
  const previousSignatures = {};
  for (const [game, modes] of Object.entries(MODE_RECORDS)) {
    for (const mode of Object.keys(modes)) {
      const key = historyKey(game, mode);
      const seed = value.previousSeeds?.[key];
      const signature = value.previousSignatures?.[key];
      if (Number.isFinite(seed) && seed >= 0) previousSeeds[key] = Math.floor(seed) >>> 0;
      if (typeof signature === 'string' && signature.length > 0) {
        previousSignatures[key] = signature;
      }
    }
  }
  const sourceStats = isObject(value.stats) ? value.stats : {};
  const sourceGames = isObject(sourceStats.games) ? sourceStats.games : {};
  return {
    version: 2,
    runs,
    previousSeeds,
    previousSignatures,
    audio: sanitizeAudioPreferences(value.audio),
    stats: {
      totalCompleted: nonNegativeSafeInteger(sourceStats.totalCompleted),
      currentStreak: nonNegativeSafeInteger(sourceStats.currentStreak),
      lastCompletedDate: typeof sourceStats.lastCompletedDate === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(sourceStats.lastCompletedDate)
        ? sourceStats.lastCompletedDate : null,
      games: Object.fromEntries(Object.entries(MODE_RECORDS).map(([game, modes]) => {
        const sourceModes = isObject(sourceGames[game]?.modes)
          ? sourceGames[game].modes : {};
        return [game, {
          modes: Object.fromEntries(Object.entries(modes).map(([mode, recordTypes]) => (
            [mode, sanitizeModeStats(sourceModes[mode], recordTypes)]
          ))),
        }];
      })),
    },
  };
};

const migrateV1Store = (value) => {
  const migrated = createEmptyGameStore();
  if (!isObject(value) || value.version !== 1) return migrated;
  for (const game of ['sudoku', 'crossword', 'word-search']) {
    const source = value.runs?.[game];
    if (isObject(source) && DIFFICULTIES.includes(source.difficulty)
        && Number.isFinite(source.seed) && source.seed >= 0
        && isObject(source.puzzle) && Number.isFinite(source.startedAt)
        && Number.isFinite(source.elapsedBeforeStartMs)
        && source.elapsedBeforeStartMs >= 0) {
      migrated.runs[game] = {
        game,
        mode: 'default',
        difficulty: source.difficulty,
        seed: Math.floor(source.seed) >>> 0,
        signature: legacyRunSignature(game, source.seed, source.puzzle.definition),
        puzzle: source.puzzle,
        startedAt: Math.floor(source.startedAt),
        elapsedBeforeStartMs: nonNegativeSafeInteger(source.elapsedBeforeStartMs),
        assisted: source.assisted === true,
      };
    }
    const previousSeed = value.previousSeeds?.[game];
    if (Number.isFinite(previousSeed) && previousSeed >= 0) {
      migrated.previousSeeds[game] = Math.floor(previousSeed) >>> 0;
    }
    const sourceStats = value.stats?.games?.[game];
    const target = migrated.stats.games[game].modes.default;
    target.completed = nonNegativeSafeInteger(sourceStats?.completed);
    for (const difficulty of DIFFICULTIES) {
      target.records.time[difficulty] = optionalSafeInteger(
        sourceStats?.bestMs?.[difficulty],
      );
    }
  }
  migrated.stats.totalCompleted = nonNegativeSafeInteger(value.stats?.totalCompleted);
  migrated.stats.currentStreak = nonNegativeSafeInteger(value.stats?.currentStreak);
  migrated.stats.lastCompletedDate = typeof value.stats?.lastCompletedDate === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value.stats.lastCompletedDate)
    ? value.stats.lastCompletedDate : null;
  return migrated;
};
```

- [ ] **Step 8: Implement the migration transaction and storage boundaries**

`openGameStore` follows this exact order:

1. Read v2. If the key is present, sanitize v2 and never consult v1.
2. If v2 is absent, read and sanitize v1, convert its three run/stat buckets, audio defaults, prior seeds, and totals into v2.
3. Call `saveGameStore(storage, migrated)`.
4. Remove v1 only when that call returns `{ ok: true }`.
5. On write failure, return the migrated in-memory store with `migration.state === 'memory-only'` and the error.
6. If reads throw or neither key is usable, return an empty sanitized v2 store without throwing.

For each v2 run, sanitize the generic envelope first, then call `runValidators[game](run)` when supplied. Drop only the invalid run; never drop another game's run, statistics, history, or audio settings.

The v1 mapping is exact: each valid run becomes `{ game, mode: 'default', difficulty, seed, signature, puzzle, startedAt, elapsedBeforeStartMs, assisted }`. Its `signature` is `legacyRunSignature(game, seed, puzzle.definition)`, implemented as `"legacy:v1:" + game + ":" + stableSerialize([seed, definition])` with recursive sorted object keys. Valid v1 `previousSeeds[game]` move to `previousSeeds[historyKey(game, 'default')]`. Because v1 stores no completed definition, migration leaves `previousSignatures` empty instead of inventing one. New-definition selection compares both the previous seed and signature, so migrated users cannot receive the same deterministic seed immediately; completing the next run records the first trustworthy signature.

`loadGameStore(storage, options)` remains a convenience wrapper returning `openGameStore(storage, options).store`. `saveGameStore` writes v2 only. `resetGameStore` attempts to remove both game keys, reports the first failure, and never calls `removeItem` for `kinnoki-theme` or `kinnoki-dyslexic`.

Replace the v1 storage functions with:

```js
export function saveGameStore(storage, store) {
  try {
    storage.setItem(STORE_KEYS.v2, JSON.stringify(sanitizeV2Store(store)));
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export function openGameStore(storage, { runValidators = {} } = {}) {
  let rawV2;
  try {
    rawV2 = storage.getItem(STORE_KEYS.v2);
  } catch {
    return { store: createEmptyGameStore(), migration: { state: 'empty' } };
  }
  if (rawV2 !== null) {
    try {
      return {
        store: sanitizeV2Store(JSON.parse(rawV2), runValidators),
        migration: { state: 'v2' },
      };
    } catch {
      return { store: createEmptyGameStore(), migration: { state: 'v2' } };
    }
  }

  let rawV1;
  try {
    rawV1 = storage.getItem(STORE_KEYS.v1);
  } catch {
    return { store: createEmptyGameStore(), migration: { state: 'empty' } };
  }
  if (rawV1 === null) {
    return { store: createEmptyGameStore(), migration: { state: 'empty' } };
  }
  let migrated;
  try {
    migrated = migrateV1Store(JSON.parse(rawV1));
  } catch {
    return { store: createEmptyGameStore(), migration: { state: 'empty' } };
  }
  const saved = saveGameStore(storage, migrated);
  if (!saved.ok) {
    return {
      store: migrated,
      migration: { state: 'memory-only', error: saved.error },
    };
  }
  try {
    storage.removeItem(STORE_KEYS.v1);
  } catch {
    // v2 is already durable. A stale v1 is ignored on every later open.
  }
  return { store: migrated, migration: { state: 'migrated' } };
}

export function loadGameStore(storage, options) {
  return openGameStore(storage, options).store;
}

export function resetGameStore(storage) {
  let firstError = null;
  for (const key of [STORE_KEYS.v2, STORE_KEYS.v1]) {
    try {
      storage.removeItem(key);
    } catch (error) {
      firstError ??= error;
    }
  }
  return firstError ? { ok: false, error: firstError } : { ok: true };
}
```

- [ ] **Step 9: Implement object-form start, assistance, completion, and abandonment**

`historyKey(game, mode)` returns `game` for `default` and `game + ':' + mode` otherwise. `startRun` validates the configured game/mode pair, stores `signature`, and overwrites an abandoned run without incrementing any counter. `completeRun`:

1. Returns the original store when no matching run exists.
2. Removes the run exactly once.
3. Saves its seed/signature under `historyKey(game, mode)`.
4. Increments global totals/streak and the matching mode bucket.
5. Applies only configured record types.
6. Skips every record update when `run.assisted === true`.
7. Minimizes time/moves, maximizes score/combo, and saturates all counts and values.

`abandonRun(store, { game, expectedSignature })` removes only the matching active run and changes no previous seed/signature, counter, record, streak, or date. It returns the original store if no run exists or a non-null expected signature does not match, preventing a stale controller from deleting a newer run.

Replace the old positional run functions and retain the existing `localDate`, `dateOrdinal`, and streak calculation with:

```js
export function startRun(store, {
  game, mode = 'default', difficulty, seed, signature, puzzle, now,
}) {
  if (!validMode(game, mode) || !DIFFICULTIES.includes(difficulty)
      || !Number.isFinite(seed) || seed < 0
      || typeof signature !== 'string' || signature.length === 0
      || !isObject(puzzle) || !Number.isFinite(now)) return store;
  return {
    ...store,
    runs: {
      ...store.runs,
      [game]: {
        game, mode, difficulty, seed: Math.floor(seed) >>> 0, signature, puzzle,
        startedAt: Math.floor(now), elapsedBeforeStartMs: 0, assisted: false,
      },
    },
  };
}

export function abandonRun(store, { game, expectedSignature = null }) {
  const run = store.runs?.[game];
  if (!run || (expectedSignature !== null && run.signature !== expectedSignature)) {
    return store;
  }
  const { [game]: _abandoned, ...runs } = store.runs;
  return { ...store, runs };
}

export function markAssisted(store, game) {
  const run = store.runs?.[game];
  if (!run || run.assisted) return store;
  return {
    ...store,
    runs: { ...store.runs, [game]: { ...run, assisted: true } },
  };
}

export function visibleElapsedMs(run, now, hiddenSince = null) {
  const visibleUntil = hiddenSince ?? now;
  return Math.max(0, Math.trunc(
    nonNegativeSafeInteger(run?.elapsedBeforeStartMs)
      + visibleUntil - (Number.isFinite(run?.startedAt) ? run.startedAt : visibleUntil),
  ));
}

export function completeRun(store, {
  game, mode = 'default', now, records = {},
}) {
  const run = store.runs?.[game];
  if (!run || run.mode !== mode || !Number.isFinite(now)) return store;
  const { [game]: completedRun, ...runs } = store.runs;
  const key = historyKey(game, mode);
  const bucket = store.stats.games[game].modes[mode];
  const completedDate = localDate(now);
  const nextRecords = structuredClone(bucket.records);
  if (!run.assisted) {
    for (const recordType of MODE_RECORDS[game][mode]) {
      const candidate = optionalSafeInteger(records[recordType]);
      if (candidate === null) continue;
      const current = nextRecords[recordType][run.difficulty];
      nextRecords[recordType][run.difficulty] = current === null
        ? candidate
        : RECORD_STRATEGY[recordType] === 'min'
          ? Math.min(current, candidate)
          : Math.max(current, candidate);
    }
  }
  return {
    ...store,
    runs,
    previousSeeds: { ...store.previousSeeds, [key]: completedRun.seed },
    previousSignatures: {
      ...store.previousSignatures, [key]: completedRun.signature,
    },
    stats: {
      ...store.stats,
      totalCompleted: saturatingAdd(store.stats.totalCompleted, 1),
      currentStreak: nonNegativeSafeInteger(
        nextStreak(store.stats, completedDate),
      ),
      lastCompletedDate: completedDate,
      games: {
        ...store.stats.games,
        [game]: {
          ...store.stats.games[game],
          modes: {
            ...store.stats.games[game].modes,
            [mode]: {
              ...bucket,
              completed: saturatingAdd(bucket.completed, 1),
              completedByDifficulty: {
                ...bucket.completedByDifficulty,
                [run.difficulty]: saturatingAdd(
                  bucket.completedByDifficulty[run.difficulty], 1,
                ),
              },
              records: nextRecords,
            },
          },
        },
      },
    },
  };
}
```

- [ ] **Step 10: Adapt the existing three-card hub to v2 mode buckets**

Before adding new cards, keep the current three-game markup/copy and change only the stats adapter:

```js
const defaultModeStats = (store, game) => (
  store.stats?.games?.[game]?.modes?.default ?? {
    completed: 0,
    records: { time: { easy: null, medium: null, hard: null } },
  }
);

export function statsModel(store) {
  const games = Object.fromEntries(GAMES.map((game) => {
    const stats = defaultModeStats(store, game.id);
    const bestTimes = DIFFICULTIES
      .map((difficulty) => stats.records?.time?.[difficulty])
      .filter((value) => Number.isFinite(value) && value >= 0);
    const completed = nonNegativeInteger(stats.completed);
    return [game.id, {
      completed: `${completed} completed`,
      best: bestTimes.length ? formatTime(Math.min(...bestTimes)) : '—',
    }];
  }));
  return sharedStatsSummary(store, games);
}
```

Place this helper immediately above `statsModel`; the `statsModel` body above calls it unchanged:

```js
const sharedStatsSummary = (store, games) => {
  const total = nonNegativeInteger(store.stats?.totalCompleted);
  const streak = nonNegativeInteger(store.stats?.currentStreak);
  return {
    total: String(total),
    totalLabel: total === 1 ? 'Puzzle completed' : 'Puzzles completed',
    streak: String(streak),
    streakLabel: 'Day streak',
    games,
    zeroState: total === 0
      ? 'Your first puzzle finish will start the record book. Your progress stays on this device.'
      : total + ' ' + (total === 1 ? 'puzzle' : 'puzzles')
        + ' finished on this device.',
  };
};
```

- [ ] **Step 11: Move `core.test.mjs` callers to exact object-form APIs**

Replace each positional call in `Tests/games/core.test.mjs` with this form, changing only the game/difficulty/seed/puzzle values already present in that test:

```js
store = startRun(store, {
  game: 'sudoku',
  mode: 'default',
  difficulty: 'easy',
  seed: 7,
  signature: 'test:sudoku:7',
  puzzle: { definition: { puzzle: [], solution: [] }, play: {} },
  now: 1000,
});
store = completeRun(store, {
  game: 'sudoku',
  mode: 'default',
  now: 1000,
  records: { time: 30000 },
});
```

Replace v1 empty-store assertions outside `storage-v2.test.mjs` with the v2 paths:

```js
const store = createEmptyGameStore();
store.stats.games.sudoku.modes.default.records.time.medium = 61500;
assert.equal(store.version, 2);
assert.equal(
  store.stats.games.sudoku.modes.default.records.time.medium,
  61500,
);
```

- [ ] **Step 12: Run the storage/hub migration gate**

Run: `node --test Tests/games/storage-v2.test.mjs Tests/games/core.test.mjs`
Expected: PASS for migration, typed records, reset, sanitized hostile data, and the unchanged three-card hub.

- [ ] **Step 13: Commit the storage/hub migration**

```bash
git add Resources/games/core.js Resources/games/hub-ui.js \
  Tests/games/storage-v2.test.mjs Tests/games/core.test.mjs
git commit -m "feat(games): migrate arcade storage to typed v2 records"
```

---

### Task 1B: Existing puzzle-session adaptation and repeat history

**Files:**
- Modify: `Resources/games/controller-common.js:1-2,72-220`
- Modify: `Tests/games/controllers.test.mjs`
- Modify: `Tests/games/controller-review.test.mjs`
- Regression test: `Tests/games/controller-second-review.test.mjs`
- Regression test: `Tests/games/final-review.test.mjs`
- Regression test: `Tests/games/kinnoki-stack-ui.test.mjs`
- Regression test: `Tests/games/kinnoki-yard-ui.test.mjs`

**Interfaces:**
- Consumes: Task 1A Store v2 and existing puzzle factories/signatures.
- Produces: exported `defaultSeedFactory({ game, mode, previousSeed })`, `chooseFreshDefinition` integration, object-form session calls, and v2 fixtures without changing the original puzzles' automatic page lifecycle.

- [ ] **Step 1: Write failing deterministic repeat-selection tests**

```js
import {
  chooseFreshDefinition, completeRun, createEmptyGameStore, startRun,
} from '../../Resources/games/core.js';

test('fresh definition rejects completed and abandoned signatures within 64 candidates', () => {
  const seenSeeds = [];
  const result = chooseFreshDefinition({
    game: 'sudoku', mode: 'default', difficulty: 'easy', initialSeed: 9,
    previousSeed: 9, previousSignature: 'signature-10',
    abandonedSignature: 'signature-11',
    createDefinition: ({ seed }) => { seenSeeds.push(seed); return { seed }; },
    signatureOf: ({ seed }) => `signature-${seed}`,
  });
  assert.equal(result.signature === 'signature-10', false);
  assert.equal(result.signature === 'signature-11', false);
  assert.equal(result.seed === 9, false);
  assert.ok(seenSeeds.length <= 64);
});

test('completed session stores the actual definition signature under default history', () => {
  let store = createEmptyGameStore();
  store = startRun(store, {
    game: 'sudoku', mode: 'default', difficulty: 'easy', seed: 5,
    signature: 'sudoku-definition-5', puzzle: {}, now: 100,
  });
  store = completeRun(store, {
    game: 'sudoku', mode: 'default', now: 1100, records: { time: 1000 },
  });
  assert.equal(store.previousSeeds.sudoku, 5);
  assert.equal(store.previousSignatures.sudoku, 'sudoku-definition-5');
});
```

Add this controller-level regression to `controllers.test.mjs`; unlike the pure helper test,
it proves an accepted replacement reads the saved run before `run` is initialized:

```js
test('accepted puzzle replacement excludes the saved definition signature', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy', confirm: true });
  const restore = installDOM(fixture);
  try {
    const { createSession } = await import('../../Resources/games/controller-common.js');
    const { createEmptyGameStore, startRun } = await import('../../Resources/games/core.js');
    const savedDefinition = { difficulty: 'easy', seed: 9, id: 'saved-definition' };
    let store = createEmptyGameStore();
    store = startRun(store, {
      game: 'sudoku', mode: 'default', difficulty: 'easy', seed: 9,
      signature: savedDefinition.id,
      puzzle: { definition: savedDefinition, play: { progressed: true } }, now: 0,
    });
    const seenSeeds = [];
    const session = createSession({
      root: fixture.root, game: 'sudoku', store,
      createPuzzle: ({ seed }) => {
        seenSeeds.push(seed);
        return { difficulty: 'easy', seed, id: seed === 9 ? savedDefinition.id : `fresh-${seed}` };
      },
      createPlay: () => ({}), progressed: () => true, validateRun: () => true,
      definitionSignature: (definition) => definition.id,
      seedFactory: () => 9, wallNow: () => 100, monotonicNow: () => 0,
      onRender: async () => {},
    });
    assert.ok(seenSeeds.length >= 2);
    assert.notEqual(session.run.signature, savedDefinition.id);
    session.dispose();
  } finally { restore(); }
});
```

- [ ] **Step 2: Add the injected production seed factory**

`createSession()` calls `chooseFreshDefinition` with `previousSeeds[historyKey(game)]`, `previousSignatures[historyKey(game)]`, and the current abandoned definition signature. Its injected `seedFactory({ game, mode, previousSeed })` supplies the initial seed; the production default mixes wall time and `crypto.getRandomValues` when available, then relies on deterministic `deriveSeed` retries. Tests inject fixed seeds. This replaces the private `seedValue` helper.

```js
export function defaultSeedFactory({ previousSeed = null } = {}) {
  const words = new Uint32Array(1);
  try { globalThis.crypto?.getRandomValues?.(words); } catch { words[0] = 0; }
  let seed = ((Date.now() >>> 0) ^ words[0]) >>> 0;
  if (seed === previousSeed) seed = deriveSeed(seed, 0);
  return seed;
}
```

- [ ] **Step 3: Import the typed core API and inject `seedFactory`**

Replace the core import with:

```js
import {
  chooseFreshDefinition, completeRun, deriveSeed, historyKey, markAssisted,
  saveGameStore, startRun,
} from './core.js';
```

Change the declaration to `export function createSession(options) {`, then make this
the first executable statement in the existing function body:

```js
const {
  root, game, store, createPuzzle, createPlay, progressed, validateRun, onRender,
  definitionSignature = puzzleSignature,
  seedFactory = defaultSeedFactory,
  wallNow = () => Date.now(),
  monotonicNow = () => globalThis.performance?.now?.() ?? Date.now(),
} = options;
```

Delete the private `seedValue` helper after adding this injection.

- [ ] **Step 4: Replace the retry loop with `chooseFreshDefinition`**

Replace the existing `begin` function with:

```js
const begin = (requestedSeed) => {
  const key = historyKey(game, 'default');
  const abandonedDefinition = run?.puzzle?.definition ?? existing?.puzzle?.definition;
  const abandonedSignature = abandonedDefinition
    ? definitionSignature(abandonedDefinition) : null;
  const initialSeed = Number.isSafeInteger(requestedSeed) && requestedSeed >= 0
    ? requestedSeed >>> 0
    : seedFactory({
        game,
        mode: 'default',
        previousSeed: currentStore.previousSeeds?.[key] ?? null,
      });
  const selected = chooseFreshDefinition({
    game,
    mode: 'default',
    difficulty,
    initialSeed,
    previousSeed: currentStore.previousSeeds?.[key] ?? null,
    previousSignature: currentStore.previousSignatures?.[key] ?? null,
    abandonedSignature,
    createDefinition: ({ seed }) => createPuzzle({ difficulty, seed }),
    signatureOf: definitionSignature,
  });
  currentStore = startRun(currentStore, {
    game,
    mode: 'default',
    difficulty,
    seed: selected.seed,
    signature: selected.signature,
    puzzle: {
      definition: selected.definition,
      play: createPlay(selected.definition),
    },
    now: wallNow(),
  });
  run = currentStore.runs[game];
  activeStarted = monotonicNow();
  paused = false;
  finished = false;
  save();
};
```

- [ ] **Step 5: Convert completion and restart to object-form core calls**

Replace the completion call inside `finish` with:

```js
currentStore = completeRun(currentStore, {
  game, mode: 'default', now: wallNow(),
  records: { time: elapsedMs },
});
```

Replace the `startRun` call inside `restart` with:

```js
currentStore = startRun(currentStore, {
  game, mode: 'default',
  difficulty: run.difficulty,
  seed: run.seed,
  signature: run.signature,
  puzzle: { definition, play: createPlay(definition) },
  now: wallNow(),
});
```

Keep the existing automatic puzzle lifecycle unchanged in this task.

- [ ] **Step 6: Add one exact v2 fixture factory to each controller regression file**

Add these imports and helper to `controllers.test.mjs`, `controller-review.test.mjs`, `controller-second-review.test.mjs`, and `final-review.test.mjs`:

```js
import {
  createEmptyGameStore, STORE_KEYS,
} from '../../Resources/games/core.js';

const v2StoreWithRun = ({
  game,
  definition,
  play,
  difficulty = definition.difficulty ?? 'easy',
  seed = definition.seed ?? 1,
  startedAt = 0,
  elapsedBeforeStartMs = 0,
  assisted = false,
}) => {
  const store = createEmptyGameStore();
  store.runs[game] = {
    game,
    mode: 'default',
    difficulty,
    seed: seed >>> 0,
    signature: 'fixture:' + game + ':' + JSON.stringify(definition),
    puzzle: { definition, ...(play === undefined ? {} : { play }) },
    startedAt,
    elapsedBeforeStartMs,
    assisted,
  };
  return store;
};
```

- [ ] **Step 7: Replace literal v1 fixtures and storage reads**

Replace every hand-built controller store with:

```js
const store = v2StoreWithRun({
  game,
  definition,
  play,
  difficulty: definition.difficulty ?? 'easy',
  seed: definition.seed ?? 1,
  startedAt: Date.now(),
});
```

Replace only game-store reads/writes with the exported key:

```js
fixture.localStorage.setItem(STORE_KEYS.v2, JSON.stringify(store));
const saved = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
```

Keep dedicated migration fixtures in `storage-v2.test.mjs` as true v1 data. Leave `kinnoki-theme` and `kinnoki-dyslexic` strings unchanged.

- [ ] **Step 8: Run existing game regressions**

Run: `node --test Tests/games/storage-v2.test.mjs Tests/games/core.test.mjs Tests/games/controllers.test.mjs Tests/games/controller-review.test.mjs Tests/games/controller-second-review.test.mjs Tests/games/final-review.test.mjs`
Expected: PASS; existing puzzles still save time records and every migration boundary is green.

- [ ] **Step 9: Commit the session adaptation**

```bash
git add Resources/games/controller-common.js \
  Tests/games/controllers.test.mjs Tests/games/controller-review.test.mjs \
  Tests/games/controller-second-review.test.mjs Tests/games/final-review.test.mjs
git commit -m "refactor(games): adapt puzzle sessions to v2 storage"
```

---

### Task 2: Shared cargo geometry

**Files:**
- Create: `Resources/games/cargo-geometry.js`
- Create: `Tests/games/cargo-geometry.test.mjs`

**Interfaces:**
- Consumes: rectangular boards and `indexedSeed` from Task 1.
- Produces: every geometry export in the Shared Data and Interface Contracts section. Both game engines consume this module; it imports neither engine, DOM, storage, timer, nor audio code.

- [ ] **Step 1: Write failing catalogue and rotation tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARGO_CATALOG, MANIFEST_POOLS, MANIFEST_SHAPES,
  boundsFor, normalizeCells, rotateCells, rotationsFor,
} from '../../Resources/games/cargo-geometry.js';

test('cargo catalogue spans two through five cells with stable text and patterns', () => {
  assert.ok(CARGO_CATALOG.length >= 12);
  assert.deepEqual(
    [...new Set(CARGO_CATALOG.map((piece) => piece.cells.length))].sort(),
    [2, 3, 4, 5],
  );
  assert.equal(new Set(CARGO_CATALOG.map((piece) => piece.id)).size, CARGO_CATALOG.length);
  for (const piece of CARGO_CATALOG) {
    assert.match(piece.id, /^[a-z][a-z0-9-]+$/);
    assert.ok(piece.label.length >= 4);
    assert.match(piece.pattern, /^(solid|dots|diagonal|crosshatch|bands)$/);
    assert.deepEqual(piece.cells, normalizeCells(piece.cells));
  }
  const fourCellShapes = CARGO_CATALOG.filter((piece) => piece.cells.length === 4);
  assert.notEqual(fourCellShapes.length, 7);
});

test('rotations normalize origin, sort coordinates, and remove duplicates', () => {
  assert.deepEqual(normalizeCells([
    { row: 4, column: 6 }, { row: 3, column: 6 }, { row: 4, column: 7 },
  ]), [
    { row: 0, column: 0 }, { row: 1, column: 0 }, { row: 1, column: 1 },
  ]);
  assert.equal(rotationsFor('crate-pair').length, 2);
  assert.deepEqual(boundsFor(rotateCells([
    { row: 0, column: 0 }, { row: 0, column: 1 },
  ])), { width: 1, height: 2 });
});

test('manifest catalogues expose exact Stack and Endless difficulty pools', () => {
  assert.deepEqual(MANIFEST_POOLS.stack.easy, ['rectangle-eight']);
  assert.deepEqual(MANIFEST_POOLS.stack.medium,
    ['rectangle-six', 'rectangle-eight', 'step-five', 'step-seven']);
  assert.deepEqual(MANIFEST_POOLS.stack.hard,
    ['step-five', 'step-seven', 'corner-six', 'harbour-seven']);
  assert.deepEqual(MANIFEST_POOLS.endless.easy, ['rectangle-eight']);
  assert.deepEqual(MANIFEST_POOLS.endless.medium,
    ['rectangle-six', 'step-five', 'step-seven']);
  assert.deepEqual(MANIFEST_POOLS.endless.hard,
    ['step-five', 'corner-six', 'harbour-seven']);
  assert.equal(new Set(MANIFEST_SHAPES.map((shape) => shape.id)).size, 6);
});
```

- [ ] **Step 2: Write failing placement, manifest, and connected-component tests**

```js
import {
  canPlace, connectedComponents, dispatchCompletedManifests,
  isManifestComplete, placePiece, selectManifestZones, validateBoard, validateManifest,
} from '../../Resources/games/cargo-geometry.js';

const board = (width, height) => Array.from({ length: height }, () => Array(width).fill(null));

test('placement preserves piece identity and rejects collision or bounds', () => {
  const empty = board(4, 4);
  const piece = {
    pieceId: 7, typeId: 'crate-pair', rotation: 0,
    row: 1, column: 1,
  };
  const placed = placePiece(empty, piece);
  assert.equal(placed[1][1].pieceId, 7);
  assert.equal(canPlace(placed, rotationsFor('crate-pair')[0].cells,
    { row: 1, column: 1 }), false);
  assert.equal(canPlace(empty, rotationsFor('crate-pair')[0].cells,
    { row: -1, column: 0 }), false);
});

test('dispatch removes only completed manifest cells and components split cleanly', () => {
  const occupied = board(5, 3);
  for (let column = 0; column < 5; column += 1) {
    occupied[1][column] = { pieceId: 1, typeId: 'barge-five' };
  }
  for (let column = 1; column <= 3; column += 1) {
    occupied[0][column] = { pieceId: 2, typeId: 'barge-three' };
  }
  const manifest = {
    id: 'manifest-1', shapeId: 'rectangle-six', rotation: 0,
    origin: { row: 0, column: 1 },
    label: 'Six-cell rectangular manifest', pattern: 'bands',
    cells: [
      { row: 0, column: 1 }, { row: 0, column: 2 }, { row: 0, column: 3 },
      { row: 1, column: 1 }, { row: 1, column: 2 }, { row: 1, column: 3 },
    ],
  };
  assert.deepEqual(validateManifest(manifest, { width: 5, height: 3 }), {
    valid: true, errors: [],
  });
  assert.equal(isManifestComplete(occupied, manifest), true);
  const result = dispatchCompletedManifests(occupied, [manifest]);
  assert.equal(result.board[1][2], null);
  assert.equal(result.board[1][0].pieceId, 1);
  assert.equal(result.board[1][4].pieceId, 1);
  assert.equal(connectedComponents(result.board).length, 2);
  assert.equal(validateManifest({ ...manifest, label: 'Forged label' }, {
    width: 5, height: 3,
  }).valid, false);
  assert.equal(validateManifest({ ...manifest, pattern: 'forged-pattern' }, {
    width: 5, height: 3,
  }).valid, false);
});

test('requesting zero manifest zones returns the exact empty selection', () => {
  assert.deepEqual(selectManifestZones({
    board: board(4, 4), width: 4, height: 4,
    shapeIds: ['rectangle-six'], seed: 1, index: 0, count: 0,
  }), []);
});

test('hostile boards fail closed', () => {
  assert.deepEqual(validateBoard([[{ pieceId: -1, typeId: '<script>' }]], {
    width: 1, height: 1,
  }), { valid: false, errors: ['invalid cell at 0:0'] });
});
```

- [ ] **Step 3: Run the geometry suite and verify the module is absent**

Run: `node --test Tests/games/cargo-geometry.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `cargo-geometry.js`.

- [ ] **Step 4: Add the original catalogue and deterministic import**

Use this stable catalogue; Easy uses the first six entries and Medium/Hard use all entries:

```js
import { createRng, indexedSeed } from './core.js';

export const CARGO_CATALOG = Object.freeze([
  { id: 'crate-pair', label: 'Crate pair', pattern: 'dots',
    cells: [{ row: 0, column: 0 }, { row: 0, column: 1 }] },
  { id: 'barge-three', label: 'Three-crate barge', pattern: 'bands',
    cells: [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 }] },
  { id: 'corner-three', label: 'Three-crate corner', pattern: 'diagonal',
    cells: [{ row: 0, column: 0 }, { row: 1, column: 0 }, { row: 1, column: 1 }] },
  { id: 'dock-square', label: 'Four-crate dock square', pattern: 'crosshatch',
    cells: [{ row: 0, column: 0 }, { row: 0, column: 1 },
      { row: 1, column: 0 }, { row: 1, column: 1 }] },
  { id: 'hook-four', label: 'Four-crate hook', pattern: 'solid',
    cells: [{ row: 0, column: 0 }, { row: 1, column: 0 },
      { row: 2, column: 0 }, { row: 2, column: 1 }] },
  { id: 'step-four', label: 'Four-crate step', pattern: 'dots',
    cells: [{ row: 0, column: 0 }, { row: 1, column: 0 },
      { row: 1, column: 1 }, { row: 2, column: 1 }] },
  { id: 'fork-four', label: 'Four-crate fork', pattern: 'bands',
    cells: [{ row: 0, column: 1 }, { row: 1, column: 0 },
      { row: 1, column: 1 }, { row: 1, column: 2 }] },
  { id: 'barge-five', label: 'Five-crate barge', pattern: 'diagonal',
    cells: [{ row: 0, column: 0 }, { row: 0, column: 1 },
      { row: 0, column: 2 }, { row: 0, column: 3 }, { row: 0, column: 4 }] },
  { id: 'harbour-five', label: 'Five-crate harbour', pattern: 'crosshatch',
    cells: [{ row: 0, column: 0 }, { row: 0, column: 2 },
      { row: 1, column: 0 }, { row: 1, column: 1 }, { row: 1, column: 2 }] },
  { id: 'quay-five', label: 'Five-crate quay', pattern: 'solid',
    cells: [{ row: 0, column: 0 }, { row: 1, column: 0 },
      { row: 2, column: 0 }, { row: 2, column: 1 }, { row: 2, column: 2 }] },
  { id: 'zigzag-five', label: 'Five-crate zigzag', pattern: 'dots',
    cells: [{ row: 0, column: 0 }, { row: 1, column: 0 },
      { row: 1, column: 1 }, { row: 2, column: 1 }, { row: 2, column: 2 }] },
  { id: 'anchor-five', label: 'Five-crate anchor', pattern: 'bands',
    cells: [{ row: 0, column: 1 }, { row: 1, column: 0 },
      { row: 1, column: 1 }, { row: 1, column: 2 }, { row: 2, column: 1 }] },
]);
```

- [ ] **Step 5: Implement normalized cargo rotations and bounds**

Insert immediately after `CARGO_CATALOG`:

```js
const rowMajor = (left, right) => left.row - right.row
  || left.column - right.column;
const cellSignature = (cells) => JSON.stringify(cells);
const cargoById = new Map(CARGO_CATALOG.map((piece) => [piece.id, piece]));

export function normalizeCells(cells) {
  if (!Array.isArray(cells) || cells.length === 0
      || cells.some(({ row, column } = {}) => (
        !Number.isInteger(row) || !Number.isInteger(column)
      ))) throw new TypeError('Cargo cells must be integer coordinates');
  const minimumRow = Math.min(...cells.map(({ row }) => row));
  const minimumColumn = Math.min(...cells.map(({ column }) => column));
  const normalized = cells.map(({ row, column }) => ({
    row: row - minimumRow,
    column: column - minimumColumn,
  })).sort(rowMajor);
  if (new Set(normalized.map(({ row, column }) => row + ':' + column)).size
      !== normalized.length) throw new TypeError('Cargo cells must be unique');
  return normalized;
}

export function rotateCells(cells, quarterTurns = 1) {
  let rotated = normalizeCells(cells);
  const turns = ((quarterTurns % 4) + 4) % 4;
  for (let turn = 0; turn < turns; turn += 1) {
    rotated = normalizeCells(rotated.map(({ row, column }) => ({
      row: column,
      column: -row,
    })));
  }
  return rotated;
}

const uniqueRotations = (cells) => {
  const seen = new Set();
  const rotations = [];
  for (let rotation = 0; rotation < 4; rotation += 1) {
    const rotated = rotateCells(cells, rotation);
    const signature = cellSignature(rotated);
    if (seen.has(signature)) continue;
    seen.add(signature);
    rotations.push(Object.freeze({ rotation, cells: Object.freeze(rotated) }));
  }
  return rotations;
};

export function rotationsFor(typeId, allowedRotations = null) {
  const cargo = cargoById.get(typeId);
  if (!cargo) throw new TypeError('Unknown cargo type: ' + typeId);
  const rotations = uniqueRotations(cargo.cells);
  if (allowedRotations === null) return rotations;
  if (!Array.isArray(allowedRotations)) throw new TypeError('Invalid allowed rotations');
  const allowed = new Set(allowedRotations);
  return rotations.filter(({ rotation }) => allowed.has(rotation));
}

export function boundsFor(cells) {
  const normalized = normalizeCells(cells);
  return {
    width: Math.max(...normalized.map(({ column }) => column)) + 1,
    height: Math.max(...normalized.map(({ row }) => row)) + 1,
  };
}

export function placedCells(cells, origin) {
  if (!Number.isInteger(origin?.row) || !Number.isInteger(origin?.column)) {
    throw new TypeError('Invalid placement origin');
  }
  return normalizeCells(cells).map(({ row, column }) => ({
    row: row + origin.row,
    column: column + origin.column,
  })).sort(rowMajor);
}
```

- [ ] **Step 6: Implement immutable board placement and connected components**

`canPlace` checks every destination against dimensions and treats `ignorePieceId` cells as empty for repositioning. `placePiece` looks up the canonical type/rotation, validates the entire placement first, clones only affected rows, and writes `{ pieceId, typeId }`. `removePiece` clones every row containing that identity.

`connectedComponents` uses orthogonal neighbors and row-major starting cells. Each result is `{ id, cells, minColumn, maxColumn }`, where `cells` are row-major and `id` is the first cell's `row + ':' + column`; results sort by that first cell. `dispatchCompletedManifests` computes all complete non-overlapping zones against the original board, removes their union simultaneously, returns `{ board, completed, dispatchedCells, components }`, and never treats an ordinary full row or column as special.

```js
const boardDimensions = (board) => ({
  height: Array.isArray(board) ? board.length : 0,
  width: Array.isArray(board?.[0]) ? board[0].length : 0,
});

export function canPlace(board, cells, origin, { ignorePieceId = null } = {}) {
  const { width, height } = boardDimensions(board);
  if (width === 0 || board.some((row) => !Array.isArray(row) || row.length !== width)) {
    return false;
  }
  let destinations;
  try {
    destinations = placedCells(cells, origin);
  } catch {
    return false;
  }
  return destinations.every(({ row, column }) => (
    row >= 0 && row < height && column >= 0 && column < width
      && (board[row][column] === null
        || board[row][column]?.pieceId === ignorePieceId)
  ));
}

export function placePiece(board, piece) {
  if (!Number.isSafeInteger(piece?.pieceId) || piece.pieceId < 0) {
    throw new TypeError('Invalid piece identity');
  }
  const rotation = rotationsFor(piece.typeId)
    .find((candidate) => candidate.rotation === piece.rotation);
  if (!rotation || !canPlace(board, rotation.cells, {
    row: piece.row, column: piece.column,
  }, { ignorePieceId: piece.pieceId })) throw new RangeError('Invalid cargo placement');
  const next = board.map((row) => [...row]);
  for (const { row, column } of placedCells(rotation.cells, piece)) {
    next[row][column] = { pieceId: piece.pieceId, typeId: piece.typeId };
  }
  return next;
}

export function removePiece(board, pieceId) {
  return board.map((row) => row.some((cell) => cell?.pieceId === pieceId)
    ? row.map((cell) => cell?.pieceId === pieceId ? null : cell)
    : row);
}

export function connectedComponents(board) {
  const { width, height } = boardDimensions(board);
  const visited = new Set();
  const components = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const startKey = row + ':' + column;
      if (!board[row][column] || visited.has(startKey)) continue;
      const queue = [{ row, column }];
      const cells = [];
      visited.add(startKey);
      for (let index = 0; index < queue.length; index += 1) {
        const cell = queue[index];
        cells.push(cell);
        for (const [rowDelta, columnDelta] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const next = { row: cell.row + rowDelta, column: cell.column + columnDelta };
          const key = next.row + ':' + next.column;
          if (next.row < 0 || next.row >= height || next.column < 0
              || next.column >= width || !board[next.row][next.column]
              || visited.has(key)) continue;
          visited.add(key);
          queue.push(next);
        }
      }
      cells.sort(rowMajor);
      components.push({
        id: cells[0].row + ':' + cells[0].column,
        cells,
        minColumn: Math.min(...cells.map((cell) => cell.column)),
        maxColumn: Math.max(...cells.map((cell) => cell.column)),
      });
    }
  }
  return components;
}
```

- [ ] **Step 7: Add manifest shapes, pools, validation, and simultaneous dispatch**

Define these exact normalized manifest cells before freezing their stable labels/patterns:

```js
const MANIFEST_CELLS = Object.freeze({
  'rectangle-six': [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]],
  'rectangle-eight': [
    [0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3],
  ],
  'step-five': [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
  'step-seven': [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3]],
  'corner-six': [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2]],
  'harbour-seven': [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]],
});
```

```js
const manifestCells = (pairs) => pairs.map(([row, column]) => ({ row, column }));
export const MANIFEST_SHAPES = Object.freeze([
  ['rectangle-six', 'Six-cell rectangular manifest', 'bands'],
  ['rectangle-eight', 'Eight-cell rectangular manifest', 'crosshatch'],
  ['step-five', 'Stepped five-cell manifest', 'diagonal'],
  ['step-seven', 'Stepped seven-cell manifest', 'dots'],
  ['corner-six', 'Corner six-cell manifest', 'bands'],
  ['harbour-seven', 'Harbour seven-cell manifest', 'crosshatch'],
].map(([id, label, pattern]) => Object.freeze({
  id, label, pattern, cells: Object.freeze(manifestCells(MANIFEST_CELLS[id])),
})));
const manifestById = new Map(MANIFEST_SHAPES.map((shape) => [shape.id, shape]));

export const MANIFEST_POOLS = Object.freeze({
  stack: Object.freeze({
    easy: Object.freeze(['rectangle-eight']),
    medium: Object.freeze([
      'rectangle-six', 'rectangle-eight', 'step-five', 'step-seven',
    ]),
    hard: Object.freeze(['step-five', 'step-seven', 'corner-six', 'harbour-seven']),
  }),
  endless: Object.freeze({
    easy: Object.freeze(['rectangle-eight']),
    medium: Object.freeze(['rectangle-six', 'step-five', 'step-seven']),
    hard: Object.freeze(['step-five', 'corner-six', 'harbour-seven']),
  }),
});

export function rotationsForManifest(shapeId) {
  const shape = manifestById.get(shapeId);
  if (!shape) throw new TypeError('Unknown manifest shape: ' + shapeId);
  return uniqueRotations(shape.cells);
}

export function validateBoard(value, { width, height }) {
  const errors = [];
  if (!Array.isArray(value) || value.length !== height
      || value.some((row) => !Array.isArray(row) || row.length !== width)) {
    return { valid: false, errors: ['invalid board dimensions'] };
  }
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const cell = value[row][column];
      if (cell === null) continue;
      if (!Number.isSafeInteger(cell?.pieceId) || cell.pieceId < 0
          || !cargoById.has(cell?.typeId)) {
        errors.push('invalid cell at ' + row + ':' + column);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateManifest(value, { width, height }) {
  const errors = [];
  try {
    const shape = manifestById.get(value?.shapeId);
    const rotation = rotationsForManifest(value?.shapeId)
      .find((candidate) => candidate.rotation === value?.rotation);
    const expected = rotation && placedCells(rotation.cells, value.origin);
    if (!shape || !rotation || typeof value.id !== 'string'
        || value.label !== shape.label
        || value.pattern !== shape.pattern
        || !Array.isArray(value.cells)
        || JSON.stringify([...value.cells].sort(rowMajor)) !== JSON.stringify(expected)
        || expected.some(({ row, column }) => (
          row < 0 || row >= height || column < 0 || column >= width
        ))) errors.push('invalid manifest geometry');
  } catch {
    errors.push('invalid manifest geometry');
  }
  return { valid: errors.length === 0, errors };
}

export function isManifestComplete(board, manifest) {
  return manifest.cells.every(({ row, column }) => board[row]?.[column] != null);
}

export function dispatchCompletedManifests(board, manifests) {
  const completed = manifests.filter((manifest) => isManifestComplete(board, manifest));
  const dispatched = new Set(completed.flatMap(({ cells }) => (
    cells.map(({ row, column }) => row + ':' + column)
  )));
  const next = board.map((row, rowIndex) => row.map((cell, columnIndex) => (
    dispatched.has(rowIndex + ':' + columnIndex) ? null : cell
  )));
  return {
    board: next,
    completed,
    dispatchedCells: dispatched.size,
    components: connectedComponents(next),
  };
}
```

- [ ] **Step 8: Implement bounded deterministic manifest selection**

`selectManifestZones` validates the caller-supplied `shapeIds`, then uses `indexedSeed(seed, 'manifest', index)`, every unique shape rotation, row-major candidate anchors, deterministic shuffle, and a bounded scan of that finite candidate list. Stack passes `MANIFEST_POOLS.stack[difficulty]`; Endless passes `MANIFEST_POOLS.endless[difficulty]`. It rejects out-of-bounds cells, overlap with `occupied`/selected zones, and zones already complete on `board`. It returns exactly `count` zones or throws `ManifestGenerationError`. `selectNextManifestZones` calls it for at most 64 consecutive indices, returning `{ manifests, nextIndex: acceptedIndex + 1 }`; after 64 failures it throws. Engines use it for initial and replacement zones. A replacement failure moves the engine to `error`, emits one `error` event, and preserves the last valid board; controllers expose New Run rather than silently changing difficulty or manifest count.

```js
export class ManifestGenerationError extends Error {}

export function selectManifestZones({
  board, width, height, shapeIds, seed, index, count, occupied = [],
}) {
  if (!Array.isArray(shapeIds) || shapeIds.some((id) => !manifestById.has(id))
      || !Number.isSafeInteger(count) || count < 0) {
    throw new TypeError('Invalid manifest selection request');
  }
  if (count === 0) return [];
  const blocked = new Set(occupied.flatMap((entry) => (
    entry?.cells ?? [entry]
  )).map(({ row, column }) => row + ':' + column));
  const candidates = [];
  for (const shapeId of shapeIds) {
    const shape = manifestById.get(shapeId);
    for (const rotation of rotationsForManifest(shapeId)) {
      const bounds = boundsFor(rotation.cells);
      for (let row = 0; row <= height - bounds.height; row += 1) {
        for (let column = 0; column <= width - bounds.width; column += 1) {
          const cells = placedCells(rotation.cells, { row, column });
          if (cells.some((cell) => blocked.has(cell.row + ':' + cell.column))) continue;
          candidates.push({
            shapeId,
            rotation: rotation.rotation,
            origin: { row, column },
            label: shape.label,
            pattern: shape.pattern,
            cells,
          });
        }
      }
    }
  }
  const shuffled = createRng(indexedSeed(seed, 'manifest', index)).shuffle(candidates);
  const selected = [];
  const selectedCells = new Set(blocked);
  for (const candidate of shuffled) {
    if (candidate.cells.some((cell) => selectedCells.has(cell.row + ':' + cell.column))) {
      continue;
    }
    const manifest = {
      id: 'manifest-' + index + '-' + selected.length,
      ...candidate,
    };
    if (isManifestComplete(board, manifest)) continue;
    selected.push(manifest);
    for (const cell of candidate.cells) selectedCells.add(cell.row + ':' + cell.column);
    if (selected.length === count) return selected;
  }
  throw new ManifestGenerationError('Unable to select Cargo Manifest zones');
}

export function selectNextManifestZones({
  startIndex, maxAttempts = 64, ...options
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const acceptedIndex = startIndex + attempt;
    try {
      return {
        manifests: selectManifestZones({ ...options, index: acceptedIndex }),
        nextIndex: acceptedIndex + 1,
      };
    } catch (error) {
      if (!(error instanceof ManifestGenerationError)) throw error;
    }
  }
  throw new ManifestGenerationError('Unable to select a manifest within the bound');
}
```

- [ ] **Step 9: Run geometry tests**

Run: `node --test Tests/games/cargo-geometry.test.mjs`
Expected: PASS, including rotation deduplication, no seven-piece defining set, partial-zone dispatch, split components, and hostile-state rejection.

- [ ] **Step 10: Commit shared geometry**

```bash
git add Resources/games/cargo-geometry.js Tests/games/cargo-geometry.test.mjs
git commit -m "feat(games): add shared cargo geometry"
```

---

### Task 3: Kinnoki Stack deterministic reducer and lock resolution

**Files:**
- Create: `Resources/games/kinnoki-stack.js`
- Create: `Tests/games/kinnoki-stack.test.mjs`

**Interfaces:**
- Consumes: Store v2 deterministic helpers and shared cargo geometry.
- Produces: `STACK_CONFIG`, `createStackDefinition({ difficulty, seed })`, `stackDefinitionSignature(definition)`, `createStackState(definition)`, `prepareStackForContinue(play)`, `reduceStack(state, action)`, `validateStackState(value, difficulty)`, `describeStack(state)`, and `stackCompletionPayload(state, elapsedMs)`. Task 4 adds time advancement without changing these state names.

- [ ] **Step 1: Write failing deterministic spawn, scoring, and dispatch tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStackDefinition, createStackState, reduceStack, stackDefinitionSignature,
  stackCompletionPayload, validateStackState,
} from '../../Resources/games/kinnoki-stack.js';

const stackState = (difficulty, seed) => (
  createStackState(createStackDefinition({ difficulty, seed }))
);

const apply = (state, action) => reduceStack(state, action).state;

test('same seed creates the same cargo, manifest, and tide forecast', () => {
  assert.deepEqual(
    stackState('hard', 20260713),
    stackState('hard', 20260713),
  );
  assert.notEqual(
    stackDefinitionSignature(createStackDefinition({ difficulty: 'hard', seed: 20260713 })),
    stackDefinitionSignature(createStackDefinition({ difficulty: 'hard', seed: 20260714 })),
  );
});

test('spawn uses rotation zero, row zero, and floor-centred bounds', () => {
  const state = stackState('easy', 1);
  assert.equal(state.width, 12);
  assert.equal(state.height, 18);
  assert.equal(state.active.rotation, 0);
  assert.equal(state.active.row, 0);
  assert.equal(
    state.active.column,
    Math.floor((12 - state.active.bounds.width) / 2),
  );
});

test('difficulty owns the exact next-cargo preview length', () => {
  for (const [difficulty, count] of [['easy', 3], ['medium', 2], ['hard', 1]]) {
    const state = stackState(difficulty, 99);
    assert.equal(state.preview.length, count);
    assert.equal(new Set(state.preview.map((piece) => piece.sequenceIndex)).size, count);
  }
});

test('lock scores placement then one shared-combo dispatch without row clearing', () => {
  const initial = stackState('easy', 2);
  const board = initial.board.map((row) => [...row]);
  for (let column = 0; column < 4; column += 1) {
    board[16][column] = { pieceId: 70, typeId: 'dock-square' };
  }
  for (let column = 0; column < 2; column += 1) {
    board[17][column] = { pieceId: 71, typeId: 'crate-pair' };
  }
  const fixture = {
    ...initial,
    status: 'active',
    board,
    score: 0,
    combo: 1,
    manifests: [{
      id: 'manifest-a', shapeId: 'rectangle-eight', rotation: 0,
      origin: { row: 16, column: 0 }, label: 'Manifest A', pattern: 'bands',
      cells: [
        { row: 16, column: 0 }, { row: 16, column: 1 },
        { row: 16, column: 2 }, { row: 16, column: 3 },
        { row: 17, column: 0 }, { row: 17, column: 1 },
        { row: 17, column: 2 }, { row: 17, column: 3 },
      ],
    }],
    active: {
      pieceId: 90, typeId: 'crate-pair', rotation: 0,
      row: 17, column: 2, bounds: { width: 2, height: 1 },
    },
  };
  const result = reduceStack(fixture, { type: 'hard-drop' });
  assert.equal(result.state.score, 20 + (100 * 8 * 2));
  assert.equal(result.state.combo, 2);
  assert.equal(result.state.bestCombo, 2);
  assert.equal(result.state.dispatchedManifests, 1);
  assert.equal(result.state.board[17][0], null);
  assert.equal(result.state.board[17][3], null);
  assert.equal(result.events.filter((event) => event.type === 'dispatch').length, 1);
});

test('two completed manifests dispatch simultaneously with one combo multiplier', () => {
  const initial = stackState('medium', 19);
  const board = initial.board.map((row) => [...row]);
  const manifests = [0, 4].map((column, index) => ({
    id: 'manifest-' + index,
    shapeId: 'rectangle-eight',
    rotation: 0,
    origin: { row: 16, column },
    label: 'Eight-cell manifest',
    pattern: 'crosshatch',
    cells: [0, 1].flatMap((rowOffset) => [0, 1, 2, 3].map((columnOffset) => ({
      row: 16 + rowOffset,
      column: column + columnOffset,
    }))),
  }));
  for (const manifest of manifests) {
    for (const cell of manifest.cells) {
      if (cell.row === 17 && (cell.column === 3 || cell.column === 4)) continue;
      board[cell.row][cell.column] = { pieceId: 70, typeId: 'dock-square' };
    }
  }
  const result = reduceStack({
    ...initial,
    status: 'active',
    board,
    manifests,
    tide: { direction: 'left', placementsRemaining: 5, eventIndex: 0 },
    active: {
      pieceId: 90, typeId: 'crate-pair', rotation: 0,
      row: 17, column: 3, bounds: { width: 2, height: 1 },
    },
  }, { type: 'hard-drop' });
  const dispatch = result.events.find((event) => event.type === 'dispatch');
  assert.deepEqual(dispatch.manifestIds, ['manifest-0', 'manifest-1']);
  assert.equal(dispatch.cells, 16);
  assert.equal(dispatch.combo, 1);
  assert.equal(dispatch.scoreAdded, 1600);
  assert.equal(result.state.score, 1620);
  assert.equal(result.state.dispatchedManifests, 2);
});

test('Stack validator accepts an untouched state and rejects forged geometry', () => {
  const state = stackState('medium', 23);
  assert.deepEqual(validateStackState(state, 'medium'), { valid: true, errors: [] });
  const forged = { ...state, board: state.board.slice(1) };
  assert.equal(validateStackState(forged, 'medium').valid, false);
  assert.equal(validateStackState({
    ...state, definition: { ...state.definition, version: 2 },
  }, 'medium').valid, false);
  assert.equal(validateStackState({
    ...state, active: { ...state.active, sequenceIndex: state.sequenceIndex + 1 },
  }, 'medium').valid, false);
  assert.equal(validateStackState({
    ...state,
    tide: { ...state.tide, direction: state.tide.direction === 'left' ? 'right' : 'left' },
  }, 'medium').valid, false);
});

test('Stack definitions reject values outside the unsigned seed contract', () => {
  assert.throws(() => createStackDefinition({ difficulty: 'easy', seed: -1 }), TypeError);
  assert.throws(() => createStackDefinition({
    difficulty: 'easy', seed: 0x1_0000_0000,
  }), TypeError);
});

test('terminal records use run-highest combo even after current combo reset', () => {
  const state = {
    ...stackState('easy', 24), status: 'terminal', terminalReason: 'crane-line',
    score: 500, combo: 0, bestCombo: 2, dispatchedManifests: 0,
  };
  const payload = stackCompletionPayload(state, 1234);
  assert.deepEqual(payload.records, { score: 500, combo: 2 });
  assert.equal(payload.summary.dispatchedManifests, 0);
  assert.equal(payload.summary.reason, 'crane-line');
});
```

- [ ] **Step 2: Write failing tide, crane rescue, top-out, and terminal immutability tests**

Append these concrete fixtures and assertions:

```js
const emptyBoard = () => Array.from({ length: 18 }, () => Array(12).fill(null));
const rectangleEight = (id, row, column) => ({
  id, shapeId: 'rectangle-eight', rotation: 0, origin: { row, column },
  label: 'Eight-cell manifest', pattern: 'bands',
  cells: [0, 1].flatMap((rowOffset) => [0, 1, 2, 3].map((columnOffset) => ({
    row: row + rowOffset, column: column + columnOffset,
  }))),
});
const occupiedCount = (board) => board.flat().filter(Boolean).length;

test('right tide moves settled components rigidly and resets its saved forecast', () => {
  const state = stackState('medium', 31);
  const board = emptyBoard();
  board[10][0] = { pieceId: 50, typeId: 'crate-pair' };
  board[10][10] = { pieceId: 51, typeId: 'crate-pair' };
  const beforeCount = occupiedCount(board) + 2;
  const result = reduceStack({
    ...state, status: 'active', board,
    manifests: [rectangleEight('manifest-safe', 12, 0)],
    active: {
      pieceId: 90, typeId: 'crate-pair', rotation: 0,
      row: 17, column: 4, bounds: { width: 2, height: 1 },
    },
    tide: { direction: 'right', placementsRemaining: 1, eventIndex: 0 },
  }, { type: 'hard-drop' });
  assert.equal(occupiedCount(result.state.board), beforeCount);
  assert.equal(result.state.board[10][1].pieceId, 50);
  assert.equal(result.state.board[10][11].pieceId, 51);
  assert.equal(result.state.tide.eventIndex, 1);
  assert.ok(result.state.tide.placementsRemaining >= 6);
  assert.ok(result.state.tide.placementsRemaining <= 8);
  assert.match(result.state.tide.direction, /^(left|right)$/);
  assert.deepEqual(result.events.find((event) => event.type === 'tide-shift'), {
    type: 'tide-shift', direction: 'right', movedComponents: 3,
  });
});

test('a tide-enabled manifest uses only normal dispatch scoring', () => {
  const state = stackState('medium', 37);
  const board = emptyBoard();
  board[10][1] = { pieceId: 60, typeId: 'crate-pair' };
  for (let column = 3; column < 12; column += 1) {
    board[10][column] = { pieceId: 61, typeId: 'barge-five' };
  }
  for (let column = 2; column < 12; column += 1) {
    board[11][column] = { pieceId: 62, typeId: 'barge-five' };
  }
  const manifest = {
    id: 'manifest-tide', shapeId: 'rectangle-six', rotation: 0,
    origin: { row: 10, column: 2 }, label: 'Six-cell manifest', pattern: 'bands',
    cells: [0, 1].flatMap((rowOffset) => [0, 1, 2].map((columnOffset) => ({
      row: 10 + rowOffset, column: 2 + columnOffset,
    }))),
  };
  const result = reduceStack({
    ...state, status: 'active', board, manifests: [manifest],
    score: 0, combo: 0,
    active: {
      pieceId: 90, typeId: 'crate-pair', rotation: 0,
      row: 17, column: 4, bounds: { width: 2, height: 1 },
    },
    tide: { direction: 'right', placementsRemaining: 1, eventIndex: 0 },
  }, { type: 'hard-drop' });
  assert.equal(result.state.score, 20 + (100 * 6 * 1));
  assert.equal(result.events.filter((event) => event.type === 'tide-shift').length, 1);
  assert.equal(result.events.filter((event) => event.type === 'dispatch').length, 1);
});

test('saved tide warning fires at the configured remaining count', () => {
  const state = stackState('medium', 38);
  const result = reduceStack({
    ...state, status: 'active', manifests: [rectangleEight('manifest-safe', 10, 0)],
    active: {
      pieceId: 90, typeId: 'crate-pair', rotation: 0,
      row: 17, column: 4, bounds: { width: 2, height: 1 },
    },
    tide: { direction: 'left', placementsRemaining: 4, eventIndex: 0 },
  }, { type: 'hard-drop' });
  assert.deepEqual(result.events.find((event) => event.type === 'tide-warning'), {
    type: 'tide-warning', direction: 'left', placementsRemaining: 3,
  });
});

test('a manifest dispatch rescues row zero before the crane check', () => {
  const state = stackState('easy', 42);
  const board = emptyBoard();
  for (const [row, columns] of [[0, [0, 1]], [1, [0, 1, 2, 3]]]) {
    for (const column of columns) board[row][column] = {
      pieceId: 70 + row, typeId: row === 0 ? 'crate-pair' : 'dock-square',
    };
  }
  board[2][2] = { pieceId: 72, typeId: 'crate-pair' };
  board[2][3] = { pieceId: 72, typeId: 'crate-pair' };
  const result = reduceStack({
    ...state, status: 'active', board,
    manifests: [rectangleEight('manifest-rescue', 0, 0)],
    active: {
      pieceId: 90, typeId: 'crate-pair', rotation: 0,
      row: 0, column: 2, bounds: { width: 2, height: 1 },
    },
  }, { type: 'hard-drop' });
  assert.notEqual(result.state.status, 'terminal');
  assert.equal(result.state.board[0].every((cell) => cell === null), true);
  assert.equal(result.state.board[1].every((cell) => cell === null), true);
});

test('crane-line, spawn-blocked, saturation, and terminal immutability are exact', () => {
  const base = stackState('easy', 53);
  const craneBoard = emptyBoard();
  craneBoard[1][4] = { pieceId: 30, typeId: 'crate-pair' };
  const crane = reduceStack({
    ...base, status: 'active', board: craneBoard,
    manifests: [rectangleEight('manifest-safe', 10, 0)],
    score: Number.MAX_SAFE_INTEGER,
    active: {
      pieceId: 90, typeId: 'crate-pair', rotation: 0,
      row: 0, column: 4, bounds: { width: 2, height: 1 },
    },
  }, { type: 'hard-drop' });
  assert.equal(crane.state.terminalReason, 'crane-line');
  assert.equal(crane.state.score, Number.MAX_SAFE_INTEGER);
  const ignored = reduceStack(crane.state, { type: 'move', deltaColumn: 1 });
  assert.equal(ignored.state, crane.state);
  assert.deepEqual(ignored.events, []);

  const spawnBoard = emptyBoard();
  spawnBoard[2][5] = { pieceId: 40, typeId: 'crate-pair' };
  const spawned = reduceStack({
    ...base, status: 'active', board: spawnBoard,
    manifests: [rectangleEight('manifest-safe', 10, 0)],
    active: {
      pieceId: 91, typeId: 'crate-pair', rotation: 0,
      row: 17, column: 0, bounds: { width: 2, height: 1 },
    },
    preview: [{
      pieceId: 92, typeId: 'hook-four', rotation: 0, sequenceIndex: 1,
      bounds: { width: 2, height: 3 },
    }, ...base.preview.slice(1)],
  }, { type: 'hard-drop' });
  assert.equal(spawned.state.terminalReason, 'spawn-blocked');
});
```

- [ ] **Step 3: Run the Stack suite and verify the module is absent**

Run: `node --test Tests/games/kinnoki-stack.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4: Add Stack imports, exact difficulty constants, and definitions**

Create `Resources/games/kinnoki-stack.js` with these imports and immutable constants:

```js
import { createRng, indexedSeed, saturatingAdd } from './core.js';
import {
  CARGO_CATALOG,
  ManifestGenerationError,
  boundsFor,
  canPlace,
  connectedComponents,
  dispatchCompletedManifests,
  placePiece,
  rotationsFor,
  selectNextManifestZones,
  validateBoard,
  validateManifest,
} from './cargo-geometry.js';

const STACK_WIDTH = 12;
const STACK_HEIGHT = 18;
const STACK_DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);

export const STACK_CONFIG = Object.freeze({
  easy: Object.freeze({
    fallMs: 900,
    lockDelayMs: 850,
    previewCount: 3,
    cargoCount: 6,
    manifestCount: 1,
    manifestShapeIds: Object.freeze(['rectangle-eight']),
    tideRange: null,
    tideWarnings: Object.freeze([]),
  }),
  medium: Object.freeze({
    fallMs: 650,
    lockDelayMs: 600,
    previewCount: 2,
    cargoCount: 12,
    manifestCount: 2,
    manifestShapeIds: Object.freeze([
      'rectangle-six', 'rectangle-eight', 'step-five', 'step-seven',
    ]),
    tideRange: Object.freeze([6, 8]),
    tideWarnings: Object.freeze([3, 1]),
  }),
  hard: Object.freeze({
    fallMs: 420,
    lockDelayMs: 420,
    previewCount: 1,
    cargoCount: 12,
    manifestCount: 2,
    manifestShapeIds: Object.freeze([
      'step-five', 'step-seven', 'corner-six', 'harbour-seven',
    ]),
    tideRange: Object.freeze([4, 5]),
    tideWarnings: Object.freeze([2, 1]),
  }),
});

export const STACK_MAX_FRAME_DELTA_MS = 250;

export function createStackDefinition({ difficulty, seed }) {
  if (!STACK_DIFFICULTIES.includes(difficulty)
      || !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new TypeError('Invalid Kinnoki Stack definition request');
  }
  return Object.freeze({
    version: 1,
    game: 'kinnoki-stack',
    mode: 'default',
    difficulty,
    seed: seed >>> 0,
    width: STACK_WIDTH,
    height: STACK_HEIGHT,
  });
}

export function stackDefinitionSignature(definition) {
  return JSON.stringify([
    definition.version,
    definition.game,
    definition.mode,
    definition.difficulty,
    definition.seed,
    definition.width,
    definition.height,
  ]);
}
```

- [ ] **Step 5: Add independent cargo and tide stream helpers**

Append helpers that make each cargo index and tide event independently reproducible:

```js
const emptyStackBoard = () => Array.from(
  { length: STACK_HEIGHT },
  () => Array(STACK_WIDTH).fill(null),
);

const cargoForIndex = (definition, sequenceIndex) => {
  const config = STACK_CONFIG[definition.difficulty];
  const rng = createRng(indexedSeed(definition.seed, 'cargo', sequenceIndex));
  const cargo = CARGO_CATALOG[rng.int(config.cargoCount)];
  const rotation = rotationsFor(cargo.id).find((candidate) => candidate.rotation === 0);
  return {
    pieceId: sequenceIndex,
    typeId: cargo.id,
    rotation: 0,
    sequenceIndex,
    bounds: boundsFor(rotation.cells),
  };
};

const activeAtSpawn = (descriptor) => ({
  ...descriptor,
  row: 0,
  column: Math.floor((STACK_WIDTH - descriptor.bounds.width) / 2),
});

const tideForEvent = (definition, eventIndex) => {
  const range = STACK_CONFIG[definition.difficulty].tideRange;
  if (range === null) {
    return { direction: null, placementsRemaining: null, eventIndex };
  }
  const rng = createRng(indexedSeed(definition.seed, 'tide', eventIndex));
  return {
    direction: rng.int(2) === 0 ? 'left' : 'right',
    placementsRemaining: range[0] + rng.int(range[1] - range[0] + 1),
    eventIndex,
  };
};

const cloneSerializable = (value) => JSON.parse(JSON.stringify(value));
```

- [ ] **Step 6: Build and restore the complete deterministic Stack state**

Append the state constructors. Keep every stream index and grounded-time field in the serialized state:

```js
export function createStackState(definition) {
  let expectedDefinition;
  try {
    expectedDefinition = createStackDefinition({
      difficulty: definition?.difficulty, seed: definition?.seed,
    });
  } catch {}
  if (!expectedDefinition
      || JSON.stringify(definition) !== JSON.stringify(expectedDefinition)) {
    throw new TypeError('Invalid Kinnoki Stack definition');
  }
  const config = STACK_CONFIG[definition.difficulty];
  const board = emptyStackBoard();
  const selected = selectNextManifestZones({
    board,
    width: STACK_WIDTH,
    height: STACK_HEIGHT,
    shapeIds: config.manifestShapeIds,
    seed: definition.seed,
    startIndex: 0,
    count: config.manifestCount,
  });
  const active = activeAtSpawn(cargoForIndex(definition, 0));
  const preview = Array.from(
    { length: config.previewCount },
    (_, offset) => cargoForIndex(definition, offset + 1),
  );
  return {
    definition,
    difficulty: definition.difficulty,
    width: STACK_WIDTH,
    height: STACK_HEIGHT,
    status: 'preview',
    board,
    active,
    preview,
    sequenceIndex: 0,
    nextPieceId: config.previewCount + 1,
    manifests: selected.manifests,
    manifestIndex: selected.nextIndex,
    tide: tideForEvent(definition, 0),
    components: [],
    score: 0,
    combo: 0,
    bestCombo: 0,
    dispatchedManifests: 0,
    placements: 0,
    assisted: false,
    stepMode: false,
    grounded: null,
    gravityAccumulatorMs: 0,
    terminalReason: null,
  };
}

export function prepareStackForContinue(play) {
  if (!['active', 'paused'].includes(play?.status)
      || !validateStackState(play, play?.difficulty).valid) {
    throw new TypeError('Saved Kinnoki Stack state is invalid');
  }
  return { ...cloneSerializable(play), status: 'paused' };
}
```

- [ ] **Step 7: Implement rigid one-column tide movement**

Append the exact downstream-first component movement. Remove a component before testing its destination so its own former cells count as empty:

```js
function applyTide(board, direction) {
  const columnDelta = direction === 'right' ? 1 : -1;
  const components = connectedComponents(board).sort((left, right) => (
    direction === 'right'
      ? right.maxColumn - left.maxColumn || right.id.localeCompare(left.id)
      : left.minColumn - right.minColumn || left.id.localeCompare(right.id)
  ));
  const working = board.map((row) => [...row]);
  let movedComponents = 0;

  for (const component of components) {
    const cargo = component.cells.map(({ row, column }) => ({
      row,
      column,
      value: working[row][column],
    }));
    for (const { row, column } of cargo) working[row][column] = null;
    const destination = cargo.map(({ row, column, value }) => ({
      row,
      column: column + columnDelta,
      value,
    }));
    const canMove = destination.every(({ row, column }) => (
      row >= 0
      && row < STACK_HEIGHT
      && column >= 0
      && column < STACK_WIDTH
      && working[row][column] === null
    ));
    const chosen = canMove ? destination : cargo;
    for (const { row, column, value } of chosen) working[row][column] = value;
    if (canMove) movedComponents += 1;
  }

  return { board: working, movedComponents };
}
```

- [ ] **Step 8: Resolve placement score and the saved tide forecast**

Append a helper that performs placement and tide work before any manifest check:

```js
function placeAndApplyTide(state) {
  const rotation = rotationsFor(state.active.typeId)
    .find((candidate) => candidate.rotation === state.active.rotation);
  const placementScore = 10 * rotation.cells.length;
  let board = placePiece(state.board, state.active);
  let tide = state.tide;
  const events = [{
    type: 'placed',
    pieceId: state.active.pieceId,
    cellCount: rotation.cells.length,
    scoreAdded: placementScore,
  }];

  if (STACK_CONFIG[state.difficulty].tideRange !== null) {
    tide = { ...tide, placementsRemaining: tide.placementsRemaining - 1 };
    if (tide.placementsRemaining === 0) {
      const shifted = applyTide(board, tide.direction);
      board = shifted.board;
      events.push({
        type: 'tide-shift',
        direction: tide.direction,
        movedComponents: shifted.movedComponents,
      });
      tide = tideForEvent(state.definition, tide.eventIndex + 1);
    }
    if (STACK_CONFIG[state.difficulty].tideWarnings
      .includes(tide.placementsRemaining)) {
      events.push({
        type: 'tide-warning',
        direction: tide.direction,
        placementsRemaining: tide.placementsRemaining,
      });
    }
  }

  return {
    board,
    tide,
    events,
    score: saturatingAdd(state.score, placementScore),
    placements: saturatingAdd(state.placements, 1),
  };
}
```

- [ ] **Step 9: Dispatch all completed manifests with one combo**

Append simultaneous scoring/removal and deterministic replacement. Preserve the post-dispatch board if the bounded replacement search is exhausted:

```js
function resolveManifests(state, board, score, events) {
  const dispatched = dispatchCompletedManifests(board, state.manifests);
  if (dispatched.completed.length === 0) {
    if (state.combo > 0) {
      events.push({ type: 'combo-reset', previousCombo: state.combo });
    }
    return {
      board,
      manifests: state.manifests,
      manifestIndex: state.manifestIndex,
      components: connectedComponents(board),
      score,
      combo: 0,
      bestCombo: state.bestCombo,
      dispatchedManifests: state.dispatchedManifests,
      error: null,
    };
  }

  const combo = saturatingAdd(state.combo, 1);
  const dispatchScore = Math.min(
    Number.MAX_SAFE_INTEGER,
    100 * dispatched.dispatchedCells * combo,
  );
  events.push({
    type: 'dispatch',
    manifestIds: dispatched.completed.map(({ id }) => id),
    cells: dispatched.dispatchedCells,
    combo,
    scoreAdded: dispatchScore,
  });
  const incomplete = state.manifests.filter(
    (manifest) => !dispatched.completed.some(({ id }) => id === manifest.id),
  );

  try {
    const replacement = selectNextManifestZones({
      board: dispatched.board,
      width: STACK_WIDTH,
      height: STACK_HEIGHT,
      shapeIds: STACK_CONFIG[state.difficulty].manifestShapeIds,
      seed: state.definition.seed,
      startIndex: state.manifestIndex,
      count: dispatched.completed.length,
      occupied: incomplete,
    });
    return {
      board: dispatched.board,
      manifests: [...incomplete, ...replacement.manifests],
      manifestIndex: replacement.nextIndex,
      components: connectedComponents(dispatched.board),
      score: saturatingAdd(score, dispatchScore),
      combo,
      bestCombo: Math.max(state.bestCombo, combo),
      dispatchedManifests: saturatingAdd(
        state.dispatchedManifests,
        dispatched.completed.length,
      ),
      error: null,
    };
  } catch (error) {
    if (!(error instanceof ManifestGenerationError)) throw error;
    return {
      board: dispatched.board,
      manifests: incomplete,
      manifestIndex: state.manifestIndex,
      components: connectedComponents(dispatched.board),
      score: saturatingAdd(score, dispatchScore),
      combo,
      bestCombo: Math.max(state.bestCombo, combo),
      dispatchedManifests: saturatingAdd(
        state.dispatchedManifests,
        dispatched.completed.length,
      ),
      error: {
        type: 'error',
        code: 'manifest-generation',
        message: 'A new Cargo Manifest could not be prepared.',
      },
    };
  }
}
```

- [ ] **Step 10: Check the crane line and spawn the exact next stream item**

Append terminal and preview-queue helpers:

```js
const terminalState = (state, reason) => ({
  ...state,
  status: 'terminal',
  active: null,
  grounded: null,
  gravityAccumulatorMs: 0,
  terminalReason: reason,
});

function spawnNext(state, events) {
  const nextDescriptor = state.preview[0];
  const appended = cargoForIndex(state.definition, state.nextPieceId);
  const preview = [...state.preview.slice(1), appended];
  const active = activeAtSpawn(nextDescriptor);
  const rotation = rotationsFor(active.typeId)
    .find((candidate) => candidate.rotation === active.rotation);
  if (!canPlace(state.board, rotation.cells, active)) {
    const terminal = terminalState(state, 'spawn-blocked');
    return {
      state: terminal,
      events: [...events, { type: 'terminal', reason: 'spawn-blocked' }],
    };
  }
  return {
    state: {
      ...state,
      active,
      preview,
      sequenceIndex: nextDescriptor.sequenceIndex,
      nextPieceId: state.nextPieceId + 1,
      grounded: null,
      gravityAccumulatorMs: 0,
    },
    events: [...events, {
      type: 'spawned',
      pieceId: active.pieceId,
      typeId: active.typeId,
      preview,
    }],
  };
}

function lockActive(state) {
  const placed = placeAndApplyTide(state);
  const events = [...placed.events];
  const resolved = resolveManifests(
    state,
    placed.board,
    placed.score,
    events,
  );
  const settled = {
    ...state,
    board: resolved.board,
    manifests: resolved.manifests,
    manifestIndex: resolved.manifestIndex,
    tide: placed.tide,
    components: resolved.components,
    score: resolved.score,
    combo: resolved.combo,
    bestCombo: resolved.bestCombo,
    dispatchedManifests: resolved.dispatchedManifests,
    placements: placed.placements,
    active: null,
    grounded: null,
    gravityAccumulatorMs: 0,
  };
  if (resolved.error !== null) {
    return {
      state: { ...settled, status: 'error' },
      events: [...events, resolved.error],
    };
  }
  if (settled.board[0].some(Boolean) || settled.board[1].some(Boolean)) {
    return {
      state: terminalState(settled, 'crane-line'),
      events: [...events, { type: 'terminal', reason: 'crane-line' }],
    };
  }
  return spawnNext(settled, events);
}
```

- [ ] **Step 11: Implement movement, rotation, drops, and terminal guards**

Append the pure active-play reducer. Task 4 will extend its lifecycle and grounded-state branches without adding a second clock action:

```js
const invalid = (state, action, reason) => ({
  state,
  events: [{ type: 'invalid', action, reason }],
});

const canUseActive = (state, active) => {
  const rotation = rotationsFor(active.typeId)
    .find((candidate) => candidate.rotation === active.rotation);
  return rotation !== undefined && canPlace(state.board, rotation.cells, active);
};

const canDescend = (state) => canUseActive(state, {
  ...state.active,
  row: state.active.row + 1,
});

const movedState = (state, active, source) => ({
  state: { ...state, active },
  events: [{
    type: 'moved',
    source,
    row: active.row,
    column: active.column,
  }],
});

function rotateActive(state) {
  const rotations = rotationsFor(state.active.typeId);
  const current = rotations.findIndex(
    ({ rotation }) => rotation === state.active.rotation,
  );
  const nextRotation = rotations[(current + 1) % rotations.length];
  const active = {
    ...state.active,
    rotation: nextRotation.rotation,
    bounds: boundsFor(nextRotation.cells),
  };
  if (!canPlace(state.board, nextRotation.cells, active)) {
    return invalid(state, 'rotate', 'Cargo cannot rotate here.');
  }
  return {
    state: { ...state, active },
    events: [{
      type: 'rotated',
      pieceId: active.pieceId,
      rotation: active.rotation,
    }],
  };
}

function reduceActiveStack(state, action) {
  if (action.type === 'move') {
    if (![-1, 1].includes(action.deltaColumn)) {
      return invalid(state, 'move', 'Move must be one column.');
    }
    const active = {
      ...state.active,
      column: state.active.column + action.deltaColumn,
    };
    return canUseActive(state, active)
      ? movedState(state, active, 'player')
      : invalid(state, 'move', 'Cargo cannot move there.');
  }
  if (action.type === 'rotate') {
    return action.quarterTurns === 1
      ? rotateActive(state)
      : invalid(state, 'rotate', 'Rotation must be one quarter turn.');
  }
  if (action.type === 'soft-drop') {
    const active = { ...state.active, row: state.active.row + 1 };
    return canUseActive(state, active)
      ? movedState(state, active, 'player')
      : invalid(state, 'soft-drop', 'Cargo cannot descend.');
  }
  if (action.type === 'hard-drop') {
    let active = state.active;
    while (canUseActive(state, { ...active, row: active.row + 1 })) {
      active = { ...active, row: active.row + 1 };
    }
    return lockActive({ ...state, active });
  }
  return invalid(state, String(action.type), 'Action is not available.');
}

export function reduceStack(state, action) {
  if (['terminal', 'error', 'disposed'].includes(state.status)) {
    return { state, events: [] };
  }
  if (state.status !== 'active') {
    return invalid(state, String(action?.type), 'Start or resume the run first.');
  }
  return reduceActiveStack(state, action ?? {});
}
```

- [ ] **Step 12: Implement hostile-state validation**

Append a validator that accepts only resumable `preview`, `active`, or `paused` states and verifies every deterministic queue/tide invariant:

```js
const nonNegativeSafeInteger = (value) => (
  Number.isSafeInteger(value) && value >= 0
);
const nonNegativeFinite = (value) => Number.isFinite(value) && value >= 0;

const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function validateStackState(value, difficulty) {
  const errors = [];
  const config = STACK_CONFIG[difficulty];
  let definitionValid = false;
  try {
    const expectedDefinition = createStackDefinition({
      difficulty, seed: value?.definition?.seed,
    });
    definitionValid = sameJson(value?.definition, expectedDefinition);
  } catch {}
  if (!config || !definitionValid
      || value?.difficulty !== difficulty
      || value?.width !== STACK_WIDTH || value?.height !== STACK_HEIGHT) {
    errors.push('invalid definition');
  }
  if (!['preview', 'active', 'paused'].includes(value?.status)
      || value?.terminalReason !== null) {
    errors.push('state is not resumable');
  }

  const boardResult = validateBoard(value?.board, {
    width: STACK_WIDTH,
    height: STACK_HEIGHT,
  });
  errors.push(...boardResult.errors);

  const definition = value?.definition;
  const active = value?.active;
  try {
    if (!definition
        || !nonNegativeSafeInteger(active?.sequenceIndex)
        || active?.pieceId !== active.sequenceIndex
        || active.sequenceIndex !== value?.sequenceIndex) {
      throw new TypeError('Invalid active identity');
    }
    const expected = cargoForIndex(definition, active.sequenceIndex);
    const rotation = rotationsFor(active.typeId)
      .find((candidate) => candidate.rotation === active.rotation);
    if (expected.typeId !== active.typeId
        || !rotation
        || !sameJson(boundsFor(rotation.cells), active.bounds)
        || !Number.isInteger(active.row)
        || !Number.isInteger(active.column)
        || !canPlace(value.board, rotation.cells, active)) {
      throw new TypeError('Invalid active geometry');
    }
  } catch {
    errors.push('invalid active cargo');
  }

  let validPreview = Array.isArray(value?.preview)
    && value.preview.length === config?.previewCount;
  try {
    validPreview = validPreview && value.preview.every((piece, offset) => {
      const sequenceIndex = value.sequenceIndex + offset + 1;
      return nonNegativeSafeInteger(sequenceIndex)
        && piece?.pieceId === sequenceIndex
        && piece?.sequenceIndex === sequenceIndex
        && sameJson(piece, cargoForIndex(definition, sequenceIndex));
    });
  } catch {
    validPreview = false;
  }
  if (!validPreview
      || value.nextPieceId !== value.sequenceIndex + config?.previewCount + 1) {
    errors.push('invalid preview queue');
  }

  const manifestCells = new Set();
  if (!Array.isArray(value?.manifests)
      || value.manifests.length !== config?.manifestCount) {
    errors.push('invalid manifest count');
  } else {
    for (const manifest of value.manifests) {
      const result = validateManifest(manifest, {
        width: STACK_WIDTH,
        height: STACK_HEIGHT,
      });
      if (!result.valid) errors.push(...result.errors);
      for (const { row, column } of manifest.cells ?? []) {
        const key = row + ':' + column;
        if (manifestCells.has(key)) errors.push('overlapping manifests');
        manifestCells.add(key);
      }
    }
  }

  const counters = [
    value?.score,
    value?.combo,
    value?.bestCombo,
    value?.dispatchedManifests,
    value?.placements,
    value?.sequenceIndex,
    value?.nextPieceId,
    value?.manifestIndex,
  ];
  if (counters.some((counter) => !nonNegativeSafeInteger(counter))
      || value.bestCombo < value.combo
      || !nonNegativeFinite(value?.gravityAccumulatorMs)
      || typeof value.assisted !== 'boolean'
      || typeof value.stepMode !== 'boolean') {
    errors.push('invalid counters');
  }

  let tideValid = false;
  try {
    tideValid = nonNegativeSafeInteger(value?.tide?.eventIndex)
      && sameJson(value.tide, tideForEvent(definition, value.tide.eventIndex));
  } catch {}
  if (!tideValid) errors.push('invalid tide forecast');

  const grounded = value?.grounded;
  const validGrounded = grounded === null
    || grounded?.kind === 'automatic'
      && nonNegativeFinite(grounded.remainingMs)
      && grounded.remainingMs <= config?.lockDelayMs
    || grounded?.kind === 'step' && grounded.blockedOnce === true;
  if (!validGrounded) errors.push('invalid grounded state');

  const expectedComponents = connectedComponents(value?.board ?? []);
  if (!sameJson(value?.components, expectedComponents)) {
    errors.push('invalid connected components');
  }
  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 13: Add the text description and completion payload**

Append the read-only summary helpers:

```js
export function describeStack(state) {
  const cargo = CARGO_CATALOG.find(({ id }) => id === state.active?.typeId);
  const occupiedRows = state.board
    .map((row, index) => row.some(Boolean) ? index : null)
    .filter((row) => row !== null);
  const stackHeight = occupiedRows.length === 0
    ? 0
    : STACK_HEIGHT - Math.min(...occupiedRows);
  const fills = state.manifests.map((manifest) => {
    const filled = manifest.cells.filter(
      ({ row, column }) => state.board[row][column] !== null,
    ).length;
    return filled + ' of ' + manifest.cells.length;
  }).join(', ');
  const tide = state.tide.direction === null
    ? 'no tide'
    : state.tide.direction + ' tide in '
      + state.tide.placementsRemaining + ' placements';
  const position = state.active === null
    ? 'no active cargo'
    : cargo.label + ' at row ' + (state.active.row + 1)
      + ', column ' + (state.active.column + 1)
      + ', rotation ' + state.active.rotation;
  return position + '; stack height ' + stackHeight
    + '; manifests ' + fills + '; score ' + state.score + '; ' + tide + '.';
}

export function stackCompletionPayload(state, elapsedMs) {
  if (state.status !== 'terminal') return null;
  if (!nonNegativeSafeInteger(elapsedMs)) {
    throw new TypeError('Elapsed time must be a non-negative safe integer');
  }
  return {
    game: 'kinnoki-stack',
    mode: 'default',
    records: { score: state.score, combo: state.bestCombo },
    summary: {
      score: state.score,
      dispatchedManifests: state.dispatchedManifests,
      bestCombo: state.bestCombo,
      elapsedMs,
      assisted: state.assisted,
      reason: state.terminalReason,
    },
  };
}
```

- [ ] **Step 14: Run Stack engine and geometry tests**

Run: `node --test Tests/games/kinnoki-stack.test.mjs Tests/games/cargo-geometry.test.mjs`
Expected: PASS for exact scoring order, multi-manifest dispatch, tide invariants, crane rescue, top-out, spawn, saturation, and immutability.

- [ ] **Step 15: Commit the Stack reducer**

```bash
git add Resources/games/kinnoki-stack.js Tests/games/kinnoki-stack.test.mjs
git commit -m "feat(games): add Kinnoki Stack engine"
```

---

### Task 4: Stack clock, lock delay, and Step Mode

**Files:**
- Modify: `Resources/games/kinnoki-stack.js`
- Create: `Tests/games/kinnoki-stack-loop.test.mjs`

**Interfaces:**
- Consumes: the Task 3 Stack reducer/state.
- Produces: `advanceStackTime(state, deltaMs) -> { state, events }` and completed semantics for `start`, `pause`, `resume`, `set-step-mode`, and `advance-step`; no `tick` reducer action exists.

- [ ] **Step 1: Write failing automatic grounding and capped-delta tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STACK_CONFIG, STACK_MAX_FRAME_DELTA_MS, advanceStackTime,
  createStackDefinition, createStackState, reduceStack,
} from '../../Resources/games/kinnoki-stack.js';

const stackState = (difficulty, seed) => (
  createStackState(createStackDefinition({ difficulty, seed }))
);

const advanceBy = (state, totalMs) => {
  let result = { state, events: [] };
  let remaining = totalMs;
  while (remaining > 0) {
    const delta = Math.min(STACK_MAX_FRAME_DELTA_MS, remaining);
    const next = advanceStackTime(result.state, delta);
    result = { state: next.state, events: [...result.events, ...next.events] };
    remaining -= delta;
  }
  return result;
};

test('difficulty timing is strictly ordered and tide forecasts are always saved', () => {
  assert.ok(STACK_CONFIG.easy.fallMs > STACK_CONFIG.medium.fallMs);
  assert.ok(STACK_CONFIG.medium.fallMs > STACK_CONFIG.hard.fallMs);
  assert.ok(STACK_CONFIG.easy.lockDelayMs > STACK_CONFIG.medium.lockDelayMs);
  assert.ok(STACK_CONFIG.medium.lockDelayMs > STACK_CONFIG.hard.lockDelayMs);
  for (const difficulty of ['medium', 'hard']) {
    const forecast = stackState(difficulty, 17).tide;
    assert.match(forecast.direction, /^(left|right)$/);
    assert.ok(Number.isSafeInteger(forecast.placementsRemaining));
    assert.ok(forecast.placementsRemaining > 0);
  }
});

test('first blocked gravity grounds and expiry locks exactly once', () => {
  let state = stackState('easy', 4);
  state = {
    ...state,
    status: 'active',
    active: {
      ...state.active, typeId: 'crate-pair', rotation: 0,
      row: 17, column: 4, bounds: { width: 2, height: 1 },
    },
  };
  let result = advanceBy(state, STACK_CONFIG.easy.fallMs);
  assert.equal(result.state.grounded.kind, 'automatic');
  assert.equal(result.state.placements, 0);
  result = advanceBy(result.state, STACK_CONFIG.easy.lockDelayMs);
  assert.equal(result.state.placements, 1);
  const duplicate = advanceStackTime(result.state, 5000);
  assert.equal(duplicate.state.placements, 1);
});

test('one frame cannot process an unbounded sleep backlog', () => {
  const state = { ...stackState('hard', 8), status: 'active' };
  const result = advanceStackTime(state, 60000);
  assert.ok(result.state.gravityAccumulatorMs <= STACK_CONFIG.hard.fallMs);
  assert.ok(result.events.filter((event) => event.type === 'moved').length <= 1);
  assert.ok(result.state.active.row - state.active.row <= 1);
});
```

- [ ] **Step 2: Write failing Step Mode and conditional-ground-reset tests**

```js
const atFloor = (difficulty = 'easy') => {
  const state = stackState(difficulty, 66);
  return {
    ...state, status: 'active',
    active: {
      pieceId: 90, typeId: 'crate-pair', rotation: 0,
      row: 17, column: 4, bounds: { width: 2, height: 1 },
    },
  };
};

test('Step Mode marks assistance once and requires two blocked Advances', () => {
  let result = reduceStack(atFloor(), { type: 'set-step-mode', enabled: true });
  assert.equal(result.state.assisted, true);
  assert.equal(result.events.filter((event) => event.type === 'assisted').length, 1);
  const frozen = advanceStackTime(result.state, 60000);
  assert.equal(frozen.state, result.state);
  result = reduceStack(result.state, { type: 'advance-step' });
  assert.deepEqual(result.state.grounded, { kind: 'step', blockedOnce: true });
  assert.equal(result.state.placements, 0);
  result = reduceStack(result.state, { type: 'advance-step' });
  assert.equal(result.state.placements, 1);
  assert.equal(result.events.filter((event) => event.type === 'placed').length, 1);
});

test('grounding clears only when a transformation opens descent', () => {
  const board = atFloor().board.map((row) => [...row]);
  board[17][5] = { pieceId: 20, typeId: 'crate-pair' };
  const grounded = {
    ...atFloor(), board,
    active: {
      pieceId: 90, typeId: 'crate-pair', rotation: 0,
      row: 16, column: 4, bounds: { width: 2, height: 1 },
    },
    grounded: { kind: 'automatic', remainingMs: 321 },
  };
  const stillBlocked = reduceStack(grounded, { type: 'move', deltaColumn: 1 }).state;
  assert.deepEqual(stillBlocked.grounded, { kind: 'automatic', remainingMs: 321 });
  const opened = reduceStack(grounded, { type: 'move', deltaColumn: -1 }).state;
  assert.equal(opened.grounded, null);
});

test('Step toggle converts grounded models without erasing blocked progress', () => {
  const automatic = {
    ...atFloor(), grounded: { kind: 'automatic', remainingMs: 321 },
  };
  const enabled = reduceStack(automatic, { type: 'set-step-mode', enabled: true }).state;
  assert.deepEqual(enabled.grounded, { kind: 'step', blockedOnce: true });
  const disabled = reduceStack(enabled, { type: 'set-step-mode', enabled: false }).state;
  assert.deepEqual(disabled.grounded, {
    kind: 'automatic', remainingMs: STACK_CONFIG.easy.lockDelayMs,
  });
  assert.equal(disabled.gravityAccumulatorMs, 0);
  assert.equal(disabled.assisted, true);
});

test('pause freezes gravity and Hard Drop bypasses either grounded model', () => {
  let result = reduceStack(atFloor(), { type: 'pause', reason: 'user' });
  assert.deepEqual(result.events, [{ type: 'paused', reason: 'user' }]);
  assert.equal(advanceStackTime(result.state, 9000).state, result.state);
  result = reduceStack(result.state, { type: 'resume' });
  assert.equal(result.state.status, 'active');
  result = reduceStack({
    ...result.state, stepMode: true,
    grounded: { kind: 'step', blockedOnce: true },
  }, { type: 'hard-drop' });
  assert.equal(result.state.placements, 1);
});
```

- [ ] **Step 3: Run the loop tests and verify missing timing semantics**

Run: `node --test Tests/games/kinnoki-stack-loop.test.mjs Tests/games/kinnoki-stack.test.mjs`
Expected: FAIL on absent `advanceStackTime` and Step/grounded transitions.

- [ ] **Step 4: Implement the single capped automatic-clock entry point**

Append `advanceStackTime`. It processes at most one gravity move or one lock, and a newly blocked gravity step starts—but does not consume—the lock delay:

```js
export function advanceStackTime(state, deltaMs) {
  if (state.status !== 'active' || state.stepMode) {
    return { state, events: [] };
  }
  const delta = Number.isFinite(deltaMs)
    ? Math.max(0, Math.min(STACK_MAX_FRAME_DELTA_MS, deltaMs))
    : 0;
  if (delta === 0) return { state, events: [] };

  if (state.grounded?.kind === 'automatic') {
    const remainingMs = Math.max(0, state.grounded.remainingMs - delta);
    if (remainingMs > 0) {
      return {
        state: {
          ...state,
          grounded: { kind: 'automatic', remainingMs },
        },
        events: [],
      };
    }
    return lockActive({ ...state, grounded: null, gravityAccumulatorMs: 0 });
  }

  const fallMs = STACK_CONFIG[state.difficulty].fallMs;
  const accumulated = state.gravityAccumulatorMs + delta;
  if (accumulated < fallMs) {
    return {
      state: { ...state, gravityAccumulatorMs: accumulated },
      events: [],
    };
  }

  const active = { ...state.active, row: state.active.row + 1 };
  if (canUseActive(state, active)) {
    return {
      state: {
        ...state,
        active,
        grounded: null,
        gravityAccumulatorMs: accumulated - fallMs,
      },
      events: [{
        type: 'moved',
        source: 'gravity',
        row: active.row,
        column: active.column,
      }],
    };
  }
  return {
    state: {
      ...state,
      grounded: {
        kind: 'automatic',
        remainingMs: STACK_CONFIG[state.difficulty].lockDelayMs,
      },
      gravityAccumulatorMs: 0,
    },
    events: [],
  };
}
```

- [ ] **Step 5: Add exact start, pause, and resume transitions**

Insert this lifecycle dispatcher before `reduceStack`. Returning `null` means the action is not a lifecycle action:

```js
function reduceStackLifecycle(state, action) {
  if (action.type === 'start') {
    if (state.status === 'active') return { state, events: [] };
    return state.status === 'preview'
      ? {
        state: { ...state, status: 'active' },
        events: [{ type: 'started' }],
      }
      : invalid(state, 'start', 'The run cannot start from this state.');
  }
  if (action.type === 'pause') {
    if (state.status === 'paused') return { state, events: [] };
    if (state.status !== 'active'
        || !['user', 'hidden'].includes(action.reason)) {
      return invalid(state, 'pause', 'The run cannot pause from this state.');
    }
    return {
      state: { ...state, status: 'paused' },
      events: [{ type: 'paused', reason: action.reason }],
    };
  }
  if (action.type === 'resume') {
    if (state.status === 'active') return { state, events: [] };
    return state.status === 'paused'
      ? {
        state: {
          ...state,
          status: 'active',
          gravityAccumulatorMs: 0,
        },
        events: [{ type: 'resumed' }],
      }
      : invalid(state, 'resume', 'The run cannot resume from this state.');
  }
  return null;
}
```

- [ ] **Step 6: Implement Step Mode assistance and two-block locking**

Insert the mode and explicit-advance helpers before `reduceActiveStack`:

```js
function setStackStepMode(state, enabled) {
  if (typeof enabled !== 'boolean') {
    return invalid(state, 'set-step-mode', 'Step Mode requires a boolean value.');
  }
  if (state.stepMode === enabled) return { state, events: [] };

  let grounded = state.grounded;
  if (enabled && grounded?.kind === 'automatic') {
    grounded = { kind: 'step', blockedOnce: true };
  } else if (!enabled && grounded?.kind === 'step') {
    grounded = {
      kind: 'automatic',
      remainingMs: STACK_CONFIG[state.difficulty].lockDelayMs,
    };
  }
  const newlyAssisted = enabled && !state.assisted;
  return {
    state: {
      ...state,
      assisted: state.assisted || enabled,
      stepMode: enabled,
      grounded,
      gravityAccumulatorMs: enabled ? state.gravityAccumulatorMs : 0,
    },
    events: newlyAssisted
      ? [{ type: 'assisted', reason: 'step-mode' }]
      : [],
  };
}

function advanceStackStep(state) {
  if (!state.stepMode) {
    return invalid(state, 'advance-step', 'Enable Step Mode first.');
  }
  const active = { ...state.active, row: state.active.row + 1 };
  if (canUseActive(state, active)) {
    return {
      state: { ...state, active, grounded: null },
      events: [{
        type: 'moved',
        source: 'step',
        row: active.row,
        column: active.column,
      }],
    };
  }
  if (state.grounded?.kind === 'step' && state.grounded.blockedOnce) {
    return lockActive({ ...state, grounded: null, gravityAccumulatorMs: 0 });
  }
  return {
    state: {
      ...state,
      grounded: { kind: 'step', blockedOnce: true },
    },
    events: [],
  };
}

const groundedAfterTransformation = (state, active) => (
  canDescend({ ...state, active }) ? null : state.grounded
);
```

- [ ] **Step 7: Integrate grounded transformations and lifecycle actions**

Replace `rotateActive`, `reduceActiveStack`, and `reduceStack` with these complete versions. Only a move or rotation that opens descent clears the existing grounded object:

```js
function rotateActive(state) {
  const rotations = rotationsFor(state.active.typeId);
  const current = rotations.findIndex(
    ({ rotation }) => rotation === state.active.rotation,
  );
  const nextRotation = rotations[(current + 1) % rotations.length];
  const active = {
    ...state.active,
    rotation: nextRotation.rotation,
    bounds: boundsFor(nextRotation.cells),
  };
  if (!canPlace(state.board, nextRotation.cells, active)) {
    return invalid(state, 'rotate', 'Cargo cannot rotate here.');
  }
  return {
    state: {
      ...state,
      active,
      grounded: groundedAfterTransformation(state, active),
    },
    events: [{
      type: 'rotated',
      pieceId: active.pieceId,
      rotation: active.rotation,
    }],
  };
}

function reduceActiveStack(state, action) {
  if (action.type === 'move') {
    if (![-1, 1].includes(action.deltaColumn)) {
      return invalid(state, 'move', 'Move must be one column.');
    }
    const active = {
      ...state.active,
      column: state.active.column + action.deltaColumn,
    };
    if (!canUseActive(state, active)) {
      return invalid(state, 'move', 'Cargo cannot move there.');
    }
    return {
      state: {
        ...state,
        active,
        grounded: groundedAfterTransformation(state, active),
      },
      events: [{
        type: 'moved',
        source: 'player',
        row: active.row,
        column: active.column,
      }],
    };
  }
  if (action.type === 'rotate') {
    return action.quarterTurns === 1
      ? rotateActive(state)
      : invalid(state, 'rotate', 'Rotation must be one quarter turn.');
  }
  if (action.type === 'soft-drop') {
    const active = { ...state.active, row: state.active.row + 1 };
    return canUseActive(state, active)
      ? movedState({ ...state, grounded: null }, active, 'player')
      : invalid(state, 'soft-drop', 'Cargo cannot descend.');
  }
  if (action.type === 'hard-drop') {
    let active = state.active;
    while (canUseActive(state, { ...active, row: active.row + 1 })) {
      active = { ...active, row: active.row + 1 };
    }
    return lockActive({
      ...state,
      active,
      grounded: null,
      gravityAccumulatorMs: 0,
    });
  }
  return invalid(state, String(action.type), 'Action is not available.');
}

export function reduceStack(state, action = {}) {
  if (['terminal', 'error', 'disposed'].includes(state.status)) {
    return { state, events: [] };
  }
  const lifecycle = reduceStackLifecycle(state, action);
  if (lifecycle !== null) return lifecycle;

  if (action.type === 'set-step-mode') {
    return ['active', 'paused'].includes(state.status)
      ? setStackStepMode(state, action.enabled)
      : invalid(state, action.type, 'Start the run before changing Step Mode.');
  }
  if (state.status !== 'active') {
    return invalid(state, String(action.type), 'Start or resume the run first.');
  }
  if (action.type === 'advance-step') return advanceStackStep(state);
  return reduceActiveStack(state, action);
}
```

- [ ] **Step 8: Run both Stack suites**

Run: `node --test Tests/games/kinnoki-stack-loop.test.mjs Tests/games/kinnoki-stack.test.mjs`
Expected: PASS with Easy fall/lock values greater than Medium, Medium greater than Hard, always-visible Medium/Hard tide forecasts, and all automatic/Step transitions.

- [ ] **Step 9: Commit Stack timing**

```bash
git add Resources/games/kinnoki-stack.js Tests/games/kinnoki-stack-loop.test.mjs
git commit -m "feat(games): add Stack timing and Step Mode"
```

---

### Task 5A: Contract definition model and bounded exact-cover solver

**Files:**
- Create: `Resources/games/kinnoki-yard.js`
- Create: `Tests/games/kinnoki-yard-solver.test.mjs`

**Interfaces:**
- Consumes: cargo catalogue rotations and placement helpers.
- Produces: the exact `ContractDefinition`, placement, and solver-result contracts from Shared Data and Interface Contracts plus `solveContract(definition, placements, options)`.

- [ ] **Step 1: Write failing solved, fixed-placement, dead-end, and limit tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { solveContract } from '../../Resources/games/kinnoki-yard.js';

const pairContract = Object.freeze({
  version: 1, game: 'kinnoki-yard', mode: 'contracts', difficulty: 'easy', seed: 700,
  width: 4, height: 3,
  target: [0, 1, 2].flatMap((row) => (
    [0, 1, 2, 3].map((column) => ({ row, column }))
  )),
  pieces: [0, 1, 2, 3, 4, 5].map((pieceId) => ({
    pieceId, typeId: 'crate-pair', allowedRotations: [0],
    initialRotation: 0, trayIndex: pieceId,
  })),
  witness: [0, 1, 2, 3, 4, 5].map((pieceId) => ({
    pieceId, rotation: 0,
    row: Math.floor(pieceId / 2), column: (pieceId % 2) * 2,
  })),
  generation: {
    usedFallback: false, attempt: 0, sourceId: null,
    transformId: 'identity', operations: 0,
  },
});

test('solver returns a deterministic exact cover', () => {
  const first = solveContract(pairContract, {});
  const second = solveContract(pairContract, {});
  assert.equal(first.status, 'solved');
  assert.deepEqual(first, second);
  assert.equal(first.placements.length, 6);
});

test('existing placements are fixed constraints', () => {
  const fixed = {
    0: { pieceId: 0, typeId: 'crate-pair', rotation: 0, row: 0, column: 0 },
  };
  const result = solveContract(pairContract, fixed);
  assert.equal(result.status, 'solved');
  assert.deepEqual(result.placements.find((value) => value.pieceId === 0), fixed[0]);
});

test('placement-map keys must equal their embedded numeric piece identity', () => {
  const mismatched = {
    99: { pieceId: 0, typeId: 'crate-pair', rotation: 0, row: 0, column: 0 },
  };
  assert.deepEqual(solveContract(pairContract, mismatched), {
    status: 'dead-end', placements: [], operations: 0,
  });
});

test('legal but unfinishable placement is a proved dead end', () => {
  const deadEnd = {
    0: { pieceId: 0, typeId: 'crate-pair', rotation: 0, row: 0, column: 1 },
  };
  assert.equal(solveContract(pairContract, deadEnd).status, 'dead-end');
});

test('explicit operation bound returns limit instead of blocking', () => {
  const result = solveContract(pairContract, {}, { operationLimit: 0 });
  assert.deepEqual(result, { status: 'limit', placements: [], operations: 1 });
});
```

- [ ] **Step 2: Run the solver test and verify the module is absent**

Run: `node --test Tests/games/kinnoki-yard-solver.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Add the solver geometry imports and deterministic helpers**

Use these complete search functions; `placementCells` and `canPlaceOnTarget` remain private to the pure module:

```js
import {
  CARGO_CATALOG, boundsFor, canPlace, dispatchCompletedManifests, normalizeCells,
  placePiece, placedCells, removePiece, rotationsFor, selectNextManifestZones,
  validateBoard, validateManifest,
} from './cargo-geometry.js';
import {
  createRng, deriveSeed, indexedSeed, saturatingAdd,
} from './core.js';

const keyFor = ({ row, column }) => `${row}:${column}`;
const sortedPlacements = (placements) => [...placements]
  .sort((left, right) => left.pieceId - right.pieceId);

const placementCells = (piece, placement) => placedCells(
  rotationsFor(piece.typeId, piece.allowedRotations)
    .find((value) => value.rotation === placement.rotation).cells,
  { row: placement.row, column: placement.column },
);

const enumerateContractPlacements = (definition, piece, occupied, targetKeys) => {
  const candidates = [];
  for (const rotated of rotationsFor(piece.typeId, piece.allowedRotations)) {
    const bounds = boundsFor(rotated.cells);
    for (let row = 0; row <= definition.height - bounds.height; row += 1) {
      for (let column = 0; column <= definition.width - bounds.width; column += 1) {
        const cells = placedCells(rotated.cells, { row, column });
        if (cells.every((cell) => targetKeys.has(keyFor(cell))
            && !occupied.has(keyFor(cell)))) {
          candidates.push({
            placement: {
              pieceId: piece.pieceId, typeId: piece.typeId,
              rotation: rotated.rotation, row, column,
            },
            cells,
          });
        }
      }
    }
  }
  return candidates;
};
```

- [ ] **Step 4: Implement the bounded MRV solver**

Append the public solver immediately after the helpers from Step 3:

```js

export function solveContract(definition, placements = {}, {
  operationLimit = Number.MAX_SAFE_INTEGER,
} = {}) {
  const targetKeys = new Set(definition.target.map(keyFor));
  const pieceById = new Map(definition.pieces.map((piece) => [piece.pieceId, piece]));
  const occupied = new Set();
  const fixed = [];
  const fixedEntries = Object.entries(placements).sort(
    (left, right) => left[1].pieceId - right[1].pieceId,
  );
  for (const [placementKey, placement] of fixedEntries) {
    const piece = pieceById.get(placement.pieceId);
    if (placementKey !== String(placement.pieceId)
        || !piece || piece.typeId !== placement.typeId
        || !piece.allowedRotations.includes(placement.rotation)) {
      return { status: 'dead-end', placements: [], operations: 0 };
    }
    const cells = placementCells(piece, placement);
    if (cells.some((cell) => !targetKeys.has(keyFor(cell)) || occupied.has(keyFor(cell)))) {
      return { status: 'dead-end', placements: [], operations: 0 };
    }
    for (const cell of cells) occupied.add(keyFor(cell));
    fixed.push(placement);
  }

  const remaining = definition.pieces.filter((piece) => !Object.hasOwn(
    placements, String(piece.pieceId),
  ));
  let operations = 0;
  let limited = false;

  const search = (pending, current, used) => {
    if (pending.length === 0) return used.size === targetKeys.size ? current : null;
    operations += 1;
    if (operations > operationLimit) {
      limited = true;
      return null;
    }
    const ranked = pending.map((piece) => ({
      piece,
      candidates: enumerateContractPlacements(definition, piece, used, targetKeys),
    })).sort((left, right) => (
      left.candidates.length - right.candidates.length
      || left.piece.pieceId - right.piece.pieceId
    ));
    const chosen = ranked[0];
    if (chosen.candidates.length === 0) return null;
    const nextPending = pending.filter((piece) => piece.pieceId !== chosen.piece.pieceId);
    for (const candidate of chosen.candidates) {
      const nextUsed = new Set(used);
      for (const cell of candidate.cells) nextUsed.add(keyFor(cell));
      const solved = search(nextPending, [...current, candidate.placement], nextUsed);
      if (solved) return solved;
      if (limited) return null;
    }
    return null;
  };

  const solved = search(remaining, [...fixed], occupied);
  if (solved) return {
    status: 'solved', placements: sortedPlacements(solved), operations,
  };
  return {
    status: limited ? 'limit' : 'dead-end', placements: [], operations,
  };
}
```

- [ ] **Step 5: Run the solver gate**

Run: `node --test Tests/games/kinnoki-yard-solver.test.mjs Tests/games/cargo-geometry.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit the solver gate**

```bash
git add Resources/games/kinnoki-yard.js Tests/games/kinnoki-yard-solver.test.mjs
git commit -m "feat(games): add bounded Yard contract solver"
```

---

### Task 5B: Bounded Yard Contract generator and fallback catalogue

**Files:**
- Modify: `Resources/games/kinnoki-yard.js`
- Create: `Tests/games/kinnoki-yard-generator.test.mjs`

**Interfaces:**
- Consumes: Task 5A solver, `createRng`, `deriveSeed`, `indexedSeed`, and cargo geometry.
- Produces: `CONTRACT_RULES`, `CONTRACT_FALLBACK_PACKINGS`, `CONTRACT_TRANSFORM_IDS`, `measureContractTarget(cells)`, `definitionFromFallback(source, difficulty, transformId, seed = 0)`, `selectContractFallback({ difficulty, seed, previousSignature })`, `generateContract({ difficulty, seed, previousSignature = null, operationLimit, forceFallback = false })`, `solveContract(definition, placements, { operationLimit = Number.MAX_SAFE_INTEGER } = {})`, `validateContractDefinition(definition)`, and `contractSignature(definition)`. `forceFallback` and direct fallback builders are deterministic test seams; production controllers call only `generateContract`.

- [ ] **Step 1: Write failing many-seed solvability and difficulty tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRACT_RULES, contractSignature, generateContract, measureContractTarget,
  solveContract, validateContractDefinition,
} from '../../Resources/games/kinnoki-yard.js';

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(difficulty + ' contracts are deterministic and solver-proven across seeds', () => {
    const signatures = new Set();
    for (let seed = 0; seed < 30; seed += 1) {
      const first = generateContract({ difficulty, seed });
      const second = generateContract({ difficulty, seed });
      assert.deepEqual(first, second);
      assert.deepEqual(validateContractDefinition(first), { valid: true, errors: [] });
      assert.equal(solveContract(first, {}).status, 'solved');
      assert.ok(first.pieces.length >= CONTRACT_RULES[difficulty].minPieces);
      assert.ok(first.pieces.length <= CONTRACT_RULES[difficulty].maxPieces);
      const metrics = measureContractTarget(first.target);
      const rules = CONTRACT_RULES[difficulty];
      assert.ok(metrics.area >= rules.minimumTargetArea);
      assert.ok(metrics.area <= rules.maximumTargetArea);
      assert.ok(metrics.shortSide >= rules.minimumShortSide);
      assert.ok(metrics.longSide <= rules.maximumLongSide);
      assert.ok(metrics.fillRatio >= rules.minimumFillRatio);
      assert.ok(metrics.fillRatio <= rules.maximumFillRatio);
      assert.ok(metrics.concaveCorners >= rules.minimumConcaveCorners);
      assert.ok(metrics.concaveCorners <= rules.maximumConcaveCorners);
      assert.ok(metrics.narrowBayCells >= rules.minimumNarrowBayCells);
      assert.ok(metrics.narrowBayCells <= rules.maximumNarrowBayCells);
      signatures.add(contractSignature(first));
    }
    assert.ok(signatures.size >= 20);
  });
}

test('previous signature is rejected deterministically', () => {
  const first = generateContract({ difficulty: 'medium', seed: 42 });
  const next = generateContract({
    difficulty: 'medium', seed: 42, previousSignature: contractSignature(first),
  });
  assert.notEqual(contractSignature(next), contractSignature(first));
});

test('definition validator rejects target, witness, orientation, and difficulty forgery', () => {
  const definition = generateContract({ difficulty: 'medium', seed: 61 });
  assert.deepEqual(validateContractDefinition(definition), { valid: true, errors: [] });
  assert.equal(validateContractDefinition({
    ...definition, target: definition.target.slice(1),
  }).valid, false);
  assert.equal(validateContractDefinition({
    ...definition,
    witness: [{ ...definition.witness[0], rotation: 99 }, ...definition.witness.slice(1)],
  }).valid, false);
  assert.equal(validateContractDefinition({
    ...definition,
    pieces: [{ ...definition.pieces[0], pieceId: 'bad' }, ...definition.pieces.slice(1)],
  }).valid, false);
  assert.equal(validateContractDefinition({ ...definition, difficulty: 'hard' }).valid, false);
});
```

- [ ] **Step 2: Write failing fallback diversity, transform, and operation-bound tests**

```js
import {
  CONTRACT_FALLBACK_PACKINGS, CONTRACT_TRANSFORM_IDS,
  definitionFromFallback, selectContractFallback,
} from '../../Resources/games/kinnoki-yard.js';

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(difficulty + ' has 32 distinct validated fallback transforms', () => {
    assert.equal(CONTRACT_FALLBACK_PACKINGS[difficulty].length, 4);
    const definitions = CONTRACT_FALLBACK_PACKINGS[difficulty].flatMap((source) => (
      CONTRACT_TRANSFORM_IDS.map((transformId) => (
        definitionFromFallback(source, difficulty, transformId)
      ))
    ));
    assert.equal(definitions.length, 32);
    assert.equal(new Set(definitions.map(contractSignature)).size, 32);
    for (const definition of definitions) {
      assert.equal(definition.generation.usedFallback, true);
      assert.equal(solveContract(definition, {}).status, 'solved');
      assert.equal(validateContractDefinition(definition).valid, true);
    }
  });

  test(difficulty + ' fallback selector skips every immediate signature collision', () => {
    const starts = new Set();
    for (let seed = 0; seed < 256; seed += 1) {
      const first = selectContractFallback({ difficulty, seed, previousSignature: null });
      assert.equal(first.seed, seed >>> 0);
      starts.add(contractSignature(first));
      const next = selectContractFallback({
        difficulty, seed, previousSignature: contractSignature(first),
      });
      assert.notEqual(contractSignature(next), contractSignature(first));
    }
    assert.equal(starts.size, 32);
  });
}

test('bounded generation reaches fallback instead of searching without limit', () => {
  const definition = generateContract({
    difficulty: 'hard', seed: 91, operationLimit: 0,
  });
  assert.equal(definition.generation.usedFallback, true);
  assert.equal(definition.seed, 91);
  assert.equal(solveContract(definition, {}).status, 'solved');
});
```

- [ ] **Step 3: Run the generator suite and verify the module is absent**

Run: `node --test Tests/games/kinnoki-yard-generator.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4: Define exact Contract rules and fallback sources**

```js
export const CONTRACT_RULES = Object.freeze({
  easy: Object.freeze({
    minPieces: 4, maxPieces: 6, generationAttempts: 16,
    solverOperations: 50000, restrictOrientations: false,
    minimumTargetArea: 12, maximumTargetArea: 24,
    minimumShortSide: 3, maximumLongSide: 8,
    minimumFillRatio: 0.68, maximumFillRatio: 1,
    minimumConcaveCorners: 0, maximumConcaveCorners: 2,
    minimumNarrowBayCells: 0, maximumNarrowBayCells: 0,
  }),
  medium: Object.freeze({
    minPieces: 7, maxPieces: 10, generationAttempts: 20,
    solverOperations: 150000, restrictOrientations: true,
    minimumTargetArea: 24, maximumTargetArea: 46,
    minimumShortSide: 5, maximumLongSide: 11,
    minimumFillRatio: 0.50, maximumFillRatio: 0.82,
    minimumConcaveCorners: 2, maximumConcaveCorners: 12,
    minimumNarrowBayCells: 1, maximumNarrowBayCells: 4,
  }),
  hard: Object.freeze({
    minPieces: 10, maxPieces: 14, generationAttempts: 24,
    solverOperations: 400000, restrictOrientations: true,
    minimumTargetArea: 40, maximumTargetArea: 70,
    minimumShortSide: 7, maximumLongSide: 12,
    minimumFillRatio: 0.40, maximumFillRatio: 0.68,
    minimumConcaveCorners: 4, maximumConcaveCorners: Number.MAX_SAFE_INTEGER,
    minimumNarrowBayCells: 2, maximumNarrowBayCells: Number.MAX_SAFE_INTEGER,
  }),
});

const P = (typeId, rotation, row, column, allowedRotations,
  initialRotation = allowedRotations[0]) => Object.freeze({
  typeId, initialRotation, allowedRotations: Object.freeze(allowedRotations),
  witness: Object.freeze({ rotation, row, column }),
});
const F = (id, pieces) => Object.freeze({ id, pieces: Object.freeze(pieces) });

export const CONTRACT_FALLBACK_PACKINGS = Object.freeze({
  easy: Object.freeze([
    F('easy-east-berth', [
      P('dock-square', 0, 1, 3, [0]),
      P('dock-square', 0, 1, 1, [0]),
      P('barge-three', 0, 0, 3, [0, 1]),
      P('crate-pair', 1, 1, 0, [0, 1]),
    ]),
    F('easy-crane-court', [
      P('corner-three', 3, 2, 2, [0, 1, 2, 3]),
      P('dock-square', 0, 3, 0, [0]),
      P('barge-three', 0, 2, 0, [0, 1]),
      P('crate-pair', 0, 4, 2, [0, 1]),
      P('crate-pair', 1, 0, 3, [0, 1]),
    ]),
    F('easy-quay-pocket', [
      P('dock-square', 0, 2, 1, [0]),
      P('barge-three', 1, 2, 3, [0, 1]),
      P('barge-three', 0, 1, 0, [0, 1]),
      P('corner-three', 2, 0, 2, [0, 1, 2, 3]),
      P('crate-pair', 0, 0, 0, [0, 1]),
    ]),
    F('easy-long-dock', [
      P('dock-square', 0, 0, 4, [0]),
      P('dock-square', 0, 0, 2, [0]),
      P('corner-three', 2, 2, 4, [0, 1, 2, 3]),
      P('barge-three', 0, 2, 1, [0, 1]),
      P('crate-pair', 0, 1, 0, [0, 1]),
      P('crate-pair', 0, 0, 0, [0, 1]),
    ]),
  ]),
  medium: Object.freeze([
    F('medium-ferry-lane', [
      P('fork-four', 0, 3, 1, [0, 1, 2, 3]),
      P('dock-square', 0, 1, 2, [0]),
      P('barge-five', 0, 0, 3, [0]),
      P('harbour-five', 1, 1, 7, [0, 1, 2, 3]),
      P('corner-three', 1, 1, 4, [1, 3]),
      P('crate-pair', 0, 2, 8, [0]),
      P('quay-five', 1, 0, 0, [0, 1, 2, 3]),
    ]),
    F('medium-harbour-turn', [
      P('anchor-five', 0, 4, 2, [0]),
      P('fork-four', 1, 2, 4, [0, 1, 2, 3]),
      P('barge-three', 0, 6, 0, [0]),
      P('harbour-five', 2, 2, 1, [0, 1, 2, 3]),
      P('dock-square', 0, 5, 5, [0]),
      P('zigzag-five', 0, 1, 5, [0, 2]),
      P('crate-pair', 0, 1, 3, [0, 1]),
      P('corner-three', 3, 0, 1, [0, 1, 2, 3]),
    ]),
    F('medium-quay-step', [
      P('quay-five', 1, 3, 5, [0, 1, 2, 3]),
      P('fork-four', 1, 2, 3, [0, 1, 2, 3]),
      P('dock-square', 0, 3, 1, [0]),
      P('barge-five', 0, 2, 5, [0]),
      P('corner-three', 3, 1, 1, [0, 1, 2, 3]),
      P('harbour-five', 2, 0, 1, [0, 2]),
      P('crate-pair', 0, 5, 1, [0, 1]),
      P('zigzag-five', 1, 0, 4, [0, 1, 2, 3]),
      P('barge-three', 1, 3, 0, [1]),
    ]),
    F('medium-yard-channel', [
      P('anchor-five', 0, 3, 3, [0]),
      P('harbour-five', 1, 3, 2, [0, 1, 2, 3]),
      P('quay-five', 1, 2, 1, [1, 3]),
      P('fork-four', 0, 3, 6, [0, 1, 2, 3]),
      P('dock-square', 0, 2, 5, [0]),
      P('corner-three', 0, 0, 2, [0, 2]),
      P('barge-three', 1, 2, 0, [0, 1]),
      P('crate-pair', 1, 1, 4, [0, 1]),
      P('zigzag-five', 3, 1, 8, [1, 3]),
      P('barge-five', 0, 0, 3, [0, 1]),
    ]),
  ]),
  hard: Object.freeze([
    F('hard-tidal-maze', [
      P('anchor-five', 0, 2, 2, [0]),
      P('harbour-five', 2, 0, 3, [2]),
      P('quay-five', 2, 0, 6, [2]),
      P('zigzag-five', 2, 1, 9, [0, 2]),
      P('fork-four', 2, 4, 9, [2]),
      P('barge-five', 0, 5, 0, [0]),
      P('dock-square', 0, 6, 1, [0]),
      P('corner-three', 3, 5, 4, [3]),
      P('crate-pair', 0, 3, 0, [0]),
      P('barge-three', 0, 2, 0, [0, 1]),
    ]),
    F('hard-breakwater', [
      P('quay-five', 3, 2, 6, [3]),
      P('harbour-five', 1, 1, 5, [1, 3]),
      P('anchor-five', 0, 4, 4, [0]),
      P('fork-four', 2, 7, 5, [2]),
      P('zigzag-five', 1, 4, 2, [1]),
      P('barge-five', 0, 9, 2, [0]),
      P('dock-square', 0, 10, 5, [0]),
      P('corner-three', 1, 3, 2, [1, 3]),
      P('crate-pair', 1, 0, 4, [1]),
      P('barge-three', 1, 0, 2, [1]),
      P('harbour-five', 3, 3, 0, [1, 3]),
    ]),
    F('hard-narrow-channel', [
      P('anchor-five', 0, 8, 8, [0]),
      P('quay-five', 3, 7, 5, [3]),
      P('zigzag-five', 2, 6, 3, [0, 2]),
      P('harbour-five', 2, 4, 4, [2]),
      P('fork-four', 2, 2, 4, [2]),
      P('barge-five', 0, 8, 0, [0]),
      P('dock-square', 0, 9, 0, [0]),
      P('corner-three', 0, 9, 2, [0]),
      P('crate-pair', 0, 4, 7, [0, 1]),
      P('barge-three', 0, 1, 4, [0]),
      P('fork-four', 3, 4, 8, [1, 3]),
      P('quay-five', 2, 0, 5, [2]),
    ]),
    F('hard-inner-harbour', [
      P('harbour-five', 3, 5, 4, [3]),
      P('anchor-five', 0, 6, 6, [0]),
      P('quay-five', 0, 3, 7, [0]),
      P('zigzag-five', 0, 6, 2, [0, 2]),
      P('fork-four', 0, 3, 3, [0]),
      P('barge-five', 0, 9, 1, [0]),
      P('dock-square', 0, 7, 9, [0]),
      P('corner-three', 0, 5, 3, [0]),
      P('crate-pair', 1, 5, 1, [1]),
      P('barge-three', 1, 2, 9, [1]),
      P('harbour-five', 2, 10, 3, [0, 2]),
      P('fork-four', 1, 1, 3, [1]),
      P('anchor-five', 0, 0, 0, [0]),
      P('quay-five', 3, 4, 8, [3]),
    ]),
  ]),
});

export const CONTRACT_TRANSFORM_IDS = Object.freeze([
  'identity', 'rotate90', 'rotate180', 'rotate270',
  'reflect', 'reflect90', 'reflect180', 'reflect270',
]);
```

These twelve source witnesses are data, not seeds and not calls back into procedural construction. Chiral `hook-four` and `step-four` are intentionally absent because a reflected instance is not rotation-equivalent in the catalogue.

- [ ] **Step 5: Implement target measurement and exact transforms**

Append these helpers so procedural and fallback contracts use the same acceptance criteria:

```js
const ORTHOGONAL = Object.freeze([[-1, 0], [1, 0], [0, -1], [0, 1]]);
const targetKey = (row, column) => `${row}:${column}`;

export function measureContractTarget(cells) {
  const target = normalizeCells(cells);
  const { width, height } = boundsFor(target);
  const keys = new Set(target.map(({ row, column }) => targetKey(row, column)));
  let concaveCorners = 0;
  for (let row = -1; row < height; row += 1) {
    for (let column = -1; column < width; column += 1) {
      const occupied = [
        [row, column], [row, column + 1],
        [row + 1, column], [row + 1, column + 1],
      ].filter(([r, c]) => keys.has(targetKey(r, c))).length;
      if (occupied === 3) concaveCorners += 1;
    }
  }

  const exterior = new Set([targetKey(-1, -1)]);
  const queue = [[-1, -1]];
  for (let index = 0; index < queue.length; index += 1) {
    const [row, column] = queue[index];
    for (const [rowDelta, columnDelta] of ORTHOGONAL) {
      const nextRow = row + rowDelta;
      const nextColumn = column + columnDelta;
      const key = targetKey(nextRow, nextColumn);
      if (nextRow < -1 || nextRow > height || nextColumn < -1 || nextColumn > width
          || keys.has(key) || exterior.has(key)) continue;
      exterior.add(key);
      queue.push([nextRow, nextColumn]);
    }
  }

  let narrowBayCells = 0;
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const key = targetKey(row, column);
      if (keys.has(key) || !exterior.has(key)) continue;
      const neighbours = ORTHOGONAL.filter(([rowDelta, columnDelta]) => (
        keys.has(targetKey(row + rowDelta, column + columnDelta))
      )).length;
      if (neighbours >= 3) narrowBayCells += 1;
    }
  }

  const area = target.length;
  return Object.freeze({
    area, width, height,
    shortSide: Math.min(width, height),
    longSide: Math.max(width, height),
    boundingArea: width * height,
    fillRatio: area / (width * height),
    concaveCorners, narrowBayCells,
  });
}

export function transformContractPoint({ row, column }, transformId) {
  switch (transformId) {
    case 'identity': return { row, column };
    case 'rotate90': return { row: column, column: -row };
    case 'rotate180': return { row: -row, column: -column };
    case 'rotate270': return { row: -column, column: row };
    case 'reflect': return { row, column: -column };
    case 'reflect90': return { row: -column, column: -row };
    case 'reflect180': return { row: -row, column };
    case 'reflect270': return { row: column, column: row };
    default: throw new TypeError(`Unknown Contract transform: ${transformId}`);
  }
}
```

A concave corner is a 2-by-2 window, including edge-touching windows, with exactly three target cells. A narrow-bay cell is an exterior-reachable empty cell inside the target bounds with at least three occupied orthogonal neighbours; enclosed voids do not count.

- [ ] **Step 6: Build transformed fallbacks and stable signatures**

Append these helpers. They transform every global witness cell, normalize the combined target once, and then recover canonical rotations by matching normalized local cells:

```js
const rowMajorCell = (left, right) => left.row - right.row
  || left.column - right.column;
const cellsSignature = (cells) => JSON.stringify(normalizeCells(cells));
const cargoTypeIds = new Set(CARGO_CATALOG.map(({ id }) => id));

const canonicalRotation = (typeId, rotation) => {
  const match = rotationsFor(typeId)
    .find((candidate) => candidate.rotation === rotation);
  if (!match) throw new TypeError(`Invalid ${typeId} rotation: ${rotation}`);
  return match;
};

const transformedRotation = (typeId, rotation, transformId) => {
  const transformed = normalizeCells(canonicalRotation(typeId, rotation).cells
    .map((cell) => transformContractPoint(cell, transformId)));
  const signature = cellsSignature(transformed);
  const match = rotationsFor(typeId)
    .find((candidate) => cellsSignature(candidate.cells) === signature);
  if (!match) throw new TypeError(`Transform is not canonical for ${typeId}`);
  return match.rotation;
};

const freezeContractDefinition = (definition) => Object.freeze({
  ...definition,
  target: Object.freeze(definition.target.map((cell) => Object.freeze({ ...cell }))),
  pieces: Object.freeze(definition.pieces.map((piece) => Object.freeze({
    ...piece,
    allowedRotations: Object.freeze([...piece.allowedRotations]),
  }))),
  witness: Object.freeze(definition.witness.map((placement) => (
    Object.freeze({ ...placement })
  ))),
  generation: Object.freeze({ ...definition.generation }),
});

export function contractSignature(definition) {
  return JSON.stringify([
    definition.version,
    definition.mode,
    definition.difficulty,
    [...definition.target].sort(rowMajorCell)
      .map(({ row, column }) => [row, column]),
    [...definition.pieces].sort((left, right) => left.pieceId - right.pieceId)
      .map((piece) => [
        piece.pieceId,
        piece.typeId,
        [...piece.allowedRotations],
        piece.initialRotation,
        piece.trayIndex,
      ]),
  ]);
}

export function definitionFromFallback(
  source,
  difficulty,
  transformId,
  seed = 0,
) {
  if (!CONTRACT_FALLBACK_PACKINGS[difficulty]?.includes(source)
      || !CONTRACT_TRANSFORM_IDS.includes(transformId)) {
    throw new TypeError('Invalid Contract fallback request');
  }
  const transformed = source.pieces.map((entry, pieceId) => {
    const rotation = canonicalRotation(entry.typeId, entry.witness.rotation);
    const globalCells = placedCells(rotation.cells, entry.witness)
      .map((cell) => transformContractPoint(cell, transformId));
    return { entry, pieceId, globalCells };
  });
  const combined = transformed.flatMap(({ globalCells }) => globalCells);
  const minimumRow = Math.min(...combined.map(({ row }) => row));
  const minimumColumn = Math.min(...combined.map(({ column }) => column));
  const shifted = transformed.map((value) => ({
    ...value,
    cells: value.globalCells.map(({ row, column }) => ({
      row: row - minimumRow,
      column: column - minimumColumn,
    })).sort(rowMajorCell),
  }));
  const target = normalizeCells(shifted.flatMap(({ cells }) => cells));
  const { width, height } = boundsFor(target);
  const pieces = shifted.map(({ entry, pieceId }) => ({
    pieceId,
    typeId: entry.typeId,
    allowedRotations: [...new Set(entry.allowedRotations.map((rotation) => (
      transformedRotation(entry.typeId, rotation, transformId)
    )))].sort((left, right) => left - right),
    initialRotation: transformedRotation(
      entry.typeId,
      entry.initialRotation,
      transformId,
    ),
    trayIndex: pieceId,
  }));
  const witness = shifted.map(({ entry, pieceId, cells }) => ({
    pieceId,
    rotation: transformedRotation(
      entry.typeId,
      entry.witness.rotation,
      transformId,
    ),
    row: Math.min(...cells.map(({ row }) => row)),
    column: Math.min(...cells.map(({ column }) => column)),
  }));
  const definition = freezeContractDefinition({
    version: 1,
    game: 'kinnoki-yard',
    mode: 'contracts',
    difficulty,
    seed: seed >>> 0,
    width,
    height,
    target,
    pieces,
    witness,
    generation: {
      usedFallback: true,
      attempt: 0,
      sourceId: source.id,
      transformId,
      operations: 0,
    },
  });
  const validation = validateContractDefinition(definition);
  if (!validation.valid) {
    throw new Error(`Invalid bundled Contract fallback: ${validation.errors.join(', ')}`);
  }
  return definition;
}
```

The default seed preserves the three-argument direct test seam. Production fallback selection always passes the requested generation seed as the fourth argument.

- [ ] **Step 7: Implement the exact non-repeating fallback selector**

Append the selector; collision handling advances through all 32 source/transform combinations and never re-enters procedural generation:

```js
export function selectContractFallback({ difficulty, seed, previousSignature }) {
  const sources = CONTRACT_FALLBACK_PACKINGS[difficulty];
  const combinationCount = sources.length * CONTRACT_TRANSFORM_IDS.length;
  const startSlot = indexedSeed(seed, 'fallback', 0) % combinationCount;
  for (let fallbackIndex = 0; fallbackIndex < combinationCount; fallbackIndex += 1) {
    const slot = (startSlot + fallbackIndex) % combinationCount;
    const source = sources[slot % sources.length];
    const transformId = CONTRACT_TRANSFORM_IDS[Math.floor(slot / sources.length)];
    const definition = definitionFromFallback(source, difficulty, transformId, seed);
    if (definition.seed !== (seed >>> 0)) {
      throw new Error('Contract fallback seed mismatch');
    }
    if (contractSignature(definition) !== previousSignature) return definition;
  }
  throw new Error('No non-repeating validated Contract fallback remains');
}
```

- [ ] **Step 8: Construct connected procedural witnesses**

Append the bounded attempt builder. It uses the attempt-specific RNG for every choice, enumerates attachment origins in row-major order, preserves each witness rotation in the allowed set, and shuffles only tray indices:

```js
const touchesTarget = (cells, occupied) => cells.some(({ row, column }) => (
  ORTHOGONAL.some(([rowDelta, columnDelta]) => (
    occupied.has(targetKey(row + rowDelta, column + columnDelta))
  ))
));

const candidateAttachments = (typeId, occupiedCells) => {
  const occupied = new Set(occupiedCells.map(({ row, column }) => targetKey(row, column)));
  const rows = occupiedCells.map(({ row }) => row);
  const columns = occupiedCells.map(({ column }) => column);
  const minimumRow = Math.min(...rows);
  const maximumRow = Math.max(...rows);
  const minimumColumn = Math.min(...columns);
  const maximumColumn = Math.max(...columns);
  const candidates = [];
  for (const rotation of rotationsFor(typeId)) {
    const bounds = boundsFor(rotation.cells);
    for (let row = minimumRow - bounds.height; row <= maximumRow + 1; row += 1) {
      for (let column = minimumColumn - bounds.width;
        column <= maximumColumn + 1; column += 1) {
        const cells = placedCells(rotation.cells, { row, column });
        if (cells.some((cell) => occupied.has(targetKey(cell.row, cell.column)))
            || !touchesTarget(cells, occupied)) continue;
        candidates.push({ rotation: rotation.rotation, row, column, cells });
      }
    }
  }
  return candidates;
};

const restrictedRotations = (difficulty, pieceIndex, typeId, witnessRotation, rng) => {
  const rotations = rotationsFor(typeId).map(({ rotation }) => rotation);
  if (difficulty === 'easy' || rotations.length === 1) return rotations;
  const alternatePool = rotations.filter((rotation) => rotation !== witnessRotation);
  if (difficulty === 'medium' && pieceIndex % 3 === 2) {
    const opposite = transformedRotation(typeId, witnessRotation, 'rotate180');
    return [...new Set([witnessRotation, opposite])].sort((left, right) => left - right);
  }
  if (difficulty === 'hard' && pieceIndex % 2 === 1 && alternatePool.length > 0) {
    return [witnessRotation, alternatePool[rng.int(alternatePool.length)]]
      .sort((left, right) => left - right);
  }
  return rotations;
};

const shuffleTrayIndices = (pieces, rng) => {
  const order = pieces.map(({ pieceId }) => pieceId);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const selected = rng.int(index + 1);
    [order[index], order[selected]] = [order[selected], order[index]];
  }
  const trayByPiece = new Map(order.map((pieceId, trayIndex) => [pieceId, trayIndex]));
  return pieces.map((piece) => ({
    ...piece,
    trayIndex: trayByPiece.get(piece.pieceId),
  }));
};

function buildContractAttempt({ difficulty, seed, attempt }) {
  const rules = CONTRACT_RULES[difficulty];
  const rng = createRng(indexedSeed(seed, 'contract', attempt));
  const catalogue = difficulty === 'easy' ? CARGO_CATALOG.slice(0, 6) : CARGO_CATALOG;
  const pieceCount = rules.minPieces + rng.int(rules.maxPieces - rules.minPieces + 1);
  const built = [];
  let occupiedCells = [];

  for (let pieceId = 0; pieceId < pieceCount; pieceId += 1) {
    const typeId = catalogue[rng.int(catalogue.length)].id;
    let chosen;
    if (pieceId === 0) {
      const rotations = rotationsFor(typeId);
      const rotation = rotations[rng.int(rotations.length)];
      chosen = {
        rotation: rotation.rotation,
        row: 0,
        column: 0,
        cells: placedCells(rotation.cells, { row: 0, column: 0 }),
      };
    } else {
      const candidates = candidateAttachments(typeId, occupiedCells);
      if (candidates.length === 0) return null;
      chosen = candidates[rng.int(candidates.length)];
    }
    built.push({ pieceId, typeId, ...chosen });
    occupiedCells = [...occupiedCells, ...chosen.cells];
  }

  const minimumRow = Math.min(...occupiedCells.map(({ row }) => row));
  const minimumColumn = Math.min(...occupiedCells.map(({ column }) => column));
  const target = normalizeCells(occupiedCells);
  const { width, height } = boundsFor(target);
  const witness = built.map(({ pieceId, rotation, row, column }) => ({
    pieceId,
    rotation,
    row: row - minimumRow,
    column: column - minimumColumn,
  }));
  const pieces = shuffleTrayIndices(built.map(({ pieceId, typeId, rotation }) => {
    const allowedRotations = restrictedRotations(
      difficulty,
      pieceId,
      typeId,
      rotation,
      rng,
    );
    return {
      pieceId,
      typeId,
      allowedRotations,
      initialRotation: allowedRotations[rng.int(allowedRotations.length)],
      trayIndex: pieceId,
    };
  }), rng);

  return freezeContractDefinition({
    version: 1,
    game: 'kinnoki-yard',
    mode: 'contracts',
    difficulty,
    seed: seed >>> 0,
    width,
    height,
    target,
    pieces,
    witness,
    generation: {
      usedFallback: false,
      attempt,
      sourceId: null,
      transformId: 'identity',
      operations: 0,
    },
  });
}
```

- [ ] **Step 9: Validate difficulty metrics and run bounded generation**

Append the shared metric predicate and generator. `operationLimit` is a test seam; production uses the difficulty's finite solver bound:

```js
const targetMatchesRules = (metrics, rules) => (
  metrics.area >= rules.minimumTargetArea
  && metrics.area <= rules.maximumTargetArea
  && metrics.shortSide >= rules.minimumShortSide
  && metrics.longSide <= rules.maximumLongSide
  && metrics.fillRatio >= rules.minimumFillRatio
  && metrics.fillRatio <= rules.maximumFillRatio
  && metrics.concaveCorners >= rules.minimumConcaveCorners
  && metrics.concaveCorners <= rules.maximumConcaveCorners
  && metrics.narrowBayCells >= rules.minimumNarrowBayCells
  && metrics.narrowBayCells <= rules.maximumNarrowBayCells
);

export function generateContract({
  difficulty,
  seed,
  previousSignature = null,
  operationLimit,
  forceFallback = false,
}) {
  const rules = CONTRACT_RULES[difficulty];
  if (!rules || !Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError('Invalid Contract generation request');
  }
  const solverLimit = operationLimit === undefined
    ? rules.solverOperations
    : operationLimit;
  if (!Number.isSafeInteger(solverLimit) || solverLimit < 0) {
    throw new TypeError('Invalid Contract solver operation limit');
  }

  if (!forceFallback) {
    for (let attempt = 0; attempt < rules.generationAttempts; attempt += 1) {
      const candidate = buildContractAttempt({ difficulty, seed, attempt });
      if (!candidate
          || !targetMatchesRules(measureContractTarget(candidate.target), rules)
          || contractSignature(candidate) === previousSignature) continue;
      const solved = solveContract(candidate, {}, { operationLimit: solverLimit });
      if (solved.status !== 'solved') continue;
      const definition = freezeContractDefinition({
        ...candidate,
        generation: { ...candidate.generation, operations: solved.operations },
      });
      if (validateContractDefinition(definition).valid) return definition;
    }
  }
  return selectContractFallback({ difficulty, seed, previousSignature });
}
```

- [ ] **Step 10: Implement stable definition validation around the Task 5A solver**

Append the validator and its category helpers. It never throws on hostile input and emits at most one stable error for each category in the documented order:

```js
const unsignedSeed = (value) => Number.isSafeInteger(value)
  && value >= 0 && value <= 0xffffffff;
const uniqueValues = (values) => new Set(values).size === values.length;

const connectedTarget = (cells) => {
  const keys = new Set(cells.map(keyFor));
  const first = cells[0];
  if (!first) return false;
  const visited = new Set([keyFor(first)]);
  const queue = [first];
  for (let index = 0; index < queue.length; index += 1) {
    const cell = queue[index];
    for (const [rowDelta, columnDelta] of ORTHOGONAL) {
      const next = { row: cell.row + rowDelta, column: cell.column + columnDelta };
      const key = keyFor(next);
      if (keys.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }
  return visited.size === keys.size;
};

export function validateContractDefinition(definition) {
  const errors = [];
  const rules = CONTRACT_RULES[definition?.difficulty];
  const envelopeValid = definition?.version === 1
    && definition?.game === 'kinnoki-yard'
    && definition?.mode === 'contracts'
    && Boolean(rules)
    && unsignedSeed(definition?.seed)
    && Number.isSafeInteger(definition?.width) && definition.width > 0
    && Number.isSafeInteger(definition?.height) && definition.height > 0;
  if (!envelopeValid) errors.push('invalid contract envelope');

  let targetValid = envelopeValid && Array.isArray(definition.target)
    && definition.target.length > 0;
  try {
    if (targetValid) {
      const normalized = normalizeCells(definition.target);
      const bounds = boundsFor(normalized);
      targetValid = JSON.stringify(normalized) === JSON.stringify(definition.target)
        && bounds.width === definition.width
        && bounds.height === definition.height
        && normalized.every(({ row, column }) => (
          row >= 0 && row < definition.height
          && column >= 0 && column < definition.width
        ))
        && connectedTarget(normalized)
        && targetMatchesRules(measureContractTarget(normalized), rules);
    }
  } catch {
    targetValid = false;
  }
  if (!targetValid) errors.push('invalid contract target');

  let piecesValid = Boolean(rules) && Array.isArray(definition?.pieces)
    && definition.pieces.length >= rules.minPieces
    && definition.pieces.length <= rules.maxPieces;
  try {
    if (piecesValid) {
      const pieceIds = definition.pieces.map(({ pieceId }) => pieceId);
      const trayIndices = definition.pieces.map(({ trayIndex }) => trayIndex);
      piecesValid = pieceIds.every((value) => Number.isSafeInteger(value) && value >= 0)
        && trayIndices.every((value) => Number.isSafeInteger(value) && value >= 0)
        && uniqueValues(pieceIds)
        && uniqueValues(trayIndices)
        && definition.pieces.every((piece) => {
          if (!cargoTypeIds.has(piece.typeId)
              || !Array.isArray(piece.allowedRotations)
              || piece.allowedRotations.length === 0
              || !uniqueValues(piece.allowedRotations)) return false;
          const canonical = new Set(rotationsFor(piece.typeId)
            .map(({ rotation }) => rotation));
          return piece.allowedRotations.every((rotation) => canonical.has(rotation))
            && piece.allowedRotations.includes(piece.initialRotation);
        });
    }
  } catch {
    piecesValid = false;
  }
  if (!piecesValid) errors.push('invalid contract pieces');

  let areaValid = targetValid && piecesValid;
  try {
    if (areaValid) {
      const pieceArea = definition.pieces.reduce((total, piece) => (
        total + rotationsFor(piece.typeId)[0].cells.length
      ), 0);
      areaValid = pieceArea === definition.target.length;
    }
  } catch {
    areaValid = false;
  }
  if (!areaValid) errors.push('invalid contract area');

  let witnessValid = areaValid && Array.isArray(definition?.witness)
    && definition.witness.length === definition.pieces.length;
  try {
    if (witnessValid) {
      const pieceById = new Map(definition.pieces
        .map((piece) => [piece.pieceId, piece]));
      const witnessIds = definition.witness.map(({ pieceId }) => pieceId);
      const targetKeys = new Set(definition.target.map(keyFor));
      const occupied = new Set();
      witnessValid = uniqueValues(witnessIds)
        && witnessIds.every((pieceId) => pieceById.has(pieceId));
      for (const placement of witnessValid ? definition.witness : []) {
        const piece = pieceById.get(placement.pieceId);
        if (!piece.allowedRotations.includes(placement.rotation)
            || !Number.isInteger(placement.row)
            || !Number.isInteger(placement.column)) {
          witnessValid = false;
          break;
        }
        const cells = placementCells(piece, placement);
        if (cells.some((cell) => !targetKeys.has(keyFor(cell))
            || occupied.has(keyFor(cell)))) {
          witnessValid = false;
          break;
        }
        for (const cell of cells) occupied.add(keyFor(cell));
      }
      witnessValid = witnessValid && occupied.size === targetKeys.size;
    }
  } catch {
    witnessValid = false;
  }
  if (!witnessValid) errors.push('invalid contract witness');

  const generation = definition?.generation;
  const sourceIds = new Set((CONTRACT_FALLBACK_PACKINGS[definition?.difficulty] ?? [])
    .map(({ id }) => id));
  const generationValid = Boolean(rules)
    && typeof generation?.usedFallback === 'boolean'
    && Number.isSafeInteger(generation?.attempt) && generation.attempt >= 0
    && generation.attempt < rules.generationAttempts
    && Number.isSafeInteger(generation?.operations) && generation.operations >= 0
    && generation.operations <= rules.solverOperations
    && CONTRACT_TRANSFORM_IDS.includes(generation?.transformId)
    && (generation.usedFallback
      ? sourceIds.has(generation.sourceId)
      : generation.sourceId === null && generation.transformId === 'identity');
  if (!generationValid) errors.push('invalid contract generation');

  let solverValid = targetValid && piecesValid && areaValid;
  try {
    if (solverValid) {
      solverValid = solveContract(definition, {}, {
        operationLimit: rules.solverOperations,
      }).status === 'solved';
    }
  } catch {
    solverValid = false;
  }
  if (!solverValid) errors.push('invalid contract solver proof');
  return { valid: errors.length === 0, errors };
}
```

Runtime Hint omits `operationLimit`, so its finite MRV search proves `solved` or `dead-end`; generation and validation always use a finite difficulty bound.

- [ ] **Step 11: Run generator, geometry, and determinism tests**

Run: `node --test Tests/games/kinnoki-yard-solver.test.mjs Tests/games/kinnoki-yard-generator.test.mjs Tests/games/cargo-geometry.test.mjs Tests/games/core.test.mjs`
Expected: PASS; all 90 generated contracts and all 96 source/transform fallback candidates are solver-valid and bounded generation never returns an immediate repeat.

- [ ] **Step 12: Commit Contract generation**

```bash
git add Resources/games/kinnoki-yard.js Tests/games/kinnoki-yard-generator.test.mjs
git commit -m "feat(games): add solvable Yard contract generation"
```

---

### Task 6: Puzzle Contract play, exact moves, Undo, and Hint

**Files:**
- Modify: `Resources/games/kinnoki-yard.js`
- Create: `Tests/games/kinnoki-yard-contracts.test.mjs`

**Interfaces:**
- Consumes: Task 5 definitions and solver.
- Produces: `createContractState(definition)`, `prepareContractForContinue(play)`, `reduceContract(state, action)`, `getContractHint(state)`, and `validateContractState(value, difficulty)`. Task 7 adds the mode facade after both state types exist.

- [ ] **Step 1: Write failing exact move-count and Undo tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createContractState, generateContract, reduceContract, solveContract,
  validateContractState,
} from '../../Resources/games/kinnoki-yard.js';

const transition = (state, action) => reduceContract(state, action).state;

test('only successful manipulation and Undo count as moves', () => {
  const definition = generateContract({ difficulty: 'easy', seed: 12 });
  let state = transition(createContractState(definition), { type: 'start' });
  const piece = definition.pieces[0];
  state = transition(state, { type: 'select-piece', pieceId: piece.pieceId });
  assert.equal(state.moves, 0);
  const rejected = transition(state, { type: 'place-piece', row: -20, column: -20 });
  assert.equal(rejected.moves, 0);
  const witness = definition.witness.find((value) => value.pieceId === piece.pieceId);
  while (state.selectedRotation !== witness.rotation) {
    state = transition(state, { type: 'rotate-piece', quarterTurns: 1 });
  }
  const manipulationMoves = state.moves;
  state = transition(state, { type: 'place-piece', row: witness.row, column: witness.column });
  assert.equal(state.moves, manipulationMoves + 1);
  state = transition(state, { type: 'undo' });
  assert.equal(state.moves, manipulationMoves + 2);
  assert.equal(state.assisted, false);
  assert.equal(state.placements[piece.pieceId], undefined);
});
```

- [ ] **Step 2: Write failing solver-backed Hint and completion tests**

Add this known hardcoded dead-end definition and tests; it does not depend on generator luck:

```js
const pairContract = Object.freeze({
  version: 1, game: 'kinnoki-yard', mode: 'contracts', difficulty: 'easy', seed: 700,
  width: 4, height: 3,
  target: [0, 1, 2].flatMap((row) => (
    [0, 1, 2, 3].map((column) => ({ row, column }))
  )),
  pieces: [0, 1, 2, 3, 4, 5].map((pieceId) => ({
    pieceId, typeId: 'crate-pair', allowedRotations: [0],
    initialRotation: 0, trayIndex: pieceId,
  })),
  witness: [0, 1, 2, 3, 4, 5].map((pieceId) => ({
    pieceId, rotation: 0,
    row: Math.floor(pieceId / 2), column: (pieceId % 2) * 2,
  })),
  generation: {
    usedFallback: false, attempt: 0, sourceId: null,
    transformId: 'identity', operations: 0,
  },
});

test('Hint returns an exact unplaced solver move and marks assistance only', () => {
  const definition = generateContract({ difficulty: 'medium', seed: 19 });
  let state = transition(createContractState(definition), { type: 'start' });
  const before = structuredClone(state);
  const result = reduceContract(state, { type: 'hint' });
  state = result.state;
  const hint = result.events.find((event) => event.type === 'hint');
  assert.ok(definition.pieces.some((piece) => piece.pieceId === hint.pieceId));
  assert.equal(state.placements[hint.pieceId], undefined);
  assert.equal(state.moves, before.moves);
  assert.deepEqual(state.board, before.board);
  assert.equal(state.assisted, true);
});

test('Hint reports a known legal dead end without inventing placement', () => {
  let state = transition(createContractState(pairContract), { type: 'start' });
  state = transition(state, { type: 'select-piece', pieceId: 0 });
  state = transition(state, { type: 'place-piece', row: 0, column: 1 });
  assert.equal(solveContract(pairContract, state.placements).status, 'dead-end');
  const before = structuredClone(state);
  const result = reduceContract(state, { type: 'hint' });
  assert.deepEqual(result.state.board, before.board);
  assert.equal(result.state.moves, before.moves);
  assert.equal(result.state.assisted, true);
  assert.deepEqual(result.events.at(-1), {
    type: 'hint-dead-end',
    message: 'Undo to the most recent completable position or Restart this contract.',
  });
});

test('witness completion is terminal once and uses selected rotation', () => {
  const definition = generateContract({ difficulty: 'easy', seed: 28 });
  let state = transition(createContractState(definition), { type: 'start' });
  for (const witness of definition.witness) {
    state = transition(state, { type: 'select-piece', pieceId: witness.pieceId });
    while (state.selectedRotation !== witness.rotation) {
      state = transition(state, { type: 'rotate-piece', quarterTurns: 1 });
    }
    state = transition(state, {
      type: 'place-piece', row: witness.row, column: witness.column,
    });
  }
  assert.equal(state.status, 'terminal');
  const ignored = reduceContract(state, { type: 'undo' });
  assert.equal(ignored.state, state);
  assert.deepEqual(ignored.events, []);
});

test('reposition counts once and non-engine actions never change moves', () => {
  let state = transition(createContractState(pairContract), { type: 'start' });
  state = transition(state, { type: 'select-piece', pieceId: 0 });
  state = transition(state, { type: 'place-piece', row: 0, column: 1 });
  assert.equal(state.moves, 1);
  state = transition(state, { type: 'place-piece', row: 0, column: 0 });
  assert.equal(state.moves, 2);
  for (const type of ['help', 'pan', 'audio']) {
    const result = reduceContract(state, { type });
    assert.equal(result.state.moves, 2);
    assert.equal(result.events[0].type, 'invalid');
  }
});

test('Contract validator rejects forged terminal and history while accepting valid play', () => {
  const state = createContractState(pairContract);
  assert.deepEqual(validateContractState(state, 'easy'), { valid: true, errors: [] });
  assert.equal(validateContractState({
    ...state, status: 'terminal', terminalReason: 'completed',
  }, 'easy').valid, false);
  assert.equal(validateContractState({
    ...state, history: [{ board: [['forged']] }],
  }, 'easy').valid, false);
  let placed = transition(state, { type: 'start' });
  placed = transition(placed, { type: 'select-piece', pieceId: 0 });
  placed = transition(placed, { type: 'place-piece', row: 0, column: 0 });
  assert.equal(validateContractState(placed, 'easy').valid, true);
  const mismatchedPlacements = { 99: placed.placements[0] };
  assert.equal(validateContractState({
    ...placed, placements: mismatchedPlacements,
  }, 'easy').valid, false);
  const forgedHistory = structuredClone(placed.history);
  forgedHistory[0].selectedPieceId = 999;
  assert.equal(validateContractState({ ...placed, history: forgedHistory }, 'easy').valid, false);
  assert.equal(validateContractState(state, 'hard').valid, false);
});

test('Contract lifecycle no-ops and action payloads follow the shared contract', () => {
  const preview = createContractState(pairContract);
  const started = reduceContract(preview, { type: 'start' }).state;
  const duplicateStart = reduceContract(started, { type: 'start' });
  assert.equal(duplicateStart.state, started);
  assert.deepEqual(duplicateStart.events, []);
  assert.equal(reduceContract(started, {
    type: 'pause', reason: 'pagehide',
  }).events[0].type, 'invalid');
  const paused = reduceContract(started, { type: 'pause', reason: 'hidden' }).state;
  const duplicatePause = reduceContract(paused, { type: 'pause', reason: 'hidden' });
  assert.equal(duplicatePause.state, paused);
  assert.deepEqual(duplicatePause.events, []);
  const resumed = reduceContract(paused, { type: 'resume' }).state;
  assert.deepEqual(reduceContract(resumed, { type: 'resume' }), {
    state: resumed, events: [],
  });
  assert.match(reduceContract(resumed, {
    type: 'rotate-piece', quarterTurns: 2,
  }).events[0].reason, /one quarter turn/i);
});
```

- [ ] **Step 3: Run Contract play tests and verify the red state**

Run: `node --test Tests/games/kinnoki-yard-solver.test.mjs Tests/games/kinnoki-yard-contracts.test.mjs Tests/games/kinnoki-yard-generator.test.mjs`
Expected: FAIL because Contract state/reducer/Hint exports do not exist.

- [ ] **Step 4: Implement serializable Contract state and immutable history**

Add the state creators and the one snapshot shape used by rotation, placement, reposition, and Undo:

```js
const contractSnapshot = (state) => structuredClone({
  board: state.board,
  placements: state.placements,
  selectedPieceId: state.selectedPieceId,
  selectedRotation: state.selectedRotation,
  focus: state.focus,
  hint: state.hint,
});

export function createContractState(definition) {
  if (!validateContractDefinition(definition).valid) {
    throw new TypeError('Invalid Contract definition');
  }
  return {
    kind: 'contracts', status: 'preview', definition,
    board: Array.from({ length: definition.height },
      () => Array(definition.width).fill(null)),
    placements: {},
    selectedPieceId: definition.pieces[0]?.pieceId ?? null,
    selectedRotation: definition.pieces[0]?.initialRotation ?? 0,
    focus: { row: 0, column: 0 }, moves: 0, assisted: false,
    hint: null, history: [], terminalReason: null,
  };
}

export function prepareContractForContinue(play) {
  const result = validateContractState(play, play?.definition?.difficulty);
  if (!result.valid || play.status === 'terminal' || play.status === 'error') {
    throw new TypeError('Invalid saved Contract');
  }
  return structuredClone({ ...play, status: 'paused' });
}
```

The snapshot deliberately excludes `moves` and `assisted`: Undo restores only the fields above, increments the current move count, and never restores record eligibility.

- [ ] **Step 5: Implement Contract lifecycle, selection, and rotation actions**

Start the reducer with terminal/error immutability and these exact action branches:

```js
const contractInvalid = (state, action, reason) => ({
  state, events: [{ type: 'invalid', action, reason }],
});

const reduceContractBase = (state, action) => {
  if (['terminal', 'error', 'disposed'].includes(state.status)) {
    return { state, events: [] };
  }
  if (action.type === 'start') {
    if (state.status === 'active') return { state, events: [] };
    return state.status === 'preview'
      ? { state: { ...state, status: 'active' }, events: [{ type: 'started' }] }
      : contractInvalid(state, 'start', 'The Contract cannot start from this state.');
  }
  if (action.type === 'pause') {
    if (state.status === 'paused') return { state, events: [] };
    if (state.status !== 'active' || !['user', 'hidden'].includes(action.reason)) {
      return contractInvalid(state, 'pause', 'The Contract cannot pause from this state.');
    }
    return { state: { ...state, status: 'paused' },
      events: [{ type: 'paused', reason: action.reason }] };
  }
  if (action.type === 'resume') {
    if (state.status === 'active') return { state, events: [] };
    return state.status === 'paused'
      ? { state: { ...state, status: 'active' }, events: [{ type: 'resumed' }] }
      : contractInvalid(state, 'resume', 'The Contract cannot resume from this state.');
  }
  if (state.status !== 'active') return contractInvalid(state, action.type, 'Game is paused.');

  if (action.type === 'select-piece') {
    const piece = state.definition.pieces.find((value) => value.pieceId === action.pieceId);
    if (!piece) return contractInvalid(state, action.type, 'Unknown cargo piece.');
    const rotation = state.placements[piece.pieceId]?.rotation ?? piece.initialRotation;
    return { state: { ...state, selectedPieceId: piece.pieceId,
      selectedRotation: rotation, hint: null },
    events: [{ type: 'selected', pieceId: piece.pieceId }] };
  }

  if (action.type === 'rotate-piece') {
    if (action.quarterTurns !== 1) {
      return contractInvalid(state, action.type, 'Rotation must be one quarter turn.');
    }
    const piece = state.definition.pieces.find(
      (value) => value.pieceId === state.selectedPieceId,
    );
    if (!piece || piece.allowedRotations.length < 2) {
      return contractInvalid(state, action.type, 'This cargo has one fixed orientation.');
    }
    const index = piece.allowedRotations.indexOf(state.selectedRotation);
    const rotation = piece.allowedRotations[(index + 1) % piece.allowedRotations.length];
    const next = { ...state, selectedRotation: rotation, hint: null,
      moves: saturatingAdd(state.moves, 1),
      history: [...state.history, contractSnapshot(state)] };
    return { state: next, events: [{ type: 'rotated', pieceId: piece.pieceId, rotation }] };
  }
  return null;
};
```

The helper returns `null` only for active actions owned by the next steps.

- [ ] **Step 6: Implement Contract placement, reposition, and completion**

Add one complete placement handler:

```js
const reduceContractPlacement = (state, action) => {
  if (action.type !== 'place-piece') return null;
  if (action.type === 'place-piece') {
    const piece = state.definition.pieces.find(
      (value) => value.pieceId === state.selectedPieceId,
    );
    if (!piece || !Number.isInteger(action.row) || !Number.isInteger(action.column)) {
      return contractInvalid(state, action.type, 'Choose cargo and a target cell.');
    }
    const rotated = rotationsFor(piece.typeId, piece.allowedRotations)
      .find((value) => value.rotation === state.selectedRotation);
    const origin = { row: action.row, column: action.column };
    const cells = placedCells(rotated.cells, origin);
    const target = new Set(state.definition.target.map(keyFor));
    const cleared = removePiece(state.board, piece.pieceId);
    if (!cells.every((cell) => target.has(keyFor(cell)))
        || !canPlace(cleared, rotated.cells, origin)) {
      return contractInvalid(state, action.type, 'Cargo does not fit the Contract target.');
    }
    const repositioning = Object.hasOwn(state.placements, String(piece.pieceId));
    const placement = { pieceId: piece.pieceId, typeId: piece.typeId,
      rotation: state.selectedRotation, row: action.row, column: action.column };
    const board = placePiece(cleared, placement);
    const placements = { ...state.placements, [piece.pieceId]: placement };
    const moves = saturatingAdd(state.moves, 1);
    const complete = Object.keys(placements).length === state.definition.pieces.length
      && board.flat().filter(Boolean).length === state.definition.target.length;
    const next = { ...state, board, placements, moves, hint: null,
      history: [...state.history, contractSnapshot(state)],
      status: complete ? 'terminal' : 'active',
      terminalReason: complete ? 'completed' : null };
    const event = repositioning
      ? { type: 'repositioned', mode: 'contracts', pieceId: piece.pieceId,
        row: action.row, column: action.column, rotation: state.selectedRotation, move: moves }
      : { type: 'placed', mode: 'contracts', pieceId: piece.pieceId,
        row: action.row, column: action.column, rotation: state.selectedRotation, move: moves };
    return { state: next, events: complete
      ? [event, { type: 'completed', moves }] : [event] };
  }
  return null;
};
```

- [ ] **Step 7: Implement solver-backed Hint and path-counting Undo**

Add the public Hint helper and compose the final reducer from the two handlers:

```js
export function getContractHint(state) {
  const result = solveContract(state.definition, state.placements);
  if (result.status !== 'solved') return {
    status: 'dead-end',
    message: 'Undo to the most recent completable position or Restart this contract.',
  };
  const piece = [...state.definition.pieces]
    .filter((value) => !Object.hasOwn(state.placements, String(value.pieceId)))
    .sort((left, right) => left.trayIndex - right.trayIndex)[0];
  return { status: 'solved', placement: result.placements
    .find((value) => value.pieceId === piece.pieceId) };
}

export function reduceContract(state, action) {
  const base = reduceContractBase(state, action);
  if (base) return base;
  const placement = reduceContractPlacement(state, action);
  if (placement) return placement;
  if (action.type === 'undo') {
    if (state.history.length === 0) return { state, events: [] };
    const snapshot = state.history.at(-1);
    const moves = saturatingAdd(state.moves, 1);
    const next = { ...state, ...structuredClone(snapshot), moves,
      assisted: state.assisted, history: state.history.slice(0, -1) };
    return { state: next, events: [{ type: 'undone', mode: 'contracts',
      move: moves, assisted: false }] };
  }
  if (action.type === 'hint') {
    const hint = getContractHint(state);
    const assistedEvent = state.assisted ? []
      : [{ type: 'assisted', reason: 'hint' }];
    if (hint.status === 'dead-end') return {
      state: { ...state, assisted: true, hint },
      events: [...assistedEvent, { type: 'hint-dead-end', message: hint.message }],
    };
    const { pieceId, row, column, rotation } = hint.placement;
    return { state: { ...state, assisted: true, hint },
      events: [...assistedEvent, { type: 'hint', pieceId, row, column, rotation }] };
  }
  return contractInvalid(state, action.type, 'Unsupported Contract action.');
}
```

- [ ] **Step 8: Implement hostile-state validation**

```js
const contractSnapshotKeys = Object.freeze([
  'board', 'focus', 'hint', 'placements', 'selectedPieceId', 'selectedRotation',
]);
const isRecord = (value) => value !== null && typeof value === 'object'
  && !Array.isArray(value);

const contractPositionErrors = (position, definition) => {
  const errors = [];
  if (!isRecord(position?.placements)) return ['invalid Contract placements'];
  const placementEntries = Object.entries(position.placements);
  if (placementEntries.some(([key, placement]) => key !== String(placement?.pieceId))) {
    errors.push('invalid Contract placement key');
  }

  let board = Array.from({ length: definition.height },
    () => Array(definition.width).fill(null));
  const target = new Set(definition.target.map(keyFor));
  for (const [, placement] of placementEntries
    .sort((left, right) => left[1].pieceId - right[1].pieceId)) {
    const piece = definition.pieces.find(
      (candidate) => candidate.pieceId === placement?.pieceId,
    );
    if (!piece || piece.typeId !== placement.typeId
        || !piece.allowedRotations.includes(placement.rotation)
        || !Number.isInteger(placement.row) || !Number.isInteger(placement.column)) {
      errors.push('invalid Contract placement');
      continue;
    }
    const rotated = rotationsFor(piece.typeId, piece.allowedRotations)
      .find((candidate) => candidate.rotation === placement.rotation);
    const origin = { row: placement.row, column: placement.column };
    const cells = placedCells(rotated.cells, origin);
    if (!cells.every((cell) => target.has(keyFor(cell)))
        || !canPlace(board, rotated.cells, origin)) {
      errors.push('invalid Contract placement geometry');
      continue;
    }
    board = placePiece(board, placement);
  }
  if (!validateBoard(position?.board, {
    width: definition.width, height: definition.height,
  }).valid || JSON.stringify(board) !== JSON.stringify(position.board)) {
    errors.push('board mismatch');
  }

  const selected = definition.pieces.find(
    (piece) => piece.pieceId === position?.selectedPieceId,
  );
  if (!selected || !selected.allowedRotations.includes(position?.selectedRotation)) {
    errors.push('invalid Contract selection');
  }
  if (!Number.isInteger(position?.focus?.row)
      || !Number.isInteger(position?.focus?.column)
      || position.focus.row < 0 || position.focus.row >= definition.height
      || position.focus.column < 0 || position.focus.column >= definition.width) {
    errors.push('invalid Contract focus');
  }

  const hint = position?.hint;
  if (hint !== null) {
    const hinted = hint?.status === 'solved' && hint.placement;
    const hintedPiece = hinted && definition.pieces.find(
      (piece) => piece.pieceId === hinted.pieceId,
    );
    const solvedHintValid = hintedPiece
      && !Object.hasOwn(position.placements, String(hinted.pieceId))
      && hintedPiece.typeId === hinted.typeId
      && hintedPiece.allowedRotations.includes(hinted.rotation)
      && Number.isInteger(hinted.row) && Number.isInteger(hinted.column);
    const deadEndHintValid = hint?.status === 'dead-end'
      && typeof hint.message === 'string' && hint.message.length > 0;
    if (!solvedHintValid && !deadEndHintValid) errors.push('invalid Contract hint');
  }
  return errors;
};

export function validateContractState(value, difficulty) {
  const errors = [];
  try {
    if (value?.kind !== 'contracts') errors.push('invalid Contract kind');
    if (!['preview', 'active', 'paused'].includes(value?.status)
        || value?.terminalReason !== null) errors.push('invalid saved Contract status');
    if (value?.definition?.difficulty !== difficulty
        || !validateContractDefinition(value?.definition).valid) {
      errors.push('invalid Contract definition');
    } else {
      errors.push(...contractPositionErrors(value, value.definition));
    }
    if (!Number.isSafeInteger(value?.moves) || value.moves < 0) errors.push('invalid moves');
    if (typeof value?.assisted !== 'boolean') errors.push('invalid assistance');
    if (!Array.isArray(value?.history)) {
      errors.push('invalid Contract history');
    } else if (value.history.some((entry) => {
      if (!isRecord(entry)
          || JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(contractSnapshotKeys)) {
        return true;
      }
      return contractPositionErrors(entry, value.definition).length > 0;
    })) {
      errors.push('invalid Contract history');
    }
  } catch {
    errors.push('invalid Contract state');
  }
  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 9: Run Contract generator and play suites**

Run: `node --test Tests/games/kinnoki-yard-solver.test.mjs Tests/games/kinnoki-yard-contracts.test.mjs Tests/games/kinnoki-yard-generator.test.mjs`
Expected: PASS for moves, reposition, Undo, solver Hint, dead-end guidance, completion, assistance, and immutability.

- [ ] **Step 10: Commit Puzzle Contract play**

```bash
git add Resources/games/kinnoki-yard.js Tests/games/kinnoki-yard-contracts.test.mjs
git commit -m "feat(games): add Yard Puzzle Contract play"
```

---

### Task 7: Endless Yard reducer and unified Yard facade

**Files:**
- Modify: `Resources/games/kinnoki-yard.js`
- Create: `Tests/games/kinnoki-yard-endless.test.mjs`

**Interfaces:**
- Consumes: core deterministic/safe-integer helpers and cargo geometry.
- Produces: `ENDLESS_RULES`, `createEndlessDefinition({ difficulty, seed })`, `endlessSignature(definition)`, `createEndlessState(definition)`, `prepareEndlessForContinue(play)`, `reduceEndless(state, action)`, `hasAnyEndlessPlacement(state)`, `validateEndlessState(value, difficulty)`, `createYardState(definition)`, `prepareYardForContinue(play)`, `yardDefinitionSignature(definition)`, `reduceYard(state, action)`, `validateYardState(value, difficulty, mode)`, and `yardCompletionPayload(state, elapsedMs)`.

- [ ] **Step 1: Write failing batch, score, dispatch, and terminal tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEndlessDefinition, createEndlessState, createYardState, endlessSignature,
  hasAnyEndlessPlacement, reduceEndless, validateEndlessState,
  prepareYardForContinue, reduceYard, validateYardState, yardCompletionPayload,
} from '../../Resources/games/kinnoki-yard.js';
import { canPlace, rotationsFor } from '../../Resources/games/cargo-geometry.js';

const endlessState = (difficulty, seed) => (
  createEndlessState(createEndlessDefinition({ difficulty, seed }))
);

test('Endless deals deterministic batches of exactly three', () => {
  const first = endlessState('medium', 7);
  const second = endlessState('medium', 7);
  assert.deepEqual(first.tray, second.tray);
  assert.equal(first.tray.length, 3);
  assert.equal(new Set(first.tray.map((piece) => piece.pieceId)).size, 3);
  assert.notEqual(
    endlessSignature(createEndlessDefinition({ difficulty: 'medium', seed: 7 })),
    endlessSignature(createEndlessDefinition({ difficulty: 'medium', seed: 8 })),
  );
  assert.throws(() => createEndlessDefinition({ difficulty: 'easy', seed: -1 }), TypeError);
  assert.throws(() => createEndlessDefinition({
    difficulty: 'easy', seed: 0x1_0000_0000,
  }), TypeError);
});

test('terminal detection checks every remaining piece rotation', () => {
  const state = endlessState('hard', 11);
  const board = Array.from({ length: 8 }, (_, row) => (
    Array.from({ length: 8 }, (_, column) => (
      (column === 3 && (row === 3 || row === 4))
        ? null : { pieceId: 700 + (row * 8) + column, typeId: 'crate-pair' }
    ))
  ));
  const fixture = {
    ...state, status: 'active', board,
    tray: [{
      pieceId: 90, typeId: 'crate-pair', allowedRotations: [0, 1],
      rotation: 0, batchIndex: 0,
    }],
    selectedPieceId: 90,
  };
  assert.equal(canPlace(board, rotationsFor('crate-pair', [0])[0].cells,
    { row: 3, column: 3 }), false);
  assert.equal(canPlace(board, rotationsFor('crate-pair', [1])[0].cells,
    { row: 3, column: 3 }), true);
  assert.equal(hasAnyEndlessPlacement(fixture), true);
});
```

- [ ] **Step 2: Write failing snapshot-complete Undo and no-Hint tests**

```js
const rectangleEight = (id, row, column) => ({
  id, shapeId: 'rectangle-eight', rotation: 0, origin: { row, column },
  label: 'Eight-cell manifest', pattern: 'bands',
  cells: [0, 1].flatMap((rowOffset) => [0, 1, 2, 3].map((columnOffset) => ({
    row: row + rowOffset, column: column + columnOffset,
  }))),
});

test('Endless Undo restores scoring, batches, manifests, and stream indices exactly', () => {
  const base = endlessState('easy', 17);
  const board = base.board.map((row) => [...row]);
  for (let column = 0; column < 4; column += 1) {
    board[8][column] = { pieceId: 40, typeId: 'dock-square' };
  }
  board[9][0] = { pieceId: 41, typeId: 'crate-pair' };
  board[9][1] = { pieceId: 41, typeId: 'crate-pair' };
  const fixture = {
    ...base, status: 'active', board,
    tray: [{
      pieceId: 2, typeId: 'crate-pair', allowedRotations: [0, 1],
      rotation: 0, batchIndex: 0,
    }],
    selectedPieceId: 2,
    manifests: [rectangleEight('manifest-undo', 8, 0)],
    manifestIndex: 1,
    sequenceIndex: 3,
    batchIndex: 0,
    score: 100,
    combo: 1,
    bestCombo: 1,
    dispatchedManifests: 0,
  };
  const snapshot = structuredClone(fixture);
  let result = reduceEndless(fixture, { type: 'place-piece', row: 9, column: 2 });
  assert.equal(result.state.tray.length, 3);
  assert.equal(result.state.combo, 2);
  assert.equal(result.state.dispatchedManifests, 1);
  assert.ok(result.state.sequenceIndex > snapshot.sequenceIndex);
  result = reduceEndless(result.state, { type: 'undo' });
  for (const key of [
    'board', 'tray', 'manifests', 'score', 'combo', 'bestCombo',
    'batchIndex', 'sequenceIndex', 'manifestIndex', 'dispatchedManifests',
  ]) assert.deepEqual(result.state[key], snapshot[key], key);
  assert.equal(result.state.assisted, true);
  assert.deepEqual(result.events, [
    { type: 'assisted', reason: 'endless-undo' },
    { type: 'undone', mode: 'endless', assisted: true },
  ]);
  assert.equal(result.state.history.length, 0);
  const duplicate = reduceEndless(result.state, { type: 'undo' });
  assert.equal(duplicate.state, result.state);

  const hint = reduceEndless(result.state, { type: 'hint' });
  assert.equal(hint.state, result.state);
  assert.deepEqual(hint.events, [{
    type: 'invalid', action: 'hint', reason: 'Hint is unavailable in Endless Yard.',
  }]);
});

test('Endless validator isolates forged state and mismatched difficulty', () => {
  const state = endlessState('medium', 22);
  assert.deepEqual(validateEndlessState(state, 'medium'), { valid: true, errors: [] });
  assert.equal(validateEndlessState({
    ...state, tray: [{ ...state.tray[0], pieceId: 'string-id' }],
  }, 'medium').valid, false);
  assert.equal(validateEndlessState({ ...state, status: 'terminal' }, 'medium').valid, false);
  assert.equal(validateEndlessState({
    ...state, selectedPieceId: 999,
  }, 'medium').valid, false);
  assert.equal(validateEndlessState({
    ...state, tray: [{ ...state.tray[0],
      typeId: state.tray[0].typeId === 'crate-pair' ? 'anchor-five' : 'crate-pair' },
    ...state.tray.slice(1)],
  }, 'medium').valid, false);
  assert.equal(validateEndlessState({
    ...state, bestCombo: 0, combo: 1,
  }, 'medium').valid, false);
  const forgedHistory = [{
    board: state.board, tray: state.tray, selectedPieceId: state.selectedPieceId,
    focus: state.focus, manifests: state.manifests, manifestIndex: state.manifestIndex,
    sequenceIndex: state.sequenceIndex, batchIndex: state.batchIndex,
    score: state.score, combo: state.combo, bestCombo: state.bestCombo,
    dispatchedManifests: state.dispatchedManifests, unexpected: 'overwrite-live-state',
  }];
  assert.equal(validateEndlessState({ ...state, history: forgedHistory }, 'medium').valid, false);
  assert.equal(validateEndlessState(state, 'hard').valid, false);
});

test('Endless lifecycle and rotate payloads obey the shared action contract', () => {
  const preview = endlessState('medium', 31);
  const active = reduceEndless(preview, { type: 'start' }).state;
  assert.deepEqual(reduceEndless(active, { type: 'start' }), { state: active, events: [] });
  assert.equal(reduceEndless(active, {
    type: 'pause', reason: 'pagehide',
  }).events[0].type, 'invalid');
  const paused = reduceEndless(active, { type: 'pause', reason: 'hidden' }).state;
  assert.deepEqual(reduceEndless(paused, {
    type: 'pause', reason: 'hidden',
  }), { state: paused, events: [] });
  const resumed = reduceEndless(paused, { type: 'resume' }).state;
  assert.deepEqual(reduceEndless(resumed, { type: 'resume' }), {
    state: resumed, events: [],
  });
  assert.match(reduceEndless(resumed, {
    type: 'rotate-piece', quarterTurns: 2,
  }).events[0].reason, /one quarter turn/i);
});

test('Yard completion payloads expose exact typed records and summaries', () => {
  const contract = yardCompletionPayload({
    kind: 'contracts', status: 'terminal', moves: 12, assisted: true,
    placements: { 0: {}, 1: {} }, definition: { pieces: [{}, {}] },
  }, 9000);
  assert.deepEqual(contract, {
    game: 'kinnoki-yard', mode: 'contracts',
    records: { time: 9000, moves: 12 },
    summary: {
      elapsedMs: 9000, moves: 12, assisted: true,
      piecesPlaced: 2, totalPieces: 2,
    },
  });
  const endless = yardCompletionPayload({
    kind: 'endless', status: 'terminal', terminalReason: 'no-placement',
    score: 440, bestCombo: 3, dispatchedManifests: 0, assisted: false,
  }, 5000);
  assert.deepEqual(endless, {
    game: 'kinnoki-yard', mode: 'endless',
    records: { score: 440, combo: 3 },
    summary: {
      score: 440, dispatchedManifests: 0, bestCombo: 3,
      elapsedMs: 5000, assisted: false, reason: 'no-placement',
    },
  });
  assert.throws(() => yardCompletionPayload({
    kind: 'contracts', status: 'terminal', moves: 1, assisted: false,
    placements: {}, definition: { pieces: [] },
  }, -1), TypeError);
});

test('Yard facade rejects unknown modes and kinds instead of routing to Endless', () => {
  assert.throws(() => createYardState({ mode: 'unknown' }), TypeError);
  assert.throws(() => prepareYardForContinue({ kind: 'unknown' }), TypeError);
  assert.throws(() => reduceYard({ kind: 'unknown' }, { type: 'start' }), TypeError);
  assert.deepEqual(validateYardState({}, 'easy', 'unknown'), {
    valid: false, errors: ['invalid Yard mode'],
  });
});
```

- [ ] **Step 3: Run Endless tests and verify the missing exports**

Run: `node --test Tests/games/kinnoki-yard-endless.test.mjs Tests/games/kinnoki-yard-contracts.test.mjs`
Expected: FAIL on absent Endless state/reducer.

- [ ] **Step 4: Implement exact Endless difficulty and deterministic batches**

```js
export const ENDLESS_RULES = Object.freeze({
  easy: {
    width: 10, height: 10, cargoCount: 6,
    rotationPolicy: 'all', manifestCount: 1,
    manifestShapeIds: ['rectangle-eight'],
  },
  medium: {
    width: 9, height: 9, cargoCount: 12,
    rotationPolicy: 'selected-opposites', manifestCount: 2,
    manifestShapeIds: ['rectangle-six', 'step-five', 'step-seven'],
  },
  hard: {
    width: 8, height: 8, cargoCount: 12,
    rotationPolicy: 'initial-plus-one', manifestCount: 2,
    manifestShapeIds: ['step-five', 'corner-six', 'harbour-seven'],
  },
});
export function createEndlessDefinition({ difficulty, seed }) {
  const rules = ENDLESS_RULES[difficulty];
  if (!rules || !unsignedSeed(seed)) {
    throw new TypeError('Invalid Endless definition request');
  }
  return Object.freeze({ version: 1, game: 'kinnoki-yard', mode: 'endless',
    difficulty, seed: seed >>> 0, width: rules.width, height: rules.height });
}

export const endlessSignature = (definition) => JSON.stringify([
  definition.version, definition.game, definition.mode, definition.difficulty,
  definition.seed, definition.width, definition.height,
]);

const endlessPieceAt = (definition, sequenceIndex, batchIndex) => {
  const rules = ENDLESS_RULES[definition.difficulty];
  const rng = createRng(indexedSeed(definition.seed, 'yard-batch', sequenceIndex));
  const type = CARGO_CATALOG[rng.int(rules.cargoCount)];
  const rotations = rotationsFor(type.id);
  const initial = rotations[rng.int(rotations.length)].rotation;
  let allowedRotations = rotations.map(({ rotation }) => rotation);
  if (rules.rotationPolicy === 'selected-opposites' && type.cells.length === 5) {
    const opposite = rotations.find(({ rotation }) => rotation === ((initial + 2) % 4));
    allowedRotations = [...new Set([initial, opposite?.rotation ?? initial])];
  } else if (rules.rotationPolicy === 'initial-plus-one') {
    const alternatives = rotations.filter(({ rotation }) => rotation !== initial);
    const alternate = alternatives.length ? alternatives[rng.int(alternatives.length)].rotation : initial;
    allowedRotations = [...new Set([initial, alternate])];
  }
  return { pieceId: sequenceIndex, typeId: type.id, allowedRotations,
    rotation: initial, batchIndex };
};

const dealEndlessBatch = (definition, sequenceIndex, batchIndex) => (
  [0, 1, 2].map((offset) => endlessPieceAt(
    definition, sequenceIndex + offset, batchIndex,
  ))
);

export function createEndlessState(definition) {
  const rules = ENDLESS_RULES[definition?.difficulty];
  let expectedDefinition;
  try {
    expectedDefinition = createEndlessDefinition({
      difficulty: definition?.difficulty, seed: definition?.seed,
    });
  } catch {}
  if (!rules || JSON.stringify(definition) !== JSON.stringify(expectedDefinition)) {
    throw new TypeError('Invalid Endless definition');
  }
  const board = Array.from({ length: definition.height },
    () => Array(definition.width).fill(null));
  const selected = selectNextManifestZones({ board, width: definition.width,
    height: definition.height, shapeIds: rules.manifestShapeIds,
    seed: definition.seed, startIndex: 0, count: rules.manifestCount });
  const tray = dealEndlessBatch(definition, 0, 0);
  return { kind: 'endless', status: 'preview', definition, board, tray,
    selectedPieceId: tray[0].pieceId, focus: { row: 0, column: 0 },
    manifests: selected.manifests, manifestIndex: selected.nextIndex,
    sequenceIndex: 3, batchIndex: 0, score: 0, combo: 0, bestCombo: 0,
    dispatchedManifests: 0, assisted: false, history: [], terminalReason: null };
}

export function prepareEndlessForContinue(play) {
  if (!validateEndlessState(play, play?.definition?.difficulty).valid) {
    throw new TypeError('Invalid saved Endless Yard');
  }
  return structuredClone({ ...play, status: 'paused' });
}
```

Every initial tray therefore has exactly three entries and `sequenceIndex` always points to the first piece of the next batch.

- [ ] **Step 5: Implement placement, exact scoring, manifests, and terminal detection**

Add exhaustive fit detection, the complete Undo snapshot, and the reducer. Ordinary rows/columns are never inspected:

```js
const endlessSnapshot = (state) => structuredClone({
  board: state.board, tray: state.tray, selectedPieceId: state.selectedPieceId,
  focus: state.focus, manifests: state.manifests, manifestIndex: state.manifestIndex,
  sequenceIndex: state.sequenceIndex, batchIndex: state.batchIndex,
  score: state.score, combo: state.combo, bestCombo: state.bestCombo,
  dispatchedManifests: state.dispatchedManifests,
});

export function hasAnyEndlessPlacement(state) {
  return state.tray.some((piece) => rotationsFor(piece.typeId, piece.allowedRotations)
    .some((rotated) => {
      const bounds = boundsFor(rotated.cells);
      for (let row = 0; row <= state.definition.height - bounds.height; row += 1) {
        for (let column = 0; column <= state.definition.width - bounds.width; column += 1) {
          if (canPlace(state.board, rotated.cells, { row, column })) return true;
        }
      }
      return false;
    }));
}

const endlessInvalid = (state, action, reason) => ({
  state, events: [{ type: 'invalid', action, reason }],
});

export function reduceEndless(state, action) {
  if (['terminal', 'error', 'disposed'].includes(state.status)) return { state, events: [] };
  if (action.type === 'start') {
    if (state.status === 'active') return { state, events: [] };
    return state.status === 'preview'
      ? { state: { ...state, status: 'active' }, events: [{ type: 'started' }] }
      : endlessInvalid(state, 'start', 'Endless Yard cannot start from this state.');
  }
  if (action.type === 'pause') {
    if (state.status === 'paused') return { state, events: [] };
    if (state.status !== 'active' || !['user', 'hidden'].includes(action.reason)) {
      return endlessInvalid(state, 'pause', 'Endless Yard cannot pause from this state.');
    }
    return { state: { ...state, status: 'paused' },
      events: [{ type: 'paused', reason: action.reason }] };
  }
  if (action.type === 'resume') {
    if (state.status === 'active') return { state, events: [] };
    return state.status === 'paused'
      ? { state: { ...state, status: 'active' }, events: [{ type: 'resumed' }] }
      : endlessInvalid(state, 'resume', 'Endless Yard cannot resume from this state.');
  }
  if (state.status !== 'active') return endlessInvalid(state, action.type, 'Game is paused.');
  if (action.type === 'hint') {
    return endlessInvalid(state, 'hint', 'Hint is unavailable in Endless Yard.');
  }
  if (action.type === 'select-piece') {
    const piece = state.tray.find((value) => value.pieceId === action.pieceId);
    return piece
      ? { state: { ...state, selectedPieceId: piece.pieceId },
        events: [{ type: 'selected', pieceId: piece.pieceId }] }
      : endlessInvalid(state, action.type, 'Unknown cargo piece.');
  }
  if (action.type === 'rotate-piece') {
    if (action.quarterTurns !== 1) {
      return endlessInvalid(state, action.type, 'Rotation must be one quarter turn.');
    }
    const index = state.tray.findIndex((value) => value.pieceId === state.selectedPieceId);
    if (index < 0) return endlessInvalid(state, action.type, 'Choose cargo first.');
    const piece = state.tray[index];
    const rotationIndex = piece.allowedRotations.indexOf(piece.rotation);
    const rotation = piece.allowedRotations[(rotationIndex + 1) % piece.allowedRotations.length];
    if (rotation === piece.rotation) {
      return endlessInvalid(state, action.type, 'This cargo has one fixed orientation.');
    }
    const tray = state.tray.map((value, pieceIndex) => (
      pieceIndex === index ? { ...value, rotation } : value
    ));
    return { state: { ...state, tray },
      events: [{ type: 'rotated', pieceId: piece.pieceId, rotation }] };
  }
  if (action.type === 'undo') {
    if (state.history.length === 0) return { state, events: [] };
    const restored = structuredClone(state.history.at(-1));
    return { state: { ...state, ...restored, assisted: true,
      history: state.history.slice(0, -1) },
    events: [
      ...(state.assisted ? [] : [{ type: 'assisted', reason: 'endless-undo' }]),
      { type: 'undone', mode: 'endless', assisted: true },
    ] };
  }
  if (action.type !== 'place-piece') {
    return endlessInvalid(state, action.type, 'Unsupported Endless Yard action.');
  }

  const piece = state.tray.find((value) => value.pieceId === state.selectedPieceId);
  const rotated = piece && rotationsFor(piece.typeId, piece.allowedRotations)
    .find((value) => value.rotation === piece.rotation);
  const origin = { row: action.row, column: action.column };
  if (!piece || !rotated || !Number.isInteger(action.row) || !Number.isInteger(action.column)
      || !canPlace(state.board, rotated.cells, origin)) {
    return endlessInvalid(state, action.type, 'Cargo does not fit here.');
  }

  const history = [...state.history, endlessSnapshot(state)];
  const placedBoard = placePiece(state.board, { pieceId: piece.pieceId,
    typeId: piece.typeId, rotation: piece.rotation, ...origin });
  const placementScore = 10 * rotated.cells.length;
  let board = placedBoard;
  let manifests = state.manifests;
  let manifestIndex = state.manifestIndex;
  let combo = state.combo;
  let bestCombo = state.bestCombo;
  let dispatchedManifests = state.dispatchedManifests;
  let score = saturatingAdd(state.score, placementScore);
  const events = [{ type: 'placed', mode: 'endless', pieceId: piece.pieceId,
    row: action.row, column: action.column, rotation: piece.rotation,
    scoreAdded: placementScore }];
  const dispatched = dispatchCompletedManifests(placedBoard, state.manifests);
  if (dispatched.completed.length > 0) {
    combo = saturatingAdd(combo, 1);
    bestCombo = Math.max(bestCombo, combo);
    const dispatchScore = Math.min(Number.MAX_SAFE_INTEGER,
      100 * dispatched.dispatchedCells * combo);
    score = saturatingAdd(score, dispatchScore);
    dispatchedManifests = saturatingAdd(dispatchedManifests, dispatched.completed.length);
    board = dispatched.board;
    const completedIds = new Set(dispatched.completed.map(({ id }) => id));
    const incomplete = state.manifests.filter(({ id }) => !completedIds.has(id));
    events.push({ type: 'dispatch',
      manifestIds: dispatched.completed.map(({ id }) => id),
      cells: dispatched.dispatchedCells, combo, scoreAdded: dispatchScore });
    try {
      const replacement = selectNextManifestZones({ board,
        width: state.definition.width, height: state.definition.height,
        shapeIds: ENDLESS_RULES[state.definition.difficulty].manifestShapeIds,
        seed: state.definition.seed, startIndex: manifestIndex,
        count: dispatched.completed.length,
        occupied: incomplete.flatMap(({ cells }) => cells) });
      manifests = [...incomplete, ...replacement.manifests];
      manifestIndex = replacement.nextIndex;
    } catch {
      const tray = state.tray.filter((value) => value.pieceId !== piece.pieceId);
      return { state: { ...state, board, score, combo, bestCombo,
        manifests: incomplete, dispatchedManifests, history, tray,
        selectedPieceId: tray[0]?.pieceId ?? null, status: 'error' },
      events: [...events, { type: 'error', code: 'manifest-generation',
        message: 'A new Cargo Manifest could not be prepared.' }] };
    }
  } else if (combo > 0) {
    events.push({ type: 'combo-reset', previousCombo: combo });
    combo = 0;
  }

  let tray = state.tray.filter((value) => value.pieceId !== piece.pieceId);
  let sequenceIndex = state.sequenceIndex;
  let batchIndex = state.batchIndex;
  if (tray.length === 0) {
    batchIndex = saturatingAdd(batchIndex, 1);
    tray = dealEndlessBatch(state.definition, sequenceIndex, batchIndex);
    sequenceIndex = saturatingAdd(sequenceIndex, 3);
  }
  let next = { ...state, board, tray, selectedPieceId: tray[0].pieceId,
    manifests, manifestIndex, sequenceIndex, batchIndex, score, combo, bestCombo,
    dispatchedManifests, history };
  if (!hasAnyEndlessPlacement(next)) {
    next = { ...next, status: 'terminal', terminalReason: 'no-placement' };
    events.push({ type: 'terminal', reason: 'no-placement' });
  }
  return { state: next, events };
}
```

- [ ] **Step 6: Implement complete Undo and Yard facade**

Add the mode facade and exact completion serializer:

```js
export function yardDefinitionSignature(definition) {
  if (definition?.mode === 'contracts') return contractSignature(definition);
  if (definition?.mode === 'endless') return endlessSignature(definition);
  throw new TypeError('Invalid Yard definition mode');
}

export function createYardState(definition) {
  if (definition?.mode === 'contracts' && validateContractDefinition(definition).valid) {
    return createContractState(definition);
  }
  if (definition?.mode === 'endless') return createEndlessState(definition);
  throw new TypeError('Invalid Yard definition');
}

export function prepareYardForContinue(play) {
  if (play?.kind === 'contracts') return prepareContractForContinue(play);
  if (play?.kind === 'endless') return prepareEndlessForContinue(play);
  throw new TypeError('Invalid Yard state kind');
}
export function reduceYard(state, action) {
  if (state?.kind === 'contracts') return reduceContract(state, action);
  if (state?.kind === 'endless') return reduceEndless(state, action);
  throw new TypeError('Invalid Yard state kind');
}
export function validateYardState(value, difficulty, mode) {
  if (mode === 'contracts') return validateContractState(value, difficulty);
  if (mode === 'endless') return validateEndlessState(value, difficulty);
  return { valid: false, errors: ['invalid Yard mode'] };
}

export function yardCompletionPayload(state, elapsedMs) {
  if (state?.status !== 'terminal') return null;
  if (!safeCount(elapsedMs)) {
    throw new TypeError('Elapsed time must be a non-negative safe integer');
  }
  if (state.kind === 'contracts') return {
    game: 'kinnoki-yard', mode: 'contracts',
    records: { time: elapsedMs, moves: state.moves },
    summary: { elapsedMs, moves: state.moves, assisted: state.assisted,
      piecesPlaced: Object.keys(state.placements).length,
      totalPieces: state.definition.pieces.length },
  };
  if (state.kind === 'endless' && state.terminalReason === 'no-placement') return {
    game: 'kinnoki-yard', mode: 'endless',
    records: { score: state.score, combo: state.bestCombo },
    summary: { score: state.score, dispatchedManifests: state.dispatchedManifests,
      bestCombo: state.bestCombo, elapsedMs, assisted: state.assisted,
      reason: 'no-placement' },
  };
  return null;
}
```

- [ ] **Step 7: Implement hostile Endless-state validation**

```js
const safeCount = (value) => Number.isSafeInteger(value) && value >= 0;
const endlessSnapshotKeys = Object.freeze([
  'batchIndex', 'bestCombo', 'board', 'combo', 'dispatchedManifests', 'focus',
  'manifestIndex', 'manifests', 'score', 'selectedPieceId', 'sequenceIndex', 'tray',
]);

const endlessPositionErrors = (position, definition, rules) => {
  const errors = [];
  if (!validateBoard(position?.board, {
    width: rules.width, height: rules.height,
  }).valid) errors.push('invalid Endless board');

  for (const key of ['manifestIndex', 'sequenceIndex', 'batchIndex', 'score',
    'combo', 'bestCombo', 'dispatchedManifests']) {
    if (!safeCount(position?.[key])) errors.push(`invalid Endless ${key}`);
  }
  if (safeCount(position?.combo) && safeCount(position?.bestCombo)
      && position.bestCombo < position.combo) errors.push('invalid Endless best combo');

  const expectedBatch = safeCount(position?.sequenceIndex)
    && position.sequenceIndex >= 3 && position.sequenceIndex % 3 === 0
    ? (position.sequenceIndex / 3) - 1 : null;
  if (expectedBatch === null || position?.batchIndex !== expectedBatch) {
    errors.push('invalid Endless stream indices');
  }
  if (!Array.isArray(position?.tray)
      || position.tray.length < 1 || position.tray.length > 3) {
    errors.push('invalid Endless tray');
  } else if (expectedBatch !== null) {
    const firstPieceId = position.sequenceIndex - 3;
    let previousPieceId = firstPieceId - 1;
    for (const piece of position.tray) {
      let expected;
      try { expected = endlessPieceAt(definition, piece?.pieceId, expectedBatch); } catch {}
      if (!expected || piece.pieceId < firstPieceId || piece.pieceId >= position.sequenceIndex
          || piece.pieceId <= previousPieceId
          || piece.batchIndex !== expectedBatch
          || piece.typeId !== expected.typeId
          || JSON.stringify(piece.allowedRotations) !== JSON.stringify(expected.allowedRotations)
          || !piece.allowedRotations.includes(piece.rotation)) {
        errors.push('invalid Endless tray piece');
      }
      previousPieceId = piece?.pieceId;
    }
  }
  if (!position?.tray?.some((piece) => piece.pieceId === position.selectedPieceId)) {
    errors.push('invalid Endless selection');
  }
  if (!Number.isInteger(position?.focus?.row)
      || !Number.isInteger(position?.focus?.column)
      || position.focus.row < 0 || position.focus.row >= rules.height
      || position.focus.column < 0 || position.focus.column >= rules.width) {
    errors.push('invalid Endless focus');
  }

  const manifestCells = new Set();
  const manifestIds = new Set();
  if (!Array.isArray(position?.manifests)
      || position.manifests.length !== rules.manifestCount) {
    errors.push('invalid Endless manifests');
  } else {
    for (const manifest of position.manifests) {
      if (!validateManifest(manifest, { width: rules.width, height: rules.height }).valid
          || manifestIds.has(manifest.id)) errors.push('invalid Endless manifest');
      manifestIds.add(manifest.id);
      for (const cell of manifest.cells ?? []) {
        const key = keyFor(cell);
        if (manifestCells.has(key)) errors.push('overlapping Endless manifests');
        manifestCells.add(key);
      }
    }
  }
  const trayIds = new Set((position?.tray ?? []).map(({ pieceId }) => pieceId));
  if ((position?.board ?? []).flat().some((cell) => cell && trayIds.has(cell.pieceId))) {
    errors.push('Endless tray cargo is already on the board');
  }
  return errors;
};

export function validateEndlessState(value, difficulty) {
  const errors = [];
  try {
    const rules = ENDLESS_RULES[difficulty];
    const definition = value?.definition;
    if (value?.kind !== 'endless') errors.push('invalid Endless kind');
    if (!['preview', 'active', 'paused'].includes(value?.status)
        || value?.terminalReason !== null) {
      errors.push('invalid saved Endless status');
    }
    let expectedDefinition;
    try {
      expectedDefinition = createEndlessDefinition({
        difficulty, seed: definition?.seed,
      });
    } catch {}
    if (!rules || JSON.stringify(definition) !== JSON.stringify(expectedDefinition)) {
      errors.push('invalid Endless definition');
    } else {
      errors.push(...endlessPositionErrors(value, definition, rules));
    }
    if (typeof value?.assisted !== 'boolean' || !Array.isArray(value?.history)) {
      errors.push('invalid Endless history');
    } else if (value.history.some((entry) => (
      !isRecord(entry)
      || JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(endlessSnapshotKeys)
      || endlessPositionErrors(entry, definition, rules).length > 0
    ))) {
      errors.push('invalid Endless history');
    }
  } catch {
    errors.push('invalid Endless state');
  }
  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 8: Run all Yard suites**

Run: `node --test Tests/games/kinnoki-yard-solver.test.mjs Tests/games/kinnoki-yard-generator.test.mjs Tests/games/kinnoki-yard-contracts.test.mjs Tests/games/kinnoki-yard-endless.test.mjs`
Expected: PASS for deterministic batches, exact scores, simultaneous manifests, combo reset, saturation, all-rotation terminal checks, complete Undo, no duplicate points, no Endless Hint, and both completion payloads.

- [ ] **Step 9: Commit Endless Yard**

```bash
git add Resources/games/kinnoki-yard.js Tests/games/kinnoki-yard-endless.test.mjs
git commit -m "feat(games): add Endless Yard mode"
```

---

### Task 8: Procedural adaptive game audio

**Files:**
- Create: `Resources/games/game-audio.js`
- Create: `Tests/games/game-audio.test.mjs`

**Interfaces:**
- Consumes: Store v2 audio preferences and explicit controller gestures/events.
- Produces: `KINNOKI_MOTIF` and `createGameAudio(...)` from the shared contract. The module never reads DOM or local storage.

- [ ] **Step 1: Write a fake AudioContext and failing gesture/lifecycle tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KINNOKI_MOTIF, createGameAudio,
} from '../../Resources/games/game-audio.js';

class FakeParam {
  constructor(value = 0) { this.value = value; this.events = []; }
  setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
  linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]); }
  cancelScheduledValues(time) { this.events.push(['cancel', time]); }
}

class FakeNode {
  constructor() {
    this.frequency = new FakeParam();
    this.gain = new FakeParam(1);
    this.connections = [];
    this.started = [];
    this.stopped = [];
  }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
  start(time) { this.started.push(time); }
  stop(time) { this.stopped.push(time); }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0; this.state = 'suspended'; this.destination = new FakeNode();
    this.oscillators = []; this.gains = [];
  }
  createOscillator() { const node = new FakeNode(); this.oscillators.push(node); return node; }
  createGain() { const node = new FakeNode(); this.gains.push(node); return node; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}

test('context is not created until Start and pause/resume has no backlog', async () => {
  let creations = 0;
  const context = new FakeAudioContext();
  const audio = createGameAudio({
    audioContextFactory: () => { creations += 1; return context; },
    preferences: { musicEnabled: true, musicVolume: 0.35,
      effectsEnabled: true, effectsVolume: 0.50 },
  });
  assert.equal(creations, 0);
  await audio.start({ arrangement: 'yard' });
  assert.equal(creations, 1);
  await audio.pause();
  context.currentTime = 100;
  await audio.resume();
  assert.ok(audio.debugState().nextNoteTime <= 100.25);
  await audio.dispose();
  assert.equal(context.state, 'closed');
});
```

- [ ] **Step 2: Write failing motif, intensity, volume, rate-limit, and fallback tests**

```js
const preferences = {
  musicEnabled: true, musicVolume: 0.35,
  effectsEnabled: true, effectsVolume: 0.50,
};

const fakeClock = () => {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout(callback, delay) {
      const id = nextId; nextId += 1;
      timers.set(id, { callback, due: now + delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    advance(milliseconds) {
      now += milliseconds;
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.due <= now)
        .sort((left, right) => left[1].due - right[1].due);
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.callback();
      }
    },
    size: () => timers.size,
  };
};

test('both arrangements share one frozen motif and exact tempos', async () => {
  assert.deepEqual(KINNOKI_MOTIF, [0, 7, 11, 14, 9, 16]);
  assert.equal(Object.isFrozen(KINNOKI_MOTIF), true);
  for (const [arrangement, tempo] of [['yard', 76], ['stack', 118]]) {
    const context = new FakeAudioContext();
    const audio = createGameAudio({
      audioContextFactory: () => context, preferences,
    });
    await audio.start({ arrangement });
    assert.equal(audio.debugState().tempo, tempo);
    assert.deepEqual(KINNOKI_MOTIF, [0, 7, 11, 14, 9, 16]);
    if (arrangement === 'yard') {
      assert.ok(context.oscillators.length >= 2, 'Yard schedules melody and fifth/drone');
    }
    await audio.dispose();
  }
});

test('Stack intensity adds layers and channel preferences stay independent', async () => {
  const context = new FakeAudioContext();
  let schedule = null;
  const audio = createGameAudio({
    audioContextFactory: () => context, preferences,
    setIntervalFn: (callback) => { schedule = callback; return 1; },
    clearIntervalFn: () => {},
  });
  await audio.start({ arrangement: 'stack' });
  const melodyOnly = context.oscillators.length;
  audio.setIntensity({ height: 1, tidePressure: 1 });
  context.currentTime = 1;
  schedule();
  const intense = audio.debugState();
  assert.ok(intense.layerGains.bass > 0);
  assert.ok(intense.layerGains.harmony > 0);
  assert.ok(intense.layerGains.percussion > 0);
  assert.ok(context.oscillators.length >= melodyOnly + 4,
    'scheduler emits audible melody, bass, harmony, and percussion voices');
  audio.setPreferences({ ...preferences, musicEnabled: false, effectsVolume: 0.2 });
  const changed = audio.debugState();
  assert.equal(changed.musicGain, 0);
  assert.equal(changed.effectsGain, 0.2);
  await audio.dispose();
});

test('rapid effects are rate-limited and voice count is bounded', async () => {
  const context = new FakeAudioContext();
  const audio = createGameAudio({
    audioContextFactory: () => context, preferences, monotonicNow: () => 10,
  });
  await audio.start({ arrangement: 'stack' });
  for (let index = 0; index < 20; index += 1) audio.playEffect('move');
  assert.ok(audio.debugState().activeEffectVoices <= 1);
  for (const name of [
    'rotate', 'placement', 'dispatch', 'tide-warning', 'tide-shift',
    'invalid', 'completion', 'terminal',
  ]) audio.playEffect(name);
  assert.ok(audio.debugState().activeEffectVoices <= 8);
  await audio.dispose();
});

test('ended scheduled voices leave source and effect tracking', async () => {
  const context = new FakeAudioContext();
  const audio = createGameAudio({
    audioContextFactory: () => context, preferences, monotonicNow: () => 10,
  });
  await audio.start({ arrangement: 'stack' });
  audio.playEffect('move');
  assert.ok(audio.debugState().activeSources > 0);
  for (const oscillator of context.oscillators) oscillator.onended?.();
  assert.equal(audio.debugState().activeSources, 0);
  assert.equal(audio.debugState().activeEffectVoices, 0);
  await audio.dispose();
});

test('finish preserves one cadence, then fades and self-disposes without leaks', async () => {
  const clock = fakeClock();
  const context = new FakeAudioContext();
  const audio = createGameAudio({
    audioContextFactory: () => context, preferences,
    setTimeoutFn: clock.setTimeout, clearTimeoutFn: clock.clearTimeout,
  });
  await audio.start({ arrangement: 'yard' });
  audio.finish({ outcome: 'completion' });
  const sourcesAfterFirstFinish = context.oscillators.length;
  audio.finish({ outcome: 'terminal' });
  assert.equal(context.oscillators.length, sourcesAfterFirstFinish,
    'finish must schedule exactly one ending');
  assert.equal(audio.debugState().disposed, false);
  assert.ok(audio.debugState().activeSources > 0);
  clock.advance(999);
  assert.equal(audio.debugState().disposed, false);
  clock.advance(1);
  await Promise.resolve();
  assert.equal(audio.debugState().disposed, true);
  assert.equal(audio.debugState().activeSources, 0);
  assert.equal(clock.size(), 0);
});

test('audio failure is silent and notices at most once', async () => {
  const notices = [];
  const audio = createGameAudio({
    audioContextFactory: () => { throw new Error('denied'); },
    preferences,
    onNotice: (message) => notices.push(message),
  });
  await assert.doesNotReject(audio.start({ arrangement: 'yard' }));
  assert.doesNotThrow(() => audio.playEffect('placement'));
  assert.doesNotThrow(() => audio.setIntensity({ height: 1, tidePressure: 1 }));
  assert.equal(notices.length, 1);
});
```

- [ ] **Step 3: Run audio tests and verify the module is absent**

Run: `node --test Tests/games/game-audio.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4: Implement one original motif and two arrangements**

```js
export const KINNOKI_MOTIF = Object.freeze([0, 7, 11, 14, 9, 16]);
const ARRANGEMENTS = Object.freeze({
  yard: { tempo: 76, rootMidi: 45, waveform: 'sine' },
  stack: { tempo: 118, rootMidi: 50, waveform: 'triangle' },
});
const EFFECT_RATE_MS = Object.freeze({
  move: 50, rotate: 70, placement: 90, dispatch: 120,
  'tide-warning': 250, 'tide-shift': 180, invalid: 180,
  completion: 300, terminal: 300,
});
```

Schedule notes by converting MIDI to hertz with `440 * 2 ** ((midi - 69) / 12)`. Yard uses slow sine melody plus a quiet fifth/drone. Stack uses the same interval sequence at the faster tempo; intensity thresholds 0.34, 0.58, and 0.78 enable bass, harmony, and short noise-free oscillator percussion. Do not import or fetch any audio asset.

- [ ] **Step 5: Implement gesture start, lookahead scheduling, preferences, effects, and cleanup**

Add the factory state, silent fallback, context creation, and lookahead scheduler:

```js
const clampVolume = (value, fallback) => Number.isFinite(value)
  ? Math.min(1, Math.max(0, value)) : fallback;
const midiHz = (midi) => 440 * (2 ** ((midi - 69) / 12));

export function createGameAudio({
  audioContextFactory = () => {
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Context) throw new Error('Web Audio unavailable');
    return new Context();
  },
  preferences: initialPreferences,
  onNotice = () => {},
  monotonicNow = () => globalThis.performance?.now?.() ?? Date.now(),
  setIntervalFn = globalThis.setInterval.bind(globalThis),
  clearIntervalFn = globalThis.clearInterval.bind(globalThis),
  setTimeoutFn = globalThis.setTimeout.bind(globalThis),
  clearTimeoutFn = globalThis.clearTimeout.bind(globalThis),
} = {}) {
  let preferences = { musicEnabled: initialPreferences?.musicEnabled !== false,
    musicVolume: clampVolume(initialPreferences?.musicVolume, 0.35),
    effectsEnabled: initialPreferences?.effectsEnabled !== false,
    effectsVolume: clampVolume(initialPreferences?.effectsVolume, 0.50) };
  let context = null;
  let arrangement = null;
  let musicMaster = null;
  let effectsMaster = null;
  let scheduler = null;
  let finishTimer = null;
  let started = false;
  let disposed = false;
  let silent = false;
  let noticeShown = false;
  let finishing = false;
  let nextNoteIndex = 0;
  let nextNoteTime = 0;
  let intensity = { height: 0, tidePressure: 0 };
  let layerGains = { bass: 0, harmony: 0, percussion: 0 };
  const sources = new Set();
  const effectVoices = [];
  const timeouts = new Set();
  const lastEffectAt = new Map();

  const silence = () => {
    silent = true;
    if (!noticeShown) {
      noticeShown = true;
      onNotice('Audio is unavailable; play continues in silence.');
    }
  };
  const clearScheduler = () => {
    if (scheduler !== null) clearIntervalFn(scheduler);
    scheduler = null;
  };
  const trackTimeout = (callback, delay) => {
    const handle = setTimeoutFn(() => { timeouts.delete(handle); callback(); }, delay);
    timeouts.add(handle);
    return handle;
  };
  const scheduleTone = ({
    frequency, at, duration, destination, waveform = 'sine', amplitude = 0.12,
  }) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const voice = { oscillator, gain };
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(amplitude, at + 0.01);
    gain.gain.linearRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain).connect(destination);
    oscillator.onended = () => {
      sources.delete(oscillator);
      const effectIndex = effectVoices.indexOf(voice);
      if (effectIndex >= 0) effectVoices.splice(effectIndex, 1);
      try { oscillator.disconnect(); gain.disconnect(); } catch {}
    };
    oscillator.start(at); oscillator.stop(at + duration + 0.02);
    sources.add(oscillator);
    return voice;
  };
  const scheduleMusic = () => {
    if (!context || silent || disposed || !arrangement) return;
    const config = ARRANGEMENTS[arrangement];
    const beat = 60 / config.tempo;
    while (nextNoteTime < context.currentTime + 0.25) {
      const interval = KINNOKI_MOTIF[nextNoteIndex % KINNOKI_MOTIF.length];
      scheduleTone({ frequency: midiHz(config.rootMidi + interval), at: nextNoteTime,
        duration: beat * 0.8, destination: musicMaster, waveform: config.waveform });
      if (arrangement === 'yard') {
        scheduleTone({ frequency: midiHz(config.rootMidi - 5), at: nextNoteTime,
          duration: beat * 1.8, destination: musicMaster, waveform: 'sine', amplitude: 0.035 });
      } else {
        if (layerGains.bass > 0) scheduleTone({
          frequency: midiHz(config.rootMidi - 12), at: nextNoteTime,
          duration: beat * 0.9, destination: musicMaster, waveform: 'triangle',
          amplitude: layerGains.bass,
        });
        if (layerGains.harmony > 0) scheduleTone({
          frequency: midiHz(config.rootMidi + interval + 7), at: nextNoteTime,
          duration: beat * 0.7, destination: musicMaster, waveform: 'sine',
          amplitude: layerGains.harmony,
        });
        if (layerGains.percussion > 0) scheduleTone({
          frequency: midiHz(config.rootMidi - 24), at: nextNoteTime,
          duration: 0.045, destination: musicMaster, waveform: 'square',
          amplitude: layerGains.percussion,
        });
      }
      nextNoteIndex += 1;
      nextNoteTime += beat;
    }
  };
  const beginScheduler = () => {
    clearScheduler();
    scheduleMusic();
    scheduler = setIntervalFn(scheduleMusic, 100);
  };

  const start = async ({ arrangement: requested }) => {
    if (disposed || started) return;
    try {
      const config = ARRANGEMENTS[requested];
      if (!config) throw new TypeError('Unknown game-audio arrangement');
      context = audioContextFactory();
      musicMaster = context.createGain(); effectsMaster = context.createGain();
      musicMaster.connect(context.destination); effectsMaster.connect(context.destination);
      arrangement = requested; started = true;
      musicMaster.gain.value = preferences.musicEnabled ? preferences.musicVolume : 0;
      effectsMaster.gain.value = preferences.effectsEnabled ? preferences.effectsVolume : 0;
      await context.resume();
      nextNoteTime = context.currentTime + 0.05;
      beginScheduler();
    } catch { silence(); }
  };
```

- [ ] **Step 6: Implement separate preferences, intensity, and bounded effects**

Continue inside `createGameAudio` with the public preference/effect behavior. `scheduleEffect` is private so `finish` can bypass ordinary rate limiting exactly once:

```js
  const setPreferences = (value) => {
    preferences = { musicEnabled: typeof value?.musicEnabled === 'boolean'
      ? value.musicEnabled : preferences.musicEnabled,
    musicVolume: clampVolume(value?.musicVolume, preferences.musicVolume),
    effectsEnabled: typeof value?.effectsEnabled === 'boolean'
      ? value.effectsEnabled : preferences.effectsEnabled,
    effectsVolume: clampVolume(value?.effectsVolume, preferences.effectsVolume) };
    if (musicMaster) musicMaster.gain.value = preferences.musicEnabled ? preferences.musicVolume : 0;
    if (effectsMaster) effectsMaster.gain.value = preferences.effectsEnabled ? preferences.effectsVolume : 0;
  };
  const setIntensity = (value) => {
    intensity = { height: clampVolume(value?.height, 0),
      tidePressure: clampVolume(value?.tidePressure, 0) };
    const pressure = Math.max(intensity.height, intensity.tidePressure);
    layerGains = { bass: pressure >= 0.34 ? 0.18 : 0,
      harmony: pressure >= 0.58 ? 0.14 : 0,
      percussion: pressure >= 0.78 ? 0.10 : 0 };
  };
  const scheduleEffect = (name, bypassRateLimit = false) => {
    if (!context || silent || disposed || !preferences.effectsEnabled) return false;
    const now = monotonicNow();
    if (!bypassRateLimit && now - (lastEffectAt.get(name) ?? -Infinity) < EFFECT_RATE_MS[name]) {
      return false;
    }
    lastEffectAt.set(name, now);
    while (effectVoices.length >= 8) {
      const oldest = effectVoices.shift();
      try { oldest.oscillator.stop(context.currentTime); oldest.oscillator.disconnect(); } catch {}
      sources.delete(oldest.oscillator);
    }
    const semitone = { move: 0, rotate: 3, placement: -5, dispatch: 12,
      'tide-warning': -2, 'tide-shift': -7, invalid: -12,
      completion: 16, terminal: -16 }[name];
    if (semitone === undefined) return false;
    const voice = scheduleTone({ frequency: midiHz(60 + semitone),
      at: context.currentTime, duration: name === 'completion' ? 0.65 : 0.18,
      destination: effectsMaster, waveform: name === 'terminal' ? 'sawtooth' : 'sine' });
    effectVoices.push(voice);
    return true;
  };
  const playEffect = (name) => {
    try { return scheduleEffect(name, false); } catch { silence(); return false; }
  };
```

- [ ] **Step 7: Implement pause, exactly-once finish, disposal, and debug state**

Finish the factory with idempotent cleanup. Normal controllers call `finish` for engine `completed`/`terminal` and do not call `playEffect` for those two events:

```js
  const cancelFinish = () => {
    if (finishTimer !== null) clearTimeoutFn(finishTimer);
    timeouts.delete(finishTimer); finishTimer = null;
  };
  const stopSources = () => {
    for (const source of sources) {
      try { source.stop(context?.currentTime ?? 0); source.disconnect(); } catch {}
    }
    sources.clear(); effectVoices.length = 0;
  };
  const pause = async () => {
    cancelFinish(); clearScheduler();
    try { await context?.suspend?.(); } catch { silence(); }
  };
  const resume = async () => {
    if (!context || disposed || silent) return;
    try {
      await context.resume();
      nextNoteTime = context.currentTime + 0.05;
      beginScheduler();
    } catch { silence(); }
  };
  const stop = () => {
    cancelFinish(); clearScheduler();
    for (const handle of timeouts) clearTimeoutFn(handle);
    timeouts.clear(); stopSources();
  };
  const dispose = async () => {
    if (disposed) return;
    disposed = true; stop();
    try { musicMaster?.disconnect(); effectsMaster?.disconnect(); await context?.close?.(); }
    catch { silence(); }
  };
  const finish = ({ outcome }) => {
    if (finishing || disposed) return false;
    finishing = true; clearScheduler();
    try {
      scheduleEffect(outcome === 'completion' ? 'completion' : 'terminal', true);
      const now = context?.currentTime ?? 0;
      for (const master of [musicMaster, effectsMaster]) {
        master?.gain.cancelScheduledValues(now);
        master?.gain.setValueAtTime(master.gain.value, now);
        master?.gain.linearRampToValueAtTime(0, now + 0.9);
      }
      finishTimer = trackTimeout(() => { finishTimer = null; void dispose(); }, 1000);
    } catch { silence(); void dispose(); }
    return true;
  };
  const debugState = () => Object.freeze({ started, arrangement,
    tempo: arrangement ? ARRANGEMENTS[arrangement].tempo : null,
    contextState: context?.state ?? null, schedulerActive: scheduler !== null,
    activeSources: sources.size, activeEffectVoices: effectVoices.length,
    musicGain: musicMaster?.gain.value ?? 0, effectsGain: effectsMaster?.gain.value ?? 0,
    layerGains: { ...layerGains }, intensity: { ...intensity }, nextNoteIndex,
    nextNoteTime, noticeShown, disposed });
  return { start, resume, pause, stop, dispose, finish, setPreferences,
    setIntensity, playEffect, debugState };
}
```

- [ ] **Step 8: Run audio tests**

Run: `node --test Tests/games/game-audio.test.mjs`
Expected: PASS for gesture gating, motif sharing, tempo/arrangements, adaptive layers, cadences, separate channels, volume clamps, rate limiting, pause/resume, disposal, and silent fallback.

- [ ] **Step 9: Commit adaptive audio**

```bash
git add Resources/games/game-audio.js Tests/games/game-audio.test.mjs
git commit -m "feat(games): add adaptive arcade audio"
```

---

### Task 9A: Explicit-start lifecycle and deterministic frames

**Files:**
- Modify: `Resources/games/controller-common.js:6,54-69,72-269`
- Modify: `Tests/games/dom-fixture.mjs:140-198`
- Create: `Tests/games/game-lifecycle.test.mjs`
- Regression test: `Tests/games/controllers.test.mjs`
- Regression test: `Tests/games/final-review.test.mjs`

**Interfaces:**
- Consumes: an existing root, injected monotonic clock, controller callbacks, and browser event/frame functions.
- Produces: `createGameLifecycle` from the shared contract and frame controls in the DOM fixture. Existing `createSession` behavior remains unchanged.

- [ ] **Step 1: Extend the DOM fixture with deterministic animation frames**

Add frame storage alongside existing interval storage:

```js
const frames = new Map();
let nextFrame = 1;

const window = {
  document, localStorage, location, confirm: () => confirm,
  requestAnimationFrame(callback) {
    const id = nextFrame;
    nextFrame += 1;
    frames.set(id, callback);
    return id;
  },
  cancelAnimationFrame(id) { frames.delete(id); },
  addEventListener(type, listener) {
    windowListeners.set(type, [...(windowListeners.get(type) ?? []), listener]);
  },
  removeEventListener(type, listener) {
    windowListeners.set(type,
      (windowListeners.get(type) ?? []).filter((value) => value !== listener));
  },
  dispatchEvent(event) {
    for (const listener of windowListeners.get(event.type) ?? []) listener(event);
  },
  listenerCount(type) { return (windowListeners.get(type) ?? []).length; },
  setInterval(callback) {
    const id = nextInterval; nextInterval += 1; intervals.set(id, callback); return id;
  },
  clearInterval(id) { intervals.delete(id); },
};
```

Expose `activeFrameCount()` and `tickFrames(timestamp)`. `tickFrames` copies and clears the current queue before invoking callbacks so recursive scheduling lands in the next explicit frame. Include `requestAnimationFrame` and `cancelAnimationFrame` in `installDOM` save/restore keys.

- [ ] **Step 2: Write failing pre-play, pause, finish, and cleanup tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, FixtureEvent, installDOM } from './dom-fixture.mjs';

test('explicit lifecycle is inert until Start and visible return requires Resume', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  let now = 100; const calls = [];
  try {
    const { createGameLifecycle } = await import('../../Resources/games/controller-common.js');
    const lifecycle = createGameLifecycle({
      root: fixture.root,
      initialElapsedMs: 500,
      monotonicNow: () => now,
      onActivate: (kind, api) => {
        calls.push(kind);
        api.listenActive(fixture.document, 'keydown', () => calls.push('key'));
        api.requestActiveFrame(() => calls.push('frame'));
      },
      onPause: (reason) => calls.push(reason),
      onSnapshot: () => calls.push('snapshot'),
      onDispose: () => calls.push('disposed'),
    });
    assert.equal(lifecycle.state, 'preview');
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
    await lifecycle.start('start');
    assert.equal(fixture.document.listenerCount('keydown'), 1);
    assert.equal(fixture.activeFrameCount(), 1);
    now = 1100;
    fixture.document.visibilityState = 'hidden';
    fixture.document.dispatchEvent(new FixtureEvent('visibilitychange'));
    assert.equal(lifecycle.state, 'paused');
    assert.equal(lifecycle.elapsed(), 1500);
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
    fixture.document.visibilityState = 'visible';
    fixture.document.dispatchEvent(new FixtureEvent('visibilitychange'));
    assert.equal(lifecycle.state, 'paused');
    await lifecycle.start('resume');
    assert.equal(calls.includes('resume'), true);
    fixture.window.dispatchEvent(new FixtureEvent('pagehide'));
    assert.equal(lifecycle.state, 'paused');
    assert.equal(calls.at(-1), 'hidden');
  } finally { restore(); }
});

test('finish and dispose are idempotent', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createGameLifecycle } = await import('../../Resources/games/controller-common.js');
    let finishes = 0;
    const lifecycle = createGameLifecycle({
      root: fixture.root, initialElapsedMs: 0, monotonicNow: () => 0,
      onActivate() {}, onPause() {}, onSnapshot() {},
      onDispose: () => { finishes += 1; },
    });
    await lifecycle.start('start');
    assert.equal(lifecycle.finish(), true);
    assert.equal(lifecycle.finish(), false);
    lifecycle.dispose(); lifecycle.dispose();
    assert.equal(finishes, 1);
  } finally { restore(); }
});

test('fatal failure snapshots once, clears active resources, and reports once', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createGameLifecycle } = await import('../../Resources/games/controller-common.js');
    const errors = []; let snapshots = 0;
    const lifecycle = createGameLifecycle({
      root: fixture.root, initialElapsedMs: 0, monotonicNow: () => 50,
      onActivate: (_kind, api) => {
        api.listenActive(fixture.document, 'keydown', () => {});
        api.requestActiveFrame(() => {});
      },
      onPause() {},
      onSnapshot: () => { snapshots += 1; },
      onError: (error) => errors.push(error.message),
      onDispose() {},
    });
    await lifecycle.start('start');
    assert.equal(lifecycle.fail(new Error('bad state')), true);
    assert.equal(lifecycle.fail(new Error('duplicate')), false);
    assert.equal(lifecycle.state, 'error');
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
    assert.equal(snapshots, 1);
    assert.deepEqual(errors, ['bad state']);
  } finally { restore(); }
});
```

- [ ] **Step 3: Run lifecycle and legacy controller tests to verify the red state**

Run: `node --test Tests/games/game-lifecycle.test.mjs Tests/games/controllers.test.mjs Tests/games/final-review.test.mjs`
Expected: lifecycle tests FAIL on the missing export; legacy controller tests remain green.

- [ ] **Step 4: Implement the lifecycle state machine without changing `createSession` defaults**

Append this export after `createSession`. It keeps the legacy session path intact and installs visibility/pagehide listeners only inside an active epoch:

```js
export function createGameLifecycle({
  root,
  initialElapsedMs = 0,
  monotonicNow = () => globalThis.performance?.now?.() ?? Date.now(),
  onActivate = () => {},
  onPause = () => {},
  onSnapshot = () => {},
  onError = () => {},
  onDispose = () => {},
}) {
  activeSessions.get(root)?.dispose();

  const document = root.ownerDocument ?? globalThis.document;
  const window = document?.defaultView ?? globalThis.window;
  const passiveCleanups = new Set();
  const activeCleanups = new Set();
  let currentState = 'preview';
  let elapsedBeforeActivation = Math.max(0, Math.trunc(initialElapsedMs));
  let activatedAt = null;
  let disposed = false;
  let didDisposeCallback = false;
  let api;

  const elapsed = () => {
    const activeDelta = currentState === 'active' && activatedAt !== null
      ? Math.max(0, monotonicNow() - activatedAt)
      : 0;
    return Math.max(0, Math.trunc(elapsedBeforeActivation + activeDelta));
  };

  const clear = (cleanups) => {
    const pending = [...cleanups];
    cleanups.clear();
    for (const cleanup of pending.reverse()) cleanup();
  };
  const clearActive = () => clear(activeCleanups);

  const listenActive = (target, type, listener, options) => {
    if (currentState !== 'active' || disposed) return null;
    target.addEventListener(type, listener, options);
    const cleanup = () => target.removeEventListener(type, listener, options);
    activeCleanups.add(cleanup);
    return listener;
  };

  const requestActiveFrame = (callback) => {
    if (currentState !== 'active' || disposed) return null;
    let cleanup;
    const handle = globalThis.requestAnimationFrame((timestamp) => {
      activeCleanups.delete(cleanup);
      if (currentState === 'active' && !disposed) callback(timestamp);
    });
    cleanup = () => globalThis.cancelAnimationFrame(handle);
    activeCleanups.add(cleanup);
    return handle;
  };

  const snapshotActive = () => {
    if (currentState !== 'active' || activatedAt === null) return false;
    elapsedBeforeActivation = elapsed();
    activatedAt = null;
    onSnapshot(elapsedBeforeActivation);
    return true;
  };

  const pause = (reason = 'user') => {
    if (currentState !== 'active' || disposed) return false;
    snapshotActive();
    clearActive();
    currentState = 'paused';
    onPause(reason, api);
    return true;
  };

  const installActiveLifecycleListeners = () => {
    listenActive(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') pause('hidden');
    });
    listenActive(window, 'pagehide', () => pause('hidden'));
  };

  const start = async (kind) => {
    const valid = (currentState === 'preview' && (kind === 'start' || kind === 'continue'))
      || (currentState === 'paused' && kind === 'resume');
    if (!valid || disposed) return false;
    currentState = 'active';
    activatedAt = monotonicNow();
    installActiveLifecycleListeners();
    await onActivate(kind, api);
    return currentState === 'active';
  };

  const settle = (nextState) => {
    if (disposed || currentState === 'terminal' || currentState === 'error') return false;
    snapshotActive();
    clearActive();
    currentState = nextState;
    return true;
  };

  const finish = () => settle('terminal');
  const fail = (error) => {
    if (!settle('error')) return false;
    onError(error, api);
    return true;
  };

  const dispose = () => {
    if (disposed) return false;
    disposed = true;
    clearActive();
    clear(passiveCleanups);
    currentState = 'disposed';
    if (!didDisposeCallback) {
      didDisposeCallback = true;
      onDispose(api);
    }
    return true;
  };

  api = {
    get state() { return currentState; },
    elapsed,
    start,
    pause,
    finish,
    fail,
    dispose,
    listenActive,
    requestActiveFrame,
  };
  passiveCleanups.add(() => {
    if (activeSessions.get(root) === api) activeSessions.delete(root);
  });
  activeSessions.set(root, api);
  return api;
}
```

`pause` snapshots before clearing resources, visible `visibilitychange` is inert, and every active frame/listener is scoped to exactly one activation epoch.

- [ ] **Step 5: Run the lifecycle gate**

Run: `node --test Tests/games/game-lifecycle.test.mjs Tests/games/controllers.test.mjs Tests/games/final-review.test.mjs`
Expected: PASS for pre-play, explicit activation, hidden pause, visible inertness, finish/fail/dispose idempotence, and legacy controllers.

- [ ] **Step 6: Commit the lifecycle gate**

```bash
git add Resources/games/controller-common.js Tests/games/dom-fixture.mjs \
  Tests/games/game-lifecycle.test.mjs
git commit -m "feat(games): add explicit game lifecycle controller"
```

---

### Task 9B: Cargo announcements, audio controls, and recoverable errors

**Files:**
- Modify: `Resources/games/controller-common.js`
- Create: `Tests/games/controller-common-cargo.test.mjs`

**Interfaces:**
- Consumes: sanitized Store v2 audio preferences, engine events, and semantic DOM helpers.
- Produces: `createEventAnnouncer`, `createAudioControls`, generalized `renderGameError`, and mode-aware `renderReplacementKept`.

- [ ] **Step 1: Write failing announcer, audio-control, and recovery tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, installDOM } from './dom-fixture.mjs';

test('announcer prioritizes meaningful events and silences gravity', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createEventAnnouncer } = await import('../../Resources/games/controller-common.js');
    let now = 100;
    const region = fixture.document.createElement('p');
    const announcer = createEventAnnouncer({
      region, monotonicNow: () => now, minimumGapMs: 180,
    });
    assert.equal(announcer.announce({
      type: 'moved', source: 'gravity', row: 4, column: 5,
    }), false);
    assert.equal(region.textContent, '');
    announcer.announce({
      type: 'tide-warning', direction: 'left', placementsRemaining: 2,
    });
    assert.equal(region.textContent, 'Left tide in 2 placements.');
    announcer.announce({ type: 'invalid', action: 'move', reason: 'Blocked.' });
    const first = region.textContent;
    now += 20;
    assert.equal(announcer.announce({
      type: 'invalid', action: 'move', reason: 'Blocked.',
    }), false);
    assert.equal(region.textContent, first);
    now += 200;
    announcer.announce({ type: 'terminal', reason: 'no-placement' });
    assert.equal(region.textContent, 'Run ended. No legal cargo placement remains.');
    announcer.announce({ type: 'terminal', reason: 'crane-line' });
    assert.equal(region.textContent, 'Run ended. Cargo reached the crane line.');
    announcer.announce({ type: 'terminal', reason: 'spawn-blocked' });
    assert.equal(region.textContent, 'Run ended. The next cargo could not enter the dock.');
  } finally { restore(); }
});

test('music and effects expose independent mute and normalized range controls', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createAudioControls } = await import('../../Resources/games/controller-common.js');
    const updates = [];
    const controls = createAudioControls({
      document: fixture.document,
      preferences: {
        musicEnabled: true, musicVolume: 0.35,
        effectsEnabled: true, effectsVolume: 0.50,
      },
      onChange: (value) => updates.push(value),
    });
    fixture.root.append(controls.element);
    const musicRange = fixture.root.querySelector('[data-audio-music-volume]');
    const effectsRange = fixture.root.querySelector('[data-audio-effects-volume]');
    assert.equal(musicRange.getAttribute('type'), 'range');
    assert.equal(musicRange.getAttribute('aria-label'), 'Music volume');
    assert.equal(effectsRange.getAttribute('aria-label'), 'Effects volume');
    musicRange.value = '0.8'; musicRange.dispatchEvent(new Event('input'));
    assert.equal(updates.at(-1).musicVolume, 0.8);
    assert.equal(updates.at(-1).effectsVolume, 0.5);
    fixture.root.querySelector('[data-audio-effects-toggle]').click();
    assert.equal(updates.at(-1).effectsEnabled, false);
    assert.equal(updates.at(-1).musicEnabled, true);
  } finally { restore(); }
});

test('fatal recovery and saved Yard links preserve a usable destination', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderGameError, renderReplacementKept } = await import(
      '../../Resources/games/controller-common.js'
    );
    renderGameError(fixture.root, {
      title: 'Cargo state unavailable',
      message: 'The saved run could not be validated.',
      newGameHref: '/games/kinnoki-yard?mode=contracts&difficulty=easy',
    });
    assert.equal(fixture.root.querySelector('[role="alert"] h1').textContent,
      'Cargo state unavailable');
    assert.equal(fixture.root.querySelector('.btn-gold').getAttribute('href'),
      '/games/kinnoki-yard?mode=contracts&difficulty=easy');
    assert.equal(fixture.root.querySelector('.back-link').getAttribute('href'), '/games');

    renderReplacementKept(fixture.root, 'kinnoki-yard', 'hard', 'endless');
    assert.equal(fixture.root.querySelector('.btn-gold').getAttribute('href'),
      '/games/kinnoki-yard?mode=endless&difficulty=hard&continue=1');
    assert.equal(fixture.root.querySelector('.btn-gold').textContent,
      'Continue Endless Yard · Hard');
  } finally { restore(); }
});
```

- [ ] **Step 2: Implement event-scoped announcements**

Append the formatter and announcer. Only repeated player movement/invalid messages are throttled; priority events always replace the live-region text immediately:

```js
const eventAnnouncement = (event) => {
  switch (event?.type) {
    case 'started': return 'Run started.';
    case 'paused': return 'Run paused.';
    case 'resumed': return 'Run resumed.';
    case 'assisted': return 'Assistance enabled. This run is ineligible for records.';
    case 'invalid': return event.reason || 'That action is unavailable.';
    case 'error': return event.message || 'The game could not continue.';
    case 'moved': return `Cargo moved to row ${event.row + 1}, column ${event.column + 1}.`;
    case 'rotated': return 'Cargo rotated.';
    case 'placed': return 'Cargo placed.';
    case 'repositioned': return 'Cargo repositioned.';
    case 'selected': return 'Cargo selected.';
    case 'spawned': return 'Next cargo ready.';
    case 'tide-warning':
      return `${titleCase(event.direction)} tide in ${event.placementsRemaining} placements.`;
    case 'tide-shift':
      return `${titleCase(event.direction)} tide shifted ${event.movedComponents} cargo groups.`;
    case 'dispatch': return `Manifest dispatched. Combo ${event.combo}.`;
    case 'combo-reset': return 'Manifest combo reset.';
    case 'undone': return 'Last placement undone.';
    case 'hint': return 'Hint ready.';
    case 'hint-dead-end': return event.message || 'No valid completion remains.';
    case 'completed': return `Contract completed in ${event.moves} moves.`;
    case 'terminal':
      if (event.reason === 'crane-line') return 'Run ended. Cargo reached the crane line.';
      if (event.reason === 'spawn-blocked') {
        return 'Run ended. The next cargo could not enter the dock.';
      }
      return 'Run ended. No legal cargo placement remains.';
    default: return null;
  }
};

export function createEventAnnouncer({
  region,
  monotonicNow = () => globalThis.performance?.now?.() ?? Date.now(),
  minimumGapMs = 180,
}) {
  let disposed = false;
  let lastLimitedKey = null;
  let lastLimitedAt = Number.NEGATIVE_INFINITY;

  const announce = (event) => {
    if (disposed || !event || (event.type === 'moved' && event.source === 'gravity')) {
      return false;
    }
    const message = eventAnnouncement(event);
    if (!message) return false;
    const limited = event.type === 'moved' || event.type === 'invalid';
    const key = `${event.type}:${event.action ?? event.reason ?? ''}`;
    const now = monotonicNow();
    if (limited && key === lastLimitedKey && now - lastLimitedAt < minimumGapMs) {
      return false;
    }
    if (limited) {
      lastLimitedKey = key;
      lastLimitedAt = now;
    }
    region.textContent = message;
    return true;
  };

  return {
    announce,
    dispose() {
      if (disposed) return false;
      disposed = true;
      lastLimitedKey = null;
      return true;
    },
  };
}
```

- [ ] **Step 3: Add independent sanitized audio controls**

Add `sanitizeAudioPreferences` to the existing `./core.js` import, then append the control factory:

```js
import {
  chooseFreshDefinition, completeRun, deriveSeed, historyKey, markAssisted,
  sanitizeAudioPreferences, saveGameStore, startRun,
} from './core.js';

export function createAudioControls({
  document = globalThis.document,
  preferences,
  onChange = () => {},
}) {
  let current = sanitizeAudioPreferences(preferences);
  let disposed = false;
  const element = document.createElement('fieldset');
  element.className = 'game-audio-controls';
  const legend = document.createElement('legend');
  legend.textContent = 'Audio';
  element.append(legend);

  const makeChannel = (name, key) => {
    const row = document.createElement('div');
    row.className = 'game-audio-channel';
    const label = document.createElement('label');
    const labelText = document.createElement('span');
    labelText.textContent = name;
    const range = document.createElement('input');
    range.setAttribute('type', 'range');
    range.setAttribute('min', '0');
    range.setAttribute('max', '1');
    range.setAttribute('step', '0.05');
    range.setAttribute('aria-label', `${name} volume`);
    range.setAttribute(`data-audio-${key}-volume`, '');
    label.append(labelText, range);
    const toggle = document.createElement('button');
    toggle.setAttribute('type', 'button');
    toggle.setAttribute(`data-audio-${key}-toggle`, '');
    row.append(label, toggle);
    element.append(row);
    return { range, toggle };
  };

  const music = makeChannel('Music', 'music');
  const effects = makeChannel('Effects', 'effects');
  const paint = () => {
    music.range.value = String(current.musicVolume);
    effects.range.value = String(current.effectsVolume);
    for (const [control, enabled, name] of [
      [music.toggle, current.musicEnabled, 'music'],
      [effects.toggle, current.effectsEnabled, 'effects'],
    ]) {
      control.setAttribute('aria-pressed', String(!enabled));
      control.textContent = enabled ? `Mute ${name}` : `Unmute ${name}`;
    }
  };
  const commit = (patch) => {
    if (disposed) return false;
    current = sanitizeAudioPreferences({ ...current, ...patch });
    paint();
    onChange({ ...current });
    return true;
  };
  const onMusicToggle = () => commit({ musicEnabled: !current.musicEnabled });
  const onEffectsToggle = () => commit({ effectsEnabled: !current.effectsEnabled });
  const onMusicInput = () => commit({ musicVolume: Number(music.range.value) });
  const onEffectsInput = () => commit({ effectsVolume: Number(effects.range.value) });
  music.toggle.addEventListener('click', onMusicToggle);
  effects.toggle.addEventListener('click', onEffectsToggle);
  music.range.addEventListener('input', onMusicInput);
  effects.range.addEventListener('input', onEffectsInput);
  paint();

  return {
    element,
    setPreferences(value) {
      if (disposed) return false;
      current = sanitizeAudioPreferences(value);
      paint();
      return true;
    },
    dispose() {
      if (disposed) return false;
      disposed = true;
      music.toggle.removeEventListener('click', onMusicToggle);
      effects.toggle.removeEventListener('click', onEffectsToggle);
      music.range.removeEventListener('input', onMusicInput);
      effects.range.removeEventListener('input', onEffectsInput);
      return true;
    },
  };
}
```

The controls only update preferences. They never construct or resume an audio context; controllers pass changes to a live audio instance only after the explicit lifecycle start.

- [ ] **Step 4: Generalize fatal and saved-run recovery surfaces**

Replace the two existing render helpers with these backwards-compatible signatures:

```js
export function renderGameError(root, {
  title = 'Game paused',
  message = 'This game could not continue.',
  newGameHref = globalThis.location?.pathname ?? '/games',
} = {}) {
  root.replaceChildren(element('section', { class: 'game-error', role: 'alert' },
    element('h1', { text: title }),
    element('p', { text: message }),
    element('a', {
      class: 'btn btn-gold', href: newGameHref, text: 'Start a New Game',
    }),
    element('a', { class: 'back-link', href: '/games', text: 'Back to Games' })));
}

export function renderReplacementKept(root, game, existingDifficulty, mode = null) {
  const isYard = game === 'kinnoki-yard'
    && (mode === 'contracts' || mode === 'endless');
  const difficulty = titleCase(existingDifficulty);
  const href = isYard
    ? `/games/${game}?mode=${mode}&difficulty=${existingDifficulty}&continue=1`
    : `/games/${game}?difficulty=${existingDifficulty}&continue=1`;
  const label = isYard
    ? `Continue ${mode === 'endless' ? 'Endless Yard' : 'Contract'} · ${difficulty}`
    : `Continue ${difficulty}`;
  root.replaceChildren(element('section', { class: 'game-error', role: 'status' },
    element('h1', { text: 'Saved puzzle kept' }),
    element('p', {
      text: `${difficulty} ${isYard ? 'run' : 'puzzle'} progress was kept on this device.`,
    }),
    element('a', { class: 'btn btn-gold', href, text: label }),
    element('a', { class: 'back-link', href: '/games', text: 'Back to Games' })));
}
```

- [ ] **Step 5: Run helper and original-controller regressions**

Run: `node --test Tests/games/controller-common-cargo.test.mjs Tests/games/game-lifecycle.test.mjs Tests/games/controllers.test.mjs Tests/games/controller-review.test.mjs Tests/games/controller-second-review.test.mjs Tests/games/final-review.test.mjs`
Expected: PASS; the cargo lifecycle is gesture-gated while all three existing puzzle controllers keep their previous automatic behavior.

- [ ] **Step 6: Commit shared cargo-controller helpers**

```bash
git add Resources/games/controller-common.js Tests/games/controller-common-cargo.test.mjs
git commit -m "feat(games): add cargo controller helpers"
```

---

### Task 10: Kinnoki Stack semantic controller

**Files:**
- Create: `Resources/games/kinnoki-stack-ui.js`
- Create: `Tests/games/kinnoki-stack-ui.test.mjs`

**Interfaces:**
- Consumes: Store v2, Stack engine, audio, geometry labels/patterns, and explicit lifecycle.
- Produces: `renderKinnokiStack(root, store, dependencies = {}) -> { dispose() }`. Dependencies are exactly `{ storage = safeLocalStorage(globalThis), wallNow = () => Date.now(), monotonicNow = () => performance.now(), seedFactory = defaultSeedFactory, audioFactory = createGameAudio, confirm = (message) => window.confirm(message), engine = defaultStackEngine }`; `defaultStackEngine` is a frozen adapter containing the public Stack functions. The default two-argument call is used by `ui.js`; tests inject deterministic values.

- [ ] **Step 1: Write failing inert-preview and semantic-grid tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, FixtureEvent, installDOM } from './dom-fixture.mjs';
import { createEmptyGameStore, STORE_KEYS } from '../../Resources/games/core.js';

test('Stack renders 216 non-tabbable cells and stays inert before Start', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  let audioStarts = 0;
  try {
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      audioFactory: () => ({
        start: async () => { audioStarts += 1; }, resume: async () => {},
        pause: async () => {}, stop: async () => {}, finish() {}, dispose: async () => {},
        setPreferences() {}, setIntensity() {}, playEffect() {},
      }),
    });
    const cells = fixture.root.querySelectorAll('[role="gridcell"]');
    assert.equal(cells.length, 216);
    assert.ok(cells.every((cell) => cell.getAttribute('tabindex') === '-1'));
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
    assert.equal(audioStarts, 0);
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    assert.equal(audioStarts, 1);
    assert.equal(fixture.document.listenerCount('keydown'), 1);
    assert.equal(fixture.activeFrameCount(), 1);
    controller.dispose();
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
  } finally { restore(); }
});
```

- [ ] **Step 2: Write failing controls, Describe Dock, assistance, terminal, and disposal tests**

```js
test('difficulty copy, previews, keyboard help, and audio ranges are explicit', async () => {
  for (const [difficulty, previewCount] of [['easy', 3], ['medium', 2], ['hard', 1]]) {
    const fixture = createDOMFixture({ search: `?difficulty=${difficulty}` });
    const restore = installDOM(fixture);
    try {
      const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
      const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore());
      assert.equal(fixture.root.querySelectorAll('[data-next-cargo]').length, previewCount);
      assert.match(fixture.root.querySelector('[data-difficulty-explanation]').textContent,
        new RegExp(difficulty, 'i'));
      assert.match(fixture.root.querySelector('[data-stack-keyboard-help]').textContent,
        /Left|Right|Space|Escape/);
      assert.equal(fixture.root.querySelector('[data-audio-music-volume]')
        .getAttribute('type'), 'range');
      assert.equal(fixture.root.querySelector('[data-audio-effects-volume]')
        .getAttribute('type'), 'range');
      controller.dispose();
    } finally { restore(); }
  }
});

test('Describe Dock is pure and Step Mode persists assistance before Advance', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore());
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    const before = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .runs['kinnoki-stack'].puzzle.play;
    fixture.root.querySelector('[data-describe-dock]').click();
    const after = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .runs['kinnoki-stack'].puzzle.play;
    assert.deepEqual(after, before);
    assert.ok(fixture.root.querySelector('[data-dock-description]').textContent.length > 20);
    fixture.root.querySelector('[data-step-mode]').click();
    const assisted = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .runs['kinnoki-stack'];
    assert.equal(assisted.assisted, true);
    assert.equal(fixture.root.querySelector('[data-advance-step]').hidden, false);
    fixture.document.dispatchEvent(new FixtureEvent('keydown', { key: 'Escape' }));
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.ok(fixture.root.querySelector('[data-resume-game]'));
    controller.dispose();
  } finally { restore(); }
});

test('terminal completion runs once and preserves the ending audio cadence', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  const calls = { finish: 0, stop: 0, dispose: 0 };
  try {
    const stack = await import('../../Resources/games/kinnoki-stack.js');
    const engine = {
      ...stack,
      reduceStack(state, action) {
        if (action.type !== 'hard-drop') return stack.reduceStack(state, action);
        return {
          state: {
            ...state, status: 'terminal', terminalReason: 'crane-line',
            active: null,
            score: 0, combo: 0, bestCombo: 0, dispatchedManifests: 0,
          },
          events: [{ type: 'terminal', reason: 'crane-line' }],
        };
      },
    };
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      engine,
      audioFactory: () => ({
        start: async () => {}, resume: async () => {}, pause: async () => {},
        stop: () => { calls.stop += 1; },
        finish: ({ outcome }) => { assert.equal(outcome, 'terminal'); calls.finish += 1; },
        dispose: () => { calls.dispose += 1; },
        setPreferences() {}, setIntensity() {}, playEffect() {},
      }),
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    fixture.root.querySelector('[data-stack-hard-drop]').click();
    fixture.root.querySelector('[data-stack-hard-drop]').click();
    assert.equal(calls.finish, 1);
    assert.equal(calls.stop, 0);
    assert.equal(fixture.root.querySelector('[data-complete-heading]').textContent,
      'Run complete');
    assert.equal(JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .stats.totalCompleted, 1);
  } finally { restore(); }
});

test('Restart returns to an unsaved preview that remains reload-safe', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  const silentAudio = () => ({
    start: async () => {}, resume: async () => {}, pause: async () => {},
    stop: async () => {}, finish() {}, dispose: async () => {},
    setPreferences() {}, setIntensity() {}, playEffect() {},
  });
  try {
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    assert.ok(JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .runs['kinnoki-stack']);
    fixture.root.querySelector('[data-restart]').click();
    await Promise.resolve(); await Promise.resolve();
    const saved = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(saved.runs['kinnoki-stack'], undefined);
    assert.ok(fixture.root.querySelector('[data-start-game]'));

    controller.dispose();
    const reloaded = await renderKinnokiStack(fixture.root, saved, {
      audioFactory: silentAudio,
    });
    assert.ok(fixture.root.querySelector('[data-start-game]'));
    reloaded.dispose();
  } finally { restore(); }
});

test('declining an active difficulty replacement leaves play and storage unchanged', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  const silentAudio = () => ({
    start: async () => {}, resume: async () => {}, pause: async () => {},
    stop: async () => {}, finish() {}, dispose: async () => {},
    setPreferences() {}, setIntensity() {}, playEffect() {},
  });
  try {
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      audioFactory: silentAudio,
      confirm: () => false,
    });
    fixture.root.querySelector('[data-start-game]').click();
    const hardDrop = fixture.root.querySelector('[data-stack-hard-drop]');
    for (let attempt = 0; attempt < 12 && hardDrop.disabled; attempt += 1) {
      await Promise.resolve();
    }
    assert.equal(hardDrop.disabled, false);
    const before = fixture.localStorage.getItem(STORE_KEYS.v2);
    const listeners = fixture.document.listenerCount('keydown');
    const frames = fixture.activeFrameCount();
    const difficulty = fixture.root.querySelector('[data-difficulty]');
    difficulty.value = 'medium';
    difficulty.dispatchEvent(new FixtureEvent('change'));
    await Promise.resolve();
    assert.equal(difficulty.value, 'easy');
    assert.equal(fixture.localStorage.getItem(STORE_KEYS.v2), before);
    assert.equal(fixture.document.listenerCount('keydown'), listeners);
    assert.equal(fixture.activeFrameCount(), frames);
    assert.equal(hardDrop.disabled, false);
    controller.dispose();
  } finally { restore(); }
});

test('validated assisted resume normalizes the generic run envelope before Continue', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const stack = await import('../../Resources/games/kinnoki-stack.js');
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const { startRun } = await import('../../Resources/games/core.js');
    const definition = stack.createStackDefinition({ difficulty: 'easy', seed: 77 });
    let play = stack.reduceStack(stack.createStackState(definition), { type: 'start' }).state;
    play = stack.reduceStack(play, { type: 'set-step-mode', enabled: true }).state;
    play = stack.reduceStack(play, { type: 'pause', reason: 'user' }).state;
    let store = startRun(createEmptyGameStore(), {
      game: 'kinnoki-stack', mode: 'default', difficulty: 'easy', seed: 77,
      signature: stack.stackDefinitionSignature(definition),
      puzzle: { definition, play }, now: 100,
    });
    assert.equal(store.runs['kinnoki-stack'].assisted, false);
    const controller = await renderKinnokiStack(fixture.root, store);
    store = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(store.runs['kinnoki-stack'].assisted, true);
    assert.equal(store.runs['kinnoki-stack'].puzzle.play.assisted, true);
    controller.dispose();
  } finally { restore(); }
});
```

- [ ] **Step 3: Run the Stack UI suite and verify the missing controller**

Run: `node --test Tests/games/kinnoki-stack-ui.test.mjs Tests/games/game-lifecycle.test.mjs Tests/games/kinnoki-stack-loop.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `kinnoki-stack-ui.js`.

- [ ] **Step 4: Create the controller module foundation**

Create `Resources/games/kinnoki-stack-ui.js` with these imports, constants, and the frozen default engine adapter:

~~~js
import {
  abandonRun, chooseFreshDefinition, completeRun, historyKey,
  markAssisted, saveGameStore, startRun,
} from './core.js';
import {
  CARGO_CATALOG, placedCells, rotationsFor,
} from './cargo-geometry.js';
import {
  advanceStackTime, createStackDefinition, createStackState, describeStack,
  prepareStackForContinue, reduceStack, stackCompletionPayload,
  stackDefinitionSignature, validateStackState,
} from './kinnoki-stack.js';
import { createGameAudio } from './game-audio.js';
import {
  createAudioControls, createEventAnnouncer, createGameLifecycle,
  defaultSeedFactory, element, formatElapsed, makeGameTerminal,
  renderGameError,
} from './controller-common.js';
import { safeLocalStorage } from './hub-ui.js';

const GAME = 'kinnoki-stack';
const MODE = 'default';
const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
const DIFFICULTY_COPY = Object.freeze({
  easy: 'Easy: slower, three previews, large manifests, no tides.',
  medium: 'Medium: moderate, two previews, mixed manifests and forecast tides.',
  hard: 'Hard: faster, one preview, irregular manifests and frequent tides.',
});
const CARGO_BY_ID = new Map(CARGO_CATALOG.map((cargo) => [cargo.id, cargo]));

export const defaultStackEngine = Object.freeze({
  advanceStackTime,
  createStackDefinition,
  createStackState,
  describeStack,
  prepareStackForContinue,
  reduceStack,
  stackCompletionPayload,
  stackDefinitionSignature,
  validateStackState,
});

const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const cellKey = (row, column) => row + ':' + column;
const cargoFor = (typeId) => CARGO_BY_ID.get(typeId) ?? {
  id: 'unknown', label: 'Unknown cargo', pattern: 'solid',
};
~~~

- [ ] **Step 5: Add the complete static shell builder**

Append this shell builder. It creates every persistent control once, creates exactly 216 non-tabbable cells, and returns stable references so later paints never replace focused controls:

~~~js
function buildStackShell(root, difficulty, audioControls) {
  const difficultySelect = element(
    'select',
    { 'data-difficulty': '', 'aria-label': 'Difficulty' },
    DIFFICULTIES.map((value) => element('option', {
      value, text: titleCase(value),
    })),
  );
  difficultySelect.value = difficulty;

  const timer = element('time', {
    'data-timer': '', 'aria-label': 'Elapsed active time', text: '0:00',
  });
  const score = element('span', { 'data-stack-score': '', text: '0' });
  const highScore = element('span', { 'data-stack-high-score': '', text: '—' });
  const assisted = element('span', {
    'data-assisted-status': '', text: 'Unassisted · eligible for records',
  });
  const manifest = element('span', { 'data-stack-manifest': '', text: 'Preparing manifest' });
  const tide = element('span', { 'data-stack-tide': '', text: 'No tides' });
  const status = element('span', { 'data-stack-status': '', text: 'Ready' });
  const notice = element('p', {
    class: 'game-storage-notice', role: 'status', 'aria-live': 'polite',
    hidden: true, text: '',
  });
  const eventRegion = element('p', {
    class: 'games-live-region', role: 'status', 'aria-live': 'polite', text: '',
  });

  const stat = (label, value) => element(
    'div', {}, element('dt', { text: label }), element('dd', {}, value),
  );
  const stats = element(
    'dl',
    { class: 'game-status-grid' },
    stat('Status', status),
    stat('Elapsed', timer),
    stat('Score', score),
    stat('High score', highScore),
    stat('Record status', assisted),
    stat('Cargo Manifest', manifest),
    stat('Tide forecast', tide),
  );

  const preview = element('ol', {
    class: 'stack-preview', 'data-stack-preview': '', 'aria-label': 'Next cargo',
  });
  const dockDescription = element('p', {
    'data-dock-description': '', role: 'status', text: '',
  });
  const difficultyExplanation = element('p', {
    'data-difficulty-explanation': '', text: DIFFICULTY_COPY[difficulty],
  });
  const keyboardHelp = element(
    'details',
    { 'data-stack-keyboard-help': '' },
    element('summary', { text: 'Keyboard controls' }),
    element('p', {
      text: 'Left/Right arrows move. Down soft-drops. Space hard-drops. '
        + 'Z or Up rotates. P or Escape pauses. Enter advances in Step Mode.',
    }),
  );

  const cells = [];
  const grid = element('div', {
    class: 'stack-grid', role: 'grid', 'aria-label': 'Kinnoki Stack cargo dock',
  });
  for (let row = 0; row < 18; row += 1) {
    const rowNode = element('div', { class: 'stack-row', role: 'row' });
    const rowCells = [];
    for (let column = 0; column < 12; column += 1) {
      const cell = element('div', {
        class: 'stack-cell',
        role: 'gridcell',
        tabindex: '-1',
        'data-stack-cell': cellKey(row, column),
        'aria-label': 'Empty dock cell',
      });
      rowCells.push(cell);
      rowNode.append(cell);
    }
    cells.push(rowCells);
    grid.append(rowNode);
  }
  const dock = element(
    'div',
    { class: 'stack-dock' },
    grid,
    element('div', {
      class: 'stack-crane-line', 'aria-hidden': 'true', text: 'Crane line',
    }),
  );

  const control = (label, dataAttribute) => element('button', {
    type: 'button', [dataAttribute]: '', text: label, disabled: true,
  });
  const controls = {
    left: control('Left', 'data-stack-left'),
    right: control('Right', 'data-stack-right'),
    rotate: control('Rotate', 'data-stack-rotate'),
    softDrop: control('Soft Drop', 'data-stack-soft-drop'),
    hardDrop: control('Hard Drop', 'data-stack-hard-drop'),
    pause: control('Pause', 'data-pause-game'),
    describe: control('Describe Dock', 'data-describe-dock'),
    stepMode: control('Step Mode', 'data-step-mode'),
    advance: control('Advance', 'data-advance-step'),
  };
  controls.advance.hidden = true;
  controls.describe.disabled = false;

  const start = element('button', {
    type: 'button', 'data-start-game': '', text: 'Start',
  });
  const continueGame = element('button', {
    type: 'button', 'data-continue-game': '', text: 'Continue Run', hidden: true,
  });
  const resume = element('button', {
    type: 'button', 'data-resume-game': '', text: 'Resume', hidden: true,
  });
  const restart = element('button', {
    type: 'button', 'data-restart': '', text: 'Restart',
  });
  const newRun = element('button', {
    type: 'button', 'data-new-run': '', text: 'New Run',
  });

  const shell = element(
    'section',
    { class: 'stack-game' },
    element(
      'div',
      { class: 'game-toolbar' },
      element('a', { href: '/games', class: 'back-link', text: '← Games' }),
      element('h1', { text: 'Kinnoki Stack' }),
      element('label', {}, element('span', { text: 'Difficulty' }), difficultySelect),
    ),
    notice,
    eventRegion,
    difficultyExplanation,
    stats,
    element(
      'div',
      { class: 'game-preplay' },
      start, continueGame, resume, restart, newRun,
    ),
    element('section', { 'aria-label': 'Next cargo' },
      element('h2', { text: 'Next cargo' }), preview),
    keyboardHelp,
    dock,
    element('div', { class: 'stack-controls' }, Object.values(controls)),
    dockDescription,
    audioControls.element,
  );
  root.replaceChildren(shell);

  return {
    shell, difficultySelect, timer, score, highScore, assisted, manifest,
    tide, status, notice, eventRegion, difficultyExplanation, preview,
    dockDescription, cells, controls, start, continueGame, resume, restart, newRun,
  };
}
~~~

- [ ] **Step 6: Add the complete non-destructive paint function**

Append this paint function. It updates text, classes, and attributes in place; it never rebuilds the control or grid nodes:

~~~js
const stackBestScore = (store, difficulty) => (
  store.stats?.games?.[GAME]?.modes?.default?.records?.score?.[difficulty] ?? null
);

const activeCells = (state) => {
  if (!state.active) return new Map();
  const rotation = rotationsFor(state.active.typeId)
    .find((candidate) => candidate.rotation === state.active.rotation);
  if (!rotation) return new Map();
  return new Map(placedCells(rotation.cells, {
    row: state.active.row, column: state.active.column,
  }).map((cell) => [cellKey(cell.row, cell.column), state.active]));
};

const manifestCellKeys = (state) => new Set(
  state.manifests.flatMap((item) => item.cells.map(
    (cell) => cellKey(cell.row, cell.column),
  )),
);

function paintStack(view, state, {
  store, elapsedMs, entryKind,
}) {
  const difficulty = state.definition.difficulty;
  view.difficultySelect.value = difficulty;
  view.difficultyExplanation.textContent = DIFFICULTY_COPY[difficulty];
  view.timer.textContent = formatElapsed(elapsedMs);
  view.score.textContent = state.score.toLocaleString('en-CA');
  const best = stackBestScore(store, difficulty);
  view.highScore.textContent = Number.isSafeInteger(best)
    ? best.toLocaleString('en-CA') : '—';
  view.assisted.textContent = state.assisted
    ? 'Assisted run · records excluded'
    : 'Unassisted · eligible for records';
  view.status.textContent = titleCase(state.status);

  const completedCells = state.manifests.reduce((total, item) => (
    total + item.cells.filter(({ row, column }) => state.board[row][column] !== null).length
  ), 0);
  const requiredCells = state.manifests.reduce(
    (total, item) => total + item.cells.length, 0,
  );
  view.manifest.textContent = state.manifests.length
    + ' active · ' + completedCells + '/' + requiredCells + ' cells filled';
  view.tide.textContent = state.tide.direction === null
    ? 'No tides'
    : titleCase(state.tide.direction) + ' in '
      + state.tide.placementsRemaining + ' placements';

  const active = activeCells(state);
  const manifestTargets = manifestCellKeys(state);
  for (let row = 0; row < state.height; row += 1) {
    for (let column = 0; column < state.width; column += 1) {
      const node = view.cells[row][column];
      const key = cellKey(row, column);
      const moving = active.get(key);
      const settled = state.board[row][column];
      const cargo = moving ?? settled;
      node.className = 'stack-cell';
      node.removeAttribute('data-pattern');
      if (manifestTargets.has(key)) node.classList.add('stack-manifest-cell');
      if (cargo) {
        const definition = cargoFor(cargo.typeId);
        const phase = moving ? 'active' : 'settled';
        node.classList.add('stack-cargo-' + phase);
        node.classList.add('cargo-pattern-' + definition.pattern);
        node.setAttribute('data-pattern', definition.pattern);
        node.setAttribute(
          'aria-label',
          definition.label + ', ' + phase + ', row ' + (row + 1)
            + ', column ' + (column + 1) + ', ' + definition.pattern + ' pattern'
            + (manifestTargets.has(key) ? ', Cargo Manifest target' : ''),
        );
        node.textContent = '■';
      } else {
        node.setAttribute(
          'aria-label',
          'Empty dock cell, row ' + (row + 1) + ', column ' + (column + 1)
            + (manifestTargets.has(key) ? ', Cargo Manifest target' : ''),
        );
        node.textContent = '';
      }
    }
  }

  view.preview.replaceChildren(...state.preview.map((piece) => {
    const cargo = cargoFor(piece.typeId);
    return element('li', {
      'data-next-cargo': '',
      class: 'cargo-pattern-' + cargo.pattern,
      text: cargo.label + ' · ' + cargo.pattern + ' pattern',
    });
  }));

  const isActive = state.status === 'active';
  for (const control of Object.values(view.controls)) control.disabled = !isActive;
  view.controls.describe.disabled = false;
  view.controls.advance.hidden = !state.stepMode;
  view.controls.advance.disabled = !isActive || !state.stepMode;
  view.controls.stepMode.setAttribute('aria-pressed', String(state.stepMode));
  view.start.hidden = entryKind !== 'start';
  view.continueGame.hidden = entryKind !== 'continue';
  view.resume.hidden = entryKind !== 'resume';
}
~~~

- [ ] **Step 7: Add the Store v2 persistence adapter**

Append this adapter. It owns the in-memory store, writes only the Stack run, preserves unrelated data, records assistance before saving play, and reports persistence failure once:

~~~js
class StackPersistence {
  constructor({ storage, store, wallNow }) {
    this.storage = storage;
    this.value = store;
    this.wallNow = wallNow;
    this.notice = null;
    this.pendingFailure = null;
    this.didNotice = false;
  }

  get store() { return this.value; }

  attachNotice(notice) {
    this.notice = notice;
    if (this.pendingFailure && !this.didNotice) this.report(this.pendingFailure);
  }

  report(error) {
    this.pendingFailure = error;
    if (this.didNotice || !this.notice) return;
    this.didNotice = true;
    this.notice('Progress could not be saved. This run can continue in memory.');
  }

  write() {
    const result = saveGameStore(this.storage, this.value);
    if (!result.ok) this.report(result.error);
    return result.ok;
  }

  start({ difficulty, seed, signature, definition, state }) {
    this.value = startRun(this.value, {
      game: GAME,
      mode: MODE,
      difficulty,
      seed,
      signature,
      puzzle: { definition, play: state },
      now: this.wallNow(),
    });
    this.write();
  }

  savePlay(state, elapsedMs = null) {
    let next = this.value;
    const existing = next.runs[GAME];
    if (!existing) return;
    if (state.assisted && !existing.assisted) next = markAssisted(next, GAME);
    const run = next.runs[GAME];
    const elapsed = elapsedMs === null
      ? run.elapsedBeforeStartMs
      : Math.max(0, Math.floor(elapsedMs));
    this.value = {
      ...next,
      runs: {
        ...next.runs,
        [GAME]: {
          ...run,
          puzzle: { definition: run.puzzle.definition, play: state },
          ...(elapsedMs === null ? {} : {
            startedAt: this.wallNow(),
            elapsedBeforeStartMs: elapsed,
          }),
        },
      },
    };
    this.write();
  }

  normalizeAssistance(state) {
    const run = this.value.runs[GAME];
    if (run && state.assisted && !run.assisted) {
      this.value = markAssisted(this.value, GAME);
      this.write();
    }
  }

  abandon(expectedSignature) {
    this.value = abandonRun(this.value, {
      game: GAME, expectedSignature,
    });
    this.write();
  }

  complete(records, state) {
    const run = this.value.runs[GAME];
    if (!run || run.assisted !== state.assisted) {
      throw new Error('Stack assistance state is inconsistent at completion.');
    }
    this.value = completeRun(this.value, {
      game: GAME, mode: MODE, now: this.wallNow(), records,
    });
    this.write();
  }

  setAudio(preferences) {
    this.value = { ...this.value, audio: preferences };
    this.write();
  }
}
~~~

- [ ] **Step 8: Add lazy audio creation, event effects, and intensity**

Append this adapter. Constructing the controller remains silent; `audioFactory` is called only by explicit Start, Continue, or Resume:

~~~js
const SILENT_AUDIO = Object.freeze({
  start: async () => {},
  resume: async () => {},
  pause: async () => {},
  stop: async () => {},
  finish: () => {},
  dispose: async () => {},
  setPreferences: () => {},
  setIntensity: () => {},
  playEffect: () => {},
});

class LazyStackAudio {
  constructor({ audioFactory, preferences, monotonicNow, onNotice }) {
    this.audioFactory = audioFactory;
    this.preferences = preferences;
    this.monotonicNow = monotonicNow;
    this.onNotice = onNotice;
    this.audio = null;
  }

  ensure() {
    if (this.audio) return this.audio;
    try {
      this.audio = this.audioFactory({
        audioContextFactory: () => {
          const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
          if (!Context) throw new Error('Web Audio is unavailable');
          return new Context();
        },
        preferences: this.preferences,
        onNotice: this.onNotice,
        monotonicNow: this.monotonicNow,
        setIntervalFn: (...args) => globalThis.setInterval(...args),
        clearIntervalFn: (handle) => globalThis.clearInterval(handle),
        setTimeoutFn: (...args) => globalThis.setTimeout(...args),
        clearTimeoutFn: (handle) => globalThis.clearTimeout(handle),
      });
    } catch {
      this.onNotice('Audio is unavailable; play continues in silence.');
      this.audio = SILENT_AUDIO;
    }
    return this.audio;
  }

  async start() {
    await this.ensure().start({ arrangement: 'stack' });
  }

  async resume() {
    if (!this.audio) return this.start();
    await this.audio.resume();
  }

  pause() { return this.audio?.pause(); }
  finish() { this.audio?.finish({ outcome: 'terminal' }); }
  dispose() { return this.audio?.dispose(); }
  playEffect(name) { this.audio?.playEffect(name); }
  setIntensity(value) { this.audio?.setIntensity(value); }

  setPreferences(preferences) {
    this.preferences = preferences;
    this.audio?.setPreferences(preferences);
  }
}

const effectForEvent = (event) => {
  if (event.type === 'moved' && event.source !== 'gravity') return 'move';
  if (event.type === 'rotated') return 'rotate';
  if (event.type === 'placed') return 'placement';
  if (event.type === 'dispatch') return 'dispatch';
  if (event.type === 'tide-warning') return 'tide-warning';
  if (event.type === 'tide-shift') return 'tide-shift';
  if (event.type === 'invalid') return 'invalid';
  return null;
};

const stackIntensity = (state) => {
  const firstOccupiedRow = state.board.findIndex((row) => row.some(Boolean));
  const height = firstOccupiedRow < 0 ? 0 : (state.height - firstOccupiedRow) / state.height;
  const tidePressure = state.tide.placementsRemaining === null
    ? 0 : 1 - Math.min(1, state.tide.placementsRemaining / 8);
  return { height, tidePressure };
};
~~~

- [ ] **Step 9: Add deterministic fresh-preview and Continue selection**

Append these selection helpers. A fresh preview is unsaved; a valid saved run preserves its exact definition, active cargo, preview queue, grounded delay, tide, elapsed time, and stream indices:

~~~js
function validStoredStackRun(run, engine) {
  if (run?.game !== GAME || run.mode !== MODE
      || !DIFFICULTIES.includes(run.difficulty)
      || run.puzzle?.definition == null || run.puzzle?.play == null) return false;
  try {
    if (engine.stackDefinitionSignature(run.puzzle.definition) !== run.signature
        || run.seed !== run.puzzle.definition.seed
        || run.difficulty !== run.puzzle.definition.difficulty
        || (run.assisted === true && run.puzzle.play.assisted !== true)
        || engine.stackDefinitionSignature(run.puzzle.play.definition) !== run.signature) {
      return false;
    }
    return engine.validateStackState(run.puzzle.play, run.difficulty).valid;
  } catch { return false; }
}

function freshStackModel({
  store, difficulty, seedFactory, engine, abandonedSignature = null,
}) {
  const key = historyKey(GAME, MODE);
  const previousSeed = store.previousSeeds[key] ?? null;
  const previousSignature = store.previousSignatures[key] ?? null;
  const initialSeed = seedFactory({
    game: GAME, mode: MODE, previousSeed,
  });
  const selected = chooseFreshDefinition({
    game: GAME,
    mode: MODE,
    difficulty,
    initialSeed,
    previousSeed,
    previousSignature,
    abandonedSignature,
    createDefinition: engine.createStackDefinition,
    signatureOf: engine.stackDefinitionSignature,
  });
  return {
    definition: selected.definition,
    state: engine.createStackState(selected.definition),
    difficulty,
    seed: selected.seed,
    signature: selected.signature,
    entryKind: 'start',
    initialElapsedMs: 0,
  };
}

function selectStackModel({
  store, difficulty, seedFactory, engine,
  abandonedSignature = null, previewDefinition = null,
}) {
  if (previewDefinition) {
    return {
      definition: previewDefinition,
      state: engine.createStackState(previewDefinition),
      difficulty: previewDefinition.difficulty,
      seed: previewDefinition.seed,
      signature: engine.stackDefinitionSignature(previewDefinition),
      entryKind: 'start',
      initialElapsedMs: 0,
    };
  }

  const run = store.runs[GAME];
  if (run) {
    if (!validStoredStackRun(run, engine)) {
      throw new Error('Saved Kinnoki Stack state is invalid.');
    }
    return {
      definition: run.puzzle.definition,
      state: engine.prepareStackForContinue(run.puzzle.play),
      difficulty: run.difficulty,
      seed: run.seed,
      signature: run.signature,
      entryKind: 'continue',
      initialElapsedMs: run.elapsedBeforeStartMs,
    };
  }

  return freshStackModel({
    store, difficulty, seedFactory, engine, abandonedSignature,
  });
}
~~~

- [ ] **Step 10: Create the controller object and lifecycle**

Append the controller constructor and its paint/notice helpers:

~~~js
class StackController {
  constructor({
    root, model, persistence, dependencies, slot,
  }) {
    this.root = root;
    this.document = root.ownerDocument ?? globalThis.document;
    this.model = model;
    this.state = model.state;
    this.definition = model.definition;
    this.difficulty = model.difficulty;
    this.seed = model.seed;
    this.signature = model.signature;
    this.entryKind = model.entryKind;
    this.persistence = persistence;
    this.dependencies = dependencies;
    this.engine = dependencies.engine;
    this.slot = slot;
    this.passiveCleanups = new Set();
    this.activeApi = null;
    this.lastFrameTime = null;
    this.finished = false;
    this.errorRendered = false;
    this.disposed = false;

    this.audioControls = createAudioControls({
      document: this.document,
      preferences: persistence.store.audio,
      onChange: (preferences) => {
        this.persistence.setAudio(preferences);
        this.audio.setPreferences(preferences);
      },
    });
    this.view = buildStackShell(root, this.difficulty, this.audioControls);
    this.persistence.attachNotice((message) => this.showNotice(message));
    this.announcer = createEventAnnouncer({
      region: this.view.eventRegion,
      monotonicNow: dependencies.monotonicNow,
      minimumGapMs: 180,
    });
    this.audio = new LazyStackAudio({
      audioFactory: dependencies.audioFactory,
      preferences: persistence.store.audio,
      monotonicNow: dependencies.monotonicNow,
      onNotice: (message) => this.showNotice(message),
    });
    this.lifecycle = createGameLifecycle({
      root,
      initialElapsedMs: model.initialElapsedMs,
      monotonicNow: dependencies.monotonicNow,
      onActivate: (kind, api) => this.activate(kind, api),
      onPause: (reason) => this.handlePause(reason),
      onSnapshot: () => this.snapshot(),
      onError: (error) => this.renderError(error),
      onDispose: () => this.cleanup(),
    });

    this.installPassiveHandlers();
    this.paint();
  }

  showNotice(message) {
    this.view.notice.hidden = false;
    this.view.notice.textContent = message;
  }

  paint() {
    paintStack(this.view, this.state, {
      store: this.persistence.store,
      elapsedMs: this.lifecycle.elapsed(),
      entryKind: this.entryKind,
    });
  }
}
~~~

- [ ] **Step 11: Add passive Start, Continue, replacement, and description handlers**

Append these methods. They attach only lifecycle/navigation controls before play; no gameplay listener or frame exists yet:

~~~js
StackController.prototype.listenPassive = function listenPassive(target, type, listener) {
  target.addEventListener(type, listener);
  const cleanup = () => target.removeEventListener(type, listener);
  this.passiveCleanups.add(cleanup);
  return cleanup;
};

StackController.prototype.installPassiveHandlers = function installPassiveHandlers() {
  this.listenPassive(this.view.start, 'click', () => { void this.start('start'); });
  this.listenPassive(this.view.continueGame, 'click', () => {
    void this.start('continue');
  });
  this.listenPassive(this.view.resume, 'click', () => { void this.start('resume'); });
  this.listenPassive(this.view.describe, 'click', () => {
    this.view.dockDescription.textContent = this.engine.describeStack(this.state);
    this.view.describe.focus();
  });
  this.listenPassive(this.view.restart, 'click', () => { void this.restart(); });
  this.listenPassive(this.view.newRun, 'click', () => {
    void this.replaceWithDifficulty(this.difficulty);
  });
  this.listenPassive(this.view.difficultySelect, 'change', () => {
    void this.replaceWithDifficulty(this.view.difficultySelect.value);
  });
};

StackController.prototype.start = async function start(kind) {
  if (this.disposed || this.finished || kind !== this.entryKind) return false;
  try {
    return await this.lifecycle.start(kind);
  } catch (error) {
    this.fail(error);
    return false;
  }
};

StackController.prototype.focusEntryControl = function focusEntryControl() {
  const target = this.entryKind === 'continue'
    ? this.view.continueGame
    : this.entryKind === 'resume' ? this.view.resume : this.view.start;
  target.focus();
};
~~~

- [ ] **Step 12: Implement explicit activation and frame startup**

Append the activation method. It is the only path that starts/resumes audio, saves a new run, attaches gameplay handlers, or requests a frame:

~~~js
StackController.prototype.activate = async function activate(kind, api) {
  const action = kind === 'start' ? { type: 'start' } : { type: 'resume' };
  const transition = this.engine.reduceStack(this.state, action);
  if (transition.state.status !== 'active') {
    throw new Error('Kinnoki Stack could not enter active play.');
  }
  this.state = transition.state;

  if (kind === 'start') {
    this.persistence.start({
      difficulty: this.difficulty,
      seed: this.seed,
      signature: this.signature,
      definition: this.definition,
      state: this.state,
    });
  } else {
    this.persistence.savePlay(this.state, this.lifecycle.elapsed());
  }

  if (kind === 'resume') await this.audio.resume();
  else await this.audio.start();

  this.entryKind = null;
  this.activeApi = api;
  this.lastFrameTime = null;
  this.registerActiveHandlers(api);
  for (const event of transition.events) this.announcer.announce(event);
  this.audio.setIntensity(stackIntensity(this.state));
  this.paint();
  if (kind === 'continue' || kind === 'resume') this.view.controls.left.focus();
  api.requestActiveFrame((timestamp) => this.frame(timestamp));
};
~~~

- [ ] **Step 13: Attach keyboard and native-button gameplay handlers**

Append these handlers. They are registered through the active lifecycle API and are therefore removed on pause, finish, failure, replacement, or disposal:

~~~js
StackController.prototype.registerActiveHandlers = function registerActiveHandlers(api) {
  const bindings = [
    [this.view.controls.left, { type: 'move', deltaColumn: -1 }],
    [this.view.controls.right, { type: 'move', deltaColumn: 1 }],
    [this.view.controls.rotate, { type: 'rotate', quarterTurns: 1 }],
    [this.view.controls.softDrop, { type: 'soft-drop' }],
    [this.view.controls.hardDrop, { type: 'hard-drop' }],
    [this.view.controls.advance, { type: 'advance-step' }],
  ];
  for (const [control, action] of bindings) {
    api.listenActive(control, 'click', () => this.dispatch(action, control));
  }
  api.listenActive(this.view.controls.stepMode, 'click', () => {
    this.dispatch({
      type: 'set-step-mode', enabled: !this.state.stepMode,
    }, this.view.controls.stepMode);
  });
  api.listenActive(this.view.controls.pause, 'click', () => {
    this.lifecycle.pause('user');
  });
  api.listenActive(this.document, 'keydown', (event) => this.handleKeyDown(event));
};

StackController.prototype.handleKeyDown = function handleKeyDown(event) {
  if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(event.target?.tagName)) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === 'p' || key === 'Escape') {
    event.preventDefault();
    this.lifecycle.pause('user');
    return;
  }
  const action = {
    ArrowLeft: { type: 'move', deltaColumn: -1 },
    ArrowRight: { type: 'move', deltaColumn: 1 },
    ArrowDown: { type: 'soft-drop' },
    ArrowUp: { type: 'rotate', quarterTurns: 1 },
    z: { type: 'rotate', quarterTurns: 1 },
    ' ': { type: 'hard-drop' },
    Enter: this.state.stepMode ? { type: 'advance-step' } : null,
  }[key];
  if (!action) return;
  event.preventDefault();
  this.dispatch(action, null);
};

StackController.prototype.dispatch = function dispatch(action, focusTarget) {
  if (this.state.status !== 'active' || this.disposed || this.finished) return;
  try {
    this.accept(this.engine.reduceStack(this.state, action), focusTarget);
  } catch (error) {
    this.fail(error);
  }
};
~~~

- [ ] **Step 14: Add deterministic frames, event handling, persistence, and audio updates**

Append these methods. Every accepted state object is persisted, including gravity movement, grounding, locks, Step Mode, assistance, tide, manifests, and stream indices:

~~~js
StackController.prototype.frame = function frame(timestamp) {
  if (this.disposed || this.finished || this.state.status !== 'active'
      || this.lifecycle.state !== 'active') return;
  const delta = this.lastFrameTime === null ? 0 : Math.max(0, timestamp - this.lastFrameTime);
  this.lastFrameTime = timestamp;
  try {
    this.accept(this.engine.advanceStackTime(this.state, delta), null);
  } catch (error) {
    this.fail(error);
    return;
  }
  if (!this.disposed && !this.finished && this.state.status === 'active'
      && this.lifecycle.state === 'active') {
    this.activeApi.requestActiveFrame((nextTimestamp) => this.frame(nextTimestamp));
  }
};

StackController.prototype.accept = function accept(result, focusTarget) {
  const fatal = result.events.find((event) => event.type === 'error');
  if (fatal) {
    this.state = result.state;
    this.fail(new Error(fatal.message));
    return;
  }

  const changed = result.state !== this.state;
  this.state = result.state;
  if (changed) this.persistence.savePlay(this.state, this.lifecycle.elapsed());

  for (const event of result.events) {
    this.announcer.announce(event);
    const effect = effectForEvent(event);
    if (effect) this.audio.playEffect(effect);
  }

  this.audio.setIntensity(stackIntensity(this.state));
  this.paint();
  if (focusTarget && this.state.status === 'active') focusTarget.focus();
  if (this.state.status === 'terminal') this.finishTerminal();
};
~~~

- [ ] **Step 15: Implement pause, hidden-page snapshots, and explicit Resume**

Append these lifecycle callbacks. Visibility return remains inert because only the Resume button invokes `lifecycle.start('resume')`:

~~~js
StackController.prototype.snapshot = function snapshot() {
  if (this.persistence.store.runs[GAME]) {
    this.persistence.savePlay(this.state, this.lifecycle.elapsed());
  }
};

StackController.prototype.handlePause = function handlePause(reason) {
  if (this.state.status !== 'active') return;
  const result = this.engine.reduceStack(this.state, {
    type: 'pause', reason,
  });
  this.state = result.state;
  this.entryKind = 'resume';
  this.activeApi = null;
  this.lastFrameTime = null;
  this.persistence.savePlay(this.state, this.lifecycle.elapsed());
  for (const event of result.events) this.announcer.announce(event);
  void this.audio.pause();
  this.paint();
  this.view.resume.focus();
};
~~~

- [ ] **Step 16: Implement Restart, New Run, difficulty replacement, and decline focus**

Append these methods. Restart removes the matching saved run and reuses the same definition/signature in an unsaved inert preview; the next explicit Start persists it again. Replacement abandons only the matching Stack run and carries its signature into fresh selection:

~~~js
StackController.prototype.remount = async function remount(store, options) {
  this.dispose();
  const next = await mountStack(
    this.root, store, this.dependencies, this.slot, options,
  );
  this.slot.current = next;
};

StackController.prototype.restart = async function restart() {
  if (this.disposed || this.finished) return;
  this.persistence.abandon(this.signature);
  await this.remount(this.persistence.store, {
    forcedDifficulty: this.difficulty,
    previewDefinition: this.definition,
  });
};

StackController.prototype.replaceWithDifficulty = async function replaceWithDifficulty(
  requestedDifficulty,
) {
  if (!DIFFICULTIES.includes(requestedDifficulty) || this.disposed) return;
  const run = this.persistence.store.runs[GAME];
  if (run) {
    const accepted = this.dependencies.confirm(
      'Replace the current Kinnoki Stack run? The unfinished run will not count.',
    );
    if (!accepted) {
      this.view.difficultySelect.value = this.difficulty;
      this.view.difficultySelect.focus();
      return;
    }
  }

  const abandonedSignature = run?.signature ?? this.signature;
  if (run) this.persistence.abandon(run.signature);
  await this.remount(this.persistence.store, {
    forcedDifficulty: requestedDifficulty,
    abandonedSignature,
  });
};
~~~

- [ ] **Step 17: Implement terminal completion, recoverable errors, focus, and disposal**

Append these exact terminal and failure paths. Normal terminal flow calls `audio.finish` without `stop`/`dispose`; replacement/navigation may still dispose early:

~~~js
StackController.prototype.finishTerminal = function finishTerminal() {
  if (this.finished || this.disposed) return;
  const elapsedMs = this.lifecycle.elapsed();
  if (!this.lifecycle.finish()) return;
  const payload = this.engine.stackCompletionPayload(this.state, elapsedMs);
  if (!payload) {
    this.fail(new Error('Kinnoki Stack ended without a completion payload.'));
    return;
  }

  this.finished = true;
  this.entryKind = null;
  this.persistence.complete(payload.records, this.state);
  this.audio.finish();
  makeGameTerminal(this.root);

  const heading = element('h2', {
    'data-complete-heading': '', tabindex: '-1', text: 'Run complete',
  });
  const summary = element('p', {
    text: payload.summary.score.toLocaleString('en-CA') + ' points · '
      + payload.summary.dispatchedManifests + ' manifests · best combo '
      + payload.summary.bestCombo + '× · ' + formatElapsed(payload.summary.elapsedMs)
      + (payload.summary.assisted ? ' · assisted' : ' · unassisted')
      + ' · ' + payload.summary.reason,
  });
  const playAgain = element('button', {
    type: 'button', 'data-play-another': '', text: 'Play Again',
  });
  const panel = element(
    'section', { class: 'game-complete' }, heading, summary, playAgain,
  );
  this.view.shell.append(panel);
  this.listenPassive(playAgain, 'click', () => {
    void this.replaceWithDifficulty(this.difficulty);
  });
  heading.focus();
};

StackController.prototype.fail = function fail(error) {
  if (this.disposed || this.finished || this.errorRendered) return;
  const failure = error instanceof Error ? error : new Error(String(error));
  this.lifecycle.fail(failure);
};

StackController.prototype.renderError = function renderError(error) {
  if (this.errorRendered) return;
  this.errorRendered = true;
  void this.audio.pause();
  void this.audio.dispose();
  const run = this.persistence.store.runs[GAME];
  if (run) this.persistence.abandon(run.signature);
  for (const cleanup of this.passiveCleanups) cleanup();
  this.passiveCleanups.clear();
  this.announcer.dispose();
  this.audioControls.dispose();
  renderGameError(this.root, {
    title: 'Kinnoki Stack paused',
    message: error.message || 'This run could not continue safely.',
    newGameHref: '/games/kinnoki-stack?difficulty=' + this.difficulty,
  });
};

StackController.prototype.cleanup = function cleanup() {
  if (this.disposed) return;
  this.disposed = true;
  for (const cleanup of this.passiveCleanups) cleanup();
  this.passiveCleanups.clear();
  this.announcer.dispose();
  this.audioControls.dispose();
  void this.audio.dispose();
};

StackController.prototype.dispose = function dispose() {
  if (this.disposed) return;
  this.lifecycle.dispose();
  this.cleanup();
};
~~~

- [ ] **Step 18: Add the exact dependency defaults and exported renderer**

Append the mount/export code. It handles an existing different-difficulty run before model creation, validates saved state, and returns one stable public disposer even after an internal remount:

~~~js
const normalizedDependencies = (dependencies) => ({
  storage: dependencies.storage ?? safeLocalStorage(globalThis),
  wallNow: dependencies.wallNow ?? (() => Date.now()),
  monotonicNow: dependencies.monotonicNow ?? (() => performance.now()),
  seedFactory: dependencies.seedFactory ?? defaultSeedFactory,
  audioFactory: dependencies.audioFactory ?? createGameAudio,
  confirm: dependencies.confirm ?? ((message) => window.confirm(message)),
  engine: dependencies.engine ?? defaultStackEngine,
});

async function mountStack(root, initialStore, dependencies, slot, options = {}) {
  const persistence = new StackPersistence({
    storage: dependencies.storage,
    store: initialStore,
    wallNow: dependencies.wallNow,
  });
  const params = new URLSearchParams(globalThis.location?.search ?? '');
  const requested = options.forcedDifficulty ?? params.get('difficulty');
  let difficulty = DIFFICULTIES.includes(requested) ? requested : 'easy';
  let abandonedSignature = options.abandonedSignature ?? null;
  let focusRetainedEntry = false;
  const existing = persistence.store.runs[GAME];

  try {
    if (existing && !options.previewDefinition) {
      if (!validStoredStackRun(existing, dependencies.engine)) {
        persistence.abandon(existing.signature);
        throw new Error('Saved Kinnoki Stack state is invalid.');
      }
      persistence.normalizeAssistance(existing.puzzle.play);
      if (existing.difficulty !== difficulty) {
        const accepted = dependencies.confirm(
          'Replace the saved ' + titleCase(existing.difficulty)
            + ' Kinnoki Stack run with ' + titleCase(difficulty) + '?',
        );
        if (accepted) {
          abandonedSignature = existing.signature;
          persistence.abandon(existing.signature);
        } else {
          difficulty = existing.difficulty;
          focusRetainedEntry = true;
        }
      }
    }

    const model = selectStackModel({
      store: persistence.store,
      difficulty,
      seedFactory: dependencies.seedFactory,
      engine: dependencies.engine,
      abandonedSignature,
      previewDefinition: options.previewDefinition ?? null,
    });
    const controller = new StackController({
      root, model, persistence, dependencies, slot,
    });
    if (focusRetainedEntry) controller.focusEntryControl();
    return controller;
  } catch (error) {
    renderGameError(root, {
      title: 'Kinnoki Stack paused',
      message: error.message || 'A new run could not be prepared.',
      newGameHref: '/games/kinnoki-stack?difficulty=' + difficulty,
    });
    return { dispose() {} };
  }
}

export async function renderKinnokiStack(root, store, dependencies = {}) {
  const slot = { current: null };
  const resolved = normalizedDependencies(dependencies);
  const publicController = {
    dispose() { slot.current?.dispose(); },
  };
  slot.current = await mountStack(root, store, resolved, slot);
  return publicController;
}
~~~


- [ ] **Step 19: Run Stack controller and dependent suites**

Run: `node --test Tests/games/kinnoki-stack-ui.test.mjs Tests/games/kinnoki-stack.test.mjs Tests/games/kinnoki-stack-loop.test.mjs Tests/games/game-audio.test.mjs Tests/games/game-lifecycle.test.mjs`
Expected: PASS for inert pre-play, semantic cells, keyboard/touch, pause/resume, Step Mode, Describe Dock, focus, persistence, event audio, completion accounting, and disposal.

- [ ] **Step 20: Commit the Stack interface**

```bash
git add Resources/games/kinnoki-stack-ui.js Tests/games/kinnoki-stack-ui.test.mjs
git commit -m "feat(games): add Kinnoki Stack interface"
```

---

### Task 11: Kinnoki Yard semantic controller

**Files:**
- Create: `Resources/games/kinnoki-yard-ui.js`
- Create: `Tests/games/kinnoki-yard-ui.test.mjs`

**Interfaces:**
- Consumes: Store v2, unified Yard facade, audio, geometry labels/patterns, and explicit lifecycle.
- Produces: `renderKinnokiYard(root, store, dependencies = {}) -> { dispose() }` with `mode=contracts|endless` and difficulty query support. Dependencies are exactly `{ storage = safeLocalStorage(globalThis), wallNow = () => Date.now(), monotonicNow = () => performance.now(), seedFactory = defaultSeedFactory, audioFactory = createGameAudio, confirm = (message) => window.confirm(message), engine = defaultYardEngine }`; the frozen default adapter contains the public Yard functions.

- [ ] **Step 1: Write failing mode/pre-play and roving-focus tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, FixtureEvent, installDOM } from './dom-fixture.mjs';
import { createEmptyGameStore } from '../../Resources/games/core.js';

async function waitForYardState(predicate, message) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail(message);
}

const silentYardAudioFactory = () => ({
  start: async () => {}, resume: async () => {}, pause: async () => {},
  stop: async () => {}, finish() {}, dispose: async () => {},
  setPreferences() {}, setIntensity() {}, playEffect() {},
});

test('Yard asks for mode first and exposes one roving board tab stop', async () => {
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      seedFactory: () => 80,
      audioFactory: silentYardAudioFactory,
    });
    assert.equal(fixture.root.querySelector('[data-mode]').value, 'contracts');
    const cells = fixture.root.querySelectorAll('[data-yard-cell]');
    assert.ok(cells.length > 0);
    assert.equal(cells.filter((cell) => cell.getAttribute('tabindex') === '0').length, 1);
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Yard never entered observable active state',
    );
    const focused = fixture.root.querySelector('[data-yard-cell][tabindex="0"]');
    const row = Number(focused.getAttribute('data-yard-row'));
    const column = Number(focused.getAttribute('data-yard-column'));
    const direction = [
      ['ArrowRight', row, column + 1],
      ['ArrowDown', row + 1, column],
      ['ArrowLeft', row, column - 1],
      ['ArrowUp', row - 1, column],
    ].find(([, nextRow, nextColumn]) => {
      const candidate = fixture.root.querySelector(
        `[data-yard-cell="${nextRow}:${nextColumn}"]`,
      );
      return candidate && candidate.disabled === false;
    });
    assert.ok(direction, 'generated Contract must expose an adjacent target cell');
    focused.dispatchEvent(new FixtureEvent('keydown', { key: direction[0] }));
    const moved = fixture.root.querySelector('[data-yard-cell][tabindex="0"]');
    assert.equal(fixture.root.querySelectorAll('[data-yard-cell][tabindex="0"]').length, 1);
    assert.notEqual(moved.getAttribute('data-yard-cell'), focused.getAttribute('data-yard-cell'));
    assert.equal(fixture.document.activeElement, moved);
  } finally { restore(); }
});
```

- [ ] **Step 2: Write failing Contract/Endless interaction, pan, focus, and completion tests**

```js
import {
  createContractState, generateContract, reduceContract, yardDefinitionSignature,
} from '../../Resources/games/kinnoki-yard.js';
import {
  openGameStore, startRun, STORE_KEYS,
} from '../../Resources/games/core.js';

test('Contract and Endless expose their exact mode-specific controls', async () => {
  for (const [mode, hasHint] of [['contracts', true], ['endless', false]]) {
    const fixture = createDOMFixture({ search: `?mode=${mode}&difficulty=medium` });
    const restore = installDOM(fixture);
    try {
      const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
      const controller = await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
        audioFactory: silentYardAudioFactory,
      });
      assert.equal(Boolean(fixture.root.querySelector('[data-yard-hint]')), hasHint);
      assert.ok(fixture.root.querySelector('[data-yard-undo]'));
      assert.ok(fixture.root.querySelector('[data-yard-rotate]'));
      assert.ok(fixture.root.querySelector('[data-yard-pan-left][aria-label="Pan yard left"]'));
      assert.ok(fixture.root.querySelector('[data-yard-pan-right][aria-label="Pan yard right"]'));
      assert.equal(fixture.root.querySelector('[data-audio-music-volume]')
        .getAttribute('type'), 'range');
      assert.equal(fixture.root.querySelector('[data-audio-effects-volume]')
        .getAttribute('type'), 'range');
      controller.dispose();
      assert.equal(fixture.document.listenerCount('keydown'), 0);
    } finally { restore(); }
  }
});

test('declined mode replacement keeps exact Contract state and Continue copy', async () => {
  const definition = generateContract({ difficulty: 'easy', seed: 81 });
  let play = reduceContract(createContractState(definition), { type: 'start' }).state;
  const witness = definition.witness[0];
  play = reduceContract(play, { type: 'select-piece', pieceId: witness.pieceId }).state;
  while (play.selectedRotation !== witness.rotation) {
    play = reduceContract(play, { type: 'rotate-piece', quarterTurns: 1 }).state;
  }
  play = reduceContract(play, {
    type: 'place-piece', row: witness.row, column: witness.column,
  }).state;
  let store = startRun(createEmptyGameStore(), {
    game: 'kinnoki-yard', mode: 'contracts', difficulty: 'easy', seed: 81,
    signature: yardDefinitionSignature(definition),
    puzzle: { definition, play }, now: 100,
  });
  const fixture = createDOMFixture({ search: '?mode=endless&difficulty=hard' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    await renderKinnokiYard(fixture.root, store, { confirm: () => false });
    assert.equal(fixture.root.querySelector('[data-mode]').value, 'contracts');
    assert.equal(fixture.root.querySelector('[data-difficulty]').value, 'easy');
    assert.match(fixture.root.querySelector('[data-continue-game]').textContent,
      /Continue Puzzle Contract · Easy/);
    assert.deepEqual(store.runs['kinnoki-yard'].puzzle.play, play);
  } finally { restore(); }
});

test('Yard rejects a saved run whose signature does not match its definition', async () => {
  const definition = generateContract({ difficulty: 'easy', seed: 82 });
  const play = reduceContract(createContractState(definition), { type: 'start' }).state;
  const store = startRun(createEmptyGameStore(), {
    game: 'kinnoki-yard', mode: 'contracts', difficulty: 'easy', seed: 82,
    signature: 'forged-contract-signature',
    puzzle: { definition, play }, now: 100,
  });
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    await renderKinnokiYard(fixture.root, store, {
      audioFactory: silentYardAudioFactory,
    });
    assert.ok(fixture.root.querySelector('.game-error'));
    assert.match(fixture.root.textContent, /Saved Kinnoki Yard state is invalid/);
    assert.equal(fixture.root.querySelector('[data-continue-game]'), null);
  } finally { restore(); }
});

test('declined active mode replacement changes no lifecycle or saved state', async () => {
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const controller = await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      storage: fixture.localStorage,
      seedFactory: () => 83,
      audioFactory: silentYardAudioFactory,
      confirm: () => false,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-pause-game]').disabled === false,
      'Yard never entered observable active state',
    );
    const before = fixture.localStorage.getItem(STORE_KEYS.v2);
    assert.ok(before);

    const mode = fixture.root.querySelector('[data-mode]');
    mode.focus();
    mode.value = 'endless';
    mode.dispatchEvent(new FixtureEvent('change'));

    assert.equal(mode.value, 'contracts');
    assert.equal(fixture.root.querySelector('[data-pause-game]').disabled, false);
    assert.equal(fixture.root.querySelector('[data-resume-game]').hidden, true);
    assert.equal(fixture.localStorage.getItem(STORE_KEYS.v2), before);
    assert.equal(fixture.document.activeElement, mode);
    controller.dispose();
  } finally { restore(); }
});

test('Contract Hint persists assistance and Continue resumes the exact run', async () => {
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  let audioStarts = 0;
  const audioFactory = () => ({
    start: async ({ arrangement }) => {
      assert.equal(arrangement, 'yard');
      audioStarts += 1;
    },
    resume: async () => {}, pause: async () => {}, stop: async () => {},
    finish() {}, dispose: async () => {}, setPreferences() {},
    setIntensity() {}, playEffect() {},
  });
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const first = await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      storage: fixture.localStorage,
      seedFactory: () => 86,
      audioFactory,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-hint]').disabled === false,
      'Contract never entered observable active state',
    );
    fixture.root.querySelector('[data-yard-hint]').click();
    assert.match(fixture.root.querySelector('[data-assisted-status]').textContent,
      /Assisted run/);
    let saved = openGameStore(fixture.localStorage).store;
    assert.equal(saved.runs['kinnoki-yard'].assisted, true);
    assert.equal(saved.runs['kinnoki-yard'].puzzle.play.assisted, true);
    const savedPlay = saved.runs['kinnoki-yard'].puzzle.play;
    first.dispose();

    const second = await renderKinnokiYard(fixture.root, saved, {
      storage: fixture.localStorage,
      seedFactory: () => 999,
      audioFactory,
    });
    assert.equal(fixture.root.querySelector('[data-continue-game]').hidden, false);
    assert.deepEqual(
      openGameStore(fixture.localStorage).store.runs['kinnoki-yard'].puzzle.play,
      savedPlay,
    );
    fixture.root.querySelector('[data-continue-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-pause-game]').disabled === false,
      'saved Contract never resumed',
    );
    saved = openGameStore(fixture.localStorage).store;
    assert.equal(saved.runs['kinnoki-yard'].puzzle.play.status, 'active');
    assert.equal(saved.runs['kinnoki-yard'].assisted, true);
    assert.equal(audioStarts, 2);
    second.dispose();
  } finally { restore(); }
});

test('Endless touch controls place and undo cargo while pan remains board-local', async () => {
  const fixture = createDOMFixture({ search: '?mode=endless&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const controller = await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      storage: fixture.localStorage,
      seedFactory: () => 84,
      audioFactory: silentYardAudioFactory,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Yard never entered observable active state',
    );

    const scroller = fixture.root.querySelector('.yard-board-scroll');
    const beforePan = scroller.scrollLeft;
    fixture.root.querySelector('[data-yard-pan-right]').click();
    assert.equal(scroller.scrollLeft, beforePan + 176);

    const tray = fixture.root.querySelector('[data-yard-tray]');
    const piece = tray.querySelector('[data-yard-piece]');
    const pieceId = piece.getAttribute('data-yard-piece');
    tray.dispatchEvent(new FixtureEvent('click', {
      target: { closest: () => piece },
    }));
    assert.equal(
      tray.querySelector(`[data-yard-piece="${pieceId}"]`).getAttribute('aria-pressed'),
      'true',
    );

    const scoreBefore = fixture.root.querySelector('[data-yard-score]').textContent;
    const placementCell = fixture.root.querySelectorAll('[data-yard-cell]')
      .find((cell) => cell.disabled === false);
    assert.ok(placementCell);
    placementCell.click();
    assert.ok(fixture.root.querySelectorAll('.yard-cell-placed').length > 0);
    assert.notEqual(fixture.root.querySelector('[data-yard-score]').textContent, scoreBefore);

    const undo = fixture.root.querySelector('[data-yard-undo]');
    assert.equal(undo.disabled, false);
    undo.click();
    assert.equal(fixture.root.querySelectorAll('.yard-cell-placed').length, 0);
    assert.equal(fixture.root.querySelector('[data-yard-score]').textContent, scoreBefore);
    controller.dispose();
  } finally { restore(); }
});

test('Contract terminal accounting completes once, writes records, and focuses summary', async () => {
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  let monotonic = 0;
  const finishCalls = [];
  try {
    const yard = await import('../../Resources/games/kinnoki-yard.js');
    const engine = {
      ...yard,
      reduceYard(state, action) {
        if (action.type !== 'rotate-piece') return yard.reduceYard(state, action);
        return {
          state: { ...state, status: 'terminal', moves: 7 },
          events: [{ type: 'completed', moves: 7 }],
        };
      },
      yardCompletionPayload(state, elapsedMs) {
        if (state.status !== 'terminal') return null;
        return {
          game: 'kinnoki-yard', mode: 'contracts',
          records: { time: elapsedMs, moves: state.moves },
          summary: {
            elapsedMs, moves: state.moves, assisted: state.assisted,
            piecesPlaced: state.definition.pieces.length,
            totalPieces: state.definition.pieces.length,
          },
        };
      },
    };
    const audioFactory = () => ({
      start: async () => {}, resume: async () => {}, pause: async () => {},
      stop: async () => {}, finish: (options) => finishCalls.push(options),
      dispose: async () => {}, setPreferences() {}, setIntensity() {}, playEffect() {},
    });
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const controller = await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      storage: fixture.localStorage,
      seedFactory: () => 85,
      wallNow: () => 1_700_000_000_000,
      monotonicNow: () => monotonic,
      audioFactory,
      engine,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Yard never entered observable active state',
    );
    monotonic = 2_500;
    fixture.root.querySelector('[data-yard-rotate]').click();

    const heading = fixture.root.querySelector('[data-complete-heading]');
    assert.equal(heading.textContent, 'Contract complete');
    assert.equal(fixture.document.activeElement, heading);
    const opened = openGameStore(fixture.localStorage).store;
    const contracts = opened.stats.games['kinnoki-yard'].modes.contracts;
    assert.equal(opened.runs['kinnoki-yard'], undefined);
    assert.equal(opened.stats.totalCompleted, 1);
    assert.equal(contracts.completed, 1);
    assert.equal(contracts.records.time.easy, 2_500);
    assert.equal(contracts.records.moves.easy, 7);
    fixture.root.querySelector('[data-yard-rotate]').click();
    assert.equal(openGameStore(fixture.localStorage).store.stats.totalCompleted, 1);
    assert.deepEqual(finishCalls, [{ outcome: 'completion' }]);
    controller.dispose();
  } finally { restore(); }
});
```

- [ ] **Step 3: Run Yard UI suites and verify the controller is absent**

Run: `node --test Tests/games/kinnoki-yard-ui.test.mjs Tests/games/kinnoki-yard-contracts.test.mjs Tests/games/kinnoki-yard-endless.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `kinnoki-yard-ui.js`.

- [ ] **Step 4: Create the Yard controller module foundation**

Create Resources/games/kinnoki-yard-ui.js with the exact imports, mode copy, cargo lookup, and frozen engine seam below:

~~~js
import {
  abandonRun, chooseFreshDefinition, completeRun, historyKey,
  markAssisted, saveGameStore, startRun,
} from './core.js';
import { CARGO_CATALOG } from './cargo-geometry.js';
import {
  createEndlessDefinition, createYardState, generateContract,
  prepareYardForContinue, reduceYard, validateYardState,
  yardCompletionPayload, yardDefinitionSignature,
} from './kinnoki-yard.js';
import { createGameAudio } from './game-audio.js';
import {
  createAudioControls, createEventAnnouncer, createGameLifecycle,
  defaultSeedFactory, element, formatElapsed, makeGameTerminal,
  renderGameError,
} from './controller-common.js';
import { safeLocalStorage } from './hub-ui.js';

const GAME = 'kinnoki-yard';
const MODES = Object.freeze(['contracts', 'endless']);
const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
const MODE_LABELS = Object.freeze({
  contracts: 'Puzzle Contract',
  endless: 'Endless Yard',
});
const DIFFICULTY_COPY = Object.freeze({
  contracts: Object.freeze({
    easy: 'Easy Contract: a compact, open target with full rotation choices.',
    medium: 'Medium Contract: a larger concave target with selected rotations.',
    hard: 'Hard Contract: a large target with narrow bays and tight rotations.',
  }),
  endless: Object.freeze({
    easy: 'Easy Yard: a larger yard with every cargo rotation available.',
    medium: 'Medium Yard: less open space and selected cargo rotations.',
    hard: 'Hard Yard: the tightest yard and the narrowest rotation choices.',
  }),
});
const CARGO_BY_ID = new Map(CARGO_CATALOG.map((cargo) => [cargo.id, cargo]));

export const defaultYardEngine = Object.freeze({
  createEndlessDefinition,
  createYardState,
  generateContract,
  prepareYardForContinue,
  reduceYard,
  validateYardState,
  yardCompletionPayload,
  yardDefinitionSignature,
});

const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const cellKey = (row, column) => row + ':' + column;
const cargoFor = (typeId) => CARGO_BY_ID.get(typeId) ?? {
  id: 'unknown', label: 'Unknown cargo', pattern: 'solid',
};
const modeLabel = (mode) => MODE_LABELS[mode] ?? 'Kinnoki Yard';
~~~

- [ ] **Step 5: Add exact mode and board builders**

Append these focused builders. They create both selectors and one native button per Yard cell; only the saved focus coordinate has tabindex 0:

~~~js
function buildYardSelectors(mode, difficulty) {
  const modeSelect = element(
    'select',
    { 'data-mode': '', 'aria-label': 'Yard mode' },
    MODES.map((value) => element('option', {
      value, text: modeLabel(value),
    })),
  );
  modeSelect.value = mode;
  const difficultySelect = element(
    'select',
    { 'data-difficulty': '', 'aria-label': 'Difficulty' },
    DIFFICULTIES.map((value) => element('option', {
      value, text: titleCase(value),
    })),
  );
  difficultySelect.value = difficulty;
  return { modeSelect, difficultySelect };
}

function buildYardBoard(definition, focus) {
  const cells = [];
  const grid = element('div', {
    class: 'yard-grid',
    role: 'grid',
    'aria-label': 'Kinnoki Yard cargo board',
    style: '--yard-columns: ' + definition.width,
  });
  for (let row = 0; row < definition.height; row += 1) {
    const rowNode = element('div', { class: 'yard-row', role: 'row' });
    const rowCells = [];
    for (let column = 0; column < definition.width; column += 1) {
      const control = element('button', {
        type: 'button',
        class: 'yard-cell',
        'data-yard-cell': cellKey(row, column),
        'data-yard-row': row,
        'data-yard-column': column,
        tabindex: focus.row === row && focus.column === column ? '0' : '-1',
        disabled: true,
        'aria-label': 'Empty yard cell, row ' + (row + 1)
          + ', column ' + (column + 1),
      });
      rowCells.push(control);
      rowNode.append(element('div', {
        class: 'yard-gridcell', role: 'gridcell',
      }, control));
    }
    cells.push(rowCells);
    grid.append(rowNode);
  }

  const panLeft = element('button', {
    type: 'button', 'data-yard-pan-left': '',
    'aria-label': 'Pan yard left', text: 'Pan Left',
  });
  const panRight = element('button', {
    type: 'button', 'data-yard-pan-right': '',
    'aria-label': 'Pan yard right', text: 'Pan Right',
  });
  const scroll = element('div', { class: 'yard-board-scroll' }, grid);
  const pan = element('div', {
    class: 'yard-pan-controls', 'aria-label': 'Yard board pan controls',
  }, panLeft, panRight);
  return { grid, cells, scroll, pan, panLeft, panRight };
}
~~~

- [ ] **Step 6: Build the complete inert Yard shell**

Append the static shell builder. It creates every persistent control once; the board and gameplay controls remain disabled until explicit Start or Continue:

~~~js
function buildYardShell(root, model, audioControls) {
  const { mode, difficulty, state, definition } = model;
  const selectors = buildYardSelectors(mode, difficulty);
  const board = buildYardBoard(definition, state.focus);
  const timer = element('time', {
    'data-timer': '', 'aria-label': 'Elapsed active time', text: '0:00',
  });
  const moves = element('span', { 'data-yard-moves': '', text: '0' });
  const score = element('span', { 'data-yard-score': '', text: '0' });
  const record = element('span', { 'data-yard-record': '', text: '—' });
  const assisted = element('span', {
    'data-assisted-status': '', text: 'Unassisted · eligible for records',
  });
  const status = element('span', { 'data-yard-status': '', text: 'Ready' });
  const summary = element('span', { 'data-yard-summary': '', text: 'Preparing yard' });
  const rotation = element('span', {
    'data-yard-rotation-state': '', text: 'Rotation 0°',
  });
  const difficultyExplanation = element('p', {
    'data-difficulty-explanation': '',
    text: DIFFICULTY_COPY[mode][difficulty],
  });
  const notice = element('p', {
    class: 'game-storage-notice', role: 'status', 'aria-live': 'polite',
    hidden: true, text: '',
  });
  const eventRegion = element('p', {
    class: 'games-live-region', role: 'status', 'aria-live': 'polite', text: '',
  });
  const tray = element('div', {
    class: 'yard-tray', 'data-yard-tray': '', 'aria-label': 'Cargo tray',
  });

  const control = (label, dataAttribute) => element('button', {
    type: 'button', [dataAttribute]: '', text: label, disabled: true,
  });
  const controls = {
    rotate: control('Rotate', 'data-yard-rotate'),
    undo: control('Undo', 'data-yard-undo'),
    hint: mode === 'contracts' ? control('Hint', 'data-yard-hint') : null,
    pause: control('Pause', 'data-pause-game'),
  };
  const start = element('button', {
    type: 'button', 'data-start-game': '', text: 'Start',
  });
  const continueGame = element('button', {
    type: 'button', 'data-continue-game': '',
    text: 'Continue ' + modeLabel(mode) + ' · ' + titleCase(difficulty),
    hidden: true,
  });
  const resume = element('button', {
    type: 'button', 'data-resume-game': '', text: 'Resume', hidden: true,
  });
  const restart = element('button', {
    type: 'button', 'data-restart': '', text: 'Restart',
  });
  const newGame = element('button', {
    type: 'button', 'data-new-yard': '',
    text: mode === 'contracts' ? 'New Puzzle' : 'New Yard',
  });
  const stat = (label, value) => element(
    'div', {}, element('dt', { text: label }), element('dd', {}, value),
  );
  const stats = element('dl', { class: 'game-status-grid' },
    stat('Status', status),
    stat('Elapsed', timer),
    stat(mode === 'contracts' ? 'Moves' : 'Score',
      mode === 'contracts' ? moves : score),
    stat('Local record', record),
    stat('Record status', assisted),
    stat(mode === 'contracts' ? 'Contract' : 'Cargo Manifests', summary),
    stat('Rotation', rotation));
  const help = element('details', { 'data-yard-keyboard-help': '' },
    element('summary', { text: 'Keyboard controls' }),
    element('p', {
      text: 'Arrow keys move board focus. Enter or Space places cargo. '
        + 'R rotates, U undoes, H requests a Contract hint, and Escape pauses.',
    }));

  const shell = element('section', { class: 'yard-game' },
    element('div', { class: 'game-toolbar' },
      element('a', { href: '/games', class: 'back-link', text: '← Games' }),
      element('h1', { text: 'Kinnoki Yard' }),
      element('label', {}, element('span', { text: 'Mode' }), selectors.modeSelect),
      element('label', {}, element('span', { text: 'Difficulty' }),
        selectors.difficultySelect)),
    notice,
    eventRegion,
    difficultyExplanation,
    stats,
    element('div', { class: 'game-preplay' },
      start, continueGame, resume, restart, newGame),
    element('section', { class: 'yard-tray-panel', 'aria-label': 'Cargo tray' },
      element('h2', { text: 'Cargo tray' }), tray),
    help,
    element('div', { class: 'yard-board-column' },
      board.scroll, board.pan),
    element('div', { class: 'yard-controls' },
      Object.values(controls).filter(Boolean)),
    audioControls.element);
  root.replaceChildren(shell);
  return {
    shell,
    ...selectors,
    ...board,
    timer, moves, score, record, assisted, status, summary, rotation,
    difficultyExplanation, notice, eventRegion, tray, controls,
    start, continueGame, resume, restart, newGame,
  };
}
~~~

- [ ] **Step 7: Paint the Yard board without replacing focusable cells**

Append the board paint helpers. Contract targets, Endless manifests, selected focus, hints, invalid placement, and placed cargo all have text or class state in addition to colour:

~~~js
const contractTargetKeys = (state) => new Set(
  state.definition.target.map(({ row, column }) => cellKey(row, column)),
);
const manifestTargetKeys = (state) => new Set(
  state.manifests.flatMap((manifest) => manifest.cells.map(
    ({ row, column }) => cellKey(row, column),
  )),
);

function normalizedYardFocus(state) {
  if (state.kind !== 'contracts') return state.focus;
  const targets = contractTargetKeys(state);
  if (targets.has(cellKey(state.focus.row, state.focus.column))) return state.focus;
  const first = state.definition.target[0];
  return { row: first.row, column: first.column };
}

function occupiedCargo(state, occupied) {
  if (occupied == null) return null;
  const pieceId = typeof occupied === 'object' ? occupied.pieceId : occupied;
  const placement = state.placements?.[pieceId] ?? null;
  const definitionPiece = state.definition.pieces?.find(
    (piece) => piece.pieceId === pieceId,
  );
  const trayPiece = state.tray?.find((piece) => piece.pieceId === pieceId);
  const typeId = occupied.typeId ?? placement?.typeId
    ?? definitionPiece?.typeId ?? trayPiece?.typeId;
  return { pieceId, typeId, cargo: cargoFor(typeId) };
}

function paintYardBoard(view, state, invalidCellKey) {
  const targetKeys = state.kind === 'contracts'
    ? contractTargetKeys(state) : manifestTargetKeys(state);
  const active = state.status === 'active';
  const hintKey = state.hint
    ? cellKey(state.hint.row, state.hint.column) : null;

  for (let row = 0; row < state.definition.height; row += 1) {
    for (let column = 0; column < state.definition.width; column += 1) {
      const key = cellKey(row, column);
      const node = view.cells[row][column];
      const occupied = occupiedCargo(state, state.board[row][column]);
      const inContractTarget = state.kind !== 'contracts' || targetKeys.has(key);
      node.className = 'yard-cell';
      node.setAttribute('tabindex',
        state.focus.row === row && state.focus.column === column ? '0' : '-1');
      node.disabled = !active || !inContractTarget;
      node.removeAttribute('data-pattern');
      if (targetKeys.has(key)) {
        node.classList.add(state.kind === 'contracts'
          ? 'yard-cell-target' : 'yard-cell-manifest');
      }
      if (state.focus.row === row && state.focus.column === column) {
        node.classList.add('yard-cell-selected');
      }
      if (key === hintKey) node.classList.add('yard-cell-hint');
      if (key === invalidCellKey) node.classList.add('yard-cell-invalid');

      const suffix = ', row ' + (row + 1) + ', column ' + (column + 1)
        + (targetKeys.has(key)
          ? state.kind === 'contracts' ? ', Contract target' : ', Cargo Manifest target'
          : '');
      if (occupied) {
        node.classList.add('yard-cell-placed');
        node.classList.add('cargo-pattern-' + occupied.cargo.pattern);
        node.setAttribute('data-pattern', occupied.cargo.pattern);
        node.setAttribute('aria-label', occupied.cargo.label + ', placed, '
          + occupied.cargo.pattern + ' pattern' + suffix);
        node.textContent = '■';
      } else {
        node.setAttribute('aria-label',
          (inContractTarget ? 'Empty yard cell' : 'Outside Contract target') + suffix);
        node.textContent = '';
      }
    }
  }
}
~~~

- [ ] **Step 8: Paint mode status, records, tray pieces, and entry controls**

Append this paint function. It may replace tray children because it restores tray focus by piece ID after each transition; it never replaces board cells:

~~~js
const modeBucket = (store, mode) => (
  store.stats?.games?.[GAME]?.modes?.[mode] ?? null
);

function yardRecordText(store, state) {
  const bucket = modeBucket(store, state.kind);
  const difficulty = state.definition.difficulty;
  if (state.kind === 'contracts') {
    const time = bucket?.records?.time?.[difficulty];
    const moves = bucket?.records?.moves?.[difficulty];
    return (Number.isSafeInteger(time) ? formatElapsed(time) : '—')
      + ' · ' + (Number.isSafeInteger(moves) ? moves + ' moves' : '—');
  }
  const score = bucket?.records?.score?.[difficulty];
  const combo = bucket?.records?.combo?.[difficulty];
  return (Number.isSafeInteger(score) ? score.toLocaleString('en-CA') : '—')
    + ' · ' + (Number.isSafeInteger(combo) ? combo + '×' : '—');
}

function trayPieces(state) {
  return state.kind === 'contracts' ? state.definition.pieces : state.tray;
}

function selectedPiece(state) {
  return trayPieces(state).find((piece) => (
    piece.pieceId === state.selectedPieceId
  )) ?? null;
}

function paintYard(view, state, {
  store, elapsedMs, entryKind, invalidCellKey,
}) {
  const mode = state.kind;
  const difficulty = state.definition.difficulty;
  view.modeSelect.value = mode;
  view.difficultySelect.value = difficulty;
  view.difficultyExplanation.textContent = DIFFICULTY_COPY[mode][difficulty];
  view.timer.textContent = formatElapsed(elapsedMs);
  view.moves.textContent = String(state.moves ?? 0);
  view.score.textContent = (state.score ?? 0).toLocaleString('en-CA');
  view.record.textContent = yardRecordText(store, state);
  view.assisted.textContent = state.assisted
    ? 'Assisted run · records excluded'
    : 'Unassisted · eligible for records';
  view.status.textContent = titleCase(state.status);
  view.summary.textContent = mode === 'contracts'
    ? Object.keys(state.placements).length + '/' + state.definition.pieces.length
      + ' cargo pieces placed'
    : state.manifests.length + ' active · '
      + state.dispatchedManifests + ' dispatched';

  const selected = selectedPiece(state);
  const selectedRotation = mode === 'contracts'
    ? state.selectedRotation : selected?.rotation ?? 0;
  view.rotation.textContent = 'Rotation ' + ((selectedRotation % 4) * 90)
    + '° · ' + (selected?.allowedRotations?.length ?? 0) + ' allowed';
  view.tray.replaceChildren(...trayPieces(state).map((piece) => {
    const cargo = cargoFor(piece.typeId);
    const rotation = mode === 'contracts'
      ? piece.pieceId === state.selectedPieceId
        ? state.selectedRotation : piece.initialRotation
      : piece.rotation;
    const placed = mode === 'contracts'
      && Object.hasOwn(state.placements, String(piece.pieceId));
    return element('button', {
      type: 'button',
      class: 'yard-tray-piece cargo-pattern-' + cargo.pattern
        + (piece.pieceId === state.selectedPieceId ? ' is-selected' : '')
        + (placed ? ' is-placed' : ''),
      'data-yard-piece': piece.pieceId,
      'data-pattern': cargo.pattern,
      'aria-pressed': String(piece.pieceId === state.selectedPieceId),
      disabled: state.status !== 'active',
      text: cargo.label + ' · rotation ' + ((rotation % 4) * 90)
        + '° · allowed ' + piece.allowedRotations.map((value) => value * 90 + '°').join(', ')
        + ' · ' + cargo.pattern + ' pattern' + (placed ? ' · placed' : ''),
    });
  }));

  paintYardBoard(view, state, invalidCellKey);
  const active = state.status === 'active';
  for (const control of Object.values(view.controls).filter(Boolean)) {
    control.disabled = !active;
  }
  view.controls.undo.disabled = !active || state.history.length === 0;
  view.start.hidden = entryKind !== 'start';
  view.continueGame.hidden = entryKind !== 'continue';
  view.resume.hidden = entryKind !== 'resume';
  view.continueGame.textContent = 'Continue ' + modeLabel(mode)
    + ' · ' + titleCase(difficulty);
  view.newGame.textContent = mode === 'contracts' ? 'New Puzzle' : 'New Yard';
}
~~~

- [ ] **Step 9: Add Store v2 persistence with assistance normalization**

Append this adapter. It updates only the Yard run, marks the generic run envelope assisted before saving assisted play, and keeps Contract and Endless completion records typed:

~~~js
class YardPersistence {
  constructor({ storage, store, wallNow }) {
    this.storage = storage;
    this.value = store;
    this.wallNow = wallNow;
    this.notice = null;
    this.pendingFailure = null;
    this.didNotice = false;
  }

  get store() { return this.value; }

  attachNotice(notice) {
    this.notice = notice;
    if (this.pendingFailure && !this.didNotice) this.report(this.pendingFailure);
  }

  report(error) {
    this.pendingFailure = error;
    if (this.didNotice || !this.notice) return;
    this.didNotice = true;
    this.notice('Progress could not be saved. This game can continue in memory.');
  }

  write() {
    const result = saveGameStore(this.storage, this.value);
    if (!result.ok) this.report(result.error);
    return result.ok;
  }

  start({ mode, difficulty, seed, signature, definition, state }) {
    this.value = startRun(this.value, {
      game: GAME, mode, difficulty, seed, signature,
      puzzle: { definition, play: state },
      now: this.wallNow(),
    });
    this.write();
  }

  savePlay(state, elapsedMs = null) {
    let next = this.value;
    const existing = next.runs[GAME];
    if (!existing) return;
    if (state.assisted && !existing.assisted) next = markAssisted(next, GAME);
    const run = next.runs[GAME];
    const elapsed = elapsedMs === null
      ? run.elapsedBeforeStartMs
      : Math.max(0, Math.floor(elapsedMs));
    this.value = {
      ...next,
      runs: {
        ...next.runs,
        [GAME]: {
          ...run,
          puzzle: { definition: run.puzzle.definition, play: state },
          ...(elapsedMs === null ? {} : {
            startedAt: this.wallNow(),
            elapsedBeforeStartMs: elapsed,
          }),
        },
      },
    };
    this.write();
  }

  reset(values) { this.start(values); }

  abandon(expectedSignature) {
    this.value = abandonRun(this.value, {
      game: GAME, expectedSignature,
    });
    this.write();
  }

  complete(mode, records) {
    this.value = completeRun(this.value, {
      game: GAME, mode, now: this.wallNow(), records,
    });
    this.write();
  }

  setAudio(preferences) {
    this.value = { ...this.value, audio: preferences };
    this.write();
  }
}
~~~

- [ ] **Step 10: Add gesture-gated Yard audio and event effects**

Append the lazy audio adapter. Preview construction is silent, the Yard arrangement starts only on Start or Continue, and its intensity remains at the warm base layer:

~~~js
const SILENT_AUDIO = Object.freeze({
  start: async () => {}, resume: async () => {}, pause: async () => {},
  stop: async () => {}, finish: () => {}, dispose: async () => {},
  setPreferences: () => {}, setIntensity: () => {}, playEffect: () => {},
});

class LazyYardAudio {
  constructor({ audioFactory, preferences, monotonicNow, onNotice }) {
    this.audioFactory = audioFactory;
    this.preferences = preferences;
    this.monotonicNow = monotonicNow;
    this.onNotice = onNotice;
    this.audio = null;
  }

  ensure() {
    if (this.audio) return this.audio;
    try {
      this.audio = this.audioFactory({
        preferences: this.preferences,
        monotonicNow: this.monotonicNow,
        onNotice: this.onNotice,
      });
    } catch {
      this.onNotice('Audio is unavailable; play continues in silence.');
      this.audio = SILENT_AUDIO;
    }
    return this.audio;
  }

  async start() {
    await this.ensure().start({ arrangement: 'yard' });
    this.audio.setIntensity({ height: 0, tidePressure: 0 });
  }

  async resume() {
    if (!this.audio) return this.start();
    await this.audio.resume();
  }

  pause() { return this.audio?.pause(); }
  finish(outcome) { this.audio?.finish({ outcome }); }
  dispose() { return this.audio?.dispose(); }
  playEffect(name) { this.audio?.playEffect(name); }
  setPreferences(preferences) {
    this.preferences = preferences;
    this.audio?.setPreferences(preferences);
  }
}

const yardEffectForEvent = (event) => ({
  selected: 'move',
  rotated: 'rotate',
  placed: 'placement',
  dispatch: 'dispatch',
  invalid: 'invalid',
}[event.type] ?? null);
~~~

- [ ] **Step 11: Select fresh or saved Yard models deterministically**

Append the model selectors. Each mode uses its own completed history key; the abandoned signature is also rejected. Saved play is structurally validated and prepared as paused without changing its board, tray, history, score, moves, or stream indices:

~~~js
const createDefinitionForMode = (engine, mode) => (
  mode === 'contracts' ? engine.generateContract : engine.createEndlessDefinition
);

function validStoredYardRun(run, engine) {
  return Boolean(run
    && run.game === GAME
    && MODES.includes(run.mode)
    && DIFFICULTIES.includes(run.difficulty)
    && run.puzzle?.definition?.mode === run.mode
    && run.puzzle?.definition?.difficulty === run.difficulty
    && engine.yardDefinitionSignature(run.puzzle.definition) === run.signature
    && engine.validateYardState(
      run.puzzle.play, run.difficulty, run.mode,
    ).valid);
}

function freshYardModel({
  store, mode, difficulty, seedFactory, engine,
  abandonedSignature = null,
}) {
  const key = historyKey(GAME, mode);
  const previousSeed = store.previousSeeds[key] ?? null;
  const previousSignature = store.previousSignatures[key] ?? null;
  const initialSeed = seedFactory({ game: GAME, mode, previousSeed });
  const selected = chooseFreshDefinition({
    game: GAME,
    mode,
    difficulty,
    initialSeed,
    previousSeed,
    previousSignature,
    abandonedSignature,
    createDefinition: createDefinitionForMode(engine, mode),
    signatureOf: engine.yardDefinitionSignature,
  });
  return {
    definition: selected.definition,
    state: engine.createYardState(selected.definition),
    mode,
    difficulty,
    seed: selected.seed,
    signature: selected.signature,
    entryKind: 'start',
    initialElapsedMs: 0,
  };
}

function selectYardModel({
  store, mode, difficulty, seedFactory, engine,
  abandonedSignature = null, previewDefinition = null,
}) {
  if (previewDefinition) {
    return {
      definition: previewDefinition,
      state: engine.createYardState(previewDefinition),
      mode: previewDefinition.mode,
      difficulty: previewDefinition.difficulty,
      seed: previewDefinition.seed,
      signature: engine.yardDefinitionSignature(previewDefinition),
      entryKind: 'start',
      initialElapsedMs: 0,
    };
  }
  const run = store.runs[GAME];
  if (run) {
    if (!validStoredYardRun(run, engine)) {
      throw new Error('Saved Kinnoki Yard state is invalid.');
    }
    return {
      definition: run.puzzle.definition,
      state: engine.prepareYardForContinue(run.puzzle.play),
      mode: run.mode,
      difficulty: run.difficulty,
      seed: run.seed,
      signature: run.signature,
      entryKind: 'continue',
      initialElapsedMs: run.elapsedBeforeStartMs,
    };
  }
  return freshYardModel({
    store, mode, difficulty, seedFactory, engine, abandonedSignature,
  });
}
~~~

- [ ] **Step 12: Construct the controller and passive-only preview**

Append the constructor and passive handlers. Before activation, only entry, replacement, pan, and audio-preference handlers exist; no document gameplay listener or timer frame exists:

~~~js
class YardController {
  constructor({ root, model, persistence, dependencies, slot }) {
    this.root = root;
    this.document = root.ownerDocument ?? globalThis.document;
    this.state = {
      ...model.state,
      focus: normalizedYardFocus(model.state),
    };
    this.model = { ...model, state: this.state };
    this.definition = model.definition;
    this.mode = model.mode;
    this.difficulty = model.difficulty;
    this.seed = model.seed;
    this.signature = model.signature;
    this.entryKind = model.entryKind;
    this.persistence = persistence;
    this.dependencies = dependencies;
    this.engine = dependencies.engine;
    this.slot = slot;
    this.passiveCleanups = new Set();
    this.activeApi = null;
    this.invalidCellKey = null;
    this.finished = false;
    this.errorRendered = false;
    this.disposed = false;

    this.audioControls = createAudioControls({
      document: this.document,
      preferences: persistence.store.audio,
      onChange: (preferences) => {
        this.persistence.setAudio(preferences);
        this.audio.setPreferences(preferences);
      },
    });
    this.view = buildYardShell(root, this.model, this.audioControls);
    this.persistence.attachNotice((message) => this.showNotice(message));
    this.announcer = createEventAnnouncer({
      region: this.view.eventRegion,
      monotonicNow: dependencies.monotonicNow,
      minimumGapMs: 180,
    });
    this.audio = new LazyYardAudio({
      audioFactory: dependencies.audioFactory,
      preferences: persistence.store.audio,
      monotonicNow: dependencies.monotonicNow,
      onNotice: (message) => this.showNotice(message),
    });
    this.lifecycle = createGameLifecycle({
      root,
      initialElapsedMs: model.initialElapsedMs,
      monotonicNow: dependencies.monotonicNow,
      onActivate: (kind, api) => this.activate(kind, api),
      onPause: (reason) => this.handlePause(reason),
      onSnapshot: () => this.snapshot(),
      onError: (error) => this.renderError(error),
      onDispose: () => this.cleanup(),
    });
    this.installPassiveHandlers();
    this.paint();
  }

  showNotice(message) {
    this.view.notice.hidden = false;
    this.view.notice.textContent = message;
  }

  paint() {
    paintYard(this.view, this.state, {
      store: this.persistence.store,
      elapsedMs: this.lifecycle.elapsed(),
      entryKind: this.entryKind,
      invalidCellKey: this.invalidCellKey,
    });
  }
}

YardController.prototype.listenPassive = function listenPassive(target, type, listener) {
  target.addEventListener(type, listener);
  const cleanup = () => target.removeEventListener(type, listener);
  this.passiveCleanups.add(cleanup);
  return cleanup;
};

YardController.prototype.installPassiveHandlers = function installPassiveHandlers() {
  this.listenPassive(this.view.start, 'click', () => { void this.start('start'); });
  this.listenPassive(this.view.continueGame, 'click', () => {
    void this.start('continue');
  });
  this.listenPassive(this.view.resume, 'click', () => { void this.start('resume'); });
  this.listenPassive(this.view.restart, 'click', () => { void this.restart(); });
  this.listenPassive(this.view.newGame, 'click', () => {
    void this.replaceWith(this.mode, this.difficulty);
  });
  this.listenPassive(this.view.modeSelect, 'change', () => {
    void this.replaceWith(this.view.modeSelect.value, this.view.difficultySelect.value);
  });
  this.listenPassive(this.view.difficultySelect, 'change', () => {
    void this.replaceWith(this.view.modeSelect.value, this.view.difficultySelect.value);
  });
  this.listenPassive(this.view.panLeft, 'click', () => {
    this.view.scroll.scrollLeft -= 176;
  });
  this.listenPassive(this.view.panRight, 'click', () => {
    this.view.scroll.scrollLeft += 176;
  });
};
~~~

- [ ] **Step 13: Activate Start, Continue, and Resume explicitly**

Append these methods. Start creates the run only after the gesture; Continue dispatches resume and starts new Yard audio; manual Resume resumes the already-created audio instance:

~~~js
YardController.prototype.start = async function start(kind) {
  if (this.disposed || this.finished || kind !== this.entryKind) return false;
  try {
    return await this.lifecycle.start(kind);
  } catch (error) {
    this.fail(error);
    return false;
  }
};

YardController.prototype.activate = async function activate(kind, api) {
  const action = kind === 'start' ? { type: 'start' } : { type: 'resume' };
  const transition = this.engine.reduceYard(this.state, action);
  if (transition.state.status !== 'active') {
    throw new Error('Kinnoki Yard could not enter active play.');
  }
  this.state = transition.state;
  if (kind === 'start') {
    this.persistence.start({
      mode: this.mode,
      difficulty: this.difficulty,
      seed: this.seed,
      signature: this.signature,
      definition: this.definition,
      state: this.state,
    });
  } else {
    this.persistence.savePlay(this.state, this.lifecycle.elapsed());
  }
  if (kind === 'resume') await this.audio.resume();
  else await this.audio.start();
  this.entryKind = null;
  this.activeApi = api;
  this.registerActiveHandlers(api);
  for (const event of transition.events) this.announcer.announce(event);
  this.paint();
  if (kind !== 'start') this.focusCell(this.state.focus);
  api.requestActiveFrame(() => this.frame());
};

YardController.prototype.frame = function frame() {
  if (this.disposed || this.finished || this.lifecycle.state !== 'active') return;
  this.view.timer.textContent = formatElapsed(this.lifecycle.elapsed());
  this.activeApi.requestActiveFrame(() => this.frame());
};
~~~

- [ ] **Step 14: Attach native controls, roving focus, and keyboard actions**

Append the active handlers. Dragging is deliberately absent: selecting a tray button, rotating, moving the one board tab stop, and activating a cell are the complete touch and keyboard path:

~~~js
YardController.prototype.registerActiveHandlers = function registerActiveHandlers(api) {
  api.listenActive(this.view.controls.rotate, 'click', () => {
    this.dispatch({ type: 'rotate-piece', quarterTurns: 1 },
      { type: 'piece', pieceId: this.state.selectedPieceId });
  });
  api.listenActive(this.view.controls.undo, 'click', () => {
    this.dispatch({ type: 'undo' }, { type: 'cell', focus: this.state.focus });
  });
  if (this.view.controls.hint) {
    api.listenActive(this.view.controls.hint, 'click', () => {
      this.dispatch({ type: 'hint' },
        { type: 'piece', pieceId: this.state.selectedPieceId });
    });
  }
  api.listenActive(this.view.controls.pause, 'click', () => {
    this.lifecycle.pause('user');
  });
  api.listenActive(this.view.tray, 'click', (event) => {
    const button = event.target?.closest?.('[data-yard-piece]');
    if (!button) return;
    const pieceId = Number(button.getAttribute('data-yard-piece'));
    this.dispatch({ type: 'select-piece', pieceId }, { type: 'piece', pieceId });
  });
  for (const row of this.view.cells) {
    for (const cell of row) {
      api.listenActive(cell, 'click', () => this.placeAtCell(cell));
      api.listenActive(cell, 'keydown', (event) => this.handleCellKey(event, cell));
    }
  }
  api.listenActive(this.document, 'keydown',
    (event) => this.handleDocumentKey(event));
};

YardController.prototype.placeAtCell = function placeAtCell(cell) {
  const row = Number(cell.getAttribute('data-yard-row'));
  const column = Number(cell.getAttribute('data-yard-column'));
  this.setFocus({ row, column }, false);
  this.dispatch({ type: 'place-piece', row, column },
    { type: 'cell', focus: { row, column } });
};

YardController.prototype.handleCellKey = function handleCellKey(event, cell) {
  const deltas = {
    ArrowUp: [-1, 0], ArrowDown: [1, 0],
    ArrowLeft: [0, -1], ArrowRight: [0, 1],
  };
  if (deltas[event.key]) {
    event.preventDefault();
    const row = Number(cell.getAttribute('data-yard-row'));
    const column = Number(cell.getAttribute('data-yard-column'));
    this.moveFocus(row, column, ...deltas[event.key]);
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    this.placeAtCell(cell);
  }
};

YardController.prototype.handleDocumentKey = function handleDocumentKey(event) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === 'Escape') {
    event.preventDefault();
    this.lifecycle.pause('user');
    return;
  }
  if (['INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(event.target?.tagName)) return;
  if (key === 'r') {
    event.preventDefault();
    this.dispatch({ type: 'rotate-piece', quarterTurns: 1 },
      { type: 'piece', pieceId: this.state.selectedPieceId });
  } else if (key === 'u') {
    event.preventDefault();
    this.dispatch({ type: 'undo' }, { type: 'cell', focus: this.state.focus });
  } else if (key === 'h' && this.mode === 'contracts') {
    event.preventDefault();
    this.dispatch({ type: 'hint' },
      { type: 'piece', pieceId: this.state.selectedPieceId });
  }
};
~~~

- [ ] **Step 15: Persist reducer transitions and restore meaningful focus**

Append these state/focus helpers. Only focus coordinates are controller-owned; move and score fields are changed exclusively by reduceYard:

~~~js
YardController.prototype.setFocus = function setFocus(focus, shouldFocus = true) {
  this.state = { ...this.state, focus };
  if (this.persistence.store.runs[GAME]) {
    this.persistence.savePlay(this.state, this.lifecycle.elapsed());
  }
  this.paint();
  if (shouldFocus) this.focusCell(focus);
};

YardController.prototype.moveFocus = function moveFocus(row, column, dr, dc) {
  const targets = this.mode === 'contracts' ? contractTargetKeys(this.state) : null;
  let nextRow = row + dr;
  let nextColumn = column + dc;
  while (nextRow >= 0 && nextRow < this.definition.height
      && nextColumn >= 0 && nextColumn < this.definition.width) {
    const next = { row: nextRow, column: nextColumn };
    if (!targets || targets.has(cellKey(nextRow, nextColumn))) {
      this.setFocus(next);
      return;
    }
    nextRow += dr;
    nextColumn += dc;
  }
  this.focusCell(this.state.focus);
};

YardController.prototype.focusCell = function focusCell(focus) {
  this.view.cells[focus.row]?.[focus.column]?.focus();
};

YardController.prototype.focusPiece = function focusPiece(pieceId) {
  this.view.tray.querySelector(
    '[data-yard-piece="' + pieceId + '"]',
  )?.focus();
};

YardController.prototype.restoreFocus = function restoreFocus(target) {
  if (!target || this.state.status !== 'active') return;
  if (target.type === 'piece') this.focusPiece(target.pieceId);
  else this.focusCell(target.focus);
};

YardController.prototype.dispatch = function dispatch(action, focusTarget) {
  if (this.state.status !== 'active' || this.disposed || this.finished) return;
  try {
    this.accept(this.engine.reduceYard(this.state, action), focusTarget);
  } catch (error) {
    this.fail(error);
  }
};

YardController.prototype.accept = function accept(result, focusTarget) {
  const fatal = result.events.find((event) => event.type === 'error');
  if (fatal) {
    this.state = result.state;
    this.fail(new Error(fatal.message));
    return;
  }
  const changed = result.state !== this.state;
  this.state = result.state;
  const invalid = result.events.find((event) => event.type === 'invalid');
  this.invalidCellKey = invalid && focusTarget?.type === 'cell'
    ? cellKey(focusTarget.focus.row, focusTarget.focus.column) : null;
  if (changed) this.persistence.savePlay(this.state, this.lifecycle.elapsed());
  for (const event of result.events) {
    this.announcer.announce(event);
    const effect = yardEffectForEvent(event);
    if (effect) this.audio.playEffect(effect);
  }
  this.paint();
  this.restoreFocus(focusTarget);
  if (this.state.status === 'terminal') this.finishTerminal();
};
~~~

- [ ] **Step 16: Implement snapshots, pause, Restart, and confirmed replacement**

Append these lifecycle and replacement paths. A declined request restores the exact selectors without changing active lifecycle or persisted state; a retained pre-play run focuses Continue. An accepted request abandons only the matching run and carries its signature into fresh selection:

~~~js
YardController.prototype.snapshot = function snapshot() {
  if (this.persistence.store.runs[GAME]) {
    this.persistence.savePlay(this.state, this.lifecycle.elapsed());
  }
};

YardController.prototype.handlePause = function handlePause(reason) {
  if (this.state.status !== 'active') return;
  const result = this.engine.reduceYard(this.state, {
    type: 'pause', reason,
  });
  this.state = result.state;
  this.entryKind = 'resume';
  this.activeApi = null;
  this.persistence.savePlay(this.state, this.lifecycle.elapsed());
  for (const event of result.events) this.announcer.announce(event);
  void this.audio.pause();
  this.paint();
  this.view.resume.focus();
};

YardController.prototype.focusEntryControl = function focusEntryControl() {
  const target = this.entryKind === 'continue'
    ? this.view.continueGame
    : this.entryKind === 'resume' ? this.view.resume : this.view.start;
  target.focus();
};

YardController.prototype.remount = async function remount(store, options) {
  this.dispose();
  const next = await mountYard(
    this.root, store, this.dependencies, this.slot, options,
  );
  this.slot.current = next;
};

YardController.prototype.restart = async function restart() {
  if (this.disposed || this.finished) return;
  const preview = this.engine.createYardState(this.definition);
  this.persistence.reset({
    mode: this.mode,
    difficulty: this.difficulty,
    seed: this.seed,
    signature: this.signature,
    definition: this.definition,
    state: preview,
  });
  await this.remount(this.persistence.store, {
    forcedMode: this.mode,
    forcedDifficulty: this.difficulty,
    previewDefinition: this.definition,
  });
};

YardController.prototype.replaceWith = async function replaceWith(mode, difficulty) {
  if (!MODES.includes(mode) || !DIFFICULTIES.includes(difficulty)
      || this.disposed) return;
  const run = this.persistence.store.runs[GAME];
  if (run) {
    const accepted = this.dependencies.confirm(
      'Replace the current ' + modeLabel(this.mode)
        + '? The unfinished game will not count.',
    );
    if (!accepted) {
      this.view.modeSelect.value = this.mode;
      this.view.difficultySelect.value = this.difficulty;
      if (this.entryKind) this.focusEntryControl();
      return;
    }
  }
  const abandonedSignature = run?.signature ?? this.signature;
  if (run) this.persistence.abandon(run.signature);
  await this.remount(this.persistence.store, {
    forcedMode: mode,
    forcedDifficulty: difficulty,
    abandonedSignature,
  });
};
~~~

- [ ] **Step 17: Implement exact terminal, error, and disposal paths**

Append the normal ending and fatal recovery code. Normal completion calls finish once and never calls stop; fatal recovery abandons an invalid run without completion accounting:

~~~js
YardController.prototype.finishTerminal = function finishTerminal() {
  if (this.finished || this.disposed) return;
  const elapsedMs = this.lifecycle.elapsed();
  const payload = this.engine.yardCompletionPayload(this.state, elapsedMs);
  if (!payload) {
    this.fail(new Error('Kinnoki Yard ended without a completion payload.'));
    return;
  }
  if (!this.lifecycle.finish()) return;
  this.finished = true;
  this.entryKind = null;
  this.persistence.complete(payload.mode, payload.records);
  this.audio.finish(this.mode === 'contracts' ? 'completion' : 'terminal');
  makeGameTerminal(this.root);

  const heading = element('h2', {
    'data-complete-heading': '', tabindex: '-1',
    text: this.mode === 'contracts' ? 'Contract complete' : 'Yard run complete',
  });
  const text = this.mode === 'contracts'
    ? formatElapsed(payload.summary.elapsedMs) + ' · ' + payload.summary.moves
      + ' moves · ' + payload.summary.piecesPlaced + '/'
      + payload.summary.totalPieces + ' cargo pieces'
    : payload.summary.score.toLocaleString('en-CA') + ' points · '
      + payload.summary.dispatchedManifests + ' manifests · best combo '
      + payload.summary.bestCombo + '× · ' + formatElapsed(payload.summary.elapsedMs);
  const summary = element('p', {
    text: text + (payload.summary.assisted ? ' · assisted' : ' · unassisted'),
  });
  const playAgain = element('button', {
    type: 'button', 'data-play-another': '',
    text: this.mode === 'contracts' ? 'New Puzzle' : 'New Yard',
  });
  this.view.shell.append(element(
    'section', { class: 'game-complete' }, heading, summary, playAgain,
  ));
  this.listenPassive(playAgain, 'click', () => {
    void this.replaceWith(this.mode, this.difficulty);
  });
  heading.focus();
};

YardController.prototype.fail = function fail(error) {
  if (this.disposed || this.finished || this.errorRendered) return;
  const failure = error instanceof Error ? error : new Error(String(error));
  this.lifecycle.fail(failure);
};

YardController.prototype.renderError = function renderError(error) {
  if (this.errorRendered) return;
  this.errorRendered = true;
  void this.audio.pause();
  void this.audio.dispose();
  const run = this.persistence.store.runs[GAME];
  if (run) this.persistence.abandon(run.signature);
  for (const cleanup of this.passiveCleanups) cleanup();
  this.passiveCleanups.clear();
  this.announcer.dispose();
  this.audioControls.dispose();
  renderGameError(this.root, {
    title: 'Kinnoki Yard paused',
    message: error.message || 'This game could not continue safely.',
    newGameHref: '/games/kinnoki-yard?mode=' + this.mode
      + '&difficulty=' + this.difficulty,
  });
};

YardController.prototype.cleanup = function cleanup() {
  if (this.disposed) return;
  this.disposed = true;
  for (const cleanup of this.passiveCleanups) cleanup();
  this.passiveCleanups.clear();
  this.announcer.dispose();
  this.audioControls.dispose();
  void this.audio.dispose();
};

YardController.prototype.dispose = function dispose() {
  if (this.disposed) return;
  this.lifecycle.dispose();
  this.cleanup();
};
~~~

- [ ] **Step 18: Add exact dependency defaults and the exported renderer**

Append the mount/export code. It resolves a saved mode/difficulty conflict before generation and returns one stable disposer across internal remounts:

~~~js
const normalizedDependencies = (dependencies) => ({
  storage: dependencies.storage ?? safeLocalStorage(globalThis),
  wallNow: dependencies.wallNow ?? (() => Date.now()),
  monotonicNow: dependencies.monotonicNow ?? (() => performance.now()),
  seedFactory: dependencies.seedFactory ?? defaultSeedFactory,
  audioFactory: dependencies.audioFactory ?? createGameAudio,
  confirm: dependencies.confirm ?? ((message) => window.confirm(message)),
  engine: dependencies.engine ?? defaultYardEngine,
});

async function mountYard(root, initialStore, dependencies, slot, options = {}) {
  const persistence = new YardPersistence({
    storage: dependencies.storage,
    store: initialStore,
    wallNow: dependencies.wallNow,
  });
  const params = new URLSearchParams(globalThis.location?.search ?? '');
  const requestedMode = options.forcedMode ?? params.get('mode');
  const requestedDifficulty = options.forcedDifficulty ?? params.get('difficulty');
  let mode = MODES.includes(requestedMode) ? requestedMode : 'contracts';
  let difficulty = DIFFICULTIES.includes(requestedDifficulty)
    ? requestedDifficulty : 'easy';
  let abandonedSignature = options.abandonedSignature ?? null;
  let focusRetainedEntry = false;
  const existing = persistence.store.runs[GAME];

  try {
    if (existing && !options.previewDefinition) {
      if (!validStoredYardRun(existing, dependencies.engine)) {
        persistence.abandon(existing.signature);
        throw new Error('Saved Kinnoki Yard state is invalid.');
      }
      if (existing.mode !== mode || existing.difficulty !== difficulty) {
        const accepted = dependencies.confirm(
          'Replace the saved ' + modeLabel(existing.mode) + ' · '
            + titleCase(existing.difficulty) + ' game?',
        );
        if (accepted) {
          abandonedSignature = existing.signature;
          persistence.abandon(existing.signature);
        } else {
          mode = existing.mode;
          difficulty = existing.difficulty;
          focusRetainedEntry = true;
        }
      }
    }

    const model = selectYardModel({
      store: persistence.store,
      mode,
      difficulty,
      seedFactory: dependencies.seedFactory,
      engine: dependencies.engine,
      abandonedSignature,
      previewDefinition: options.previewDefinition ?? null,
    });
    const controller = new YardController({
      root, model, persistence, dependencies, slot,
    });
    if (focusRetainedEntry) controller.focusEntryControl();
    return controller;
  } catch (error) {
    renderGameError(root, {
      title: 'Kinnoki Yard paused',
      message: error.message || 'A new Yard game could not be prepared.',
      newGameHref: '/games/kinnoki-yard?mode=' + mode
        + '&difficulty=' + difficulty,
    });
    return { dispose() {} };
  }
}

export async function renderKinnokiYard(root, store, dependencies = {}) {
  const slot = { current: null };
  const resolved = normalizedDependencies(dependencies);
  const publicController = {
    dispose() { slot.current?.dispose(); },
  };
  slot.current = await mountYard(root, store, resolved, slot);
  return publicController;
}
~~~

- [ ] **Step 19: Run Yard controller and engine suites**

Run:

~~~bash
node --test Tests/games/kinnoki-yard-ui.test.mjs Tests/games/kinnoki-yard-solver.test.mjs Tests/games/kinnoki-yard-generator.test.mjs Tests/games/kinnoki-yard-contracts.test.mjs Tests/games/kinnoki-yard-endless.test.mjs Tests/games/game-audio.test.mjs Tests/games/game-lifecycle.test.mjs
~~~

Expected: PASS for both modes, no-drag keyboard/touch play, roving focus, pan, Hint/Undo differences, terminal accounting, save/resume, audio, and cleanup.

- [ ] **Step 20: Commit the Yard interface**

~~~bash
git add Resources/games/kinnoki-yard-ui.js Tests/games/kinnoki-yard-ui.test.mjs
git commit -m "feat(games): add Kinnoki Yard interface"
~~~


---

### Task 12: Five-game Arcade Hall, typed records, Continue, and reset

**Files:**
- Modify: `Resources/games/hub-ui.js:1-213`
- Create: `Tests/games/hub-five-games.test.mjs`
- Modify: `Tests/games/core.test.mjs`

**Interfaces:**
- Consumes: Store v2 mode buckets and current hub rendering.
- Produces: exported `GAMES`, `formatRecord(type, value)`, five-card `gameCardModel`/`statsModel`, Yard mode-first links, mode-aware Continue, and expanded reset semantics.

- [ ] **Step 1: Write failing five-card, mode-aware Continue, and typed-record tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyGameStore } from '../../Resources/games/core.js';
import {
  formatRecord, gameCardModel, renderHubMarkup,
} from '../../Resources/games/hub-ui.js';

test('hub renders five cards without stale three-game language', () => {
  const markup = renderHubMarkup(createEmptyGameStore());
  for (const title of [
    'Sudoku', 'Crossword', 'Word Search', 'Kinnoki Stack', 'Kinnoki Yard',
  ]) assert.match(markup, new RegExp('<h2[^>]*>' + title + '</h2>'));
  assert.equal([...markup.matchAll(/<article class="game-card/g)].length, 5);
  assert.doesNotMatch(markup, /three familiar|three classics|three games/i);
});

test('Yard Continue preserves saved mode and difficulty', () => {
  const store = createEmptyGameStore();
  store.runs['kinnoki-yard'] = {
    game: 'kinnoki-yard', mode: 'endless', difficulty: 'hard',
    seed: 4, signature: 'yard-4', puzzle: {}, startedAt: 1,
    elapsedBeforeStartMs: 2, assisted: false,
  };
  const card = gameCardModel(store, {
    id: 'kinnoki-yard', title: 'Kinnoki Yard',
    modes: [{ id: 'contracts' }, { id: 'endless' }],
  });
  assert.equal(card.continueHref,
    '/games/kinnoki-yard?mode=endless&difficulty=hard&continue=1');
  assert.equal(card.continueLabel, 'Continue Endless Yard · Hard');
});

test('record types never share a formatter', () => {
  assert.equal(formatRecord('time', 61500), '1:01');
  assert.equal(formatRecord('moves', 31), '31 moves');
  assert.equal(formatRecord('score', 12340), '12,340');
  assert.equal(formatRecord('combo', 7), '7×');
});
```

- [ ] **Step 2: Write failing completion-accounting and reset-copy tests**

```js
import {
  abandonRun, completeRun, markAssisted, startRun,
} from '../../Resources/games/core.js';

test('zero-dispatch terminals count and assisted runs preserve unassisted records', () => {
  let store = createEmptyGameStore();
  store = startRun(store, {
    game: 'kinnoki-stack', mode: 'default', difficulty: 'easy', seed: 1,
    signature: 'stack-1', puzzle: {}, now: 0,
  });
  store = completeRun(store, {
    game: 'kinnoki-stack', mode: 'default', now: 1000,
    records: { score: 0, combo: 0 },
  });
  assert.equal(store.stats.totalCompleted, 1);
  assert.equal(store.stats.games['kinnoki-stack'].modes.default.completed, 1);
  assert.equal(store.stats.games['kinnoki-stack'].modes.default.records.score.easy, 0);

  store = startRun(store, {
    game: 'kinnoki-stack', mode: 'default', difficulty: 'easy', seed: 2,
    signature: 'stack-2', puzzle: {}, now: 2000,
  });
  store = markAssisted(store, 'kinnoki-stack');
  store = completeRun(store, {
    game: 'kinnoki-stack', mode: 'default', now: 3000,
    records: { score: 9999, combo: 8 },
  });
  assert.equal(store.stats.totalCompleted, 2);
  assert.equal(store.stats.games['kinnoki-stack'].modes.default.records.score.easy, 0);
  assert.equal(store.stats.games['kinnoki-stack'].modes.default.records.combo.easy, 0);
});

test('abandoned replacement changes no completion accounting', () => {
  let store = startRun(createEmptyGameStore(), {
    game: 'kinnoki-yard', mode: 'endless', difficulty: 'hard', seed: 8,
    signature: 'yard-8', puzzle: {}, now: 100,
  });
  const before = structuredClone(store.stats);
  store = abandonRun(store, { game: 'kinnoki-yard', expectedSignature: 'yard-8' });
  assert.deepEqual(store.stats, before);
  assert.equal(store.runs['kinnoki-yard'], undefined);
  assert.equal(store.previousSignatures['kinnoki-yard:endless'], undefined);
});

test('reset explanation names every locally removed game-data category', () => {
  const markup = renderHubMarkup(createEmptyGameStore());
  for (const phrase of [
    'unfinished games', 'totals', 'streaks', 'time', 'moves', 'scores',
    'combos', 'music', 'effects',
  ]) assert.match(markup, new RegExp(phrase, 'i'));
});
```

- [ ] **Step 3: Run hub/core tests and verify the three-card assumptions fail**

Run: `node --test Tests/games/hub-five-games.test.mjs Tests/games/core.test.mjs`
Expected: FAIL on five-card catalogue, mode links, and typed formatters.

- [ ] **Step 4: Replace the catalogue with five declarative card records**

Replace the current GAMES declaration, DIFFICULTIES, and GAME_IDS with this complete catalogue. The three existing descriptions stay unchanged; only Stack and Yard are added:

~~~js
export const GAMES = Object.freeze([
  {
    id: 'sudoku',
    title: 'Sudoku',
    eyebrow: 'Logic',
    description: 'Settle into a clean number puzzle with a difficulty that fits the moment.',
    symbol: '9',
    modes: [{ id: 'default', label: 'New puzzle' }],
    records: ['time'],
  },
  {
    id: 'crossword',
    title: 'Crossword',
    eyebrow: 'Words',
    description: 'Follow thoughtful clues through a compact, themed crossword.',
    symbol: 'A',
    modes: [{ id: 'default', label: 'New puzzle' }],
    records: ['time'],
  },
  {
    id: 'word-search',
    title: 'Word Search',
    eyebrow: 'Discovery',
    description: 'Scan a calm letter grid for words gathered around a shared theme.',
    symbol: 'W',
    modes: [{ id: 'default', label: 'New puzzle' }],
    records: ['time'],
  },
  {
    id: 'kinnoki-stack',
    title: 'Kinnoki Stack',
    eyebrow: 'Cargo arcade',
    description: 'Guide falling cargo into manifests while forecast tides reshape the dock.',
    symbol: 'S',
    modes: [{ id: 'default', label: 'New run' }],
    records: ['score', 'combo'],
  },
  {
    id: 'kinnoki-yard',
    title: 'Kinnoki Yard',
    eyebrow: 'Harbour packing',
    description: 'Solve calm packing contracts or build an endless manifest-clearing yard.',
    symbol: 'Y',
    modes: [
      { id: 'contracts', label: 'Puzzle Contracts' },
      { id: 'endless', label: 'Endless Yard' },
    ],
    records: ['time', 'moves', 'score', 'combo'],
  },
]);

const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
const GAME_IDS = Object.freeze(GAMES.map(({ id }) => id));
~~~

- [ ] **Step 5: Add the exact typed record formatter**

Replace formatTime with this exported formatter. It rejects invalid values, floors finite values, clamps to Number.MAX_SAFE_INTEGER, and never lets record types share presentation:

~~~js
const normalizedRecord = (value) => {
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER);
};

export function formatRecord(type, value) {
  const record = normalizedRecord(value);
  if (record === null) return '—';
  if (type === 'time') {
    const totalSeconds = Math.floor(record / 1000);
    return Math.floor(totalSeconds / 60) + ':'
      + String(totalSeconds % 60).padStart(2, '0');
  }
  if (type === 'moves') return record + ' moves';
  if (type === 'score') return record.toLocaleString('en-CA');
  if (type === 'combo') return record + '×';
  return '—';
}

const modeContinueLabel = (game, mode, difficulty) => {
  if (game === 'kinnoki-yard') {
    const label = mode === 'endless' ? 'Endless Yard' : 'Puzzle Contract';
    return 'Continue ' + label + ' · ' + titleCase(difficulty);
  }
  return 'Continue ' + titleCase(difficulty);
};

const gameModeConfig = (game) => (
  GAMES.find(({ id }) => id === game.id)?.modes ?? [{ id: 'default', label: 'New puzzle' }]
);
~~~

- [ ] **Step 6: Implement mode-first action and Continue models**

Replace gameCardModel with this exact implementation. Existing single-mode cards retain their old difficulties array and Continue copy; Yard exposes mode groups and includes the saved mode in its Continue URL:

~~~js
export function gameCardModel(store, game) {
  if (!GAME_IDS.includes(game?.id)) return null;
  const configured = GAMES.find(({ id }) => id === game.id);
  const modes = Array.isArray(game.modes) && game.modes.length
    ? game.modes.map((mode) => ({
      id: mode.id,
      label: mode.label ?? (mode.id === 'endless' ? 'Endless Yard' : 'Puzzle Contracts'),
    }))
    : gameModeConfig(configured);
  const run = store.runs?.[game.id];
  const difficulty = DIFFICULTIES.includes(run?.difficulty) ? run.difficulty : null;
  const mode = modes.some(({ id }) => id === run?.mode)
    ? run.mode
    : run?.mode == null && modes.some(({ id }) => id === 'default')
      ? 'default' : null;
  const basePath = '/games/' + game.id;
  const hrefFor = (modeId, value) => (
    modeId === 'default'
      ? basePath + '?difficulty=' + value
      : basePath + '?mode=' + modeId + '&difficulty=' + value
  );
  const modeGroups = modes.map((entry) => ({
    ...entry,
    difficulties: DIFFICULTIES.map((value) => ({
      label: titleCase(value),
      href: hrefFor(entry.id, value),
    })),
  }));
  return {
    ...configured,
    ...game,
    modes,
    modeGroups,
    difficulties: modeGroups[0].difficulties,
    continueHref: difficulty && mode
      ? hrefFor(mode, difficulty) + '&continue=1'
      : null,
    continueLabel: difficulty && mode
      ? modeContinueLabel(game.id, mode, difficulty)
      : null,
  };
}
~~~

- [ ] **Step 7: Compute typed v2 record summaries**

Replace statsModel and its v2 helper with the complete implementation below. The original three game objects retain the exact completed/best shape used by existing tests:

~~~js
const modeStats = (store, game, mode) => (
  store.stats?.games?.[game]?.modes?.[mode] ?? null
);

const legacyDefaultStats = (store, game) => {
  const legacy = store.stats?.games?.[game];
  return legacy && !legacy.modes ? {
    completed: legacy.completed,
    records: { time: legacy.bestMs },
  } : null;
};

const recordValues = (bucket, type) => DIFFICULTIES
  .map((difficulty) => bucket?.records?.[type]?.[difficulty])
  .filter((value) => normalizedRecord(value) !== null);

const bestRecord = (bucket, type, strategy) => {
  const values = recordValues(bucket, type);
  if (!values.length) return '—';
  return formatRecord(type,
    strategy === 'min' ? Math.min(...values) : Math.max(...values));
};

export function statsModel(store) {
  const games = Object.fromEntries(GAMES.map((game) => {
    if (['sudoku', 'crossword', 'word-search'].includes(game.id)) {
      const bucket = modeStats(store, game.id, 'default')
        ?? legacyDefaultStats(store, game.id);
      const completed = nonNegativeInteger(bucket?.completed);
      return [game.id, {
        completed: completed + ' completed',
        best: bestRecord(bucket, 'time', 'min'),
      }];
    }
    if (game.id === 'kinnoki-stack') {
      const bucket = modeStats(store, game.id, 'default');
      const completed = nonNegativeInteger(bucket?.completed);
      return [game.id, {
        completed: completed + ' completed',
        best: bestRecord(bucket, 'score', 'max'),
        combo: bestRecord(bucket, 'combo', 'max'),
      }];
    }
    const contracts = modeStats(store, game.id, 'contracts');
    const endless = modeStats(store, game.id, 'endless');
    const completed = nonNegativeInteger(
      nonNegativeInteger(contracts?.completed)
        + nonNegativeInteger(endless?.completed),
    );
    return [game.id, {
      completed: completed + ' completed',
      best: bestRecord(contracts, 'time', 'min'),
      moves: bestRecord(contracts, 'moves', 'min'),
      score: bestRecord(endless, 'score', 'max'),
      combo: bestRecord(endless, 'combo', 'max'),
    }];
  }));
  const total = nonNegativeInteger(store.stats?.totalCompleted);
  const streak = nonNegativeInteger(store.stats?.currentStreak);
  return {
    total: String(total),
    totalLabel: total === 1 ? 'Game completed' : 'Games completed',
    streak: String(streak),
    streakLabel: 'Day streak',
    games,
    zeroState: total === 0
      ? 'Your first puzzle or game finish will start the record book. '
        + 'Your progress stays on this device.'
      : total + ' ' + (total === 1 ? 'game' : 'games')
        + ' finished on this device.',
  };
}
~~~

- [ ] **Step 8: Render mode groups and typed card records**

Replace difficultyMarkup and cardMarkup with these exact renderers:

~~~js
const difficultyMarkup = (group) => group.difficulties.map(({ label, href }) => (
  '<a href="' + escapeHTML(href) + '">' + escapeHTML(label) + '</a>'
)).join('');

const modeGroupsMarkup = (card) => card.modeGroups.map((group) => (
  '<div class="difficulty-links" aria-label="Choose '
    + escapeHTML(card.title) + ' ' + escapeHTML(group.label) + ' difficulty">'
    + '<span>' + escapeHTML(group.label) + '</span>'
    + difficultyMarkup(group)
    + '</div>'
)).join('');

const recordMarkup = (game, stats) => {
  if (game.id === 'kinnoki-stack') return [
    '<div><dt>Best score</dt><dd>' + escapeHTML(stats.best) + '</dd></div>',
    '<div><dt>Best combo</dt><dd>' + escapeHTML(stats.combo) + '</dd></div>',
    '<div><dt>Finished</dt><dd>' + escapeHTML(stats.completed) + '</dd></div>',
  ].join('');
  if (game.id === 'kinnoki-yard') return [
    '<div><dt>Contract time</dt><dd>' + escapeHTML(stats.best) + '</dd></div>',
    '<div><dt>Contract moves</dt><dd>' + escapeHTML(stats.moves) + '</dd></div>',
    '<div><dt>Endless score</dt><dd>' + escapeHTML(stats.score) + '</dd></div>',
    '<div><dt>Endless combo</dt><dd>' + escapeHTML(stats.combo) + '</dd></div>',
    '<div><dt>Finished</dt><dd>' + escapeHTML(stats.completed) + '</dd></div>',
  ].join('');
  return [
    '<div><dt>Local record</dt><dd>' + escapeHTML(stats.best) + '</dd></div>',
    '<div><dt>Finished</dt><dd>' + escapeHTML(stats.completed) + '</dd></div>',
  ].join('');
};

const cardMarkup = (store, game) => {
  const card = gameCardModel(store, game);
  const stats = statsModel(store).games[game.id];
  return [
    '<article class="game-card game-card-' + escapeHTML(game.id) + '">',
    '<div class="game-card-topline">',
    '<p class="game-card-eyebrow">' + escapeHTML(card.eyebrow) + '</p>',
    '<span class="game-card-symbol" aria-hidden="true">'
      + escapeHTML(card.symbol) + '</span>',
    '</div>',
    '<h2>' + escapeHTML(card.title) + '</h2>',
    '<p class="game-card-description">' + escapeHTML(card.description) + '</p>',
    card.continueHref
      ? '<a class="btn btn-gold game-continue" href="'
        + escapeHTML(card.continueHref) + '">'
        + escapeHTML(card.continueLabel) + '</a>'
      : '',
    '<div class="game-mode-actions">' + modeGroupsMarkup(card) + '</div>',
    '<dl class="game-card-stats">' + recordMarkup(game, stats) + '</dl>',
    '</article>',
  ].join('');
};
~~~

- [ ] **Step 9: Replace the hub and reset copy exactly**

Replace renderHubMarkup with this complete five-card markup. Keep announce, dialog helpers, storage notice, and renderHub below it unchanged:

~~~js
export function renderHubMarkup(store) {
  const stats = statsModel(store);
  return [
    '<header class="games-hero">',
    '<p class="eyebrow">KinNoKi Arcade Hall</p>',
    '<h1 id="games-heading">A quiet place to play.</h1>',
    '<p>Five thoughtful games for quick focus or a longer challenge. '
      + 'Choose a difficulty, play at your pace, and come back whenever you like.</p>',
    '</header>',
    '<p class="game-storage-notice" role="status" aria-live="polite" hidden>',
    'Local progress is unavailable in this browser. '
      + 'You can still play, but this visit may not be saved.',
    '</p>',
    '<section class="game-card-grid" aria-labelledby="games-heading">',
    GAMES.map((game) => cardMarkup(store, game)).join(''),
    '</section>',
    '<section class="games-stats" aria-labelledby="local-stats-heading">',
    '<div><p class="eyebrow">On this device</p>',
    '<h2 id="local-stats-heading">Your local records</h2>',
    '<p>' + escapeHTML(stats.zeroState) + '</p></div>',
    '<dl class="games-stats-summary">',
    '<div><dt>' + escapeHTML(stats.totalLabel) + '</dt><dd>'
      + escapeHTML(stats.total) + '</dd></div>',
    '<div><dt>' + escapeHTML(stats.streakLabel) + '</dt><dd>'
      + escapeHTML(stats.streak) + '</dd></div>',
    '</dl>',
    '<button class="btn btn-gray games-reset" type="button" '
      + 'data-reset-games>Reset Game Data</button>',
    '</section>',
    '<dialog class="game-dialog" data-reset-dialog aria-labelledby="reset-dialog-title">',
    '<form method="dialog"><p class="eyebrow">Local data</p>',
    '<h2 id="reset-dialog-title">Reset all game data?</h2>',
    '<p>This removes unfinished games, totals, streaks, time and moves records, '
      + 'scores, combos, and music and effects preferences from this device.</p>',
    '<div class="game-dialog-actions">',
    '<button class="btn btn-gray" type="button" '
      + 'data-dialog-cancel>Keep My Data</button>',
    '<button class="btn game-danger" type="button" '
      + 'data-dialog-confirm>Reset Everything</button>',
    '</div></form></dialog>',
  ].join('');
}
~~~

- [ ] **Step 10: Run hub, core, and storage tests**

Run:

~~~bash
node --test Tests/games/hub-five-games.test.mjs Tests/games/core.test.mjs Tests/games/storage-v2.test.mjs
~~~

Expected: PASS for five cards, mode-first Yard actions, Continue labels, typed records, completion accounting, hostile-value clamping, and reset boundaries.

- [ ] **Step 11: Commit the expanded hub**

~~~bash
git add Resources/games/hub-ui.js Tests/games/hub-five-games.test.mjs Tests/games/core.test.mjs
git commit -m "feat(games): expand Arcade Hall to five games"
~~~

---

### Task 13: Cargo-family styling and accessibility regressions

**Files:**
- Modify: `Resources/styles.css:564-740`
- Modify: `Tests/games/accessibility.test.mjs`
- Modify: `Tests/games/controller-review.test.mjs`
- Regression test: `Tests/games/controller-second-review.test.mjs`
- Regression test: `Tests/games/final-review.test.mjs`
- Regression test: `Tests/games/kinnoki-stack-ui.test.mjs`
- Regression test: `Tests/games/kinnoki-yard-ui.test.mjs`

**Interfaces:**
- Consumes: semantic classes/attributes emitted by Tasks 10–12.
- Produces: five-card responsive layout, Stack/Yard boards and controls, non-colour states, 44-pixel targets, board-local scroll/pan, visible focus, reduced-motion behavior, and cross-game regression assertions.

- [ ] **Step 1: Write failing CSS/accessibility assertions**

Extend `accessibility.test.mjs` to require:

```js
test('cargo controls and Yard cells retain 44 CSS-pixel targets', () => {
  for (const selector of [
    '.stack-controls button', '.yard-controls button',
    '.yard-cell', '.yard-tray-piece', '.yard-pan-controls button',
    '.game-audio-controls button', '.game-audio-controls input[type="range"]',
  ]) {
    const body = ruleBody(selector);
    assert.match(body, /min-width:\s*44px/);
    assert.match(body, /min-height:\s*44px/);
  }
});

test('cargo state has non-colour patterns and local overflow containment', () => {
  for (const selector of [
    '.cargo-pattern-dots', '.cargo-pattern-diagonal',
    '.cargo-pattern-crosshatch', '.cargo-pattern-bands',
  ]) assert.match(ruleBody(selector), /background-image:/);
  assert.match(ruleBody('.yard-board-scroll'), /overflow:\s*auto/);
  assert.match(ruleBody('.games-app'), /overflow-x:\s*clip/);
});
```

Keep the existing `all game grids retain native control semantics inside row and gridcell roles` regression unchanged in `controller-review.test.mjs`. After Task 1B has added `createEmptyGameStore` to that file's core imports, append these exact cargo-controller assertions:

```js
const silentAudioFactory = () => ({
  start: async () => {}, resume: async () => {}, pause: async () => {},
  stop: async () => {}, finish() {}, dispose: async () => {},
  setPreferences() {}, setIntensity() {}, playEffect() {},
});

async function waitForControllerState(predicate, message) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail(message);
}

test('cargo grids, live regions, and automatic status use exact accessibility semantics', async () => {
  for (const game of [
    {
      search: '?difficulty=easy',
      path: '../../Resources/games/kinnoki-stack-ui.js',
      render: 'renderKinnokiStack',
      cell: '[role="gridcell"]',
      count: 216,
      tabStops: 0,
      automaticStatus: ['[data-timer]', '[data-stack-score]'],
    },
    {
      search: '?mode=contracts&difficulty=easy',
      path: '../../Resources/games/kinnoki-yard-ui.js',
      render: 'renderKinnokiYard',
      cell: '[data-yard-cell]',
      count: null,
      tabStops: 1,
      automaticStatus: ['[data-timer]', '[data-yard-moves]'],
    },
  ]) {
    const fixture = createDOMFixture({ search: game.search });
    const restore = installDOM(fixture);
    try {
      const module = await import(game.path);
      const controller = await module[game.render](
        fixture.root,
        createEmptyGameStore(),
        { audioFactory: silentAudioFactory },
      );
      const cells = fixture.root.querySelectorAll(game.cell);
      if (game.count !== null) assert.equal(cells.length, game.count);
      assert.ok(cells.length > 0);
      assert.equal(
        cells.filter((cell) => cell.getAttribute('tabindex') === '0').length,
        game.tabStops,
      );
      if (game.tabStops === 0) {
        assert.ok(cells.every((cell) => cell.getAttribute('tabindex') === '-1'));
      }
      const eventRegion = fixture.root.querySelector('.games-live-region');
      assert.equal(eventRegion.getAttribute('role'), 'status');
      assert.equal(eventRegion.getAttribute('aria-live'), 'polite');
      for (const selector of game.automaticStatus) {
        assert.equal(fixture.root.querySelector(selector).getAttribute('aria-live'), null);
      }
      controller.dispose();
      assert.equal(fixture.document.listenerCount('keydown'), 0);
      assert.equal(fixture.activeFrameCount(), 0);
    } finally { restore(); }
  }
});

test('Stack terminal rendering focuses the summary and disposal clears active resources', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const stack = await import('../../Resources/games/kinnoki-stack.js');
    const engine = {
      ...stack,
      reduceStack(state, action) {
        if (action.type !== 'hard-drop') return stack.reduceStack(state, action);
        return {
          state: {
            ...state,
            status: 'terminal',
            terminalReason: 'crane-line',
            score: 0,
            combo: 0,
            bestCombo: 0,
            dispatchedManifests: 0,
          },
          events: [{ type: 'terminal', reason: 'crane-line' }],
        };
      },
    };
    const { renderKinnokiStack } = await import(
      '../../Resources/games/kinnoki-stack-ui.js'
    );
    const controller = await renderKinnokiStack(
      fixture.root,
      createEmptyGameStore(),
      { engine, audioFactory: silentAudioFactory },
    );
    fixture.root.querySelector('[data-start-game]').click();
    await waitForControllerState(
      () => fixture.root.querySelector('[data-stack-hard-drop]').disabled === false,
      'Stack never entered observable active state',
    );
    fixture.root.querySelector('[data-stack-hard-drop]').click();
    const heading = fixture.root.querySelector('[data-complete-heading]');
    assert.equal(fixture.document.activeElement, heading);
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
    controller.dispose();
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
  } finally { restore(); }
});
```

- [ ] **Step 2: Run the focused accessibility suite and verify missing selectors**

Run: `node --test Tests/games/accessibility.test.mjs Tests/games/kinnoki-stack-ui.test.mjs Tests/games/kinnoki-yard-ui.test.mjs`
Expected: FAIL on missing cargo-family rules.

- [ ] **Step 3: Replace the card grid and add shared cargo control sizing**

Replace the existing game-card-grid rule with the first rule below, then append the remaining exact shared rules beside the current shared controller layout:

~~~css
.game-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
  gap: clamp(14px, 2vw, 20px);
}

.game-preplay,
.game-status-grid,
.game-audio-controls,
.stack-controls,
.yard-controls,
.yard-pan-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.stack-controls button {
  min-width: 44px;
  min-height: 44px;
}
.yard-controls button {
  min-width: 44px;
  min-height: 44px;
}
.yard-cell {
  min-width: 44px;
  min-height: 44px;
}
.yard-tray-piece {
  min-width: 44px;
  min-height: 44px;
}
.yard-pan-controls button {
  min-width: 44px;
  min-height: 44px;
}
.game-audio-controls button {
  min-width: 44px;
  min-height: 44px;
}
.game-audio-controls input[type="range"] {
  min-width: 132px;
  min-height: 44px;
}
~~~

Use only the existing game text, gold, fill, surface, and separator variables in all following cargo rules.

- [ ] **Step 4: Add the complete Stack dock and non-colour state rules**

Append this Stack block after the shared controller layout. It uses the emitted 12-column grid, fixed cell geometry, a labelled crane line, borders, patterns, and textual status outside the board; it does not introduce a seven-piece colour map:

~~~css
.stack-game {
  min-width: 0;
}
.stack-dock {
  position: relative;
  width: min(100%, calc(12 * 44px));
  margin-inline: auto;
  overflow: hidden;
  background: var(--surface);
  border: 2px solid var(--game-text-primary);
  border-radius: 12px;
}
.stack-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  width: 100%;
  aspect-ratio: 2 / 3;
}
.stack-row {
  display: contents;
}
.stack-cell {
  display: grid;
  min-width: 0;
  min-height: 0;
  place-items: center;
  color: var(--game-text-primary);
  background-color: var(--surface);
  border-right: 1px solid var(--separator);
  border-bottom: 1px solid var(--separator);
  font-family: var(--font-mono);
  font-size: clamp(0.55rem, 2vw, 0.9rem);
}
.stack-crane-line {
  position: absolute;
  z-index: 2;
  inset: calc(4 / 18 * 100%) 0 auto;
  height: 0;
  overflow: visible;
  color: var(--game-text-accent);
  border-top: 3px double currentColor;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  text-align: right;
}
.stack-cargo-active {
  border: 3px solid var(--game-text-accent);
  animation: cargo-active-pulse 700ms ease-in-out infinite alternate;
}
.stack-cargo-settled {
  border: 2px solid var(--game-text-primary);
}
.stack-manifest-cell {
  outline: 2px dashed var(--game-text-accent);
  outline-offset: -3px;
}
.stack-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0;
  list-style: none;
}
.stack-preview li {
  padding: 8px 10px;
  color: var(--game-text-primary);
  background-color: var(--surface-2);
  border: 1px solid var(--separator);
  border-radius: 8px;
}
.cargo-pattern-dots {
  background-image: radial-gradient(currentColor 1px, transparent 1px);
  background-size: 7px 7px;
}
.cargo-pattern-diagonal {
  background-image:
    repeating-linear-gradient(135deg, transparent 0 5px, currentColor 5px 6px);
}
.cargo-pattern-crosshatch {
  background-image:
    repeating-linear-gradient(45deg, transparent 0 6px, currentColor 6px 7px),
    repeating-linear-gradient(135deg, transparent 0 6px, currentColor 6px 7px);
}
.cargo-pattern-bands {
  background-image:
    repeating-linear-gradient(90deg, transparent 0 7px, currentColor 7px 9px);
}
@keyframes cargo-active-pulse {
  from { outline: 1px solid transparent; }
  to { outline: 3px solid var(--game-text-accent); }
}
~~~

- [ ] **Step 5: Add the complete Yard board, tray, selection, and pan rules**

Append this Yard block. The board owns horizontal overflow and its content width is exactly 44 CSS pixels times the emitted column count, so 200 percent zoom never widens the page:

~~~css
.yard-game,
.yard-board-column {
  min-width: 0;
}
.yard-board-scroll {
  width: 100%;
  max-width: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  border: 2px solid var(--game-text-primary);
  border-radius: 12px;
  background: var(--surface);
  scroll-behavior: smooth;
}
.yard-grid {
  display: grid;
  grid-template-columns: repeat(var(--yard-columns), 44px);
  width: calc(var(--yard-columns) * 44px);
}
.yard-row {
  display: contents;
}
.yard-gridcell {
  display: flex;
  min-width: 44px;
  min-height: 44px;
}
.yard-cell {
  width: 44px;
  height: 44px;
  padding: 0;
  color: var(--game-text-primary);
  background-color: var(--surface);
  border: 1px solid var(--separator);
  border-radius: 0;
  font-family: var(--font-mono);
}
.yard-cell-target {
  border: 2px dashed var(--game-text-tertiary);
}
.yard-cell-manifest {
  outline: 2px dashed var(--game-text-accent);
  outline-offset: -4px;
}
.yard-cell-selected {
  position: relative;
  z-index: 1;
  border: 3px double var(--game-text-accent);
}
.yard-cell-placed {
  border: 3px solid var(--game-text-primary);
}
.yard-cell-invalid {
  border: 4px double var(--game-text-primary);
  background-image:
    repeating-linear-gradient(135deg, transparent 0 6px, currentColor 6px 8px);
}
.yard-cell-hint {
  outline: 4px dotted var(--game-text-accent);
  outline-offset: -5px;
}
.yard-tray {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.yard-tray-piece {
  padding: 8px 12px;
  color: var(--game-text-primary);
  background-color: var(--surface-2);
  border: 2px solid var(--separator);
  border-radius: 9px;
  text-align: left;
}
.yard-tray-piece.is-selected {
  border: 4px double var(--game-text-accent);
}
.yard-tray-piece.is-placed {
  text-decoration: line-through;
  border-style: dashed;
}
.yard-pan-controls {
  justify-content: space-between;
  margin-top: 10px;
}
.yard-cell:focus-visible,
.yard-tray-piece:focus-visible,
.yard-pan-controls button:focus-visible {
  outline: 3px solid var(--gold-text);
  outline-offset: 3px;
}
body.font-opendyslexic .yard-cell:focus-visible,
body.font-opendyslexic .yard-tray-piece:focus-visible {
  outline-width: 4px;
}
~~~

- [ ] **Step 6: Add exact narrow-layout behavior**

Append this media block after the existing max-width 759px block. Stack remains one column, control groups wrap, Yard pan stays visible, and only the Yard board scrolls:

~~~css
@media (max-width: 759px) {
  .stack-game .game-status-grid,
  .yard-game .game-status-grid {
    display: grid;
    grid-template-columns: 1fr;
  }

  .stack-controls,
  .yard-controls,
  .game-audio-controls {
    align-items: stretch;
  }

  .stack-controls button,
  .yard-controls button {
    flex: 1 1 8rem;
  }

  .yard-pan-controls {
    display: flex;
  }

  .yard-board-scroll {
    max-width: 100%;
  }
}
~~~

- [ ] **Step 7: Add a failing reduced-motion regression**

Append this exact test to Tests/games/accessibility.test.mjs:

~~~js
test('cargo motion and board panning have reduced-motion overrides', () => {
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.stack-cargo-active[\s\S]*?animation:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.cargo-dispatching[\s\S]*?transition:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.cargo-tide-shifting[\s\S]*?transform:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.yard-board-scroll[\s\S]*?scroll-behavior:\s*auto/);
});
~~~

Run:

~~~bash
node --test Tests/games/accessibility.test.mjs
~~~

Expected: FAIL because the exact cargo reduced-motion overrides are absent.

- [ ] **Step 8: Add the exact reduced-motion override**

Append this separate media block. Do not change audio preference selectors or the existing visually-hidden live-region technique:

~~~css
@media (prefers-reduced-motion: reduce) {
  .stack-cargo-active,
  .cargo-dispatching,
  .cargo-tide-shifting {
    animation: none;
    transition: none;
    transform: none;
  }

  .yard-board-scroll {
    scroll-behavior: auto;
  }
}
~~~

- [ ] **Step 9: Run accessibility and controller review suites**

Run:

~~~bash
node --test Tests/games/accessibility.test.mjs Tests/games/controller-review.test.mjs Tests/games/controller-second-review.test.mjs Tests/games/final-review.test.mjs Tests/games/kinnoki-stack-ui.test.mjs Tests/games/kinnoki-yard-ui.test.mjs
~~~

Expected: PASS for contrast tokens, 44-pixel targets, patterns, roving focus, non-tabbable Stack grid, local overflow, reduced motion, event-only live regions, terminal focus, and cleanup.

- [ ] **Step 10: Commit styling and accessibility regressions**

~~~bash
git add Resources/styles.css Tests/games/accessibility.test.mjs Tests/games/controller-review.test.mjs
git commit -m "feat(games): style accessible cargo games"
~~~

---

### Task 14A: Public routes, bootstrap, artwork, and generated output

**Files:**
- Create: `Content/games/kinnoki-stack.md`
- Create: `Content/games/kinnoki-yard.md`
- Modify: `Content/games.md:1-4`
- Modify: `Resources/games/ui.js:1-21`
- Modify: `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift:86-104`
- Replace: `Resources/images/games/og.png`
- Modify: `Tests/games/routes.test.mjs:1-31`
- Modify: `AGENTS.md:39-40`
- Modify: `CLAUDE.md:39-40`
- Generate: `Output/**` with `make generate`

**Interfaces:**
- Consumes: completed controllers, validators, hub, styles, and Publish page discovery.
- Produces: six generated destinations (hub plus five games), validator-aware bootstrap, original shared social art, current repo documentation, and one committed source-plus-generated-output integration change. Task 14B owns PR/preview evidence; Task 14C owns post-merge production proof.

- [ ] **Step 1: Write failing route/resource/metadata regression tests**

```js
for (const resource of [
  'cargo-geometry.js', 'kinnoki-stack.js', 'kinnoki-yard.js', 'game-audio.js',
  'sudoku-ui.js', 'crossword-ui.js', 'word-search-ui.js',
  'kinnoki-stack-ui.js', 'kinnoki-yard-ui.js',
]) {
  test(resource + ' is shipped with generated game resources', () => {
    assert.equal(existsSync(new URL('../../Output/games/' + resource,
      import.meta.url)), true);
  });
}

for (const [route, page] of [
  ['games', 'hub'],
  ['games/sudoku', 'sudoku'],
  ['games/crossword', 'crossword'],
  ['games/word-search', 'word-search'],
  ['games/kinnoki-stack', 'kinnoki-stack'],
  ['games/kinnoki-yard', 'kinnoki-yard'],
]) {
  test(route + ' has the game shell, module, navigation, and current metadata', () => {
    const html = readFileSync(new URL('../../Output/' + route + '/index.html',
      import.meta.url), 'utf8');
    assert.match(html, new RegExp('data-game-page="' + page + '"'));
    assert.match(html, /type="module"[^>]+src="\/games\/ui\.js"/);
    assert.match(html, /og:image[^>]+\/images\/games\/og\.png/);
    assert.equal([...html.matchAll(/href="\/games"[^>]*aria-current="page"/g)].length, 2);
    assert.doesNotMatch(html, /three familiar|three classics|three games/i);
  });
}
```

- [ ] **Step 2: Add metadata-only content pages and route markers**

`Content/games.md`:

```markdown
---
title: Games
description: Play five unlimited puzzle and cargo games from KinNoKi Labs, each with three difficulty levels and local progress.
image: /images/games/og.png
---
```

`Content/games/kinnoki-stack.md`:

```markdown
---
title: Kinnoki Stack
description: Guide falling cargo into manifests through three difficulty levels, forecast tides, Step Mode, and adaptive original music.
image: /images/games/og.png
---
```

`Content/games/kinnoki-yard.md`:

```markdown
---
title: Kinnoki Yard
description: Pack guaranteed-solvable cargo contracts or build an Endless Yard through three difficulty levels with adaptive original music.
image: /images/games/og.png
---
```

Add these exact Swift switch cases beside the existing game cases in
`makePageHTML(for:context:)`:

```swift
case "games/kinnoki-stack":
    main = gamesMain(page: "kinnoki-stack")
    active = "/games"
case "games/kinnoki-yard":
    main = gamesMain(page: "kinnoki-yard")
    active = "/games"
```

- [ ] **Step 3: Implement validator-aware bootstrap and both lazy controllers**

Replace `Resources/games/ui.js` with this validator-aware bootstrap. Existing
controllers keep the same two-argument call, and only the selected controller
is imported:

```js
import { openGameStore, saveGameStore } from './core.js';
import { renderGameError } from './controller-common.js';
import { renderHub, safeLocalStorage, showStorageFailureNotice } from './hub-ui.js';
import { validateStackState } from './kinnoki-stack.js';
import { validateYardState } from './kinnoki-yard.js';

const root = document.getElementById('games-app');
const page = document.querySelector('[data-game-page]')?.dataset.gamePage;
const storage = safeLocalStorage(globalThis);

const runValidators = Object.freeze({
  'kinnoki-stack': (run) => (
    validateStackState(run?.puzzle?.play, run?.difficulty).valid
  ),
  'kinnoki-yard': (run) => (
    validateYardState(run?.puzzle?.play, run?.difficulty, run?.mode).valid
  ),
});

async function main() {
  const opened = openGameStore(storage, { runValidators });
  const store = opened.store;
  const saved = saveGameStore(storage, store);
  const controllers = {
    hub: () => renderHub(root, store),
    sudoku: () => import('./sudoku-ui.js')
      .then(({ renderSudoku }) => renderSudoku(root, store)),
    crossword: () => import('./crossword-ui.js')
      .then(({ renderCrossword }) => renderCrossword(root, store)),
    'word-search': () => import('./word-search-ui.js')
      .then(({ renderWordSearch }) => renderWordSearch(root, store)),
    'kinnoki-stack': () => import('./kinnoki-stack-ui.js')
      .then(({ renderKinnokiStack }) => renderKinnokiStack(root, store)),
    'kinnoki-yard': () => import('./kinnoki-yard-ui.js')
      .then(({ renderKinnokiYard }) => renderKinnokiYard(root, store)),
  };
  const controller = controllers[page];
  if (!controller) throw new Error(`Unknown games page: ${page}`);
  const result = await controller();
  if (opened.migration?.state === 'memory-only' || !saved.ok) {
    showStorageFailureNotice(root);
  }
  return result;
}

main().catch(() => {
  renderGameError(root, {
    title: 'Game paused',
    message: 'This game could not start. Reload the page or start a new game.',
    newGameHref: globalThis.location?.pathname ?? '/games',
  });
});
```

- [ ] **Step 4: Replace the shared social raster with original five-game artwork**

Use the `imagegen` skill during implementation with this exact brief:

> Create an original 1734-by-907 KinNoKi Arcade Hall social card in a graphite-black and metallic-gold studio style. Show five abstract, clearly distinct game vignettes: a 9-cell number grid, a crossing word grid, a letter-search grid, an irregular cargo dock with manifest outlines and a tide arrow, and a calm packing yard with a tray. Use geometric cargo clusters of mixed two-to-five-cell sizes, not a recognizable seven-piece set. Include the words “KinNoKi Arcade Hall” and “Five ways to play.” Do not depict or name Tetris, tetrominoes, branded game assets, or copied trade dress. Keep all text inside a generous social-safe margin and retain strong contrast.

Inspect the raster at original resolution before replacing `Resources/images/games/og.png`. Confirm all five vignettes are legible, studio casing is correct, there is no stale “Three classics” text, and no visual resembles prohibited branding. Keep the existing public filename so all pages share it.

- [ ] **Step 5: Run the route test and verify the red state**

Run only the route test before generation:

```bash
node --test Tests/games/routes.test.mjs
```

Expected: FAIL because the two generated routes and new copied resources do not
exist in `Output/` yet. Do not create or patch those generated files to make this
step pass.

- [ ] **Step 6: Generate `Output/` exclusively from source**

Run the repository generator; this is the only operation in the task that
creates or changes files under `Output/`:

```bash
set -euo pipefail
make generate
test -f Output/games/kinnoki-stack/index.html
test -f Output/games/kinnoki-yard/index.html
test -f Output/games/kinnoki-stack-ui.js
test -f Output/games/kinnoki-yard-ui.js
```

Expected: generation succeeds and all four generated files exist. Never use
`apply_patch`, a text editor, redirection, or a copy command against `Output/`.

- [ ] **Step 7: Verify routes, raster dimensions, and reproducible output**

Run the focused test, assert the social raster's exact dimensions, then hash
every generated file, including files not yet tracked, and prove a second
generation leaves the full tree byte-for-byte unchanged:

```bash
set -euo pipefail
node --test Tests/games/routes.test.mjs
test "$(sips -g pixelWidth Resources/images/games/og.png \
  | awk '/pixelWidth:/ { print $2 }')" = "1734"
test "$(sips -g pixelHeight Resources/images/games/og.png \
  | awk '/pixelHeight:/ { print $2 }')" = "907"
hash_output_tree() {
  find Output -type f -print \
    | LC_ALL=C sort \
    | while IFS= read -r output_file; do shasum -a 256 "$output_file"; done \
    | shasum -a 256 \
    | awk '{ print $1 }'
}
BEFORE_OUTPUT_SHA=$(hash_output_tree)
make generate
AFTER_OUTPUT_SHA=$(hash_output_tree)
test "$BEFORE_OUTPUT_SHA" = "$AFTER_OUTPUT_SHA"
git diff --check -- Output
git diff --stat -- Output
```

Expected: the route suite passes for all six destinations; the raster is
1734-by-907; the second source generation produces the identical full `Output/`
tree; and the tracked generated diff has no whitespace errors. The tree hash is
the reproducibility proof; inspect `git diff -- Output` only as supplemental
evidence—do not edit it.

- [ ] **Step 8: Update repository architecture documentation**

Replace the Arcade Hall bullet in both `AGENTS.md` and `CLAUDE.md` with this
exact text; retain the following `Tests/games/` bullet unchanged:

```markdown
- **Arcade Hall** — `/games`, `/games/sudoku`, `/games/crossword`, `/games/word-search`, `/games/kinnoki-stack`, and `/games/kinnoki-yard` are generated from matching files under `Content/`. Shared storage, lifecycle, cargo geometry, and procedural audio live in `Resources/games/core.js`, `controller-common.js`, `cargo-geometry.js`, and `game-audio.js`; DOM-free game engines and matching `*-ui.js` controllers remain separate. Store v2 keeps validated progress, typed records, repeat history, and separate music/effects preferences local to that browser; nothing is uploaded. Run `make test-games` after Arcade Hall changes.
```

- [ ] **Step 9: Re-generate, stage, and commit public integration**

Perform one final source generation, rerun the focused test, and stage the
generated tree with its source files. Fail if any tracked or untracked file was
left outside the explicit staging set:

```bash
set -euo pipefail
make generate
node --test Tests/games/routes.test.mjs
git diff --check
git add Content/games.md Content/games/kinnoki-stack.md Content/games/kinnoki-yard.md \
  Resources/games/ui.js Resources/images/games/og.png \
  Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift Tests/games/routes.test.mjs \
  AGENTS.md CLAUDE.md Output
git diff --cached --check
test -z "$(git diff --name-only)"
test -z "$(git ls-files --others --exclude-standard)"
git commit -m "feat(games): publish Kinnoki Stack and Yard"
```

Expected: the commit contains source, tests, documentation, the reviewed raster,
and generator-produced `Output/` together. If either cleanliness assertion
fails, inspect and disposition the extra path; never stage unrelated work.

---

### Task 14B: Rebase-safe release verification and ready PR

**Files:**
- No planned source changes; any failure receives one focused fix commit and a repeat of the full gate.

**Interfaces:**
- Consumes: the fully committed Task 14A branch.
- Produces: rebased reproducible output, complete local evidence, a ready PR to `main`, and a successful Cloudflare preview.

- [ ] **Step 1: Rebase before final generation and verification**

This repo has no `nightly`/`weekly` ladder, so the implementation PR targets `main`.

```bash
set -euo pipefail
test -z "$(git status --porcelain)"
git fetch --prune origin
git show-ref --verify --quiet refs/remotes/origin/main
git rebase origin/main
test "$(git merge-base HEAD origin/main)" = "$(git rev-parse origin/main)"
test -z "$(git status --porcelain)"
```

Expected: a clean worktree whose history contains current `origin/main`. Resolve
only understood conflicts; do not regenerate until the rebase completes, and
stop rather than using `git rebase --skip` on an implementation commit.

- [ ] **Step 2: Run the complete post-rebase automated gate**

```bash
set -euo pipefail
test -z "$(git status --porcelain)"
"$HOME/.claude/bin/xcode-build-gate.sh" --wait && swift build
make generate
git diff --exit-code -- Output
"$HOME/.claude/bin/xcode-build-gate.sh" --wait && make test
node --test Tests/site/*.test.mjs
git diff --exit-code
git diff --check
git diff --check origin/main...HEAD

for path in Content/games.md Content/games Resources/games Resources/styles.css \
  Output/games Output/styles.css Resources/images/games/og.png; do
  test -e "$path"
done

reject_matches() {
  local pattern=$1
  shift
  set +e
  rg -n -i "$pattern" "$@"
  local status=$?
  set -e
  case "$status" in
    0) echo "Rejected text matched: $pattern" >&2; return 1 ;;
    1) return 0 ;;
    *) echo "rg failed while scanning: $pattern" >&2; return "$status" ;;
  esac
}

reject_matches 'three familiar|three classics|three games' \
  Content/games.md Content/games Resources/games Resources/styles.css \
  Output/games Output/styles.css
reject_matches '\btetris\b|tetromino|the tetris company' \
  Content/games.md Content/games Resources/games Resources/styles.css \
  Output/games Output/styles.css

test "$(sips -g pixelWidth Resources/images/games/og.png \
  | awk '/pixelWidth:/ { print $2 }')" = "1734"
test "$(sips -g pixelHeight Resources/images/games/og.png \
  | awk '/pixelHeight:/ { print $2 }')" = "907"
```

Expected: Swift build, Listening Room, all game tests, and site tests pass; generation leaves `Output/` byte-for-byte clean; both diff checks pass; both negative scans exit successfully because they find no match. The originality scan deliberately excludes design/plan documents because they document the legal boundary. Inspect the PNG separately because `rg` is not a raster-content check.

- [ ] **Step 3: Start a generated-site preview**

In one terminal, start Publish's preview:

```bash
set -euo pipefail
make preview
```

Expected: the server binds at `http://localhost:8000`. Only if Publish reports a
port-binding failure after successful generation, stop it and run this
generated-output fallback in that terminal:

```bash
set -euo pipefail
test -f Output/games/index.html
python3 -m http.server 8001 --directory Output
```

Do not use the fallback for a generation or runtime error; diagnose that error.
Neither preview command writes `Output/`.

- [ ] **Step 4: Verify Stack gameplay and recovery**

Against the local preview, record pass/fail evidence for:

1. Easy completion/terminal with keyboard and phone-sized interaction with the
   persistent touch buttons.
2. Step Mode's first and second blocked Advance, Hard Drop, permanent assistance
   label, record exclusion, Describe Dock, pause/Resume, and save/Continue.
3. Medium and Hard tide forecast/warning/shift behavior and a corrupt saved-state
   recovery to a usable New Run path.
4. Silence before Start, separate persistent music/effects controls, adaptive
   intensity/cadence, bounded ending before cleanup, hidden-page pause, Resume
   without backlog, and silent operation with Web Audio removed.

Any failed row blocks the PR. Capture the browser, viewport, and result rather
than writing a generic “manual QA passed” statement.

- [ ] **Step 5: Verify Yard gameplay and deterministic replacement**

Against the same preview, record pass/fail evidence for:

1. One complete Contract and one Endless terminal with keyboard only, then the
   core select/rotate/place flow with touch.
2. Contract Hint from completable and dead-end positions, Contract versus
   Endless Undo semantics, and correct assistance marking.
3. Restart preserving the same definition, New producing a non-repeat, and
   mode/difficulty replacement decline versus accept.
4. Save/Continue preserving the exact mode, board, tray, selection, manifests,
   history, counters, and deterministic future stream.

Any mismatch blocks publication and receives a focused implementation/test fix.

- [ ] **Step 6: Verify accessibility, responsive layout, audio originality, and console health**

Complete and record this cross-game matrix:

1. Stack exposes 216 non-tabbable grid cells and concise event announcements;
   Yard exposes one roving tab stop and retains focus after repaint.
2. Desktop, 390-by-844 viewport, true 200-percent zoom, large text, dark/light,
   OpenDyslexic, reduced motion, 44-pixel targets, and no page-level horizontal
   overflow.
3. Both arrangements at low/high Stack intensity and Yard completion share the
   original motif and do not quote a recognizable game soundtrack.
4. Public copy, source/generated CSS, the original-resolution social raster,
   piece shapes/patterns, controls, scoring, and generated assets remain inside
   the prohibited-branding/trade-dress boundary.
5. The hub and all five game routes have no console errors.

Keep screenshots or browser notes with the PR evidence. A failed accessibility,
layout, originality, or console row blocks the PR.

- [ ] **Step 7: Push and open one ready PR**

Push the exact branch, create the PR only when none is already open for that
head, and assert its base/head/draft state:

```bash
set -euo pipefail
test -z "$(git status --porcelain)"
git push -u origin codex/kinnoki-stack-yard

OPEN_PRS=$(gh pr list --state open --head codex/kinnoki-stack-yard --json url)
OPEN_COUNT=$(OPEN_PRS="$OPEN_PRS" node -e \
  'const rows = JSON.parse(process.env.OPEN_PRS); console.log(rows.length)')
test "$OPEN_COUNT" -le 1
if [ "$OPEN_COUNT" -eq 1 ]; then
  PR_URL=$(OPEN_PRS="$OPEN_PRS" node -e \
    'console.log(JSON.parse(process.env.OPEN_PRS)[0].url)')
else
  PR_URL=$(gh pr create --base main --head codex/kinnoki-stack-yard \
    --title "feat: add Kinnoki Stack and Yard" \
    --body "Adds two original cargo games with three difficulties, local save/records, accessible controls, procedural music, generated routes, and full engine/controller coverage.")
fi

HEAD_SHA=$(git rev-parse HEAD)
PR_JSON=$(gh pr view "$PR_URL" \
  --json url,state,isDraft,headRefName,baseRefName,headRefOid)
PR_JSON="$PR_JSON" HEAD_SHA="$HEAD_SHA" node -e '
  const pr = JSON.parse(process.env.PR_JSON);
  if (pr.state !== "OPEN" || pr.isDraft
      || pr.headRefName !== "codex/kinnoki-stack-yard"
      || pr.baseRefName !== "main"
      || pr.headRefOid !== process.env.HEAD_SHA) process.exit(1);
  console.log(pr.url + " @ " + pr.headRefOid);
'
```

Expected: exactly one normal ready-for-review PR from
`codex/kinnoki-stack-yard` to `main`.

- [ ] **Step 8: Poll Cloudflare Pages to a bounded conclusion**

Poll for at most five minutes, failing immediately on a failed/cancelled check
and failing closed on API errors or timeout:

```bash
set -euo pipefail
PR_URL=$(gh pr list --state open --head codex/kinnoki-stack-yard \
  --json url --jq \
  'if length == 1 then .[0].url else error("expected exactly one open PR") end')

for attempt in $(seq 1 30); do
  set +e
  CHECKS_JSON=$(gh pr checks "$PR_URL" --json name,bucket,state,link)
  CHECKS_STATUS=$?
  set -e
  case "$CHECKS_STATUS" in
    0|8) ;;
    *) echo "Unable to query hosted checks." >&2; exit "$CHECKS_STATUS" ;;
  esac

  set +e
  CHECKS_JSON="$CHECKS_JSON" node -e '
    const checks = JSON.parse(process.env.CHECKS_JSON);
    const cloudflare = checks.filter((check) => check.name === "Cloudflare Pages");
    if (cloudflare.length === 0) process.exit(3);
    if (cloudflare.length > 1) process.exit(4);
    if (cloudflare[0].bucket === "pass") process.exit(0);
    if (["fail", "cancel"].includes(cloudflare[0].bucket)) process.exit(2);
    process.exit(3);
  '
  CHECK_RESULT=$?
  set -e
  case "$CHECK_RESULT" in
    0) break ;;
    2|4) gh pr checks "$PR_URL"; exit 1 ;;
    3) if [ "$attempt" -eq 30 ]; then
         echo "Cloudflare Pages did not finish within five minutes." >&2
         exit 1
       fi
       sleep 10 ;;
    *) exit "$CHECK_RESULT" ;;
  esac
done
gh pr checks "$PR_URL"
```

Expected: the single Cloudflare Pages check reaches `pass`. If it fails, inspect
the concrete deployment details, fix that cause, rebase if needed, rerun Steps
1–6, push, and repeat this bounded check.

- [ ] **Step 9: Verify every Cloudflare preview destination**

Copy the exact `pages.dev` preview origin from the successful Cloudflare result
into `PREVIEW_URL`, then verify all six generated markers:

```bash
set -euo pipefail
: "${PREVIEW_URL:?Set PREVIEW_URL to the exact Cloudflare pages.dev preview origin}"
case "$PREVIEW_URL" in
  https://*.pages.dev|https://*.pages.dev/) ;;
  *) echo "PREVIEW_URL is not a Cloudflare Pages preview origin." >&2; exit 1 ;;
esac
PREVIEW_URL=${PREVIEW_URL%/}
PR_URL=$(gh pr list --state open --head codex/kinnoki-stack-yard \
  --json url --jq \
  'if length == 1 then .[0].url else error("expected exactly one open PR") end')

while IFS='|' read -r route marker; do
  curl -fsS --retry 3 --retry-all-errors "$PREVIEW_URL/$route/" \
    | rg -F "data-game-page=\"$marker\""
done <<'ROUTES'
games|hub
games/sudoku|sudoku
games/crossword|crossword
games/word-search|word-search
games/kinnoki-stack|kinnoki-stack
games/kinnoki-yard|kinnoki-yard
ROUTES

gh pr comment "$PR_URL" --body \
  "Cloudflare preview verified at $PREVIEW_URL: hub plus all five generated game markers returned successfully. Manual browser matrix completed with no console errors; production remains pending merge and custom-domain verification."
```

Expected: every preview route returns its exact marker and the PR records the
preview evidence. Re-open all six preview routes in the browser for the
no-console assertion before posting the comment. Do not call the release
production-live while the PR remains open.

---

### Task 14C: Post-merge production proof and durable business receipt

**Files:**
- Create in an external KB worktree only after merge: `bundle/status/2026-07-13-kinnoki-stack-yard-release.md`.
- Modify in that external KB worktree: `bundle/status/2026-07-12-kinnoki-stack-yard-design.md`, `bundle/projects/kinnoki-labs-site.md`, `bundle/status/index.md`, and `bundle/log.md`.

**Interfaces:**
- Consumes: merged implementation PR, merge commit, hosted checks, and custom-domain route evidence.
- Produces: verified production status and a Tier 1 KB PR/merge without touching the user's dirty KB checkout.

- [ ] **Step 1: Verify merge and both production routes**

After the user merges, resolve the three site PRs from their exact branches,
require the specification and plan PRs to be merged, require the implementation
PR's Cloudflare check to have passed, and capture production evidence:

```bash
set -euo pipefail
SITE_REPO=dfakkeldy/KinNoKiLabsSite

SPEC_PR_URL=$(gh pr view 21 --repo "$SITE_REPO" --json url,state \
  --jq 'if .state == "MERGED" then .url else error("spec PR is not merged") end')
PLAN_PR_URL=$(gh pr list --repo "$SITE_REPO" --state merged \
  --head codex/kinnoki-stack-yard-plan --json url \
  --jq 'if length == 1 then .[0].url else error("expected one merged plan PR") end')
IMPLEMENTATION_PR_URL=$(gh pr list --repo "$SITE_REPO" --state merged \
  --head codex/kinnoki-stack-yard --json url \
  --jq 'if length == 1 then .[0].url else error("expected one merged implementation PR") end')

IMPLEMENTATION_PR_JSON=$(gh pr view "$IMPLEMENTATION_PR_URL" --repo "$SITE_REPO" \
  --json number,state,mergedAt,mergeCommit,url)
IMPLEMENTATION_PR_JSON="$IMPLEMENTATION_PR_JSON" node -e '
  const pr = JSON.parse(process.env.IMPLEMENTATION_PR_JSON);
  if (pr.state !== "MERGED" || !pr.mergedAt || !pr.mergeCommit?.oid) process.exit(1);
'
IMPLEMENTATION_PR_NUMBER=$(IMPLEMENTATION_PR_JSON="$IMPLEMENTATION_PR_JSON" \
  node -e 'console.log(JSON.parse(process.env.IMPLEMENTATION_PR_JSON).number)')
MERGE_SHA=$(IMPLEMENTATION_PR_JSON="$IMPLEMENTATION_PR_JSON" \
  node -e 'console.log(JSON.parse(process.env.IMPLEMENTATION_PR_JSON).mergeCommit.oid)')
MERGED_AT=$(IMPLEMENTATION_PR_JSON="$IMPLEMENTATION_PR_JSON" \
  node -e 'console.log(JSON.parse(process.env.IMPLEMENTATION_PR_JSON).mergedAt)')
PLAN_PR_NUMBER=$(gh pr view "$PLAN_PR_URL" --repo "$SITE_REPO" --json number \
  --jq '.number')

CHECKS_JSON=$(gh pr checks "$IMPLEMENTATION_PR_URL" --repo "$SITE_REPO" \
  --json name,bucket,state,link)
CHECKS_JSON="$CHECKS_JSON" node -e '
  const checks = JSON.parse(process.env.CHECKS_JSON)
    .filter((check) => check.name === "Cloudflare Pages");
  if (checks.length !== 1 || checks[0].bucket !== "pass") process.exit(1);
'

curl -fsS --retry 3 --retry-all-errors \
  https://kinnokilabs.com/games/kinnoki-stack/ \
  | rg -F 'data-game-page="kinnoki-stack"'
curl -fsS --retry 3 --retry-all-errors \
  https://kinnokilabs.com/games/kinnoki-yard/ \
  | rg -F 'data-game-page="kinnoki-yard"'

VERIFIED_AT=$(date +'%Y-%m-%dT%H:%M:%S%z' \
  | sed -E 's/([+-][0-9]{2})([0-9]{2})$/\1:\2/')
VERIFIED_DATE=$(date +'%Y-%m-%d')
printf '%s\n' \
  "SPEC_PR_URL=$SPEC_PR_URL" \
  "PLAN_PR_URL=$PLAN_PR_URL" \
  "PLAN_PR_NUMBER=$PLAN_PR_NUMBER" \
  "IMPLEMENTATION_PR_URL=$IMPLEMENTATION_PR_URL" \
  "IMPLEMENTATION_PR_NUMBER=$IMPLEMENTATION_PR_NUMBER" \
  "MERGE_SHA=$MERGE_SHA" \
  "MERGED_AT=$MERGED_AT" \
  "VERIFIED_AT=$VERIFIED_AT" \
  "VERIFIED_DATE=$VERIFIED_DATE"
```

Expected: every assertion passes, both routes return their exact marker, and the
printed values are retained for the receipt. Only now may the release be called
`production-live`.

- [ ] **Step 2: Create or resume a clean KB receipt worktree**

```bash
set -euo pipefail
KB=/Users/dfakkeldy/Developer/knowledge-base
KB_WT=/Users/dfakkeldy/.codex/worktrees/kinnoki-stack-yard-release-receipt
KB_BRANCH=codex/kinnoki-stack-yard-release-receipt
git -C "$KB" fetch --prune origin
git -C "$KB" worktree list
if [ -e "$KB_WT/.git" ]; then
  git -C "$KB_WT" status --short --branch
elif git -C "$KB" show-ref --verify --quiet "refs/heads/$KB_BRANCH"; then
  git -C "$KB" worktree add "$KB_WT" "$KB_BRANCH"
elif git -C "$KB" show-ref --verify --quiet "refs/remotes/origin/$KB_BRANCH"; then
  git -C "$KB" worktree add -b "$KB_BRANCH" "$KB_WT" "origin/$KB_BRANCH"
else
  test ! -e "$KB_WT" || {
    echo "KB receipt path exists but is not a Git worktree." >&2
    exit 1
  }
  git -C "$KB" worktree add -b "$KB_BRANCH" "$KB_WT" origin/main
fi
test "$(git -C "$KB_WT" branch --show-current)" = "$KB_BRANCH" || {
  echo "KB receipt path is attached to the wrong branch; inspect it before continuing." >&2
  exit 1
}
test -z "$(git -C "$KB_WT" status --porcelain)" || {
  echo "KB receipt worktree is dirty; inspect it before continuing." >&2
  exit 1
}
git -C "$KB_WT" rebase origin/main
test "$(git -C "$KB_WT" merge-base HEAD origin/main)" = \
  "$(git -C "$KB_WT" rev-parse origin/main)"
test -f "$KB_WT/bundle/status/2026-07-12-kinnoki-stack-yard-design.md"
git -C "$KB_WT" status --short --branch
```

The conditional resumes the fixed external worktree or reattaches its existing branch instead of recreating either one. Stop on a dirty receipt worktree; do not edit or create files inside the dirty main KB checkout.

- [ ] **Step 3: Read the KB rules and current receipt surfaces**

Read the clean worktree's instructions and the exact pages that will change:

```bash
set -euo pipefail
KB_WT=/Users/dfakkeldy/.codex/worktrees/kinnoki-stack-yard-release-receipt
sed -n '1,260p' "$KB_WT/AGENTS.md"
sed -n '1,180p' "$KB_WT/bundle/index.md"
sed -n '1,260p' "$KB_WT/bundle/topics/portfolio-master-plan.md"
sed -n '1,220p' "$KB_WT/bundle/topics/master-plan-discipline.md"
sed -n '1,230p' "$KB_WT/bundle/projects/kinnoki-labs-site.md"
sed -n '1,180p' \
  "$KB_WT/bundle/status/2026-07-12-kinnoki-stack-yard-design.md"
sed -n '1,150p' "$KB_WT/bundle/status/index.md"
sed -n '1,80p' "$KB_WT/bundle/log.md"
test "$(rg -F '/status/2026-07-12-kinnoki-stack-yard-design.md' \
  "$KB_WT/bundle/projects/kinnoki-labs-site.md" | wc -l | tr -d ' ')" -ge 1
```

Expected: the design receipt is still the historical source, the project page
still describes implementation as pending, and the status index has both
`Active / recent` and `Archived / superseded` sections. If live `origin/main`
already contains a newer release receipt, stop and reconcile rather than
creating a duplicate.

- [ ] **Step 4: Create the exact production receipt**

Using `apply_patch` in the clean KB worktree, create
`bundle/status/2026-07-13-kinnoki-stack-yard-release.md` with this complete
content. Render each named evidence binding (`${IMPLEMENTATION_PR_URL}`,
`${PLAN_PR_URL}`, `${MERGE_SHA}`, and the other Step 1 values) to the exact
printed value; do not commit the bindings literally:

```markdown
---
type: Status
title: 2026-07-13 Kinnoki Stack and Yard Release
description: Production release evidence for Kinnoki Stack and Kinnoki Yard in the KinNoKi Arcade Hall.
resource: ${IMPLEMENTATION_PR_URL}
tags:
  - kinnoki
  - website
  - games
  - release
  - cloudflare-pages
timestamp: ${VERIFIED_AT}
---

# Snapshot

Re-checked: ${VERIFIED_DATE}.

Kinnoki Stack and Kinnoki Yard are **production-live** in the KinNoKi Arcade
Hall. The merged implementation preserves the approved static, browser-native,
local-only boundary: three difficulties, deterministic save/resume, typed local
records, keyboard and touch controls, accessible non-precision alternatives,
original cargo/manifest mechanics, and adaptive arrangements of one original
motif. No account, backend, analytics, ads, multiplayer, upload, or new
third-party runtime service was added.

# Release Evidence

- The approved written specification is [KinNoKiLabsSite PR #21](${SPEC_PR_URL}).
- The approved implementation plan is [KinNoKiLabsSite PR #${PLAN_PR_NUMBER}](${PLAN_PR_URL}).
- [KinNoKiLabsSite implementation PR #${IMPLEMENTATION_PR_NUMBER}](${IMPLEMENTATION_PR_URL})
  merged at `${MERGED_AT}` as `${MERGE_SHA}`.
- The implementation PR's Cloudflare Pages check completed successfully.
- [Kinnoki Stack](https://kinnokilabs.com/games/kinnoki-stack/) returned
  `data-game-page="kinnoki-stack"` on the custom domain.
- [Kinnoki Yard](https://kinnokilabs.com/games/kinnoki-yard/) returned
  `data-game-page="kinnoki-yard"` on the custom domain.
- Production verification completed at `${VERIFIED_AT}`.

# Current Boundary And Next Action

The approved design remains historical context; this page is the current
production evidence. Monitor real-player accessibility, save recovery, browser
audio, and responsive-layout feedback. Open only focused follow-ups backed by a
reproduction; do not add a backend or broaden the portfolio lane by inference.

# Master Plan Impact

This closes a bounded Arcade Hall follow-up. It does not change portfolio
ordering, launch dates, pricing, studio positioning, automation cadence, or
MacroMark's portfolio priority, and it adds no live-service maintenance
obligation.

# Citations

[1] [KinNoKiLabsSite specification PR #21](${SPEC_PR_URL})
[2] [KinNoKiLabsSite implementation-plan PR #${PLAN_PR_NUMBER}](${PLAN_PR_URL})
[3] [KinNoKiLabsSite implementation PR #${IMPLEMENTATION_PR_NUMBER}](${IMPLEMENTATION_PR_URL})
[4] [KinNoKiLabsSite merge commit `${MERGE_SHA}`](https://github.com/dfakkeldy/KinNoKiLabsSite/commit/${MERGE_SHA})
[5] [Kinnoki Stack production route](https://kinnokilabs.com/games/kinnoki-stack/)
[6] [Kinnoki Yard production route](https://kinnokilabs.com/games/kinnoki-yard/)
```

- [ ] **Step 5: Supersede only the historical design receipt metadata**

Apply this exact frontmatter/banner patch to
`bundle/status/2026-07-12-kinnoki-stack-yard-design.md`. Do not replace or
rewrite its historical body:

```diff
 resource: https://github.com/dfakkeldy/KinNoKiLabsSite/pull/21
+superseded_by: /status/2026-07-13-kinnoki-stack-yard-release.md
 tags:
@@
 ---
+
+> Superseded by [2026-07-13 Kinnoki Stack and Yard Release](/status/2026-07-13-kinnoki-stack-yard-release.md).

 # Snapshot
```

- [ ] **Step 6: Replace the project page's pending paragraph and next action**

In `bundle/projects/kinnoki-labs-site.md`, replace the single current-status
paragraph containing the design link
`/status/2026-07-12-kinnoki-stack-yard-design.md` with:

```markdown
Kinnoki Stack and Kinnoki Yard are
[production-live](/status/2026-07-13-kinnoki-stack-yard-release.md) in the
Arcade Hall. Kinnoki Stack uses Cargo Manifests and difficulty-gated tides;
Kinnoki Yard includes guaranteed-solvable Puzzle Contracts and Endless Yard.
Both retain the site's accessible, static, browser-native, local-only boundary
and share adaptive arrangements of one original motif. The approved
[design](/status/2026-07-12-kinnoki-stack-yard-design.md) remains historical
context; the release receipt is the current merge, Cloudflare, and custom-domain
evidence.

**Next action:** monitor real-player accessibility, save-recovery, audio, and
responsive-layout feedback, then open only focused follow-ups backed by a
reproduction.
```

Add this separate release link beside the existing historical design link in
`# Related Pages`:

```markdown
- [2026-07-13 Kinnoki Stack and Yard Release](/status/2026-07-13-kinnoki-stack-yard-release.md)
```

- [ ] **Step 7: Move the design index entry and add current release evidence**

Add this exact line at the top of `## Active / recent` in
`bundle/status/index.md`:

```markdown
* [2026-07-13 Kinnoki Stack and Yard Release](2026-07-13-kinnoki-stack-yard-release.md) - Kinnoki Stack and Kinnoki Yard are production-live after the implementation PR merged with a successful Cloudflare Pages check and both custom-domain routes returned their exact generated page markers; the accessible, static, browser-native, local-only boundary and unchanged Master Plan impact remain in force.
```

Remove the existing `2026-07-12 Kinnoki Stack and Yard Design` line from
`Active / recent` and paste that same line unchanged immediately below
`## Archived / superseded`. Do not delete or rewrite the historical entry.

- [ ] **Step 8: Add the newest-first durable log entry**

Under the existing `## 2026-07-13` heading at the top of `bundle/log.md`, add
this bullet, rendering the Step 1 expressions to their exact values:

```markdown
* **Implementation + production release**: Filed [2026-07-13 Kinnoki Stack and Yard Release](/status/2026-07-13-kinnoki-stack-yard-release.md) after [KinNoKiLabsSite implementation PR #${IMPLEMENTATION_PR_NUMBER}](${IMPLEMENTATION_PR_URL}) merged as `${MERGE_SHA}` with a successful Cloudflare Pages check and both Kinnoki Stack and Kinnoki Yard custom-domain routes returned their exact generated page markers. The two original cargo games are production-live with three difficulties, deterministic local save/records, accessible keyboard/touch/non-precision controls, and adaptive arrangements of one original motif; no account, backend, analytics, ads, multiplayer, upload, or new runtime service was added. The approved design remains linked as superseded historical context. **Master Plan impact**: closes a bounded Arcade Hall follow-up only; no change to portfolio ordering, launch dates, pricing, studio positioning, automation cadence, or MacroMark's portfolio priority.
```

- [ ] **Step 9: Validate the exact KB change set**

Run lint, reject unresolved evidence expressions, and require exactly the five
authorized paths:

```bash
set -euo pipefail
cd /Users/dfakkeldy/.codex/worktrees/kinnoki-stack-yard-release-receipt
python3 tools/kb_lint.py
git diff --check

STATUS=$(git status --porcelain=v1)
STATUS="$STATUS" node -e '
  const expected = new Set([
    "bundle/status/2026-07-13-kinnoki-stack-yard-release.md",
    "bundle/status/2026-07-12-kinnoki-stack-yard-design.md",
    "bundle/projects/kinnoki-labs-site.md",
    "bundle/status/index.md",
    "bundle/log.md",
  ]);
  const actual = new Set(process.env.STATUS.split("\n")
    .filter(Boolean).map((line) => line.slice(3)));
  if (actual.size !== expected.size
      || [...actual].some((path) => !expected.has(path))) {
    console.error({ expected: [...expected], actual: [...actual] });
    process.exit(1);
  }
'

node -e '
  const fs = require("node:fs");
  const files = process.argv.slice(1);
  for (const file of files) {
    if (/\$\{[A-Z0-9_]+\}/.test(fs.readFileSync(file, "utf8"))) {
      console.error("Unresolved release evidence in " + file);
      process.exit(1);
    }
  }
' bundle/status/2026-07-13-kinnoki-stack-yard-release.md \
  bundle/status/2026-07-12-kinnoki-stack-yard-design.md \
  bundle/projects/kinnoki-labs-site.md bundle/status/index.md bundle/log.md
```

Expected: KB lint and diff checks pass, no evidence expression remains, and no
file outside the five listed surfaces is modified or untracked.

- [ ] **Step 10: Commit, rebase, revalidate, and push the KB receipt**

```bash
set -euo pipefail
cd /Users/dfakkeldy/.codex/worktrees/kinnoki-stack-yard-release-receipt
python3 tools/kb_lint.py
git diff --check
git add bundle/status/2026-07-13-kinnoki-stack-yard-release.md \
  bundle/status/2026-07-12-kinnoki-stack-yard-design.md \
  bundle/projects/kinnoki-labs-site.md bundle/status/index.md bundle/log.md
git diff --cached --check
git commit -m "docs: record Kinnoki Stack and Yard release"

git fetch --prune origin
git rebase origin/main
python3 tools/kb_lint.py
git diff --check origin/main...HEAD
git push --force-with-lease -u origin codex/kinnoki-stack-yard-release-receipt
```

Expected: the coherent receipt commit is rebased onto current KB `origin/main`,
the post-rebase lint/diff gate passes, and only the agent receipt branch is
pushed.

- [ ] **Step 11: Open or resume the Tier 1 PR and enable auto-merge**

Create no duplicate PR, verify its base/head/draft state, and request the KB's
Tier 1 squash auto-merge:

```bash
set -euo pipefail
cd /Users/dfakkeldy/.codex/worktrees/kinnoki-stack-yard-release-receipt
EXISTING_PRS=$(gh pr list --state all \
  --head codex/kinnoki-stack-yard-release-receipt --limit 10 --json url,state)
EXISTING_COUNT=$(EXISTING_PRS="$EXISTING_PRS" node -e \
  'console.log(JSON.parse(process.env.EXISTING_PRS).length)')
test "$EXISTING_COUNT" -le 1
if [ "$EXISTING_COUNT" -eq 1 ]; then
  KB_PR=$(EXISTING_PRS="$EXISTING_PRS" node -e \
    'console.log(JSON.parse(process.env.EXISTING_PRS)[0].url)')
  KB_PR_STATE=$(EXISTING_PRS="$EXISTING_PRS" node -e \
    'console.log(JSON.parse(process.env.EXISTING_PRS)[0].state)')
  test "$KB_PR_STATE" = "OPEN" || test "$KB_PR_STATE" = "MERGED"
else
  KB_PR=$(gh pr create --base main \
    --head codex/kinnoki-stack-yard-release-receipt \
    --title "docs: record Kinnoki Stack and Yard release" \
    --body "Records the merged implementation, hosted checks, production route proof, and unchanged Master Plan impact.")
  KB_PR_STATE=OPEN
fi

HEAD_SHA=$(git rev-parse HEAD)
KB_PR_JSON=$(gh pr view "$KB_PR" \
  --json state,isDraft,headRefName,baseRefName,headRefOid,url)
KB_PR_JSON="$KB_PR_JSON" HEAD_SHA="$HEAD_SHA" node -e '
  const pr = JSON.parse(process.env.KB_PR_JSON);
  if (!["OPEN", "MERGED"].includes(pr.state) || pr.isDraft
      || pr.headRefName !== "codex/kinnoki-stack-yard-release-receipt"
      || pr.baseRefName !== "main"
      || pr.headRefOid !== process.env.HEAD_SHA) process.exit(1);
'
if [ "$KB_PR_STATE" = "OPEN" ]; then
  gh pr merge --auto --squash "$KB_PR"
fi
```

- [ ] **Step 12: Poll the KB PR to a bounded merged state**

Poll for at most five minutes. A failed check, closed-unmerged PR, API error, or
timeout is a failure—not a pending success:

```bash
set -euo pipefail
cd /Users/dfakkeldy/.codex/worktrees/kinnoki-stack-yard-release-receipt
KB_PR=$(gh pr list --state all \
  --head codex/kinnoki-stack-yard-release-receipt --limit 10 --json url \
  --jq 'if length == 1 then .[0].url else error("expected one KB receipt PR") end')

for attempt in $(seq 1 30); do
  PR_STATE=$(gh pr view "$KB_PR" --json state --jq '.state')
  if [ "$PR_STATE" = "MERGED" ]; then break; fi
  test "$PR_STATE" = "OPEN"

  set +e
  CHECKS_JSON=$(gh pr checks "$KB_PR" --json name,bucket,state,link)
  CHECKS_STATUS=$?
  set -e
  case "$CHECKS_STATUS" in
    0|8) ;;
    *) exit "$CHECKS_STATUS" ;;
  esac
  CHECKS_JSON="$CHECKS_JSON" node -e '
    const checks = JSON.parse(process.env.CHECKS_JSON);
    if (checks.some((check) => ["fail", "cancel"].includes(check.bucket))) {
      process.exit(1);
    }
  '
  if [ "$attempt" -eq 30 ]; then
    echo "KB receipt PR did not merge within five minutes." >&2
    exit 1
  fi
  sleep 10
done

gh pr view "$KB_PR" --json state,mergeStateStatus,mergedAt,url \
  --jq 'if .state == "MERGED" and .mergedAt != null then . else error("KB PR not merged") end'
test -z "$(git status --porcelain)"
git status --short --branch
```

Expected: KB lint and CI pass, the Tier 1 receipt PR reaches `MERGED`, and the
external receipt worktree remains clean. Re-query rather than inferring merge
from the local commit or auto-merge request.

---

## Spec-to-Task Coverage

- Product, naming, privacy, dependency, and generated-output boundaries: Global Constraints and Tasks 14A–14C.
- Deterministic v2 storage, migration, records, session history, assistance, completion accounting, reset, and hostile-state isolation: Tasks 1A, 1B, and 12.
- Cargo catalogue, identity, rotations, placement, manifests, dispatch, and connected components: Task 2.
- Stack stream, tide, lock resolution, exact score/combo, crane/spawn, top-out, and terminal immutability: Task 3.
- Stack automatic gravity, capped backlog, lock delay, pause, Hard Drop, and Step Mode: Task 4.
- Contract exact-cover solver, witness generation, bounded retries, four fallbacks per difficulty, transforms, target metrics, and repeat rejection: Tasks 5A and 5B.
- Contract placement/reposition/rotation, exact moves, Undo, Hint, assistance, completion, and validation: Task 6.
- Endless batches, manifests, exact score/combo, exhaustive terminal detection, complete Undo, and no Hint: Task 7.
- Original shared motif, adaptive dual arrangements, effects, gesture gating, separate preferences, pause/resume, rate limits, disposal, and silent fallback: Task 8.
- Explicit pre-play/Resume, active timing, visibility pause, cleanup, announcements, separate audio controls, and recoverable errors: Tasks 9A and 9B.
- Stack semantic DOM, 216 non-tabbable cells, controls, Describe Dock, focus, save/resume, audio, and summary: Task 10.
- Yard mode UI, roving native cells, no-drag interaction, pan, focus, Hint/Undo differences, save/resume, audio, and summaries: Task 11.
- Five cards, mode-aware Continue, typed record presentation, shared totals/streaks, and reset messaging: Task 12.
- KinNoKi cargo visuals, patterns, target sizes, overflow, focus, themes, OpenDyslexic, large text, and reduced motion: Task 13.
- Routes, metadata, social artwork, source-only generation, rebase-safe automation, manual accessibility/audio/IP checks, Cloudflare preview, production proof, and KB receipt: Tasks 14A–14C.

## Plan Self-Review

- Spec coverage: every objective, scope item, exact scoring order, assistance rule, accessibility requirement, audio behavior, migration boundary, validation case, generated route, and release gate maps to a task above.
- Type consistency: `contracts`/`endless` mode values, `default` record bucket, `pieceId`, coordinate shape, `{ state, events }` reducer return, typed completion records, and lifecycle/audio method names are used consistently.
- Dependency order: core precedes geometry; both precede engines; engines/audio precede lifecycle/controllers; controllers precede hub/styles/routes; generated output is committed only after all source modules exist.
- Reviewer size: Store migration/session adaptation, Contract solver/generation, lifecycle/controller helpers, Stack/Yard controllers, public integration, release verification, and post-merge receipt each have separate commit/reviewer gates.
- Deferred-marker scan: no implementation step is left as an unspecified future decision. Timing constants, operation bounds, fallback source counts, motif, routes, storage keys, state shapes, commands, and expected outcomes are explicit.

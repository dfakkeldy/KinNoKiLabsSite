# KinNoKi Games Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an accessible, offline-capable Arcade Hall at `kinnokilabs.com/games` with unlimited seeded Sudoku, Crossword, and Word Search puzzles in Easy, Medium, and Hard difficulty.

**Architecture:** Extend the existing Swift Publish theme with four game routes and serve focused browser-native ES modules from `Resources/games/`. Keep puzzle generation, validation, persistence, timing, and statistics pure and independently testable; thin DOM controllers render those engines into semantic theme-owned page shells. Persist only versioned device-local state and deploy through the repository's existing generated `Output/` Cloudflare Pages flow.

**Tech Stack:** Swift 5.5 / Publish 0.8 / Plot, browser-native JavaScript ES modules, CSS, Node built-in test runner, Cloudflare Pages.

## Global Constraints

- Public routes are exactly `/games`, `/games/sudoku`, `/games/crossword`, and `/games/word-search`.
- Games provide unlimited seeded puzzles at Easy, Medium, and Hard difficulty.
- No accounts, backend, cloud sync, analytics, ads, social sharing, multiplayer, or third-party dependency is added.
- Game state and statistics remain on the current device in versioned KinNoKi-namespaced browser storage.
- Assisted completions count toward completions and streaks but never set best-time records.
- Use the existing KinNoKi dark metal-and-gold design, Lexend default, and OpenDyslexic preference.
- Support keyboard, touch, pointer, screen readers, reduced motion, large text, and 44-by-44 CSS-pixel control targets where controls permit.
- Do not manually edit `Output/`; generate it with the existing Publish pipeline.
- Preserve Swift tools 5.5, macOS 12 package support, and current dependencies.
- Use Conventional Commits and stage only files belonging to the current task.

---

## Planned File Structure

### Create

- `Content/games.md` — metadata source for the Arcade Hall.
- `Content/games/sudoku.md` — metadata source for Sudoku.
- `Content/games/crossword.md` — metadata source for Crossword.
- `Content/games/word-search.md` — metadata source for Word Search.
- `Resources/games/core.js` — seeded RNG, storage schema, migrations, timer math, assistance, completion statistics.
- `Resources/games/sudoku.js` — Sudoku generator, solver, unique-solution validator, difficulty classifier.
- `Resources/games/crossword-content.js` — public-safe curated clue-and-answer records.
- `Resources/games/crossword.js` — connected-grid crossword generator and validator.
- `Resources/games/word-search-content.js` — themed public-safe word lists.
- `Resources/games/word-search.js` — word placement, filler, validation, selection matching.
- `Resources/games/ui.js` — route detection, shared controls, storage notices, completion panel, controller bootstrap.
- `Resources/games/hub-ui.js` — Arcade Hall cards, continue actions, and stats summary.
- `Resources/games/sudoku-ui.js` — Sudoku rendering and input controller.
- `Resources/games/crossword-ui.js` — Crossword grid, clues, and input controller.
- `Resources/games/word-search-ui.js` — Word Search pointer, touch, and keyboard controller.
- `Tests/games/core.test.mjs` — persistence, migration, timing, assistance, statistics.
- `Tests/games/sudoku.test.mjs` — seeded generation, validity, uniqueness, difficulty.
- `Tests/games/crossword.test.mjs` — connectivity, crossing consistency, numbering, fallback.
- `Tests/games/word-search.test.mjs` — placement, allowed directions, selection, difficulty.
- `Tests/games/routes.test.mjs` — generated routes, assets, navigation, semantic contracts.
- `Tests/games/dom-fixture.mjs` — dependency-free DOM fixture for controller interaction tests.

### Modify

- `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift` — game page shells, Games navigation, active states, module loading.
- `Resources/styles.css` — Arcade Hall, boards, controls, completion panels, responsive and accessibility states.
- `Makefile` — `test-games` and aggregate `test` targets.
- `AGENTS.md` — document games architecture and test command.
- `CLAUDE.md` — mirror the repository architecture and test-command guidance.
- `Output/**` — generated only by `make generate`.

## Shared Interfaces

```js
// Resources/games/core.js
export function createRng(seed) // -> { next(), int(max), shuffle(values) }
export function deriveSeed(seed, attempt) // -> unsigned 32-bit integer
export function loadGameStore(storage) // -> GameStoreV1
export function saveGameStore(storage, store) // -> { ok: boolean, error?: Error }
export function resetGameStore(storage) // -> { ok: boolean, error?: Error }
export function startRun(store, game, difficulty, seed, puzzle, now) // -> GameStoreV1
export function markAssisted(store, game) // -> GameStoreV1
export function completeRun(store, game, now) // -> GameStoreV1
export function visibleElapsedMs(run, now, hiddenSince = null) // -> integer

// Resources/games/sudoku.js
export function generateSudoku({ difficulty, seed })
// -> { seed, difficulty, puzzle: number[81], solution: number[81], rating }
export function solveSudoku(puzzle, limit = 2)
// -> { solutions: number[][], techniques: string[] }
export function isValidSudokuBoard(board) // -> boolean

// Resources/games/crossword.js
export function generateCrossword({ difficulty, seed, entries })
// -> { seed, difficulty, size, cells, answers, usedFallback }
export function validateCrossword(puzzle) // -> { valid: boolean, errors: string[] }

// Resources/games/word-search.js
export function generateWordSearch({ difficulty, seed, themes })
// -> { seed, difficulty, size, theme, grid, placements }
export function findSelection(puzzle, start, end) // -> placement | null
export function validateWordSearch(puzzle) // -> { valid: boolean, errors: string[] }
```

---

### Task 1: Shared deterministic game state and statistics

**Files:**
- Create: `Resources/games/core.js`
- Create: `Tests/games/core.test.mjs`
- Modify: `Makefile`

**Interfaces:**
- Consumes: browser `Storage`-compatible objects and integer timestamps.
- Produces: every `core.js` export listed under Shared Interfaces and the `kinnoki-games:v1` record.

- [ ] **Step 1: Write failing tests for deterministic RNG, schema recovery, elapsed play time, and assisted records**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completeRun, createRng, loadGameStore, markAssisted,
  saveGameStore, startRun, visibleElapsedMs,
} from '../../Resources/games/core.js';

const memoryStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

test('same seed produces the same sequence', () => {
  const a = createRng(42); const b = createRng(42);
  assert.deepEqual([a.next(), a.int(20), a.next()], [b.next(), b.int(20), b.next()]);
});

test('corrupt storage recovers to an empty v1 store', () => {
  const store = loadGameStore(memoryStorage({ 'kinnoki-games:v1': '{bad json' }));
  assert.equal(store.version, 1);
  assert.deepEqual(store.runs, {});
  assert.equal(store.stats.totalCompleted, 0);
});

test('hidden time is excluded from elapsed play time', () => {
  const run = { startedAt: 1000, elapsedBeforeStartMs: 4000 };
  assert.equal(visibleElapsedMs(run, 9000, 6000), 9000);
});

test('assisted completion increments totals but not best time', () => {
  let store = loadGameStore(memoryStorage());
  store = startRun(store, 'sudoku', 'easy', 7, { puzzle: [] }, 1000);
  store = markAssisted(store, 'sudoku');
  store.runs.sudoku.elapsedBeforeStartMs = 30000;
  store = completeRun(store, 'sudoku', 1000);
  assert.equal(store.stats.totalCompleted, 1);
  assert.equal(store.stats.games.sudoku.completed, 1);
  assert.equal(store.stats.games.sudoku.bestMs.easy, null);
});
```

- [ ] **Step 2: Run the shared-core test and verify the module is missing**

Run: `node --test Tests/games/core.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `Resources/games/core.js`.

- [ ] **Step 3: Implement the versioned store, Mulberry32 RNG, immutable run updates, streak dates, and storage error return values**

```js
const KEY = 'kinnoki-games:v1';
const gameStats = () => ({ completed: 0, bestMs: { easy: null, medium: null, hard: null } });
const emptyStore = () => ({
  version: 1, runs: {}, previousSeeds: {},
  stats: { totalCompleted: 0, currentStreak: 0, lastCompletedDate: null,
    games: { sudoku: gameStats(), crossword: gameStats(), 'word-search': gameStats() } },
});

export function createRng(seed) {
  let value = seed >>> 0;
  return {
    next() { value += 0x6D2B79F5; let t = value; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; },
    int(max) { return Math.floor(this.next() * max); },
    shuffle(values) { const copy = [...values]; for (let i = copy.length - 1; i > 0; i -= 1) { const j = this.int(i + 1); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; },
  };
}

export const deriveSeed = (seed, attempt) => ((seed >>> 0) + Math.imul(attempt + 1, 0x9E3779B1)) >>> 0;
export function loadGameStore(storage) { try { const value = JSON.parse(storage.getItem(KEY)); return value?.version === 1 ? value : emptyStore(); } catch { return emptyStore(); } }
export function saveGameStore(storage, store) { try { storage.setItem(KEY, JSON.stringify(store)); return { ok: true }; } catch (error) { return { ok: false, error }; } }
export function resetGameStore(storage) { try { storage.removeItem(KEY); return { ok: true }; } catch (error) { return { ok: false, error }; } }
```

Add `startRun`, `markAssisted`, `completeRun`, and `visibleElapsedMs` using object spreads so callers never receive a partially mutated store. Store completion dates as local `YYYY-MM-DD`; increment a streak only for consecutive calendar dates and leave it unchanged for a second completion on the same date.

- [ ] **Step 4: Run the core tests**

Run: `node --test Tests/games/core.test.mjs`  
Expected: all shared-core tests PASS.

- [ ] **Step 5: Add repeatable game test targets**

```make
.PHONY: test test-games

test: test-listen test-games

test-games:
	node --test Tests/games/*.test.mjs
```

- [ ] **Step 6: Commit the shared foundation**

```bash
git add Makefile Resources/games/core.js Tests/games/core.test.mjs
git commit -m "feat(games): add deterministic local game state"
```

---

### Task 2: Valid uniquely solvable Sudoku engine

**Files:**
- Create: `Resources/games/sudoku.js`
- Create: `Tests/games/sudoku.test.mjs`

**Interfaces:**
- Consumes: `createRng(seed)` and `deriveSeed(seed, attempt)` from `core.js`.
- Produces: the three Sudoku exports in Shared Interfaces; UI code may rely on `puzzle` and `solution` being flat 81-integer arrays with `0` for empty cells.

- [ ] **Step 1: Write failing seeded-generation and validity tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSudoku, isValidSudokuBoard, solveSudoku } from '../../Resources/games/sudoku.js';

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`${difficulty} Sudoku is repeatable, valid, and unique`, () => {
    const first = generateSudoku({ difficulty, seed: 20260712 });
    const second = generateSudoku({ difficulty, seed: 20260712 });
    assert.deepEqual(first, second);
    assert.equal(first.puzzle.length, 81);
    assert.equal(isValidSudokuBoard(first.solution), true);
    assert.equal(solveSudoku(first.puzzle, 2).solutions.length, 1);
    assert.equal(first.rating, difficulty);
  });
}

test('different seeds produce different puzzles', () => {
  assert.notDeepEqual(
    generateSudoku({ difficulty: 'medium', seed: 1 }).puzzle,
    generateSudoku({ difficulty: 'medium', seed: 2 }).puzzle,
  );
});
```

- [ ] **Step 2: Run the Sudoku test and verify it fails**

Run: `node --test Tests/games/sudoku.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `sudoku.js`.

- [ ] **Step 3: Implement row/column/box validation and a bounded candidate solver**

```js
const peers = (index) => {
  const row = Math.floor(index / 9), column = index % 9;
  const values = new Set();
  for (let i = 0; i < 9; i += 1) { values.add(row * 9 + i); values.add(i * 9 + column); }
  const boxRow = Math.floor(row / 3) * 3, boxColumn = Math.floor(column / 3) * 3;
  for (let r = 0; r < 3; r += 1) for (let c = 0; c < 3; c += 1) values.add((boxRow + r) * 9 + boxColumn + c);
  values.delete(index); return [...values];
};

const candidates = (board, index) => {
  const used = new Set(peers(index).map((peer) => board[peer]).filter(Boolean));
  return [1,2,3,4,5,6,7,8,9].filter((value) => !used.has(value));
};

export function isValidSudokuBoard(board) {
  return board.length === 81 && board.every((value, index) => value >= 1 && value <= 9 && peers(index).every((peer) => board[peer] !== value));
}
```

Add a minimum-candidate recursive solver that stops at `limit`, records naked-single and hidden-single use before recursion, and returns every solution found up to that limit.

- [ ] **Step 4: Implement seeded solved-grid creation, symmetric clue removal, uniqueness checks, and difficulty classification**

Generate a base Latin-pattern solution, shuffle digits, row bands, rows within bands, column stacks, and columns within stacks from the seeded RNG. Remove symmetric cell pairs only when `solveSudoku(candidate, 2)` returns exactly one solution. Classify Easy at 40–46 clues with singles only, Medium at 32–39 clues with candidate elimination, and Hard at 26–31 clues with the solver's advanced-elimination flag. Bound each seed to 12 removal attempts, then derive a new seed.

- [ ] **Step 5: Run Sudoku tests and a 30-seed validity sweep**

Run: `node --test Tests/games/sudoku.test.mjs`  
Expected: PASS, including 10 seeds per difficulty completing within the test timeout.

- [ ] **Step 6: Commit Sudoku**

```bash
git add Resources/games/sudoku.js Tests/games/sudoku.test.mjs
git commit -m "feat(games): add seeded Sudoku engine"
```

---

### Task 3: Connected curated Crossword engine

**Files:**
- Create: `Resources/games/crossword-content.js`
- Create: `Resources/games/crossword.js`
- Create: `Tests/games/crossword.test.mjs`

**Interfaces:**
- Consumes: `createRng` and `deriveSeed` plus content records shaped as `{ answer, clue, level, tags }`.
- Produces: Crossword exports in Shared Interfaces. `answers` entries are `{ number, direction, answer, clue, row, column }`; `cells` is a square array of `null` or `{ solution, number, across, down }`.

- [ ] **Step 1: Write failing content-integrity, grid-validity, and fallback tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import entries from '../../Resources/games/crossword-content.js';
import { generateCrossword, validateCrossword } from '../../Resources/games/crossword.js';

test('curated clues have normalized unique answers and public-safe metadata', () => {
  assert.ok(entries.length >= 120);
  assert.equal(new Set(entries.map((entry) => entry.answer)).size, entries.length);
  for (const entry of entries) {
    assert.match(entry.answer, /^[A-Z]{3,12}$/);
    assert.ok(entry.clue.length >= 8);
    assert.ok(['easy', 'medium', 'hard'].includes(entry.level));
    assert.ok(entry.tags.includes('general') || entry.tags.includes('canada') || entry.tags.includes('cape-breton'));
  }
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`${difficulty} crossword is deterministic, connected, and consistent`, () => {
    const puzzle = generateCrossword({ difficulty, seed: 99, entries });
    assert.deepEqual(puzzle, generateCrossword({ difficulty, seed: 99, entries }));
    assert.deepEqual(validateCrossword(puzzle), { valid: true, errors: [] });
    assert.ok(puzzle.answers.length >= { easy: 6, medium: 9, hard: 12 }[difficulty]);
  });
}

test('impossible content returns the bundled known-valid puzzle', () => {
  const puzzle = generateCrossword({ difficulty: 'easy', seed: 1, entries: [] });
  assert.equal(puzzle.usedFallback, true);
  assert.equal(validateCrossword(puzzle).valid, true);
});
```

- [ ] **Step 2: Run the Crossword test and verify it fails**

Run: `node --test Tests/games/crossword.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Add the reviewed clue bank**

Create at least 120 unique records: at least 50 general, 35 Canadian, and 35 Cape Breton records; at least 30 records usable at each difficulty. Normalize answers to uppercase A–Z with 3–12 letters. Use stable factual clues such as `{ answer: 'CABOT', clue: 'Explorer whose name is carried by Cape Breton’s famous trail', level: 'easy', tags: ['cape-breton'] }` and `{ answer: 'LOONIE', clue: 'Canadian one-dollar coin', level: 'easy', tags: ['canada'] }`. Do not derive any clue from private KB material.

- [ ] **Step 4: Implement bounded seeded backtracking and validation**

```js
const LIMITS = {
  easy: { size: 9, target: 7, attempts: 300 },
  medium: { size: 11, target: 10, attempts: 700 },
  hard: { size: 13, target: 13, attempts: 1200 },
};

function crossingCandidates(grid, answer) {
  const placements = [];
  for (let letter = 0; letter < answer.length; letter += 1) {
    for (let row = 0; row < grid.length; row += 1) for (let column = 0; column < grid.length; column += 1) {
      if (grid[row][column]?.solution === answer[letter]) {
        placements.push({ row, column: column - letter, direction: 'across' });
        placements.push({ row: row - letter, column, direction: 'down' });
      }
    }
  }
  return placements;
}
```

Place the first answer through the center, then recursively choose shuffled crossing placements. Reject out-of-bounds words, conflicting letters, side-touching uncrossed words, duplicate answers, disconnected entries, and answer starts or ends touching another letter. Stop at the difficulty target or attempt limit. Derive up to eight seeds before returning one bundled known-valid puzzle per difficulty. Number occupied start cells in row-major order.

- [ ] **Step 5: Run Crossword tests and a 60-puzzle generation sweep**

Run: `node --test Tests/games/crossword.test.mjs`  
Expected: PASS for 20 seeds at each difficulty with every puzzle valid.

- [ ] **Step 6: Commit Crossword**

```bash
git add Resources/games/crossword-content.js Resources/games/crossword.js Tests/games/crossword.test.mjs
git commit -m "feat(games): add curated Crossword engine"
```

---

### Task 4: Themed Word Search engine

**Files:**
- Create: `Resources/games/word-search-content.js`
- Create: `Resources/games/word-search.js`
- Create: `Tests/games/word-search.test.mjs`

**Interfaces:**
- Consumes: `createRng` and themed records shaped as `{ name, tags, words }`.
- Produces: Word Search exports in Shared Interfaces; coordinates are `{ row, column }` and placements include normalized `word`, `start`, and `end`.

- [ ] **Step 1: Write failing direction, placement, and reverse-selection tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import themes from '../../Resources/games/word-search-content.js';
import { findSelection, generateWordSearch, validateWordSearch } from '../../Resources/games/word-search.js';

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`${difficulty} word search is deterministic and contains every listed word`, () => {
    const puzzle = generateWordSearch({ difficulty, seed: 77, themes });
    assert.deepEqual(puzzle, generateWordSearch({ difficulty, seed: 77, themes }));
    assert.deepEqual(validateWordSearch(puzzle), { valid: true, errors: [] });
    for (const placement of puzzle.placements) {
      assert.equal(findSelection(puzzle, placement.start, placement.end)?.word, placement.word);
      assert.equal(findSelection(puzzle, placement.end, placement.start)?.word, placement.word);
    }
  });
}
```

- [ ] **Step 2: Run the Word Search test and verify it fails**

Run: `node --test Tests/games/word-search.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Add themed word lists and difficulty rules**

Create at least 12 themes with 18 normalized words each: four general themes, four Canadian themes, and four Cape Breton themes. Include public-safe themes such as Atlantic Wildlife, Canadian Places, Kitchen, Weather, Cape Breton Music, and Coastal Words. Set rules to Easy `10×10 / 8 words / east+south`, Medium `13×13 / 12 words / all forward diagonals`, and Hard `16×16 / 16 words / all eight directions`.

- [ ] **Step 4: Implement overlap-first seeded placement, filler, and selection matching**

```js
const DIRECTIONS = {
  easy: [[0, 1], [1, 0]],
  medium: [[0, 1], [1, 0], [1, 1], [1, -1]],
  hard: [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]],
};

function cellsFor(word, row, column, [dr, dc]) {
  return [...word].map((letter, index) => ({ letter, row: row + dr * index, column: column + dc * index }));
}
```

Order selected words longest-first, score candidate placements by valid overlap count, shuffle tied candidates, and retry the complete board with a derived seed if any word cannot be placed. Fill empty cells from an English-frequency-weighted letter string. `findSelection` accepts either endpoint order and returns a matching tracked placement.

- [ ] **Step 5: Run Word Search tests and a 90-puzzle sweep**

Run: `node --test Tests/games/word-search.test.mjs`  
Expected: PASS for 30 seeds per difficulty.

- [ ] **Step 6: Commit Word Search**

```bash
git add Resources/games/word-search-content.js Resources/games/word-search.js Tests/games/word-search.test.mjs
git commit -m "feat(games): add themed Word Search engine"
```

---

### Task 5: Publish routes, shared navigation, and semantic game shells

**Files:**
- Create: `Content/games.md`
- Create: `Content/games/sudoku.md`
- Create: `Content/games/crossword.md`
- Create: `Content/games/word-search.md`
- Create: `Tests/games/routes.test.mjs`
- Modify: `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift`

**Interfaces:**
- Consumes: Publish `Page.path.string` values and `/games/ui.js`.
- Produces: four generated route shells with `data-game-page` values `hub`, `sudoku`, `crossword`, and `word-search`.

- [ ] **Step 1: Write a failing generated-route contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

for (const [route, page] of [['games', 'hub'], ['games/sudoku', 'sudoku'], ['games/crossword', 'crossword'], ['games/word-search', 'word-search']]) {
  test(`${route} has the game shell and module`, () => {
    const path = new URL(`../../Output/${route}/index.html`, import.meta.url);
    assert.equal(existsSync(path), true);
    const html = readFileSync(path, 'utf8');
    assert.match(html, new RegExp(`data-game-page="${page}"`));
    assert.match(html, /<script[^>]+type="module"[^>]+src="\/games\/ui\.js"/);
    assert.match(html, /href="\/games"[^>]*aria-current="page"/);
  });
}
```

- [ ] **Step 2: Run generation and verify the new route test fails**

Run: `make generate && node --test Tests/games/routes.test.mjs`  
Expected: FAIL because `Output/games/index.html` does not exist.

- [ ] **Step 3: Add metadata pages**

```markdown
---
title: Games
description: Play unlimited Sudoku, Crossword, and Word Search puzzles from KinNoKi Labs.
---
```

Use equivalent unique titles and descriptions for the three nested game files. Their Markdown bodies remain empty because the theme owns the interactive layout.

- [ ] **Step 4: Add Games navigation and route dispatch**

```swift
switch page.path.string {
case "games":             main = gamesMain(page: "hub"); active = "/games"
case "games/sudoku":      main = gamesMain(page: "sudoku"); active = "/games"
case "games/crossword":   main = gamesMain(page: "crossword"); active = "/games"
case "games/word-search": main = gamesMain(page: "word-search"); active = "/games"
case "services":          main = servicesMain(); active = "/services"
// preserve the remaining existing cases unchanged
}
```

Add `navLink("/games", "Games", active)` and `mobileLink("/games", "Games")`. Update `mobileLink` to accept the active path and emit `aria-current="page"` for Games, or create an equivalent active-aware helper used by every mobile link.

- [ ] **Step 5: Emit the semantic shell and module bootstrap**

```swift
private func gamesMain(page: String) -> Node<HTML.BodyContext> {
    .main(
        .class("site-main games-main"),
        .attribute(named: "data-game-page", value: page),
        .div(.class("games-live-region"), .attribute(named: "aria-live", value: "polite")),
        .div(.class("games-app"), .attribute(named: "id", value: "games-app")),
        .element(named: "script", nodes: [
            .attribute(named: "type", value: "module"),
            .attribute(named: "src", value: "/games/ui.js")
        ])
    )
}
```

- [ ] **Step 6: Generate and run the route test**

Run: `make generate && node --test Tests/games/routes.test.mjs`  
Expected: all four route contracts PASS.

- [ ] **Step 7: Commit routes and navigation**

```bash
git add Content/games.md Content/games Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift Tests/games/routes.test.mjs Output
git commit -m "feat(games): add Arcade Hall routes"
```

---

### Task 6: Arcade Hall, shared UI, and local statistics

**Files:**
- Create: `Resources/games/ui.js`
- Create: `Resources/games/hub-ui.js`
- Modify: `Resources/styles.css`
- Modify: `Tests/games/core.test.mjs`
- Modify: `Tests/games/routes.test.mjs`

**Interfaces:**
- Consumes: `core.js`, `data-game-page`, and `#games-app`.
- Produces: `renderHub(root, store)`, shared `announce(message)`, confirmation dialog helpers, difficulty links, and storage-failure notice.

- [ ] **Step 1: Add failing tests for continue links, stats formatting, reset, and required hub semantics**

Add pure exports `gameCardModel(store, game)` and `statsModel(store)` to `hub-ui.js`; test that an unfinished Medium Sudoku returns `/games/sudoku?difficulty=medium&continue=1`, an absent run returns difficulty choices, assisted runs never expose a best time, and zero-state copy is friendly. Add `renderHubMarkup(store)` and assert its returned markup contains one `<h1>`, a labelled games region, a reset button, and the three game-card headings. Keep the generated-route test focused on the server-emitted shell and module path because card markup is rendered by JavaScript at runtime.

- [ ] **Step 2: Run focused tests and verify failures**

Run: `node --test Tests/games/core.test.mjs Tests/games/routes.test.mjs`  
Expected: FAIL because hub modules and rendered contracts are absent.

- [ ] **Step 3: Implement route bootstrap and the Arcade Hall model**

```js
import { loadGameStore } from './core.js';
import { renderHub } from './hub-ui.js';

const root = document.getElementById('games-app');
const page = document.querySelector('[data-game-page]')?.dataset.gamePage;
const store = loadGameStore(localStorage);

const controllers = {
  hub: () => renderHub(root, store),
  sudoku: () => import('./sudoku-ui.js').then(({ renderSudoku }) => renderSudoku(root, store)),
  crossword: () => import('./crossword-ui.js').then(({ renderCrossword }) => renderCrossword(root, store)),
  'word-search': () => import('./word-search-ui.js').then(({ renderWordSearch }) => renderWordSearch(root, store)),
};

controllers[page]?.().catch(() => {
  root.innerHTML = '<section class="game-error" role="alert"><h1>Puzzle paused</h1><p>This game could not start. Reload the page to try a fresh puzzle.</p></section>';
});
```

Render the Arcade Hall with a single H1, three `<article>` cards, visible difficulty links, Continue when a run exists, local stats, and a native `<dialog>` confirmation for Reset Game Data.

- [ ] **Step 4: Add the complete shared visual system**

Append `.games-main`, `.games-hero`, `.game-card-grid`, `.game-card`, `.difficulty-links`, `.game-toolbar`, `.game-board`, `.game-controls`, `.game-complete`, `.games-live-region`, `.game-error`, and dialog styles. Use existing color tokens, `clamp()` sizing, `min(100%, ...)` boards, `:focus-visible`, `[aria-pressed="true"]`, non-colour state borders/icons, `@media (max-width: 759px)`, and `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 5: Generate and run focused tests**

Run: `make generate && node --test Tests/games/core.test.mjs Tests/games/routes.test.mjs`  
Expected: PASS.

- [ ] **Step 6: Commit the Arcade Hall**

```bash
git add Resources/games/ui.js Resources/games/hub-ui.js Resources/styles.css Tests/games Output
git commit -m "feat(games): build the Arcade Hall"
```

---

### Task 7: Accessible playable controllers for all three games

**Files:**
- Create: `Resources/games/sudoku-ui.js`
- Create: `Resources/games/crossword-ui.js`
- Create: `Resources/games/word-search-ui.js`
- Create: `Tests/games/dom-fixture.mjs`
- Modify: `Resources/games/ui.js`
- Modify: `Resources/styles.css`
- Modify: `Tests/games/routes.test.mjs`

**Interfaces:**
- Consumes: every engine and core interface defined above.
- Produces: `renderSudoku(root, store)`, `renderCrossword(root, store)`, and `renderWordSearch(root, store)`; each owns rendering, input, persistence after every move, assistance marking, completion, and Play Another.

- [ ] **Step 1: Add failing controller and interaction-model tests**

Create a dependency-free DOM fixture with `createElement`, attributes, class lists, event listeners, focus tracking, and query helpers used by all controller tests. Mount every controller into that fixture and require a breadcrumb back to `/games`, difficulty control, timer label, New Game, Hint, Check, instructions, and polite live region. Export pure reducer functions from each controller—`reduceSudoku`, `reduceCrossword`, and `reduceWordSearch`—and test keyboard move, undo/erase where applicable, assistance marking, completion detection, and ignored edits to fixed/solved cells.

- [ ] **Step 2: Run game tests and verify reducer-module failures**

Run: `node --test Tests/games/*.test.mjs`  
Expected: FAIL for missing controller exports and route contracts.

- [ ] **Step 3: Implement Sudoku rendering and input**

Render 81 buttons in a `role="grid"`, with `aria-rowindex`, `aria-colindex`, given/editable text, selection, related-cell state, and mistake text. Handle digits, arrows, Backspace/Delete, `P` pencil mode, `U` undo, pointer selection, and the on-screen number pad. Persist after each reducer action. Hint reveals one cell, Check announces the error count, and either action calls `markAssisted` before changing the board.

- [ ] **Step 4: Implement Crossword rendering and input**

Render only occupied cells as labelled inputs inside a CSS grid and separate ordered Across and Down clue lists. Selecting a cell chooses its current entry; repeated selection toggles direction. Handle letters, Backspace, arrows, Tab through clues, clue clicks, one-letter reveal, entry check, and full-puzzle check. Announce direction and clue when selection changes. Complete only when every occupied cell matches its solution.

- [ ] **Step 5: Implement Word Search rendering and input**

Render letter buttons in a labelled grid and a companion word list. Pointer/touch input records a start cell, previews a straight allowed direction, and resolves the end cell without disabling page scroll outside the board. Keyboard Space/Enter selects start and end; arrows move focus. Mark a word found through either endpoint order, announce it, and complete when every placement is found.

- [ ] **Step 6: Add shared new-game, resume, timer, assistance, and completion behavior**

Parse `difficulty` and `continue` with `URLSearchParams`; default to Easy for invalid values. Resume the stored run only when game and difficulty match. Confirm before replacing a progressed puzzle. Pause the visible timer on `visibilitychange`, persist accumulated play time, and resume without counting hidden time. On completion, call `completeRun`, display elapsed time and assisted status, focus the completion heading, and offer Play Another with a seed different from `previousSeeds[game]`.

- [ ] **Step 7: Run the complete game test suite**

Run: `node --test Tests/games/*.test.mjs`  
Expected: PASS with no unhandled promise rejection or console error.

- [ ] **Step 8: Commit playable controllers**

```bash
git add Resources/games Resources/styles.css Tests/games
git commit -m "feat(games): make all puzzles playable"
```

---

### Task 8: Repository documentation, full verification, publication, and durable receipt

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `Output/**` through generation only
- Modify in KB repo: `bundle/projects/kinnoki-labs-site.md`
- Create in KB repo: `bundle/status/2026-07-12-kinnoki-games-home.md`
- Modify in KB repo: `bundle/status/index.md`
- Modify in KB repo: `bundle/log.md`

**Interfaces:**
- Consumes: the complete generated site and repository/KB instructions.
- Produces: reviewable KinNoKi and KB pull requests plus verified live routes.

- [ ] **Step 1: Document the games source of truth and commands**

Add to both repository guides: the four routes; `Resources/games/` engine/controller split; `Tests/games/`; `make test-games`; local-only browser storage; and the rule that `Output/` remains generated.

- [ ] **Step 2: Run the full local verification gate**

Run:

```bash
node --test Tests/games/*.test.mjs
make test-listen
"$HOME/.claude/bin/xcode-build-gate.sh" --wait && swift build
make generate
node --test Tests/site/*.test.mjs Tests/games/routes.test.mjs
git diff --check
```

Expected: every command exits 0; all four `Output/games/**/index.html` files and `/games/*.js` assets exist.

- [ ] **Step 3: Perform focused accessibility and responsive verification**

Serve the generated site with `make preview`. Verify all three games can be started and completed using keyboard only; focus never disappears; hints announce assisted status; 200% zoom does not cause horizontal page scrolling; phone-width controls remain usable; reduced-motion removes nonessential transitions; and light, dark, and OpenDyslexic modes preserve legibility. Record any failure as a test or focused fix before continuing.

- [ ] **Step 4: Regenerate and commit the exact verified output and documentation**

```bash
make generate
git add AGENTS.md CLAUDE.md Content Resources Tests Makefile Output
git commit -m "docs(games): document and generate Arcade Hall"
git status --short --branch
```

Expected: the worktree is clean and the branch contains only games/spec/plan commits over `origin/main`.

- [ ] **Step 5: Rebase safely, push, and open a ready PR to main**

```bash
git fetch origin
git rebase origin/main
git push -u origin codex/games-home
gh pr create --repo dfakkeldy/KinNoKiLabsSite --base main --head codex/games-home --title "feat: add KinNoKi Arcade Hall" --body-file /tmp/kinnoki-games-pr.md
```

The PR body must summarize the three games and local-only state, list every verification command and result, state that `Output/` is generated, and include keyboard/accessibility checks. This repository has no nightly/weekly promotion ladder, so `main` is the correct PR base.

- [ ] **Step 6: Check hosted Cloudflare/GitHub status and fix concrete failures**

Run `gh pr checks <PR_NUMBER> --repo dfakkeldy/KinNoKiLabsSite --watch`. If a required check fails, inspect its log before changing code, reproduce locally when possible, fix, rerun the relevant gate, commit, and push. Record the final state as passing, pending, or blocked.

- [ ] **Step 7: File and publish the KB receipt in a clean KB worktree**

Create a narrow status page citing the design spec, implementation plan, KinNoKi PR, verification commands, and live URL. Update the project page, Active/recent status index, and newest-first `2026-07-12` log section. Run `python3 tools/kb_lint.py`, commit with `docs: record KinNoKi games home`, push an agent branch, and open a Tier-1 PR. Preserve any unrelated KB checkout changes by working from a clean worktree.

- [ ] **Step 8: Verify the live custom-domain routes after merge/deployment**

After the KinNoKi PR merges and Cloudflare finishes, verify HTTP 200 and expected game markers at:

```text
https://kinnokilabs.com/games
https://kinnokilabs.com/games/sudoku
https://kinnokilabs.com/games/crossword
https://kinnokilabs.com/games/word-search
```

Update the KB receipt from planned/PR state to live VERIFIED state only when the custom-domain checks succeed.

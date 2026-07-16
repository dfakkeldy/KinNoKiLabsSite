import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARTS_SIZE_BY_DIFFICULTY, buildClues, clueRuns, createChartsPlay, createChartsPuzzle,
  reduceCharts, solveChart, validateChartsState,
} from '../../Resources/games/kinnoki-charts.js';
import { CHART_CATALOG } from '../../Resources/games/kinnoki-charts-content.js';

// --- clueRuns ---------------------------------------------------------------

test('clueRuns collapses runs of filled cells', () => {
  assert.deepEqual(clueRuns([1, 1, 0, 1]), [2, 1]);
});

test('clueRuns returns an empty array for an all-empty line', () => {
  assert.deepEqual(clueRuns([0, 0]), []);
});

test('clueRuns returns an empty array for an empty line', () => {
  assert.deepEqual(clueRuns([]), []);
});

test('clueRuns treats a fully filled line as one run', () => {
  assert.deepEqual(clueRuns([1, 1, 1]), [3]);
});

// --- buildClues --------------------------------------------------------------

test('buildClues round-trips a known 3x3 picture', () => {
  // X . X
  // . X .
  // X . X
  const cells = [1, 0, 1, 0, 1, 0, 1, 0, 1];
  const clues = buildClues(cells, 3);
  assert.deepEqual(clues.rows, [[1, 1], [1], [1, 1]]);
  assert.deepEqual(clues.columns, [[1, 1], [1], [1, 1]]);
});

// --- solveChart: the full-catalog quality gate --------------------------------

test('every catalog entry is fully line-solvable and matches its own picture', () => {
  for (const [difficulty, entries] of Object.entries(CHART_CATALOG)) {
    const expectedSize = CHARTS_SIZE_BY_DIFFICULTY[difficulty];
    for (const entry of entries) {
      assert.equal(entry.size, expectedSize, `${entry.id} should be a ${expectedSize}x${expectedSize} picture`);
      const clues = buildClues(entry.solution, entry.size);
      const result = solveChart(clues, entry.size);
      assert.equal(result.solvable, true, `${difficulty}/${entry.id} should be fully line-solvable`);
      assert.deepEqual([...result.grid], entry.solution, `${difficulty}/${entry.id} solved grid should equal its picture`);
    }
  }
});

test('catalog meets the minimum entry counts per difficulty', () => {
  assert.ok(CHART_CATALOG.easy.length >= 10, 'at least 10 easy pictures');
  assert.ok(CHART_CATALOG.medium.length >= 8, 'at least 8 medium pictures');
  assert.ok(CHART_CATALOG.hard.length >= 6, 'at least 6 hard pictures');
});

test('catalog ids are unique and kebab-case within each difficulty', () => {
  for (const entries of Object.values(CHART_CATALOG)) {
    const ids = entries.map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length, 'ids must be unique within a difficulty');
    for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  }
});

test('solveChart reports unsolvable for an ambiguous 2x2 checkerboard', () => {
  const clues = { rows: [[1], [1]], columns: [[1], [1]] };
  const result = solveChart(clues, 2);
  assert.equal(result.solvable, false);
  assert.equal(result.grid, null);
});

// --- createChartsPuzzle -------------------------------------------------------

test('createChartsPuzzle is deterministic for a fixed seed', () => {
  const first = createChartsPuzzle({ difficulty: 'easy', seed: 42 });
  const second = createChartsPuzzle({ difficulty: 'easy', seed: 42 });
  assert.deepEqual(first, second);
});

test('createChartsPuzzle definition matches the contract shape', () => {
  const { definition } = createChartsPuzzle({ difficulty: 'medium', seed: 7 });
  assert.equal(typeof definition.id, 'string');
  assert.equal(typeof definition.title, 'string');
  assert.equal(definition.size, CHARTS_SIZE_BY_DIFFICULTY.medium);
  assert.equal(definition.solution.length, definition.size * definition.size);
  assert.ok(definition.solution.every((value) => value === 0 || value === 1));
  assert.deepEqual(definition.clues, buildClues(definition.solution, definition.size));
});

test('createChartsPuzzle throws for an unknown difficulty', () => {
  assert.throws(() => createChartsPuzzle({ difficulty: 'nightmare', seed: 1 }), RangeError);
});

test('createChartsPuzzle avoids repeating the previous picture signature', () => {
  const seed = 100;
  const first = createChartsPuzzle({ difficulty: 'easy', seed });
  let previous = first.definition.id;
  // Re-request with the same seed for many attempts: every result should
  // avoid the just-played picture whenever another one is available.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const next = createChartsPuzzle({
      difficulty: 'easy', seed: seed + attempt, previousSignatures: previous,
    });
    assert.notEqual(next.definition.id, previous);
    previous = next.definition.id;
  }
});

test('createChartsPuzzle previousSignatures also accepts an array', () => {
  const first = createChartsPuzzle({ difficulty: 'hard', seed: 5 });
  const avoided = CHART_CATALOG.hard.map((entry) => entry.id).filter((id) => id !== first.definition.id);
  const next = createChartsPuzzle({
    difficulty: 'hard', seed: 5, previousSignatures: avoided,
  });
  // Every id except first.definition.id is excluded, so the only picture left is first's.
  assert.equal(next.definition.id, first.definition.id);
});

// --- reduceCharts --------------------------------------------------------------

const smallDefinition = () => Object.freeze({
  id: 'test-picture',
  title: 'Test picture',
  size: 3,
  solution: Object.freeze([1, 0, 1, 0, 1, 0, 1, 0, 1]),
  clues: buildClues([1, 0, 1, 0, 1, 0, 1, 0, 1], 3),
});

const freshState = (overrides = {}) => Object.freeze({
  definition: smallDefinition(),
  ...createChartsPlay(3),
  ...overrides,
});

test('createChartsPlay with no arguments matches the bare contract shape', () => {
  assert.deepEqual(createChartsPlay(), { marks: [], selected: 0, errors: [], completed: false });
});

test('createChartsPlay(size) sizes the marks array to size*size', () => {
  const play = createChartsPlay(3);
  assert.equal(play.marks.length, 9);
  assert.ok(play.marks.every((mark) => mark === 0));
});

test('cycle steps blank -> filled -> marked -> blank', () => {
  let state = freshState();
  state = reduceCharts(state, { type: 'select', index: 1 });
  state = reduceCharts(Object.freeze(state), { type: 'cycle' });
  assert.equal(state.marks[1], 1);
  state = reduceCharts(Object.freeze(state), { type: 'cycle' });
  assert.equal(state.marks[1], 2);
  state = reduceCharts(Object.freeze(state), { type: 'cycle' });
  assert.equal(state.marks[1], 0);
});

test('fill/mark/erase set the selected cell directly regardless of current value', () => {
  let state = freshState({ selected: 4 });
  state = reduceCharts(Object.freeze(state), { type: 'fill' });
  assert.equal(state.marks[4], 1);
  state = reduceCharts(Object.freeze(state), { type: 'mark' });
  assert.equal(state.marks[4], 2);
  state = reduceCharts(Object.freeze(state), { type: 'erase' });
  assert.equal(state.marks[4], 0);
});

test('move clamps row/column to the board bounds', () => {
  const state = freshState();
  const below = reduceCharts(state, { type: 'move', row: -5, column: -5 });
  assert.equal(below.selected, 0);
  const above = reduceCharts(state, { type: 'move', row: 99, column: 99 });
  assert.equal(above.selected, 8); // bottom-right of a 3x3 board
});

test('select clamps to the valid index range', () => {
  const state = freshState();
  assert.equal(reduceCharts(state, { type: 'select', index: -3 }).selected, 0);
  assert.equal(reduceCharts(state, { type: 'select', index: 500 }).selected, 8);
});

test('reduceCharts does not mutate a frozen input state and returns a new object', () => {
  const state = freshState({ selected: 0 });
  const before = JSON.stringify(state);
  const next = reduceCharts(state, { type: 'cycle' });
  assert.equal(JSON.stringify(state), before, 'input state must be untouched');
  assert.notEqual(next, state);
  assert.notEqual(next.marks, state.marks);
});

test('completion ignores marked-empty cells and only compares filled cells to the solution', () => {
  // solution: X.X / .X. / X.X (indices 0,2,4,6,8 are filled). Fill only the
  // first four so the puzzle is not yet complete, then mark an empty
  // solution-0 cell before finishing -- that mark must not block completion.
  let state = freshState();
  for (const index of [0, 2, 4, 6]) {
    state = reduceCharts(Object.freeze(state), { type: 'select', index });
    state = reduceCharts(Object.freeze(state), { type: 'fill' });
  }
  assert.equal(state.completed, false);
  // Mark an empty (solution-0) cell as "marked-empty" (2) -- irrelevant to completion.
  state = reduceCharts(Object.freeze(state), { type: 'select', index: 1 });
  state = reduceCharts(Object.freeze(state), { type: 'mark' });
  assert.equal(state.completed, false);
  // Fill the last real solution cell -- now it's complete despite the mark above.
  state = reduceCharts(Object.freeze(state), { type: 'select', index: 8 });
  state = reduceCharts(Object.freeze(state), { type: 'fill' });
  assert.equal(state.completed, true);
});

test('completed state locks out further mutation', () => {
  let state = freshState();
  for (const index of [0, 2, 4, 6, 8]) {
    state = reduceCharts(Object.freeze(state), { type: 'select', index });
    state = reduceCharts(Object.freeze(state), { type: 'fill' });
  }
  assert.equal(state.completed, true);
  const after = reduceCharts(Object.freeze(state), { type: 'erase' });
  assert.equal(after, state);
});

test('hint fills one incorrect-or-blank solution cell without touching others', () => {
  const state = freshState();
  const next = reduceCharts(state, { type: 'hint' });
  const filledIndexes = next.marks.flatMap((mark, index) => (mark === 1 ? [index] : []));
  assert.equal(filledIndexes.length, 1);
  assert.equal(next.definition.solution[filledIndexes[0]], 1);
  assert.equal(next.selected, filledIndexes[0]);
});

test('hint is a no-op once every solution cell is already filled', () => {
  let state = freshState();
  for (const index of [0, 2, 4, 6]) { // fill all-but-one solution cell, avoid completing
    state = reduceCharts(Object.freeze(state), { type: 'select', index });
    state = reduceCharts(Object.freeze(state), { type: 'fill' });
  }
  // Mark the remaining solution cell (8) wrong-empty so we're not complete yet, then hint it.
  state = reduceCharts(Object.freeze(state), { type: 'select', index: 8 });
  state = reduceCharts(Object.freeze(state), { type: 'mark' });
  const hinted = reduceCharts(Object.freeze(state), { type: 'hint' });
  assert.equal(hinted.marks[8], 1);
  assert.equal(hinted.completed, true);
  const again = reduceCharts(Object.freeze(hinted), { type: 'hint' });
  assert.equal(again, hinted); // completed lock makes this a true no-op
});

test('check flags wrongly filled cells in state.errors', () => {
  let state = freshState({ selected: 1 }); // index 1 is a solution-empty cell
  state = reduceCharts(Object.freeze(state), { type: 'fill' }); // wrongly filled
  state = reduceCharts(Object.freeze(state), { type: 'check' });
  assert.deepEqual(state.errors, [1]);
});

test('check does not flag correctly filled or blank cells', () => {
  let state = freshState({ selected: 0 }); // index 0 is a solution-filled cell
  state = reduceCharts(Object.freeze(state), { type: 'fill' }); // correct
  state = reduceCharts(Object.freeze(state), { type: 'check' });
  assert.deepEqual(state.errors, []);
});

// --- validateChartsState -------------------------------------------------------

test('validateChartsState accepts a well-formed save', () => {
  const play = { marks: new Array(25).fill(0), selected: 3, errors: [1, 2], completed: false };
  assert.equal(validateChartsState(play, 'easy').valid, true);
});

test('validateChartsState rejects a marks array of the wrong length', () => {
  const play = { marks: new Array(10).fill(0), selected: 0, errors: [], completed: false };
  assert.equal(validateChartsState(play, 'easy').valid, false);
});

test('validateChartsState rejects a non-array marks field', () => {
  const play = { marks: 'nope', selected: 0, errors: [], completed: false };
  assert.equal(validateChartsState(play, 'easy').valid, false);
});

test('validateChartsState rejects out-of-range mark values', () => {
  const marks = new Array(25).fill(0);
  marks[3] = 9;
  const play = { marks, selected: 0, errors: [], completed: false };
  assert.equal(validateChartsState(play, 'easy').valid, false);
});

test('validateChartsState rejects a null play state', () => {
  assert.equal(validateChartsState(null, 'easy').valid, false);
});

test('validateChartsState rejects an unknown difficulty', () => {
  const play = { marks: new Array(25).fill(0), selected: 0, errors: [], completed: false };
  assert.equal(validateChartsState(play, 'nightmare').valid, false);
});

test('validateChartsState rejects a hostile selected/errors/completed shape', () => {
  const base = { marks: new Array(25).fill(0), selected: 0, errors: [], completed: false };
  assert.equal(validateChartsState({ ...base, selected: -1 }, 'easy').valid, false);
  assert.equal(validateChartsState({ ...base, selected: 25 }, 'easy').valid, false);
  assert.equal(validateChartsState({ ...base, errors: [100] }, 'easy').valid, false);
  assert.equal(validateChartsState({ ...base, errors: 'nope' }, 'easy').valid, false);
  assert.equal(validateChartsState({ ...base, completed: 'yes' }, 'easy').valid, false);
});

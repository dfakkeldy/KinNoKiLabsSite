import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, FixtureEvent, installDOM } from './dom-fixture.mjs';

const sudokuPuzzle = {
  seed: 1, difficulty: 'easy',
  puzzle: [1, ...Array(80).fill(0)],
  solution: Array.from({ length: 81 }, (_, index) => (index % 9) + 1),
};
const crosswordPuzzle = {
  seed: 2, difficulty: 'easy', size: 3,
  cells: [
    [{ solution: 'C', number: 1, across: 1, down: 1 }, { solution: 'A', number: null, across: 1, down: null }, { solution: 'T', number: null, across: 1, down: null }],
    [{ solution: 'A', number: null, across: null, down: 1 }, null, null],
    [{ solution: 'R', number: null, across: null, down: 1 }, null, null],
  ],
  answers: [
    { number: 1, direction: 'across', answer: 'CAT', clue: 'A pet', row: 0, column: 0 },
    { number: 1, direction: 'down', answer: 'CAR', clue: 'A vehicle', row: 0, column: 0 },
  ],
};
const wordSearchPuzzle = {
  seed: 3, difficulty: 'easy', size: 3, theme: 'Pets',
  grid: [['C', 'A', 'T'], ['X', 'X', 'X'], ['D', 'O', 'G']],
  placements: [
    { word: 'CAT', start: { row: 0, column: 0 }, end: { row: 0, column: 2 } },
    { word: 'DOG', start: { row: 2, column: 0 }, end: { row: 2, column: 2 } },
  ],
};

test('Sudoku reducer supports movement, edit, pencil, erase, undo, assistance, and fixed cells', async () => {
  const { createSudokuState, reduceSudoku } = await import('../../Resources/games/sudoku-ui.js');
  let state = createSudokuState(sudokuPuzzle);
  state = reduceSudoku(state, { type: 'digit', value: 9 });
  assert.equal(state.values[0], 1, 'given cell cannot be edited');
  state = reduceSudoku(state, { type: 'move', row: 0, column: 1 });
  state = reduceSudoku(state, { type: 'toggle-pencil' });
  state = reduceSudoku(state, { type: 'digit', value: 2 });
  assert.deepEqual(state.notes[1], [2]);
  state = reduceSudoku(state, { type: 'toggle-pencil' });
  state = reduceSudoku(state, { type: 'digit', value: 2 });
  assert.equal(state.values[1], 2);
  state = reduceSudoku(state, { type: 'erase' });
  assert.equal(state.values[1], 0);
  state = reduceSudoku(state, { type: 'undo' });
  assert.equal(state.values[1], 2);
  state = reduceSudoku(state, { type: 'reveal' });
  assert.equal(state.assisted, true);
});

test('Crossword reducer handles letters, movement, erase, reveal, checks, and completion', async () => {
  const { createCrosswordState, reduceCrossword } = await import('../../Resources/games/crossword-ui.js');
  let state = createCrosswordState(crosswordPuzzle);
  state = reduceCrossword(state, { type: 'letter', value: 'C' });
  assert.deepEqual(state.selected, { row: 0, column: 1 });
  state = reduceCrossword(state, { type: 'letter', value: 'X' });
  state = reduceCrossword(state, { type: 'check-entry' });
  assert.equal(state.errors.includes('0:1'), true);
  state = reduceCrossword(state, { type: 'reveal' });
  assert.equal(state.assisted, true);
  state = reduceCrossword(state, { type: 'erase' });
  assert.equal(state.values[0][2], '');
  const solved = crosswordPuzzle.cells.map((row) => row.map((cell) => cell?.solution ?? ''));
  state = reduceCrossword({ ...state, values: solved }, { type: 'check-all' });
  assert.equal(state.completed, true);
});

test('Word Search reducer supports keyboard focus, both endpoint orders, ignored solved words, and completion', async () => {
  const { createWordSearchState, reduceWordSearch } = await import('../../Resources/games/word-search-ui.js');
  let state = createWordSearchState(wordSearchPuzzle);
  const noDiagonalPreview = reduceWordSearch({ ...state, start: { row: 0, column: 0 } }, { type: 'preview', end: { row: 1, column: 1 } });
  assert.equal(noDiagonalPreview.preview, null, 'easy preview only follows allowed cardinal directions');
  state = reduceWordSearch(state, { type: 'move', row: 0, column: 2 });
  state = reduceWordSearch(state, { type: 'select' });
  state = reduceWordSearch(state, { type: 'move', row: 0, column: 0 });
  state = reduceWordSearch(state, { type: 'select' });
  assert.deepEqual(state.found, ['CAT']);
  const unchanged = reduceWordSearch(state, { type: 'select-endpoints', start: { row: 0, column: 0 }, end: { row: 0, column: 2 } });
  assert.deepEqual(unchanged.found, ['CAT']);
  state = reduceWordSearch(unchanged, { type: 'select-endpoints', start: { row: 2, column: 0 }, end: { row: 2, column: 2 } });
  assert.equal(state.completed, true);
});

for (const [name, modulePath, renderName, expectedCells] of [
  ['Sudoku', '../../Resources/games/sudoku-ui.js', 'renderSudoku', 81],
  ['Crossword', '../../Resources/games/crossword-ui.js', 'renderCrossword', 5],
  ['Word Search', '../../Resources/games/word-search-ui.js', 'renderWordSearch', 9],
]) {
  test(`${name} controller renders accessible shared controls and a playable grid`, async () => {
    const fixture = createDOMFixture();
    const restore = installDOM(fixture);
    try {
      const module = await import(modulePath);
      const puzzle = name === 'Sudoku' ? sudokuPuzzle : name === 'Crossword' ? crosswordPuzzle : wordSearchPuzzle;
      const game = name === 'Sudoku' ? 'sudoku' : name === 'Crossword' ? 'crossword' : 'word-search';
      const store = { version: 1, runs: { [game]: { difficulty: 'easy', seed: puzzle.seed, puzzle: { definition: puzzle }, startedAt: 0, elapsedBeforeStartMs: 0, assisted: false } }, previousSeeds: {}, stats: { totalCompleted: 0, currentStreak: 0, lastCompletedDate: null, games: {} } };
      fixture.location.search = '?difficulty=easy&continue=1';
      await module[renderName](fixture.root, store);
      assert.equal(fixture.root.querySelector('[href="/games"]')?.textContent.includes('Games'), true);
      assert.ok(fixture.root.querySelector('[data-difficulty]'));
      assert.ok(fixture.root.querySelector('[data-timer]'));
      assert.ok(fixture.root.querySelector('[data-new-game]'));
      assert.ok(fixture.root.querySelector('[data-hint]'));
      assert.ok(fixture.root.querySelector('[data-check]'));
      assert.ok(fixture.root.querySelector('[data-instructions]'));
      assert.equal(fixture.root.querySelector('[aria-live="polite"]')?.getAttribute('role'), 'status');
      assert.equal(fixture.root.querySelectorAll('[role="gridcell"]').length, expectedCells);
    } finally { restore(); }
  });
}

test('Sudoku keyboard and pointer actions update cells and persist progress', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderSudoku } = await import('../../Resources/games/sudoku-ui.js');
    const store = { version: 1, runs: { sudoku: { difficulty: 'easy', seed: 1, puzzle: { definition: sudokuPuzzle }, startedAt: 0, elapsedBeforeStartMs: 0, assisted: false } }, previousSeeds: {}, stats: { totalCompleted: 0, currentStreak: 0, lastCompletedDate: null, games: {} } };
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderSudoku(fixture.root, store);
    const cell = fixture.root.querySelector('[data-cell="1"]');
    cell.click(); cell.dispatchEvent(new FixtureEvent('keydown', { key: '2' }));
    assert.equal(fixture.root.querySelector('[data-cell="1"]').textContent, '2');
    assert.match(fixture.localStorage.getItem('kinnoki-games:v1'), /"sudoku"/);
    fixture.root.querySelector('[data-hint]').click();
    assert.match(fixture.localStorage.getItem('kinnoki-games:v1'), /"assisted":true/);
  } finally { restore(); }
});

test('Word Search announces a found word and focuses completion after the final selection', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderWordSearch } = await import('../../Resources/games/word-search-ui.js');
    const state = { focus: { row: 0, column: 0 }, start: null, found: ['DOG'], completed: false, assisted: false };
    const store = { version: 1, runs: { 'word-search': { difficulty: 'easy', seed: 3, puzzle: { definition: wordSearchPuzzle, play: state }, startedAt: 0, elapsedBeforeStartMs: 0, assisted: false } }, previousSeeds: {}, stats: { totalCompleted: 0, currentStreak: 0, lastCompletedDate: null, games: { 'word-search': { completed: 0, bestMs: { easy: null, medium: null, hard: null } } } } };
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderWordSearch(fixture.root, store);
    fixture.root.querySelector('[data-cell="0:0"]').dispatchEvent(new FixtureEvent('keydown', { key: 'Enter' }));
    const end = fixture.root.querySelector('[data-cell="0:2"]'); end.focus(); end.dispatchEvent(new FixtureEvent('keydown', { key: 'Enter' }));
    assert.match(fixture.root.querySelector('.games-live-region').textContent, /CAT|complete/i);
    assert.equal(fixture.document.activeElement, fixture.root.querySelector('[data-complete-heading]'));
    assert.ok(fixture.root.querySelector('[data-play-another]'));
  } finally { restore(); }
});

test('a progressed run is preserved when replacement confirmation is declined', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy', confirm: false }); const restore = installDOM(fixture);
  try {
    const { renderSudoku } = await import('../../Resources/games/sudoku-ui.js');
    const play = (await import('../../Resources/games/sudoku-ui.js')).createSudokuState(sudokuPuzzle);
    play.values[1] = 2;
    const store = { version: 1, runs: { sudoku: { difficulty: 'easy', seed: 1, puzzle: { definition: sudokuPuzzle, play }, startedAt: 10, elapsedBeforeStartMs: 0, assisted: false } }, previousSeeds: {}, stats: { totalCompleted: 0, currentStreak: 0, lastCompletedDate: null, games: {} } };
    fixture.localStorage.setItem('kinnoki-games:v1', JSON.stringify(store));
    await renderSudoku(fixture.root, store);
    assert.equal(fixture.root.querySelector('[data-cell="1"]').textContent, '2');
    assert.equal(JSON.parse(fixture.localStorage.getItem('kinnoki-games:v1')).runs.sudoku.seed, 1);
  } finally { restore(); }
});

test('visibility changes persist elapsed play without counting hidden time', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  const originalNow = Date.now;
  try {
    let now = 1000; Date.now = () => now;
    const { renderSudoku } = await import('../../Resources/games/sudoku-ui.js');
    const store = { version: 1, runs: { sudoku: { difficulty: 'easy', seed: 1, puzzle: { definition: sudokuPuzzle }, startedAt: 0, elapsedBeforeStartMs: 0, assisted: false } }, previousSeeds: {}, stats: { totalCompleted: 0, currentStreak: 0, lastCompletedDate: null, games: {} } };
    await renderSudoku(fixture.root, store);
    fixture.document.visibilityState = 'hidden'; fixture.document.dispatchEvent(new FixtureEvent('visibilitychange'));
    now = 11000; fixture.document.visibilityState = 'visible'; fixture.document.dispatchEvent(new FixtureEvent('visibilitychange'));
    now = 12000; fixture.root.querySelector('[data-cell="1"]').click();
    const run = JSON.parse(fixture.localStorage.getItem('kinnoki-games:v1')).runs.sudoku;
    assert.equal(run.elapsedBeforeStartMs, 1000);
    assert.equal(run.startedAt, 11000);
  } finally { Date.now = originalNow; restore(); }
});

test('Play Another starts a run whose seed differs from the completed seed', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const { renderWordSearch } = await import('../../Resources/games/word-search-ui.js');
    const play = { ...((await import('../../Resources/games/word-search-ui.js')).createWordSearchState(wordSearchPuzzle)), found: ['DOG'] };
    const store = { version: 1, runs: { 'word-search': { difficulty: 'easy', seed: 3, puzzle: { definition: wordSearchPuzzle, play }, startedAt: Date.now(), elapsedBeforeStartMs: 0, assisted: false } }, previousSeeds: {}, stats: { totalCompleted: 0, currentStreak: 0, lastCompletedDate: null, games: { 'word-search': { completed: 0, bestMs: { easy: null, medium: null, hard: null } } } } };
    await renderWordSearch(fixture.root, store);
    fixture.root.querySelector('[data-cell="0:0"]').dispatchEvent(new FixtureEvent('keydown', { key: 'Enter' }));
    fixture.root.querySelector('[data-cell="0:2"]').focus(); fixture.root.querySelector('[data-cell="0:2"]').dispatchEvent(new FixtureEvent('keydown', { key: 'Enter' }));
    fixture.root.querySelector('[data-play-another]').click();
    const next = JSON.parse(fixture.localStorage.getItem('kinnoki-games:v1'));
    assert.notEqual(next.runs['word-search'].seed, next.previousSeeds['word-search']);
  } finally { restore(); }
});

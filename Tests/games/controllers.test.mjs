import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, FixtureEvent, installDOM } from './dom-fixture.mjs';
import { generateSudoku } from '../../Resources/games/sudoku.js';
import { generateWordSearch } from '../../Resources/games/word-search.js';
import { createEmptyGameStore, STORE_KEYS } from '../../Resources/games/core.js';

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

const sudokuPuzzle = generateSudoku({ difficulty: 'easy', seed: 20260712 });
const sudokuGiven = sudokuPuzzle.puzzle.findIndex(Boolean);
const sudokuEditable = sudokuPuzzle.puzzle.findIndex((value) => value === 0);
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
const wordSearchPuzzle = generateWordSearch({ difficulty: 'easy', seed: 77 });

test('shared element helper omits absent optional children', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { element } = await import('../../Resources/games/controller-common.js');
    assert.equal(element('div', {}, null, undefined).textContent, '');
  } finally { restore(); }
});

test('a saved-progress conflict resumes by default and offers a dialog to start fresh', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { createSession } = await import('../../Resources/games/controller-common.js');
    const { createEmptyGameStore: emptyStore, startRun } = await import('../../Resources/games/core.js');
    const savedDefinition = { difficulty: 'easy', seed: 9, id: 'saved-definition' };
    let store = emptyStore();
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
    // The saved run resumes immediately — no data is lost by default.
    assert.equal(session.run.signature, savedDefinition.id);
    assert.equal(seenSeeds.length, 0);
    await Promise.resolve();
    const dialog = fixture.root.querySelector('dialog.game-dialog');
    assert.ok(dialog, 'a confirm dialog is offered for the conflicting saved run');
    assert.equal(dialog.querySelector('[data-dialog-confirm]').textContent, 'Start new');
    dialog.querySelector('[data-dialog-confirm]').click();
    assert.ok(seenSeeds.length >= 2);
    assert.notEqual(session.run.signature, savedDefinition.id);
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'confirming closes the dialog');
    session.dispose();
  } finally { restore(); }
});

test('declining the saved-progress dialog leaves the resumed run untouched', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { createSession } = await import('../../Resources/games/controller-common.js');
    const { createEmptyGameStore: emptyStore, startRun } = await import('../../Resources/games/core.js');
    const savedDefinition = { difficulty: 'easy', seed: 9, id: 'saved-definition' };
    let store = emptyStore();
    store = startRun(store, {
      game: 'sudoku', mode: 'default', difficulty: 'easy', seed: 9,
      signature: savedDefinition.id,
      puzzle: { definition: savedDefinition, play: { progressed: true } }, now: 0,
    });
    const session = createSession({
      root: fixture.root, game: 'sudoku', store,
      createPuzzle: ({ seed }) => ({ difficulty: 'easy', seed, id: `fresh-${seed}` }),
      createPlay: () => ({}), progressed: () => true, validateRun: () => true,
      definitionSignature: (definition) => definition.id,
      onRender: async () => {},
    });
    await Promise.resolve();
    fixture.root.querySelector('[data-dialog-cancel]').click();
    assert.equal(session.run.signature, savedDefinition.id, 'declining keeps the resumed run');
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'declining closes the dialog');
    session.dispose();
  } finally { restore(); }
});

test('Sudoku reducer supports movement, edit, pencil, erase, undo, assistance, and fixed cells', async () => {
  const { createSudokuState, reduceSudoku } = await import('../../Resources/games/sudoku-ui.js');
  let state = createSudokuState(sudokuPuzzle);
  state = reduceSudoku(state, { type: 'select', index: sudokuGiven });
  state = reduceSudoku(state, { type: 'digit', value: 9 });
  assert.equal(state.values[sudokuGiven], sudokuPuzzle.puzzle[sudokuGiven], 'given cell cannot be edited');
  state = reduceSudoku(state, { type: 'select', index: sudokuEditable });
  state = reduceSudoku(state, { type: 'toggle-pencil' });
  state = reduceSudoku(state, { type: 'digit', value: 2 });
  assert.deepEqual(state.notes[sudokuEditable], [2]);
  state = reduceSudoku(state, { type: 'toggle-pencil' });
  state = reduceSudoku(state, { type: 'digit', value: 2 });
  assert.equal(state.values[sudokuEditable], 2);
  state = reduceSudoku(state, { type: 'erase' });
  assert.equal(state.values[sudokuEditable], 0);
  state = reduceSudoku(state, { type: 'undo' });
  assert.equal(state.values[sudokuEditable], 2);
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
  const [first, second] = wordSearchPuzzle.placements;
  state = reduceWordSearch(state, { type: 'move', ...first.end });
  state = reduceWordSearch(state, { type: 'select' });
  state = reduceWordSearch(state, { type: 'move', ...first.start });
  state = reduceWordSearch(state, { type: 'select' });
  assert.deepEqual(state.found, [first.word]);
  const unchanged = reduceWordSearch(state, { type: 'select-endpoints', start: first.start, end: first.end });
  assert.deepEqual(unchanged.found, [first.word]);
  state = reduceWordSearch(unchanged, { type: 'select-endpoints', start: second.start, end: second.end });
  assert.deepEqual(state.found, [first.word, second.word]);
});

for (const [name, modulePath, renderName, expectedCells] of [
  ['Sudoku', '../../Resources/games/sudoku-ui.js', 'renderSudoku', 81],
  ['Crossword', '../../Resources/games/crossword-ui.js', 'renderCrossword', 5],
  ['Word Search', '../../Resources/games/word-search-ui.js', 'renderWordSearch', wordSearchPuzzle.size ** 2],
]) {
  test(`${name} controller renders accessible shared controls and a playable grid`, async () => {
    const fixture = createDOMFixture();
    const restore = installDOM(fixture);
    try {
      const module = await import(modulePath);
      const puzzle = name === 'Sudoku' ? sudokuPuzzle : name === 'Crossword' ? crosswordPuzzle : wordSearchPuzzle;
      const game = name === 'Sudoku' ? 'sudoku' : name === 'Crossword' ? 'crossword' : 'word-search';
      const store = v2StoreWithRun({ game, definition: puzzle });
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
      if (name === 'Crossword') assert.doesNotMatch(fixture.root.textContent, /\bnull\b/);
    } finally { restore(); }
  });
}

test('Sudoku keyboard and pointer actions update cells and persist progress', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderSudoku } = await import('../../Resources/games/sudoku-ui.js');
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, seed: 1 });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderSudoku(fixture.root, store);
    const cell = fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`);
    cell.click(); cell.dispatchEvent(new FixtureEvent('keydown', { key: '2' }));
    assert.equal(fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`).textContent, '2');
    assert.match(fixture.localStorage.getItem(STORE_KEYS.v2), /"sudoku"/);
    fixture.root.querySelector('[data-hint]').click();
    assert.match(fixture.localStorage.getItem(STORE_KEYS.v2), /"assisted":true/);
    assert.match(fixture.root.querySelector('.games-live-region').textContent, /hint revealed.*assisted/i);
  } finally { restore(); }
});

test('Word Search announces a found word and focuses completion after the final selection', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderWordSearch } = await import('../../Resources/games/word-search-ui.js');
    const target = wordSearchPuzzle.placements[0];
    const state = { focus: target.start, start: null, preview: null, found: wordSearchPuzzle.placements.slice(1).map(({ word }) => word), completed: false, assisted: false };
    const store = v2StoreWithRun({ game: 'word-search', definition: wordSearchPuzzle, play: state });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderWordSearch(fixture.root, store);
    fixture.root.querySelector(`[data-cell="${target.start.row}:${target.start.column}"]`).dispatchEvent(new FixtureEvent('keydown', { key: 'Enter' }));
    const end = fixture.root.querySelector(`[data-cell="${target.end.row}:${target.end.column}"]`); end.focus(); end.dispatchEvent(new FixtureEvent('keydown', { key: 'Enter' }));
    assert.match(fixture.root.querySelector('.games-live-region').textContent, new RegExp(`${target.word}|complete`, 'i'));
    assert.equal(fixture.document.activeElement, fixture.root.querySelector('[data-complete-heading]'));
    assert.ok(fixture.root.querySelector('[data-play-another]'));
  } finally { restore(); }
});

test('a progressed same-difficulty run is preserved by default before the replace dialog is answered', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' }); const restore = installDOM(fixture);
  try {
    const { renderSudoku } = await import('../../Resources/games/sudoku-ui.js');
    const play = (await import('../../Resources/games/sudoku-ui.js')).createSudokuState(sudokuPuzzle);
    play.values[sudokuEditable] = 2;
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, play, seed: 1, startedAt: 10 });
    fixture.localStorage.setItem(STORE_KEYS.v2, JSON.stringify(store));
    await renderSudoku(fixture.root, store);
    assert.equal(fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`).textContent, '2');
    assert.equal(JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2)).runs.sudoku.seed, 1);
  } finally { restore(); }
});

test('visibility changes persist elapsed play without counting hidden time', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  const originalNow = Date.now;
  const originalPerformance = globalThis.performance;
  try {
    let now = 1000, active = 100; Date.now = () => now;
    globalThis.performance = { now: () => active };
    const { renderSudoku } = await import('../../Resources/games/sudoku-ui.js');
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, seed: 1 });
    await renderSudoku(fixture.root, store);
    active = 1100;
    fixture.document.visibilityState = 'hidden'; fixture.document.dispatchEvent(new FixtureEvent('visibilitychange'));
    now = 11000; fixture.document.visibilityState = 'visible'; fixture.document.dispatchEvent(new FixtureEvent('visibilitychange'));
    now = 12000; active = 2100; fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`).click();
    const run = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2)).runs.sudoku;
    assert.equal(run.elapsedBeforeStartMs, 1000);
    assert.equal(run.startedAt, 11000);
  } finally { Date.now = originalNow; globalThis.performance = originalPerformance; restore(); }
});

test('Play Another starts a run whose seed differs from the completed seed', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const { renderWordSearch } = await import('../../Resources/games/word-search-ui.js');
    const target = wordSearchPuzzle.placements[0];
    const play = { ...((await import('../../Resources/games/word-search-ui.js')).createWordSearchState(wordSearchPuzzle)), focus: target.start, found: wordSearchPuzzle.placements.slice(1).map(({ word }) => word) };
    const store = v2StoreWithRun({ game: 'word-search', definition: wordSearchPuzzle, play, startedAt: Date.now() });
    await renderWordSearch(fixture.root, store);
    fixture.root.querySelector(`[data-cell="${target.start.row}:${target.start.column}"]`).dispatchEvent(new FixtureEvent('keydown', { key: 'Enter' }));
    fixture.root.querySelector(`[data-cell="${target.end.row}:${target.end.column}"]`).focus(); fixture.root.querySelector(`[data-cell="${target.end.row}:${target.end.column}"]`).dispatchEvent(new FixtureEvent('keydown', { key: 'Enter' }));
    fixture.root.querySelector('[data-play-another]').click();
    const next = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.notEqual(next.runs['word-search'].seed, next.previousSeeds['word-search']);
  } finally { restore(); }
});

test('prefersReducedMotion defaults to false without matchMedia and honors a stubbed match', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { prefersReducedMotion } = await import('../../Resources/games/controller-common.js');
    assert.equal(prefersReducedMotion(), false, 'no matchMedia on the fixture means no preference detected');
    const originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia = (query) => ({ matches: true, media: query });
    try {
      assert.equal(prefersReducedMotion(), true);
    } finally {
      if (originalMatchMedia === undefined) delete globalThis.matchMedia;
      else globalThis.matchMedia = originalMatchMedia;
    }
  } finally { restore(); }
});

test('createConfirmDialog mounts labeled actions, fires the matching callback, and close() removes it', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createConfirmDialog } = await import('../../Resources/games/controller-common.js');
    let confirmed = 0, cancelled = 0;
    const confirmDialog = createConfirmDialog(fixture.root, {
      title: 'Replace saved progress?', body: 'Start a new puzzle and replace your saved progress?',
      confirmLabel: 'Start new', cancelLabel: 'Keep playing',
      onConfirm: () => { confirmed += 1; }, onCancel: () => { cancelled += 1; },
    });
    confirmDialog.open();
    const mounted = fixture.root.querySelector('dialog.game-dialog');
    assert.ok(mounted, 'open() mounts the dialog into root');
    assert.equal(mounted.querySelector('h2').textContent, 'Replace saved progress?');
    assert.equal(mounted.querySelector('[data-dialog-confirm]').textContent, 'Start new');
    assert.equal(mounted.querySelector('[data-dialog-cancel]').textContent, 'Keep playing');

    mounted.querySelector('[data-dialog-confirm]').click();
    assert.equal(confirmed, 1);
    assert.equal(cancelled, 0);
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'confirming closes and removes the dialog');

    const second = createConfirmDialog(fixture.root, {
      title: 'Second', body: 'Body copy',
      onConfirm: () => { confirmed += 1; }, onCancel: () => { cancelled += 1; },
    });
    second.open();
    fixture.root.querySelector('[data-dialog-cancel]').click();
    assert.equal(confirmed, 1);
    assert.equal(cancelled, 1);
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'cancelling closes and removes the dialog');

    const third = createConfirmDialog(fixture.root, { title: 'Third', body: 'Body copy' });
    third.open();
    assert.ok(fixture.root.querySelector('dialog.game-dialog'));
    third.close();
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'close() removes the dialog directly');
  } finally { restore(); }
});

test('session.finish() reports recordsBroken for a first unassisted completion', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const { createSession } = await import('../../Resources/games/controller-common.js');
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, seed: 1 });
    const session = createSession({
      root: fixture.root, game: 'sudoku', store,
      createPuzzle: () => sudokuPuzzle, createPlay: () => ({}),
      progressed: () => false, validateRun: () => true,
      onRender: async () => {},
    });
    const result = session.finish();
    assert.deepEqual(result.recordsBroken, ['time'], 'a first-ever completion breaks the time record');
  } finally { restore(); }
});

const flushMicrotasks = async (count = 20) => {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
};

test('a different-difficulty conflict shows the kept screen plus a dialog, and confirming starts fresh', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=medium' }); const restore = installDOM(fixture);
  try {
    const { renderSudoku, createSudokuState } = await import('../../Resources/games/sudoku-ui.js');
    const play = createSudokuState(sudokuPuzzle);
    play.values[sudokuEditable] = 2;
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, play, seed: 1, startedAt: 10 });
    fixture.localStorage.setItem(STORE_KEYS.v2, JSON.stringify(store));
    await renderSudoku(fixture.root, store);
    assert.match(fixture.root.textContent, /Easy puzzle.*kept/is, 'the non-destructive kept screen renders first');
    await flushMicrotasks();
    const dialog = fixture.root.querySelector('dialog.game-dialog');
    assert.ok(dialog, 'a replace dialog is offered on top of the kept screen');
    assert.match(dialog.textContent, /Easy puzzle in progress.*Start Medium/s, 'the body names both difficulties');
    assert.equal(dialog.querySelector('[data-dialog-cancel]').textContent, 'Keep saved puzzle');
    dialog.querySelector('[data-dialog-confirm]').click();
    await flushMicrotasks();
    const next = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(next.runs.sudoku.difficulty, 'medium', 'confirming abandons the saved run and starts the requested difficulty');
    assert.ok(fixture.root.querySelector('[role="grid"]'), 'the fresh run renders a playable grid');
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'confirming closes the dialog');
  } finally { restore(); }
});

test('cancelling the different-difficulty dialog keeps the saved run and the kept screen', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=medium' }); const restore = installDOM(fixture);
  try {
    const { renderSudoku, createSudokuState } = await import('../../Resources/games/sudoku-ui.js');
    const play = createSudokuState(sudokuPuzzle);
    play.values[sudokuEditable] = 2;
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, play, seed: 1, startedAt: 10 });
    fixture.localStorage.setItem(STORE_KEYS.v2, JSON.stringify(store));
    await renderSudoku(fixture.root, store);
    await flushMicrotasks();
    fixture.root.querySelector('[data-dialog-cancel]').click();
    await flushMicrotasks();
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'cancelling closes the dialog');
    assert.match(fixture.root.textContent, /Easy puzzle.*kept/is, 'the kept screen remains');
    const kept = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2)).runs.sudoku;
    assert.equal(kept.difficulty, 'easy');
    assert.equal(kept.seed, 1, 'the saved run is untouched');
  } finally { restore(); }
});

test('session.finish() reports no broken records for an assisted run', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const { createSession } = await import('../../Resources/games/controller-common.js');
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, seed: 1, assisted: true });
    const session = createSession({
      root: fixture.root, game: 'sudoku', store,
      createPuzzle: () => sudokuPuzzle, createPlay: () => ({}),
      progressed: () => false, validateRun: () => true,
      onRender: async () => {},
    });
    const result = session.finish();
    assert.deepEqual(result.recordsBroken, [], 'assisted runs are ineligible for records');
  } finally { restore(); }
});

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

test('Word Search cell nodes stay identical across pointermove preview updates (patch-in-place, not rebuilt)', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const { renderWordSearch } = await import('../../Resources/games/word-search-ui.js');
    const placement = wordSearchPuzzle.placements[0];
    const store = v2StoreWithRun({ game: 'word-search', definition: wordSearchPuzzle });
    await renderWordSearch(fixture.root, store);
    const start = fixture.root.querySelector(`[data-cell="${placement.start.row}:${placement.start.column}"]`);
    const endBefore = fixture.root.querySelector(`[data-cell="${placement.end.row}:${placement.end.column}"]`);
    const startBefore = start;
    const cellCountBefore = fixture.root.querySelectorAll('[data-cell]').length;
    start.dispatchEvent(new FixtureEvent('pointerdown', { pointerId: 41 }));
    fixture.document.setHitTarget(endBefore);
    fixture.document.dispatchEvent(new FixtureEvent('pointermove', { pointerId: 41 }));
    fixture.document.dispatchEvent(new FixtureEvent('pointermove', { pointerId: 41 }));
    const startAfter = fixture.root.querySelector(`[data-cell="${placement.start.row}:${placement.start.column}"]`);
    const endAfter = fixture.root.querySelector(`[data-cell="${placement.end.row}:${placement.end.column}"]`);
    // Compared as a boolean, not the raw nodes: a direct assert.equal(nodeA,
    // nodeB) that actually fails would make node's assert try to serialize
    // these deeply cross-linked fixture objects into an error message, which
    // is prohibitively slow. The boolean keeps a failure's diagnostic cheap.
    assert.equal(startAfter === startBefore, true, 'the previewed start cell is the same DOM node before and after pointermove redraws');
    assert.equal(endAfter === endBefore, true, 'the previewed end cell is the same DOM node before and after pointermove redraws');
    assert.equal(fixture.root.querySelectorAll('[data-cell]').length, cellCountBefore, 'no cells were rebuilt or duplicated');
    assert.match(endAfter.className, /is-preview/, 'the preview still patched onto the existing node');
  } finally { restore(); }
});

test('Word Search marks an invalid endpoint selection rejected, announces it, and clears the cue on animationend', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const { renderWordSearch } = await import('../../Resources/games/word-search-ui.js');
    const store = v2StoreWithRun({ game: 'word-search', definition: wordSearchPuzzle });
    await renderWordSearch(fixture.root, store);
    // A straight two-cell line can never equal a real word (words are 3+
    // letters), so this selection is guaranteed invalid regardless of the
    // puzzle's actual letter placement.
    const start = fixture.root.querySelector('[data-cell="0:0"]');
    const invalidEnd = fixture.root.querySelector('[data-cell="0:1"]');
    start.dispatchEvent(new FixtureEvent('pointerdown', { pointerId: 42 }));
    fixture.document.setHitTarget(invalidEnd);
    fixture.document.dispatchEvent(new FixtureEvent('pointerup', { pointerId: 42 }));
    assert.match(start.className, /is-rejected/, 'the first previewed cell is marked rejected');
    assert.match(invalidEnd.className, /is-rejected/, 'the second previewed cell is marked rejected');
    assert.match(fixture.root.querySelector('.games-live-region').textContent, /not a word here/i);
    start.dispatchEvent(new FixtureEvent('animationend'));
    assert.doesNotMatch(
      fixture.root.querySelector('[data-cell="0:0"]').className, /is-rejected/,
      'a delegated animationend listener clears the cue from the cell it fired on',
    );
    assert.match(
      fixture.root.querySelector('[data-cell="0:1"]').className, /is-rejected/,
      'the other cell keeps its cue until its own animationend fires',
    );
  } finally { restore(); }
});

test('Word Search re-tracing an already-found word announces "Already found." without the reject cue', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const module = await import('../../Resources/games/word-search-ui.js');
    const target = wordSearchPuzzle.placements[0];
    const play = { ...module.createWordSearchState(wordSearchPuzzle), found: [target.word] };
    const store = v2StoreWithRun({ game: 'word-search', definition: wordSearchPuzzle, play });
    await module.renderWordSearch(fixture.root, store);
    const start = fixture.root.querySelector(`[data-cell="${target.start.row}:${target.start.column}"]`);
    const end = fixture.root.querySelector(`[data-cell="${target.end.row}:${target.end.column}"]`);
    // Exact re-trace of the found placement, dragged in the reverse direction
    // to prove the check is direction-agnostic.
    end.dispatchEvent(new FixtureEvent('pointerdown', { pointerId: 43 }));
    fixture.document.setHitTarget(start);
    fixture.document.dispatchEvent(new FixtureEvent('pointerup', { pointerId: 43 }));
    assert.doesNotMatch(start.className, /is-rejected/, 'a re-traced found word is not marked rejected');
    assert.doesNotMatch(end.className, /is-rejected/, 'a re-traced found word is not marked rejected');
    assert.equal(fixture.root.querySelectorAll('.is-rejected').length, 0, 'no cell anywhere carries the reject cue');
    const announced = fixture.root.querySelector('.games-live-region').textContent;
    assert.doesNotMatch(announced, /not a word here/i, 'the factually wrong rejection message is not announced');
    assert.equal(announced, 'Already found.');
  } finally { restore(); }
});

test('Word Search pops a found cell and strikes its list item in place', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const module = await import('../../Resources/games/word-search-ui.js');
    const target = wordSearchPuzzle.placements[0];
    const play = { ...module.createWordSearchState(wordSearchPuzzle), focus: target.start };
    const store = v2StoreWithRun({ game: 'word-search', definition: wordSearchPuzzle, play });
    await module.renderWordSearch(fixture.root, store);
    const listItemBefore = [...fixture.root.querySelectorAll('.word-search-list li')]
      .find((item) => item.textContent === target.word);
    assert.equal(listItemBefore.className, '');
    fixture.root.querySelector(`[data-cell="${target.start.row}:${target.start.column}"]`).dispatchEvent(new FixtureEvent('keydown', { key: 'Enter' }));
    const end = fixture.root.querySelector(`[data-cell="${target.end.row}:${target.end.column}"]`); end.focus(); end.dispatchEvent(new FixtureEvent('keydown', { key: 'Enter' }));
    const startCell = fixture.root.querySelector(`[data-cell="${target.start.row}:${target.start.column}"]`);
    assert.match(startCell.className, /is-found/, 'the found cell carries the pop-triggering is-found class');
    const listItemAfter = [...fixture.root.querySelectorAll('.word-search-list li')]
      .find((item) => item.textContent === target.word);
    assert.equal(listItemAfter === listItemBefore, true, 'the same list-item node is patched in place, not rebuilt');
    assert.equal(listItemAfter.className, 'is-found-item', 'the word-list item gains the strike-in class');
  } finally { restore(); }
});

test('Word Search Restart and New Game route through the shared confirm dialog, not window.confirm', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const { renderWordSearch } = await import('../../Resources/games/word-search-ui.js');
    const store = v2StoreWithRun({ game: 'word-search', definition: wordSearchPuzzle });
    await renderWordSearch(fixture.root, store);
    fixture.root.querySelector('[data-restart]').click();
    const restartDialog = fixture.root.querySelector('dialog.game-dialog');
    assert.ok(restartDialog, 'restart opens a confirm dialog instead of relying on window.confirm');
    assert.equal(restartDialog.querySelector('[data-dialog-confirm]').textContent, 'Restart');
    restartDialog.querySelector('[data-dialog-cancel]').click();
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'cancelling closes the dialog without restarting');

    // No progress yet: New Game keeps its no-progress fast path and skips the dialog.
    fixture.root.querySelector('[data-new-game]').click();
    await Promise.resolve();
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'an unstarted puzzle skips the confirmation');
  } finally { restore(); }
});

test('Word Search New Game confirms via dialog once a word has been found', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const module = await import('../../Resources/games/word-search-ui.js');
    const target = wordSearchPuzzle.placements[0];
    const play = { ...module.createWordSearchState(wordSearchPuzzle), found: [target.word] };
    const store = v2StoreWithRun({ game: 'word-search', definition: wordSearchPuzzle, play });
    await module.renderWordSearch(fixture.root, store);
    fixture.root.querySelector('[data-new-game]').click();
    const dialog = fixture.root.querySelector('dialog.game-dialog');
    assert.ok(dialog, 'progress found so far means New Game opens a confirm dialog');
    assert.equal(dialog.querySelector('[data-dialog-confirm]').textContent, 'New Game');
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

test('completionPanel renders a game-complete-record line naming the broken record', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { completionPanel } = await import('../../Resources/games/controller-common.js');
    const { panel } = completionPanel({
      elapsed: 65000, assisted: false, recordsBroken: ['time'], playAnother: () => {},
    });
    const record = panel.querySelector('.game-complete-record');
    assert.ok(record, 'a record line renders when recordsBroken is non-empty');
    assert.equal(record.textContent, 'New best time!');
  } finally { restore(); }
});

test('completionPanel joins multiple broken records with a middle dot', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { completionPanel } = await import('../../Resources/games/controller-common.js');
    const { panel } = completionPanel({
      elapsed: 65000, assisted: false, recordsBroken: ['time', 'moves'], playAnother: () => {},
    });
    assert.equal(panel.querySelector('.game-complete-record').textContent, 'New best time! · Fewest moves!');
  } finally { restore(); }
});

test('completionPanel renders no record line when recordsBroken is empty or omitted', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { completionPanel } = await import('../../Resources/games/controller-common.js');
    assert.equal(completionPanel({ elapsed: 1000, assisted: false, recordsBroken: [], playAnother: () => {} })
      .panel.querySelector('.game-complete-record'), null);
    assert.equal(completionPanel({ elapsed: 1000, assisted: false, playAnother: () => {} })
      .panel.querySelector('.game-complete-record'), null, 'recordsBroken defaults to empty');
  } finally { restore(); }
});

test('completionPanel places the record line between the heading and the elapsed line', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { completionPanel } = await import('../../Resources/games/controller-common.js');
    const { panel } = completionPanel({
      elapsed: 5000, assisted: false, recordsBroken: ['score'], playAnother: () => {},
    });
    assert.equal(panel.children[0].tagName, 'H2');
    assert.equal(panel.children[1].className, 'game-complete-record');
    assert.equal(panel.children[1].textContent, 'New best score!');
    assert.equal(panel.children[2].tagName, 'P');
  } finally { restore(); }
});

test('completion flow renders the record line end-to-end when a run breaks the time record', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const { renderSudoku, createSudokuState } = await import('../../Resources/games/sudoku-ui.js');
    const play = createSudokuState(sudokuPuzzle);
    play.values = [...sudokuPuzzle.solution];
    play.values[sudokuEditable] = 0;
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, play, seed: 1 });
    await renderSudoku(fixture.root, store);
    const cell = fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`);
    cell.click();
    cell.dispatchEvent(new FixtureEvent('keydown', { key: String(sudokuPuzzle.solution[sudokuEditable]) }));
    const record = fixture.root.querySelector('.game-complete-record');
    assert.ok(record, 'a first-ever completion breaks the time record and renders the line');
    assert.equal(record.textContent, 'New best time!');
  } finally { restore(); }
});

test('Sudoku patches cell nodes in place instead of replacing them on dispatch', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderSudoku } = await import('../../Resources/games/sudoku-ui.js');
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, seed: 1 });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderSudoku(fixture.root, store);
    const before = fixture.root.querySelector('[data-cell="0"]');
    const editable = fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`);
    editable.dispatchEvent(new FixtureEvent('keydown', { key: 'ArrowRight' }));
    // Use a plain boolean check (not assert.equal) so a mismatch reports a
    // short failure instead of node:assert trying to diff two large,
    // circularly-linked DOM-fixture trees.
    assert.ok(fixture.root.querySelector('[data-cell="0"]') === before,
      'the cell node identity is preserved across a select dispatch');
    assert.ok(fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`) === editable,
      'the previously-selected cell node also keeps its identity');
  } finally { restore(); }
});

test('same-digit highlight marks every cell sharing the selected value', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderSudoku, createSudokuState } = await import('../../Resources/games/sudoku-ui.js');
    const play = createSudokuState(sudokuPuzzle);
    const editableIndices = sudokuPuzzle.puzzle
      .reduce((acc, value, index) => (value === 0 ? [...acc, index] : acc), []);
    const [a, b] = editableIndices;
    play.values[a] = 7; play.values[b] = 7;
    play.selected = a;
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, play, seed: 1 });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderSudoku(fixture.root, store);
    assert.ok(fixture.root.querySelector(`[data-cell="${b}"]`).classList.contains('is-same-digit'),
      'a different cell holding the same digit is marked');
    assert.ok(fixture.root.querySelector(`[data-cell="${a}"]`).classList.contains('is-same-digit'),
      'the selected cell itself also carries the shared-value marker');
  } finally { restore(); }
});

test('pencil notes render as a 9-slot notes grid', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderSudoku } = await import('../../Resources/games/sudoku-ui.js');
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, seed: 1 });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderSudoku(fixture.root, store);
    const cell = fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`);
    cell.click();
    fixture.root.querySelector('[data-pencil]').click();
    cell.dispatchEvent(new FixtureEvent('keydown', { key: '3' }));
    const grid = cell.querySelector('.sudoku-notes-grid');
    assert.ok(grid, 'a notes grid renders once a pencil mark is set');
    const notes = cell.querySelectorAll('.sudoku-note');
    assert.equal(notes.length, 9, 'the notes grid always has 9 fixed slots');
    assert.equal(notes.filter((note) => note.textContent === '3').length, 1);
    assert.equal(notes.filter((note) => note.textContent === '').length, 8);
  } finally { restore(); }
});

test('completion adds is-celebrating to every cell alongside the record line', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const { renderSudoku, createSudokuState } = await import('../../Resources/games/sudoku-ui.js');
    const play = createSudokuState(sudokuPuzzle);
    play.values = [...sudokuPuzzle.solution];
    play.values[sudokuEditable] = 0;
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, play, seed: 1 });
    await renderSudoku(fixture.root, store);
    const cell = fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`);
    cell.click();
    cell.dispatchEvent(new FixtureEvent('keydown', { key: String(sudokuPuzzle.solution[sudokuEditable]) }));
    assert.ok(fixture.root.querySelector('.game-complete-record'), 'the completion breaks the time record');
    const celebrating = fixture.root.querySelectorAll('.sudoku-cell.is-celebrating');
    assert.equal(celebrating.length, 81, 'every cell is marked celebrating on completion');
  } finally { restore(); }
});

test('Restart shows a confirm dialog instead of window.confirm, and confirming clears progress', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderSudoku } = await import('../../Resources/games/sudoku-ui.js');
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, seed: 1 });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderSudoku(fixture.root, store);
    const cell = fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`);
    cell.click(); cell.dispatchEvent(new FixtureEvent('keydown', { key: '4' }));
    fixture.root.querySelector('[data-restart]').click();
    const dialog = fixture.root.querySelector('dialog.game-dialog');
    assert.ok(dialog, 'restart opens a confirm dialog rather than window.confirm');
    dialog.querySelector('[data-dialog-confirm]').click();
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'confirming closes the dialog');
    assert.equal(fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`).textContent, '',
      'confirming restart clears progress');
  } finally { restore(); }
});

test('cancelling the Restart dialog keeps progress intact', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderSudoku } = await import('../../Resources/games/sudoku-ui.js');
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, seed: 1 });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderSudoku(fixture.root, store);
    const cell = fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`);
    cell.click(); cell.dispatchEvent(new FixtureEvent('keydown', { key: '4' }));
    fixture.root.querySelector('[data-restart]').click();
    fixture.root.querySelector('[data-dialog-cancel]').click();
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'cancelling closes the dialog');
    assert.equal(fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`).textContent, '4',
      'declining restart keeps the current progress');
  } finally { restore(); }
});

test('New Game skips the confirm dialog when nothing has been entered yet this session', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderSudoku } = await import('../../Resources/games/sudoku-ui.js');
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, seed: 1 });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderSudoku(fixture.root, store);
    fixture.root.querySelector('[data-new-game]').click();
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'no progress means no confirm prompt');
    const next = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.notEqual(next.runs.sudoku.seed, 1, 'a fresh puzzle starts immediately');
  } finally { restore(); }
});

test('New Game shows a confirm dialog once the player has made an edit this session', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderSudoku } = await import('../../Resources/games/sudoku-ui.js');
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, seed: 1 });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderSudoku(fixture.root, store);
    const cell = fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`);
    cell.click(); cell.dispatchEvent(new FixtureEvent('keydown', { key: '4' }));
    fixture.root.querySelector('[data-new-game]').click();
    const dialog = fixture.root.querySelector('dialog.game-dialog');
    assert.ok(dialog, 'an edit this session requires confirmation before replacing the puzzle');
    dialog.querySelector('[data-dialog-cancel]').click();
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null);
    assert.equal(fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`).textContent, '4',
      'cancelling keeps the current puzzle');
  } finally { restore(); }
});

test('Sudoku mounts effects-only audio controls in the toolbar area', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderSudoku } = await import('../../Resources/games/sudoku-ui.js');
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, seed: 1 });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderSudoku(fixture.root, store);
    assert.equal(fixture.root.querySelectorAll('[data-audio-music-volume]').length, 0,
      'sudoku audio controls are effects-only');
    assert.equal(fixture.root.querySelectorAll('[data-audio-effects-volume]').length, 1);
    assert.equal(fixture.root.querySelectorAll('[data-audio-effects-toggle]').length, 1);
  } finally { restore(); }
});

test('changing an audio preference through the rendered controls persists to the store', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderSudoku } = await import('../../Resources/games/sudoku-ui.js');
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, seed: 1 });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderSudoku(fixture.root, store);
    fixture.root.querySelector('[data-audio-effects-toggle]').click();
    const savedAfterMute = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(savedAfterMute.audio.effectsEnabled, false,
      'muting effects persists through the session store round-trip');

    const volume = fixture.root.querySelector('[data-audio-effects-volume]');
    volume.value = '0.2';
    volume.dispatchEvent(new FixtureEvent('input'));
    const savedAfterVolume = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(savedAfterVolume.audio.effectsVolume, 0.2,
      'the effects volume also persists');
    assert.equal(savedAfterVolume.audio.effectsEnabled, false,
      'the earlier mute is not reverted by the later volume change');

    // A re-render from the persisted store reflects the saved preference.
    await renderSudoku(fixture.root, savedAfterVolume);
    assert.equal(
      fixture.root.querySelector('[data-audio-effects-toggle]').textContent,
      'Unmute effects',
      'a fresh render from the persisted store shows the muted state');
  } finally { restore(); }
});

test('completion flow renders no record line end-to-end for an assisted completion', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const { renderSudoku, createSudokuState } = await import('../../Resources/games/sudoku-ui.js');
    const play = createSudokuState(sudokuPuzzle);
    play.values = [...sudokuPuzzle.solution];
    play.values[sudokuEditable] = 0;
    play.assisted = true;
    const store = v2StoreWithRun({ game: 'sudoku', definition: sudokuPuzzle, play, seed: 1, assisted: true });
    await renderSudoku(fixture.root, store);
    const cell = fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`);
    cell.click();
    cell.dispatchEvent(new FixtureEvent('keydown', { key: String(sudokuPuzzle.solution[sudokuEditable]) }));
    assert.equal(fixture.root.querySelector('.game-complete-record'), null,
      'an assisted run is ineligible for records so no line renders');
  } finally { restore(); }
});

test('Crossword patches cell nodes and clue buttons in place instead of replacing them on dispatch', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderCrossword } = await import('../../Resources/games/crossword-ui.js');
    const store = v2StoreWithRun({ game: 'crossword', definition: crosswordPuzzle });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderCrossword(fixture.root, store);
    const cellBefore = fixture.root.querySelector('[data-cell="0:0"]');
    const clueBefore = fixture.root.querySelector('[data-clue="1:across"]');
    cellBefore.dispatchEvent(new FixtureEvent('keydown', { key: 'ArrowDown' }));
    assert.ok(fixture.root.querySelector('[data-cell="0:0"]') === cellBefore,
      'the cell node identity is preserved across a select dispatch');
    assert.ok(fixture.root.querySelector('[data-clue="1:across"]') === clueBefore,
      'clue button node identity is preserved across a select dispatch');
  } finally { restore(); }
});

test('Crossword marks every cell of the active entry and the matching clue button', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderCrossword } = await import('../../Resources/games/crossword-ui.js');
    const store = v2StoreWithRun({ game: 'crossword', definition: crosswordPuzzle });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderCrossword(fixture.root, store);
    // The initial selection is CAT across (0,0)-(0,2); CAR down shares (0,0) only.
    for (const key of ['0:0', '0:1', '0:2']) {
      assert.ok(fixture.root.querySelector(`[data-cell="${key}"]`).classList.contains('is-active-entry'),
        `${key} is part of the active across entry`);
      assert.match(fixture.root.querySelector(`[data-cell="${key}"]`).getAttribute('aria-label'), /active entry/i,
        `${key} announces its active-entry membership`);
    }
    assert.equal(fixture.root.querySelector('[data-cell="1:0"]').classList.contains('is-active-entry'), false,
      '1:0 belongs only to the inactive down entry');
    assert.doesNotMatch(fixture.root.querySelector('[data-cell="1:0"]').getAttribute('aria-label'), /active entry/i,
      'a cell outside the active entry does not announce membership');
    assert.ok(fixture.root.querySelector('[data-clue="1:across"]').classList.contains('is-active'));
    assert.equal(fixture.root.querySelector('[data-clue="1:down"]').classList.contains('is-active'), false);

    // Selecting a down-only cell switches the active entry and clue.
    fixture.root.querySelector('[data-cell="1:0"]').click();
    for (const key of ['0:0', '1:0', '2:0']) {
      assert.ok(fixture.root.querySelector(`[data-cell="${key}"]`).classList.contains('is-active-entry'),
        `${key} is part of the newly active down entry`);
    }
    assert.equal(fixture.root.querySelector('[data-cell="0:1"]').classList.contains('is-active-entry'), false);
    assert.ok(fixture.root.querySelector('[data-clue="1:down"]').classList.contains('is-active'));
    assert.equal(fixture.root.querySelector('[data-clue="1:across"]').classList.contains('is-active'), false);
  } finally { restore(); }
});

test('Crossword clue lists render as plain lists so clue numbers do not double up', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderCrossword } = await import('../../Resources/games/crossword-ui.js');
    const store = v2StoreWithRun({ game: 'crossword', definition: crosswordPuzzle });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderCrossword(fixture.root, store);
    assert.equal(fixture.root.querySelectorAll('.crossword-clues ol').length, 0,
      'ordered lists would print a second, browser-rendered ordinal alongside the printed clue number');
    assert.equal(fixture.root.querySelectorAll('.crossword-clues ul').length, 2);
    const clueText = fixture.root.querySelector('[data-clue="1:across"]').textContent;
    assert.doesNotMatch(clueText, /^\d+\.\s*\d+\./, 'the clue text itself carries only one number');
    assert.match(clueText, /^1\.\s/);
  } finally { restore(); }
});

test('Crossword completion adds is-celebrating in reading order to every occupied cell', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const { renderCrossword, createCrosswordState } = await import('../../Resources/games/crossword-ui.js');
    const play = createCrosswordState(crosswordPuzzle);
    play.values = crosswordPuzzle.cells.map((row) => row.map((cell) => cell?.solution ?? null));
    play.values[0][0] = ''; // leave one cell blank to complete via keyboard
    const store = v2StoreWithRun({ game: 'crossword', definition: crosswordPuzzle, play });
    await renderCrossword(fixture.root, store);
    const cell = fixture.root.querySelector('[data-cell="0:0"]');
    cell.click();
    cell.dispatchEvent(new FixtureEvent('keydown', { key: 'C' }));
    assert.ok(fixture.root.querySelector('.game-complete'), 'the completion panel renders');
    const occupied = ['0:0', '0:1', '0:2', '1:0', '2:0'];
    for (const key of occupied) {
      assert.ok(fixture.root.querySelector(`[data-cell="${key}"]`).classList.contains('is-celebrating'),
        `${key} is marked celebrating on completion`);
    }
    assert.equal(fixture.root.querySelector('[data-cell="0:0"]').style.getPropertyValue('--cell-delay'), '0ms',
      'the first cell in reading order has no delay');
  } finally { restore(); }
});

test('Crossword Restart shows a confirm dialog instead of window.confirm, and confirming clears progress', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderCrossword } = await import('../../Resources/games/crossword-ui.js');
    const store = v2StoreWithRun({ game: 'crossword', definition: crosswordPuzzle });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderCrossword(fixture.root, store);
    const cell = fixture.root.querySelector('[data-cell="0:0"]');
    cell.click(); cell.dispatchEvent(new FixtureEvent('keydown', { key: 'C' }));
    fixture.root.querySelector('[data-restart]').click();
    const dialog = fixture.root.querySelector('dialog.game-dialog');
    assert.ok(dialog, 'restart opens a confirm dialog rather than window.confirm');
    dialog.querySelector('[data-dialog-confirm]').click();
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'confirming closes the dialog');
    assert.equal(fixture.root.querySelector('[data-cell="0:0"]').value, '', 'confirming restart clears progress');
  } finally { restore(); }
});

test('Crossword cancelling the Restart dialog keeps progress intact', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderCrossword } = await import('../../Resources/games/crossword-ui.js');
    const store = v2StoreWithRun({ game: 'crossword', definition: crosswordPuzzle });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderCrossword(fixture.root, store);
    const cell = fixture.root.querySelector('[data-cell="0:0"]');
    cell.click(); cell.dispatchEvent(new FixtureEvent('keydown', { key: 'C' }));
    fixture.root.querySelector('[data-restart]').click();
    fixture.root.querySelector('[data-dialog-cancel]').click();
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'cancelling closes the dialog');
    assert.equal(fixture.root.querySelector('[data-cell="0:0"]').value, 'C', 'declining restart keeps progress');
  } finally { restore(); }
});

test('Crossword New Game skips the confirm dialog when nothing has been entered yet, and prompts once it has', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderCrossword } = await import('../../Resources/games/crossword-ui.js');
    const store = v2StoreWithRun({ game: 'crossword', definition: crosswordPuzzle });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderCrossword(fixture.root, store);
    fixture.root.querySelector('[data-new-game]').click();
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'no progress means no confirm prompt');
    const afterFresh = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.notEqual(afterFresh.runs.crossword.seed, crosswordPuzzle.seed, 'a fresh puzzle starts immediately');
  } finally { restore(); }
});

test('Crossword New Game shows a confirm dialog once a letter has been entered', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderCrossword } = await import('../../Resources/games/crossword-ui.js');
    const store = v2StoreWithRun({ game: 'crossword', definition: crosswordPuzzle });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderCrossword(fixture.root, store);
    const cell = fixture.root.querySelector('[data-cell="0:0"]');
    cell.click(); cell.dispatchEvent(new FixtureEvent('keydown', { key: 'C' }));
    fixture.root.querySelector('[data-new-game]').click();
    const dialog = fixture.root.querySelector('dialog.game-dialog');
    assert.ok(dialog, 'an edit requires confirmation before replacing the puzzle');
    dialog.querySelector('[data-dialog-cancel]').click();
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null);
    assert.equal(fixture.root.querySelector('[data-cell="0:0"]').value, 'C', 'cancelling keeps the current puzzle');
  } finally { restore(); }
});

test('Crossword mounts effects-only audio controls in the toolbar area', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderCrossword } = await import('../../Resources/games/crossword-ui.js');
    const store = v2StoreWithRun({ game: 'crossword', definition: crosswordPuzzle });
    fixture.location.search = '?difficulty=easy&continue=1';
    await renderCrossword(fixture.root, store);
    assert.equal(fixture.root.querySelectorAll('[data-audio-music-volume]').length, 0,
      'crossword audio controls are effects-only');
    assert.equal(fixture.root.querySelectorAll('[data-audio-effects-volume]').length, 1);
    assert.equal(fixture.root.querySelectorAll('[data-audio-effects-toggle]').length, 1);
  } finally { restore(); }
});

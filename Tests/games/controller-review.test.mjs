import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDOMFixture, FixtureEvent, installDOM } from './dom-fixture.mjs';
import { generateSudoku } from '../../Resources/games/sudoku.js';
import { generateWordSearch } from '../../Resources/games/word-search.js';
import { createEmptyGameStore, STORE_KEYS } from '../../Resources/games/core.js';

const v2StoreWithRun = ({
  game, definition, play, difficulty = definition.difficulty ?? 'easy',
  seed = definition.seed ?? 1, startedAt = 0, elapsedBeforeStartMs = 0, assisted = false,
}) => {
  const store = createEmptyGameStore();
  store.runs[game] = {
    game, mode: 'default', difficulty, seed: seed >>> 0,
    signature: 'fixture:' + game + ':' + JSON.stringify(definition),
    puzzle: { definition, ...(play === undefined ? {} : { play }) },
    startedAt, elapsedBeforeStartMs, assisted,
  };
  return store;
};
const storeWith = (game, definition, play = undefined, difficulty = 'easy') => (
  v2StoreWithRun({ game, definition, play, difficulty })
);

const sudoku = generateSudoku({ difficulty: 'easy', seed: 20260712 });
const sudokuGiven = sudoku.puzzle.findIndex(Boolean);
const sudokuEditable = sudoku.puzzle.findIndex((value) => value === 0);
const crossword = {
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
const wordSearch = generateWordSearch({ difficulty: 'easy', seed: 77 });

async function mounted(modulePath, renderName, game, definition, play) {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  const module = await import(modulePath);
  await module[renderName](fixture.root, storeWith(game, definition, play));
  return { fixture, restore, module };
}

test('all game grids retain native control semantics inside row and gridcell roles', async () => {
  for (const [path, render, game, definition, controlTag] of [
    ['../../Resources/games/sudoku-ui.js', 'renderSudoku', 'sudoku', sudoku, 'BUTTON'],
    ['../../Resources/games/crossword-ui.js', 'renderCrossword', 'crossword', crossword, 'INPUT'],
    ['../../Resources/games/word-search-ui.js', 'renderWordSearch', 'word-search', wordSearch, 'BUTTON'],
  ]) {
    const { fixture, restore } = await mounted(path, render, game, definition);
    try {
      const grid = fixture.root.querySelector('[role="grid"]');
      const cells = grid.querySelectorAll('[role="gridcell"]');
      assert.ok(cells.length > 0);
      for (const cell of cells) {
        assert.equal(cell.parentNode.getAttribute('role'), 'row');
        assert.equal(cell.children[0].tagName, controlTag);
        assert.equal(cell.children[0].getAttribute('role'), null, 'native control role must not be overwritten');
      }
    } finally { restore(); }
  }
});

test('Sudoku hint moves from a given or solved cell to an editable unsolved cell', async () => {
  const { createSudokuState, reduceSudoku } = await import('../../Resources/games/sudoku-ui.js');
  let state = createSudokuState(sudoku);
  state = { ...state, selected: sudokuGiven };
  state = reduceSudoku(state, { type: 'reveal' });
  const firstTarget = state.selected;
  assert.equal(sudoku.puzzle[firstTarget], 0);
  assert.equal(state.values[firstTarget], sudoku.solution[firstTarget]);
  state = reduceSudoku(state, { type: 'reveal' });
  assert.notEqual(state.selected, firstTarget);
  assert.equal(state.values[state.selected], sudoku.solution[state.selected]);
});

test('Sudoku accessible name includes pencil notes', async () => {
  const play = (await import('../../Resources/games/sudoku-ui.js')).createSudokuState(sudoku);
  play.selected = sudokuEditable; play.notes[sudokuEditable] = [2, 7];
  const { fixture, restore } = await mounted('../../Resources/games/sudoku-ui.js', 'renderSudoku', 'sudoku', sudoku, play);
  try { assert.match(fixture.root.querySelector(`[data-cell="${sudokuEditable}"]`).getAttribute('aria-label'), /pencil notes 2, 7/i); }
  finally { restore(); }
});

test('Crossword Tab escapes natively and Space changes direction without trapping focus', async () => {
  const { fixture, restore } = await mounted('../../Resources/games/crossword-ui.js', 'renderCrossword', 'crossword', crossword);
  try {
    const cell = fixture.root.querySelector('[data-cell="0:0"]');
    const tab = new FixtureEvent('keydown', { key: 'Tab' }); cell.dispatchEvent(tab);
    assert.equal(tab.defaultPrevented, false);
    const space = new FixtureEvent('keydown', { key: ' ' }); cell.dispatchEvent(space);
    assert.equal(space.defaultPrevented, true);
    assert.match(fixture.root.querySelector('.games-live-region').textContent, /down/i);
    assert.ok(fixture.root.querySelector('[data-hint]'), 'controls remain reachable after the grid');
  } finally { restore(); }
});

test('Crossword arrow navigation sets direction and skips blocks', async () => {
  const { createCrosswordState, reduceCrossword } = await import('../../Resources/games/crossword-ui.js');
  const definition = {
    ...crossword, size: 4,
    cells: [
      [crossword.cells[0][0], null, { solution: 'T', number: 2, across: 2, down: null }, null],
      [null, null, null, null],
      [null, null, { solution: 'R', number: 3, across: null, down: 3 }, null],
      [null, null, null, null],
    ],
    answers: [
      { number: 1, direction: 'across', answer: 'C', clue: 'C', row: 0, column: 0 },
      { number: 2, direction: 'across', answer: 'T', clue: 'T', row: 0, column: 2 },
      { number: 3, direction: 'down', answer: 'R', clue: 'R', row: 2, column: 2 },
    ],
  };
  let state = createCrosswordState(definition);
  state = reduceCrossword(state, { type: 'navigate', dr: 0, dc: 1 });
  assert.deepEqual(state.selected, { row: 0, column: 2 });
  assert.equal(state.direction, 'across');
  state = reduceCrossword(state, { type: 'navigate', dr: 1, dc: 0 });
  assert.deepEqual(state.selected, { row: 2, column: 2 });
  assert.equal(state.direction, 'down');
});

test('declining a different-difficulty replacement keeps the saved run without rendering it as requested', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=medium', confirm: false }); const restore = installDOM(fixture);
  try {
    const module = await import('../../Resources/games/sudoku-ui.js');
    const play = module.createSudokuState(sudoku); play.values[sudokuEditable] = 2;
    const store = storeWith('sudoku', sudoku, play, 'easy');
    fixture.localStorage.setItem(STORE_KEYS.v2, JSON.stringify(store));
    await module.renderSudoku(fixture.root, store);
    assert.equal(fixture.root.querySelector('[role="grid"]'), null);
    assert.match(fixture.root.textContent, /Easy puzzle.*kept/i);
    assert.equal(JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2)).runs.sudoku.difficulty, 'easy');
  } finally { restore(); }
});

test('controller lifecycle removes intervals and document listeners on completion and rerender', async () => {
  const play = (await import('../../Resources/games/word-search-ui.js')).createWordSearchState(wordSearch);
  const target = wordSearch.placements[0];
  play.focus = target.start;
  play.found = wordSearch.placements.slice(1).map(({ word }) => word);
  const { fixture, restore } = await mounted('../../Resources/games/word-search-ui.js', 'renderWordSearch', 'word-search', wordSearch, play);
  try {
    assert.equal(fixture.activeIntervalCount(), 1);
    assert.equal(fixture.document.listenerCount('visibilitychange'), 1);
    fixture.root.querySelector(`[data-cell="${target.start.row}:${target.start.column}"]`).dispatchEvent(new FixtureEvent('keydown', { key: 'Enter' }));
    const end = fixture.root.querySelector(`[data-cell="${target.end.row}:${target.end.column}"]`); end.focus(); end.dispatchEvent(new FixtureEvent('keydown', { key: 'Enter' }));
    assert.equal(fixture.activeIntervalCount(), 0);
    assert.equal(fixture.document.listenerCount('visibilitychange'), 0);
    fixture.root.querySelector('[data-play-another]').click(); await Promise.resolve();
    assert.equal(fixture.activeIntervalCount(), 1);
    assert.equal(fixture.document.listenerCount('visibilitychange'), 1);
  } finally { restore(); }
});

test('calling a controller renderer again disposes the previous interval and visibility listener', async () => {
  const { fixture, restore, module } = await mounted('../../Resources/games/sudoku-ui.js', 'renderSudoku', 'sudoku', sudoku);
  try {
    assert.equal(fixture.activeIntervalCount(), 1);
    await module.renderSudoku(fixture.root, storeWith('sudoku', sudoku));
    assert.equal(fixture.activeIntervalCount(), 1);
    assert.equal(fixture.document.listenerCount('visibilitychange'), 1);
  } finally { restore(); }
});

test('Word Search document drag uses pointer IDs and hit testing, then clears on outside end', async () => {
  const { fixture, restore } = await mounted('../../Resources/games/word-search-ui.js', 'renderWordSearch', 'word-search', wordSearch);
  try {
    const placement = wordSearch.placements[0];
    const start = fixture.root.querySelector(`[data-cell="${placement.start.row}:${placement.start.column}"]`);
    const end = fixture.root.querySelector(`[data-cell="${placement.end.row}:${placement.end.column}"]`);
    start.dispatchEvent(new FixtureEvent('pointerdown', { pointerId: 7, clientX: 1, clientY: 1 }));
    fixture.document.setHitTarget(end);
    fixture.document.dispatchEvent(new FixtureEvent('pointermove', { pointerId: 8, clientX: 3, clientY: 1 }));
    assert.equal(fixture.root.querySelector(`[data-cell="${placement.end.row}:${placement.end.column}"]`).classList.contains('is-preview'), false);
    fixture.document.dispatchEvent(new FixtureEvent('pointermove', { pointerId: 7, clientX: 3, clientY: 1 }));
    fixture.document.setHitTarget(null);
    fixture.document.dispatchEvent(new FixtureEvent('pointerup', { pointerId: 7, clientX: 50, clientY: 50 }));
    assert.match(fixture.root.querySelector('.games-live-region').textContent, new RegExp(`${placement.word} found`, 'i'));
    assert.equal(fixture.document.listenerCount('pointermove'), 0);
  } finally { restore(); }
});

test('Word Search pointercancel clears a stale drag and ignores a later pointerup', async () => {
  const { fixture, restore } = await mounted('../../Resources/games/word-search-ui.js', 'renderWordSearch', 'word-search', wordSearch);
  try {
    const placement = wordSearch.placements[0];
    const start = fixture.root.querySelector(`[data-cell="${placement.start.row}:${placement.start.column}"]`);
    const end = fixture.root.querySelector(`[data-cell="${placement.end.row}:${placement.end.column}"]`);
    start.dispatchEvent(new FixtureEvent('pointerdown', { pointerId: 9 }));
    assert.equal(fixture.document.listenerCount('pointermove'), 1);
    fixture.document.setHitTarget(end);
    fixture.document.dispatchEvent(new FixtureEvent('pointercancel', { pointerId: 9 }));
    fixture.document.dispatchEvent(new FixtureEvent('pointerup', { pointerId: 9 }));
    assert.doesNotMatch(fixture.root.querySelector('.games-live-region').textContent, new RegExp(`${placement.word} found`, 'i'));
    assert.equal(fixture.document.listenerCount('pointermove'), 0);
  } finally { restore(); }
});

test('Word Search lost pointer capture cancels the drag and removes document listeners', async () => {
  const { fixture, restore } = await mounted('../../Resources/games/word-search-ui.js', 'renderWordSearch', 'word-search', wordSearch);
  try {
    const placement = wordSearch.placements[0];
    const start = fixture.root.querySelector(`[data-cell="${placement.start.row}:${placement.start.column}"]`);
    const end = fixture.root.querySelector(`[data-cell="${placement.end.row}:${placement.end.column}"]`);
    start.dispatchEvent(new FixtureEvent('pointerdown', { pointerId: 11 }));
    fixture.document.setHitTarget(end);
    fixture.document.dispatchEvent(new FixtureEvent('lostpointercapture', { pointerId: 11 }));
    fixture.document.dispatchEvent(new FixtureEvent('pointerup', { pointerId: 11 }));
    assert.equal(fixture.document.listenerCount('pointermove'), 0);
    assert.doesNotMatch(fixture.root.querySelector('.games-live-region').textContent, new RegExp(`${placement.word} found`, 'i'));
  } finally { restore(); }
});

test('hostile persisted definitions and play states are rejected for every game', async () => {
  const sudokuModule = await import('../../Resources/games/sudoku-ui.js');
  const crosswordModule = await import('../../Resources/games/crossword-ui.js');
  const wordSearchModule = await import('../../Resources/games/word-search-ui.js');
  assert.equal(sudokuModule.validateSudokuRun({ definition: { ...sudoku, puzzle: [1] }, play: { values: ['x'] } }, 'easy'), false);
  assert.equal(crosswordModule.validateCrosswordRun({ definition: { ...crossword, cells: [] }, play: { values: [[7]] } }, 'easy'), false);
  assert.equal(wordSearchModule.validateWordSearchRun({ definition: wordSearch, play: { found: ['NOT-IN-PUZZLE'], focus: { row: 99, column: 0 } } }, 'easy'), false);
});

test('each hostile persisted run falls back through its game validator to a fresh valid run', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const { createSession } = await import('../../Resources/games/controller-common.js');
    const cases = [
      ['sudoku', await import('../../Resources/games/sudoku-ui.js'), sudoku, { definition: { ...sudoku, puzzle: [1] }, play: { values: ['x'] } }],
      ['crossword', await import('../../Resources/games/crossword-ui.js'), crossword, { definition: { ...crossword, cells: [] }, play: { values: [[7]] } }],
      ['word-search', await import('../../Resources/games/word-search-ui.js'), wordSearch, { definition: wordSearch, play: { found: ['NOPE'], focus: { row: 99, column: 0 } } }],
    ];
    for (const [game, module, valid, hostile] of cases) {
      const createPlay = game === 'sudoku' ? module.createSudokuState
        : game === 'crossword' ? module.createCrosswordState : module.createWordSearchState;
      const validateRun = game === 'sudoku' ? module.validateSudokuRun
        : game === 'crossword' ? module.validateCrosswordRun : module.validateWordSearchRun;
      const store = storeWith(game, valid); store.runs[game].puzzle = hostile;
      let signatureCalls = 0;
      const session = createSession({
        root: fixture.root, game, store, createPuzzle: () => valid, createPlay,
        progressed: () => true, validateRun, onRender: async () => {},
        definitionSignature: () => (
          signatureCalls++ === 0 ? 'hostile-fixture' : 'valid-fixture'
        ),
      });
      assert.equal(session.run.puzzle.definition, valid);
      assert.equal(validateRun(session.run.puzzle, 'easy'), true);
      session.dispose();
    }
  } finally { restore(); }
});

test('Crossword renders visible clue number markers', async () => {
  const { fixture, restore } = await mounted('../../Resources/games/crossword-ui.js', 'renderCrossword', 'crossword', crossword);
  try { assert.equal(fixture.root.querySelector('[data-cell-number="1"]')?.textContent, '1'); }
  finally { restore(); }
});

test('controller CSS contains scroll containment and 44px minimum cells for largest grids', () => {
  const css = readFileSync(new URL('../../Resources/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.game-board-scroll\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.sudoku-board\s*\{[^}]*min-width:\s*calc\(9\s*\*\s*44px\)/s);
  assert.match(css, /\.crossword-board\s*\{[^}]*min-width:\s*calc\(var\(--crossword-size\)\s*\*\s*44px\)/s);
  assert.match(css, /\.word-search-board\s*\{[^}]*min-width:\s*calc\(var\(--word-search-size\)\s*\*\s*44px\)/s);
  assert.match(css, /\.games-app\s*\{[^}]*overflow-x:\s*clip/s);
});

test('async Play Another render failures become a visible game error', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createSession } = await import('../../Resources/games/controller-common.js');
    const store = createEmptyGameStore();
    const session = createSession({
      root: fixture.root, game: 'sudoku', store,
      createPuzzle: ({ difficulty, seed }) => ({ seed, difficulty }),
      createPlay: () => ({}), progressed: () => false,
      validateRun: () => true,
      onRender: async () => { throw new Error('render failed'); },
    });
    await session.playAnother();
    assert.equal(fixture.root.querySelector('[role="alert"]')?.textContent.includes('could not start'), true);
  } finally { restore(); }
});

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

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDOMFixture, FixtureEvent, installDOM } from './dom-fixture.mjs';
import { generateSudoku } from '../../Resources/games/sudoku.js';
import { generateCrossword } from '../../Resources/games/crossword.js';
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
const storeWith = (game, definition, play, overrides = {}) => (
  v2StoreWithRun({
    game, definition, play, startedAt: 10, elapsedBeforeStartMs: 500, ...overrides,
  })
);

test('resuming re-anchors time so a long closed interval is excluded', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { createSession } = await import('../../Resources/games/controller-common.js');
    const definition = { seed: 1, difficulty: 'easy' };
    let wall = 3_600_010;
    let active = 100;
    const session = createSession({
      root: fixture.root, game: 'sudoku', store: storeWith('sudoku', definition, {}),
      createPuzzle: () => definition, createPlay: () => ({}), progressed: () => false,
      validateRun: () => true, onRender: async () => {}, wallNow: () => wall,
      monotonicNow: () => active,
    });
    assert.equal(session.elapsed(), 500);
    active += 250;
    assert.equal(session.elapsed(), 750);
    fixture.window.dispatchEvent(new FixtureEvent('pagehide'));
    wall += 99_000; active += 99_000;
    assert.equal(JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2)).runs.sudoku.elapsedBeforeStartMs, 750);
    assert.equal(fixture.window.listenerCount('pagehide'), 1);
    fixture.window.dispatchEvent(new FixtureEvent('pageshow'));
    active += 250;
    assert.equal(session.elapsed(), 1000);
    session.dispose();
    assert.equal(fixture.window.listenerCount('pagehide'), 0);
  } finally { restore(); }
});

test('completed reducers are terminal and ignore later input or assists', async () => {
  const sudokuModule = await import('../../Resources/games/sudoku-ui.js');
  const crosswordModule = await import('../../Resources/games/crossword-ui.js');
  const wordModule = await import('../../Resources/games/word-search-ui.js');
  const sudoku = { ...sudokuModule.createSudokuState(generateSudoku({ difficulty: 'easy', seed: 4 })), completed: true };
  const crosswordDefinition = generateCrossword({ difficulty: 'easy', seed: 4 });
  const crossword = { ...crosswordModule.createCrosswordState(crosswordDefinition), completed: true };
  const wordDefinition = generateWordSearch({ difficulty: 'easy', seed: 4 });
  const word = { ...wordModule.createWordSearchState(wordDefinition), completed: true };
  assert.strictEqual(sudokuModule.reduceSudoku(sudoku, { type: 'digit', value: 1 }), sudoku);
  assert.strictEqual(crosswordModule.reduceCrossword(crossword, { type: 'reveal' }), crossword);
  assert.strictEqual(wordModule.reduceWordSearch(word, { type: 'hint' }), word);
});

test('completion disables game controls and cannot increment statistics twice', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const module = await import('../../Resources/games/word-search-ui.js');
    const definition = generateWordSearch({ difficulty: 'easy', seed: 77 });
    const play = module.createWordSearchState(definition);
    const target = definition.placements[0];
    play.found = definition.placements.slice(1).map(({ word }) => word);
    await module.renderWordSearch(fixture.root, storeWith('word-search', definition, play));
    fixture.root.querySelector(`[data-cell="${target.start.row}:${target.start.column}"]`).click();
    fixture.root.querySelector(`[data-cell="${target.end.row}:${target.end.column}"]`).click();
    const once = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(once.stats.totalCompleted, 1);
    for (const control of fixture.root.querySelectorAll('.game-board button')) assert.equal(control.disabled, true);
    for (const control of fixture.root.querySelectorAll('.game-controls button')) assert.equal(control.disabled, true);
    fixture.root.querySelector('[data-hint]').click();
    assert.equal(JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2)).stats.totalCompleted, 1);
  } finally { restore(); }
});

test('every game persistently discloses assistance and announces the first assist', async () => {
  for (const item of [
    ['sudoku', '../../Resources/games/sudoku-ui.js', 'renderSudoku', 'createSudokuState', generateSudoku({ difficulty: 'easy', seed: 8 })],
    ['crossword', '../../Resources/games/crossword-ui.js', 'renderCrossword', 'createCrosswordState', generateCrossword({ difficulty: 'easy', seed: 8 })],
    ['word-search', '../../Resources/games/word-search-ui.js', 'renderWordSearch', 'createWordSearchState', generateWordSearch({ difficulty: 'easy', seed: 8 })],
  ]) {
    const [game, path, renderName, stateName, definition] = item;
    const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
    try {
      const module = await import(path);
      await module[renderName](fixture.root, storeWith(game, definition, module[stateName](definition)));
      assert.match(fixture.root.querySelector('[data-assisted-status]').textContent, /hints and checks.*ineligible.*best-time/i);
      fixture.root.querySelector('[data-hint]').click();
      assert.match(fixture.root.querySelector('[data-assisted-status]').textContent, /assisted run/i);
      assert.match(fixture.root.querySelector('.games-live-region').textContent, /assisted/i);
    } finally { restore(); }
  }
});

test('Restart keeps the exact definition and seed while resetting play and assistance', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const module = await import('../../Resources/games/sudoku-ui.js');
    const definition = generateSudoku({ difficulty: 'easy', seed: 42 });
    const play = module.createSudokuState(definition);
    const editable = definition.puzzle.findIndex((value) => value === 0);
    play.values[editable] = definition.solution[editable]; play.assisted = true;
    const store = storeWith('sudoku', definition, play, { assisted: true });
    store.stats.totalCompleted = 7;
    await module.renderSudoku(fixture.root, store);
    fixture.root.querySelector('[data-restart]').click(); await Promise.resolve();
    const saved = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(saved.runs.sudoku.seed, 42);
    assert.deepEqual(saved.runs.sudoku.puzzle.definition, definition);
    assert.equal(saved.runs.sudoku.puzzle.play.values[editable], 0);
    assert.equal(saved.runs.sudoku.assisted, false);
    assert.equal(saved.stats.totalCompleted, 7);
  } finally { restore(); }
});

test('mistakes have patterned non-colour styling and Crossword accessible names', async () => {
  const css = readFileSync(new URL('../../Resources/styles.css', import.meta.url), 'utf8');
  for (const selector of ['.sudoku-cell.is-error', '.crossword-cell.is-error']) {
    const body = css.match(new RegExp(`${selector.replaceAll('.', '\\\.')}\\s*\\{([^}]*)\\}`, 's'))?.[1] ?? '';
    assert.match(body, /border[^;]*:/i);
    assert.match(body, /repeating-linear-gradient|url\(/i);
  }
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const module = await import('../../Resources/games/crossword-ui.js');
    const definition = generateCrossword({ difficulty: 'easy', seed: 9 });
    const play = module.createCrosswordState(definition);
    const answer = definition.answers[0];
    play.values[answer.row][answer.column] = answer.answer[0] === 'Z' ? 'Y' : 'Z';
    await module.renderCrossword(fixture.root, storeWith('crossword', definition, play));
    fixture.root.querySelector('[data-check-all]').click();
    assert.match(fixture.root.querySelector(`[data-cell="${answer.row}:${answer.column}"]`).getAttribute('aria-label'), /mistake/i);
  } finally { restore(); }
});

test('Play Another retries a colliding definition and persists its actual derived seed', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=hard&continue=1' }); const restore = installDOM(fixture);
  try {
    const { createSession } = await import('../../Resources/games/controller-common.js');
    const current = { seed: 2, difficulty: 'hard', signature: 'same' };
    const alternate = { seed: 99, difficulty: 'hard', signature: 'different' };
    const store = storeWith('crossword', current, {});
    let calls = 0, renderedStore;
    const session = createSession({
      root: fixture.root, game: 'crossword', store,
      createPuzzle: () => (calls++ === 0 ? current : alternate),
      createPlay: () => ({}), progressed: () => false, validateRun: () => true,
      definitionSignature: (definition) => definition.signature,
      onRender: async (nextStore) => { renderedStore = nextStore; },
    });
    await session.playAnother(3);
    assert.equal(calls, 2);
    assert.equal(renderedStore.runs.crossword.puzzle.definition.signature, 'different');
    assert.notEqual(renderedStore.runs.crossword.seed, 3);
  } finally { restore(); }
});

test('clicking Play Another never coerces its MouseEvent into seed zero', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const module = await import('../../Resources/games/word-search-ui.js');
    const { puzzleSignature } = await import('../../Resources/games/controller-common.js');
    const definition = generateWordSearch({ difficulty: 'easy', seed: 77 });
    const play = module.createWordSearchState(definition);
    const target = definition.placements[0];
    play.found = definition.placements.slice(1).map(({ word }) => word);
    await module.renderWordSearch(fixture.root, storeWith('word-search', definition, play));
    fixture.root.querySelector(`[data-cell="${target.start.row}:${target.start.column}"]`).click();
    fixture.root.querySelector(`[data-cell="${target.end.row}:${target.end.column}"]`).click();
    fixture.root.querySelector('[data-play-another]').click();
    await Promise.resolve();
    const next = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2)).runs['word-search'];
    assert.notEqual(next.seed, 0);
    assert.notEqual(puzzleSignature(next.puzzle.definition), puzzleSignature(definition));
  } finally { restore(); }
});

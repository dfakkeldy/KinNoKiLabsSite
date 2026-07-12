import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completeRun, createRng, loadGameStore, markAssisted,
  resetGameStore, saveGameStore, startRun, visibleElapsedMs,
} from '../../Resources/games/core.js';
import {
  gameCardModel, renderHubMarkup, safeLocalStorage, statsModel,
} from '../../Resources/games/hub-ui.js';

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

test('unfinished game offers a difficulty-specific continue link', () => {
  let store = loadGameStore(memoryStorage());
  store = startRun(store, 'sudoku', 'medium', 7, { puzzle: [] }, 1000);

  const card = gameCardModel(store, { id: 'sudoku', title: 'Sudoku' });

  assert.equal(card.continueHref, '/games/sudoku?difficulty=medium&continue=1');
  assert.equal(card.continueLabel, 'Continue Medium');
});

test('game without a run offers all difficulty choices', () => {
  const store = loadGameStore(memoryStorage());
  const card = gameCardModel(store, { id: 'crossword', title: 'Crossword' });

  assert.equal(card.continueHref, null);
  assert.deepEqual(
    card.difficulties.map(({ label, href }) => [label, href]),
    [
      ['Easy', '/games/crossword?difficulty=easy'],
      ['Medium', '/games/crossword?difficulty=medium'],
      ['Hard', '/games/crossword?difficulty=hard'],
    ],
  );
});

test('statistics format times and keep assisted best times private', () => {
  let store = loadGameStore(memoryStorage());
  store.stats.games.sudoku.bestMs.medium = 61500;
  store = startRun(store, 'crossword', 'easy', 9, { puzzle: [] }, 1000);
  store = markAssisted(store, 'crossword');
  store.runs.crossword.elapsedBeforeStartMs = 22000;
  store = completeRun(store, 'crossword', 1000);

  const statistics = statsModel(store);

  assert.equal(statistics.games.sudoku.best, '1:01');
  assert.equal(statistics.games.crossword.best, '—');
  assert.equal(statistics.games.crossword.completed, '1 completed');
});

test('statistics zero state is friendly', () => {
  const statistics = statsModel(loadGameStore(memoryStorage()));

  assert.match(statistics.zeroState, /first puzzle/i);
  assert.match(statistics.zeroState, /this device/i);
});

test('hub markup has one heading, a labelled games region, reset, and three cards', () => {
  const markup = renderHubMarkup(loadGameStore(memoryStorage()));

  assert.equal([...markup.matchAll(/<h1(?:\s|>)/g)].length, 1);
  assert.match(markup, /<section[^>]+aria-labelledby="games-heading"/);
  assert.match(markup, /<button[^>]+data-reset-games[^>]*>Reset Game Data<\/button>/);
  for (const title of ['Sudoku', 'Crossword', 'Word Search']) {
    assert.match(markup, new RegExp(`<h2[^>]*>${title}</h2>`));
  }
});

test('reset removes local game data and reports storage failures', () => {
  const storage = memoryStorage({ 'kinnoki-games:v1': '{"version":1}' });
  assert.deepEqual(resetGameStore(storage), { ok: true });
  assert.equal(storage.getItem('kinnoki-games:v1'), null);

  const error = new Error('storage unavailable');
  const result = resetGameStore({ removeItem: () => { throw error; } });
  assert.equal(result.ok, false);
  assert.equal(result.error, error);
});

test('storage access failures become a recoverable storage adapter', () => {
  const source = Object.defineProperty({}, 'localStorage', {
    get() { throw new Error('blocked'); },
  });

  const storage = safeLocalStorage(source);

  assert.doesNotThrow(() => loadGameStore(storage));
  assert.equal(saveGameStore(storage, loadGameStore(storage)).ok, false);
});

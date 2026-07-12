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

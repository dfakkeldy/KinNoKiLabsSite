import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_DEFAULTS, STORE_KEYS, completeRun, createEmptyGameStore, openGameStore,
  resetGameStore, sanitizeAudioPreferences, startRun,
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

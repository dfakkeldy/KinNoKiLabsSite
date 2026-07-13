import test from 'node:test';
import assert from 'node:assert/strict';
import {
  abandonRun, chooseFreshDefinition, completeRun, createEmptyGameStore, createRng, loadGameStore, markAssisted,
  resetGameStore, saveGameStore, startRun, visibleElapsedMs,
} from '../../Resources/games/core.js';
import {
  gameCardModel, renderHub, renderHubMarkup, safeLocalStorage, statsModel,
} from '../../Resources/games/hub-ui.js';

test('zero-dispatch terminals count and assisted runs preserve unassisted records', () => {
  let store = createEmptyGameStore();
  store = startRun(store, {
    game: 'kinnoki-stack', mode: 'default', difficulty: 'easy', seed: 1,
    signature: 'stack-1', puzzle: {}, now: 0,
  });
  store = completeRun(store, {
    game: 'kinnoki-stack', mode: 'default', now: 1000,
    records: { score: 0, combo: 0 },
  });
  assert.equal(store.stats.totalCompleted, 1);
  assert.equal(store.stats.games['kinnoki-stack'].modes.default.completed, 1);
  assert.equal(store.stats.games['kinnoki-stack'].modes.default.records.score.easy, 0);

  store = startRun(store, {
    game: 'kinnoki-stack', mode: 'default', difficulty: 'easy', seed: 2,
    signature: 'stack-2', puzzle: {}, now: 2000,
  });
  store = markAssisted(store, 'kinnoki-stack');
  store = completeRun(store, {
    game: 'kinnoki-stack', mode: 'default', now: 3000,
    records: { score: 9999, combo: 8 },
  });
  assert.equal(store.stats.totalCompleted, 2);
  assert.equal(store.stats.games['kinnoki-stack'].modes.default.records.score.easy, 0);
  assert.equal(store.stats.games['kinnoki-stack'].modes.default.records.combo.easy, 0);
});

test('abandoned replacement changes no completion accounting', () => {
  let store = startRun(createEmptyGameStore(), {
    game: 'kinnoki-yard', mode: 'endless', difficulty: 'hard', seed: 8,
    signature: 'yard-8', puzzle: {}, now: 100,
  });
  const before = structuredClone(store.stats);
  store = abandonRun(store, { game: 'kinnoki-yard', expectedSignature: 'yard-8' });
  assert.deepEqual(store.stats, before);
  assert.equal(store.runs['kinnoki-yard'], undefined);
  assert.equal(store.previousSignatures['kinnoki-yard:endless'], undefined);
});

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

test('fresh definition rejects completed and abandoned signatures within 64 candidates', () => {
  const seenSeeds = [];
  const result = chooseFreshDefinition({
    game: 'sudoku', mode: 'default', difficulty: 'easy', initialSeed: 9,
    previousSeed: 9, previousSignature: 'signature-10',
    abandonedSignature: 'signature-11',
    createDefinition: ({ seed }) => { seenSeeds.push(seed); return { seed }; },
    signatureOf: ({ seed }) => `signature-${seed}`,
  });
  assert.equal(result.signature === 'signature-10', false);
  assert.equal(result.signature === 'signature-11', false);
  assert.equal(result.seed === 9, false);
  assert.ok(seenSeeds.length <= 64);
});

test('completed session stores the actual definition signature under default history', () => {
  let store = createEmptyGameStore();
  store = startRun(store, {
    game: 'sudoku', mode: 'default', difficulty: 'easy', seed: 5,
    signature: 'sudoku-definition-5', puzzle: {}, now: 100,
  });
  store = completeRun(store, {
    game: 'sudoku', mode: 'default', now: 1100, records: { time: 1000 },
  });
  assert.equal(store.previousSeeds.sudoku, 5);
  assert.equal(store.previousSignatures.sudoku, 'sudoku-definition-5');
});

test('corrupt storage recovers to an empty v2 store', () => {
  const store = loadGameStore(memoryStorage({ 'kinnoki-games:v1': '{bad json' }));
  assert.equal(store.version, 2);
  assert.deepEqual(store.runs, {});
  assert.equal(store.stats.totalCompleted, 0);
});

test('hidden time is excluded from elapsed play time', () => {
  const run = { startedAt: 1000, elapsedBeforeStartMs: 4000 };
  assert.equal(visibleElapsedMs(run, 9000, 6000), 9000);
});

test('assisted completion increments totals but not best time', () => {
  let store = loadGameStore(memoryStorage());
  store = startRun(store, { game: 'sudoku', mode: 'default', difficulty: 'easy', seed: 7, signature: 'test:sudoku:7', puzzle: { definition: { puzzle: [], solution: [] }, play: {} }, now: 1000 });
  store = markAssisted(store, 'sudoku');
  store.runs.sudoku.elapsedBeforeStartMs = 30000;
  store = completeRun(store, { game: 'sudoku', mode: 'default', now: 1000, records: { time: 30000 } });
  assert.equal(store.stats.totalCompleted, 1);
  assert.equal(store.stats.games.sudoku.modes.default.completed, 1);
  assert.equal(store.stats.games.sudoku.modes.default.records.time.easy, null);
});

test('lifecycle APIs reject removed positional calls', () => {
  const store = createEmptyGameStore();
  assert.strictEqual(startRun(store, 'sudoku', 'easy', 7, {}, 1000), store);
  assert.strictEqual(completeRun(store, 'sudoku', 1000), store);
});

test('unfinished game offers a difficulty-specific continue link', () => {
  let store = loadGameStore(memoryStorage());
  store = startRun(store, { game: 'sudoku', mode: 'default', difficulty: 'medium', seed: 7, signature: 'test:sudoku:7', puzzle: { definition: { puzzle: [], solution: [] }, play: {} }, now: 1000 });

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
  store.stats.games.sudoku.modes.default.records.time.medium = 61500;
  store = startRun(store, { game: 'crossword', mode: 'default', difficulty: 'easy', seed: 9, signature: 'test:crossword:9', puzzle: { definition: { puzzle: [], solution: [] }, play: {} }, now: 1000 });
  store = markAssisted(store, 'crossword');
  store.runs.crossword.elapsedBeforeStartMs = 22000;
  store = completeRun(store, { game: 'crossword', mode: 'default', now: 1000, records: { time: 22000 } });

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

test('hub markup has one heading, a labelled games region, reset, and five cards', () => {
  const markup = renderHubMarkup(loadGameStore(memoryStorage()));

  assert.equal([...markup.matchAll(/<h1(?:\s|>)/g)].length, 1);
  assert.match(markup, /<section[^>]+aria-labelledby="games-heading"/);
  assert.match(markup, /<button[^>]+data-reset-games[^>]*>Reset Game Data<\/button>/);
  for (const title of ['Sudoku', 'Crossword', 'Word Search', 'Kinnoki Stack', 'Kinnoki Yard']) {
    assert.match(markup, new RegExp(`<h2[^>]*>${title}</h2>`));
  }
  assert.equal([...markup.matchAll(/<article class="game-card/g)].length, 5);
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

test('malformed v1 state is normalized before the hub can render it', () => {
  const hostile = {
    version: 1,
    runs: {
      sudoku: { difficulty: '\"><img src=x onerror=alert(1)>', seed: 4, startedAt: 1, elapsedBeforeStartMs: 0 },
      crossword: { seed: 5 },
      'word-search': { difficulty: 'hard', seed: 6, puzzle: {}, startedAt: 10, elapsedBeforeStartMs: 20, assisted: false },
      '<script>': { difficulty: 'easy' },
    },
    previousSeeds: { sudoku: -4, crossword: 7.8, '<img>': 4 },
    stats: {
      totalCompleted: '<img src=x onerror=alert(2)>',
      currentStreak: -12,
      lastCompletedDate: '<script>alert(3)</script>',
      games: {
        sudoku: { completed: 4.8, bestMs: { easy: -1, medium: 61599, hard: '<b>bad</b>' } },
        crossword: '<img src=x>',
        'word-search': { completed: Number.MAX_VALUE, bestMs: null },
        '<svg onload=alert(4)>': { completed: 99 },
      },
    },
  };

  const store = loadGameStore(memoryStorage({ 'kinnoki-games:v1': JSON.stringify(hostile) }));
  const markup = renderHubMarkup(store);

  assert.deepEqual(Object.keys(store.runs), ['word-search']);
  assert.deepEqual(store.previousSeeds, { crossword: 7 });
  assert.equal(store.stats.totalCompleted, 0);
  assert.equal(store.stats.currentStreak, 0);
  assert.equal(store.stats.lastCompletedDate, null);
  assert.equal(store.stats.games.sudoku.modes.default.completed, 4);
  assert.deepEqual(store.stats.games.sudoku.modes.default.records.time, { easy: null, medium: 61599, hard: null });
  assert.equal(store.stats.games.crossword.modes.default.completed, 0);
  assert.doesNotMatch(markup, /<(?:img|script|svg|b)\b/i);
});

test('missing v1 fields recover to a complete safe store', () => {
  const store = loadGameStore(memoryStorage({ 'kinnoki-games:v1': '{"version":1}' }));

  assert.deepEqual(store.runs, {});
  assert.deepEqual(store.previousSeeds, {});
  assert.equal(store.stats.totalCompleted, 0);
  assert.deepEqual(Object.keys(store.stats.games), [
    'sudoku', 'crossword', 'word-search', 'kinnoki-stack', 'kinnoki-yard',
  ]);
  assert.doesNotThrow(() => renderHubMarkup(store));
});

test('hub models reject unknown games and invalid run difficulties', () => {
  const empty = loadGameStore(memoryStorage());
  assert.equal(gameCardModel(empty, { id: '<img src=x>', title: '<b>Bad</b>' }), null);

  const invalidRun = structuredClone(empty);
  invalidRun.runs.sudoku = { difficulty: undefined };
  assert.doesNotThrow(() => renderHubMarkup(invalidRun));
  assert.equal(gameCardModel(invalidRun, { id: 'sudoku', title: 'Sudoku' }).continueHref, null);

  assert.equal(startRun(empty, { game: 'unknown', difficulty: 'easy', seed: 1, signature: 'x', puzzle: {}, now: 1 }), empty);
  assert.equal(startRun(empty, { game: 'sudoku', difficulty: 'nightmare', seed: 1, signature: 'x', puzzle: {}, now: 1 }), empty);
});

test('raw hostile statistics never become hub HTML or invalid numbers', () => {
  const hostile = {
    runs: {},
    stats: {
      totalCompleted: '<img src=x onerror=alert(1)>',
      currentStreak: Number.NaN,
      games: {
        sudoku: { completed: -2, bestMs: { easy: -500, medium: Number.POSITIVE_INFINITY } },
      },
    },
  };

  const statistics = statsModel(hostile);
  const markup = renderHubMarkup(hostile);

  assert.equal(statistics.total, '0');
  assert.equal(statistics.streak, '0');
  assert.deepEqual(statistics.games.sudoku, { completed: '0 completed', best: '—' });
  assert.doesNotMatch(markup, /<img\b|Infinity|NaN|-500/i);
});

class FakeControl {
  constructor({ hidden = false } = {}) {
    this.hidden = hidden;
    this.open = false;
    this.listeners = new Map();
    this.textContent = '';
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  click() {
    this.listeners.get('click')?.();
  }

  showModal() { this.open = true; }
  close() { this.open = false; }
}

class HubFixture {
  set innerHTML(value) {
    this.markup = value;
    this.reset = new FakeControl();
    this.cancel = new FakeControl();
    this.confirm = new FakeControl();
    this.dialog = new FakeControl();
    this.notice = new FakeControl({ hidden: true });
  }

  querySelector(selector) {
    return {
      '[data-reset-games]': this.reset,
      '[data-dialog-cancel]': this.cancel,
      '[data-dialog-confirm]': this.confirm,
      '[data-reset-dialog]': this.dialog,
      '.game-storage-notice': this.notice,
    }[selector] ?? null;
  }
}

async function withBrowserGlobals(storage, body) {
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const liveRegion = new FakeControl();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { querySelector: (selector) => (selector === '.games-live-region' ? liveRegion : null) },
  });
  try {
    await body(liveRegion);
  } finally {
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    else delete globalThis.localStorage;
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
    else delete globalThis.document;
  }
}

test('confirmed reset removes the stored game state and announces success', async () => {
  const storage = memoryStorage({ 'kinnoki-games:v1': JSON.stringify(loadGameStore(memoryStorage())) });
  await withBrowserGlobals(storage, async (liveRegion) => {
    const root = new HubFixture();
    await renderHub(root, loadGameStore(storage));

    root.reset.click();
    assert.equal(root.dialog.open, true);
    root.confirm.click();

    assert.equal(storage.getItem('kinnoki-games:v1'), null);
    assert.equal(liveRegion.textContent, 'Game data reset.');
  });
});

test('failed reset uses one polite visible status without a duplicate announcement', async () => {
  const storage = {
    getItem: () => null,
    setItem() {},
    removeItem() { throw new Error('blocked'); },
  };
  await withBrowserGlobals(storage, async (liveRegion) => {
    const root = new HubFixture();
    await renderHub(root, loadGameStore(storage));
    assert.match(root.markup, /class="game-storage-notice" role="status" aria-live="polite"/);
    assert.doesNotMatch(root.markup, /class="game-storage-notice" role="alert"/);

    root.reset.click();
    root.confirm.click();

    assert.equal(root.notice.hidden, false);
    assert.equal(liveRegion.textContent, '');
  });
});

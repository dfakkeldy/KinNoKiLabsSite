export const STORE_KEYS = Object.freeze({
  v1: 'kinnoki-games:v1',
  v2: 'kinnoki-games:v2',
});
export const GAME_IDS = Object.freeze([
  'sudoku', 'crossword', 'word-search', 'kinnoki-stack', 'kinnoki-yard', 'kinnoki-charts',
]);
export const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
export const AUDIO_DEFAULTS = Object.freeze({
  musicEnabled: true,
  musicVolume: 0.35,
  effectsEnabled: true,
  effectsVolume: 0.50,
});

const STREAM_SALTS = Object.freeze({
  cargo: 0xA341316C,
  manifest: 0xC8013EA4,
  tide: 0xAD90777D,
  'yard-batch': 0x7E95761E,
  contract: 0x9E3779B9,
  fallback: 0xD1B54A35,
});

const MODE_RECORDS = Object.freeze({
  sudoku: { default: ['time'] },
  crossword: { default: ['time'] },
  'word-search': { default: ['time'] },
  'kinnoki-stack': { default: ['score', 'combo'] },
  'kinnoki-yard': { contracts: ['time', 'moves'], endless: ['score', 'combo'] },
  'kinnoki-charts': { default: ['time'] },
});
const RECORD_STRATEGY = Object.freeze({
  time: 'min', moves: 'min', score: 'max', combo: 'max',
});

export function indexedSeed(seed, stream, index) {
  if (!Object.hasOwn(STREAM_SALTS, stream) || !Number.isSafeInteger(index) || index < 0) {
    throw new TypeError('Invalid deterministic stream request');
  }
  return ((seed >>> 0) ^ STREAM_SALTS[stream]
    ^ Math.imul(index + 1, 0x9E3779B1)) >>> 0;
}

export function saturatingAdd(...values) {
  let result = 0;
  for (const value of values) {
    const safe = Number.isFinite(value) && value > 0
      ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER) : 0;
    result = Math.min(Number.MAX_SAFE_INTEGER, result + safe);
  }
  return result;
}

const normalizedVolume = (value, fallback) => (
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback
);

export function sanitizeAudioPreferences(value) {
  return {
    musicEnabled: typeof value?.musicEnabled === 'boolean'
      ? value.musicEnabled : AUDIO_DEFAULTS.musicEnabled,
    musicVolume: normalizedVolume(value?.musicVolume, AUDIO_DEFAULTS.musicVolume),
    effectsEnabled: typeof value?.effectsEnabled === 'boolean'
      ? value.effectsEnabled : AUDIO_DEFAULTS.effectsEnabled,
    effectsVolume: normalizedVolume(value?.effectsVolume, AUDIO_DEFAULTS.effectsVolume),
  };
}

const emptyDifficultyMap = (value = null) => Object.fromEntries(
  DIFFICULTIES.map((difficulty) => [difficulty, value]),
);
const emptyModeStats = (recordTypes) => ({
  completed: 0,
  completedByDifficulty: emptyDifficultyMap(0),
  records: Object.fromEntries(recordTypes.map((recordType) => (
    [recordType, emptyDifficultyMap()]
  ))),
});
const emptyGameStats = (modes) => ({
  modes: Object.fromEntries(Object.entries(modes).map(([mode, recordTypes]) => (
    [mode, emptyModeStats(recordTypes)]
  ))),
});

export function createEmptyGameStore() {
  return {
    version: 2,
    runs: {},
    previousSeeds: {},
    previousSignatures: {},
    audio: { ...AUDIO_DEFAULTS },
    stats: {
      totalCompleted: 0,
      currentStreak: 0,
      lastCompletedDate: null,
      games: Object.fromEntries(Object.entries(MODE_RECORDS).map(
        ([game, modes]) => [game, emptyGameStats(modes)],
      )),
    },
  };
}

export function createRng(seed) {
  let value = seed >>> 0;
  return {
    next() {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    },
    int(max) { return Math.floor(this.next() * max); },
    shuffle(values) {
      const copy = [...values];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = this.int(i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

export const deriveSeed = (seed, attempt) => (
  (seed >>> 0) + Math.imul(attempt + 1, 0x9E3779B1)
) >>> 0;

const isObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);
const stableSerialize = (value) => {
  if (Array.isArray(value)) return '[' + value.map(stableSerialize).join(',') + ']';
  if (isObject(value)) {
    return '{' + Object.keys(value).sort().map((key) => (
      JSON.stringify(key) + ':' + stableSerialize(value[key])
    )).join(',') + '}';
  }
  return JSON.stringify(value);
};

export function historyKey(game, mode = 'default') {
  return mode === 'default' ? game : game + ':' + mode;
}
export function legacyRunSignature(game, seed, definition) {
  return 'legacy:v1:' + game + ':' + stableSerialize([seed >>> 0, definition]);
}
export function chooseFreshDefinition({
  game, mode = 'default', difficulty, initialSeed, previousSeed = null,
  previousSignature = null, abandonedSignature = null, createDefinition, signatureOf,
}) {
  if (!MODE_RECORDS[game]?.[mode] || !DIFFICULTIES.includes(difficulty)
      || typeof createDefinition !== 'function' || typeof signatureOf !== 'function') {
    throw new TypeError('Invalid definition selection request');
  }
  for (let candidateIndex = 0; candidateIndex < 64; candidateIndex += 1) {
    const seed = candidateIndex === 0
      ? initialSeed >>> 0 : deriveSeed(initialSeed, candidateIndex - 1);
    const definition = createDefinition({ game, mode, difficulty, seed });
    const signature = signatureOf(definition);
    if (seed === previousSeed || signature === previousSignature
        || signature === abandonedSignature) continue;
    return { definition, seed, signature };
  }
  throw new Error('Unable to create a non-repeating definition after 64 candidates');
}

const nonNegativeSafeInteger = (value, fallback = 0) => (
  Number.isFinite(value) && value >= 0
    ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER) : fallback
);
const optionalSafeInteger = (value) => (
  Number.isFinite(value) && value >= 0
    ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER) : null
);
const validMode = (game, mode) => Object.hasOwn(MODE_RECORDS[game] ?? {}, mode);
const sanitizeRunEnvelope = (value, expectedGame) => {
  if (!isObject(value) || value.game !== expectedGame || !validMode(expectedGame, value.mode)
      || !DIFFICULTIES.includes(value.difficulty) || !Number.isFinite(value.seed) || value.seed < 0
      || typeof value.signature !== 'string' || value.signature.length === 0
      || !isObject(value.puzzle) || !Number.isFinite(value.startedAt)
      || !Number.isFinite(value.elapsedBeforeStartMs) || value.elapsedBeforeStartMs < 0) return null;
  return {
    game: expectedGame, mode: value.mode, difficulty: value.difficulty,
    seed: Math.floor(value.seed) >>> 0, signature: value.signature, puzzle: value.puzzle,
    startedAt: Math.floor(value.startedAt),
    elapsedBeforeStartMs: nonNegativeSafeInteger(value.elapsedBeforeStartMs),
    assisted: value.assisted === true,
  };
};
const sanitizeModeStats = (value, recordTypes) => {
  const source = isObject(value) ? value : {};
  const sourceByDifficulty = isObject(source.completedByDifficulty) ? source.completedByDifficulty : {};
  const sourceRecords = isObject(source.records) ? source.records : {};
  return {
    completed: nonNegativeSafeInteger(source.completed),
    completedByDifficulty: Object.fromEntries(DIFFICULTIES.map((difficulty) => [
      difficulty, nonNegativeSafeInteger(sourceByDifficulty[difficulty]),
    ])),
    records: Object.fromEntries(recordTypes.map((recordType) => {
      const record = isObject(sourceRecords[recordType]) ? sourceRecords[recordType] : {};
      return [recordType, Object.fromEntries(DIFFICULTIES.map((difficulty) => [
        difficulty, optionalSafeInteger(record[difficulty]),
      ]))];
    })),
  };
};
const sanitizeV2Store = (value, runValidators = {}) => {
  const empty = createEmptyGameStore();
  if (!isObject(value) || value.version !== 2) return empty;
  const runs = {};
  for (const game of GAME_IDS) {
    const run = sanitizeRunEnvelope(isObject(value.runs) ? value.runs[game] : null, game);
    if (!run) continue;
    try {
      if (runValidators[game] && runValidators[game](run) !== true) continue;
    } catch { continue; }
    runs[game] = run;
  }
  const previousSeeds = {};
  const previousSignatures = {};
  for (const [game, modes] of Object.entries(MODE_RECORDS)) {
    for (const mode of Object.keys(modes)) {
      const key = historyKey(game, mode);
      const seed = value.previousSeeds?.[key];
      const signature = value.previousSignatures?.[key];
      if (Number.isFinite(seed) && seed >= 0) previousSeeds[key] = Math.floor(seed) >>> 0;
      if (typeof signature === 'string' && signature.length > 0) previousSignatures[key] = signature;
    }
  }
  const sourceStats = isObject(value.stats) ? value.stats : {};
  const sourceGames = isObject(sourceStats.games) ? sourceStats.games : {};
  return {
    version: 2, runs, previousSeeds, previousSignatures,
    audio: sanitizeAudioPreferences(value.audio),
    stats: {
      totalCompleted: nonNegativeSafeInteger(sourceStats.totalCompleted),
      currentStreak: nonNegativeSafeInteger(sourceStats.currentStreak),
      lastCompletedDate: typeof sourceStats.lastCompletedDate === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(sourceStats.lastCompletedDate)
        ? sourceStats.lastCompletedDate : null,
      games: Object.fromEntries(Object.entries(MODE_RECORDS).map(([game, modes]) => {
        const sourceModes = isObject(sourceGames[game]?.modes) ? sourceGames[game].modes : {};
        return [game, { modes: Object.fromEntries(Object.entries(modes).map(
          ([mode, recordTypes]) => [mode, sanitizeModeStats(sourceModes[mode], recordTypes)],
        )) }];
      })),
    },
  };
};
const migrateV1Store = (value) => {
  const migrated = createEmptyGameStore();
  if (!isObject(value) || value.version !== 1) return migrated;
  for (const game of ['sudoku', 'crossword', 'word-search']) {
    const source = value.runs?.[game];
    if (isObject(source) && DIFFICULTIES.includes(source.difficulty)
        && Number.isFinite(source.seed) && source.seed >= 0 && isObject(source.puzzle)
        && Number.isFinite(source.startedAt) && Number.isFinite(source.elapsedBeforeStartMs)
        && source.elapsedBeforeStartMs >= 0) {
      migrated.runs[game] = {
        game, mode: 'default', difficulty: source.difficulty,
        seed: Math.floor(source.seed) >>> 0,
        signature: legacyRunSignature(game, source.seed, source.puzzle.definition),
        puzzle: source.puzzle, startedAt: Math.floor(source.startedAt),
        elapsedBeforeStartMs: nonNegativeSafeInteger(source.elapsedBeforeStartMs),
        assisted: source.assisted === true,
      };
    }
    const previousSeed = value.previousSeeds?.[game];
    if (Number.isFinite(previousSeed) && previousSeed >= 0) migrated.previousSeeds[game] = Math.floor(previousSeed) >>> 0;
    const sourceStats = value.stats?.games?.[game];
    const target = migrated.stats.games[game].modes.default;
    target.completed = nonNegativeSafeInteger(sourceStats?.completed);
    for (const difficulty of DIFFICULTIES) {
      target.records.time[difficulty] = optionalSafeInteger(sourceStats?.bestMs?.[difficulty]);
    }
  }
  migrated.stats.totalCompleted = nonNegativeSafeInteger(value.stats?.totalCompleted);
  migrated.stats.currentStreak = nonNegativeSafeInteger(value.stats?.currentStreak);
  migrated.stats.lastCompletedDate = typeof value.stats?.lastCompletedDate === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value.stats.lastCompletedDate)
    ? value.stats.lastCompletedDate : null;
  return migrated;
};

export function saveGameStore(storage, store) {
  try {
    const normalized = store?.version === 1 ? migrateV1Store(store) : store;
    storage.setItem(STORE_KEYS.v2, JSON.stringify(sanitizeV2Store(normalized)));
    return { ok: true };
  } catch (error) { return { ok: false, error }; }
}
export function openGameStore(storage, { runValidators = {} } = {}) {
  let rawV2;
  try { rawV2 = storage.getItem(STORE_KEYS.v2); }
  catch { return { store: createEmptyGameStore(), migration: { state: 'empty' } }; }
  if (rawV2 !== null) {
    try { return { store: sanitizeV2Store(JSON.parse(rawV2), runValidators), migration: { state: 'v2' } }; }
    catch { return { store: createEmptyGameStore(), migration: { state: 'v2' } }; }
  }
  let rawV1;
  try { rawV1 = storage.getItem(STORE_KEYS.v1); }
  catch { return { store: createEmptyGameStore(), migration: { state: 'empty' } }; }
  if (rawV1 === null) return { store: createEmptyGameStore(), migration: { state: 'empty' } };
  let migrated;
  try { migrated = migrateV1Store(JSON.parse(rawV1)); }
  catch { return { store: createEmptyGameStore(), migration: { state: 'empty' } }; }
  const saved = saveGameStore(storage, migrated);
  if (!saved.ok) return { store: migrated, migration: { state: 'memory-only', error: saved.error } };
  try { storage.removeItem(STORE_KEYS.v1); } catch { /* v2 is already durable */ }
  return { store: migrated, migration: { state: 'migrated' } };
}
export function loadGameStore(storage, options) { return openGameStore(storage, options).store; }
export function resetGameStore(storage) {
  let firstError = null;
  for (const key of [STORE_KEYS.v2, STORE_KEYS.v1]) {
    try { storage.removeItem(key); } catch (error) { firstError ??= error; }
  }
  return firstError ? { ok: false, error: firstError } : { ok: true };
}

export function startRun(store, request) {
  const { game, mode = 'default', difficulty, seed, signature, puzzle, now } = request ?? {};
  if (!validMode(game, mode) || !DIFFICULTIES.includes(difficulty)
      || !Number.isFinite(seed) || seed < 0 || typeof signature !== 'string'
      || signature.length === 0 || !isObject(puzzle) || !Number.isFinite(now)) return store;
  return { ...store, runs: { ...store.runs, [game]: {
    game, mode, difficulty, seed: Math.floor(seed) >>> 0, signature, puzzle,
    startedAt: Math.floor(now), elapsedBeforeStartMs: 0, assisted: false,
  } } };
}
export function abandonRun(store, { game, expectedSignature = null }) {
  const run = store.runs?.[game];
  if (!run || (expectedSignature !== null && run.signature !== expectedSignature)) return store;
  const { [game]: _abandoned, ...runs } = store.runs;
  return { ...store, runs };
}
export function markAssisted(store, game) {
  const run = store.runs?.[game];
  if (!run || run.assisted) return store;
  return { ...store, runs: { ...store.runs, [game]: { ...run, assisted: true } } };
}
export function visibleElapsedMs(run, now, hiddenSince = null) {
  const visibleUntil = hiddenSince ?? now;
  return Math.max(0, Math.trunc(nonNegativeSafeInteger(run?.elapsedBeforeStartMs)
    + visibleUntil - (Number.isFinite(run?.startedAt) ? run.startedAt : visibleUntil)));
}
const localDate = (timestamp) => {
  const date = new Date(timestamp);
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const dateOrdinal = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
};
const nextStreak = (stats, completedDate) => {
  if (stats.lastCompletedDate === completedDate) return stats.currentStreak;
  if (stats.lastCompletedDate && dateOrdinal(completedDate) - dateOrdinal(stats.lastCompletedDate) === 1) {
    return stats.currentStreak + 1;
  }
  return 1;
};
export function completeRun(store, request) {
  const { game, mode = 'default', now, records = {} } = request ?? {};
  const run = store.runs?.[game];
  if (!run || run.mode !== mode || !Number.isFinite(now)) return store;
  const { [game]: completedRun, ...runs } = store.runs;
  const key = historyKey(game, mode);
  const bucket = store.stats.games[game].modes[mode];
  const completedDate = localDate(now);
  const nextRecords = structuredClone(bucket.records);
  if (!run.assisted) {
    for (const recordType of MODE_RECORDS[game][mode]) {
      const candidate = optionalSafeInteger(records[recordType]);
      if (candidate === null) continue;
      const current = nextRecords[recordType][run.difficulty];
      nextRecords[recordType][run.difficulty] = current === null ? candidate
        : RECORD_STRATEGY[recordType] === 'min' ? Math.min(current, candidate) : Math.max(current, candidate);
    }
  }
  return {
    ...store, runs,
    previousSeeds: { ...store.previousSeeds, [key]: completedRun.seed },
    previousSignatures: { ...store.previousSignatures, [key]: completedRun.signature },
    stats: {
      ...store.stats,
      totalCompleted: saturatingAdd(store.stats.totalCompleted, 1),
      currentStreak: nonNegativeSafeInteger(nextStreak(store.stats, completedDate)),
      lastCompletedDate: completedDate,
      games: { ...store.stats.games, [game]: {
        ...store.stats.games[game], modes: { ...store.stats.games[game].modes, [mode]: {
          ...bucket,
          completed: saturatingAdd(bucket.completed, 1),
          completedByDifficulty: { ...bucket.completedByDifficulty,
            [run.difficulty]: saturatingAdd(bucket.completedByDifficulty[run.difficulty], 1) },
          records: nextRecords,
        } },
      } },
    },
  };
}
export function recordsBrokenBy(store, request) {
  const { game, mode = 'default', records = {} } = request ?? {};
  const run = store.runs?.[game];
  if (!run || run.mode !== mode || run.assisted) return [];
  const bucket = store.stats?.games?.[game]?.modes?.[mode];
  if (!bucket) return [];
  const broken = [];
  for (const recordType of MODE_RECORDS[game][mode]) {
    const candidate = optionalSafeInteger(records[recordType]);
    if (candidate === null) continue;
    const current = bucket.records[recordType][run.difficulty];
    const improves = current === null
      || (RECORD_STRATEGY[recordType] === 'min' ? candidate < current : candidate > current);
    if (improves) broken.push(recordType);
  }
  return broken;
}

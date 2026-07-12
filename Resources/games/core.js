const KEY = 'kinnoki-games:v1';
const GAME_IDS = ['sudoku', 'crossword', 'word-search'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const nonNegativeInteger = (value) => {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER);
};

const optionalTime = (value) => (
  Number.isFinite(value) && value >= 0
    ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER)
    : null
);

const gameStats = () => ({
  completed: 0,
  bestMs: { easy: null, medium: null, hard: null },
});

const emptyStore = () => ({
  version: 1,
  runs: {},
  previousSeeds: {},
  stats: {
    totalCompleted: 0,
    currentStreak: 0,
    lastCompletedDate: null,
    games: {
      sudoku: gameStats(),
      crossword: gameStats(),
      'word-search': gameStats(),
    },
  },
});

const sanitizedGameStats = (value) => ({
  completed: nonNegativeInteger(isObject(value) ? value.completed : 0),
  bestMs: Object.fromEntries(DIFFICULTIES.map((difficulty) => [
    difficulty,
    optionalTime(isObject(value?.bestMs) ? value.bestMs[difficulty] : null),
  ])),
});

const sanitizedRun = (value) => {
  if (!isObject(value)
    || !DIFFICULTIES.includes(value.difficulty)
    || !Number.isFinite(value.seed)
    || value.seed < 0
    || !Number.isFinite(value.startedAt)
    || !Number.isFinite(value.elapsedBeforeStartMs)
    || value.elapsedBeforeStartMs < 0
    || !Object.hasOwn(value, 'puzzle')) return null;

  return {
    difficulty: value.difficulty,
    seed: Math.floor(value.seed) >>> 0,
    puzzle: value.puzzle,
    startedAt: Math.floor(value.startedAt),
    elapsedBeforeStartMs: nonNegativeInteger(value.elapsedBeforeStartMs),
    assisted: value.assisted === true,
  };
};

const sanitizeStore = (value) => {
  if (!isObject(value) || value.version !== 1) return emptyStore();

  const runs = {};
  const previousSeeds = {};
  for (const game of GAME_IDS) {
    const run = sanitizedRun(isObject(value.runs) ? value.runs[game] : null);
    if (run) runs[game] = run;

    const previousSeed = isObject(value.previousSeeds) ? value.previousSeeds[game] : null;
    if (Number.isFinite(previousSeed) && previousSeed >= 0) {
      previousSeeds[game] = Math.floor(previousSeed) >>> 0;
    }
  }

  const sourceStats = isObject(value.stats) ? value.stats : {};
  const sourceGames = isObject(sourceStats.games) ? sourceStats.games : {};
  return {
    version: 1,
    runs,
    previousSeeds,
    stats: {
      totalCompleted: nonNegativeInteger(sourceStats.totalCompleted),
      currentStreak: nonNegativeInteger(sourceStats.currentStreak),
      lastCompletedDate: typeof sourceStats.lastCompletedDate === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(sourceStats.lastCompletedDate)
        ? sourceStats.lastCompletedDate
        : null,
      games: Object.fromEntries(GAME_IDS.map((game) => [
        game,
        sanitizedGameStats(sourceGames[game]),
      ])),
    },
  };
};

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
    int(max) {
      return Math.floor(this.next() * max);
    },
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

export function loadGameStore(storage) {
  try {
    const value = JSON.parse(storage.getItem(KEY));
    return sanitizeStore(value);
  } catch {
    return emptyStore();
  }
}

export function saveGameStore(storage, store) {
  try {
    storage.setItem(KEY, JSON.stringify(store));
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export function resetGameStore(storage) {
  try {
    storage.removeItem(KEY);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export function startRun(store, game, difficulty, seed, puzzle, now) {
  if (!GAME_IDS.includes(game) || !DIFFICULTIES.includes(difficulty)) return store;
  return {
    ...store,
    runs: {
      ...store.runs,
      [game]: {
        difficulty,
        seed: seed >>> 0,
        puzzle,
        startedAt: now,
        elapsedBeforeStartMs: 0,
        assisted: false,
      },
    },
  };
}

export function markAssisted(store, game) {
  const run = store.runs[game];
  if (!run) return store;

  return {
    ...store,
    runs: {
      ...store.runs,
      [game]: { ...run, assisted: true },
    },
  };
}

export function visibleElapsedMs(run, now, hiddenSince = null) {
  const visibleUntil = hiddenSince ?? now;
  return Math.max(0, Math.trunc(run.elapsedBeforeStartMs + visibleUntil - run.startedAt));
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
  if (stats.lastCompletedDate
    && dateOrdinal(completedDate) - dateOrdinal(stats.lastCompletedDate) === 1) {
    return stats.currentStreak + 1;
  }
  return 1;
};

export function completeRun(store, game, now) {
  const run = store.runs[game];
  if (!run) return store;

  const elapsedMs = visibleElapsedMs(run, now);
  const completedDate = localDate(now);
  const currentGameStats = store.stats.games[game] ?? gameStats();
  const currentBest = currentGameStats.bestMs[run.difficulty] ?? null;
  const bestMs = run.assisted
    ? currentGameStats.bestMs
    : {
        ...currentGameStats.bestMs,
        [run.difficulty]: currentBest === null ? elapsedMs : Math.min(currentBest, elapsedMs),
      };
  const { [game]: completedRun, ...remainingRuns } = store.runs;

  return {
    ...store,
    runs: remainingRuns,
    previousSeeds: { ...store.previousSeeds, [game]: completedRun.seed },
    stats: {
      ...store.stats,
      totalCompleted: store.stats.totalCompleted + 1,
      currentStreak: nextStreak(store.stats, completedDate),
      lastCompletedDate: completedDate,
      games: {
        ...store.stats.games,
        [game]: {
          ...currentGameStats,
          completed: currentGameStats.completed + 1,
          bestMs,
        },
      },
    },
  };
}

import { loadGameStore, resetGameStore } from './core.js';

export const GAMES = Object.freeze([
  {
    id: 'sudoku',
    title: 'Sudoku',
    eyebrow: 'Logic',
    description: 'Settle into a clean number puzzle with a difficulty that fits the moment.',
    symbol: '9',
    modes: [{ id: 'default', label: 'New puzzle' }],
    records: ['time'],
  },
  {
    id: 'crossword',
    title: 'Crossword',
    eyebrow: 'Words',
    description: 'Follow thoughtful clues through a compact, themed crossword.',
    symbol: 'A',
    modes: [{ id: 'default', label: 'New puzzle' }],
    records: ['time'],
  },
  {
    id: 'word-search',
    title: 'Word Search',
    eyebrow: 'Discovery',
    description: 'Scan a calm letter grid for words gathered around a shared theme.',
    symbol: 'W',
    modes: [{ id: 'default', label: 'New puzzle' }],
    records: ['time'],
  },
  {
    id: 'kinnoki-stack',
    title: 'Kinnoki Stack',
    eyebrow: 'Cargo arcade',
    description: 'Guide falling cargo into manifests while forecast tides reshape the dock.',
    symbol: 'S',
    modes: [{ id: 'default', label: 'New run' }],
    records: ['score', 'combo'],
  },
  {
    id: 'kinnoki-yard',
    title: 'Kinnoki Yard',
    eyebrow: 'Harbour packing',
    description: 'Solve calm packing contracts or build an endless manifest-clearing yard.',
    symbol: 'Y',
    modes: [
      { id: 'contracts', label: 'Puzzle Contracts' },
      { id: 'endless', label: 'Endless Yard' },
    ],
    records: ['time', 'moves', 'score', 'combo'],
  },
]);

const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
const GAME_IDS = Object.freeze(GAMES.map(({ id }) => id));

const nonNegativeInteger = (value) => {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER);
};

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

export function safeLocalStorage(source = globalThis) {
  try {
    return source.localStorage;
  } catch (error) {
    const unavailable = () => { throw error; };
    return { getItem: unavailable, setItem: unavailable, removeItem: unavailable };
  }
}

const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const normalizedRecord = (value) => {
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER);
};

export function formatRecord(type, value) {
  const record = normalizedRecord(value);
  if (record === null) return '—';
  if (type === 'time') {
    const totalSeconds = Math.floor(record / 1000);
    return Math.floor(totalSeconds / 60) + ':'
      + String(totalSeconds % 60).padStart(2, '0');
  }
  if (type === 'moves') return record + ' moves';
  if (type === 'score') return record.toLocaleString('en-CA');
  if (type === 'combo') return record + '×';
  return '—';
}

const modeContinueLabel = (game, mode, difficulty) => {
  if (game === 'kinnoki-yard') {
    const label = mode === 'endless' ? 'Endless Yard' : 'Puzzle Contract';
    return 'Continue ' + label + ' · ' + titleCase(difficulty);
  }
  return 'Continue ' + titleCase(difficulty);
};

const gameModeConfig = (game) => (
  GAMES.find(({ id }) => id === game.id)?.modes ?? [{ id: 'default', label: 'New puzzle' }]
);

export function gameCardModel(store, game) {
  if (!GAME_IDS.includes(game?.id)) return null;
  const configured = GAMES.find(({ id }) => id === game.id);
  const modes = Array.isArray(game.modes) && game.modes.length
    ? game.modes.map((mode) => ({
      id: mode.id,
      label: mode.label ?? (mode.id === 'endless' ? 'Endless Yard' : 'Puzzle Contracts'),
    }))
    : gameModeConfig(configured);
  const run = store.runs?.[game.id];
  const difficulty = DIFFICULTIES.includes(run?.difficulty) ? run.difficulty : null;
  const mode = modes.some(({ id }) => id === run?.mode)
    ? run.mode
    : run?.mode == null && modes.some(({ id }) => id === 'default')
      ? 'default' : null;
  const basePath = '/games/' + game.id;
  const hrefFor = (modeId, value) => (
    modeId === 'default'
      ? basePath + '?difficulty=' + value
      : basePath + '?mode=' + modeId + '&difficulty=' + value
  );
  const modeGroups = modes.map((entry) => ({
    ...entry,
    difficulties: DIFFICULTIES.map((value) => ({
      label: titleCase(value),
      href: hrefFor(entry.id, value),
    })),
  }));
  return {
    ...configured,
    ...game,
    modes,
    modeGroups,
    difficulties: modeGroups[0].difficulties,
    continueHref: difficulty && mode
      ? hrefFor(mode, difficulty) + '&continue=1'
      : null,
    continueLabel: difficulty && mode
      ? modeContinueLabel(game.id, mode, difficulty)
      : null,
  };
}

const modeStats = (store, game, mode) => (
  store.stats?.games?.[game]?.modes?.[mode] ?? null
);

const legacyDefaultStats = (store, game) => {
  const legacy = store.stats?.games?.[game];
  return legacy && !legacy.modes ? {
    completed: legacy.completed,
    records: { time: legacy.bestMs },
  } : null;
};

const recordValues = (bucket, type) => DIFFICULTIES
  .map((difficulty) => bucket?.records?.[type]?.[difficulty])
  .filter((value) => normalizedRecord(value) !== null);

const bestRecord = (bucket, type, strategy) => {
  const values = recordValues(bucket, type);
  if (!values.length) return '—';
  return formatRecord(type,
    strategy === 'min' ? Math.min(...values) : Math.max(...values));
};

export function statsModel(store) {
  const games = Object.fromEntries(GAMES.map((game) => {
    if (['sudoku', 'crossword', 'word-search'].includes(game.id)) {
      const bucket = modeStats(store, game.id, 'default')
        ?? legacyDefaultStats(store, game.id);
      const completed = nonNegativeInteger(bucket?.completed);
      return [game.id, {
        completed: completed + ' completed',
        best: bestRecord(bucket, 'time', 'min'),
      }];
    }
    if (game.id === 'kinnoki-stack') {
      const bucket = modeStats(store, game.id, 'default');
      const completed = nonNegativeInteger(bucket?.completed);
      return [game.id, {
        completed: completed + ' completed',
        best: bestRecord(bucket, 'score', 'max'),
        combo: bestRecord(bucket, 'combo', 'max'),
      }];
    }
    const contracts = modeStats(store, game.id, 'contracts');
    const endless = modeStats(store, game.id, 'endless');
    const completed = nonNegativeInteger(
      nonNegativeInteger(contracts?.completed)
        + nonNegativeInteger(endless?.completed),
    );
    return [game.id, {
      completed: completed + ' completed',
      best: bestRecord(contracts, 'time', 'min'),
      moves: bestRecord(contracts, 'moves', 'min'),
      score: bestRecord(endless, 'score', 'max'),
      combo: bestRecord(endless, 'combo', 'max'),
    }];
  }));
  const total = nonNegativeInteger(store.stats?.totalCompleted);
  const streak = nonNegativeInteger(store.stats?.currentStreak);
  return {
    total: String(total),
    totalLabel: total === 1 ? 'Game completed' : 'Games completed',
    streak: String(streak),
    streakLabel: 'Day streak',
    games,
    zeroState: total === 0
      ? 'Your first puzzle or game finish will start the record book. '
        + 'Your progress stays on this device.'
      : total + ' ' + (total === 1 ? 'game' : 'games')
        + ' finished on this device.',
  };
}

const difficultyMarkup = (group) => group.difficulties.map(({ label, href }) => (
  `<a href="${escapeHTML(href)}">${escapeHTML(label)}</a>`
)).join('');

const modeGroupsMarkup = (card) => card.modeGroups.map((group) => (
  '<div class="difficulty-links" aria-label="Choose '
    + escapeHTML(card.title) + ' ' + escapeHTML(group.label) + ' difficulty">'
    + '<span>' + escapeHTML(group.label) + '</span>'
    + difficultyMarkup(group)
    + '</div>'
)).join('');

const recordMarkup = (game, stats) => {
  if (game.id === 'kinnoki-stack') return [
    '<div><dt>Best score</dt><dd>' + escapeHTML(stats.best) + '</dd></div>',
    '<div><dt>Best combo</dt><dd>' + escapeHTML(stats.combo) + '</dd></div>',
    '<div><dt>Finished</dt><dd>' + escapeHTML(stats.completed) + '</dd></div>',
  ].join('');
  if (game.id === 'kinnoki-yard') return [
    '<div><dt>Contract time</dt><dd>' + escapeHTML(stats.best) + '</dd></div>',
    '<div><dt>Contract moves</dt><dd>' + escapeHTML(stats.moves) + '</dd></div>',
    '<div><dt>Endless score</dt><dd>' + escapeHTML(stats.score) + '</dd></div>',
    '<div><dt>Endless combo</dt><dd>' + escapeHTML(stats.combo) + '</dd></div>',
    '<div><dt>Finished</dt><dd>' + escapeHTML(stats.completed) + '</dd></div>',
  ].join('');
  return [
    '<div><dt>Local record</dt><dd>' + escapeHTML(stats.best) + '</dd></div>',
    '<div><dt>Finished</dt><dd>' + escapeHTML(stats.completed) + '</dd></div>',
  ].join('');
};

const cardMarkup = (store, game) => {
  const card = gameCardModel(store, game);
  const stats = statsModel(store).games[game.id];
  return `
    <article class="game-card game-card-${escapeHTML(game.id)}">
      <div class="game-card-topline">
        <p class="game-card-eyebrow">${escapeHTML(card.eyebrow)}</p>
        <span class="game-card-symbol" aria-hidden="true">${escapeHTML(card.symbol)}</span>
      </div>
      <h2>${escapeHTML(card.title)}</h2>
      <p class="game-card-description">${escapeHTML(card.description)}</p>
      ${card.continueHref ? `<a class="btn btn-gold game-continue" href="${escapeHTML(card.continueHref)}">${escapeHTML(card.continueLabel)}</a>` : ''}
      <div class="game-mode-actions">${modeGroupsMarkup(card)}</div>
      <dl class="game-card-stats">${recordMarkup(game, stats)}</dl>
    </article>`;
};

export function renderHubMarkup(store) {
  const stats = statsModel(store);
  return `
    <header class="games-hero">
      <p class="eyebrow">KinNoKi Arcade Hall</p>
      <h1 id="games-heading">A quiet place to play.</h1>
      <p>Five thoughtful games for quick focus or a longer challenge. Choose a difficulty, play at your pace, and come back whenever you like.</p>
    </header>
    <p class="game-storage-notice" role="status" aria-live="polite" hidden>
      Local progress is unavailable in this browser. You can still play, but this visit may not be saved.
    </p>
    <section class="game-card-grid" aria-labelledby="games-heading">
      ${GAMES.map((game) => cardMarkup(store, game)).join('')}
    </section>
    <section class="games-stats" aria-labelledby="local-stats-heading">
      <div>
        <p class="eyebrow">On this device</p>
        <h2 id="local-stats-heading">Your local records</h2>
        <p>${escapeHTML(stats.zeroState)}</p>
      </div>
      <dl class="games-stats-summary">
        <div><dt>${escapeHTML(stats.totalLabel)}</dt><dd>${escapeHTML(stats.total)}</dd></div>
        <div><dt>${escapeHTML(stats.streakLabel)}</dt><dd>${escapeHTML(stats.streak)}</dd></div>
      </dl>
      <button class="btn btn-gray games-reset" type="button" data-reset-games>Reset Game Data</button>
    </section>
    <dialog class="game-dialog" data-reset-dialog aria-labelledby="reset-dialog-title">
      <form method="dialog">
        <p class="eyebrow">Local data</p>
        <h2 id="reset-dialog-title">Reset all game data?</h2>
        <p>This removes unfinished games, totals, streaks, time and moves records, scores, combos, and music and effects preferences from this device.</p>
        <div class="game-dialog-actions">
          <button class="btn btn-gray" type="button" data-dialog-cancel>Keep My Data</button>
          <button class="btn game-danger" type="button" data-dialog-confirm>Reset Everything</button>
        </div>
      </form>
    </dialog>`;
}

export function announce(message, root = globalThis.document) {
  const region = root?.querySelector?.('.games-live-region');
  if (region) region.textContent = message;
}

export function openConfirmationDialog(dialog) {
  if (!dialog?.open) dialog?.showModal?.();
}

export function closeConfirmationDialog(dialog) {
  if (dialog?.open) dialog.close();
}

export function showStorageFailureNotice(root = globalThis.document) {
  const notice = root?.querySelector?.('.game-storage-notice');
  if (notice) notice.hidden = false;
}

export async function renderHub(root, store) {
  root.innerHTML = renderHubMarkup(store);
  const dialog = root.querySelector('[data-reset-dialog]');
  root.querySelector('[data-reset-games]')?.addEventListener('click', () => {
    openConfirmationDialog(dialog);
  });
  root.querySelector('[data-dialog-cancel]')?.addEventListener('click', () => {
    closeConfirmationDialog(dialog);
  });
  root.querySelector('[data-dialog-confirm]')?.addEventListener('click', () => {
    const storage = safeLocalStorage(globalThis);
    const result = resetGameStore(storage);
    if (!result.ok) {
      closeConfirmationDialog(dialog);
      showStorageFailureNotice(root);
      return;
    }

    closeConfirmationDialog(dialog);
    renderHub(root, loadGameStore(storage));
    announce('Game data reset.');
  });
}

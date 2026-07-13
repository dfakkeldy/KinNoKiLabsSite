import { loadGameStore, resetGameStore } from './core.js';

const GAMES = [
  {
    id: 'sudoku',
    title: 'Sudoku',
    eyebrow: 'Logic',
    description: 'Settle into a clean number puzzle with a difficulty that fits the moment.',
    symbol: '9',
  },
  {
    id: 'crossword',
    title: 'Crossword',
    eyebrow: 'Words',
    description: 'Follow thoughtful clues through a compact, themed crossword.',
    symbol: 'A',
  },
  {
    id: 'word-search',
    title: 'Word Search',
    eyebrow: 'Discovery',
    description: 'Scan a calm letter grid for words gathered around a shared theme.',
    symbol: 'W',
  },
];

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const GAME_IDS = GAMES.map(({ id }) => id);

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

const formatTime = (milliseconds) => {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '—';
  const totalSeconds = Math.floor(Math.min(milliseconds, Number.MAX_SAFE_INTEGER) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export function gameCardModel(store, game) {
  if (!GAME_IDS.includes(game?.id)) return null;
  const run = store.runs?.[game.id];
  const difficulty = DIFFICULTIES.includes(run?.difficulty) ? run.difficulty : null;
  const basePath = `/games/${game.id}`;
  return {
    ...game,
    continueHref: difficulty
      ? `${basePath}?difficulty=${difficulty}&continue=1`
      : null,
    continueLabel: difficulty ? `Continue ${titleCase(difficulty)}` : null,
    difficulties: DIFFICULTIES.map((difficulty) => ({
      label: titleCase(difficulty),
      href: `${basePath}?difficulty=${difficulty}`,
    })),
  };
}

export function statsModel(store) {
  const games = Object.fromEntries(GAMES.map((game) => {
    const stats = store.stats?.games?.[game.id] ?? { completed: 0, bestMs: {} };
    const bestTimes = DIFFICULTIES
      .map((difficulty) => stats?.bestMs?.[difficulty])
      .filter((value) => Number.isFinite(value) && value >= 0);
    const completed = nonNegativeInteger(stats?.completed);
    return [game.id, {
      completed: `${completed} completed`,
      best: bestTimes.length ? formatTime(Math.min(...bestTimes)) : '—',
    }];
  }));
  const total = nonNegativeInteger(store.stats?.totalCompleted);
  const streak = nonNegativeInteger(store.stats?.currentStreak);

  return {
    total: String(total),
    totalLabel: total === 1 ? 'Puzzle completed' : 'Puzzles completed',
    streak: String(streak),
    streakLabel: streak === 1 ? 'Day streak' : 'Day streak',
    games,
    zeroState: total === 0
      ? 'Your first puzzle finish will start the record book. Your progress stays on this device.'
      : `${total} ${total === 1 ? 'puzzle' : 'puzzles'} finished on this device.`,
  };
}

const difficultyMarkup = (card) => card.difficulties.map(({ label, href }) => (
  `<a href="${escapeHTML(href)}">${escapeHTML(label)}</a>`
)).join('');

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
      <div class="difficulty-links" aria-label="Choose ${escapeHTML(card.title)} difficulty">
        <span>New puzzle</span>
        ${difficultyMarkup(card)}
      </div>
      <dl class="game-card-stats">
        <div><dt>Local record</dt><dd>${escapeHTML(stats.best)}</dd></div>
        <div><dt>Finished</dt><dd>${escapeHTML(stats.completed)}</dd></div>
      </dl>
    </article>`;
};

export function renderHubMarkup(store) {
  const stats = statsModel(store);
  return `
    <header class="games-hero">
      <p class="eyebrow">KinNoKi Arcade Hall</p>
      <h1 id="games-heading">A quiet place to play.</h1>
      <p>Three familiar puzzles, thoughtfully made. Choose a difficulty, take your time, and come back whenever you like.</p>
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
        <p>This removes unfinished puzzles, completion totals, streaks, and best times from this device.</p>
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

import { openGameStore, saveGameStore } from './core.js';
import { renderGameError } from './controller-common.js';
import { renderHub, safeLocalStorage, showStorageFailureNotice } from './hub-ui.js';
import { validateStackState } from './kinnoki-stack.js';
import { validateYardState } from './kinnoki-yard.js';

const root = document.getElementById('games-app');
const page = document.querySelector('[data-game-page]')?.dataset.gamePage;
const storage = safeLocalStorage(globalThis);

const runValidators = Object.freeze({
  'kinnoki-stack': (run) => (
    validateStackState(run?.puzzle?.play, run?.difficulty).valid
  ),
  'kinnoki-yard': (run) => (
    validateYardState(run?.puzzle?.play, run?.difficulty, run?.mode).valid
  ),
});

async function main() {
  const opened = openGameStore(storage, { runValidators });
  const store = opened.store;
  const saved = saveGameStore(storage, store);
  const controllers = {
    hub: () => renderHub(root, store),
    sudoku: () => import('./sudoku-ui.js')
      .then(({ renderSudoku }) => renderSudoku(root, store)),
    crossword: () => import('./crossword-ui.js')
      .then(({ renderCrossword }) => renderCrossword(root, store)),
    'word-search': () => import('./word-search-ui.js')
      .then(({ renderWordSearch }) => renderWordSearch(root, store)),
    'kinnoki-stack': () => import('./kinnoki-stack-ui.js')
      .then(({ renderKinnokiStack }) => renderKinnokiStack(root, store)),
    'kinnoki-yard': () => import('./kinnoki-yard-ui.js')
      .then(({ renderKinnokiYard }) => renderKinnokiYard(root, store)),
  };
  const controller = controllers[page];
  if (!controller) throw new Error(`Unknown games page: ${page}`);
  const result = await controller();
  if (opened.migration?.state === 'memory-only' || !saved.ok) {
    showStorageFailureNotice(root);
  }
  return result;
}

main().catch(() => {
  renderGameError(root, {
    title: 'Game paused',
    message: 'This game could not start. Reload the page or start a new game.',
    newGameHref: globalThis.location?.pathname ?? '/games',
  });
});

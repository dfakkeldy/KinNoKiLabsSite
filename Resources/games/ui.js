import { loadGameStore, saveGameStore } from './core.js';
import { renderHub, safeLocalStorage, showStorageFailureNotice } from './hub-ui.js';

const root = document.getElementById('games-app');
const page = document.querySelector('[data-game-page]')?.dataset.gamePage;
const storage = safeLocalStorage(globalThis);
const store = loadGameStore(storage);
const storageResult = saveGameStore(storage, store);

const controllers = {
  hub: () => renderHub(root, store),
  sudoku: () => import('./sudoku-ui.js').then(({ renderSudoku }) => renderSudoku(root, store)),
  crossword: () => import('./crossword-ui.js').then(({ renderCrossword }) => renderCrossword(root, store)),
  'word-search': () => import('./word-search-ui.js').then(({ renderWordSearch }) => renderWordSearch(root, store)),
};

controllers[page]?.().then(() => {
  if (!storageResult.ok) showStorageFailureNotice(root);
}).catch(() => {
  root.innerHTML = '<section class="game-error" role="alert"><h1>Puzzle paused</h1><p>This game could not start. Reload the page to try a fresh puzzle.</p></section>';
});

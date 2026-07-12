import {
  completeRun, loadGameStore, markAssisted, saveGameStore, startRun, visibleElapsedMs,
} from './core.js';
import { safeLocalStorage, showStorageFailureNotice } from './hub-ui.js';

export const difficulties = ['easy', 'medium', 'hard'];
export const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);

export function element(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === false || value == null) continue;
    if (name === 'class') node.className = value;
    else if (name === 'text') node.textContent = value;
    else if (name === 'value') node.value = value;
    else if (name in node && ['hidden', 'disabled', 'tabIndex'].includes(name)) node[name] = value;
    else node.setAttribute(name, value === true ? '' : String(value));
  }
  node.append(...children.flat());
  return node;
}

export const formatElapsed = (milliseconds) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const seedValue = (previous) => {
  let seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  if (seed === previous) seed = (seed + 1) >>> 0;
  return seed;
};

export function createSession({ game, store, createPuzzle, createPlay, progressed, onRender }) {
  const storage = safeLocalStorage(globalThis);
  const params = new URLSearchParams(globalThis.location?.search ?? '');
  const requested = params.get('difficulty');
  const difficulty = difficulties.includes(requested) ? requested : 'easy';
  const existing = store.runs?.[game];
  const resume = params.get('continue') === '1' && existing?.difficulty === difficulty;
  let currentStore = store;
  let run;

  const begin = (seed = seedValue(currentStore.previousSeeds?.[game])) => {
    const definition = createPuzzle({ difficulty, seed });
    currentStore = startRun(currentStore, game, difficulty, seed, {
      definition,
      play: createPlay(definition),
    }, Date.now());
    run = currentStore.runs[game];
    save();
  };

  const save = () => {
    const result = saveGameStore(storage, currentStore);
    if (!result.ok) showStorageFailureNotice(document);
    return result;
  };

  if (resume) run = existing;
  else if (existing && progressed(existing.puzzle?.play)
      && globalThis.window?.confirm?.('Start a new puzzle and replace your saved progress?') === false) {
    run = existing;
  } else begin();

  const updatePlay = (play) => {
    run = { ...run, puzzle: { ...run.puzzle, play } };
    currentStore = { ...currentStore, runs: { ...currentStore.runs, [game]: run } };
    save();
  };
  const assist = () => {
    currentStore = markAssisted(currentStore, game);
    run = currentStore.runs[game];
    save();
  };
  const finish = () => {
    const elapsed = visibleElapsedMs(run, Date.now());
    const assisted = run.assisted;
    currentStore = completeRun(currentStore, game, Date.now());
    save();
    return { elapsed, assisted };
  };
  const playAnother = () => {
    begin();
    document.removeEventListener('visibilitychange', visibility);
    onRender(currentStore);
  };

  const visibility = () => {
    if (!currentStore.runs?.[game]) return;
    const now = Date.now();
    if (document.visibilityState === 'hidden') {
      const elapsed = visibleElapsedMs(run, now);
      run = { ...run, elapsedBeforeStartMs: elapsed, startedAt: now };
    } else run = { ...run, startedAt: now };
    currentStore = { ...currentStore, runs: { ...currentStore.runs, [game]: run } };
    save();
  };
  document.addEventListener('visibilitychange', visibility);

  return { difficulty, get run() { return run; }, updatePlay, assist, finish, playAnother };
}

export function sharedShell({ title, difficulty }) {
  const breadcrumb = element('a', { href: '/games', class: 'back-link', text: '← Games' });
  const heading = element('h1', { text: title });
  const select = element('select', { 'data-difficulty': '', 'aria-label': 'Difficulty' },
    ...difficulties.map((value) => element('option', { value, text: titleCase(value) })));
  select.value = difficulty;
  const timer = element('time', { 'data-timer': '', text: '0:00', 'aria-label': 'Elapsed time' });
  const toolbar = element('div', { class: 'game-toolbar' }, breadcrumb, heading,
    element('label', { text: 'Difficulty ' }, select), timer,
    element('button', { type: 'button', 'data-new-game': '', text: 'New Game' }));
  const notice = element('p', { class: 'game-storage-notice', role: 'status', 'aria-live': 'polite', hidden: true,
    text: 'Local progress is unavailable. You can still play.' });
  const live = element('p', { class: 'games-live-region', role: 'status', 'aria-live': 'polite' });
  return { toolbar, select, timer, notice, live };
}

export function completionPanel({ elapsed, assisted, playAnother }) {
  const heading = element('h2', { 'data-complete-heading': '', tabindex: '-1', text: 'Puzzle complete!' });
  const panel = element('section', { class: 'game-complete' }, heading,
    element('p', { text: `${formatElapsed(elapsed)}${assisted ? ' · Assisted' : ''}` }),
    element('button', { type: 'button', 'data-play-another': '', text: 'Play Another' }));
  panel.querySelector('[data-play-another]').addEventListener('click', playAnother);
  return { panel, heading };
}

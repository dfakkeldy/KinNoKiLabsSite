import {
  chooseFreshDefinition, completeRun, deriveSeed, historyKey, markAssisted,
  saveGameStore, startRun,
} from './core.js';
import { safeLocalStorage, showStorageFailureNotice } from './hub-ui.js';

export const difficulties = ['easy', 'medium', 'hard'];
export const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const activeSessions = new WeakMap();

export function puzzleSignature(definition) {
  if (Array.isArray(definition?.answers) && Array.isArray(definition?.cells)) {
    return JSON.stringify({
      answers: definition.answers.map(({ answer, row, column, direction }) => (
        [answer, row, column, direction]
      )),
      grid: definition.cells.map((row) => row.map((cell) => cell?.solution ?? '#')),
    });
  }
  if (Array.isArray(definition?.puzzle) && Array.isArray(definition?.solution)) {
    return JSON.stringify([definition.puzzle, definition.solution]);
  }
  if (Array.isArray(definition?.placements) && Array.isArray(definition?.grid)) {
    return JSON.stringify({
      placements: definition.placements.map(({ word, start, end }) => [word, start, end]),
      grid: definition.grid,
    });
  }
  return JSON.stringify(definition);
}

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
  node.append(...children.flat().filter((child) => child != null));
  return node;
}

export const formatElapsed = (milliseconds) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export function defaultSeedFactory({ previousSeed = null } = {}) {
  const words = new Uint32Array(1);
  try { globalThis.crypto?.getRandomValues?.(words); } catch { words[0] = 0; }
  let seed = ((Date.now() >>> 0) ^ words[0]) >>> 0;
  if (seed === previousSeed) seed = deriveSeed(seed, 0);
  return seed;
}

export function renderGameError(root) {
  root.replaceChildren(element('section', { class: 'game-error', role: 'alert' },
    element('h1', { text: 'Puzzle paused' }),
    element('p', { text: 'This game could not start. Reload the page to try a fresh puzzle.' })));
}

export function renderReplacementKept(root, game, existingDifficulty) {
  root.replaceChildren(element('section', { class: 'game-error', role: 'status' },
    element('h1', { text: 'Saved puzzle kept' }),
    element('p', { text: `${titleCase(existingDifficulty)} puzzle progress was kept on this device.` }),
    element('a', {
      class: 'btn btn-gold',
      href: `/games/${game}?difficulty=${existingDifficulty}&continue=1`,
      text: `Continue ${titleCase(existingDifficulty)}`,
    }),
    element('a', { class: 'back-link', href: '/games', text: 'Back to Games' })));
}

export function createSession(options) {
  const {
    root, game, store, createPuzzle, createPlay, progressed, validateRun, onRender,
    definitionSignature = puzzleSignature,
    seedFactory = defaultSeedFactory,
    wallNow = () => Date.now(),
    monotonicNow = () => globalThis.performance?.now?.() ?? Date.now(),
  } = options;
  activeSessions.get(root)?.dispose();
  const storage = safeLocalStorage(globalThis);
  const params = new URLSearchParams(globalThis.location?.search ?? '');
  const requested = params.get('difficulty');
  const difficulty = difficulties.includes(requested) ? requested : 'easy';
  const existing = store.runs?.[game];
  const existingStructValid = existing
    && validateRun?.(existing.puzzle, existing.difficulty) !== false;
  const existingValid = existing?.difficulty === difficulty
    && existingStructValid;
  const resume = params.get('continue') === '1' && existingValid;
  let currentStore = store;
  let run;
  let cancelled = false;
  let disposed = false;
  let finished = false;
  let paused = false;
  let activeStarted = monotonicNow();
  let completionResult = null;
  let api;
  const cleanups = new Set();

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const cleanup of cleanups) cleanup();
    cleanups.clear();
    if (activeSessions.get(root) === api) activeSessions.delete(root);
  };
  const listen = (target, type, listener) => {
    target.addEventListener(type, listener);
    cleanups.add(() => target.removeEventListener(type, listener));
    return listener;
  };
  const repeat = (callback, milliseconds) => {
    if (disposed) return null;
    const handle = setInterval(callback, milliseconds);
    cleanups.add(() => clearInterval(handle));
    return handle;
  };

  const begin = (requestedSeed) => {
    const key = historyKey(game, 'default');
    const abandonedDefinition = run?.puzzle?.definition ?? existing?.puzzle?.definition;
    const abandonedSignature = abandonedDefinition
      ? definitionSignature(abandonedDefinition) : null;
    const initialSeed = Number.isSafeInteger(requestedSeed) && requestedSeed >= 0
      ? requestedSeed >>> 0
      : seedFactory({
          game,
          mode: 'default',
          previousSeed: currentStore.previousSeeds?.[key] ?? null,
        });
    const selected = chooseFreshDefinition({
      game,
      mode: 'default',
      difficulty,
      initialSeed,
      previousSeed: currentStore.previousSeeds?.[key] ?? null,
      previousSignature: currentStore.previousSignatures?.[key] ?? null,
      abandonedSignature,
      createDefinition: ({ seed }) => createPuzzle({ difficulty, seed }),
      signatureOf: definitionSignature,
    });
    currentStore = startRun(currentStore, {
      game,
      mode: 'default',
      difficulty,
      seed: selected.seed,
      signature: selected.signature,
      puzzle: {
        definition: selected.definition,
        play: createPlay(selected.definition),
      },
      now: wallNow(),
    });
    run = currentStore.runs[game];
    activeStarted = monotonicNow();
    paused = false;
    finished = false;
    save();
  };

  const save = () => {
    const result = saveGameStore(storage, currentStore);
    if (!result.ok) showStorageFailureNotice(document);
    return result;
  };

  if (resume) {
    run = { ...existing, startedAt: wallNow() };
    currentStore = { ...currentStore, runs: { ...currentStore.runs, [game]: run } };
    activeStarted = monotonicNow();
    save();
  }
  else if (existingValid && progressed(existing.puzzle?.play)
      && globalThis.window?.confirm?.('Start a new puzzle and replace your saved progress?') === false) {
    run = { ...existing, startedAt: wallNow() };
    currentStore = { ...currentStore, runs: { ...currentStore.runs, [game]: run } };
    activeStarted = monotonicNow();
    save();
  } else if (existingStructValid && existing.difficulty !== difficulty && progressed(existing.puzzle?.play)
      && globalThis.window?.confirm?.('Start a new puzzle and replace your saved progress?') === false) {
    cancelled = true;
  } else begin();

  const updatePlay = (play) => {
    if (disposed || finished || !run) return;
    run = { ...run, puzzle: { ...run.puzzle, play } };
    currentStore = { ...currentStore, runs: { ...currentStore.runs, [game]: run } };
    save();
  };
  const assist = () => {
    if (disposed || finished || !run) return false;
    currentStore = markAssisted(currentStore, game);
    run = currentStore.runs[game];
    save();
    return true;
  };
  const elapsed = () => {
    if (!run) return completionResult?.elapsed ?? 0;
    const activeDelta = paused ? 0 : Math.max(0, monotonicNow() - activeStarted);
    return Math.max(0, Math.trunc(run.elapsedBeforeStartMs + activeDelta));
  };
  const snapshotElapsed = () => {
    if (!run || finished) return;
    run = { ...run, elapsedBeforeStartMs: elapsed(), startedAt: wallNow() };
    activeStarted = monotonicNow();
    currentStore = { ...currentStore, runs: { ...currentStore.runs, [game]: run } };
    save();
  };
  const finish = () => {
    if (completionResult) return completionResult;
    snapshotElapsed();
    finished = true;
    const elapsedMs = run.elapsedBeforeStartMs;
    const assisted = run.assisted;
    currentStore = completeRun(currentStore, {
      game, mode: 'default', now: wallNow(),
      records: { time: elapsedMs },
    });
    save();
    dispose();
    completionResult = { elapsed: elapsedMs, assisted };
    return completionResult;
  };
  const playAnother = async (seed) => {
    try {
      begin(Number.isInteger(seed) && seed >= 0 ? seed : undefined);
      dispose();
      await onRender(currentStore);
    } catch {
      activeSessions.get(root)?.dispose();
      renderGameError(root);
    }
  };
  const restart = async () => {
    if (!run || finished) return;
    const definition = run.puzzle.definition;
    currentStore = startRun(currentStore, {
      game, mode: 'default',
      difficulty: run.difficulty,
      seed: run.seed,
      signature: run.signature,
      puzzle: { definition, play: createPlay(definition) },
      now: wallNow(),
    });
    run = currentStore.runs[game];
    activeStarted = monotonicNow();
    paused = false;
    save();
    dispose();
    try {
      await onRender(currentStore);
    } catch {
      renderGameError(root);
    }
  };

  const visibility = () => {
    if (!currentStore.runs?.[game] || finished) return;
    if (document.visibilityState === 'hidden') {
      snapshotElapsed();
      paused = true;
    } else {
      run = { ...run, startedAt: wallNow() };
      activeStarted = monotonicNow();
      paused = false;
      currentStore = { ...currentStore, runs: { ...currentStore.runs, [game]: run } };
      save();
    }
  };
  const pagehide = () => {
    snapshotElapsed();
    paused = true;
  };
  const pageshow = () => {
    if (!run || finished) return;
    run = { ...run, startedAt: wallNow() };
    activeStarted = monotonicNow();
    paused = false;
    currentStore = { ...currentStore, runs: { ...currentStore.runs, [game]: run } };
    save();
  };
  if (run) {
    listen(document, 'visibilitychange', visibility);
    listen(globalThis.window, 'pagehide', pagehide);
    listen(globalThis.window, 'pageshow', pageshow);
  }

  api = {
    difficulty, cancelled, existingDifficulty: existing?.difficulty,
    get run() { return run; }, get finished() { return finished; },
    updatePlay, assist, elapsed, finish, playAnother, restart, dispose, listen, repeat,
    addCleanup(cleanup) { cleanups.add(cleanup); },
  };
  activeSessions.set(root, api);
  return api;
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
    element('button', { type: 'button', 'data-restart': '', text: 'Restart' }),
    element('button', { type: 'button', 'data-new-game': '', text: 'New Game' }));
  const notice = element('p', { class: 'game-storage-notice', role: 'status', 'aria-live': 'polite', hidden: true,
    text: 'Local progress is unavailable. You can still play.' });
  const live = element('p', { class: 'games-live-region', role: 'status', 'aria-live': 'polite' });
  const assistedStatus = element('p', {
    class: 'game-assisted-status', 'data-assisted-status': '', role: 'status', 'aria-live': 'polite',
    text: 'Hints and checks make this run ineligible for best-time records.',
  });
  const setAssisted = (assisted, announce = false) => {
    assistedStatus.textContent = assisted
      ? 'Assisted run — ineligible for best-time records.'
      : 'Hints and checks make this run ineligible for best-time records.';
    if (announce && assisted) live.textContent = 'Assisted run. This time is ineligible for best-time records.';
  };
  return { toolbar, select, timer, notice, live, assistedStatus, setAssisted };
}

export function makeGameTerminal(root) {
  root.querySelector('[role="grid"]')?.setAttribute('inert', '');
  for (const selector of ['button', 'input', 'select']) {
    for (const control of root.querySelectorAll(selector)) control.disabled = true;
  }
}

export function completionPanel({ elapsed, assisted, playAnother }) {
  const heading = element('h2', { 'data-complete-heading': '', tabindex: '-1', text: 'Puzzle complete!' });
  const panel = element('section', { class: 'game-complete' }, heading,
    element('p', { text: `${formatElapsed(elapsed)}${assisted ? ' · Assisted' : ''}` }),
    element('button', { type: 'button', 'data-play-another': '', text: 'Play Another' }));
  panel.querySelector('[data-play-another]').addEventListener('click', () => playAnother());
  return { panel, heading };
}

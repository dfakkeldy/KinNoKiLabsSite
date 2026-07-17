import {
  abandonRun, chooseFreshDefinition, completeRun, deriveSeed, historyKey, markAssisted,
  recordsBrokenBy, sanitizeAudioPreferences, saveGameStore, startRun,
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

// Shared thumbnail builder for cargo/piece previews (Kinnoki Stack next-cargo
// pills, Kinnoki Yard tray pieces). `cells` are piece-local {row, column}
// integers (already reflecting whatever rotation the caller wants shown);
// the bounding box and every cell position are derived purely from those
// integers via CSS percentage math (custom properties + calc()), so this
// never reads layout. `rotation` is recorded as metadata (a data attribute)
// for callers that want a rotation-aware hook in CSS or tests; it does not
// re-derive cell coordinates.
export function cargoThumb(cells, { patternClass, rotation = 0 } = {}) {
  const columns = Math.max(...cells.map((cell) => cell.column)) + 1;
  const rows = Math.max(...cells.map((cell) => cell.row)) + 1;
  const thumb = element('div', {
    class: 'cargo-thumb',
    'aria-hidden': 'true',
    'data-rotation': String(((rotation % 4) + 4) % 4),
  });
  thumb.style.setProperty('--cargo-thumb-columns', String(columns));
  thumb.style.setProperty('--cargo-thumb-rows', String(rows));
  thumb.append(...cells.map((cell) => {
    const thumbCell = element('div', {
      class: ['cargo-thumb-cell', patternClass].filter(Boolean).join(' '),
    });
    thumbCell.style.setProperty('--cargo-thumb-cell-column', String(cell.column));
    thumbCell.style.setProperty('--cargo-thumb-cell-row', String(cell.row));
    return thumbCell;
  }));
  return thumb;
}

export const formatElapsed = (milliseconds) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export function prefersReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

export function createConfirmDialog(root, { title, body, confirmLabel = 'Continue', cancelLabel = 'Cancel', onConfirm, onCancel }) {
  const heading = element('h2', { text: title });
  const confirm = element('button', { type: 'button', 'data-dialog-confirm': '', text: confirmLabel });
  const cancel = element('button', { type: 'button', 'data-dialog-cancel': '', text: cancelLabel });
  const dialog = element('dialog', { class: 'game-dialog' }, heading,
    element('p', { text: body }),
    element('div', { class: 'game-dialog-actions' }, cancel, confirm));
  confirm.addEventListener('click', () => { close(); onConfirm?.(); });
  cancel.addEventListener('click', () => { close(); onCancel?.(); });
  function open() { root.append(dialog); dialog.showModal?.(); dialog.setAttribute('open', ''); }
  function close() { dialog.close?.(); dialog.remove(); }
  return { open, close, dialog };
}

export function defaultSeedFactory({ previousSeed = null } = {}) {
  const words = new Uint32Array(1);
  try { globalThis.crypto?.getRandomValues?.(words); } catch { words[0] = 0; }
  let seed = ((Date.now() >>> 0) ^ words[0]) >>> 0;
  if (seed === previousSeed) seed = deriveSeed(seed, 0);
  return seed;
}

export function renderGameError(root, {
  title = 'Game paused',
  message = 'This game could not continue.',
  newGameHref = globalThis.location?.pathname ?? '/games',
} = {}) {
  root.replaceChildren(element('section', { class: 'game-error', role: 'alert' },
    element('h1', { text: title }),
    element('p', { text: message }),
    element('a', {
      class: 'btn btn-gold', href: newGameHref, text: 'Start a New Game',
    }),
    element('a', { class: 'back-link', href: '/games', text: 'Back to Games' })));
}

export function renderReplacementKept(root, game, existingDifficulty, mode = null) {
  const isYard = game === 'kinnoki-yard'
    && (mode === 'contracts' || mode === 'endless');
  const difficulty = titleCase(existingDifficulty);
  const href = isYard
    ? `/games/${game}?mode=${mode}&difficulty=${existingDifficulty}&continue=1`
    : `/games/${game}?difficulty=${existingDifficulty}&continue=1`;
  const label = isYard
    ? `Continue ${mode === 'endless' ? 'Endless Yard' : 'Contract'} · ${difficulty}`
    : `Continue ${difficulty}`;
  root.replaceChildren(element('section', { class: 'game-error', role: 'status' },
    element('h1', { text: 'Saved puzzle kept' }),
    element('p', {
      text: `${difficulty} ${isYard ? 'run' : 'puzzle'} progress was kept on this device.`,
    }),
    element('a', { class: 'btn btn-gold', href, text: label }),
    element('a', { class: 'back-link', href: '/games', text: 'Back to Games' })));
}

const eventAnnouncement = (event) => {
  switch (event?.type) {
    case 'started': return 'Run started.';
    case 'paused': return 'Run paused.';
    case 'resumed': return 'Run resumed.';
    case 'assisted': return 'Assistance enabled. This run is ineligible for records.';
    case 'invalid': return event.reason || 'That action is unavailable.';
    case 'error': return event.message || 'The game could not continue.';
    case 'moved': return `Cargo moved to row ${event.row + 1}, column ${event.column + 1}.`;
    case 'rotated': return 'Cargo rotated.';
    case 'placed': return 'Cargo placed.';
    case 'repositioned': return 'Cargo repositioned.';
    case 'selected': return 'Cargo selected.';
    case 'spawned': return 'Next cargo ready.';
    case 'tide-warning':
      return `${titleCase(event.direction)} tide in ${event.placementsRemaining} placements.`;
    case 'tide-shift':
      return `${titleCase(event.direction)} tide shifted ${event.movedComponents} cargo groups.`;
    case 'dispatch': return `Manifest dispatched. Combo ${event.combo}.`;
    case 'combo-reset': return 'Manifest combo reset.';
    case 'undone': return 'Last placement undone.';
    case 'hint': return 'Hint ready.';
    case 'hint-dead-end': return event.message || 'No valid completion remains.';
    case 'completed': return `Contract completed in ${event.moves} moves.`;
    case 'terminal':
      if (event.reason === 'crane-line') return 'Run ended. Cargo reached the crane line.';
      if (event.reason === 'spawn-blocked') {
        return 'Run ended. The next cargo could not enter the dock.';
      }
      return 'Run ended. No legal cargo placement remains.';
    default: return null;
  }
};

export function createEventAnnouncer({
  region,
  monotonicNow = () => globalThis.performance?.now?.() ?? Date.now(),
  minimumGapMs = 180,
}) {
  let disposed = false;
  let lastLimitedKey = null;
  let lastLimitedAt = Number.NEGATIVE_INFINITY;

  const announce = (event) => {
    if (disposed || !event || (event.type === 'moved' && event.source === 'gravity')) {
      return false;
    }
    const message = eventAnnouncement(event);
    if (!message) return false;
    const limited = event.type === 'moved' || event.type === 'invalid';
    const key = `${event.type}:${event.action ?? event.reason ?? ''}`;
    const now = monotonicNow();
    if (limited && key === lastLimitedKey && now - lastLimitedAt < minimumGapMs) {
      return false;
    }
    if (limited) {
      lastLimitedKey = key;
      lastLimitedAt = now;
    }
    region.textContent = message;
    return true;
  };

  return {
    announce,
    dispose() {
      if (disposed) return false;
      disposed = true;
      lastLimitedKey = null;
      return true;
    },
  };
}

export function createAudioControls({
  document = globalThis.document,
  preferences,
  onChange = () => {},
  channels = ['music', 'effects'],
}) {
  let current = sanitizeAudioPreferences(preferences);
  let disposed = false;
  const element = document.createElement('fieldset');
  element.className = 'game-audio-controls';
  const legend = document.createElement('legend');
  legend.textContent = 'Audio';
  element.append(legend);

  const makeChannel = (name, key) => {
    const row = document.createElement('div');
    row.className = 'game-audio-channel';
    const label = document.createElement('label');
    const labelText = document.createElement('span');
    labelText.textContent = name;
    const range = document.createElement('input');
    range.setAttribute('type', 'range');
    range.setAttribute('min', '0');
    range.setAttribute('max', '1');
    range.setAttribute('step', '0.05');
    range.setAttribute('aria-label', `${name} volume`);
    range.setAttribute(`data-audio-${key}-volume`, '');
    label.append(labelText, range);
    const toggle = document.createElement('button');
    toggle.setAttribute('type', 'button');
    toggle.setAttribute(`data-audio-${key}-toggle`, '');
    row.append(label, toggle);
    element.append(row);
    return { range, toggle };
  };

  const music = channels.includes('music') ? makeChannel('Music', 'music') : null;
  const effects = channels.includes('effects') ? makeChannel('Effects', 'effects') : null;
  const paint = () => {
    if (music) music.range.value = String(current.musicVolume);
    if (effects) effects.range.value = String(current.effectsVolume);
    for (const [control, enabled, name] of [
      [music?.toggle, current.musicEnabled, 'music'],
      [effects?.toggle, current.effectsEnabled, 'effects'],
    ]) {
      if (!control) continue;
      control.setAttribute('aria-pressed', String(!enabled));
      control.textContent = enabled ? `Mute ${name}` : `Unmute ${name}`;
    }
  };
  const commit = (patch) => {
    if (disposed) return false;
    current = sanitizeAudioPreferences({ ...current, ...patch });
    paint();
    onChange({ ...current });
    return true;
  };
  const onMusicToggle = () => commit({ musicEnabled: !current.musicEnabled });
  const onEffectsToggle = () => commit({ effectsEnabled: !current.effectsEnabled });
  const onMusicInput = () => commit({ musicVolume: Number(music.range.value) });
  const onEffectsInput = () => commit({ effectsVolume: Number(effects.range.value) });
  music?.toggle.addEventListener('click', onMusicToggle);
  effects?.toggle.addEventListener('click', onEffectsToggle);
  music?.range.addEventListener('input', onMusicInput);
  effects?.range.addEventListener('input', onEffectsInput);
  paint();

  return {
    element,
    setPreferences(value) {
      if (disposed) return false;
      current = sanitizeAudioPreferences(value);
      paint();
      return true;
    },
    dispose() {
      if (disposed) return false;
      disposed = true;
      music?.toggle.removeEventListener('click', onMusicToggle);
      effects?.toggle.removeEventListener('click', onEffectsToggle);
      music?.range.removeEventListener('input', onMusicInput);
      effects?.range.removeEventListener('input', onEffectsInput);
      return true;
    },
  };
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
  else if (existingValid && progressed(existing.puzzle?.play)) {
    // Non-destructive default: resume the saved run immediately, exactly like a
    // declined confirmation used to. A dialog then offers the destructive
    // alternative (starting fresh) asynchronously, since a <dialog> — unlike a
    // blocking native confirm — cannot pause this constructor for an answer.
    run = { ...existing, startedAt: wallNow() };
    currentStore = { ...currentStore, runs: { ...currentStore.runs, [game]: run } };
    activeStarted = monotonicNow();
    save();
    const startFresh = () => { void api.playAnother(); };
    const resumeExisting = () => {};
    Promise.resolve().then(() => {
      if (disposed) return;
      const confirmDialog = createConfirmDialog(root, {
        title: 'Replace saved progress?',
        body: 'Start a new puzzle and replace your saved progress?',
        confirmLabel: 'Start new',
        cancelLabel: 'Keep playing',
        onConfirm: startFresh,
        onCancel: resumeExisting,
      });
      cleanups.add(confirmDialog.close);
      confirmDialog.open();
    });
  } else if (existingStructValid && existing.difficulty !== difficulty && progressed(existing.puzzle?.play)) {
    // Non-destructive default: keep the saved run and let the controller render
    // its "Saved puzzle kept" screen synchronously, exactly like a declined
    // confirm used to. The dialog then offers the destructive alternative.
    cancelled = true;
    Promise.resolve().then(() => {
      if (disposed) return;
      const confirmDialog = createConfirmDialog(root, {
        title: 'Replace saved progress?',
        body: `You have a ${titleCase(existing.difficulty)} puzzle in progress. Start ${titleCase(difficulty)} and replace it?`,
        confirmLabel: 'Start new',
        cancelLabel: 'Keep saved puzzle',
        onConfirm: () => {
          currentStore = abandonRun(currentStore, { game });
          save();
          Promise.resolve().then(() => onRender(currentStore)).catch(() => {
            activeSessions.get(root)?.dispose();
            renderGameError(root, {
              title: 'Puzzle paused',
              message: 'This game could not start. Reload the page to try a fresh puzzle.',
            });
          });
        },
        onCancel: () => {},
      });
      cleanups.add(confirmDialog.close);
      confirmDialog.open();
    });
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
  // Persist a shared audio-preference change (mirrors Stack/Yard's
  // persistence.setAudio). Guards only on disposal, like the other mutators;
  // finish() disposes the session and makeGameTerminal disables the audio
  // controls anyway, so no post-completion writes can occur. The cancelled
  // path ("Saved puzzle kept" screen) never mounts audio controls, so it
  // needs no special handling.
  const setAudio = (preferences) => {
    if (disposed) return false;
    currentStore = { ...currentStore, audio: sanitizeAudioPreferences(preferences) };
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
    const request = { game, mode: 'default', now: wallNow(), records: { time: elapsedMs } };
    const recordsBroken = recordsBrokenBy(currentStore, request);
    currentStore = completeRun(currentStore, request);
    save();
    dispose();
    completionResult = { elapsed: elapsedMs, assisted, recordsBroken };
    return completionResult;
  };
  const playAnother = async (seed) => {
    try {
      begin(Number.isInteger(seed) && seed >= 0 ? seed : undefined);
      dispose();
      await onRender(currentStore);
    } catch {
      activeSessions.get(root)?.dispose();
      renderGameError(root, {
        title: 'Puzzle paused',
        message: 'This game could not start. Reload the page to try a fresh puzzle.',
      });
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
      renderGameError(root, {
        title: 'Puzzle paused',
        message: 'This game could not start. Reload the page to try a fresh puzzle.',
      });
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
    updatePlay, assist, setAudio, elapsed, finish, playAnother, restart, dispose, listen, repeat,
    addCleanup(cleanup) { cleanups.add(cleanup); },
  };
  activeSessions.set(root, api);
  return api;
}

export function createGameLifecycle({
  root,
  initialElapsedMs = 0,
  monotonicNow = () => globalThis.performance?.now?.() ?? Date.now(),
  onActivate = () => {},
  onPause = () => {},
  onSnapshot = () => {},
  onError = () => {},
  onDispose = () => {},
}) {
  const previous = activeSessions.get(root);
  previous?.dispose();
  const reentrantOwner = activeSessions.get(root);
  if (reentrantOwner && reentrantOwner !== previous) return reentrantOwner;

  const document = root.ownerDocument ?? globalThis.document;
  const window = document?.defaultView ?? globalThis.window;
  const passiveCleanups = new Set();
  const activeCleanups = new Set();
  let currentState = 'preview';
  let elapsedBeforeActivation = Math.max(0, Math.trunc(initialElapsedMs));
  let activatedAt = null;
  let disposed = false;
  let didDisposeCallback = false;
  let didReportError = false;
  let api;

  const elapsed = () => {
    const activeDelta = currentState === 'active' && activatedAt !== null
      ? Math.max(0, monotonicNow() - activatedAt)
      : 0;
    return Math.max(0, Math.trunc(elapsedBeforeActivation + activeDelta));
  };

  const clear = (cleanups) => {
    const pending = [...cleanups];
    cleanups.clear();
    for (const cleanup of pending.reverse()) cleanup();
  };
  const clearActive = () => clear(activeCleanups);

  const listenActive = (target, type, listener, options) => {
    if (currentState !== 'active' || disposed) return null;
    target.addEventListener(type, listener, options);
    const cleanup = () => target.removeEventListener(type, listener, options);
    activeCleanups.add(cleanup);
    return listener;
  };

  const requestActiveFrame = (callback) => {
    if (currentState !== 'active' || disposed) return null;
    let cleanup;
    const handle = globalThis.requestAnimationFrame((timestamp) => {
      activeCleanups.delete(cleanup);
      if (currentState === 'active' && !disposed) callback(timestamp);
    });
    cleanup = () => globalThis.cancelAnimationFrame(handle);
    activeCleanups.add(cleanup);
    return handle;
  };

  const captureActiveElapsed = () => {
    if (currentState !== 'active' || activatedAt === null) return false;
    elapsedBeforeActivation = elapsed();
    activatedAt = null;
    return true;
  };

  const reportError = (error) => {
    if (didReportError) return;
    didReportError = true;
    try { onError(error, api); } catch { /* Error reporting must fail closed. */ }
  };

  const failFromCallback = (error) => {
    if (disposed || currentState === 'terminal' || currentState === 'error') return false;
    captureActiveElapsed();
    clearActive();
    currentState = 'error';
    reportError(error);
    return true;
  };

  const notifySnapshot = () => {
    try {
      onSnapshot(elapsedBeforeActivation);
      return null;
    } catch (error) {
      return error;
    }
  };

  const pause = (reason = 'user') => {
    if (currentState !== 'active' || disposed) return false;
    captureActiveElapsed();
    clearActive();
    currentState = 'paused';
    const snapshotError = notifySnapshot();
    if (snapshotError) failFromCallback(snapshotError);
    if (currentState === 'paused') {
      try { onPause(reason, api); } catch (error) { failFromCallback(error); }
    }
    return true;
  };

  const installActiveLifecycleListeners = () => {
    listenActive(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') pause('hidden');
    });
    listenActive(window, 'pagehide', () => pause('hidden'));
  };

  const start = async (kind) => {
    const valid = (currentState === 'preview' && (kind === 'start' || kind === 'continue'))
      || (currentState === 'paused' && kind === 'resume');
    if (!valid || disposed) return false;
    currentState = 'active';
    activatedAt = monotonicNow();
    installActiveLifecycleListeners();
    try { await onActivate(kind, api); } catch (error) { failFromCallback(error); }
    return currentState === 'active';
  };

  const settle = (nextState) => {
    if (disposed || currentState === 'terminal' || currentState === 'error') return false;
    const didSnapshot = captureActiveElapsed();
    clearActive();
    currentState = nextState;
    const snapshotError = didSnapshot ? notifySnapshot() : null;
    if (snapshotError && nextState === 'terminal') reportError(snapshotError);
    return true;
  };

  const finish = () => settle('terminal');
  const fail = (error) => {
    if (!settle('error')) return false;
    reportError(error);
    return true;
  };

  const dispose = () => {
    if (disposed) return false;
    disposed = true;
    currentState = 'disposed';
    clearActive();
    clear(passiveCleanups);
    if (!didDisposeCallback) {
      didDisposeCallback = true;
      try { onDispose(api); } catch { /* Disposal must fail closed. */ }
    }
    return true;
  };

  api = {
    get state() { return currentState; },
    elapsed,
    start,
    pause,
    finish,
    fail,
    dispose,
    listenActive,
    requestActiveFrame,
  };
  passiveCleanups.add(() => {
    if (activeSessions.get(root) === api) activeSessions.delete(root);
  });
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

const RECORD_LABELS = {
  time: 'New best time!',
  moves: 'Fewest moves!',
  score: 'New best score!',
  combo: 'Best combo!',
};

export function completionPanel({ elapsed, assisted, recordsBroken = [], playAnother }) {
  const heading = element('h2', { 'data-complete-heading': '', tabindex: '-1', text: 'Puzzle complete!' });
  const recordLine = recordsBroken.length
    ? element('p', {
        class: 'game-complete-record',
        text: recordsBroken.map((key) => RECORD_LABELS[key] ?? key).join(' · '),
      })
    : null;
  const panel = element('section', { class: 'game-complete' }, heading, recordLine,
    element('p', { text: `${formatElapsed(elapsed)}${assisted ? ' · Assisted' : ''}` }),
    element('button', { type: 'button', 'data-play-another': '', text: 'Play Another' }));
  panel.querySelector('[data-play-another]').addEventListener('click', () => playAnother());
  return { panel, heading };
}

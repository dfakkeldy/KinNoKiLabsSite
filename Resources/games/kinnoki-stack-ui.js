import {
  abandonRun, chooseFreshDefinition, completeRun, historyKey,
  markAssisted, saveGameStore, startRun,
} from './core.js';
import {
  CARGO_CATALOG, placedCells, rotationsFor,
} from './cargo-geometry.js';
import {
  advanceStackTime, createStackDefinition, createStackState, describeStack,
  prepareStackForContinue, reduceStack, stackCompletionPayload,
  stackDefinitionSignature, validateStackState,
} from './kinnoki-stack.js';
import { createGameAudio } from './game-audio.js';
import {
  createAudioControls, createEventAnnouncer, createGameLifecycle,
  defaultSeedFactory, element, formatElapsed, makeGameTerminal,
  renderGameError,
} from './controller-common.js';
import { safeLocalStorage } from './hub-ui.js';

const GAME = 'kinnoki-stack';
const MODE = 'default';
const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
const DIFFICULTY_COPY = Object.freeze({
  easy: 'Easy: slower, three previews, large manifests, no tides.',
  medium: 'Medium: moderate, two previews, mixed manifests and forecast tides.',
  hard: 'Hard: faster, one preview, irregular manifests and frequent tides.',
});
const CARGO_BY_ID = new Map(CARGO_CATALOG.map((cargo) => [cargo.id, cargo]));

export const defaultStackEngine = Object.freeze({
  advanceStackTime,
  createStackDefinition,
  createStackState,
  describeStack,
  prepareStackForContinue,
  reduceStack,
  stackCompletionPayload,
  stackDefinitionSignature,
  validateStackState,
});

const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const cellKey = (row, column) => row + ':' + column;
const cargoFor = (typeId) => CARGO_BY_ID.get(typeId) ?? {
  id: 'unknown', label: 'Unknown cargo', pattern: 'solid',
};

function buildStackShell(root, difficulty, audioControls) {
  const difficultySelect = element(
    'select',
    { 'data-difficulty': '', 'aria-label': 'Difficulty' },
    DIFFICULTIES.map((value) => element('option', {
      value, text: titleCase(value),
    })),
  );
  difficultySelect.value = difficulty;

  const timer = element('time', {
    'data-timer': '', 'aria-label': 'Elapsed active time', text: '0:00',
  });
  const score = element('span', { 'data-stack-score': '', text: '0' });
  const highScore = element('span', { 'data-stack-high-score': '', text: '—' });
  const assisted = element('span', {
    'data-assisted-status': '', text: 'Unassisted · eligible for records',
  });
  const manifest = element('span', { 'data-stack-manifest': '', text: 'Preparing manifest' });
  const tide = element('span', { 'data-stack-tide': '', text: 'No tides' });
  const status = element('span', { 'data-stack-status': '', text: 'Ready' });
  const notice = element('p', {
    class: 'game-storage-notice', role: 'status', 'aria-live': 'polite',
    hidden: true, text: '',
  });
  const eventRegion = element('p', {
    class: 'games-live-region', role: 'status', 'aria-live': 'polite', text: '',
  });

  const stat = (label, value) => element(
    'div', {}, element('dt', { text: label }), element('dd', {}, value),
  );
  const stats = element(
    'dl',
    { class: 'game-status-grid' },
    stat('Status', status),
    stat('Elapsed', timer),
    stat('Score', score),
    stat('High score', highScore),
    stat('Record status', assisted),
    stat('Cargo Manifest', manifest),
    stat('Tide forecast', tide),
  );

  const preview = element('ol', {
    class: 'stack-preview', 'data-stack-preview': '', 'aria-label': 'Next cargo',
  });
  const dockDescription = element('p', {
    'data-dock-description': '', role: 'status', text: '',
  });
  const difficultyExplanation = element('p', {
    'data-difficulty-explanation': '', text: DIFFICULTY_COPY[difficulty],
  });
  const keyboardHelp = element(
    'details',
    { 'data-stack-keyboard-help': '' },
    element('summary', { text: 'Keyboard controls' }),
    element('p', {
      text: 'Left/Right arrows move. Down soft-drops. Space hard-drops. '
        + 'Z or Up rotates. P or Escape pauses. Enter advances in Step Mode.',
    }),
  );

  const cells = [];
  const grid = element('div', {
    class: 'stack-grid', role: 'grid', 'aria-label': 'Kinnoki Stack cargo dock',
  });
  for (let row = 0; row < 18; row += 1) {
    const rowNode = element('div', { class: 'stack-row', role: 'row' });
    const rowCells = [];
    for (let column = 0; column < 12; column += 1) {
      const cell = element('div', {
        class: 'stack-cell',
        role: 'gridcell',
        tabindex: '-1',
        'data-stack-cell': cellKey(row, column),
        'aria-label': 'Empty dock cell',
      });
      rowCells.push(cell);
      rowNode.append(cell);
    }
    cells.push(rowCells);
    grid.append(rowNode);
  }
  const dock = element(
    'div',
    { class: 'stack-dock' },
    grid,
    element('div', {
      class: 'stack-crane-line', 'aria-hidden': 'true', text: 'Crane line',
    }),
  );

  const control = (label, dataAttribute) => element('button', {
    type: 'button', [dataAttribute]: '', text: label, disabled: true,
  });
  const controls = {
    left: control('Left', 'data-stack-left'),
    right: control('Right', 'data-stack-right'),
    rotate: control('Rotate', 'data-stack-rotate'),
    softDrop: control('Soft Drop', 'data-stack-soft-drop'),
    hardDrop: control('Hard Drop', 'data-stack-hard-drop'),
    pause: control('Pause', 'data-pause-game'),
    describe: control('Describe Dock', 'data-describe-dock'),
    stepMode: control('Step Mode', 'data-step-mode'),
    advance: control('Advance', 'data-advance-step'),
  };
  controls.advance.hidden = true;
  controls.describe.disabled = false;

  const start = element('button', {
    type: 'button', 'data-start-game': '', text: 'Start',
  });
  const continueGame = element('button', {
    type: 'button', 'data-continue-game': '', text: 'Continue Run', hidden: true,
  });
  const resume = element('button', {
    type: 'button', 'data-resume-game': '', text: 'Resume', hidden: true,
  });
  const restart = element('button', {
    type: 'button', 'data-restart': '', text: 'Restart',
  });
  const newRun = element('button', {
    type: 'button', 'data-new-run': '', text: 'New Run',
  });

  const shell = element(
    'section',
    { class: 'stack-game' },
    element(
      'div',
      { class: 'game-toolbar' },
      element('a', { href: '/games', class: 'back-link', text: '← Games' }),
      element('h1', { text: 'Kinnoki Stack' }),
      element('label', {}, element('span', { text: 'Difficulty' }), difficultySelect),
    ),
    notice,
    eventRegion,
    difficultyExplanation,
    stats,
    element(
      'div',
      { class: 'game-preplay' },
      start, continueGame, resume, restart, newRun,
    ),
    element('section', { 'aria-label': 'Next cargo' },
      element('h2', { text: 'Next cargo' }), preview),
    keyboardHelp,
    dock,
    element('div', { class: 'stack-controls' }, Object.values(controls)),
    dockDescription,
    audioControls.element,
  );
  root.replaceChildren(shell);

  return {
    shell, difficultySelect, timer, score, highScore, assisted, manifest,
    tide, status, notice, eventRegion, difficultyExplanation, preview,
    dockDescription, cells, controls, start, continueGame, resume, restart, newRun,
  };
}

const stackBestScore = (store, difficulty) => (
  store.stats?.games?.[GAME]?.modes?.default?.records?.score?.[difficulty] ?? null
);

const activeCells = (state) => {
  if (!state.active) return new Map();
  const rotation = rotationsFor(state.active.typeId)
    .find((candidate) => candidate.rotation === state.active.rotation);
  if (!rotation) return new Map();
  return new Map(placedCells(rotation.cells, {
    row: state.active.row, column: state.active.column,
  }).map((cell) => [cellKey(cell.row, cell.column), state.active]));
};

const manifestCellKeys = (state) => new Set(
  state.manifests.flatMap((item) => item.cells.map(
    (cell) => cellKey(cell.row, cell.column),
  )),
);

function paintStack(view, state, {
  store, elapsedMs, entryKind,
}) {
  const difficulty = state.definition.difficulty;
  view.difficultySelect.value = difficulty;
  view.difficultyExplanation.textContent = DIFFICULTY_COPY[difficulty];
  view.timer.textContent = formatElapsed(elapsedMs);
  view.score.textContent = state.score.toLocaleString('en-CA');
  const best = stackBestScore(store, difficulty);
  view.highScore.textContent = Number.isSafeInteger(best)
    ? best.toLocaleString('en-CA') : '—';
  view.assisted.textContent = state.assisted
    ? 'Assisted run · records excluded'
    : 'Unassisted · eligible for records';
  view.status.textContent = titleCase(state.status);

  const completedCells = state.manifests.reduce((total, item) => (
    total + item.cells.filter(({ row, column }) => state.board[row][column] !== null).length
  ), 0);
  const requiredCells = state.manifests.reduce(
    (total, item) => total + item.cells.length, 0,
  );
  view.manifest.textContent = state.manifests.length
    + ' active · ' + completedCells + '/' + requiredCells + ' cells filled';
  view.tide.textContent = state.tide.direction === null
    ? 'No tides'
    : titleCase(state.tide.direction) + ' in '
      + state.tide.placementsRemaining + ' placements';

  const active = activeCells(state);
  const manifestTargets = manifestCellKeys(state);
  for (let row = 0; row < state.height; row += 1) {
    for (let column = 0; column < state.width; column += 1) {
      const node = view.cells[row][column];
      const key = cellKey(row, column);
      const moving = active.get(key);
      const settled = state.board[row][column];
      const cargo = moving ?? settled;
      node.className = 'stack-cell';
      node.removeAttribute('data-pattern');
      if (manifestTargets.has(key)) node.classList.add('stack-manifest-cell');
      if (cargo) {
        const definition = cargoFor(cargo.typeId);
        const phase = moving ? 'active' : 'settled';
        node.classList.add('stack-cargo-' + phase);
        node.classList.add('cargo-pattern-' + definition.pattern);
        node.setAttribute('data-pattern', definition.pattern);
        node.setAttribute(
          'aria-label',
          definition.label + ', ' + phase + ', row ' + (row + 1)
            + ', column ' + (column + 1) + ', ' + definition.pattern + ' pattern'
            + (manifestTargets.has(key) ? ', Cargo Manifest target' : ''),
        );
        node.textContent = '■';
      } else {
        node.setAttribute(
          'aria-label',
          'Empty dock cell, row ' + (row + 1) + ', column ' + (column + 1)
            + (manifestTargets.has(key) ? ', Cargo Manifest target' : ''),
        );
        node.textContent = '';
      }
    }
  }

  view.preview.replaceChildren(...state.preview.map((piece) => {
    const cargo = cargoFor(piece.typeId);
    return element('li', {
      'data-next-cargo': '',
      class: 'cargo-pattern-' + cargo.pattern,
      text: cargo.label + ' · ' + cargo.pattern + ' pattern',
    });
  }));

  const isActive = state.status === 'active';
  for (const control of Object.values(view.controls)) control.disabled = !isActive;
  view.controls.describe.disabled = false;
  view.controls.advance.hidden = !state.stepMode;
  view.controls.advance.disabled = !isActive || !state.stepMode;
  view.controls.stepMode.setAttribute('aria-pressed', String(state.stepMode));
  view.start.hidden = entryKind !== 'start';
  view.continueGame.hidden = entryKind !== 'continue';
  view.resume.hidden = entryKind !== 'resume';
}

class StackPersistence {
  constructor({ storage, store, wallNow }) {
    this.storage = storage;
    this.value = store;
    this.wallNow = wallNow;
    this.notice = null;
    this.pendingFailure = null;
    this.didNotice = false;
  }

  get store() { return this.value; }

  attachNotice(notice) {
    this.notice = notice;
    if (this.pendingFailure && !this.didNotice) this.report(this.pendingFailure);
  }

  report(error) {
    this.pendingFailure = error;
    if (this.didNotice || !this.notice) return;
    this.didNotice = true;
    this.notice('Progress could not be saved. This run can continue in memory.');
  }

  write() {
    const result = saveGameStore(this.storage, this.value);
    if (!result.ok) this.report(result.error);
    return result.ok;
  }

  start({ difficulty, seed, signature, definition, state }) {
    this.value = startRun(this.value, {
      game: GAME,
      mode: MODE,
      difficulty,
      seed,
      signature,
      puzzle: { definition, play: state },
      now: this.wallNow(),
    });
    this.write();
  }

  savePlay(state, elapsedMs = null) {
    let next = this.value;
    const existing = next.runs[GAME];
    if (!existing) return;
    if (state.assisted && !existing.assisted) next = markAssisted(next, GAME);
    const run = next.runs[GAME];
    const elapsed = elapsedMs === null
      ? run.elapsedBeforeStartMs
      : Math.max(0, Math.floor(elapsedMs));
    this.value = {
      ...next,
      runs: {
        ...next.runs,
        [GAME]: {
          ...run,
          puzzle: { definition: run.puzzle.definition, play: state },
          ...(elapsedMs === null ? {} : {
            startedAt: this.wallNow(),
            elapsedBeforeStartMs: elapsed,
          }),
        },
      },
    };
    this.write();
  }

  normalizeAssistance(state) {
    const run = this.value.runs[GAME];
    if (run && state.assisted && !run.assisted) {
      this.value = markAssisted(this.value, GAME);
      this.write();
    }
  }

  abandon(expectedSignature) {
    this.value = abandonRun(this.value, {
      game: GAME, expectedSignature,
    });
    this.write();
  }

  complete(records, state) {
    const run = this.value.runs[GAME];
    if (!run || run.assisted !== state.assisted) {
      throw new Error('Stack assistance state is inconsistent at completion.');
    }
    this.value = completeRun(this.value, {
      game: GAME, mode: MODE, now: this.wallNow(), records,
    });
    this.write();
  }

  setAudio(preferences) {
    this.value = { ...this.value, audio: preferences };
    this.write();
  }
}

const SILENT_AUDIO = Object.freeze({
  start: async () => {},
  resume: async () => {},
  pause: async () => {},
  stop: async () => {},
  finish: () => {},
  dispose: async () => {},
  setPreferences: () => {},
  setIntensity: () => {},
  playEffect: () => {},
});

class LazyStackAudio {
  constructor({ audioFactory, preferences, monotonicNow, onNotice }) {
    this.audioFactory = audioFactory;
    this.preferences = preferences;
    this.monotonicNow = monotonicNow;
    this.onNotice = onNotice;
    this.audio = null;
  }

  ensure() {
    if (this.audio) return this.audio;
    try {
      this.audio = this.audioFactory({
        audioContextFactory: () => {
          const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
          if (!Context) throw new Error('Web Audio is unavailable');
          return new Context();
        },
        preferences: this.preferences,
        onNotice: this.onNotice,
        monotonicNow: this.monotonicNow,
        setIntervalFn: (...args) => globalThis.setInterval(...args),
        clearIntervalFn: (handle) => globalThis.clearInterval(handle),
        setTimeoutFn: (...args) => globalThis.setTimeout(...args),
        clearTimeoutFn: (handle) => globalThis.clearTimeout(handle),
      });
    } catch {
      this.onNotice('Audio is unavailable; play continues in silence.');
      this.audio = SILENT_AUDIO;
    }
    return this.audio;
  }

  async start() {
    await this.ensure().start({ arrangement: 'stack' });
  }

  async resume() {
    if (!this.audio) return this.start();
    await this.audio.resume();
  }

  pause() { return this.audio?.pause(); }
  finish() { this.audio?.finish({ outcome: 'terminal' }); }
  dispose() { return this.audio?.dispose(); }
  playEffect(name) { this.audio?.playEffect(name); }
  setIntensity(value) { this.audio?.setIntensity(value); }

  setPreferences(preferences) {
    this.preferences = preferences;
    this.audio?.setPreferences(preferences);
  }
}

const effectForEvent = (event) => {
  if (event.type === 'moved' && event.source !== 'gravity') return 'move';
  if (event.type === 'rotated') return 'rotate';
  if (event.type === 'placed') return 'placement';
  if (event.type === 'dispatch') return 'dispatch';
  if (event.type === 'tide-warning') return 'tide-warning';
  if (event.type === 'tide-shift') return 'tide-shift';
  if (event.type === 'invalid') return 'invalid';
  return null;
};

const stackIntensity = (state) => {
  const firstOccupiedRow = state.board.findIndex((row) => row.some(Boolean));
  const height = firstOccupiedRow < 0 ? 0 : (state.height - firstOccupiedRow) / state.height;
  const tidePressure = state.tide.placementsRemaining === null
    ? 0 : 1 - Math.min(1, state.tide.placementsRemaining / 8);
  return { height, tidePressure };
};

function validStoredStackRun(run, engine) {
  if (run?.game !== GAME || run.mode !== MODE
      || !DIFFICULTIES.includes(run.difficulty)
      || run.puzzle?.definition == null || run.puzzle?.play == null) return false;
  try {
    if (engine.stackDefinitionSignature(run.puzzle.definition) !== run.signature
        || run.seed !== run.puzzle.definition.seed
        || run.difficulty !== run.puzzle.definition.difficulty
        || (run.assisted === true && run.puzzle.play.assisted !== true)
        || engine.stackDefinitionSignature(run.puzzle.play.definition) !== run.signature) {
      return false;
    }
    return engine.validateStackState(run.puzzle.play, run.difficulty).valid;
  } catch { return false; }
}

function freshStackModel({
  store, difficulty, seedFactory, engine, abandonedSignature = null,
}) {
  const key = historyKey(GAME, MODE);
  const previousSeed = store.previousSeeds[key] ?? null;
  const previousSignature = store.previousSignatures[key] ?? null;
  const initialSeed = seedFactory({
    game: GAME, mode: MODE, previousSeed,
  });
  const selected = chooseFreshDefinition({
    game: GAME,
    mode: MODE,
    difficulty,
    initialSeed,
    previousSeed,
    previousSignature,
    abandonedSignature,
    createDefinition: engine.createStackDefinition,
    signatureOf: engine.stackDefinitionSignature,
  });
  return {
    definition: selected.definition,
    state: engine.createStackState(selected.definition),
    difficulty,
    seed: selected.seed,
    signature: selected.signature,
    entryKind: 'start',
    initialElapsedMs: 0,
  };
}

function selectStackModel({
  store, difficulty, seedFactory, engine,
  abandonedSignature = null, previewDefinition = null,
}) {
  if (previewDefinition) {
    return {
      definition: previewDefinition,
      state: engine.createStackState(previewDefinition),
      difficulty: previewDefinition.difficulty,
      seed: previewDefinition.seed,
      signature: engine.stackDefinitionSignature(previewDefinition),
      entryKind: 'start',
      initialElapsedMs: 0,
    };
  }

  const run = store.runs[GAME];
  if (run) {
    if (!validStoredStackRun(run, engine)) {
      throw new Error('Saved Kinnoki Stack state is invalid.');
    }
    return {
      definition: run.puzzle.definition,
      state: engine.prepareStackForContinue(run.puzzle.play),
      difficulty: run.difficulty,
      seed: run.seed,
      signature: run.signature,
      entryKind: 'continue',
      initialElapsedMs: run.elapsedBeforeStartMs,
    };
  }

  return freshStackModel({
    store, difficulty, seedFactory, engine, abandonedSignature,
  });
}

class StackController {
  constructor({
    root, model, persistence, dependencies, slot,
  }) {
    this.root = root;
    this.document = root.ownerDocument ?? globalThis.document;
    this.model = model;
    this.state = model.state;
    this.definition = model.definition;
    this.difficulty = model.difficulty;
    this.seed = model.seed;
    this.signature = model.signature;
    this.entryKind = model.entryKind;
    this.persistence = persistence;
    this.dependencies = dependencies;
    this.engine = dependencies.engine;
    this.slot = slot;
    this.passiveCleanups = new Set();
    this.activeApi = null;
    this.lastFrameTime = null;
    this.finished = false;
    this.errorRendered = false;
    this.disposed = false;

    this.audioControls = createAudioControls({
      document: this.document,
      preferences: persistence.store.audio,
      onChange: (preferences) => {
        this.persistence.setAudio(preferences);
        this.audio.setPreferences(preferences);
      },
    });
    this.view = buildStackShell(root, this.difficulty, this.audioControls);
    this.persistence.attachNotice((message) => this.showNotice(message));
    this.announcer = createEventAnnouncer({
      region: this.view.eventRegion,
      monotonicNow: dependencies.monotonicNow,
      minimumGapMs: 180,
    });
    this.audio = new LazyStackAudio({
      audioFactory: dependencies.audioFactory,
      preferences: persistence.store.audio,
      monotonicNow: dependencies.monotonicNow,
      onNotice: (message) => this.showNotice(message),
    });
    this.lifecycle = createGameLifecycle({
      root,
      initialElapsedMs: model.initialElapsedMs,
      monotonicNow: dependencies.monotonicNow,
      onActivate: (kind, api) => this.activate(kind, api),
      onPause: (reason) => this.handlePause(reason),
      onSnapshot: () => this.snapshot(),
      onError: (error) => this.renderError(error),
      onDispose: () => this.cleanup(),
    });

    this.installPassiveHandlers();
    this.paint();
  }

  showNotice(message) {
    this.view.notice.hidden = false;
    this.view.notice.textContent = message;
  }

  paint() {
    paintStack(this.view, this.state, {
      store: this.persistence.store,
      elapsedMs: this.lifecycle.elapsed(),
      entryKind: this.entryKind,
    });
  }
}

StackController.prototype.listenPassive = function listenPassive(target, type, listener) {
  target.addEventListener(type, listener);
  const cleanup = () => target.removeEventListener(type, listener);
  this.passiveCleanups.add(cleanup);
  return cleanup;
};

StackController.prototype.installPassiveHandlers = function installPassiveHandlers() {
  this.listenPassive(this.view.start, 'click', () => { void this.start('start'); });
  this.listenPassive(this.view.continueGame, 'click', () => {
    void this.start('continue');
  });
  this.listenPassive(this.view.resume, 'click', () => { void this.start('resume'); });
  this.listenPassive(this.view.controls.describe, 'click', () => {
    this.view.dockDescription.textContent = this.engine.describeStack(this.state);
    this.view.controls.describe.focus();
  });
  this.listenPassive(this.view.restart, 'click', () => { void this.restart(); });
  this.listenPassive(this.view.newRun, 'click', () => {
    void this.replaceWithDifficulty(this.difficulty);
  });
  this.listenPassive(this.view.difficultySelect, 'change', () => {
    void this.replaceWithDifficulty(this.view.difficultySelect.value);
  });
};

StackController.prototype.start = async function start(kind) {
  if (this.disposed || this.finished || kind !== this.entryKind) return false;
  try {
    return await this.lifecycle.start(kind);
  } catch (error) {
    this.fail(error);
    return false;
  }
};

StackController.prototype.focusEntryControl = function focusEntryControl() {
  const target = this.entryKind === 'continue'
    ? this.view.continueGame
    : this.entryKind === 'resume' ? this.view.resume : this.view.start;
  target.focus();
};

StackController.prototype.activate = async function activate(kind, api) {
  const action = kind === 'start' ? { type: 'start' } : { type: 'resume' };
  const transition = this.engine.reduceStack(this.state, action);
  if (transition.state.status !== 'active') {
    throw new Error('Kinnoki Stack could not enter active play.');
  }
  this.state = transition.state;

  if (kind === 'start') {
    this.persistence.start({
      difficulty: this.difficulty,
      seed: this.seed,
      signature: this.signature,
      definition: this.definition,
      state: this.state,
    });
  } else {
    this.persistence.savePlay(this.state, this.lifecycle.elapsed());
  }

  const audioActivation = kind === 'resume' ? this.audio.resume() : this.audio.start();

  this.entryKind = null;
  this.activeApi = api;
  this.lastFrameTime = null;
  this.registerActiveHandlers(api);
  for (const event of transition.events) this.announcer.announce(event);
  this.audio.setIntensity(stackIntensity(this.state));
  this.paint();
  if (kind === 'continue' || kind === 'resume') this.view.controls.left.focus();
  api.requestActiveFrame((timestamp) => this.frame(timestamp));
  await audioActivation;
};

StackController.prototype.registerActiveHandlers = function registerActiveHandlers(api) {
  const bindings = [
    [this.view.controls.left, { type: 'move', deltaColumn: -1 }],
    [this.view.controls.right, { type: 'move', deltaColumn: 1 }],
    [this.view.controls.rotate, { type: 'rotate', quarterTurns: 1 }],
    [this.view.controls.softDrop, { type: 'soft-drop' }],
    [this.view.controls.hardDrop, { type: 'hard-drop' }],
    [this.view.controls.advance, { type: 'advance-step' }],
  ];
  for (const [control, action] of bindings) {
    api.listenActive(control, 'click', () => this.dispatch(action, control));
  }
  api.listenActive(this.view.controls.stepMode, 'click', () => {
    this.dispatch({
      type: 'set-step-mode', enabled: !this.state.stepMode,
    }, this.view.controls.stepMode);
  });
  api.listenActive(this.view.controls.pause, 'click', () => {
    this.lifecycle.pause('user');
  });
  api.listenActive(this.document, 'keydown', (event) => this.handleKeyDown(event));
};

StackController.prototype.handleKeyDown = function handleKeyDown(event) {
  if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(event.target?.tagName)) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === 'p' || key === 'Escape') {
    event.preventDefault();
    this.lifecycle.pause('user');
    return;
  }
  const action = {
    ArrowLeft: { type: 'move', deltaColumn: -1 },
    ArrowRight: { type: 'move', deltaColumn: 1 },
    ArrowDown: { type: 'soft-drop' },
    ArrowUp: { type: 'rotate', quarterTurns: 1 },
    z: { type: 'rotate', quarterTurns: 1 },
    ' ': { type: 'hard-drop' },
    Enter: this.state.stepMode ? { type: 'advance-step' } : null,
  }[key];
  if (!action) return;
  event.preventDefault();
  this.dispatch(action, null);
};

StackController.prototype.dispatch = function dispatch(action, focusTarget) {
  if (this.state.status !== 'active' || this.disposed || this.finished) return;
  try {
    this.accept(this.engine.reduceStack(this.state, action), focusTarget);
  } catch (error) {
    this.fail(error);
  }
};

StackController.prototype.frame = function frame(timestamp) {
  if (this.disposed || this.finished || this.state.status !== 'active'
      || this.lifecycle.state !== 'active') return;
  const delta = this.lastFrameTime === null ? 0 : Math.max(0, timestamp - this.lastFrameTime);
  this.lastFrameTime = timestamp;
  try {
    this.accept(this.engine.advanceStackTime(this.state, delta), null);
  } catch (error) {
    this.fail(error);
    return;
  }
  if (!this.disposed && !this.finished && this.state.status === 'active'
      && this.lifecycle.state === 'active') {
    this.activeApi.requestActiveFrame((nextTimestamp) => this.frame(nextTimestamp));
  }
};

StackController.prototype.accept = function accept(result, focusTarget) {
  const fatal = result.events.find((event) => event.type === 'error');
  if (fatal) {
    this.state = result.state;
    this.fail(new Error(fatal.message));
    return;
  }

  const changed = result.state !== this.state;
  this.state = result.state;
  if (changed) this.persistence.savePlay(this.state, this.lifecycle.elapsed());

  for (const event of result.events) {
    this.announcer.announce(event);
    const effect = effectForEvent(event);
    if (effect) this.audio.playEffect(effect);
  }

  this.audio.setIntensity(stackIntensity(this.state));
  this.paint();
  if (focusTarget && this.state.status === 'active') focusTarget.focus();
  if (this.state.status === 'terminal') this.finishTerminal();
};

StackController.prototype.snapshot = function snapshot() {
  if (this.persistence.store.runs[GAME]) {
    this.persistence.savePlay(this.state, this.lifecycle.elapsed());
  }
};

StackController.prototype.handlePause = function handlePause(reason) {
  if (this.state.status !== 'active') return;
  const result = this.engine.reduceStack(this.state, {
    type: 'pause', reason,
  });
  this.state = result.state;
  this.entryKind = 'resume';
  this.activeApi = null;
  this.lastFrameTime = null;
  this.persistence.savePlay(this.state, this.lifecycle.elapsed());
  for (const event of result.events) this.announcer.announce(event);
  void this.audio.pause();
  this.paint();
  this.view.resume.focus();
};

StackController.prototype.remount = async function remount(store, options) {
  this.dispose();
  const next = await mountStack(
    this.root, store, this.dependencies, this.slot, options,
  );
  this.slot.current = next;
};

StackController.prototype.restart = async function restart() {
  if (this.disposed || this.finished) return;
  this.persistence.abandon(this.signature);
  await this.remount(this.persistence.store, {
    forcedDifficulty: this.difficulty,
    previewDefinition: this.definition,
  });
};

StackController.prototype.replaceWithDifficulty = async function replaceWithDifficulty(
  requestedDifficulty,
) {
  if (!DIFFICULTIES.includes(requestedDifficulty) || this.disposed) return;
  const run = this.persistence.store.runs[GAME];
  if (run) {
    const accepted = this.dependencies.confirm(
      'Replace the current Kinnoki Stack run? The unfinished run will not count.',
    );
    if (!accepted) {
      this.view.difficultySelect.value = this.difficulty;
      this.view.difficultySelect.focus();
      return;
    }
  }

  const abandonedSignature = run?.signature ?? this.signature;
  if (run) this.persistence.abandon(run.signature);
  await this.remount(this.persistence.store, {
    forcedDifficulty: requestedDifficulty,
    abandonedSignature,
  });
};

StackController.prototype.finishTerminal = function finishTerminal() {
  if (this.finished || this.disposed) return;
  const elapsedMs = this.lifecycle.elapsed();
  if (!this.lifecycle.finish()) return;
  const payload = this.engine.stackCompletionPayload(this.state, elapsedMs);
  if (!payload) {
    this.fail(new Error('Kinnoki Stack ended without a completion payload.'));
    return;
  }

  this.finished = true;
  this.entryKind = null;
  this.persistence.complete(payload.records, this.state);
  this.audio.finish();
  makeGameTerminal(this.root);

  const heading = element('h2', {
    'data-complete-heading': '', tabindex: '-1', text: 'Run complete',
  });
  const summary = element('p', {
    text: payload.summary.score.toLocaleString('en-CA') + ' points · '
      + payload.summary.dispatchedManifests + ' manifests · best combo '
      + payload.summary.bestCombo + '× · ' + formatElapsed(payload.summary.elapsedMs)
      + (payload.summary.assisted ? ' · assisted' : ' · unassisted')
      + ' · ' + payload.summary.reason,
  });
  const playAgain = element('button', {
    type: 'button', 'data-play-another': '', text: 'Play Again',
  });
  const panel = element(
    'section', { class: 'game-complete' }, heading, summary, playAgain,
  );
  this.view.shell.append(panel);
  this.listenPassive(playAgain, 'click', () => {
    void this.replaceWithDifficulty(this.difficulty);
  });
  heading.focus();
};

StackController.prototype.fail = function fail(error) {
  if (this.disposed || this.finished || this.errorRendered) return;
  const failure = error instanceof Error ? error : new Error(String(error));
  this.lifecycle.fail(failure);
};

StackController.prototype.renderError = function renderError(error) {
  if (this.errorRendered) return;
  this.errorRendered = true;
  void this.audio.pause();
  void this.audio.dispose();
  const run = this.persistence.store.runs[GAME];
  if (run) this.persistence.abandon(run.signature);
  for (const cleanup of this.passiveCleanups) cleanup();
  this.passiveCleanups.clear();
  this.announcer.dispose();
  this.audioControls.dispose();
  renderGameError(this.root, {
    title: 'Kinnoki Stack paused',
    message: error.message || 'This run could not continue safely.',
    newGameHref: '/games/kinnoki-stack?difficulty=' + this.difficulty,
  });
};

StackController.prototype.cleanup = function cleanup() {
  if (this.disposed) return;
  this.disposed = true;
  for (const cleanup of this.passiveCleanups) cleanup();
  this.passiveCleanups.clear();
  this.announcer.dispose();
  this.audioControls.dispose();
  void this.audio.dispose();
};

StackController.prototype.dispose = function dispose() {
  if (this.disposed) return;
  this.lifecycle.dispose();
  this.cleanup();
};

const normalizedDependencies = (dependencies) => ({
  storage: dependencies.storage ?? safeLocalStorage(globalThis),
  wallNow: dependencies.wallNow ?? (() => Date.now()),
  monotonicNow: dependencies.monotonicNow ?? (() => performance.now()),
  seedFactory: dependencies.seedFactory ?? defaultSeedFactory,
  audioFactory: dependencies.audioFactory ?? createGameAudio,
  confirm: dependencies.confirm ?? ((message) => window.confirm(message)),
  engine: dependencies.engine ?? defaultStackEngine,
});

async function mountStack(root, initialStore, dependencies, slot, options = {}) {
  const persistence = new StackPersistence({
    storage: dependencies.storage,
    store: initialStore,
    wallNow: dependencies.wallNow,
  });
  const params = new URLSearchParams(globalThis.location?.search ?? '');
  const requested = options.forcedDifficulty ?? params.get('difficulty');
  let difficulty = DIFFICULTIES.includes(requested) ? requested : 'easy';
  let abandonedSignature = options.abandonedSignature ?? null;
  let focusRetainedEntry = false;
  const existing = persistence.store.runs[GAME];

  try {
    if (existing && !options.previewDefinition) {
      if (!validStoredStackRun(existing, dependencies.engine)) {
        persistence.abandon(existing.signature);
        throw new Error('Saved Kinnoki Stack state is invalid.');
      }
      persistence.normalizeAssistance(existing.puzzle.play);
      if (existing.difficulty !== difficulty) {
        const accepted = dependencies.confirm(
          'Replace the saved ' + titleCase(existing.difficulty)
            + ' Kinnoki Stack run with ' + titleCase(difficulty) + '?',
        );
        if (accepted) {
          abandonedSignature = existing.signature;
          persistence.abandon(existing.signature);
        } else {
          difficulty = existing.difficulty;
          focusRetainedEntry = true;
        }
      }
    }

    const model = selectStackModel({
      store: persistence.store,
      difficulty,
      seedFactory: dependencies.seedFactory,
      engine: dependencies.engine,
      abandonedSignature,
      previewDefinition: options.previewDefinition ?? null,
    });
    const controller = new StackController({
      root, model, persistence, dependencies, slot,
    });
    if (focusRetainedEntry) controller.focusEntryControl();
    return controller;
  } catch (error) {
    renderGameError(root, {
      title: 'Kinnoki Stack paused',
      message: error.message || 'A new run could not be prepared.',
      newGameHref: '/games/kinnoki-stack?difficulty=' + difficulty,
    });
    return { dispose() {} };
  }
}

export async function renderKinnokiStack(root, store, dependencies = {}) {
  const slot = { current: null };
  const resolved = normalizedDependencies(dependencies);
  const publicController = {
    dispose() { slot.current?.dispose(); },
  };
  slot.current = await mountStack(root, store, resolved, slot);
  return publicController;
}

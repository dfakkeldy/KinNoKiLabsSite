import {
  abandonRun, chooseFreshDefinition, completeRun, historyKey,
  markAssisted, recordsBrokenBy, saveGameStore, startRun,
} from './core.js';
import {
  CARGO_CATALOG, canPlace, placedCells, removePiece, rotationsFor,
} from './cargo-geometry.js';
import {
  createEndlessDefinition, createYardState, generateContract,
  prepareYardForContinue, reduceYard, validateYardState,
  yardCompletionPayload, yardDefinitionSignature,
} from './kinnoki-yard.js';
import { createGameAudio } from './game-audio.js';
import {
  cargoThumb, createAudioControls, createEventAnnouncer, createGameLifecycle,
  defaultSeedFactory, element, formatElapsed, makeGameTerminal,
  prefersReducedMotion, renderGameError,
} from './controller-common.js';
import { celebrate } from './celebration.js';
import { safeLocalStorage } from './hub-ui.js';

const GAME = 'kinnoki-yard';
const MODES = Object.freeze(['contracts', 'endless']);
const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
const MODE_LABELS = Object.freeze({
  contracts: 'Puzzle Contract',
  endless: 'Endless Yard',
});
const DIFFICULTY_COPY = Object.freeze({
  contracts: Object.freeze({
    easy: 'Easy Contract: a compact, open target with full rotation choices.',
    medium: 'Medium Contract: a larger concave target with selected rotations.',
    hard: 'Hard Contract: a large target with narrow bays and tight rotations.',
  }),
  endless: Object.freeze({
    easy: 'Easy Yard: a larger yard with every cargo rotation available.',
    medium: 'Medium Yard: less open space and selected cargo rotations.',
    hard: 'Hard Yard: the tightest yard and the narrowest rotation choices.',
  }),
});
const CARGO_BY_ID = new Map(CARGO_CATALOG.map((cargo) => [cargo.id, cargo]));
const RECORD_LABELS = Object.freeze({
  time: 'New best time!',
  moves: 'Fewest moves!',
  score: 'New best score!',
  combo: 'Best combo!',
});

export const defaultYardEngine = Object.freeze({
  createEndlessDefinition,
  createYardState,
  generateContract,
  prepareYardForContinue,
  reduceYard,
  validateYardState,
  yardCompletionPayload,
  yardDefinitionSignature,
});

const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const cellKey = (row, column) => row + ':' + column;
const cargoFor = (typeId) => CARGO_BY_ID.get(typeId) ?? {
  id: 'unknown', label: 'Unknown cargo', pattern: 'solid',
};
const modeLabel = (mode) => MODE_LABELS[mode] ?? 'Kinnoki Yard';
function buildYardSelectors(mode, difficulty) {
  const modeSelect = element(
    'select',
    { 'data-mode': '', 'aria-label': 'Yard mode' },
    MODES.map((value) => element('option', {
      value, text: modeLabel(value),
    })),
  );
  modeSelect.value = mode;
  const difficultySelect = element(
    'select',
    { 'data-difficulty': '', 'aria-label': 'Difficulty' },
    DIFFICULTIES.map((value) => element('option', {
      value, text: titleCase(value),
    })),
  );
  difficultySelect.value = difficulty;
  return { modeSelect, difficultySelect };
}

function buildYardBoard(definition, focus) {
  const cells = [];
  const grid = element('div', {
    class: 'yard-grid',
    role: 'grid',
    'aria-label': 'Kinnoki Yard cargo board',
    style: '--yard-columns: ' + definition.width,
  });
  for (let row = 0; row < definition.height; row += 1) {
    const rowNode = element('div', { class: 'yard-row', role: 'row' });
    const rowCells = [];
    for (let column = 0; column < definition.width; column += 1) {
      const control = element('button', {
        type: 'button',
        class: 'yard-cell',
        'data-yard-cell': cellKey(row, column),
        'data-yard-row': row,
        'data-yard-column': column,
        tabindex: focus.row === row && focus.column === column ? '0' : '-1',
        disabled: true,
        'aria-label': 'Empty yard cell, row ' + (row + 1)
          + ', column ' + (column + 1),
      });
      rowCells.push(control);
      rowNode.append(element('div', {
        class: 'yard-gridcell', role: 'gridcell',
      }, control));
    }
    cells.push(rowCells);
    grid.append(rowNode);
  }

  const panLeft = element('button', {
    type: 'button', 'data-yard-pan-left': '',
    'aria-label': 'Pan yard left', text: 'Pan Left',
  });
  const panRight = element('button', {
    type: 'button', 'data-yard-pan-right': '',
    'aria-label': 'Pan yard right', text: 'Pan Right',
  });
  // Dedicated absolute layer for Endless dispatch score pops, mirroring Kinnoki
  // Stack's `.stack-score-pop-layer` inside its dock (Task 8).
  const scorePopLayer = element('div', {
    class: 'yard-score-pop-layer', 'aria-hidden': 'true',
  });
  const scroll = element('div', { class: 'yard-board-scroll' }, grid, scorePopLayer);
  const pan = element('div', {
    class: 'yard-pan-controls', 'aria-label': 'Yard board pan controls',
  }, panLeft, panRight);
  return {
    grid, cells, scroll, pan, panLeft, panRight, scorePopLayer,
  };
}
function buildYardShell(root, model, audioControls) {
  const { mode, difficulty, state, definition } = model;
  const selectors = buildYardSelectors(mode, difficulty);
  const board = buildYardBoard(definition, state.focus);
  const timer = element('time', {
    'data-timer': '', 'aria-label': 'Elapsed active time', text: '0:00',
  });
  const moves = element('span', { 'data-yard-moves': '', text: '0' });
  const score = element('span', { 'data-yard-score': '', text: '0' });
  const record = element('span', { 'data-yard-record': '', text: '—' });
  const assisted = element('span', {
    'data-assisted-status': '', text: 'Unassisted · eligible for records',
  });
  const status = element('span', { 'data-yard-status': '', text: 'Ready' });
  const summary = element('span', { 'data-yard-summary': '', text: 'Preparing yard' });
  const rotation = element('span', {
    'data-yard-rotation-state': '', text: 'Rotation 0°',
  });
  const difficultyExplanation = element('p', {
    'data-difficulty-explanation': '',
    text: DIFFICULTY_COPY[mode][difficulty],
  });
  const notice = element('p', {
    class: 'game-storage-notice', role: 'status', 'aria-live': 'polite',
    hidden: true, text: '',
  });
  const eventRegion = element('p', {
    class: 'games-live-region', role: 'status', 'aria-live': 'polite', text: '',
  });
  const tray = element('div', {
    class: 'yard-tray', 'data-yard-tray': '', 'aria-label': 'Cargo tray',
  });

  const control = (label, dataAttribute) => element('button', {
    type: 'button', [dataAttribute]: '', text: label, disabled: true,
  });
  const controls = {
    rotate: control('Rotate', 'data-yard-rotate'),
    undo: control('Undo', 'data-yard-undo'),
    hint: mode === 'contracts' ? control('Hint', 'data-yard-hint') : null,
    pause: control('Pause', 'data-pause-game'),
  };
  const start = element('button', {
    type: 'button', 'data-start-game': '', text: 'Start',
  });
  const continueGame = element('button', {
    type: 'button', 'data-continue-game': '',
    text: 'Continue ' + modeLabel(mode) + ' · ' + titleCase(difficulty),
    hidden: true,
  });
  const resume = element('button', {
    type: 'button', 'data-resume-game': '', text: 'Resume', hidden: true,
  });
  const restart = element('button', {
    type: 'button', 'data-restart': '', text: 'Restart',
  });
  const newGame = element('button', {
    type: 'button', 'data-new-yard': '',
    text: mode === 'contracts' ? 'New Puzzle' : 'New Yard',
  });
  const stat = (label, value) => element(
    'div', {}, element('dt', { text: label }), element('dd', {}, value),
  );
  const stats = element('dl', { class: 'game-status-grid' },
    stat('Status', status),
    stat('Elapsed', timer),
    stat(mode === 'contracts' ? 'Moves' : 'Score',
      mode === 'contracts' ? moves : score),
    stat('Local record', record),
    stat('Record status', assisted),
    stat(mode === 'contracts' ? 'Contract' : 'Cargo Manifests', summary),
    stat('Rotation', rotation));
  const help = element('details', { 'data-yard-keyboard-help': '' },
    element('summary', { text: 'Keyboard controls' }),
    element('p', {
      text: 'Arrow keys move board focus. Enter or Space places cargo. '
        + 'R rotates, U undoes, H requests a Contract hint, and Escape pauses.',
    }));

  const shell = element('section', { class: 'yard-game' },
    element('div', { class: 'game-toolbar' },
      element('a', { href: '/games', class: 'back-link', text: '← Games' }),
      element('h1', { text: 'Kinnoki Yard' }),
      element('label', {}, element('span', { text: 'Mode' }), selectors.modeSelect),
      element('label', {}, element('span', { text: 'Difficulty' }),
        selectors.difficultySelect)),
    notice,
    eventRegion,
    difficultyExplanation,
    stats,
    element('div', { class: 'game-preplay' },
      start, continueGame, resume, restart, newGame),
    element('section', { class: 'yard-tray-panel', 'aria-label': 'Cargo tray' },
      element('h2', { text: 'Cargo tray' }), tray),
    help,
    element('div', { class: 'yard-board-column' },
      board.scroll, board.pan),
    element('div', { class: 'yard-controls' },
      Object.values(controls).filter(Boolean)),
    audioControls.element);
  root.replaceChildren(shell);
  return {
    shell,
    ...selectors,
    ...board,
    timer, moves, score, record, assisted, status, summary, rotation,
    difficultyExplanation, notice, eventRegion, tray, controls,
    start, continueGame, resume, restart, newGame,
  };
}
const contractTargetKeys = (state) => new Set(
  state.definition.target.map(({ row, column }) => cellKey(row, column)),
);
const manifestTargetKeys = (state) => new Set(
  state.manifests.flatMap((manifest) => manifest.cells.map(
    ({ row, column }) => cellKey(row, column),
  )),
);

function normalizedYardFocus(state) {
  if (state.kind !== 'contracts') return state.focus;
  const targets = contractTargetKeys(state);
  if (targets.has(cellKey(state.focus.row, state.focus.column))) return state.focus;
  const first = state.definition.target[0];
  return { row: first.row, column: first.column };
}

function occupiedCargo(state, occupied) {
  if (occupied == null) return null;
  const pieceId = typeof occupied === 'object' ? occupied.pieceId : occupied;
  const placement = state.placements?.[pieceId] ?? null;
  const definitionPiece = state.definition.pieces?.find(
    (piece) => piece.pieceId === pieceId,
  );
  const trayPiece = state.tray?.find((piece) => piece.pieceId === pieceId);
  const typeId = occupied.typeId ?? placement?.typeId
    ?? definitionPiece?.typeId ?? trayPiece?.typeId;
  return { pieceId, typeId, cargo: cargoFor(typeId) };
}

// Full-footprint Contract hint: `state.hint` (when solved) carries only
// `.placement` ({ pieceId, typeId, rotation, row, column }), never a
// top-level row/column, so deriving the complete footprint requires
// placedCells/rotationsFor here — mirroring how the engine itself validates
// a placement, without touching kinnoki-yard.js.
function contractHintKeys(state) {
  const placement = state.hint?.status === 'solved' ? state.hint.placement : null;
  if (!placement) return new Set();
  const rotated = rotationsFor(placement.typeId).find(
    (candidate) => candidate.rotation === placement.rotation,
  );
  if (!rotated) return new Set();
  return new Set(
    placedCells(rotated.cells, placement).map(({ row, column }) => cellKey(row, column)),
  );
}

// Endless dispatch: mirrors kinnoki-stack-ui.js's dispatchedCellKeys. The
// engine's `dispatch` event only carries a dispatched cell *count*, not
// coordinates, so this resolves the exact cells by matching the event's
// manifestIds against `previousState.manifests` (the manifest zones as they
// stood immediately before this transition).
function dispatchedCellKeys(previousState, dispatchEvent) {
  const keys = new Set();
  if (!dispatchEvent) return keys;
  for (const manifestItem of previousState.manifests) {
    if (!dispatchEvent.manifestIds.includes(manifestItem.id)) continue;
    for (const { row, column } of manifestItem.cells) keys.add(cellKey(row, column));
  }
  return keys;
}

function spawnScorePop(view, dispatchEvent) {
  const pop = element('span', {
    class: 'game-score-pop',
    'aria-hidden': 'true',
    text: '+' + dispatchEvent.scoreAdded + ' ×' + dispatchEvent.combo,
  });
  view.scorePopLayer.append(pop);
}

// Ghost preview: derives the selected tray piece's full rotated footprint at
// a candidate origin via placedCells/canPlace (cargo-geometry.js), mirroring
// the exact validity rules reduceContractPlacement/reduceEndlessInternal
// apply — target-membership + canPlace for contracts (on the board with the
// piece's own existing cells cleared, so repositioning an already-placed
// piece previews correctly), canPlace alone for endless. Read-only; the
// reducer is never touched.
function yardGhostAt(state, origin) {
  const piece = selectedPiece(state);
  if (!piece) return null;
  const rotationValue = state.kind === 'contracts' ? state.selectedRotation : piece.rotation;
  const rotated = rotationsFor(piece.typeId, piece.allowedRotations)
    .find((candidate) => candidate.rotation === rotationValue);
  if (!rotated) return null;
  let cells;
  try {
    cells = placedCells(rotated.cells, origin);
  } catch {
    return null;
  }
  let valid;
  if (state.kind === 'contracts') {
    const target = contractTargetKeys(state);
    const cleared = removePiece(state.board, piece.pieceId);
    valid = cells.every((cell) => target.has(cellKey(cell.row, cell.column)))
      && canPlace(cleared, rotated.cells, origin);
  } else {
    valid = canPlace(state.board, rotated.cells, origin);
  }
  return { cells, valid };
}

function paintYardBoard(view, state, { hintKeys, dispatchedKeys, reducedMotion }) {
  const targetKeys = state.kind === 'contracts'
    ? contractTargetKeys(state) : manifestTargetKeys(state);
  const active = state.status === 'active';

  for (let row = 0; row < state.definition.height; row += 1) {
    for (let column = 0; column < state.definition.width; column += 1) {
      const key = cellKey(row, column);
      const node = view.cells[row][column];
      const occupied = occupiedCargo(state, state.board[row][column]);
      const inContractTarget = state.kind !== 'contracts' || targetKeys.has(key);
      node.className = 'yard-cell';
      node.setAttribute('tabindex',
        state.focus.row === row && state.focus.column === column ? '0' : '-1');
      node.disabled = !active || !inContractTarget;
      node.removeAttribute('data-pattern');
      if (targetKeys.has(key)) {
        node.classList.add(state.kind === 'contracts'
          ? 'yard-cell-target' : 'yard-cell-manifest');
      }
      if (state.focus.row === row && state.focus.column === column) {
        node.classList.add('yard-cell-selected');
      }
      if (hintKeys.has(key)) node.classList.add('is-hint');
      if (!reducedMotion && dispatchedKeys.has(key)) node.classList.add('cargo-dispatching');

      const suffix = ', row ' + (row + 1) + ', column ' + (column + 1)
        + (targetKeys.has(key)
          ? state.kind === 'contracts' ? ', Contract target' : ', Cargo Manifest target'
          : '');
      if (occupied) {
        node.classList.add('yard-cell-placed');
        node.classList.add('cargo-pattern-' + occupied.cargo.pattern);
        node.setAttribute('data-pattern', occupied.cargo.pattern);
        node.setAttribute('aria-label', occupied.cargo.label + ', placed, '
          + occupied.cargo.pattern + ' pattern' + suffix);
        node.textContent = '■';
      } else {
        node.setAttribute('aria-label',
          (inContractTarget ? 'Empty yard cell' : 'Outside Contract target') + suffix);
        node.textContent = '';
      }
    }
  }
}
const modeBucket = (store, mode) => (
  store.stats?.games?.[GAME]?.modes?.[mode] ?? null
);

function yardRecordText(store, state) {
  const bucket = modeBucket(store, state.kind);
  const difficulty = state.definition.difficulty;
  if (state.kind === 'contracts') {
    const time = bucket?.records?.time?.[difficulty];
    const moves = bucket?.records?.moves?.[difficulty];
    return (Number.isSafeInteger(time) ? formatElapsed(time) : '—')
      + ' · ' + (Number.isSafeInteger(moves) ? moves + ' moves' : '—');
  }
  const score = bucket?.records?.score?.[difficulty];
  const combo = bucket?.records?.combo?.[difficulty];
  return (Number.isSafeInteger(score) ? score.toLocaleString('en-CA') : '—')
    + ' · ' + (Number.isSafeInteger(combo) ? combo + '×' : '—');
}

function trayPieces(state) {
  return state.kind === 'contracts' ? state.definition.pieces : state.tray;
}

function selectedPiece(state) {
  return trayPieces(state).find((piece) => (
    piece.pieceId === state.selectedPieceId
  )) ?? null;
}

function paintYard(view, state, {
  store, elapsedMs, entryKind, frameEvents = [], previousState = null,
  reducedMotion = prefersReducedMotion(),
}) {
  const mode = state.kind;
  const difficulty = state.definition.difficulty;
  view.modeSelect.value = mode;
  view.difficultySelect.value = difficulty;
  view.difficultyExplanation.textContent = DIFFICULTY_COPY[mode][difficulty];
  view.timer.textContent = formatElapsed(elapsedMs);
  view.moves.textContent = String(state.moves ?? 0);
  view.score.textContent = (state.score ?? 0).toLocaleString('en-CA');
  view.record.textContent = yardRecordText(store, state);
  view.assisted.textContent = state.assisted
    ? 'Assisted run · records excluded'
    : 'Unassisted · eligible for records';
  view.status.textContent = titleCase(state.status);
  view.summary.textContent = mode === 'contracts'
    ? Object.keys(state.placements).length + '/' + state.definition.pieces.length
      + ' cargo pieces placed'
    : state.manifests.length + ' active · '
      + state.dispatchedManifests + ' dispatched';

  const selected = selectedPiece(state);
  const selectedRotation = mode === 'contracts'
    ? state.selectedRotation : selected?.rotation ?? 0;
  view.rotation.textContent = 'Rotation ' + ((selectedRotation % 4) * 90)
    + '° · ' + (selected?.allowedRotations?.length ?? 0) + ' allowed';

  const hintPlacement = state.hint?.status === 'solved' ? state.hint.placement : null;
  const hintKeys = contractHintKeys(state);

  view.tray.replaceChildren(...trayPieces(state).map((piece) => {
    const cargo = cargoFor(piece.typeId);
    const rotation = mode === 'contracts'
      ? piece.pieceId === state.selectedPieceId
        ? state.selectedRotation : piece.initialRotation
      : piece.rotation;
    const placed = mode === 'contracts'
      && Object.hasOwn(state.placements, String(piece.pieceId));
    const rotated = rotationsFor(piece.typeId, piece.allowedRotations)
      .find((candidate) => candidate.rotation === rotation) ?? { cells: cargo.cells ?? [] };
    // cargoThumb does not rotate cells itself — the caller must pre-rotate
    // (Task 8's contract). `rotated.cells` already reflects this piece's
    // current on-screen rotation.
    const thumb = cargoThumb(rotated.cells, {
      patternClass: 'cargo-pattern-' + cargo.pattern,
      rotation,
    });
    const label = element('span', {
      class: 'visually-hidden',
      text: cargo.label + ' · rotation ' + ((rotation % 4) * 90)
        + '° · allowed ' + piece.allowedRotations.map((value) => value * 90 + '°').join(', ')
        + ' · ' + cargo.pattern + ' pattern' + (placed ? ' · placed' : ''),
    });
    return element('button', {
      type: 'button',
      class: 'yard-tray-piece cargo-pattern-' + cargo.pattern
        + (piece.pieceId === state.selectedPieceId ? ' is-selected' : '')
        + (placed ? ' is-placed' : '')
        + (hintPlacement?.pieceId === piece.pieceId ? ' is-hint-flash' : ''),
      'data-yard-piece': piece.pieceId,
      'data-pattern': cargo.pattern,
      'aria-pressed': String(piece.pieceId === state.selectedPieceId),
      disabled: state.status !== 'active',
    }, thumb, label);
  }));

  const dispatchEvent = mode === 'endless'
    ? frameEvents.find((event) => event.type === 'dispatch') : null;
  const dispatchedKeys = previousState && dispatchEvent
    ? dispatchedCellKeys(previousState, dispatchEvent) : new Set();

  paintYardBoard(view, state, { hintKeys, dispatchedKeys, reducedMotion });
  if (dispatchEvent && !reducedMotion) spawnScorePop(view, dispatchEvent);
  const active = state.status === 'active';
  for (const control of Object.values(view.controls).filter(Boolean)) {
    control.disabled = !active;
  }
  view.controls.undo.disabled = !active || state.history.length === 0;
  view.start.hidden = entryKind !== 'start';
  view.continueGame.hidden = entryKind !== 'continue';
  view.resume.hidden = entryKind !== 'resume';
  view.continueGame.textContent = 'Continue ' + modeLabel(mode)
    + ' · ' + titleCase(difficulty);
  view.newGame.textContent = mode === 'contracts' ? 'New Puzzle' : 'New Yard';
}
class YardPersistence {
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
    this.notice('Progress could not be saved. This game can continue in memory.');
  }

  write() {
    const result = saveGameStore(this.storage, this.value);
    if (!result.ok) this.report(result.error);
    return result.ok;
  }

  start({ mode, difficulty, seed, signature, definition, state }) {
    this.value = startRun(this.value, {
      game: GAME, mode, difficulty, seed, signature,
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

  reset(values) { this.start(values); }

  abandon(expectedSignature) {
    this.value = abandonRun(this.value, {
      game: GAME, expectedSignature,
    });
    this.write();
  }

  complete(mode, records, state) {
    const run = this.value.runs[GAME];
    if (!run || run.assisted !== state.assisted) {
      throw new Error('Yard assistance state is inconsistent at completion.');
    }
    const previous = this.value;
    // Must read the still-intact previous bests before completeRun folds
    // this run's records into the stats bucket.
    const recordsBroken = recordsBrokenBy(previous, { game: GAME, mode, records });
    const completed = completeRun(previous, {
      game: GAME, mode, now: this.wallNow(), records,
    });
    if (completed === previous || completed.runs[GAME]) {
      throw new Error('Yard completion accounting could not be applied.');
    }
    this.value = completed;
    if (!this.write()) {
      this.value = previous;
      throw new Error('Yard completion could not be saved.');
    }
    return recordsBroken;
  }

  setAudio(preferences) {
    this.value = { ...this.value, audio: preferences };
    this.write();
  }
}
const SILENT_AUDIO = Object.freeze({
  start: async () => {}, resume: async () => {}, pause: async () => {},
  stop: async () => {}, finish: () => {}, dispose: async () => {},
  setPreferences: () => {}, setIntensity: () => {}, playEffect: () => {},
});

class LazyYardAudio {
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
        preferences: this.preferences,
        monotonicNow: this.monotonicNow,
        onNotice: this.onNotice,
      });
    } catch {
      this.onNotice('Audio is unavailable; play continues in silence.');
      this.audio = SILENT_AUDIO;
    }
    return this.audio;
  }

  async start() {
    await this.ensure().start({ arrangement: 'yard' });
    this.audio.setIntensity({ height: 0, tidePressure: 0 });
  }

  async resume() {
    if (!this.audio) return this.start();
    await this.audio.resume();
  }

  pause() { return this.audio?.pause(); }
  finish(outcome) { this.audio?.finish({ outcome }); }
  dispose() { return this.audio?.dispose(); }
  playEffect(name) { this.audio?.playEffect(name); }
  setPreferences(preferences) {
    this.preferences = preferences;
    this.audio?.setPreferences(preferences);
  }
}

const yardEffectForEvent = (event) => ({
  selected: 'move',
  rotated: 'rotate',
  placed: 'placement',
  dispatch: 'dispatch',
  invalid: 'invalid',
}[event.type] ?? null);
const createDefinitionForMode = (engine, mode) => (
  mode === 'contracts' ? engine.generateContract : engine.createEndlessDefinition
);

function validStoredYardRun(run, engine) {
  try {
    return Boolean(run
      && run.game === GAME
      && MODES.includes(run.mode)
      && DIFFICULTIES.includes(run.difficulty)
      && run.seed === run.puzzle?.definition?.seed
      && run.puzzle?.definition?.mode === run.mode
      && run.puzzle?.definition?.difficulty === run.difficulty
      && run.puzzle?.play?.kind === run.mode
      && typeof run.assisted === 'boolean'
      && run.assisted === run.puzzle.play.assisted
      && engine.yardDefinitionSignature(run.puzzle.definition) === run.signature
      && engine.yardDefinitionSignature(run.puzzle.play.definition) === run.signature
      && engine.validateYardState(
        run.puzzle.play, run.difficulty, run.mode,
      ).valid);
  } catch {
    return false;
  }
}

function freshYardModel({
  store, mode, difficulty, seedFactory, engine,
  abandonedSignature = null,
}) {
  const key = historyKey(GAME, mode);
  const previousSeed = store.previousSeeds[key] ?? null;
  const previousSignature = store.previousSignatures[key] ?? null;
  const initialSeed = seedFactory({ game: GAME, mode, previousSeed });
  const selected = chooseFreshDefinition({
    game: GAME,
    mode,
    difficulty,
    initialSeed,
    previousSeed,
    previousSignature,
    abandonedSignature,
    createDefinition: createDefinitionForMode(engine, mode),
    signatureOf: engine.yardDefinitionSignature,
  });
  return {
    definition: selected.definition,
    state: engine.createYardState(selected.definition),
    mode,
    difficulty,
    seed: selected.seed,
    signature: selected.signature,
    entryKind: 'start',
    initialElapsedMs: 0,
  };
}

function selectYardModel({
  store, mode, difficulty, seedFactory, engine,
  abandonedSignature = null, previewDefinition = null,
}) {
  if (previewDefinition) {
    return {
      definition: previewDefinition,
      state: engine.createYardState(previewDefinition),
      mode: previewDefinition.mode,
      difficulty: previewDefinition.difficulty,
      seed: previewDefinition.seed,
      signature: engine.yardDefinitionSignature(previewDefinition),
      entryKind: 'start',
      initialElapsedMs: 0,
    };
  }
  const run = store.runs[GAME];
  if (run) {
    if (!validStoredYardRun(run, engine)) {
      throw new Error('Saved Kinnoki Yard state is invalid.');
    }
    return {
      definition: run.puzzle.definition,
      state: engine.prepareYardForContinue(run.puzzle.play),
      mode: run.mode,
      difficulty: run.difficulty,
      seed: run.seed,
      signature: run.signature,
      entryKind: 'continue',
      initialElapsedMs: run.elapsedBeforeStartMs,
    };
  }
  return freshYardModel({
    store, mode, difficulty, seedFactory, engine, abandonedSignature,
  });
}
class YardController {
  constructor({ root, model, persistence, dependencies, slot }) {
    this.root = root;
    this.document = root.ownerDocument ?? globalThis.document;
    this.state = model.entryKind === 'start'
      ? { ...model.state, focus: normalizedYardFocus(model.state) }
      : model.state;
    this.model = { ...model, state: this.state };
    this.definition = model.definition;
    this.mode = model.mode;
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
    this.ghostOrigin = null;
    this.ghostKeys = new Set();
    this.lastFormattedElapsed = null;
    this.finishing = false;
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
    this.view = buildYardShell(root, this.model, this.audioControls);
    this.persistence.attachNotice((message) => this.showNotice(message));
    this.announcer = createEventAnnouncer({
      region: this.view.eventRegion,
      monotonicNow: dependencies.monotonicNow,
      minimumGapMs: 180,
    });
    this.audio = new LazyYardAudio({
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

  paint({ frameEvents = [], previousState = null } = {}) {
    paintYard(this.view, this.state, {
      store: this.persistence.store,
      elapsedMs: this.lifecycle.elapsed(),
      entryKind: this.entryKind,
      frameEvents,
      previousState,
    });
    this.lastFormattedElapsed = this.view.timer.textContent;
    this.refreshGhost();
  }
}

YardController.prototype.listenPassive = function listenPassive(target, type, listener) {
  target.addEventListener(type, listener);
  const cleanup = () => target.removeEventListener(type, listener);
  this.passiveCleanups.add(cleanup);
  return cleanup;
};

YardController.prototype.installPassiveHandlers = function installPassiveHandlers() {
  this.listenPassive(this.view.start, 'click', () => { void this.start('start'); });
  this.listenPassive(this.view.continueGame, 'click', () => {
    void this.start('continue');
  });
  this.listenPassive(this.view.resume, 'click', () => { void this.start('resume'); });
  this.listenPassive(this.view.restart, 'click', () => { void this.restart(); });
  this.listenPassive(this.view.newGame, 'click', () => {
    void this.replaceWith(this.mode, this.difficulty);
  });
  this.listenPassive(this.view.modeSelect, 'change', () => {
    void this.replaceWith(this.view.modeSelect.value, this.view.difficultySelect.value);
  });
  this.listenPassive(this.view.difficultySelect, 'change', () => {
    void this.replaceWith(this.view.modeSelect.value, this.view.difficultySelect.value);
  });
  this.listenPassive(this.view.panLeft, 'click', () => {
    this.view.scroll.scrollLeft -= 176;
  });
  this.listenPassive(this.view.panRight, 'click', () => {
    this.view.scroll.scrollLeft += 176;
  });
  // Delegated one-shot cleanup (mirrors kinnoki-stack-ui.js): the invalid-flash
  // cell class and the endless dispatch flash both self-clear on the very next
  // full repaint anyway, but this gives them a timely fade instead of waiting
  // for an unrelated repaint. Score pops are freshly-appended DOM nodes that
  // must be removed here or they would accumulate indefinitely.
  this.listenPassive(this.view.scroll, 'animationend', (event) => {
    const target = event.target;
    if (!target?.classList) return;
    target.classList.remove('yard-cell-invalid-flash', 'cargo-dispatching');
    if (target.classList.contains('game-score-pop')) target.remove();
  });
};
YardController.prototype.start = async function start(kind) {
  if (this.disposed || this.finished || kind !== this.entryKind) return false;
  try {
    return await this.lifecycle.start(kind);
  } catch (error) {
    this.fail(error);
    return false;
  }
};

YardController.prototype.activate = async function activate(kind, api) {
  const action = kind === 'start' ? { type: 'start' } : { type: 'resume' };
  const transition = this.engine.reduceYard(this.state, action);
  if (transition.state.status !== 'active') {
    throw new Error('Kinnoki Yard could not enter active play.');
  }
  this.state = transition.state;
  if (kind === 'start') {
    this.persistence.start({
      mode: this.mode,
      difficulty: this.difficulty,
      seed: this.seed,
      signature: this.signature,
      definition: this.definition,
      state: this.state,
    });
  } else {
    this.persistence.savePlay(this.state, this.lifecycle.elapsed());
  }
  if (kind === 'resume') await this.audio.resume();
  else await this.audio.start();
  this.entryKind = null;
  this.activeApi = api;
  this.registerActiveHandlers(api);
  for (const event of transition.events) this.announcer.announce(event);
  this.paint();
  if (kind !== 'start') this.focusCell(this.state.focus);
  api.requestActiveFrame(() => this.frame());
};

YardController.prototype.frame = function frame() {
  if (this.disposed || this.finished || this.lifecycle.state !== 'active') return;
  const formatted = formatElapsed(this.lifecycle.elapsed());
  if (formatted !== this.lastFormattedElapsed) {
    this.lastFormattedElapsed = formatted;
    this.view.timer.textContent = formatted;
  }
  this.activeApi.requestActiveFrame(() => this.frame());
};
YardController.prototype.cellOrigin = function cellOrigin(target) {
  if (!target?.getAttribute || target.getAttribute('data-yard-cell') == null) return null;
  return {
    row: Number(target.getAttribute('data-yard-row')),
    column: Number(target.getAttribute('data-yard-column')),
  };
};

YardController.prototype.setGhostOrigin = function setGhostOrigin(origin) {
  this.ghostOrigin = origin;
  this.refreshGhost();
};

YardController.prototype.refreshGhost = function refreshGhost() {
  for (const key of this.ghostKeys) {
    const [row, column] = key.split(':').map(Number);
    this.view.cells[row]?.[column]?.classList.remove('is-ghost-valid', 'is-ghost-invalid');
  }
  this.ghostKeys = new Set();
  if (!this.ghostOrigin || this.state.status !== 'active') return;
  const ghost = yardGhostAt(this.state, this.ghostOrigin);
  if (!ghost) return;
  for (const cell of ghost.cells) {
    const node = this.view.cells[cell.row]?.[cell.column];
    if (!node) continue;
    node.classList.add(ghost.valid ? 'is-ghost-valid' : 'is-ghost-invalid');
    this.ghostKeys.add(cellKey(cell.row, cell.column));
  }
};

YardController.prototype.flashInvalidCell = function flashInvalidCell(focus) {
  const node = this.view.cells[focus.row]?.[focus.column];
  if (!node) return;
  // Reduced motion: apply the existing static stripe class for one paint
  // cycle instead (self-clears on the next full repaint); default motion:
  // a one-shot animated class cleared via the delegated animationend
  // listener in installPassiveHandlers.
  if (prefersReducedMotion()) node.classList.add('yard-cell-invalid');
  else node.classList.add('yard-cell-invalid-flash');
};

YardController.prototype.registerActiveHandlers = function registerActiveHandlers(api) {
  api.listenActive(this.view.controls.rotate, 'click', () => {
    this.dispatch({ type: 'rotate-piece', quarterTurns: 1 },
      { type: 'piece', pieceId: this.state.selectedPieceId });
  });
  api.listenActive(this.view.controls.undo, 'click', () => {
    this.dispatch({ type: 'undo' }, { type: 'cell', focus: this.state.focus });
  });
  if (this.view.controls.hint) {
    api.listenActive(this.view.controls.hint, 'click', () => {
      this.dispatch({ type: 'hint' },
        { type: 'piece', pieceId: this.state.selectedPieceId });
    });
  }
  api.listenActive(this.view.controls.pause, 'click', () => {
    this.lifecycle.pause('user');
  });
  api.listenActive(this.view.tray, 'click', (event) => {
    const button = event.target?.closest?.('[data-yard-piece]');
    if (!button) return;
    const pieceId = Number(button.getAttribute('data-yard-piece'));
    this.dispatch({ type: 'select-piece', pieceId }, { type: 'piece', pieceId });
  });
  for (const row of this.view.cells) {
    for (const cell of row) {
      api.listenActive(cell, 'click', () => this.placeAtCell(cell));
      api.listenActive(cell, 'keydown', (event) => this.handleCellKey(event, cell));
    }
  }
  // Ghost preview: delegated on the board so a fresh selection/rotation
  // doesn't need per-cell re-binding. focusin bubbles natively; pointerenter
  // does not, so it is bound in the capture phase (fixture tests dispatch it
  // with bubbles:true by default, which this also satisfies).
  api.listenActive(this.view.grid, 'focusin', (event) => {
    this.setGhostOrigin(this.cellOrigin(event.target));
  });
  api.listenActive(this.view.grid, 'focusout', () => this.setGhostOrigin(null));
  api.listenActive(this.view.grid, 'pointerenter', (event) => {
    this.setGhostOrigin(this.cellOrigin(event.target));
  }, { capture: true });
  api.listenActive(this.view.grid, 'pointerleave', () => this.setGhostOrigin(null), {
    capture: true,
  });
  api.listenActive(this.document, 'keydown',
    (event) => this.handleDocumentKey(event));
};

YardController.prototype.placeAtCell = function placeAtCell(cell) {
  const row = Number(cell.getAttribute('data-yard-row'));
  const column = Number(cell.getAttribute('data-yard-column'));
  this.setFocus({ row, column }, false);
  this.dispatch({ type: 'place-piece', row, column },
    { type: 'cell', focus: { row, column } });
};

YardController.prototype.handleCellKey = function handleCellKey(event, cell) {
  const deltas = {
    ArrowUp: [-1, 0], ArrowDown: [1, 0],
    ArrowLeft: [0, -1], ArrowRight: [0, 1],
  };
  if (deltas[event.key]) {
    event.preventDefault();
    const row = Number(cell.getAttribute('data-yard-row'));
    const column = Number(cell.getAttribute('data-yard-column'));
    this.moveFocus(row, column, ...deltas[event.key]);
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    this.placeAtCell(cell);
  }
};

YardController.prototype.handleDocumentKey = function handleDocumentKey(event) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === 'Escape') {
    event.preventDefault();
    this.lifecycle.pause('user');
    return;
  }
  if (['INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(event.target?.tagName)) return;
  if (key === 'r') {
    event.preventDefault();
    this.dispatch({ type: 'rotate-piece', quarterTurns: 1 },
      { type: 'piece', pieceId: this.state.selectedPieceId });
  } else if (key === 'u') {
    event.preventDefault();
    this.dispatch({ type: 'undo' }, { type: 'cell', focus: this.state.focus });
  } else if (key === 'h' && this.mode === 'contracts') {
    event.preventDefault();
    this.dispatch({ type: 'hint' },
      { type: 'piece', pieceId: this.state.selectedPieceId });
  }
};
YardController.prototype.setFocus = function setFocus(focus, shouldFocus = true) {
  const result = this.engine.reduceYard(this.state, {
    type: 'set-focus', focus,
  });
  this.accept(result, shouldFocus ? { type: 'cell', focus } : null);
};

YardController.prototype.moveFocus = function moveFocus(row, column, dr, dc) {
  const targets = this.mode === 'contracts' ? contractTargetKeys(this.state) : null;
  let nextRow = row + dr;
  let nextColumn = column + dc;
  while (nextRow >= 0 && nextRow < this.definition.height
      && nextColumn >= 0 && nextColumn < this.definition.width) {
    const next = { row: nextRow, column: nextColumn };
    if (!targets || targets.has(cellKey(nextRow, nextColumn))) {
      this.setFocus(next);
      return;
    }
    nextRow += dr;
    nextColumn += dc;
  }
  this.focusCell(this.state.focus);
};

YardController.prototype.focusCell = function focusCell(focus) {
  this.view.cells[focus.row]?.[focus.column]?.focus();
};

YardController.prototype.focusPiece = function focusPiece(pieceId) {
  this.view.tray.querySelector(
    '[data-yard-piece="' + pieceId + '"]',
  )?.focus();
};

YardController.prototype.restoreFocus = function restoreFocus(target) {
  if (!target || this.state.status !== 'active') return;
  if (target.type === 'piece') this.focusPiece(target.pieceId);
  else this.focusCell(target.focus);
};

YardController.prototype.dispatch = function dispatch(action, focusTarget) {
  if (this.state.status !== 'active' || this.disposed || this.finished) return;
  try {
    this.accept(this.engine.reduceYard(this.state, action), focusTarget);
  } catch (error) {
    this.fail(error);
  }
};

YardController.prototype.accept = function accept(result, focusTarget) {
  const fatal = result.events.find((event) => event.type === 'error');
  if (fatal) {
    this.state = result.state;
    this.fail(new Error(fatal.message));
    return;
  }
  const previousState = this.state;
  const changed = result.state !== this.state;
  this.state = result.state;
  const invalid = result.events.find((event) => event.type === 'invalid');
  if (changed) this.persistence.savePlay(this.state, this.lifecycle.elapsed());
  for (const event of result.events) {
    this.announcer.announce(event);
    const effect = yardEffectForEvent(event);
    if (effect) this.audio.playEffect(effect);
  }
  this.paint({ frameEvents: result.events, previousState });
  this.restoreFocus(focusTarget);
  if (invalid && focusTarget?.type === 'cell') this.flashInvalidCell(focusTarget.focus);
  if (this.state.status === 'terminal') this.finishTerminal();
};
YardController.prototype.snapshot = function snapshot() {
  if (this.persistence.store.runs[GAME]) {
    this.persistence.savePlay(this.state, this.lifecycle.elapsed());
  }
};

YardController.prototype.handlePause = function handlePause(reason) {
  if (this.state.status !== 'active') return;
  const result = this.engine.reduceYard(this.state, {
    type: 'pause', reason,
  });
  this.state = result.state;
  this.entryKind = 'resume';
  this.activeApi = null;
  this.persistence.savePlay(this.state, this.lifecycle.elapsed());
  for (const event of result.events) this.announcer.announce(event);
  void this.audio.pause();
  this.paint();
  this.view.resume.focus();
};

YardController.prototype.focusEntryControl = function focusEntryControl() {
  const target = this.entryKind === 'continue'
    ? this.view.continueGame
    : this.entryKind === 'resume' ? this.view.resume : this.view.start;
  target.focus();
};

YardController.prototype.remount = async function remount(store, options) {
  this.dispose();
  const next = await mountYard(
    this.root, store, this.dependencies, this.slot, options,
  );
  this.slot.current = next;
};

YardController.prototype.restart = async function restart() {
  if (this.disposed || this.finished) return;
  const run = this.persistence.store.runs[GAME];
  if (run) this.persistence.abandon(run.signature);
  await this.remount(this.persistence.store, {
    forcedMode: this.mode,
    forcedDifficulty: this.difficulty,
    previewDefinition: this.definition,
  });
};

YardController.prototype.replaceWith = async function replaceWith(mode, difficulty) {
  if (!MODES.includes(mode) || !DIFFICULTIES.includes(difficulty)
      || this.disposed) return;
  const run = this.persistence.store.runs[GAME];
  if (run) {
    const accepted = this.dependencies.confirm(
      'Replace the current ' + modeLabel(this.mode)
        + '? The unfinished game will not count.',
    );
    if (!accepted) {
      this.view.modeSelect.value = this.mode;
      this.view.difficultySelect.value = this.difficulty;
      if (this.entryKind) this.focusEntryControl();
      return;
    }
  }
  const abandonedSignature = run?.signature ?? this.signature;
  if (run) this.persistence.abandon(run.signature);
  await this.remount(this.persistence.store, {
    forcedMode: mode,
    forcedDifficulty: difficulty,
    abandonedSignature,
  });
};
const validCompletionPayload = (payload, state) => {
  const summary = payload?.summary;
  const records = payload?.records;
  const recordValues = state.kind === 'contracts'
    ? [records?.time, records?.moves]
    : [records?.score, records?.combo];
  const summaryValues = state.kind === 'contracts'
    ? [summary?.elapsedMs, summary?.moves, summary?.piecesPlaced, summary?.totalPieces]
    : [summary?.elapsedMs, summary?.score, summary?.dispatchedManifests, summary?.bestCombo];
  return payload?.game === GAME && payload.mode === state.kind
    && [...recordValues, ...summaryValues].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    )
    && summary.assisted === state.assisted
    && (state.kind !== 'endless' || summary.reason === 'no-placement');
};

YardController.prototype.finishTerminal = function finishTerminal() {
  if (this.finishing || this.finished || this.disposed) return;
  this.finishing = true;
  let payload;
  let recordsBroken = [];
  try {
    const elapsedMs = this.lifecycle.elapsed();
    payload = this.engine.yardCompletionPayload(this.state, elapsedMs);
    if (!payload) {
      throw new Error('Kinnoki Yard ended without a completion payload.');
    }
    if (!validCompletionPayload(payload, this.state)) {
      throw new Error('Kinnoki Yard ended with an invalid completion payload.');
    }
    recordsBroken = this.persistence.complete(payload.mode, payload.records, this.state);
    if (!this.lifecycle.finish()) {
      throw new Error('Kinnoki Yard completion lifecycle could not settle.');
    }
  } catch (error) {
    this.finishing = false;
    this.fail(error);
    return;
  }
  this.finished = true;
  this.finishing = false;
  this.entryKind = null;
  this.audio.finish(this.mode === 'contracts' ? 'completion' : 'terminal');
  makeGameTerminal(this.root);

  const heading = element('h2', {
    'data-complete-heading': '', tabindex: '-1',
    text: this.mode === 'contracts' ? 'Contract complete' : 'Yard run complete',
  });
  const recordLine = recordsBroken.length ? element('p', {
    class: 'game-complete-record',
    'data-complete-records': '',
    text: recordsBroken.map((key) => RECORD_LABELS[key] ?? key).join(' · '),
  }) : null;
  const text = this.mode === 'contracts'
    ? formatElapsed(payload.summary.elapsedMs) + ' · ' + payload.summary.moves
      + ' moves · ' + payload.summary.piecesPlaced + '/'
      + payload.summary.totalPieces + ' cargo pieces'
    : payload.summary.score.toLocaleString('en-CA') + ' points · '
      + payload.summary.dispatchedManifests + ' manifests · best combo '
      + payload.summary.bestCombo + '× · ' + formatElapsed(payload.summary.elapsedMs);
  const summary = element('p', {
    text: text + (payload.summary.assisted ? ' · assisted' : ' · unassisted'),
  });
  const playAgain = element('button', {
    type: 'button', 'data-play-another': '',
    text: this.mode === 'contracts' ? 'New Puzzle' : 'New Yard',
  });
  this.view.shell.append(element(
    'section', { class: 'game-complete' }, heading, recordLine, summary, playAgain,
  ));
  this.listenPassive(playAgain, 'click', () => {
    void this.replaceWith(this.mode, this.difficulty);
  });
  if (recordsBroken.length > 0) celebrate({ root: this.root });
  heading.focus();
};

YardController.prototype.fail = function fail(error) {
  if (this.disposed || this.finished || this.errorRendered) return;
  const failure = error instanceof Error ? error : new Error(String(error));
  this.lifecycle.fail(failure);
};

YardController.prototype.renderError = function renderError(error) {
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
    title: 'Kinnoki Yard paused',
    message: error.message || 'This game could not continue safely.',
    newGameHref: '/games/kinnoki-yard?mode=' + this.mode
      + '&difficulty=' + this.difficulty,
  });
};

YardController.prototype.cleanup = function cleanup() {
  if (this.disposed) return;
  this.disposed = true;
  for (const cleanup of this.passiveCleanups) cleanup();
  this.passiveCleanups.clear();
  this.announcer.dispose();
  this.audioControls.dispose();
  void this.audio.dispose();
};

YardController.prototype.dispose = function dispose() {
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
  engine: dependencies.engine ?? defaultYardEngine,
});

async function mountYard(root, initialStore, dependencies, slot, options = {}) {
  const persistence = new YardPersistence({
    storage: dependencies.storage,
    store: initialStore,
    wallNow: dependencies.wallNow,
  });
  const params = new URLSearchParams(globalThis.location?.search ?? '');
  const requestedMode = options.forcedMode ?? params.get('mode');
  const requestedDifficulty = options.forcedDifficulty ?? params.get('difficulty');
  let mode = MODES.includes(requestedMode) ? requestedMode : 'contracts';
  let difficulty = DIFFICULTIES.includes(requestedDifficulty)
    ? requestedDifficulty : 'easy';
  let abandonedSignature = options.abandonedSignature ?? null;
  let focusRetainedEntry = false;
  const existing = persistence.store.runs[GAME];

  try {
    if (existing && !options.previewDefinition) {
      if (!validStoredYardRun(existing, dependencies.engine)) {
        persistence.abandon(existing.signature);
        throw new Error('Saved Kinnoki Yard state is invalid.');
      }
      if (existing.mode !== mode || existing.difficulty !== difficulty) {
        const accepted = dependencies.confirm(
          'Replace the saved ' + modeLabel(existing.mode) + ' · '
            + titleCase(existing.difficulty) + ' game?',
        );
        if (accepted) {
          abandonedSignature = existing.signature;
          persistence.abandon(existing.signature);
        } else {
          mode = existing.mode;
          difficulty = existing.difficulty;
          focusRetainedEntry = true;
        }
      }
    }

    const model = selectYardModel({
      store: persistence.store,
      mode,
      difficulty,
      seedFactory: dependencies.seedFactory,
      engine: dependencies.engine,
      abandonedSignature,
      previewDefinition: options.previewDefinition ?? null,
    });
    const controller = new YardController({
      root, model, persistence, dependencies, slot,
    });
    if (focusRetainedEntry) controller.focusEntryControl();
    return controller;
  } catch (error) {
    renderGameError(root, {
      title: 'Kinnoki Yard paused',
      message: error.message || 'A new Yard game could not be prepared.',
      newGameHref: '/games/kinnoki-yard?mode=' + mode
        + '&difficulty=' + difficulty,
    });
    return { dispose() {} };
  }
}

export async function renderKinnokiYard(root, store, dependencies = {}) {
  const slot = { current: null };
  const resolved = normalizedDependencies(dependencies);
  const publicController = {
    dispose() { slot.current?.dispose(); },
  };
  slot.current = await mountYard(root, store, resolved, slot);
  return publicController;
}

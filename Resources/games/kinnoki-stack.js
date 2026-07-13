import { createRng, indexedSeed, saturatingAdd } from './core.js';
import {
  CARGO_CATALOG, ManifestGenerationError, boundsFor, canPlace,
  connectedComponents, dispatchCompletedManifests, placePiece, rotationsFor,
  selectNextManifestZones, validateBoard, validateManifest,
} from './cargo-geometry.js';

const STACK_WIDTH = 12;
const STACK_HEIGHT = 18;
const STACK_DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);

export const STACK_CONFIG = Object.freeze({
  easy: Object.freeze({ fallMs: 900, lockDelayMs: 850, previewCount: 3, cargoCount: 6, manifestCount: 1, manifestShapeIds: Object.freeze(['rectangle-eight']), tideRange: null, tideWarnings: Object.freeze([]) }),
  medium: Object.freeze({ fallMs: 650, lockDelayMs: 600, previewCount: 2, cargoCount: 12, manifestCount: 2, manifestShapeIds: Object.freeze(['rectangle-six', 'rectangle-eight', 'step-five', 'step-seven']), tideRange: Object.freeze([6, 8]), tideWarnings: Object.freeze([3, 1]) }),
  hard: Object.freeze({ fallMs: 420, lockDelayMs: 420, previewCount: 1, cargoCount: 12, manifestCount: 2, manifestShapeIds: Object.freeze(['step-five', 'step-seven', 'corner-six', 'harbour-seven']), tideRange: Object.freeze([4, 5]), tideWarnings: Object.freeze([2, 1]) }),
});
export const STACK_MAX_FRAME_DELTA_MS = 250;

export function createStackDefinition({ difficulty, seed }) {
  if (!STACK_DIFFICULTIES.includes(difficulty) || !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new TypeError('Invalid Kinnoki Stack definition request');
  return Object.freeze({ version: 1, game: 'kinnoki-stack', mode: 'default', difficulty, seed: seed >>> 0, width: STACK_WIDTH, height: STACK_HEIGHT });
}
export function stackDefinitionSignature(definition) {
  return JSON.stringify([definition.version, definition.game, definition.mode, definition.difficulty, definition.seed, definition.width, definition.height]);
}

const emptyStackBoard = () => Array.from({ length: STACK_HEIGHT }, () => Array(STACK_WIDTH).fill(null));
const cargoForIndex = (definition, sequenceIndex) => {
  const config = STACK_CONFIG[definition.difficulty];
  const rng = createRng(indexedSeed(definition.seed, 'cargo', sequenceIndex));
  const cargo = CARGO_CATALOG[rng.int(config.cargoCount)];
  const rotation = rotationsFor(cargo.id).find((candidate) => candidate.rotation === 0);
  return { pieceId: sequenceIndex, typeId: cargo.id, rotation: 0, sequenceIndex, bounds: boundsFor(rotation.cells) };
};
const activeAtSpawn = (descriptor) => ({ ...descriptor, row: 0, column: Math.floor((STACK_WIDTH - descriptor.bounds.width) / 2) });
const tideForEvent = (definition, eventIndex) => {
  const range = STACK_CONFIG[definition.difficulty].tideRange;
  if (range === null) return { direction: null, placementsRemaining: null, eventIndex };
  const rng = createRng(indexedSeed(definition.seed, 'tide', eventIndex));
  return { direction: rng.int(2) === 0 ? 'left' : 'right', placementsRemaining: range[0] + rng.int(range[1] - range[0] + 1), eventIndex };
};
const cloneSerializable = (value) => JSON.parse(JSON.stringify(value));
const manifestProvenanceFor = (manifests, nextIndex) => ({
  nextIndex,
  manifests: cloneSerializable(manifests),
});

export function createStackState(definition) {
  let expectedDefinition;
  try { expectedDefinition = createStackDefinition({ difficulty: definition?.difficulty, seed: definition?.seed }); } catch {}
  if (!expectedDefinition || JSON.stringify(definition) !== JSON.stringify(expectedDefinition)) throw new TypeError('Invalid Kinnoki Stack definition');
  const config = STACK_CONFIG[definition.difficulty];
  const board = emptyStackBoard();
  const selected = selectNextManifestZones({ board, width: STACK_WIDTH, height: STACK_HEIGHT, shapeIds: config.manifestShapeIds, seed: definition.seed, startIndex: 0, count: config.manifestCount });
  const active = activeAtSpawn(cargoForIndex(definition, 0));
  const preview = Array.from({ length: config.previewCount }, (_, offset) => cargoForIndex(definition, offset + 1));
  return { definition, difficulty: definition.difficulty, width: STACK_WIDTH, height: STACK_HEIGHT, status: 'preview', board, active, preview, sequenceIndex: 0, nextPieceId: config.previewCount + 1, manifests: selected.manifests, manifestIndex: selected.nextIndex, manifestProvenance: manifestProvenanceFor(selected.manifests, selected.nextIndex), tide: tideForEvent(definition, 0), components: [], score: 0, combo: 0, bestCombo: 0, dispatchedManifests: 0, placements: 0, assisted: false, stepMode: false, grounded: null, gravityAccumulatorMs: 0, terminalReason: null };
}
export function prepareStackForContinue(play) {
  if (!['active', 'paused'].includes(play?.status) || !validateStackState(play, play?.difficulty).valid) throw new TypeError('Saved Kinnoki Stack state is invalid');
  return { ...cloneSerializable(play), status: 'paused' };
}

function applyTide(board, direction) {
  const columnDelta = direction === 'right' ? 1 : -1;
  const components = connectedComponents(board).sort((left, right) => direction === 'right' ? right.maxColumn - left.maxColumn || right.id.localeCompare(left.id) : left.minColumn - right.minColumn || left.id.localeCompare(right.id));
  const working = board.map((row) => [...row]);
  let movedComponents = 0;
  for (const component of components) {
    const cargo = component.cells.map(({ row, column }) => ({ row, column, value: working[row][column] }));
    for (const { row, column } of cargo) working[row][column] = null;
    const destination = cargo.map(({ row, column, value }) => ({ row, column: column + columnDelta, value }));
    const canMove = destination.every(({ row, column }) => row >= 0 && row < STACK_HEIGHT && column >= 0 && column < STACK_WIDTH && working[row][column] === null);
    for (const { row, column, value } of canMove ? destination : cargo) working[row][column] = value;
    if (canMove) movedComponents += 1;
  }
  return { board: working, movedComponents };
}

function placeAndApplyTide(state) {
  const rotation = rotationsFor(state.active.typeId).find((candidate) => candidate.rotation === state.active.rotation);
  const placementScore = 10 * rotation.cells.length;
  let board = placePiece(state.board, state.active);
  let tide = state.tide;
  const events = [{ type: 'placed', pieceId: state.active.pieceId, cellCount: rotation.cells.length, scoreAdded: placementScore }];
  if (STACK_CONFIG[state.difficulty].tideRange !== null) {
    tide = { ...tide, placementsRemaining: tide.placementsRemaining - 1 };
    if (tide.placementsRemaining === 0) {
      const shifted = applyTide(board, tide.direction);
      board = shifted.board;
      events.push({ type: 'tide-shift', direction: tide.direction, movedComponents: shifted.movedComponents });
      tide = tideForEvent(state.definition, tide.eventIndex + 1);
    }
    if (STACK_CONFIG[state.difficulty].tideWarnings.includes(tide.placementsRemaining)) events.push({ type: 'tide-warning', direction: tide.direction, placementsRemaining: tide.placementsRemaining });
  }
  return { board, tide, events, score: saturatingAdd(state.score, placementScore), placements: saturatingAdd(state.placements, 1) };
}

function resolveManifests(state, board, score, events) {
  const dispatched = dispatchCompletedManifests(board, state.manifests);
  if (dispatched.completed.length === 0) {
    if (state.combo > 0) events.push({ type: 'combo-reset', previousCombo: state.combo });
    return { board, manifests: state.manifests, manifestIndex: state.manifestIndex, manifestProvenance: state.manifestProvenance, components: connectedComponents(board), score, combo: 0, bestCombo: state.bestCombo, dispatchedManifests: state.dispatchedManifests, error: null };
  }
  const combo = saturatingAdd(state.combo, 1);
  const dispatchScore = Math.min(Number.MAX_SAFE_INTEGER, 100 * dispatched.dispatchedCells * combo);
  events.push({ type: 'dispatch', manifestIds: dispatched.completed.map(({ id }) => id), cells: dispatched.dispatchedCells, combo, scoreAdded: dispatchScore });
  const incomplete = state.manifests.filter((manifest) => !dispatched.completed.some(({ id }) => id === manifest.id));
  const result = { board: dispatched.board, manifests: incomplete, manifestIndex: state.manifestIndex, manifestProvenance: manifestProvenanceFor(incomplete, state.manifestIndex), components: connectedComponents(dispatched.board), score: saturatingAdd(score, dispatchScore), combo, bestCombo: Math.max(state.bestCombo, combo), dispatchedManifests: saturatingAdd(state.dispatchedManifests, dispatched.completed.length), error: null };
  try {
    const replacement = selectNextManifestZones({ board: dispatched.board, width: STACK_WIDTH, height: STACK_HEIGHT, shapeIds: STACK_CONFIG[state.difficulty].manifestShapeIds, seed: state.definition.seed, startIndex: state.manifestIndex, count: dispatched.completed.length, occupied: incomplete });
    const manifests = [...incomplete, ...replacement.manifests];
    return { ...result, manifests, manifestIndex: replacement.nextIndex, manifestProvenance: manifestProvenanceFor(manifests, replacement.nextIndex) };
  } catch (error) {
    if (!(error instanceof ManifestGenerationError)) throw error;
    return { ...result, error: { type: 'error', code: 'manifest-generation', message: 'A new Cargo Manifest could not be prepared.' } };
  }
}

const terminalState = (state, reason) => ({ ...state, status: 'terminal', active: null, grounded: null, gravityAccumulatorMs: 0, terminalReason: reason });
function spawnNext(state, events) {
  const nextDescriptor = state.preview[0];
  const appended = cargoForIndex(state.definition, state.nextPieceId);
  const preview = [...state.preview.slice(1), appended];
  const active = activeAtSpawn(nextDescriptor);
  const rotation = rotationsFor(active.typeId).find((candidate) => candidate.rotation === active.rotation);
  if (!canPlace(state.board, rotation.cells, active)) return { state: terminalState(state, 'spawn-blocked'), events: [...events, { type: 'terminal', reason: 'spawn-blocked' }] };
  return { state: { ...state, active, preview, sequenceIndex: nextDescriptor.sequenceIndex, nextPieceId: state.nextPieceId + 1, grounded: null, gravityAccumulatorMs: 0 }, events: [...events, { type: 'spawned', pieceId: active.pieceId, typeId: active.typeId, preview }] };
}
function lockActive(state) {
  const placed = placeAndApplyTide(state);
  const events = [...placed.events];
  const resolved = resolveManifests(state, placed.board, placed.score, events);
  const settled = { ...state, board: resolved.board, manifests: resolved.manifests, manifestIndex: resolved.manifestIndex, manifestProvenance: resolved.manifestProvenance, tide: placed.tide, components: resolved.components, score: resolved.score, combo: resolved.combo, bestCombo: resolved.bestCombo, dispatchedManifests: resolved.dispatchedManifests, placements: placed.placements, active: null, grounded: null, gravityAccumulatorMs: 0 };
  if (resolved.error !== null) return { state: { ...settled, status: 'error' }, events: [...events, resolved.error] };
  if (settled.board[0].some(Boolean) || settled.board[1].some(Boolean)) return { state: terminalState(settled, 'crane-line'), events: [...events, { type: 'terminal', reason: 'crane-line' }] };
  return spawnNext(settled, events);
}

const invalid = (state, action, reason) => ({ state, events: [{ type: 'invalid', action, reason }] });
const canUseActive = (state, active) => {
  const rotation = rotationsFor(active.typeId).find((candidate) => candidate.rotation === active.rotation);
  return rotation !== undefined && canPlace(state.board, rotation.cells, active);
};
const movedState = (state, active, source) => ({ state: { ...state, active }, events: [{ type: 'moved', source, row: active.row, column: active.column }] });
function rotateActive(state) {
  const rotations = rotationsFor(state.active.typeId);
  const current = rotations.findIndex(({ rotation }) => rotation === state.active.rotation);
  const nextRotation = rotations[(current + 1) % rotations.length];
  const active = { ...state.active, rotation: nextRotation.rotation, bounds: boundsFor(nextRotation.cells) };
  if (!canPlace(state.board, nextRotation.cells, active)) return invalid(state, 'rotate', 'Cargo cannot rotate here.');
  return { state: { ...state, active }, events: [{ type: 'rotated', pieceId: active.pieceId, rotation: active.rotation }] };
}
function reduceActiveStack(state, action) {
  if (action.type === 'move') {
    if (![-1, 1].includes(action.deltaColumn)) return invalid(state, 'move', 'Move must be one column.');
    const active = { ...state.active, column: state.active.column + action.deltaColumn };
    return canUseActive(state, active) ? movedState(state, active, 'player') : invalid(state, 'move', 'Cargo cannot move there.');
  }
  if (action.type === 'rotate') return action.quarterTurns === 1 ? rotateActive(state) : invalid(state, 'rotate', 'Rotation must be one quarter turn.');
  if (action.type === 'soft-drop') {
    const active = { ...state.active, row: state.active.row + 1 };
    return canUseActive(state, active) ? movedState(state, active, 'player') : invalid(state, 'soft-drop', 'Cargo cannot descend.');
  }
  if (action.type === 'hard-drop') {
    let active = state.active;
    while (canUseActive(state, { ...active, row: active.row + 1 })) active = { ...active, row: active.row + 1 };
    return lockActive({ ...state, active });
  }
  return invalid(state, String(action.type), 'Action is not available.');
}
export function reduceStack(state, action) {
  if (['terminal', 'error', 'disposed'].includes(state.status)) return { state, events: [] };
  if (state.status !== 'active') return invalid(state, String(action?.type), 'Start or resume the run first.');
  return reduceActiveStack(state, action ?? {});
}

const nonNegativeSafeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const nonNegativeFinite = (value) => Number.isFinite(value) && value >= 0;
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
export function validateStackState(value, difficulty) {
  const errors = [];
  const config = STACK_CONFIG[difficulty];
  let definitionValid = false;
  try { definitionValid = sameJson(value?.definition, createStackDefinition({ difficulty, seed: value?.definition?.seed })); } catch {}
  if (!config || !definitionValid || value?.difficulty !== difficulty || value?.width !== STACK_WIDTH || value?.height !== STACK_HEIGHT) errors.push('invalid definition');
  if (!['preview', 'active', 'paused'].includes(value?.status) || value?.terminalReason !== null) errors.push('state is not resumable');
  const boardResult = validateBoard(value?.board, { width: STACK_WIDTH, height: STACK_HEIGHT });
  errors.push(...boardResult.errors);
  const definition = value?.definition;
  const active = value?.active;
  try {
    if (!definition || !nonNegativeSafeInteger(active?.sequenceIndex) || active?.pieceId !== active.sequenceIndex || active.sequenceIndex !== value?.sequenceIndex) throw new TypeError('Invalid active identity');
    const expected = cargoForIndex(definition, active.sequenceIndex);
    const rotation = rotationsFor(active.typeId).find((candidate) => candidate.rotation === active.rotation);
    if (expected.typeId !== active.typeId || !rotation || !sameJson(boundsFor(rotation.cells), active.bounds) || !Number.isInteger(active.row) || !Number.isInteger(active.column) || !canPlace(value.board, rotation.cells, active)) throw new TypeError('Invalid active geometry');
  } catch { errors.push('invalid active cargo'); }
  let validPreview = Array.isArray(value?.preview) && value.preview.length === config?.previewCount;
  try { validPreview = validPreview && value.preview.every((piece, offset) => { const sequenceIndex = value.sequenceIndex + offset + 1; return nonNegativeSafeInteger(sequenceIndex) && piece?.pieceId === sequenceIndex && piece?.sequenceIndex === sequenceIndex && sameJson(piece, cargoForIndex(definition, sequenceIndex)); }); } catch { validPreview = false; }
  if (!validPreview || value.nextPieceId !== value.sequenceIndex + config?.previewCount + 1) errors.push('invalid preview queue');
  const manifestCells = new Set();
  if (!Array.isArray(value?.manifests) || value.manifests.length !== config?.manifestCount) errors.push('invalid manifest count');
  else for (const manifest of value.manifests) {
    const result = validateManifest(manifest, { width: STACK_WIDTH, height: STACK_HEIGHT });
    if (!result.valid) errors.push(...result.errors);
    for (const { row, column } of manifest.cells ?? []) { const key = row + ':' + column; if (manifestCells.has(key)) errors.push('overlapping manifests'); manifestCells.add(key); }
  }
  const provenance = value?.manifestProvenance;
  const manifestIdsMatchIndex = Array.isArray(value?.manifests)
    && value.manifests.every(({ id } = {}) => {
      const match = /^manifest-(\d+)-(\d+)$/.exec(id);
      return match !== null && Number(match[1]) < value?.manifestIndex;
    });
  if (!sameJson(provenance?.manifests, value?.manifests)
      || provenance?.nextIndex !== value?.manifestIndex
      || !manifestIdsMatchIndex) {
    errors.push('invalid manifest provenance');
  }
  if (value?.placements === 0) {
    try {
      const initial = selectNextManifestZones({
        board: emptyStackBoard(), width: STACK_WIDTH, height: STACK_HEIGHT,
        shapeIds: config.manifestShapeIds, seed: definition.seed,
        startIndex: 0, count: config.manifestCount,
      });
      if (!sameJson(value.manifests, initial.manifests)
          || value.manifestIndex !== initial.nextIndex) {
        errors.push('invalid initial manifests');
      }
    } catch {
      errors.push('invalid initial manifests');
    }
  }
  const counters = [value?.score, value?.combo, value?.bestCombo, value?.dispatchedManifests, value?.placements, value?.sequenceIndex, value?.nextPieceId, value?.manifestIndex];
  if (counters.some((counter) => !nonNegativeSafeInteger(counter)) || value.bestCombo < value.combo || !nonNegativeFinite(value?.gravityAccumulatorMs) || typeof value.assisted !== 'boolean' || typeof value.stepMode !== 'boolean') errors.push('invalid counters');
  let tideValid = false;
  try { tideValid = nonNegativeSafeInteger(value?.tide?.eventIndex) && sameJson(value.tide, tideForEvent(definition, value.tide.eventIndex)); } catch {}
  if (!tideValid) errors.push('invalid tide forecast');
  const grounded = value?.grounded;
  const validGrounded = grounded === null || grounded?.kind === 'automatic' && nonNegativeFinite(grounded.remainingMs) && grounded.remainingMs <= config?.lockDelayMs || grounded?.kind === 'step' && grounded.blockedOnce === true;
  if (!validGrounded) errors.push('invalid grounded state');
  const expectedComponents = connectedComponents(value?.board ?? []);
  if (!sameJson(value?.components, expectedComponents)) errors.push('invalid connected components');
  return { valid: errors.length === 0, errors };
}

export function describeStack(state) {
  const cargo = CARGO_CATALOG.find(({ id }) => id === state.active?.typeId);
  const occupiedRows = state.board.map((row, index) => row.some(Boolean) ? index : null).filter((row) => row !== null);
  const stackHeight = occupiedRows.length === 0 ? 0 : STACK_HEIGHT - Math.min(...occupiedRows);
  const fills = state.manifests.map((manifest) => manifest.cells.filter(({ row, column }) => state.board[row][column] !== null).length + ' of ' + manifest.cells.length).join(', ');
  const tide = state.tide.direction === null ? 'no tide' : state.tide.direction + ' tide in ' + state.tide.placementsRemaining + ' placements';
  const position = state.active === null ? 'no active cargo' : cargo.label + ' at row ' + (state.active.row + 1) + ', column ' + (state.active.column + 1) + ', rotation ' + state.active.rotation;
  return position + '; stack height ' + stackHeight + '; manifests ' + fills + '; score ' + state.score + '; ' + tide + '.';
}
export function stackCompletionPayload(state, elapsedMs) {
  if (state.status !== 'terminal') return null;
  if (!nonNegativeSafeInteger(elapsedMs)) throw new TypeError('Elapsed time must be a non-negative safe integer');
  return { game: 'kinnoki-stack', mode: 'default', records: { score: state.score, combo: state.bestCombo }, summary: { score: state.score, dispatchedManifests: state.dispatchedManifests, bestCombo: state.bestCombo, elapsedMs, assisted: state.assisted, reason: state.terminalReason } };
}

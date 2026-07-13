import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENDLESS_RULES, createEndlessDefinition, createEndlessState, createYardState, endlessSignature,
  hasAnyEndlessPlacement, reduceEndless, validateEndlessState,
  prepareYardForContinue, reduceYard, validateYardState, yardCompletionPayload,
  yardDefinitionSignature,
} from '../../Resources/games/kinnoki-yard.js';
import { canPlace, rotationsFor } from '../../Resources/games/cargo-geometry.js';

const endlessState = (difficulty, seed) => (
  createEndlessState(createEndlessDefinition({ difficulty, seed }))
);

test('Endless deals deterministic batches of exactly three', () => {
  const first = endlessState('medium', 7);
  const second = endlessState('medium', 7);
  assert.deepEqual(first.tray, second.tray);
  assert.equal(first.tray.length, 3);
  assert.equal(new Set(first.tray.map((piece) => piece.pieceId)).size, 3);
  assert.notEqual(
    endlessSignature(createEndlessDefinition({ difficulty: 'medium', seed: 7 })),
    endlessSignature(createEndlessDefinition({ difficulty: 'medium', seed: 8 })),
  );
  assert.throws(() => createEndlessDefinition({ difficulty: 'easy', seed: -1 }), TypeError);
  assert.throws(() => createEndlessDefinition({
    difficulty: 'easy', seed: 0x1_0000_0000,
  }), TypeError);
});

test('terminal detection checks every remaining piece rotation', () => {
  const state = endlessState('hard', 11);
  const board = Array.from({ length: 8 }, (_, row) => (
    Array.from({ length: 8 }, (_, column) => (
      (column === 3 && (row === 3 || row === 4))
        ? null : { pieceId: 700 + (row * 8) + column, typeId: 'crate-pair' }
    ))
  ));
  const fixture = {
    ...state, status: 'active', board,
    tray: [{
      pieceId: 90, typeId: 'crate-pair', allowedRotations: [0, 1],
      rotation: 0, batchIndex: 0,
    }],
    selectedPieceId: 90,
  };
  assert.equal(canPlace(board, rotationsFor('crate-pair', [0])[0].cells,
    { row: 3, column: 3 }), false);
  assert.equal(canPlace(board, rotationsFor('crate-pair', [1])[0].cells,
    { row: 3, column: 3 }), true);
  assert.equal(hasAnyEndlessPlacement(fixture), true);
});

const rectangleEight = (id, row, column) => ({
  id, shapeId: 'rectangle-eight', rotation: 0, origin: { row, column },
  label: 'Eight-cell manifest', pattern: 'bands',
  cells: [0, 1].flatMap((rowOffset) => [0, 1, 2, 3].map((columnOffset) => ({
    row: row + rowOffset, column: column + columnOffset,
  }))),
});

test('Endless Undo restores scoring, batches, manifests, and stream indices exactly', () => {
  const base = endlessState('easy', 17);
  const board = base.board.map((row) => [...row]);
  for (let column = 0; column < 4; column += 1) {
    board[8][column] = { pieceId: 40, typeId: 'dock-square' };
  }
  board[9][0] = { pieceId: 41, typeId: 'crate-pair' };
  board[9][1] = { pieceId: 41, typeId: 'crate-pair' };
  const fixture = {
    ...base, status: 'active', board,
    tray: [{
      pieceId: 2, typeId: 'crate-pair', allowedRotations: [0, 1],
      rotation: 0, batchIndex: 0,
    }],
    selectedPieceId: 2,
    manifests: [rectangleEight('manifest-undo', 8, 0)],
    manifestIndex: 1,
    sequenceIndex: 3,
    batchIndex: 0,
    score: 100,
    combo: 1,
    bestCombo: 1,
    dispatchedManifests: 0,
  };
  const snapshot = structuredClone(fixture);
  let result = reduceEndless(fixture, { type: 'place-piece', row: 9, column: 2 });
  assert.equal(result.state.tray.length, 3);
  assert.equal(result.state.combo, 2);
  assert.equal(result.state.dispatchedManifests, 1);
  assert.ok(result.state.sequenceIndex > snapshot.sequenceIndex);
  result = reduceEndless(result.state, { type: 'undo' });
  for (const key of [
    'board', 'tray', 'manifests', 'score', 'combo', 'bestCombo',
    'batchIndex', 'sequenceIndex', 'manifestIndex', 'dispatchedManifests',
  ]) assert.deepEqual(result.state[key], snapshot[key], key);
  assert.equal(result.state.assisted, true);
  assert.deepEqual(result.events, [
    { type: 'assisted', reason: 'endless-undo' },
    { type: 'undone', mode: 'endless', assisted: true },
  ]);
  assert.equal(result.state.history.length, 0);
  const duplicate = reduceEndless(result.state, { type: 'undo' });
  assert.equal(duplicate.state, result.state);

  const hint = reduceEndless(result.state, { type: 'hint' });
  assert.equal(hint.state, result.state);
  assert.deepEqual(hint.events, [{
    type: 'invalid', action: 'hint', reason: 'Hint is unavailable in Endless Yard.',
  }]);
});

test('Endless validator isolates forged state and mismatched difficulty', () => {
  const state = endlessState('medium', 22);
  assert.deepEqual(validateEndlessState(state, 'medium'), { valid: true, errors: [] });
  assert.equal(validateEndlessState({
    ...state, tray: [{ ...state.tray[0], pieceId: 'string-id' }],
  }, 'medium').valid, false);
  assert.equal(validateEndlessState({ ...state, status: 'terminal' }, 'medium').valid, false);
  assert.equal(validateEndlessState({
    ...state, selectedPieceId: 999,
  }, 'medium').valid, false);
  assert.equal(validateEndlessState({
    ...state, tray: [{ ...state.tray[0],
      typeId: state.tray[0].typeId === 'crate-pair' ? 'anchor-five' : 'crate-pair' },
    ...state.tray.slice(1)],
  }, 'medium').valid, false);
  assert.equal(validateEndlessState({
    ...state, bestCombo: 0, combo: 1,
  }, 'medium').valid, false);
  const forgedHistory = [{
    board: state.board, tray: state.tray, selectedPieceId: state.selectedPieceId,
    focus: state.focus, manifests: state.manifests, manifestIndex: state.manifestIndex,
    sequenceIndex: state.sequenceIndex, batchIndex: state.batchIndex,
    score: state.score, combo: state.combo, bestCombo: state.bestCombo,
    dispatchedManifests: state.dispatchedManifests, unexpected: 'overwrite-live-state',
  }];
  assert.equal(validateEndlessState({ ...state, history: forgedHistory }, 'medium').valid, false);
  assert.equal(validateEndlessState(state, 'hard').valid, false);
});

test('Endless lifecycle and rotate payloads obey the shared action contract', () => {
  const preview = endlessState('medium', 31);
  const active = reduceEndless(preview, { type: 'start' }).state;
  assert.deepEqual(reduceEndless(active, { type: 'start' }), { state: active, events: [] });
  assert.equal(reduceEndless(active, {
    type: 'pause', reason: 'pagehide',
  }).events[0].type, 'invalid');
  const paused = reduceEndless(active, { type: 'pause', reason: 'hidden' }).state;
  assert.deepEqual(reduceEndless(paused, {
    type: 'pause', reason: 'hidden',
  }), { state: paused, events: [] });
  const resumed = reduceEndless(paused, { type: 'resume' }).state;
  assert.deepEqual(reduceEndless(resumed, { type: 'resume' }), {
    state: resumed, events: [],
  });
  assert.match(reduceEndless(resumed, {
    type: 'rotate-piece', quarterTurns: 2,
  }).events[0].reason, /one quarter turn/i);
});

test('Yard completion payloads expose exact typed records and summaries', () => {
  const contract = yardCompletionPayload({
    kind: 'contracts', status: 'terminal', moves: 12, assisted: true,
    placements: { 0: {}, 1: {} }, definition: { pieces: [{}, {}] },
  }, 9000);
  assert.deepEqual(contract, {
    game: 'kinnoki-yard', mode: 'contracts',
    records: { time: 9000, moves: 12 },
    summary: {
      elapsedMs: 9000, moves: 12, assisted: true,
      piecesPlaced: 2, totalPieces: 2,
    },
  });
  const endless = yardCompletionPayload({
    kind: 'endless', status: 'terminal', terminalReason: 'no-placement',
    score: 440, bestCombo: 3, dispatchedManifests: 0, assisted: false,
  }, 5000);
  assert.deepEqual(endless, {
    game: 'kinnoki-yard', mode: 'endless',
    records: { score: 440, combo: 3 },
    summary: {
      score: 440, dispatchedManifests: 0, bestCombo: 3,
      elapsedMs: 5000, assisted: false, reason: 'no-placement',
    },
  });
  assert.throws(() => yardCompletionPayload({
    kind: 'contracts', status: 'terminal', moves: 1, assisted: false,
    placements: {}, definition: { pieces: [] },
  }, -1), TypeError);
});

test('Yard facade rejects unknown modes and kinds instead of routing to Endless', () => {
  assert.throws(() => createYardState({ mode: 'unknown' }), TypeError);
  assert.throws(() => prepareYardForContinue({ kind: 'unknown' }), TypeError);
  assert.throws(() => reduceYard({ kind: 'unknown' }, { type: 'start' }), TypeError);
  assert.deepEqual(validateYardState({}, 'easy', 'unknown'), {
    valid: false, errors: ['invalid Yard mode'],
  });
});

test('Endless rules are deeply immutable', () => {
  assert.equal(Object.isFrozen(ENDLESS_RULES), true);
  for (const rules of Object.values(ENDLESS_RULES)) {
    assert.equal(Object.isFrozen(rules), true);
    assert.equal(Object.isFrozen(rules.manifestShapeIds), true);
  }
});

test('Endless validator rejects all coordinated saved-state forgeries', () => {
  const state = endlessState('easy', 41);
  assert.equal(validateEndlessState({
    ...state,
    manifests: [{ ...state.manifests[0], id: 'attacker-manifest' }],
    manifestIndex: 123456,
  }, 'easy').valid, false);

  const board = state.board.map((row) => [...row]);
  board[0][0] = { pieceId: 999, typeId: 'dock-square' };
  assert.equal(validateEndlessState({ ...state, board }, 'easy').valid, false);

  assert.equal(validateEndlessState({
    ...state, score: Number.MAX_SAFE_INTEGER, combo: 7, bestCombo: 9,
    dispatchedManifests: 123,
  }, 'easy').valid, false);

  const forgedHistory = [{
    board: state.board, tray: state.tray, selectedPieceId: state.selectedPieceId,
    focus: state.focus, manifests: state.manifests, manifestIndex: state.manifestIndex,
    sequenceIndex: state.sequenceIndex, batchIndex: state.batchIndex,
    score: Number.MAX_SAFE_INTEGER, combo: 4, bestCombo: 4,
    dispatchedManifests: 99,
  }];
  assert.equal(validateEndlessState({ ...state, history: forgedHistory }, 'easy').valid, false);
});

const firstLegalPlacement = (state) => {
  for (const piece of state.tray) {
    for (const rotated of rotationsFor(piece.typeId, piece.allowedRotations)) {
      for (let row = 0; row < state.definition.height; row += 1) {
        for (let column = 0; column < state.definition.width; column += 1) {
          if (canPlace(state.board, rotated.cells, { row, column })) {
            return { piece, rotated, row, column };
          }
        }
      }
    }
  }
  return null;
};

const placeGreedily = (state) => {
  const placement = firstLegalPlacement(state);
  assert.ok(placement);
  const selected = reduceEndless(state, {
    type: 'select-piece', pieceId: placement.piece.pieceId,
  }).state;
  let rotated = selected;
  while (rotated.tray.find(({ pieceId }) => pieceId === placement.piece.pieceId).rotation
      !== placement.rotated.rotation) {
    rotated = reduceEndless(rotated, { type: 'rotate-piece', quarterTurns: 1 }).state;
  }
  return reduceEndless(rotated, {
    type: 'place-piece', row: placement.row, column: placement.column,
  });
};

test('Endless placement score is exact and reducer-produced progress validates', () => {
  const active = reduceEndless(endlessState('easy', 5), { type: 'start' }).state;
  const placement = firstLegalPlacement(active);
  const result = placeGreedily(active);
  assert.equal(result.events[0].scoreAdded, placement.rotated.cells.length * 10);
  assert.equal(result.state.score, placement.rotated.cells.length * 10);
  assert.deepEqual(validateEndlessState(result.state, 'easy'), { valid: true, errors: [] });
});

const rectangleSix = (id, column) => ({
  id, shapeId: 'rectangle-six', rotation: 0, origin: { row: 0, column },
  label: 'Six-cell manifest', pattern: 'bands',
  cells: [0, 1].flatMap((row) => [0, 1, 2].map((offset) => ({
    row, column: column + offset,
  }))),
});

test('Endless dispatches simultaneous manifests with one combo multiplier', () => {
  const base = endlessState('medium', 8);
  const board = base.board.map((row) => [...row]);
  for (const column of [0, 1, 4, 5]) board[1][column] = { pieceId: 50, typeId: 'dock-square' };
  for (let column = 0; column < 6; column += 1) board[0][column] = { pieceId: 51, typeId: 'barge-five' };
  const fixture = {
    ...base, status: 'active', board,
    tray: [{ pieceId: 2, typeId: 'crate-pair', allowedRotations: [0],
      rotation: 0, batchIndex: 0 }], selectedPieceId: 2,
    manifests: [rectangleSix('left', 0), rectangleSix('right', 3)],
  };
  const result = reduceEndless(fixture, { type: 'place-piece', row: 1, column: 2 });
  const dispatch = result.events.find(({ type }) => type === 'dispatch');
  assert.deepEqual(dispatch.manifestIds, ['left', 'right']);
  assert.equal(dispatch.cells, 12);
  assert.equal(dispatch.combo, 1);
  assert.equal(dispatch.scoreAdded, 1200);
  assert.equal(result.state.dispatchedManifests, 2);
});

test('Endless resets combos while preserving already saturated counters', () => {
  const base = endlessState('easy', 13);
  const fixture = {
    ...base, status: 'active', combo: 7, bestCombo: Number.MAX_SAFE_INTEGER,
    score: Number.MAX_SAFE_INTEGER, dispatchedManifests: Number.MAX_SAFE_INTEGER,
  };
  const result = placeGreedily(fixture);
  assert.equal(result.state.score, Number.MAX_SAFE_INTEGER);
  assert.equal(result.state.combo, 0);
  assert.equal(result.state.bestCombo, Number.MAX_SAFE_INTEGER);
  assert.equal(result.state.dispatchedManifests, Number.MAX_SAFE_INTEGER);
  assert.deepEqual(result.events.find(({ type }) => type === 'combo-reset'), {
    type: 'combo-reset', previousCombo: 7,
  });
});

test('reducer-produced terminal states validate and remain immutable', () => {
  for (const seed of [0, 1]) {
    let state = reduceEndless(endlessState('easy', seed), { type: 'start' }).state;
    while (state.status === 'active') state = placeGreedily(state).state;
    assert.equal(state.status, 'terminal');
    assert.equal(state.terminalReason, 'no-placement');
    if (seed === 1) assert.equal(state.dispatchedManifests, 0);
    assert.deepEqual(validateEndlessState(state, 'easy'), { valid: true, errors: [] });
    assert.deepEqual(reduceEndless(state, { type: 'undo' }), { state, events: [] });
  }
});

test('Yard facade positively routes definitions, state, validation, and reducers', () => {
  const definition = createEndlessDefinition({ difficulty: 'hard', seed: 91 });
  const preview = createYardState(definition);
  assert.equal(yardDefinitionSignature(definition), endlessSignature(definition));
  assert.equal(preview.kind, 'endless');
  assert.deepEqual(validateYardState(preview, 'hard', 'endless'), {
    valid: true, errors: [],
  });
  assert.equal(reduceYard(preview, { type: 'start' }).state.status, 'active');
  assert.equal(prepareYardForContinue(preview).status, 'paused');
});

test('Endless command provenance makes Undo assistance sticky', () => {
  const active = reduceEndless(endlessState('easy', 15), { type: 'start' }).state;
  const placed = placeGreedily(active).state;
  const undone = reduceEndless(placed, { type: 'undo' }).state;
  assert.equal(undone.assisted, true);
  assert.deepEqual(validateEndlessState(undone, 'easy'), { valid: true, errors: [] });
  assert.equal(validateEndlessState({ ...undone, assisted: false }, 'easy').valid, false);
});

test('Endless command provenance authenticates exact pre-placement selection and rotation', () => {
  const active = reduceEndless(endlessState('easy', 19), { type: 'start' }).state;
  const placed = placeGreedily(active).state;
  const snapshot = placed.history[0];
  const different = snapshot.tray.find(({ pieceId }) => pieceId !== snapshot.selectedPieceId);
  assert.ok(different);
  const forgedSelection = structuredClone(placed);
  forgedSelection.history[0].selectedPieceId = different.pieceId;
  assert.equal(validateEndlessState(forgedSelection, 'easy').valid, false);

  const selected = snapshot.tray.find(({ pieceId }) => pieceId === snapshot.selectedPieceId);
  if (selected.allowedRotations.length > 1) {
    const forgedRotation = structuredClone(placed);
    forgedRotation.history[0].tray.find(
      ({ pieceId }) => pieceId === snapshot.selectedPieceId,
    ).rotation = selected.allowedRotations.find((rotation) => rotation !== selected.rotation);
    assert.equal(validateEndlessState(forgedRotation, 'easy').valid, false);
  }
});

test('Endless lifecycle status must be derived by retained commands', () => {
  const active = reduceEndless(endlessState('medium', 29), { type: 'start' }).state;
  assert.deepEqual(validateEndlessState(active, 'medium'), { valid: true, errors: [] });
  assert.equal(validateEndlessState({ ...active, status: 'preview' }, 'medium').valid, false);
  const paused = reduceEndless(active, { type: 'pause', reason: 'hidden' }).state;
  assert.deepEqual(validateEndlessState(paused, 'medium'), { valid: true, errors: [] });
  const continued = prepareYardForContinue(active);
  assert.deepEqual(validateEndlessState(continued, 'medium'), { valid: true, errors: [] });
});

test('Endless snapshots have bounded non-recursive provenance shape', () => {
  let state = reduceEndless(endlessState('easy', 0), { type: 'start' }).state;
  for (let placement = 0; placement < 12 && state.status === 'active'; placement += 1) {
    state = placeGreedily(state).state;
  }
  assert.ok(state.history.length >= 10);
  assert.ok(state.commandLog.length >= state.history.length);
  for (const snapshot of state.history) {
    assert.equal(Object.hasOwn(snapshot, 'history'), false);
    assert.equal(Object.hasOwn(snapshot, 'commandLog'), false);
    assert.equal(Object.hasOwn(snapshot, 'actionHistory'), false);
  }
  const initialSize = JSON.stringify(endlessState('easy', 0)).length;
  assert.ok(JSON.stringify(state).length < initialSize + (state.history.length * 12000));
  assert.deepEqual(validateEndlessState(state, 'easy'), { valid: true, errors: [] });
});

test('Yard reducer owns focus changes and continue authentication', () => {
  const preview = endlessState('medium', 37);
  const active = reduceYard(preview, { type: 'start' }).state;
  const focused = reduceYard(active, {
    type: 'set-focus', focus: { row: 4, column: 5 },
  }).state;
  assert.deepEqual(focused.focus, { row: 4, column: 5 });
  assert.deepEqual(focused.commandLog.at(-1), {
    type: 'set-focus', focus: { row: 4, column: 5 },
  });
  assert.deepEqual(validateYardState(focused, 'medium', 'endless'), {
    valid: true, errors: [],
  });
  assert.deepEqual(prepareYardForContinue(focused).focus, { row: 4, column: 5 });
});

test('Endless replay authenticates focus in exact pre-placement snapshots', () => {
  let state = reduceEndless(endlessState('easy', 43), { type: 'start' }).state;
  state = reduceEndless(state, {
    type: 'set-focus', focus: { row: 6, column: 7 },
  }).state;
  const placed = placeGreedily(state).state;
  assert.deepEqual(placed.history[0].focus, { row: 6, column: 7 });
  assert.deepEqual(validateEndlessState(placed, 'easy'), { valid: true, errors: [] });
  const forged = structuredClone(placed);
  forged.history[0].focus = { row: 0, column: 0 };
  assert.equal(validateEndlessState(forged, 'easy').valid, false);
});

test('Endless rejects direct, invalid, and idempotent focus mutations', () => {
  const active = reduceEndless(endlessState('hard', 47), { type: 'start' }).state;
  assert.equal(validateEndlessState({
    ...active, focus: { row: 1, column: 1 },
  }, 'hard').valid, false);

  for (const focus of [active.focus, { row: -1, column: 0 },
    { row: 0, column: 8 }, null]) {
    const result = reduceEndless(active, { type: 'set-focus', focus });
    assert.equal(result.state, active);
    assert.equal(result.state.commandLog, active.commandLog);
  }
});

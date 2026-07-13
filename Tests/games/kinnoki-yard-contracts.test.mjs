import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createContractState, generateContract, prepareContractForContinue, reduceContract,
  solveContract, validateContractState,
} from '../../Resources/games/kinnoki-yard.js';

const transition = (state, action) => reduceContract(state, action).state;

const pairContract = Object.freeze({
  version: 1, game: 'kinnoki-yard', mode: 'contracts', difficulty: 'easy', seed: 700,
  width: 4, height: 3,
  target: [0, 1, 2].flatMap((row) => (
    [0, 1, 2, 3].map((column) => ({ row, column }))
  )),
  pieces: [0, 1, 2, 3, 4, 5].map((pieceId) => ({
    pieceId, typeId: 'crate-pair', allowedRotations: [0],
    initialRotation: 0, trayIndex: pieceId,
  })),
  witness: [0, 1, 2, 3, 4, 5].map((pieceId) => ({
    pieceId, rotation: 0,
    row: Math.floor(pieceId / 2), column: (pieceId % 2) * 2,
  })),
  generation: {
    usedFallback: false, attempt: 0, sourceId: null,
    transformId: 'identity', operations: 0,
  },
});

test('only successful manipulation and Undo count as moves', () => {
  const definition = generateContract({ difficulty: 'easy', seed: 12 });
  let state = transition(createContractState(definition), { type: 'start' });
  const piece = definition.pieces[0];
  state = transition(state, { type: 'select-piece', pieceId: piece.pieceId });
  assert.equal(state.moves, 0);
  const rejected = transition(state, { type: 'place-piece', row: -20, column: -20 });
  assert.equal(rejected.moves, 0);
  const witness = definition.witness.find((value) => value.pieceId === piece.pieceId);
  while (state.selectedRotation !== witness.rotation) {
    state = transition(state, { type: 'rotate-piece', quarterTurns: 1 });
  }
  const manipulationMoves = state.moves;
  state = transition(state, { type: 'place-piece', row: witness.row, column: witness.column });
  assert.equal(state.moves, manipulationMoves + 1);
  state = transition(state, { type: 'undo' });
  assert.equal(state.moves, manipulationMoves + 2);
  assert.equal(state.assisted, false);
  assert.equal(state.placements[piece.pieceId], undefined);
});

test('Hint returns an exact unplaced solver move and marks assistance only', () => {
  const definition = generateContract({ difficulty: 'medium', seed: 19 });
  let state = transition(createContractState(definition), { type: 'start' });
  const before = structuredClone(state);
  const result = reduceContract(state, { type: 'hint' });
  state = result.state;
  const hint = result.events.find((event) => event.type === 'hint');
  assert.ok(definition.pieces.some((piece) => piece.pieceId === hint.pieceId));
  assert.equal(state.placements[hint.pieceId], undefined);
  assert.equal(state.moves, before.moves);
  assert.deepEqual(state.board, before.board);
  assert.equal(state.assisted, true);
});

test('Hint reports a known legal dead end without inventing placement', () => {
  let state = transition(createContractState(pairContract), { type: 'start' });
  state = transition(state, { type: 'select-piece', pieceId: 0 });
  state = transition(state, { type: 'place-piece', row: 0, column: 1 });
  assert.equal(solveContract(pairContract, state.placements).status, 'dead-end');
  const before = structuredClone(state);
  const result = reduceContract(state, { type: 'hint' });
  assert.deepEqual(result.state.board, before.board);
  assert.equal(result.state.moves, before.moves);
  assert.equal(result.state.assisted, true);
  assert.deepEqual(result.events.at(-1), {
    type: 'hint-dead-end',
    message: 'Undo to the most recent completable position or Restart this contract.',
  });
});

test('witness completion is terminal once and uses selected rotation', () => {
  const definition = generateContract({ difficulty: 'easy', seed: 28 });
  let state = transition(createContractState(definition), { type: 'start' });
  for (const witness of definition.witness) {
    state = transition(state, { type: 'select-piece', pieceId: witness.pieceId });
    while (state.selectedRotation !== witness.rotation) {
      state = transition(state, { type: 'rotate-piece', quarterTurns: 1 });
    }
    state = transition(state, {
      type: 'place-piece', row: witness.row, column: witness.column,
    });
  }
  assert.equal(state.status, 'terminal');
  const ignored = reduceContract(state, { type: 'undo' });
  assert.equal(ignored.state, state);
  assert.deepEqual(ignored.events, []);
});

test('reposition counts once and non-engine actions never change moves', () => {
  let state = transition(createContractState(pairContract), { type: 'start' });
  state = transition(state, { type: 'select-piece', pieceId: 0 });
  state = transition(state, { type: 'place-piece', row: 0, column: 1 });
  assert.equal(state.moves, 1);
  state = transition(state, { type: 'place-piece', row: 0, column: 0 });
  assert.equal(state.moves, 2);
  for (const type of ['help', 'pan', 'audio']) {
    const result = reduceContract(state, { type });
    assert.equal(result.state.moves, 2);
    assert.equal(result.events[0].type, 'invalid');
  }
});

test('Contract validator rejects forged terminal and history while accepting valid play', () => {
  const state = createContractState(pairContract);
  assert.deepEqual(validateContractState(state, 'easy'), { valid: true, errors: [] });
  assert.equal(validateContractState({
    ...state, status: 'terminal', terminalReason: 'completed',
  }, 'easy').valid, false);
  assert.equal(validateContractState({
    ...state, history: [{ board: [['forged']] }],
  }, 'easy').valid, false);
  let placed = transition(state, { type: 'start' });
  placed = transition(placed, { type: 'select-piece', pieceId: 0 });
  placed = transition(placed, { type: 'place-piece', row: 0, column: 0 });
  assert.equal(validateContractState(placed, 'easy').valid, true);
  const mismatchedPlacements = { 99: placed.placements[0] };
  assert.equal(validateContractState({
    ...placed, placements: mismatchedPlacements,
  }, 'easy').valid, false);
  const forgedHistory = structuredClone(placed.history);
  forgedHistory[0].selectedPieceId = 999;
  assert.equal(validateContractState({ ...placed, history: forgedHistory }, 'easy').valid, false);
  assert.equal(validateContractState(state, 'hard').valid, false);
});

test('Contract lifecycle no-ops and action payloads follow the shared contract', () => {
  const preview = createContractState(pairContract);
  const started = reduceContract(preview, { type: 'start' }).state;
  const duplicateStart = reduceContract(started, { type: 'start' });
  assert.equal(duplicateStart.state, started);
  assert.deepEqual(duplicateStart.events, []);
  assert.equal(reduceContract(started, {
    type: 'pause', reason: 'pagehide',
  }).events[0].type, 'invalid');
  const paused = reduceContract(started, { type: 'pause', reason: 'hidden' }).state;
  const duplicatePause = reduceContract(paused, { type: 'pause', reason: 'hidden' });
  assert.equal(duplicatePause.state, paused);
  assert.deepEqual(duplicatePause.events, []);
  const resumed = reduceContract(paused, { type: 'resume' }).state;
  assert.deepEqual(reduceContract(resumed, { type: 'resume' }), {
    state: resumed, events: [],
  });
  assert.match(reduceContract(resumed, {
    type: 'rotate-piece', quarterTurns: 2,
  }).events[0].reason, /one quarter turn/i);
});

test('Contract validator authenticates persisted hints against the canonical solver result', () => {
  const state = createContractState(pairContract);
  assert.equal(validateContractState({
    ...state,
    hint: {
      status: 'solved',
      placement: {
        pieceId: 0, typeId: 'crate-pair', rotation: 0, row: 999, column: 999,
      },
    },
  }, 'easy').valid, false);
  assert.equal(validateContractState({
    ...state,
    hint: { status: 'dead-end', message: 'This solvable board is stuck.' },
  }, 'easy').valid, false);
});

test('prepare Contract for continue validates, clones, and pauses saved play', () => {
  const active = transition(createContractState(pairContract), { type: 'start' });
  const continued = prepareContractForContinue(active);
  assert.equal(continued.status, 'paused');
  assert.notEqual(continued, active);
  assert.notEqual(continued.board, active.board);
  assert.throws(() => prepareContractForContinue({
    ...active, status: 'terminal', terminalReason: 'completed',
  }), TypeError);
});

test('move counting saturates and rejected actions preserve state identity', () => {
  const active = {
    ...transition(createContractState(generateContract({ difficulty: 'easy', seed: 12 })), {
      type: 'start',
    }),
    moves: Number.MAX_SAFE_INTEGER,
  };
  const rotated = reduceContract(active, { type: 'rotate-piece', quarterTurns: 1 });
  assert.equal(rotated.state.moves, Number.MAX_SAFE_INTEGER);
  const rejected = reduceContract(rotated.state, {
    type: 'place-piece', row: -1, column: -1,
  });
  assert.equal(rejected.state, rotated.state);
  assert.equal(rejected.state.moves, Number.MAX_SAFE_INTEGER);
});

test('Contract history snapshots do not alias later mutable position objects', () => {
  const active = transition(createContractState(generateContract({
    difficulty: 'easy', seed: 12,
  })), { type: 'start' });
  const rotated = transition(active, { type: 'rotate-piece', quarterTurns: 1 });
  const snapshot = structuredClone(rotated.history[0]);
  rotated.board[0][0] = { pieceId: 999 };
  rotated.placements.forged = { pieceId: 999 };
  rotated.focus.row = 1;
  assert.deepEqual(rotated.history[0], snapshot);
});

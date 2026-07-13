import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEndlessDefinition, createEndlessState, createYardState, endlessSignature,
  hasAnyEndlessPlacement, reduceEndless, validateEndlessState,
  prepareYardForContinue, reduceYard, validateYardState, yardCompletionPayload,
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

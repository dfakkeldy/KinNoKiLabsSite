import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStackDefinition, createStackState, reduceStack, stackDefinitionSignature,
  stackCompletionPayload, validateStackState,
} from '../../Resources/games/kinnoki-stack.js';

const stackState = (difficulty, seed) => (
  createStackState(createStackDefinition({ difficulty, seed }))
);
const apply = (state, action) => reduceStack(state, action).state;

test('same seed creates the same cargo, manifest, and tide forecast', () => {
  assert.deepEqual(stackState('hard', 20260713), stackState('hard', 20260713));
  assert.notEqual(
    stackDefinitionSignature(createStackDefinition({ difficulty: 'hard', seed: 20260713 })),
    stackDefinitionSignature(createStackDefinition({ difficulty: 'hard', seed: 20260714 })),
  );
});

test('spawn uses rotation zero, row zero, and floor-centred bounds', () => {
  const state = stackState('easy', 1);
  assert.equal(state.width, 12);
  assert.equal(state.height, 18);
  assert.equal(state.active.rotation, 0);
  assert.equal(state.active.row, 0);
  assert.equal(state.active.column, Math.floor((12 - state.active.bounds.width) / 2));
});

test('difficulty owns the exact next-cargo preview length', () => {
  for (const [difficulty, count] of [['easy', 3], ['medium', 2], ['hard', 1]]) {
    const state = stackState(difficulty, 99);
    assert.equal(state.preview.length, count);
    assert.equal(new Set(state.preview.map((piece) => piece.sequenceIndex)).size, count);
  }
});

test('lock scores placement then one shared-combo dispatch without row clearing', () => {
  const initial = stackState('easy', 2);
  const board = initial.board.map((row) => [...row]);
  for (let column = 0; column < 4; column += 1) board[16][column] = { pieceId: 70, typeId: 'dock-square' };
  for (let column = 0; column < 2; column += 1) board[17][column] = { pieceId: 71, typeId: 'crate-pair' };
  const result = reduceStack({
    ...initial, status: 'active', board, score: 0, combo: 1,
    manifests: [{
      id: 'manifest-a', shapeId: 'rectangle-eight', rotation: 0,
      origin: { row: 16, column: 0 }, label: 'Manifest A', pattern: 'bands',
      cells: [
        { row: 16, column: 0 }, { row: 16, column: 1 }, { row: 16, column: 2 }, { row: 16, column: 3 },
        { row: 17, column: 0 }, { row: 17, column: 1 }, { row: 17, column: 2 }, { row: 17, column: 3 },
      ],
    }],
    active: { pieceId: 90, typeId: 'crate-pair', rotation: 0, row: 17, column: 2, bounds: { width: 2, height: 1 } },
  }, { type: 'hard-drop' });
  assert.equal(result.state.score, 20 + (100 * 8 * 2));
  assert.equal(result.state.combo, 2);
  assert.equal(result.state.bestCombo, 2);
  assert.equal(result.state.dispatchedManifests, 1);
  assert.equal(result.state.board[17][0], null);
  assert.equal(result.state.board[17][3], null);
  assert.equal(result.events.filter((event) => event.type === 'dispatch').length, 1);
});

test('two completed manifests dispatch simultaneously with one combo multiplier', () => {
  const initial = stackState('medium', 19);
  const board = initial.board.map((row) => [...row]);
  const manifests = [0, 4].map((column, index) => ({
    id: 'manifest-' + index, shapeId: 'rectangle-eight', rotation: 0,
    origin: { row: 16, column }, label: 'Eight-cell manifest', pattern: 'crosshatch',
    cells: [0, 1].flatMap((rowOffset) => [0, 1, 2, 3].map((columnOffset) => ({ row: 16 + rowOffset, column: column + columnOffset }))),
  }));
  for (const manifest of manifests) for (const cell of manifest.cells) {
    if (cell.row === 17 && (cell.column === 3 || cell.column === 4)) continue;
    board[cell.row][cell.column] = { pieceId: 70, typeId: 'dock-square' };
  }
  const result = reduceStack({
    ...initial, status: 'active', board, manifests,
    tide: { direction: 'left', placementsRemaining: 5, eventIndex: 0 },
    active: { pieceId: 90, typeId: 'crate-pair', rotation: 0, row: 17, column: 3, bounds: { width: 2, height: 1 } },
  }, { type: 'hard-drop' });
  const dispatch = result.events.find((event) => event.type === 'dispatch');
  assert.deepEqual(dispatch.manifestIds, ['manifest-0', 'manifest-1']);
  assert.equal(dispatch.cells, 16);
  assert.equal(dispatch.combo, 1);
  assert.equal(dispatch.scoreAdded, 1600);
  assert.equal(result.state.score, 1620);
  assert.equal(result.state.dispatchedManifests, 2);
});

test('Stack validator accepts an untouched state and rejects forged geometry', () => {
  const state = stackState('medium', 23);
  assert.deepEqual(validateStackState(state, 'medium'), { valid: true, errors: [] });
  assert.equal(validateStackState({ ...state, board: state.board.slice(1) }, 'medium').valid, false);
  assert.equal(validateStackState({ ...state, definition: { ...state.definition, version: 2 } }, 'medium').valid, false);
  assert.equal(validateStackState({ ...state, active: { ...state.active, sequenceIndex: state.sequenceIndex + 1 } }, 'medium').valid, false);
  assert.equal(validateStackState({ ...state, tide: { ...state.tide, direction: state.tide.direction === 'left' ? 'right' : 'left' } }, 'medium').valid, false);
});

test('Stack definitions reject values outside the unsigned seed contract', () => {
  assert.throws(() => createStackDefinition({ difficulty: 'easy', seed: -1 }), TypeError);
  assert.throws(() => createStackDefinition({ difficulty: 'easy', seed: 0x1_0000_0000 }), TypeError);
});

test('terminal records use run-highest combo even after current combo reset', () => {
  const state = { ...stackState('easy', 24), status: 'terminal', terminalReason: 'crane-line', score: 500, combo: 0, bestCombo: 2, dispatchedManifests: 0 };
  const payload = stackCompletionPayload(state, 1234);
  assert.deepEqual(payload.records, { score: 500, combo: 2 });
  assert.equal(payload.summary.dispatchedManifests, 0);
  assert.equal(payload.summary.reason, 'crane-line');
});

const emptyBoard = () => Array.from({ length: 18 }, () => Array(12).fill(null));
const rectangleEight = (id, row, column) => ({
  id, shapeId: 'rectangle-eight', rotation: 0, origin: { row, column }, label: 'Eight-cell manifest', pattern: 'bands',
  cells: [0, 1].flatMap((rowOffset) => [0, 1, 2, 3].map((columnOffset) => ({ row: row + rowOffset, column: column + columnOffset }))),
});
const occupiedCount = (board) => board.flat().filter(Boolean).length;

test('right tide moves settled components rigidly and resets its saved forecast', () => {
  const state = stackState('medium', 31);
  const board = emptyBoard();
  board[10][0] = { pieceId: 50, typeId: 'crate-pair' };
  board[10][10] = { pieceId: 51, typeId: 'crate-pair' };
  const beforeCount = occupiedCount(board) + 2;
  const result = reduceStack({ ...state, status: 'active', board, manifests: [rectangleEight('manifest-safe', 12, 0)], active: { pieceId: 90, typeId: 'crate-pair', rotation: 0, row: 17, column: 4, bounds: { width: 2, height: 1 } }, tide: { direction: 'right', placementsRemaining: 1, eventIndex: 0 } }, { type: 'hard-drop' });
  assert.equal(occupiedCount(result.state.board), beforeCount);
  assert.equal(result.state.board[10][1].pieceId, 50);
  assert.equal(result.state.board[10][11].pieceId, 51);
  assert.equal(result.state.tide.eventIndex, 1);
  assert.ok(result.state.tide.placementsRemaining >= 6 && result.state.tide.placementsRemaining <= 8);
  assert.match(result.state.tide.direction, /^(left|right)$/);
  assert.deepEqual(result.events.find((event) => event.type === 'tide-shift'), { type: 'tide-shift', direction: 'right', movedComponents: 3 });
});

test('a tide-enabled manifest uses only normal dispatch scoring', () => {
  const state = stackState('medium', 37);
  const board = emptyBoard();
  board[10][1] = { pieceId: 60, typeId: 'crate-pair' };
  for (let column = 3; column < 12; column += 1) board[10][column] = { pieceId: 61, typeId: 'barge-five' };
  for (let column = 2; column < 12; column += 1) board[11][column] = { pieceId: 62, typeId: 'barge-five' };
  const manifest = { id: 'manifest-tide', shapeId: 'rectangle-six', rotation: 0, origin: { row: 10, column: 2 }, label: 'Six-cell manifest', pattern: 'bands', cells: [0, 1].flatMap((r) => [0, 1, 2].map((c) => ({ row: 10 + r, column: 2 + c }))) };
  const result = reduceStack({ ...state, status: 'active', board, manifests: [manifest], score: 0, combo: 0, active: { pieceId: 90, typeId: 'crate-pair', rotation: 0, row: 17, column: 4, bounds: { width: 2, height: 1 } }, tide: { direction: 'right', placementsRemaining: 1, eventIndex: 0 } }, { type: 'hard-drop' });
  assert.equal(result.state.score, 20 + (100 * 6));
  assert.equal(result.events.filter((event) => event.type === 'tide-shift').length, 1);
  assert.equal(result.events.filter((event) => event.type === 'dispatch').length, 1);
});

test('saved tide warning fires at the configured remaining count', () => {
  const state = stackState('medium', 38);
  const result = reduceStack({ ...state, status: 'active', manifests: [rectangleEight('manifest-safe', 10, 0)], active: { pieceId: 90, typeId: 'crate-pair', rotation: 0, row: 17, column: 4, bounds: { width: 2, height: 1 } }, tide: { direction: 'left', placementsRemaining: 4, eventIndex: 0 } }, { type: 'hard-drop' });
  assert.deepEqual(result.events.find((event) => event.type === 'tide-warning'), { type: 'tide-warning', direction: 'left', placementsRemaining: 3 });
});

test('a manifest dispatch rescues row zero before the crane check', () => {
  const state = stackState('easy', 42);
  const board = emptyBoard();
  for (const [row, columns] of [[0, [0, 1]], [1, [0, 1, 2, 3]]]) for (const column of columns) board[row][column] = { pieceId: 70 + row, typeId: row === 0 ? 'crate-pair' : 'dock-square' };
  board[2][2] = { pieceId: 72, typeId: 'crate-pair' };
  board[2][3] = { pieceId: 72, typeId: 'crate-pair' };
  const result = reduceStack({ ...state, status: 'active', board, manifests: [rectangleEight('manifest-rescue', 0, 0)], active: { pieceId: 90, typeId: 'crate-pair', rotation: 0, row: 0, column: 2, bounds: { width: 2, height: 1 } } }, { type: 'hard-drop' });
  assert.notEqual(result.state.status, 'terminal');
  assert.equal(result.state.board[0].every((cell) => cell === null), true);
  assert.equal(result.state.board[1].every((cell) => cell === null), true);
});

test('crane-line, spawn-blocked, saturation, and terminal immutability are exact', () => {
  const base = stackState('easy', 53);
  const craneBoard = emptyBoard();
  craneBoard[1][4] = { pieceId: 30, typeId: 'crate-pair' };
  const crane = reduceStack({ ...base, status: 'active', board: craneBoard, manifests: [rectangleEight('manifest-safe', 10, 0)], score: Number.MAX_SAFE_INTEGER, active: { pieceId: 90, typeId: 'crate-pair', rotation: 0, row: 0, column: 4, bounds: { width: 2, height: 1 } }, }, { type: 'hard-drop' });
  assert.equal(crane.state.terminalReason, 'crane-line');
  assert.equal(crane.state.score, Number.MAX_SAFE_INTEGER);
  const ignored = reduceStack(crane.state, { type: 'move', deltaColumn: 1 });
  assert.equal(ignored.state, crane.state);
  assert.deepEqual(ignored.events, []);
  const spawnBoard = emptyBoard();
  spawnBoard[2][5] = { pieceId: 40, typeId: 'crate-pair' };
  const spawned = reduceStack({ ...base, status: 'active', board: spawnBoard, manifests: [rectangleEight('manifest-safe', 10, 0)], active: { pieceId: 91, typeId: 'crate-pair', rotation: 0, row: 17, column: 0, bounds: { width: 2, height: 1 } }, preview: [{ pieceId: 92, typeId: 'hook-four', rotation: 0, sequenceIndex: 1, bounds: { width: 2, height: 3 } }, ...base.preview.slice(1)] }, { type: 'hard-drop' });
  assert.equal(spawned.state.terminalReason, 'spawn-blocked');
});

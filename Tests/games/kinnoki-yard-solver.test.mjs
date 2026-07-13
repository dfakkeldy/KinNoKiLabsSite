import test from 'node:test';
import assert from 'node:assert/strict';
import { solveContract } from '../../Resources/games/kinnoki-yard.js';

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

test('solver returns a deterministic exact cover', () => {
  const first = solveContract(pairContract, {});
  const second = solveContract(pairContract, {});
  assert.equal(first.status, 'solved');
  assert.deepEqual(first, second);
  assert.equal(first.placements.length, 6);
});

test('existing placements are fixed constraints', () => {
  const fixed = {
    0: { pieceId: 0, typeId: 'crate-pair', rotation: 0, row: 0, column: 0 },
  };
  const result = solveContract(pairContract, fixed);
  assert.equal(result.status, 'solved');
  assert.deepEqual(result.placements.find((value) => value.pieceId === 0), fixed[0]);
});

test('placement-map keys must equal their embedded numeric piece identity', () => {
  const mismatched = {
    99: { pieceId: 0, typeId: 'crate-pair', rotation: 0, row: 0, column: 0 },
  };
  assert.deepEqual(solveContract(pairContract, mismatched), {
    status: 'dead-end', placements: [], operations: 0,
  });
});

test('multiple hostile placement values fail closed before sorting', () => {
  for (const placements of [
    { 0: null, 1: null },
    { 0: undefined, 1: 4 },
  ]) {
    assert.doesNotThrow(() => solveContract(pairContract, placements));
    assert.deepEqual(solveContract(pairContract, placements), {
      status: 'dead-end', placements: [], operations: 0,
    });
  }
});

test('attacker-controlled piece identities fail closed before numeric sorting', () => {
  for (const pieceId of [Symbol('piece'), 1n]) {
    const placements = {
      0: { pieceId, typeId: 'crate-pair', rotation: 0, row: 0, column: 0 },
      1: { pieceId: 1, typeId: 'crate-pair', rotation: 0, row: 0, column: 2 },
    };
    assert.doesNotThrow(() => solveContract(pairContract, placements));
    assert.deepEqual(solveContract(pairContract, placements), {
      status: 'dead-end', placements: [], operations: 0,
    });
  }
});

test('bundled witness fast path requires every piece identity exactly once', () => {
  const forged = {
    ...pairContract,
    witness: pairContract.witness.map((placement, index) => (
      index === 1 ? { ...placement, pieceId: 0 } : placement
    )),
  };
  const result = solveContract(forged, {});
  assert.equal(result.status, 'solved');
  assert.deepEqual(result.placements.map(({ pieceId }) => pieceId), [0, 1, 2, 3, 4, 5]);
});

test('legal but unfinishable placement is a proved dead end', () => {
  const deadEnd = {
    0: { pieceId: 0, typeId: 'crate-pair', rotation: 0, row: 0, column: 1 },
  };
  assert.equal(solveContract(pairContract, deadEnd).status, 'dead-end');
});

test('explicit operation bound returns limit instead of blocking', () => {
  const result = solveContract(pairContract, {}, { operationLimit: 0 });
  assert.deepEqual(result, { status: 'limit', placements: [], operations: 1 });
});

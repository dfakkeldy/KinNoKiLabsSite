import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRACT_FALLBACK_PACKINGS, CONTRACT_RULES, CONTRACT_TRANSFORM_IDS,
  contractSignature, definitionFromFallback, generateContract,
  measureContractTarget, selectContractFallback, solveContract,
  validateContractDefinition,
} from '../../Resources/games/kinnoki-yard.js';

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(difficulty + ' contracts are deterministic and solver-proven across seeds', () => {
    const signatures = new Set();
    for (let seed = 0; seed < 30; seed += 1) {
      const first = generateContract({ difficulty, seed });
      const second = generateContract({ difficulty, seed });
      assert.deepEqual(first, second);
      assert.deepEqual(validateContractDefinition(first), { valid: true, errors: [] });
      assert.equal(solveContract(first, {}).status, 'solved');
      assert.ok(first.pieces.length >= CONTRACT_RULES[difficulty].minPieces);
      assert.ok(first.pieces.length <= CONTRACT_RULES[difficulty].maxPieces);
      const metrics = measureContractTarget(first.target);
      const rules = CONTRACT_RULES[difficulty];
      assert.ok(metrics.area >= rules.minimumTargetArea);
      assert.ok(metrics.area <= rules.maximumTargetArea);
      assert.ok(metrics.shortSide >= rules.minimumShortSide);
      assert.ok(metrics.longSide <= rules.maximumLongSide);
      assert.ok(metrics.fillRatio >= rules.minimumFillRatio);
      assert.ok(metrics.fillRatio <= rules.maximumFillRatio);
      assert.ok(metrics.concaveCorners >= rules.minimumConcaveCorners);
      assert.ok(metrics.concaveCorners <= rules.maximumConcaveCorners);
      assert.ok(metrics.narrowBayCells >= rules.minimumNarrowBayCells);
      assert.ok(metrics.narrowBayCells <= rules.maximumNarrowBayCells);
      signatures.add(contractSignature(first));
    }
    assert.ok(signatures.size >= 20);
  });

  test(difficulty + ' has 32 distinct validated fallback transforms', () => {
    assert.equal(CONTRACT_FALLBACK_PACKINGS[difficulty].length, 4);
    const definitions = CONTRACT_FALLBACK_PACKINGS[difficulty].flatMap((source) => (
      CONTRACT_TRANSFORM_IDS.map((transformId) => (
        definitionFromFallback(source, difficulty, transformId)
      ))
    ));
    assert.equal(definitions.length, 32);
    assert.equal(new Set(definitions.map(contractSignature)).size, 32);
    for (const definition of definitions) {
      assert.equal(definition.generation.usedFallback, true);
      assert.equal(solveContract(definition, {}).status, 'solved');
      assert.equal(validateContractDefinition(definition).valid, true);
    }
  });

  test(difficulty + ' fallback selector skips every immediate signature collision', () => {
    const starts = new Set();
    for (let seed = 0; seed < 256; seed += 1) {
      const first = selectContractFallback({ difficulty, seed, previousSignature: null });
      assert.equal(first.seed, seed >>> 0);
      starts.add(contractSignature(first));
      const next = selectContractFallback({
        difficulty, seed, previousSignature: contractSignature(first),
      });
      assert.notEqual(contractSignature(next), contractSignature(first));
    }
    assert.equal(starts.size, 32);
  });
}

test('previous signature is rejected deterministically', () => {
  const first = generateContract({ difficulty: 'medium', seed: 42 });
  const next = generateContract({
    difficulty: 'medium', seed: 42, previousSignature: contractSignature(first),
  });
  assert.notEqual(contractSignature(next), contractSignature(first));
});

test('definition validator rejects target, witness, orientation, and difficulty forgery', () => {
  const definition = generateContract({ difficulty: 'medium', seed: 61 });
  assert.deepEqual(validateContractDefinition(definition), { valid: true, errors: [] });
  assert.equal(validateContractDefinition({ ...definition, target: definition.target.slice(1) }).valid, false);
  assert.equal(validateContractDefinition({
    ...definition,
    witness: [{ ...definition.witness[0], rotation: 99 }, ...definition.witness.slice(1)],
  }).valid, false);
  assert.equal(validateContractDefinition({
    ...definition,
    pieces: [{ ...definition.pieces[0], pieceId: 'bad' }, ...definition.pieces.slice(1)],
  }).valid, false);
  assert.equal(validateContractDefinition({ ...definition, difficulty: 'hard' }).valid, false);
});

test('bounded generation reaches fallback instead of searching without limit', () => {
  const definition = generateContract({ difficulty: 'hard', seed: 91, operationLimit: 0 });
  assert.equal(definition.generation.usedFallback, true);
  assert.equal(definition.seed, 91);
  assert.equal(solveContract(definition, {}).status, 'solved');
});

test('solver rejects hostile placement entries without throwing', () => {
  const definition = generateContract({ difficulty: 'easy', seed: 7, forceFallback: true });
  for (const placement of [null, undefined, 4, 'bad', [], {}]) {
    assert.doesNotThrow(() => solveContract(definition, { 0: placement }));
    assert.equal(solveContract(definition, { 0: placement }).status, 'dead-end');
  }
});

test('operation limits must be finite non-negative safe integers', () => {
  const definition = generateContract({ difficulty: 'easy', seed: 8, forceFallback: true });
  for (const operationLimit of [NaN, Infinity, -Infinity, -1, 1.5, Number.MAX_VALUE]) {
    assert.throws(() => generateContract({ difficulty: 'easy', seed: 8, operationLimit }), TypeError);
    assert.throws(() => solveContract(definition, {}, { operationLimit }), TypeError);
  }
});

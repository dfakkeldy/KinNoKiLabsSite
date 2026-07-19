import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VOLUME_UNITS, computeDose, computeGeneral, computeRatio,
  convertVolume, partsToPercent, percentToParts, roundMl,
} from '../../Resources/tools/dilution.js';

test('general: 3% target from 30% stock into 500 ml', () => {
  assert.deepEqual(computeGeneral({ stockPercent: 30, targetPercent: 3, totalMl: 500 }),
    { concentrateMl: 50, waterMl: 450 });
});

test('general: target stronger than stock is an error, not a clamp', () => {
  assert.deepEqual(computeGeneral({ stockPercent: 3, targetPercent: 30, totalMl: 500 }),
    { error: 'target-exceeds-stock' });
});

test('general: zero/negative/non-finite inputs are invalid', () => {
  for (const bad of [{ stockPercent: 0, targetPercent: 3, totalMl: 500 },
    { stockPercent: 30, targetPercent: -1, totalMl: 500 },
    { stockPercent: 30, targetPercent: 3, totalMl: 0 },
    { stockPercent: NaN, targetPercent: 3, totalMl: 500 },
    { stockPercent: Infinity, targetPercent: 3, totalMl: 500 },
    { stockPercent: 30, targetPercent: -Infinity, totalMl: 500 }]) {
    assert.deepEqual(computeGeneral(bad), { error: 'invalid' });
  }
});

test('ratio: 1:32 into a 1 L bottle', () => {
  const { concentrateMl, waterMl } = computeRatio({ parts: 32, totalMl: 1000 });
  assert.equal(roundMl(concentrateMl), 30.3);
  assert.equal(roundMl(waterMl), 969.7);
  assert.equal(roundMl(concentrateMl + waterMl), 1000);
});

test('ratio: non-finite inputs are invalid', () => {
  for (const bad of [{ parts: NaN, totalMl: 1000 },
    { parts: Infinity, totalMl: 1000 },
    { parts: 32, totalMl: -Infinity }]) {
    assert.deepEqual(computeRatio(bad), { error: 'invalid' });
  }
});

test('dose: 2 ml/L at strong (1.5x) for a 9 L can', () => {
  assert.deepEqual(computeDose({ dosePerL: 2, totalL: 9, multiplier: 1.5 }), { doseMl: 27 });
});

test('dose: non-finite inputs are invalid', () => {
  for (const bad of [{ dosePerL: NaN, totalL: 9, multiplier: 1 },
    { dosePerL: Infinity, totalL: 9, multiplier: 1 },
    { dosePerL: 2, totalL: -Infinity, multiplier: 1 }]) {
    assert.deepEqual(computeDose(bad), { error: 'invalid' });
  }
});

test('percent/parts round-trip', () => {
  assert.equal(roundMl(percentToParts(partsToPercent(32))), 32);
  assert.equal(percentToParts(0), null);
  assert.equal(percentToParts(100), null);
});

test('volume conversion: tsp to ml and back', () => {
  const ml = convertVolume(3, 'tsp', 'ml');
  assert.ok(Math.abs(ml - 14.78676) < 0.001);
  assert.ok(Math.abs(convertVolume(ml, 'ml', 'tsp') - 3) < 1e-9);
});

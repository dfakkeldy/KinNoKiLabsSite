import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_NUMBERS, countClicks } from '../../Resources/tools/click-counter.js';

test('exposes the six frozen base-number presets in display order', () => {
  assert.equal(Object.isFrozen(BASE_NUMBERS), true);
  assert.deepEqual(BASE_NUMBERS, [2.5, 5, 7.5, 10, 12.5, 15]);
});

test('scales a target to the 60-click base and rounds fractional clicks up', () => {
  assert.equal(countClicks(5, 2.5), 30);
  assert.equal(countClicks(15, 2.5), 10);
  assert.equal(countClicks(7.5, 2), 16);
  assert.equal(countClicks(12.5, 12.5), 60);
  assert.equal(countClicks(5, 5.01), 61);
});

test('does not round exact floating-point boundaries into an extra click', () => {
  assert.equal(countClicks(0.2, 0.1), 30);
  assert.equal(countClicks(2.5, 0.5), 12);
});

test('rejects non-positive bases, negative targets, non-finite values and unsafe results', () => {
  for (const base of [0, -1, NaN, Infinity, -Infinity]) {
    assert.equal(countClicks(base, 1), null);
  }
  for (const target of [-1, NaN, Infinity, -Infinity]) {
    assert.equal(countClicks(5, target), null);
  }
  assert.equal(countClicks(5, Number.MAX_VALUE), null);
  assert.equal(countClicks(5, 0), 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, convert } from '../../Resources/tools/unit-convert.js';

const byId = (id) => CATEGORIES.find((category) => category.id === id);

const expectedUnits = Object.freeze({
  length: ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi'],
  mass: ['g', 'kg', 't', 'oz', 'lb', 'st'],
  temperature: ['c', 'f', 'k'],
  volume: ['ml', 'l', 'tsp', 'tbsp', 'floz', 'cup', 'pt', 'gal'],
  area: ['cm2', 'm2', 'ha', 'km2', 'ft2', 'ac'],
  speed: ['kmh', 'mph', 'ms', 'kn'],
  data: ['b', 'kb', 'mb', 'gb', 'tb', 'kib', 'mib', 'gib'],
});

test('exposes the seven frozen categories and their specified units in order', () => {
  assert.ok(Object.isFrozen(CATEGORIES));
  assert.deepEqual(CATEGORIES.map(({ id }) => id), [
    'length', 'mass', 'temperature', 'volume', 'area', 'speed', 'data',
  ]);
  for (const [categoryId, unitIds] of Object.entries(expectedUnits)) {
    const category = byId(categoryId);
    assert.ok(category, `${categoryId} category should exist`);
    assert.ok(Object.isFrozen(category));
    assert.deepEqual(category.units.map(({ id }) => id), unitIds);
  }
});

test('converts representative linear and affine values exactly', () => {
  assert.equal(convert(1, 'length', 'km', 'm'), 1000);
  assert.equal(convert(1, 'length', 'mi', 'km'), 1.609344);
  assert.equal(convert(100, 'temperature', 'c', 'f'), 212);
  assert.equal(convert(0, 'temperature', 'k', 'c'), -273.15);
  assert.equal(convert(1, 'data', 'gib', 'mb'), 1073.741824);
});

test('round-trips every unit pair in every category', () => {
  const value = 42.75;
  for (const category of CATEGORIES) {
    for (const from of category.units) {
      for (const to of category.units) {
        const converted = convert(value, category.id, from.id, to.id);
        const roundTrip = convert(converted, category.id, to.id, from.id);
        assert.ok(Math.abs(roundTrip - value) < 1e-9,
          `${category.id}: ${from.id} -> ${to.id} -> ${from.id}`);
      }
    }
  }
});

test('returns null for unknown ids and non-finite values', () => {
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(convert(value, 'length', 'm', 'km'), null);
  assert.equal(convert(1, 'missing', 'm', 'km'), null);
  assert.equal(convert(1, 'length', 'missing', 'km'), null);
  assert.equal(convert(1, 'length', 'm', 'missing'), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, installDOM } from '../games/dom-fixture.mjs';
import { renderUnitTool } from '../../Resources/tools/unit-convert-ui.js';

const createStorage = () => {
  const values = Object.create(null);
  return {
    values,
    getItem(key) { return values[key] ?? null; },
    setItem(key, value) { values[key] = String(value); },
    removeItem(key) { delete values[key]; },
  };
};

const field = (root, name) => {
  const input = root.querySelector(`[name=${name}]`);
  assert.ok(input, `field named ${name} should exist`);
  return input;
};

const change = (root, name, value) => {
  const input = field(root, name);
  input.value = value;
  input.dispatchEvent(new Event('change'));
  return input;
};

const input = (root, name, value) => {
  const node = field(root, name);
  node.value = value;
  node.dispatchEvent(new Event('input'));
  return node;
};

const withTool = (run, { storage = createStorage() } = {}) => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  const announcements = [];
  try {
    renderUnitTool(fixture.root, { storage, announce: (text) => announcements.push(text) });
    run({ fixture, storage, announcements });
  } finally {
    restore();
  }
};

test('mounts labelled category and paired unit fields, then repopulates units for a new category', () => withTool(({ fixture, storage }) => {
  const category = field(fixture.root, 'category');
  assert.equal(category.value, 'length');
  assert.match(fixture.root.querySelector('label[for=unit-category]').textContent, /category/i);
  assert.deepEqual(field(fixture.root, 'from').querySelectorAll('option').map((option) => option.value),
    ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi']);
  assert.equal(field(fixture.root, 'fromValue').getAttribute('inputmode'), 'decimal');
  assert.equal(field(fixture.root, 'toValue').getAttribute('inputmode'), 'decimal');

  change(fixture.root, 'category', 'data');
  assert.deepEqual(field(fixture.root, 'from').querySelectorAll('option').map((option) => option.value),
    ['b', 'kb', 'mb', 'gb', 'tb', 'kib', 'mib', 'gib']);
  assert.deepEqual(field(fixture.root, 'to').querySelectorAll('option').map((option) => option.value),
    ['b', 'kb', 'mb', 'gb', 'tb', 'kib', 'mib', 'gib']);
  assert.deepEqual(JSON.parse(storage.values['kinnoki-tools:v1']).tools['unit-converter'], {
    category: 'data', from: 'b', to: 'kb',
  });
}));

test('converts live from either number field, formats to six decimals, and announces the equation', () => withTool(({ fixture, announcements }) => {
  change(fixture.root, 'from', 'km');
  change(fixture.root, 'to', 'm');
  input(fixture.root, 'fromValue', '1');

  assert.equal(field(fixture.root, 'toValue').value, '1000');
  assert.equal(fixture.root.querySelector('.tool-result-strong').textContent, '1 km = 1000 m');
  assert.equal(announcements.at(-1), '1 km = 1000 m');

  input(fixture.root, 'toValue', '1609.344');
  assert.equal(field(fixture.root, 'fromValue').value, '1.609344');
  assert.equal(fixture.root.querySelector('.tool-result-strong').textContent, '1.609344 km = 1609.344 m');
  assert.equal(announcements.at(-1), '1.609344 km = 1609.344 m');
}));

test('restores the saved category and units from the unit-converter preference bag', () => {
  const storage = createStorage();
  storage.setItem('kinnoki-tools:v1', JSON.stringify({
    version: 1,
    tools: { 'unit-converter': { category: 'temperature', from: 'k', to: 'c' } },
  }));
  withTool(({ fixture }) => {
    assert.equal(field(fixture.root, 'category').value, 'temperature');
    assert.equal(field(fixture.root, 'from').value, 'k');
    assert.equal(field(fixture.root, 'to').value, 'c');
    assert.deepEqual(field(fixture.root, 'from').querySelectorAll('option').map((option) => option.value), ['c', 'f', 'k']);
  }, { storage });
});

test('clears a stale conversion and announces an out-of-range value instead of presenting infinity', () => withTool(({ fixture, announcements }) => {
  change(fixture.root, 'from', 'km');
  change(fixture.root, 'to', 'mm');
  input(fixture.root, 'fromValue', '1');
  assert.equal(fixture.root.querySelector('.tool-result-strong').textContent, '1 km = 1000000 mm');

  input(fixture.root, 'fromValue', '9'.repeat(307));
  assert.equal(field(fixture.root, 'toValue').value, '');
  const error = fixture.root.querySelector('.tool-error');
  assert.ok(error);
  assert.match(error.textContent, /out of range/i);
  assert.equal(fixture.root.querySelector('.tool-result-strong'), null);
  assert.equal(fixture.root.textContent.includes('Infinity'), false);
  assert.equal(fixture.root.textContent.includes('NaN'), false);
  assert.equal(fixture.root.textContent.includes('—'), false);
  assert.equal(announcements.at(-1), error.textContent);
}));

import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, installDOM } from '../games/dom-fixture.mjs';
import { renderDilutionTool } from '../../Resources/tools/dilution-ui.js';

const createStorage = () => {
  const values = Object.create(null);
  return {
    values,
    getItem(key) { return values[key] ?? null; },
    setItem(key, value) { values[key] = String(value); },
    removeItem(key) { delete values[key]; },
  };
};

const buttonWithText = (root, text) => root.querySelectorAll('button')
  .find((button) => button.textContent === text);

const setInput = (root, name, value) => {
  const input = root.querySelector(`[name=${name}]`);
  assert.ok(input, `input named ${name} should exist`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
};

const withTool = (run, { storage = createStorage() } = {}) => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  const announcements = [];
  try {
    renderDilutionTool(fixture.root, { storage, announce: (text) => announcements.push(text) });
    run({ fixture, storage, announcements });
  } finally {
    restore();
  }
};

test('mounts accessible modes and calculates a general dilution', () => withTool(({ fixture, announcements }) => {
  const tabs = fixture.root.querySelectorAll('.tool-tab');
  assert.deepEqual(tabs.map((tab) => ({
    text: tab.textContent,
    pressed: tab.getAttribute('aria-pressed'),
    active: tab.classList.contains('is-active'),
  })), [
    { text: 'General', pressed: 'true', active: true },
    { text: 'Cleaning ratio', pressed: 'false', active: false },
    { text: 'Plant feed', pressed: 'false', active: false },
  ]);

  setInput(fixture.root, 'stockPercent', '30');
  setInput(fixture.root, 'targetPercent', '3');
  setInput(fixture.root, 'totalMl', '500');

  const result = fixture.root.querySelector('.tool-result-strong');
  assert.ok(result);
  assert.match(result.textContent, /50 ml/);
  assert.match(result.textContent, /450 ml/);
  assert.equal(announcements.at(-1), result.textContent);
}));

test('shows the exact stronger-than-stock error', () => withTool(({ fixture, announcements }) => {
  setInput(fixture.root, 'stockPercent', '3');
  setInput(fixture.root, 'targetPercent', '30');
  setInput(fixture.root, 'totalMl', '500');

  const error = fixture.root.querySelector('.tool-error');
  assert.ok(error);
  assert.match(error.textContent, /stronger than the stock/);
  assert.equal(announcements.at(-1), error.textContent);
}));

test('ratio quick-pick and bottle preset calculate concentrate and persist mode', () => withTool(({ fixture, storage }) => {
  buttonWithText(fixture.root, 'Cleaning ratio').click();
  buttonWithText(fixture.root, '1:32').click();
  buttonWithText(fixture.root, '1 L').click();

  const result = fixture.root.querySelector('.tool-result-strong');
  assert.ok(result);
  assert.match(result.textContent, /30.3 ml/);
  assert.equal(JSON.parse(storage.values['kinnoki-tools:v1']).tools.dilution.mode, 'ratio');
}));

test('plant feed strong dose uses litres and announces the result', () => withTool(({ fixture, announcements }) => {
  buttonWithText(fixture.root, 'Plant feed').click();
  setInput(fixture.root, 'dosePerL', '2');
  setInput(fixture.root, 'volume', '9');
  buttonWithText(fixture.root, 'Strong').click();

  const result = fixture.root.querySelector('.tool-result-strong');
  assert.ok(result);
  assert.match(result.textContent, /27 ml/);
  assert.equal(announcements.at(-1), result.textContent);
}));

test('plant feed calculates gallons and restores the selected unit on remount', () => {
  const storage = createStorage();
  withTool(({ fixture }) => {
    buttonWithText(fixture.root, 'Plant feed').click();
    const unit = fixture.root.querySelector('[name=volumeUnit]');
    unit.value = 'gal';
    unit.dispatchEvent(new Event('change'));
    setInput(fixture.root, 'dosePerL', '2');
    setInput(fixture.root, 'volume', '1');

    assert.match(fixture.root.querySelector('.tool-result-strong').textContent, /7\.6 ml/);
    const saved = JSON.parse(storage.values['kinnoki-tools:v1']);
    assert.equal(saved.tools.dilution.volumeUnit, 'gal');
    assert.deepEqual(Object.keys(storage.values), ['kinnoki-tools:v1']);
  }, { storage });

  withTool(({ fixture }) => {
    assert.equal(buttonWithText(fixture.root, 'Plant feed').classList.contains('is-active'), true);
    assert.equal(fixture.root.querySelector('[name=volumeUnit]').value, 'gal');
  }, { storage });
});

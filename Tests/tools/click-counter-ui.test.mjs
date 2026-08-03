import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, installDOM } from '../games/dom-fixture.mjs';
import { renderClickCounterTool } from '../../Resources/tools/click-counter-ui.js';

const createStorage = () => {
  const values = Object.create(null);
  return {
    values,
    getItem(key) { return values[key] ?? null; },
    setItem(key, value) { values[key] = String(value); },
    removeItem(key) { delete values[key]; },
  };
};

const withTool = async (run, deps = {}) => {
  const fixture = createDOMFixture();
  const storage = deps.storage ?? createStorage();
  const announcements = [];
  const restore = installDOM(fixture);
  try {
    renderClickCounterTool(fixture.root, {
      storage,
      clipboard: deps.clipboard ?? { async writeText() {} },
      announce: (text) => announcements.push(text),
    });
    await run({ fixture, storage, announcements });
  } finally {
    restore();
  }
};

const buttonWithText = (root, text) => {
  const button = root.querySelectorAll('button').find((candidate) => candidate.textContent === text);
  assert.ok(button, `button ${text} should exist`);
  return button;
};

test('mounts neutral labels, preset buttons, the default result and the local privacy shell', () => withTool(({ fixture }) => {
  assert.equal(fixture.root.querySelector('h1')?.textContent, 'Click Counter');
  assert.equal(fixture.root.querySelector('.tool-lede')?.textContent,
    'Convert a target number into clicks on a 60-click scale.');
  assert.equal(fixture.root.querySelector('.click-counter-value')?.textContent, '30 clicks');
  assert.equal(fixture.root.querySelector('.click-counter-equation')?.textContent, '2.5 ÷ 5 × 60');
  assert.equal(fixture.root.querySelector('[name=targetNumber]')?.value, '2.5');
  assert.deepEqual(
    fixture.root.querySelectorAll('.click-counter-preset').map((button) => ({
      text: button.textContent,
      pressed: button.getAttribute('aria-pressed'),
    })),
    [
      { text: '2.5', pressed: 'false' },
      { text: '5', pressed: 'true' },
      { text: '7.5', pressed: 'false' },
      { text: '10', pressed: 'false' },
      { text: '12.5', pressed: 'false' },
      { text: '15', pressed: 'false' },
    ],
  );
  assert.match(fixture.root.textContent, /Nothing you enter leaves this device\./);
  assert.doesNotMatch(fixture.root.textContent, /mounjaro|medication|dose|injection|pen/i);
}));

test('updates live, rounds up, selects one base and persists only numeric preferences', () => withTool(({ fixture, storage }) => {
  const target = fixture.root.querySelector('[name=targetNumber]');
  target.value = '2';
  target.dispatchEvent(new Event('input'));
  assert.equal(fixture.root.querySelector('.click-counter-value')?.textContent, '24 clicks');

  buttonWithText(fixture.root, '7.5').click();
  assert.equal(fixture.root.querySelector('.click-counter-value')?.textContent, '16 clicks');
  assert.equal(buttonWithText(fixture.root, '7.5').getAttribute('aria-pressed'), 'true');
  assert.equal(buttonWithText(fixture.root, '5').getAttribute('aria-pressed'), 'false');
  assert.deepEqual(JSON.parse(storage.values['kinnoki-tools:v1']).tools['click-counter'], {
    baseNumber: 7.5,
    targetNumber: 2,
  });
}));

test('shows an accessible error for invalid input and reset restores defaults', () => withTool(({ fixture, announcements }) => {
  const target = fixture.root.querySelector('[name=targetNumber]');
  target.value = '-1';
  target.dispatchEvent(new Event('input'));
  assert.match(fixture.root.querySelector('.click-counter-result')?.textContent, /zero or greater/i);
  assert.match(announcements.at(-1), /zero or greater/i);

  buttonWithText(fixture.root, '15').click();
  buttonWithText(fixture.root, 'Reset').click();
  assert.equal(target.value, '2.5');
  assert.equal(buttonWithText(fixture.root, '5').getAttribute('aria-pressed'), 'true');
  assert.equal(fixture.root.querySelector('.click-counter-value')?.textContent, '30 clicks');
}));

test('copies the concise result and reports success or failure without network access', async () => {
  const copied = [];
  await withTool(async ({ fixture, announcements }) => {
    buttonWithText(fixture.root, 'Copy result').click();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(copied, ['30 clicks']);
    assert.equal(fixture.root.querySelector('.click-counter-copy-status')?.textContent, 'Copied!');
    assert.equal(announcements.at(-1), '30 clicks copied.');
  }, { clipboard: { async writeText(value) { copied.push(value); } } });

  await withTool(async ({ fixture, announcements }) => {
    buttonWithText(fixture.root, 'Copy result').click();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fixture.root.querySelector('.click-counter-copy-status')?.textContent,
      'Copy failed. Select the result and copy it manually.');
    assert.match(announcements.at(-1), /Copy failed/);
  }, { clipboard: { async writeText() { throw new Error('denied'); } } });
});

test('normalizes invalid saved preferences to safe defaults', () => {
  const storage = createStorage();
  storage.setItem('kinnoki-tools:v1', JSON.stringify({
    version: 1,
    tools: { 'click-counter': { baseNumber: 6, targetNumber: -3 } },
  }));
  return withTool(({ fixture }) => {
    assert.equal(fixture.root.querySelector('[name=targetNumber]')?.value, '2.5');
    assert.equal(buttonWithText(fixture.root, '5').getAttribute('aria-pressed'), 'true');
  }, { storage });
});

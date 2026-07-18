import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, installDOM } from '../games/dom-fixture.mjs';
import { contrastRatio, suggestPassing } from '../../Resources/tools/contrast.js';
import { renderContrastTool } from '../../Resources/tools/contrast-ui.js';

const createStorage = () => {
  const values = Object.create(null);
  return {
    values,
    getItem(key) { return values[key] ?? null; },
    setItem(key, value) { values[key] = String(value); },
    removeItem(key) { delete values[key]; },
  };
};

const fieldInput = (root, name) => {
  const input = root.querySelector(`[name=${name}]`);
  assert.ok(input, `input named ${name} should exist`);
  return input;
};

const setInput = (root, name, value) => {
  const input = fieldInput(root, name);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  return input;
};

const withTool = (run, { storage = createStorage() } = {}) => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  const announcements = [];
  try {
    renderContrastTool(fixture.root, { storage, announce: (text) => announcements.push(text) });
    run({ fixture, storage, announcements });
  } finally {
    restore();
  }
};

test('mounts synchronized labelled colour fields, five WCAG verdicts, and both preview polarities', () => withTool(({ fixture, announcements }) => {
  const fields = fixture.root.querySelectorAll('.tool-field');
  assert.equal(fields.length, 2);
  assert.match(fixture.root.querySelector('label').textContent, /foreground/i);
  assert.ok(fixture.root.querySelectorAll('label').some((label) => /suggestion target/i.test(label.textContent)));

  const foreground = fieldInput(fixture.root, 'foreground');
  const foregroundColour = fieldInput(fixture.root, 'foregroundColor');
  assert.equal(foreground.value, '#d4af37');
  assert.equal(foregroundColour.getAttribute('type'), 'color');
  assert.equal(foregroundColour.value, '#d4af37');

  setInput(fixture.root, 'foreground', '#ffffff');
  assert.equal(foregroundColour.value, '#ffffff');
  setInput(fixture.root, 'foregroundColor', '#123456');
  assert.equal(foreground.value, '#123456');

  const ratio = contrastRatio('#123456', '#0b0b0c');
  const result = fixture.root.querySelector('.tool-result-strong');
  assert.ok(result);
  assert.equal(result.textContent, `Contrast ${Number(ratio.toFixed(2))} : 1`);
  assert.equal(fixture.root.querySelectorAll('.tool-verdict').length, 5);
  assert.match(fixture.root.querySelector('.tool-verdict').textContent, /AA normal text — (pass|fail)/);

  const swatches = fixture.root.querySelectorAll('.contrast-swatch');
  assert.equal(swatches.length, 2);
  assert.equal(swatches[0].style.getPropertyValue('background-color'), '#0b0b0c');
  assert.equal(swatches[0].style.getPropertyValue('color'), '#123456');
  assert.equal(swatches[1].style.getPropertyValue('background-color'), '#123456');
  assert.equal(swatches[1].style.getPropertyValue('color'), '#0b0b0c');
  assert.equal(announcements.at(-1), `Contrast ${Number(ratio.toFixed(2))} to 1 — AA normal ${ratio >= 4.5 ? 'pass' : 'fail'}`);
}));

test('reports invalid hex without a ratio, WCAG verdicts, or NaN', () => withTool(({ fixture, announcements }) => {
  setInput(fixture.root, 'foreground', '#not-a-colour');

  const error = fixture.root.querySelector('.tool-error');
  assert.ok(error);
  assert.match(error.textContent, /valid hexadecimal/i);
  assert.equal(fixture.root.querySelector('.tool-result-strong'), null);
  assert.equal(fixture.root.querySelectorAll('.tool-verdict').length, 0);
  assert.equal(fixture.root.textContent.includes('NaN'), false);
  assert.equal(announcements.at(-1), error.textContent);
}));

test('offers a chosen-target fix only while failing, applies it, and persists the pair', () => withTool(({ fixture, storage, announcements }) => {
  setInput(fixture.root, 'foreground', '#777777');
  setInput(fixture.root, 'background', '#ffffff');

  const target = fieldInput(fixture.root, 'suggestionTarget');
  assert.deepEqual(target.querySelectorAll('option').map((option) => option.value), ['3', '4.5', '7']);
  assert.equal(target.value, '4.5');
  let button = fixture.root.querySelector('.contrast-suggestion button');
  assert.ok(button);
  assert.equal(button.textContent, 'Suggest a fix');

  target.value = '7';
  target.dispatchEvent(new Event('change'));
  button = fixture.root.querySelector('.contrast-suggestion button');
  button.click();

  const expected = suggestPassing('#777777', '#ffffff', 7);
  assert.equal(fieldInput(fixture.root, 'foreground').value, expected);
  assert.ok(contrastRatio(expected, '#ffffff') >= 7);
  assert.equal(fixture.root.querySelector('.contrast-suggestion button'), null);
  assert.match(announcements.at(-1), /AA normal pass/);
  assert.deepEqual(JSON.parse(storage.values['kinnoki-tools:v1']).tools.contrast, {
    foreground: expected,
    background: '#ffffff',
  });
}));

test('restores the persisted pair and does not offer a suggestion for a passing target', () => {
  const storage = createStorage();
  storage.setItem('kinnoki-tools:v1', JSON.stringify({
    version: 1,
    tools: { contrast: { foreground: '#ffffff', background: '#000000' } },
  }));
  withTool(({ fixture }) => {
    assert.equal(fieldInput(fixture.root, 'foreground').value, '#ffffff');
    assert.equal(fieldInput(fixture.root, 'background').value, '#000000');
    assert.equal(fixture.root.querySelector('.contrast-suggestion button'), null);
  }, { storage });
});

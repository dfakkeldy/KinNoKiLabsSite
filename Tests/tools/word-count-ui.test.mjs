import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, installDOM } from '../games/dom-fixture.mjs';
import { analyzeText } from '../../Resources/tools/word-count.js';
import { renderWordCountTool } from '../../Resources/tools/word-count-ui.js';

const createStorageSpy = () => {
  const calls = [];
  return {
    calls,
    getItem(...args) { calls.push(['getItem', ...args]); return null; },
    setItem(...args) { calls.push(['setItem', ...args]); },
    removeItem(...args) { calls.push(['removeItem', ...args]); },
  };
};

const stats = (root) => Object.fromEntries(root.querySelectorAll('dt').map((term, index) => [
  term.textContent,
  root.querySelectorAll('dd')[index].textContent,
]));

test('mounts a labelled word counter, updates its patched stats, clears text, and never stores it', () => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  const storage = createStorageSpy();
  const announcements = [];
  try {
    renderWordCountTool(fixture.root, { storage, announce: (text) => announcements.push(text) });

    const field = fixture.root.querySelector('textarea.tool-field');
    const label = fixture.root.querySelector('label[for=word-count-text]');
    const list = fixture.root.querySelector('dl');
    assert.ok(field);
    assert.ok(label);
    assert.match(label.textContent, /text/i);
    assert.ok(list);

    const text = `${Array.from({ length: 50 }, (_, index) => `word${index + 1}`).join(' ')}.\n\n${Array.from({ length: 50 }, (_, index) => `word${index + 51}`).join(' ')}!`;
    field.value = text;
    field.dispatchEvent(new Event('input'));

    const result = analyzeText(text);
    assert.equal(fixture.root.querySelector('dl'), list);
    assert.deepEqual(stats(fixture.root), {
      Words: '100',
      Characters: String(result.characters),
      'Characters without spaces': String(result.charactersNoSpaces),
      Sentences: '2',
      Paragraphs: '2',
      'Silent reading': 'under a minute',
      'Read aloud': 'under a minute',
    });
    assert.equal(announcements.at(-1), '100 words');

    const clear = fixture.root.querySelectorAll('button').find((button) => button.textContent === 'Clear');
    assert.ok(clear);
    clear.click();
    assert.equal(field.value, '');
    assert.equal(stats(fixture.root).Words, '0');
    assert.equal(announcements.at(-1), '0 words');
    assert.deepEqual(storage.calls, []);
  } finally {
    restore();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALOUD_WPM,
  SILENT_WPM,
  analyzeText,
  formatDuration,
} from '../../Resources/tools/word-count.js';

test('analyzeText returns zero counts for empty text', () => {
  assert.deepEqual(analyzeText(''), {
    characters: 0,
    charactersNoSpaces: 0,
    words: 0,
    sentences: 0,
    paragraphs: 0,
    silentMinutes: 0,
    aloudMinutes: 0,
  });
});

test('analyzeText segments English words, terminal sentences, and blank-line paragraphs', () => {
  const text = `${Array.from({ length: 50 }, (_, index) => `word${index + 1}`).join(' ')}.\n\n${Array.from({ length: 50 }, (_, index) => `word${index + 51}`).join(' ')}!`;
  const result = analyzeText(text);

  assert.equal(result.words, 100);
  assert.equal(result.sentences, 2);
  assert.equal(result.paragraphs, 2);
  assert.equal(result.silentMinutes, 100 / SILENT_WPM);
  assert.equal(result.aloudMinutes, 100 / ALOUD_WPM);
});

test('analyzeText uses Unicode-aware segments and code-point character counts', () => {
  const cjk = '日本語のテキストです。';
  assert.equal(analyzeText(cjk).words > 1, true);
  assert.equal(analyzeText(cjk).characters, [...cjk].length);

  const spaced = 'A😀\tB\n C';
  assert.equal(analyzeText(spaced).characters, 7);
  assert.equal(analyzeText(spaced).charactersNoSpaces, 4);
});

test('formatDuration uses the exact concise reading-time strings', () => {
  assert.equal(formatDuration(0.3), 'under a minute');
  assert.equal(formatDuration(3.6), '≈ 4 min');
  assert.equal(formatDuration(72), '≈ 1 hr 12 min');
});

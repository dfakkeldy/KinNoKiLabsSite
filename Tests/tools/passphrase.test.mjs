import test from 'node:test';
import assert from 'node:assert/strict';
import { EFF_LARGE_WORDLIST } from '../../Resources/tools/wordlist.js';
import { generatePassphrase, generateString, randomInt } from '../../Resources/tools/passphrase.js';

const sourceFrom = (values) => {
  let calls = 0;
  const source = (buffer) => {
    buffer[0] = values[calls];
    calls += 1;
  };
  return { source, calls: () => calls };
};

test('exports the complete, frozen, lowercase EFF Large Wordlist', () => {
  assert.equal(EFF_LARGE_WORDLIST.length, 7776);
  assert.ok(Object.isFrozen(EFF_LARGE_WORDLIST));
  assert.ok(EFF_LARGE_WORDLIST.every((word) => /^[a-z-]+$/.test(word)));
});

test('randomInt maps an injected Uint32 source deterministically', () => {
  const { source, calls } = sourceFrom([42]);

  assert.equal(randomInt(10, source), 2);
  assert.equal(calls(), 1);
});

test('randomInt rejects a biased-tail value before returning an unbiased value', () => {
  const { source, calls } = sourceFrom([4294964736, 0]);

  assert.equal(randomInt(7776, source), 0);
  assert.equal(calls(), 2);
});

test('generatePassphrase joins the requested words and reports EFF entropy', () => {
  const wordlist = ['alpha', 'bravo', 'cider', 'delta', 'ember'];
  const { source } = sourceFrom([0, 1, 2, 3, 4]);

  const result = generatePassphrase({ words: 5, separator: '-' }, source, wordlist);

  assert.equal(result.phrase, 'alpha-bravo-cider-delta-ember');
  assert.equal(result.entropyBits.toFixed(2), (5 * Math.log2(wordlist.length)).toFixed(2));
});

test('generatePassphrase capitalizes every word when requested', () => {
  const wordlist = ['alpha', 'bravo'];
  const { source } = sourceFrom([0, 1]);

  assert.equal(
    generatePassphrase({ words: 2, separator: ' ', capitalize: true }, source, wordlist).phrase,
    'Alpha Bravo',
  );
});

test('generatePassphrase appends one digit to exactly one word when requested', () => {
  const wordlist = ['alpha', 'bravo', 'cider'];
  const { source } = sourceFrom([0, 1, 2, 1, 7]);

  const result = generatePassphrase({ words: 3, includeNumber: true }, source, wordlist);

  assert.equal(result.phrase, 'alpha-bravo7-cider');
  assert.equal((result.phrase.match(/\d/g) ?? []).length, 1);
  assert.equal(result.entropyBits.toFixed(2), (3 * Math.log2(3) + Math.log2(30)).toFixed(2));
});

test('generateString draws from alphanumeric characters and reports entropy', () => {
  const { source } = sourceFrom(Array(20).fill(0));

  const result = generateString({ length: 20, symbols: false }, source);

  assert.equal(result.value.length, 20);
  assert.match(result.value, /^[a-zA-Z0-9]+$/);
  assert.equal(result.entropyBits, 20 * Math.log2(62));
});

test('generateString reports an error when every character set is disabled', () => {
  const { source } = sourceFrom([]);

  assert.deepEqual(
    generateString({ length: 20, lower: false, upper: false, digits: false, symbols: false }, source),
    { error: 'empty-charset' },
  );
});

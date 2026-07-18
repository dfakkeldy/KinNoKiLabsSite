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

const forbiddenSource = () => {
  let calls = 0;
  const source = () => {
    calls += 1;
    throw new Error('random source must not be called');
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

test('randomInt rejects invalid bounds before calling its source and accepts the Uint32 range', () => {
  for (const maxExclusive of [0, -1, 1.5, NaN, Infinity, 0x100000001]) {
    const { source, calls } = forbiddenSource();

    assert.throws(() => randomInt(maxExclusive, source), RangeError);
    assert.equal(calls(), 0, `source should not run for ${maxExclusive}`);
  }

  const { source } = sourceFrom([0xffffffff]);
  assert.equal(randomInt(0x100000000, source), 0xffffffff);
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

test('generatePassphrase validates word counts before attempting random selection', () => {
  for (const words of [0, -1, 1.5, NaN, Infinity]) {
    const { source, calls } = forbiddenSource();

    assert.throws(
      () => generatePassphrase({ words, capitalize: true, includeNumber: true }, source, ['alpha']),
      RangeError,
    );
    assert.equal(calls(), 0, `source should not run for ${words}`);
  }
});

test('generatePassphrase validates malformed wordlists before attempting random selection', () => {
  const oversizedArray = new Proxy(['alpha'], {
    get(target, property, receiver) {
      return property === 'length' ? 0x100000001 : Reflect.get(target, property, receiver);
    },
  });
  const cases = [
    ['not-an-array', TypeError],
    [[], RangeError],
    [new Array(1), TypeError],
    [[''], TypeError],
    [['alpha', ''], TypeError],
    [oversizedArray, RangeError],
  ];

  for (const [wordlist, errorType] of cases) {
    const { source, calls } = forbiddenSource();

    assert.throws(
      () => generatePassphrase({ words: 1, capitalize: true, includeNumber: true }, source, wordlist),
      errorType,
    );
    assert.equal(calls(), 0, 'source should not run for malformed wordlists');
  }
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

test('generateString validates invalid lengths before checking character sets or calling its source', () => {
  for (const length of [0, -1, 1.5, NaN, Infinity]) {
    const { source, calls } = forbiddenSource();

    assert.throws(
      () => generateString({ length, lower: false, upper: false, digits: false, symbols: false }, source),
      RangeError,
    );
    assert.equal(calls(), 0, `source should not run for ${length}`);
  }
});

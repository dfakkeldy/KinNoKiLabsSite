const UINT32_RANGE = 0x100000000;

const requirePositiveInteger = (value, name) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
};

const requireRandomBound = (maxExclusive, name) => {
  requirePositiveInteger(maxExclusive, name);
  if (maxExclusive > UINT32_RANGE) {
    throw new RangeError(`${name} must be no greater than ${UINT32_RANGE}`);
  }
};

export function randomInt(maxExclusive, randomSource) {
  requireRandomBound(maxExclusive, 'maxExclusive');
  const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  for (;;) {
    randomSource(buffer);
    if (buffer[0] < limit) return buffer[0] % maxExclusive;
  }
}

const defaultSource = (buffer) => crypto.getRandomValues(buffer);

const validateWordlist = (wordlist) => {
  if (!Array.isArray(wordlist)) throw new TypeError('wordlist must be an array');
  if (wordlist.length === 0) throw new RangeError('wordlist must not be empty');
  requireRandomBound(wordlist.length, 'wordlist length');
  for (let index = 0; index < wordlist.length; index += 1) {
    if (typeof wordlist[index] !== 'string' || wordlist[index].length === 0) {
      throw new TypeError('wordlist entries must be non-empty strings');
    }
  }
};

export function generatePassphrase(options, randomSource = defaultSource, wordlist) {
  const { words = 5, separator = '-', capitalize = false, includeNumber = false } = options ?? {};
  requirePositiveInteger(words, 'words');
  validateWordlist(wordlist);
  const picked = Array.from(
    { length: words },
    () => wordlist[randomInt(wordlist.length, randomSource)],
  );
  const cased = capitalize
    ? picked.map((word) => word[0].toUpperCase() + word.slice(1))
    : [...picked];
  let entropyBits = words * Math.log2(wordlist.length);
  if (includeNumber) {
    const slot = randomInt(words, randomSource);
    cased[slot] += String(randomInt(10, randomSource));
    entropyBits += Math.log2(words * 10);
  }
  return { phrase: cased.join(separator), entropyBits };
}

const CHARSETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?',
};

export function generateString(options, randomSource = defaultSource) {
  const { length = 20, lower = true, upper = true, digits = true, symbols = false } = options ?? {};
  requirePositiveInteger(length, 'length');
  const alphabet = Object.entries({ lower, upper, digits, symbols })
    .filter(([, on]) => on)
    .map(([key]) => CHARSETS[key])
    .join('');
  if (!alphabet) return { error: 'empty-charset' };
  const value = Array.from(
    { length },
    () => alphabet[randomInt(alphabet.length, randomSource)],
  ).join('');
  return { value, entropyBits: length * Math.log2(alphabet.length) };
}

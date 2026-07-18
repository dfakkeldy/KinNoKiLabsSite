import test from 'node:test';
import assert from 'node:assert/strict';
import * as matrix from '../../Resources/tools/qr-matrix.js';
import {
  encodeToCodewords,
  totalCodewords,
} from '../../Resources/tools/qr.js';

const {
  buildMatrix,
  dataRegionIterator,
  formatBits,
  generateQr,
} = matrix;

const FORMAT_VECTORS = {
  L: [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976],
  M: [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0],
  Q: [0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed],
  H: [0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b],
};

const moduleAt = ({ size, modules }, column, row) => modules[row * size + column];

const finderRows = [
  '1111111',
  '1000001',
  '1011101',
  '1011101',
  '1011101',
  '1000001',
  '1111111',
];

const assertFinder = (qr, left, top) => {
  finderRows.forEach((row, deltaRow) => {
    [...row].forEach((expected, deltaColumn) => {
      assert.equal(
        moduleAt(qr, left + deltaColumn, top + deltaRow),
        Number(expected),
        `finder module at ${left + deltaColumn},${top + deltaRow}`,
      );
    });
  });
};

const referenceMask = (mask, row, column) => {
  const product = row * column;
  switch (mask) {
    case 0: return (row + column) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return column % 3 === 0;
    case 3: return (row + column) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
    case 5: return (product % 2) + (product % 3) === 0;
    case 6: return ((product % 2) + (product % 3)) % 2 === 0;
    case 7: return ((row + column) % 2 + (product % 3)) % 2 === 0;
    default: throw new RangeError('invalid reference mask');
  }
};

const referencePenalty = ({ size, modules }) => {
  const get = (column, row) => modules[row * size + column];
  let score = 0;

  const scoreLine = (values) => {
    let lineScore = 0;
    let runLength = 1;
    for (let index = 1; index <= values.length; index += 1) {
      if (index < values.length && values[index] === values[index - 1]) {
        runLength += 1;
      } else {
        if (runLength >= 5) lineScore += runLength - 2;
        runLength = 1;
      }
    }

    for (let start = 0; start <= values.length - 11; start += 1) {
      const window = values.slice(start, start + 11).join('');
      if (window === '10111010000' || window === '00001011101') lineScore += 40;
    }
    return lineScore;
  };

  for (let row = 0; row < size; row += 1) {
    score += scoreLine(Array.from({ length: size }, (_, column) => get(column, row)));
  }
  for (let column = 0; column < size; column += 1) {
    score += scoreLine(Array.from({ length: size }, (_, row) => get(column, row)));
  }

  for (let row = 0; row < size - 1; row += 1) {
    for (let column = 0; column < size - 1; column += 1) {
      const value = get(column, row);
      if (
        get(column + 1, row) === value
        && get(column, row + 1) === value
        && get(column + 1, row + 1) === value
      ) score += 3;
    }
  }

  const dark = modules.reduce((total, value) => total + value, 0);
  score += Math.floor(Math.abs(dark * 20 - modules.length * 10) / modules.length) * 10;
  return score;
};

test('exports only the QR matrix contract and required test seams', () => {
  assert.deepEqual(Object.keys(matrix).sort(), [
    'buildMatrix',
    'dataRegionIterator',
    'formatBits',
    'generateQr',
  ]);
});

test('formatBits matches all 32 published BCH format vectors', () => {
  for (const [level, vectors] of Object.entries(FORMAT_VECTORS)) {
    vectors.forEach((expected, mask) => {
      assert.equal(formatBits(level, mask), expected, `${level} mask ${mask}`);
    });
  }
  assert.equal(formatBits('M', 0), 0b101010000010010);
});

test('a version-1 matrix is a bare 21-module symbol with exact finder rings', () => {
  const codewords = encodeToCodewords(new TextEncoder().encode('A'), 1, 'M');
  const qr = buildMatrix(codewords, 1, 'M', { mask: 0 });

  assert.equal(qr.size, 21);
  assert.equal(qr.modules.length, 21 * 21);
  assert.deepEqual(Object.keys(qr).sort(), ['modules', 'size']);
  assertFinder(qr, 0, 0);
  assertFinder(qr, 14, 0);
  assertFinder(qr, 0, 14);
});

test('finder separators stay white on all in-bounds sides', () => {
  const qr = buildMatrix(new Uint8Array(totalCodewords(1)), 1, 'M', { mask: 0 });
  const { size } = qr;
  const expectedWhite = [
    ...Array.from({ length: 8 }, (_, index) => [index, 7]),
    ...Array.from({ length: 8 }, (_, index) => [7, index]),
    ...Array.from({ length: 8 }, (_, index) => [size - 8 + index, 7]),
    ...Array.from({ length: 8 }, (_, index) => [size - 8, index]),
    ...Array.from({ length: 8 }, (_, index) => [index, size - 8]),
    ...Array.from({ length: 8 }, (_, index) => [7, size - 8 + index]),
  ];

  for (const [column, row] of expectedWhite) {
    assert.equal(moduleAt(qr, column, row), 0, `separator at ${column},${row}`);
  }
});

test('timing modules alternate and the fixed dark module is present', () => {
  const qr = buildMatrix(new Uint8Array(totalCodewords(1)), 1, 'M', { mask: 0 });

  for (let coordinate = 8; coordinate <= qr.size - 9; coordinate += 1) {
    const expected = coordinate % 2 === 0 ? 1 : 0;
    assert.equal(moduleAt(qr, coordinate, 6), expected, `timing row ${coordinate}`);
    assert.equal(moduleAt(qr, 6, coordinate), expected, `timing column ${coordinate}`);
  }
  assert.equal(moduleAt(qr, 8, qr.size - 8), 1);
});

test('alignment patterns are exact and finder-overlapping positions are skipped', () => {
  const qr = buildMatrix(new Uint8Array(totalCodewords(2)), 2, 'M', { mask: 0 });
  const center = 18;

  for (let deltaRow = -2; deltaRow <= 2; deltaRow += 1) {
    for (let deltaColumn = -2; deltaColumn <= 2; deltaColumn += 1) {
      const radius = Math.max(Math.abs(deltaColumn), Math.abs(deltaRow));
      const expected = radius === 1 ? 0 : 1;
      assert.equal(
        moduleAt(qr, center + deltaColumn, center + deltaRow),
        expected,
        `alignment module ${deltaColumn},${deltaRow}`,
      );
    }
  }
  assertFinder(qr, 0, 0);
  assertFinder(qr, qr.size - 7, 0);
  assertFinder(qr, 0, qr.size - 7);
});

test('forced format information is written LSB-first into both standard locations', () => {
  const qr = buildMatrix(new Uint8Array(totalCodewords(1)), 1, 'M', { mask: 0 });
  const primary = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const secondary = [
    ...Array.from({ length: 8 }, (_, index) => [qr.size - 1 - index, 8]),
    ...Array.from({ length: 7 }, (_, index) => [8, qr.size - 7 + index]),
  ];
  const readBits = (coordinates) => coordinates.reduce(
    (value, [column, row], bit) => value | (moduleAt(qr, column, row) << bit),
    0,
  );

  assert.equal(readBits(primary), 0b101010000010010);
  assert.equal(readBits(secondary), 0b101010000010010);
});

test('version 7 BCH information is written into both 3-by-6 locations', () => {
  const qr = buildMatrix(new Uint8Array(totalCodewords(7)), 7, 'M', { mask: 0 });
  const expected = 0b000111110010010100;

  for (let bit = 0; bit < 18; bit += 1) {
    const firstColumn = qr.size - 11 + (bit % 3);
    const firstRow = Math.floor(bit / 3);
    const expectedBit = (expected >>> bit) & 1;
    assert.equal(moduleAt(qr, firstColumn, firstRow), expectedBit, `version copy A bit ${bit}`);
    assert.equal(moduleAt(qr, firstRow, firstColumn), expectedBit, `version copy B bit ${bit}`);
  }
});

test('dataRegionIterator is deterministic, unique, and accounts for remainder bits', () => {
  const version1 = [...dataRegionIterator(21, 1)];
  const version2 = [...dataRegionIterator(25, 2)];

  assert.deepEqual(version1.slice(0, 8), [
    [20, 20], [19, 20], [20, 19], [19, 19],
    [20, 18], [19, 18], [20, 17], [19, 17],
  ]);
  assert.equal(version1.length, totalCodewords(1) * 8);
  assert.equal(version2.length, totalCodewords(2) * 8 + 7);
  assert.equal(new Set(version2.map(([column, row]) => `${column},${row}`)).size, version2.length);
  assert.ok(version2.every(([column]) => column !== 6));
  assert.deepEqual([...dataRegionIterator(25, 2)], version2);
});

test('all eight masks preserve the codeword stream and zero-valued remainder bits', () => {
  const bytes = new TextEncoder().encode('https://kinnokilabs.com');
  const version = 2;
  const level = 'M';
  const codewords = encodeToCodewords(bytes, version, level);
  const coordinates = [...dataRegionIterator(25, version)];
  const serialized = new Set();

  for (let mask = 0; mask < 8; mask += 1) {
    const qr = buildMatrix(codewords, version, level, { mask });
    serialized.add(Buffer.from(qr.modules).toString('hex'));

    coordinates.forEach(([column, row], bitIndex) => {
      const observed = moduleAt(qr, column, row) ^ Number(referenceMask(mask, row, column));
      const expected = bitIndex < codewords.length * 8
        ? (codewords[Math.floor(bitIndex / 8)] >>> (7 - (bitIndex % 8))) & 1
        : 0;
      assert.equal(observed, expected, `mask ${mask}, data bit ${bitIndex}`);
    });
  }
  assert.equal(serialized.size, 8);
});

test('automatic mask selection uses the lowest independently scored candidate', () => {
  const codewords = encodeToCodewords(
    new TextEncoder().encode('https://kinnokilabs.com'),
    2,
    'M',
  );
  const candidates = Array.from(
    { length: 8 },
    (_, mask) => buildMatrix(codewords, 2, 'M', { mask }),
  );
  const scores = candidates.map(referencePenalty);
  const expectedMask = scores.indexOf(Math.min(...scores));
  const automatic = buildMatrix(codewords, 2, 'M');

  assert.deepEqual(Object.keys(automatic).sort(), ['modules', 'size']);
  assert.deepEqual(automatic.modules, candidates[expectedMask].modules);
});

test('every emitted module is binary for low and high versions', () => {
  for (const [version, level] of [[1, 'M'], [7, 'Q'], [40, 'H']]) {
    const qr = buildMatrix(new Uint8Array(totalCodewords(version)), version, level);
    assert.ok(qr.modules instanceof Uint8Array);
    assert.ok(qr.modules.every((value) => value === 0 || value === 1), `v${version}${level}`);
  }
});

test('generateQr returns stable public errors and a quiet-zone-independent matrix', () => {
  assert.deepEqual(generateQr(''), { error: 'empty' });
  assert.deepEqual(generateQr('a'.repeat(5000), { level: 'H' }), { error: 'too-long' });

  const qr = generateQr('https://kinnokilabs.com');
  assert.ok(qr.version >= 1);
  assert.equal(qr.level, 'M');
  assert.equal(qr.size, 17 + 4 * qr.version);
  assert.equal(qr.modules.length, qr.size * qr.size);
  assertFinder(qr, 0, 0);
  assert.deepEqual(Object.keys(qr).sort(), ['level', 'modules', 'size', 'version']);
});

test('matrix helpers reject malformed versions, sizes, levels, codewords, and mask seams', () => {
  for (const [size, version] of [[21, 0], [21, 1.5], [21, 41], [25, 1], [21, 2]]) {
    assert.throws(() => [...dataRegionIterator(size, version)], RangeError);
  }
  for (const level of [undefined, '', 'm', 'Z']) {
    assert.throws(() => formatBits(level, 0), RangeError);
    assert.throws(() => buildMatrix(new Uint8Array(totalCodewords(1)), 1, level), RangeError);
  }
  assert.equal(generateQr('A', { level: undefined }).level, 'M');
  for (const level of [null, '', 'm', 'Z']) {
    assert.throws(() => generateQr('A', { level }), RangeError);
  }
  for (const mask of [-1, 1.5, 8, NaN, Infinity]) {
    assert.throws(() => formatBits('M', mask), RangeError);
    assert.throws(
      () => buildMatrix(new Uint8Array(totalCodewords(1)), 1, 'M', { mask }),
      RangeError,
    );
  }
  assert.throws(() => buildMatrix([], 1, 'M'), TypeError);
  assert.throws(() => buildMatrix(new Uint8Array(1), 1, 'M'), RangeError);
  assert.throws(() => buildMatrix(new Uint8Array(totalCodewords(1)), 1, 'M', null), TypeError);
  assert.throws(() => generateQr(null), TypeError);
  assert.throws(() => generateQr('A', null), TypeError);
});

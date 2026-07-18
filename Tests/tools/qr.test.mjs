import test from 'node:test';
import assert from 'node:assert/strict';
import * as qr from '../../Resources/tools/qr.js';

const {
  EC_TABLE,
  alignmentPositions,
  chooseVersion,
  dataCapacity,
  encodeToCodewords,
  gfMul,
  rsEncode,
  totalCodewords,
} = qr;

const LEVELS = ['L', 'M', 'Q', 'H'];

const peasantMul = (left, right) => {
  let a = left;
  let b = right;
  let result = 0;
  while (b) {
    if (b & 1) result ^= a;
    b >>= 1;
    a <<= 1;
    if (a & 0x100) a ^= 0x11d;
  }
  return result;
};

const referenceGenerator = (degree) => {
  let polynomial = [1];
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    const product = new Array(polynomial.length + 1).fill(0);
    for (let coefficient = 0; coefficient < polynomial.length; coefficient += 1) {
      product[coefficient] ^= polynomial[coefficient];
      product[coefficient + 1] ^= peasantMul(polynomial[coefficient], root);
    }
    polynomial = product;
    root = peasantMul(root, 2);
  }
  return polynomial;
};

const referenceRsEncode = (data, degree) => {
  const generator = referenceGenerator(degree);
  const dividend = [...data, ...new Array(degree).fill(0)];
  for (let index = 0; index < data.length; index += 1) {
    const factor = dividend[index];
    for (let coefficient = 0; coefficient < generator.length; coefficient += 1) {
      dividend[index + coefficient] ^= peasantMul(generator[coefficient], factor);
    }
  }
  return dividend.slice(-degree);
};

const referenceDataCodewords = (bytes, version, count) => {
  const bits = [];
  const append = (value, width) => {
    for (let bit = width - 1; bit >= 0; bit -= 1) bits.push((value >>> bit) & 1);
  };
  append(0b0100, 4);
  append(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) append(byte, 8);
  for (let index = 0; index < Math.min(4, count * 8 - bits.length); index += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const result = [];
  for (let index = 0; index < bits.length; index += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit += 1) byte = (byte << 1) | bits[index + bit];
    result.push(byte);
  }
  for (let pad = 0xec; result.length < count; pad ^= 0xfd) result.push(pad);
  return result;
};

const interleave = (blocks) => {
  const result = [];
  const width = Math.max(...blocks.map((block) => block.length));
  for (let column = 0; column < width; column += 1) {
    for (const block of blocks) if (column < block.length) result.push(block[column]);
  }
  return result;
};

const PUBLISHED_V1_TO_V5 = {
  1: {
    L: { ecPerBlock: 7, groups: [[1, 19]] },
    M: { ecPerBlock: 10, groups: [[1, 16]] },
    Q: { ecPerBlock: 13, groups: [[1, 13]] },
    H: { ecPerBlock: 17, groups: [[1, 9]] },
  },
  2: {
    L: { ecPerBlock: 10, groups: [[1, 34]] },
    M: { ecPerBlock: 16, groups: [[1, 28]] },
    Q: { ecPerBlock: 22, groups: [[1, 22]] },
    H: { ecPerBlock: 28, groups: [[1, 16]] },
  },
  3: {
    L: { ecPerBlock: 15, groups: [[1, 55]] },
    M: { ecPerBlock: 26, groups: [[1, 44]] },
    Q: { ecPerBlock: 18, groups: [[2, 17]] },
    H: { ecPerBlock: 22, groups: [[2, 13]] },
  },
  4: {
    L: { ecPerBlock: 20, groups: [[1, 80]] },
    M: { ecPerBlock: 18, groups: [[2, 32]] },
    Q: { ecPerBlock: 26, groups: [[2, 24]] },
    H: { ecPerBlock: 16, groups: [[4, 9]] },
  },
  5: {
    L: { ecPerBlock: 26, groups: [[1, 108]] },
    M: { ecPerBlock: 24, groups: [[2, 43]] },
    Q: { ecPerBlock: 18, groups: [[2, 15], [2, 16]] },
    H: { ecPerBlock: 22, groups: [[2, 11], [2, 12]] },
  },
};

test('exports only the QR codeword-layer contract', () => {
  assert.deepEqual(Object.keys(qr).sort(), [
    'EC_TABLE',
    'alignmentPositions',
    'chooseVersion',
    'dataCapacity',
    'encodeToCodewords',
    'gfMul',
    'rsEncode',
    'totalCodewords',
  ]);
});

test('gfMul agrees with peasant multiplication for 200 deterministic pairs', () => {
  for (let index = 0; index < 200; index += 1) {
    const a = (index * 37 + 11) % 256;
    const b = (index * 91 + 5) % 256;
    assert.equal(gfMul(a, b), peasantMul(a, b), `${a}*${b}`);
  }
  assert.equal(gfMul(0, 255), 0);
  assert.equal(gfMul(255, 0), 0);
});

test('rsEncode matches an independent polynomial implementation', () => {
  const data = Uint8Array.from({ length: 53 }, (_, index) => (index * 17 + 3) & 0xff);
  for (const degree of [7, 10, 18, 30]) {
    assert.deepEqual([...rsEncode(data, degree)], referenceRsEncode(data, degree), `degree ${degree}`);
  }
});

test('rsEncode produces a codeword polynomial divisible by its generator', () => {
  const data = Uint8Array.from({ length: 19 }, (_, index) => (index * 17 + 3) & 0xff);
  const ecc = rsEncode(data, 7);
  assert.equal(ecc.length, 7);
  assert.deepEqual(
    [...rsEncode(Uint8Array.from([...data, ...ecc]), 7)],
    new Array(7).fill(0),
  );
});

test('GF and Reed-Solomon helpers reject invalid arguments', () => {
  for (const value of [-1, 1.5, 256, NaN, Infinity]) {
    assert.throws(() => gfMul(value, 1), RangeError);
    assert.throws(() => gfMul(1, value), RangeError);
  }
  assert.throws(() => rsEncode([], 7), TypeError);
  for (const degree of [0, -1, 1.5, 256, NaN, Infinity]) {
    assert.throws(() => rsEncode(new Uint8Array(), degree), RangeError);
  }
});

test('totalCodewords matches known anchors including the version-info branch', () => {
  assert.equal(totalCodewords(1), 26);
  assert.equal(totalCodewords(2), 44);
  assert.equal(totalCodewords(3), 70);
  assert.equal(totalCodewords(7), 196);
  assert.equal(totalCodewords(40), 3706);
});

test('EC_TABLE is internally consistent for all 40 versions x 4 levels', () => {
  assert.equal(Object.keys(EC_TABLE).length, 40);
  for (let version = 1; version <= 40; version += 1) {
    for (const level of LEVELS) {
      const { ecPerBlock, groups } = EC_TABLE[version][level];
      const sum = groups.reduce(
        (total, [blocks, data]) => total + blocks * (data + ecPerBlock),
        0,
      );
      assert.equal(sum, totalCodewords(version), `v${version}${level}`);
      assert.ok(groups.length === 1 || groups.length === 2, `v${version}${level} group count`);
      if (groups.length === 2) {
        assert.equal(groups[1][1], groups[0][1] + 1, `v${version}${level} group ordering`);
      }
    }
  }
});

test('versions 1 through 5 match the published block table', () => {
  for (let version = 1; version <= 5; version += 1) {
    assert.deepEqual(EC_TABLE[version], PUBLISHED_V1_TO_V5[version], `version ${version}`);
  }
});

test('high-version block-group anchors match the published block table', () => {
  assert.deepEqual(EC_TABLE[10], {
    L: { ecPerBlock: 18, groups: [[2, 68], [2, 69]] },
    M: { ecPerBlock: 26, groups: [[4, 43], [1, 44]] },
    Q: { ecPerBlock: 24, groups: [[6, 19], [2, 20]] },
    H: { ecPerBlock: 28, groups: [[6, 15], [2, 16]] },
  });
  assert.deepEqual(EC_TABLE[40], {
    L: { ecPerBlock: 30, groups: [[19, 118], [6, 119]] },
    M: { ecPerBlock: 28, groups: [[18, 47], [31, 48]] },
    Q: { ecPerBlock: 30, groups: [[34, 24], [34, 25]] },
    H: { ecPerBlock: 30, groups: [[20, 15], [61, 16]] },
  });
});

test('chooseVersion and byte-mode capacity boundaries are exact', () => {
  assert.equal(dataCapacity(1, 'L'), 17);
  assert.equal(chooseVersion(17, 'L'), 1);
  assert.equal(chooseVersion(18, 'L'), 2);
  assert.equal(dataCapacity(10, 'L'), 271);
  assert.equal(chooseVersion(271, 'L'), 10);
  assert.equal(chooseVersion(272, 'L'), 11);
  assert.equal(chooseVersion(300, 'L'), 11);
  assert.equal(dataCapacity(40, 'L'), 2953);
  assert.equal(chooseVersion(2953, 'L'), 40);
  assert.equal(chooseVersion(2954, 'L'), null);
  assert.equal(chooseVersion(999999, 'L'), null);
});

test('encodeToCodewords lays out v1-M byte mode, terminator, and alternating padding', () => {
  const bytes = new TextEncoder().encode('AB');
  const codewords = encodeToCodewords(bytes, 1, 'M');
  const data = [
    0x40, 0x24, 0x14, 0x20,
    0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11,
  ];
  assert.equal(codewords.length, 26);
  assert.deepEqual([...codewords.slice(0, 16)], data);
  assert.equal(codewords[14], 0xec);
  assert.equal(codewords[15], 0x11);
  assert.deepEqual([...codewords.slice(16)], referenceRsEncode(data, 10));
});

test('versions 10 and above use a 16-bit byte count without overrunning fixed capacity', () => {
  const v10 = encodeToCodewords(new Uint8Array(260), 10, 'L');
  assert.deepEqual([v10[0], v10[4], v10[8]], [0x40, 0x10, 0x40]);
  assert.throws(() => encodeToCodewords(new Uint8Array(300), 10, 'L'), RangeError);

  const v11 = encodeToCodewords(new Uint8Array(300), 11, 'L');
  assert.deepEqual([v11[0], v11[4], v11[8]], [0x40, 0x12, 0xc0]);
});

test('encodeToCodewords splits mixed-length blocks and interleaves data then EC columns', () => {
  const bytes = Uint8Array.from({ length: 20 }, (_, index) => (index * 29 + 7) & 0xff);
  const data = referenceDataCodewords(bytes, 5, 62);
  const blocks = [
    data.slice(0, 15),
    data.slice(15, 30),
    data.slice(30, 46),
    data.slice(46, 62),
  ];
  const expected = [
    ...interleave(blocks),
    ...interleave(blocks.map((block) => referenceRsEncode(block, 18))),
  ];
  assert.deepEqual([...encodeToCodewords(bytes, 5, 'Q')], expected);
});

test('alignmentPositions matches anchors and spec structure', () => {
  assert.deepEqual(alignmentPositions(1), []);
  assert.deepEqual(alignmentPositions(2), [6, 18]);
  assert.deepEqual(alignmentPositions(7), [6, 22, 38]);
  assert.deepEqual(alignmentPositions(32), [6, 34, 60, 86, 112, 138]);
  assert.deepEqual(alignmentPositions(40), [6, 30, 58, 86, 114, 142, 170]);
  for (let version = 2; version <= 40; version += 1) {
    const positions = alignmentPositions(version);
    const size = 17 + 4 * version;
    assert.equal(positions.length, Math.floor(version / 7) + 2, `v${version} count`);
    assert.equal(positions[0], 6, `v${version} first`);
    assert.equal(positions.at(-1), size - 7, `v${version} last`);
    for (let index = 2; index < positions.length; index += 1) {
      assert.equal(
        positions[index] - positions[index - 1],
        positions[2] - positions[1],
        `v${version} even spacing`,
      );
    }
  }
});

test('public QR helpers reject invalid versions, levels, lengths, and byte containers', () => {
  for (const version of [0, -1, 1.5, 41, NaN, Infinity]) {
    assert.throws(() => totalCodewords(version), RangeError);
    assert.throws(() => alignmentPositions(version), RangeError);
    assert.throws(() => dataCapacity(version, 'L'), RangeError);
  }
  for (const level of [undefined, '', 'l', 'Z']) {
    assert.throws(() => dataCapacity(1, level), RangeError);
    assert.throws(() => chooseVersion(1, level), RangeError);
  }
  for (const length of [-1, 1.5, NaN, Infinity]) {
    assert.throws(() => chooseVersion(length, 'L'), RangeError);
  }
  assert.throws(() => encodeToCodewords([], 1, 'L'), TypeError);
  assert.throws(() => encodeToCodewords(new Uint8Array(18), 1, 'L'), RangeError);
});

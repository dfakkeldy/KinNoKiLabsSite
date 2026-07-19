const MIN_VERSION = 1;
const MAX_VERSION = 40;
const LEVELS = new Set(['L', 'M', 'Q', 'H']);

const requireIntegerInRange = (value, minimum, maximum, name) => {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(name + ' must be an integer from ' + minimum + ' through ' + maximum);
  }
};

const requireVersion = (version) => {
  requireIntegerInRange(version, MIN_VERSION, MAX_VERSION, 'version');
};

const requireLevel = (level) => {
  if (!LEVELS.has(level)) throw new RangeError('level must be L, M, Q, or H');
};

const requireBytes = (bytes) => {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('bytes must be a Uint8Array');
};

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

{
  let value = 1;
  for (let exponent = 0; exponent < 255; exponent += 1) {
    GF_EXP[exponent] = value;
    GF_LOG[value] = exponent;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let exponent = 255; exponent < GF_EXP.length; exponent += 1) {
    GF_EXP[exponent] = GF_EXP[exponent - 255];
  }
}

const multiply = (left, right) => (
  left === 0 || right === 0 ? 0 : GF_EXP[GF_LOG[left] + GF_LOG[right]]
);

export function gfMul(left, right) {
  requireIntegerInRange(left, 0, 255, 'left');
  requireIntegerInRange(right, 0, 255, 'right');
  return multiply(left, right);
}

const generatorCache = new Map();

const rsGeneratorPoly = (degree) => {
  const cached = generatorCache.get(degree);
  if (cached) return cached;

  let polynomial = Uint8Array.of(1);
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    const product = new Uint8Array(polynomial.length + 1);
    for (let coefficient = 0; coefficient < polynomial.length; coefficient += 1) {
      product[coefficient] ^= polynomial[coefficient];
      product[coefficient + 1] ^= multiply(polynomial[coefficient], root);
    }
    polynomial = product;
    root = multiply(root, 2);
  }
  generatorCache.set(degree, polynomial);
  return polynomial;
};

export function rsEncode(dataBytes, ecCount) {
  requireBytes(dataBytes);
  requireIntegerInRange(ecCount, 1, 255, 'ecCount');

  const generator = rsGeneratorPoly(ecCount);
  const dividend = new Uint8Array(dataBytes.length + ecCount);
  dividend.set(dataBytes);
  for (let index = 0; index < dataBytes.length; index += 1) {
    const factor = dividend[index];
    if (factor === 0) continue;
    for (let coefficient = 0; coefficient < generator.length; coefficient += 1) {
      dividend[index + coefficient] ^= multiply(generator[coefficient], factor);
    }
  }
  return dividend.slice(dataBytes.length);
}

const freezeEcTable = (table) => {
  for (const version of Object.values(table)) {
    for (const row of Object.values(version)) {
      for (const group of row.groups) Object.freeze(group);
      Object.freeze(row.groups);
      Object.freeze(row);
    }
    Object.freeze(version);
  }
  return Object.freeze(table);
};

// QR Model 2 block rows are transcribed from ZXing Version.java at commit
// ff54b24b26b1c80a78aa69a9bb0b61bf7c9c5267 and independently checked against
// Nayuki qrcodegen.ts at commit 2c9044de6b049ca25cb3cd1649ed7e27aa055138.
export const EC_TABLE = freezeEcTable({
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
  6: {
    L: { ecPerBlock: 18, groups: [[2, 68]] },
    M: { ecPerBlock: 16, groups: [[4, 27]] },
    Q: { ecPerBlock: 24, groups: [[4, 19]] },
    H: { ecPerBlock: 28, groups: [[4, 15]] },
  },
  7: {
    L: { ecPerBlock: 20, groups: [[2, 78]] },
    M: { ecPerBlock: 18, groups: [[4, 31]] },
    Q: { ecPerBlock: 18, groups: [[2, 14], [4, 15]] },
    H: { ecPerBlock: 26, groups: [[4, 13], [1, 14]] },
  },
  8: {
    L: { ecPerBlock: 24, groups: [[2, 97]] },
    M: { ecPerBlock: 22, groups: [[2, 38], [2, 39]] },
    Q: { ecPerBlock: 22, groups: [[4, 18], [2, 19]] },
    H: { ecPerBlock: 26, groups: [[4, 14], [2, 15]] },
  },
  9: {
    L: { ecPerBlock: 30, groups: [[2, 116]] },
    M: { ecPerBlock: 22, groups: [[3, 36], [2, 37]] },
    Q: { ecPerBlock: 20, groups: [[4, 16], [4, 17]] },
    H: { ecPerBlock: 24, groups: [[4, 12], [4, 13]] },
  },
  10: {
    L: { ecPerBlock: 18, groups: [[2, 68], [2, 69]] },
    M: { ecPerBlock: 26, groups: [[4, 43], [1, 44]] },
    Q: { ecPerBlock: 24, groups: [[6, 19], [2, 20]] },
    H: { ecPerBlock: 28, groups: [[6, 15], [2, 16]] },
  },
  11: {
    L: { ecPerBlock: 20, groups: [[4, 81]] },
    M: { ecPerBlock: 30, groups: [[1, 50], [4, 51]] },
    Q: { ecPerBlock: 28, groups: [[4, 22], [4, 23]] },
    H: { ecPerBlock: 24, groups: [[3, 12], [8, 13]] },
  },
  12: {
    L: { ecPerBlock: 24, groups: [[2, 92], [2, 93]] },
    M: { ecPerBlock: 22, groups: [[6, 36], [2, 37]] },
    Q: { ecPerBlock: 26, groups: [[4, 20], [6, 21]] },
    H: { ecPerBlock: 28, groups: [[7, 14], [4, 15]] },
  },
  13: {
    L: { ecPerBlock: 26, groups: [[4, 107]] },
    M: { ecPerBlock: 22, groups: [[8, 37], [1, 38]] },
    Q: { ecPerBlock: 24, groups: [[8, 20], [4, 21]] },
    H: { ecPerBlock: 22, groups: [[12, 11], [4, 12]] },
  },
  14: {
    L: { ecPerBlock: 30, groups: [[3, 115], [1, 116]] },
    M: { ecPerBlock: 24, groups: [[4, 40], [5, 41]] },
    Q: { ecPerBlock: 20, groups: [[11, 16], [5, 17]] },
    H: { ecPerBlock: 24, groups: [[11, 12], [5, 13]] },
  },
  15: {
    L: { ecPerBlock: 22, groups: [[5, 87], [1, 88]] },
    M: { ecPerBlock: 24, groups: [[5, 41], [5, 42]] },
    Q: { ecPerBlock: 30, groups: [[5, 24], [7, 25]] },
    H: { ecPerBlock: 24, groups: [[11, 12], [7, 13]] },
  },
  16: {
    L: { ecPerBlock: 24, groups: [[5, 98], [1, 99]] },
    M: { ecPerBlock: 28, groups: [[7, 45], [3, 46]] },
    Q: { ecPerBlock: 24, groups: [[15, 19], [2, 20]] },
    H: { ecPerBlock: 30, groups: [[3, 15], [13, 16]] },
  },
  17: {
    L: { ecPerBlock: 28, groups: [[1, 107], [5, 108]] },
    M: { ecPerBlock: 28, groups: [[10, 46], [1, 47]] },
    Q: { ecPerBlock: 28, groups: [[1, 22], [15, 23]] },
    H: { ecPerBlock: 28, groups: [[2, 14], [17, 15]] },
  },
  18: {
    L: { ecPerBlock: 30, groups: [[5, 120], [1, 121]] },
    M: { ecPerBlock: 26, groups: [[9, 43], [4, 44]] },
    Q: { ecPerBlock: 28, groups: [[17, 22], [1, 23]] },
    H: { ecPerBlock: 28, groups: [[2, 14], [19, 15]] },
  },
  19: {
    L: { ecPerBlock: 28, groups: [[3, 113], [4, 114]] },
    M: { ecPerBlock: 26, groups: [[3, 44], [11, 45]] },
    Q: { ecPerBlock: 26, groups: [[17, 21], [4, 22]] },
    H: { ecPerBlock: 26, groups: [[9, 13], [16, 14]] },
  },
  20: {
    L: { ecPerBlock: 28, groups: [[3, 107], [5, 108]] },
    M: { ecPerBlock: 26, groups: [[3, 41], [13, 42]] },
    Q: { ecPerBlock: 30, groups: [[15, 24], [5, 25]] },
    H: { ecPerBlock: 28, groups: [[15, 15], [10, 16]] },
  },
  21: {
    L: { ecPerBlock: 28, groups: [[4, 116], [4, 117]] },
    M: { ecPerBlock: 26, groups: [[17, 42]] },
    Q: { ecPerBlock: 28, groups: [[17, 22], [6, 23]] },
    H: { ecPerBlock: 30, groups: [[19, 16], [6, 17]] },
  },
  22: {
    L: { ecPerBlock: 28, groups: [[2, 111], [7, 112]] },
    M: { ecPerBlock: 28, groups: [[17, 46]] },
    Q: { ecPerBlock: 30, groups: [[7, 24], [16, 25]] },
    H: { ecPerBlock: 24, groups: [[34, 13]] },
  },
  23: {
    L: { ecPerBlock: 30, groups: [[4, 121], [5, 122]] },
    M: { ecPerBlock: 28, groups: [[4, 47], [14, 48]] },
    Q: { ecPerBlock: 30, groups: [[11, 24], [14, 25]] },
    H: { ecPerBlock: 30, groups: [[16, 15], [14, 16]] },
  },
  24: {
    L: { ecPerBlock: 30, groups: [[6, 117], [4, 118]] },
    M: { ecPerBlock: 28, groups: [[6, 45], [14, 46]] },
    Q: { ecPerBlock: 30, groups: [[11, 24], [16, 25]] },
    H: { ecPerBlock: 30, groups: [[30, 16], [2, 17]] },
  },
  25: {
    L: { ecPerBlock: 26, groups: [[8, 106], [4, 107]] },
    M: { ecPerBlock: 28, groups: [[8, 47], [13, 48]] },
    Q: { ecPerBlock: 30, groups: [[7, 24], [22, 25]] },
    H: { ecPerBlock: 30, groups: [[22, 15], [13, 16]] },
  },
  26: {
    L: { ecPerBlock: 28, groups: [[10, 114], [2, 115]] },
    M: { ecPerBlock: 28, groups: [[19, 46], [4, 47]] },
    Q: { ecPerBlock: 28, groups: [[28, 22], [6, 23]] },
    H: { ecPerBlock: 30, groups: [[33, 16], [4, 17]] },
  },
  27: {
    L: { ecPerBlock: 30, groups: [[8, 122], [4, 123]] },
    M: { ecPerBlock: 28, groups: [[22, 45], [3, 46]] },
    Q: { ecPerBlock: 30, groups: [[8, 23], [26, 24]] },
    H: { ecPerBlock: 30, groups: [[12, 15], [28, 16]] },
  },
  28: {
    L: { ecPerBlock: 30, groups: [[3, 117], [10, 118]] },
    M: { ecPerBlock: 28, groups: [[3, 45], [23, 46]] },
    Q: { ecPerBlock: 30, groups: [[4, 24], [31, 25]] },
    H: { ecPerBlock: 30, groups: [[11, 15], [31, 16]] },
  },
  29: {
    L: { ecPerBlock: 30, groups: [[7, 116], [7, 117]] },
    M: { ecPerBlock: 28, groups: [[21, 45], [7, 46]] },
    Q: { ecPerBlock: 30, groups: [[1, 23], [37, 24]] },
    H: { ecPerBlock: 30, groups: [[19, 15], [26, 16]] },
  },
  30: {
    L: { ecPerBlock: 30, groups: [[5, 115], [10, 116]] },
    M: { ecPerBlock: 28, groups: [[19, 47], [10, 48]] },
    Q: { ecPerBlock: 30, groups: [[15, 24], [25, 25]] },
    H: { ecPerBlock: 30, groups: [[23, 15], [25, 16]] },
  },
  31: {
    L: { ecPerBlock: 30, groups: [[13, 115], [3, 116]] },
    M: { ecPerBlock: 28, groups: [[2, 46], [29, 47]] },
    Q: { ecPerBlock: 30, groups: [[42, 24], [1, 25]] },
    H: { ecPerBlock: 30, groups: [[23, 15], [28, 16]] },
  },
  32: {
    L: { ecPerBlock: 30, groups: [[17, 115]] },
    M: { ecPerBlock: 28, groups: [[10, 46], [23, 47]] },
    Q: { ecPerBlock: 30, groups: [[10, 24], [35, 25]] },
    H: { ecPerBlock: 30, groups: [[19, 15], [35, 16]] },
  },
  33: {
    L: { ecPerBlock: 30, groups: [[17, 115], [1, 116]] },
    M: { ecPerBlock: 28, groups: [[14, 46], [21, 47]] },
    Q: { ecPerBlock: 30, groups: [[29, 24], [19, 25]] },
    H: { ecPerBlock: 30, groups: [[11, 15], [46, 16]] },
  },
  34: {
    L: { ecPerBlock: 30, groups: [[13, 115], [6, 116]] },
    M: { ecPerBlock: 28, groups: [[14, 46], [23, 47]] },
    Q: { ecPerBlock: 30, groups: [[44, 24], [7, 25]] },
    H: { ecPerBlock: 30, groups: [[59, 16], [1, 17]] },
  },
  35: {
    L: { ecPerBlock: 30, groups: [[12, 121], [7, 122]] },
    M: { ecPerBlock: 28, groups: [[12, 47], [26, 48]] },
    Q: { ecPerBlock: 30, groups: [[39, 24], [14, 25]] },
    H: { ecPerBlock: 30, groups: [[22, 15], [41, 16]] },
  },
  36: {
    L: { ecPerBlock: 30, groups: [[6, 121], [14, 122]] },
    M: { ecPerBlock: 28, groups: [[6, 47], [34, 48]] },
    Q: { ecPerBlock: 30, groups: [[46, 24], [10, 25]] },
    H: { ecPerBlock: 30, groups: [[2, 15], [64, 16]] },
  },
  37: {
    L: { ecPerBlock: 30, groups: [[17, 122], [4, 123]] },
    M: { ecPerBlock: 28, groups: [[29, 46], [14, 47]] },
    Q: { ecPerBlock: 30, groups: [[49, 24], [10, 25]] },
    H: { ecPerBlock: 30, groups: [[24, 15], [46, 16]] },
  },
  38: {
    L: { ecPerBlock: 30, groups: [[4, 122], [18, 123]] },
    M: { ecPerBlock: 28, groups: [[13, 46], [32, 47]] },
    Q: { ecPerBlock: 30, groups: [[48, 24], [14, 25]] },
    H: { ecPerBlock: 30, groups: [[42, 15], [32, 16]] },
  },
  39: {
    L: { ecPerBlock: 30, groups: [[20, 117], [4, 118]] },
    M: { ecPerBlock: 28, groups: [[40, 47], [7, 48]] },
    Q: { ecPerBlock: 30, groups: [[43, 24], [22, 25]] },
    H: { ecPerBlock: 30, groups: [[10, 15], [67, 16]] },
  },
  40: {
    L: { ecPerBlock: 30, groups: [[19, 118], [6, 119]] },
    M: { ecPerBlock: 28, groups: [[18, 47], [31, 48]] },
    Q: { ecPerBlock: 30, groups: [[34, 24], [34, 25]] },
    H: { ecPerBlock: 30, groups: [[20, 15], [61, 16]] },
  },
});

export function alignmentPositions(version) {
  requireVersion(version);
  if (version === 1) return [];

  const count = Math.floor(version / 7) + 2;
  const size = 17 + 4 * version;
  const step = version === 32
    ? 26
    : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const positions = [6];
  for (
    let index = count - 1, position = size - 7;
    index >= 1;
    index -= 1, position -= step
  ) {
    positions[index] = position;
  }
  return positions;
}

export function totalCodewords(version) {
  requireVersion(version);
  const size = 17 + 4 * version;
  const reserved = new Uint8Array(size * size);
  const mark = (x, y) => {
    reserved[y * size + x] = 1;
  };

  for (let x = 0; x < 9; x += 1) {
    for (let y = 0; y < 9; y += 1) {
      mark(x, y);
      if (x < 8) mark(size - 1 - x, y);
      if (y < 8) mark(x, size - 1 - y);
    }
  }
  for (let index = 0; index < size; index += 1) {
    mark(index, 6);
    mark(6, index);
  }

  const centers = alignmentPositions(version);
  const last = centers.length - 1;
  centers.forEach((centerX, indexX) => centers.forEach((centerY, indexY) => {
    const overlapsFinder = (
      (indexX === 0 && indexY === 0)
      || (indexX === 0 && indexY === last)
      || (indexX === last && indexY === 0)
    );
    if (overlapsFinder) return;
    for (let deltaX = -2; deltaX <= 2; deltaX += 1) {
      for (let deltaY = -2; deltaY <= 2; deltaY += 1) {
        mark(centerX + deltaX, centerY + deltaY);
      }
    }
  }));

  if (version >= 7) {
    for (let long = 0; long < 6; long += 1) {
      for (let short = 0; short < 3; short += 1) {
        mark(size - 11 + short, long);
        mark(long, size - 11 + short);
      }
    }
  }

  let freeModules = 0;
  for (const cell of reserved) if (!cell) freeModules += 1;
  return Math.floor(freeModules / 8);
}

const dataCodewordCount = (version, level) => (
  EC_TABLE[version][level].groups.reduce(
    (total, [blocks, dataPerBlock]) => total + blocks * dataPerBlock,
    0,
  )
);

const payloadCapacity = (version, level) => (
  dataCodewordCount(version, level) - (version < 10 ? 2 : 3)
);

export function dataCapacity(version, level) {
  requireVersion(version);
  requireLevel(level);
  return payloadCapacity(version, level);
}

export function chooseVersion(byteLength, level) {
  if (!Number.isInteger(byteLength) || byteLength < 0) {
    throw new RangeError('byteLength must be a non-negative integer');
  }
  requireLevel(level);
  for (let version = MIN_VERSION; version <= MAX_VERSION; version += 1) {
    if (byteLength <= payloadCapacity(version, level)) return version;
  }
  return null;
}

const appendBits = (bits, value, width) => {
  for (let bit = width - 1; bit >= 0; bit -= 1) bits.push((value >>> bit) & 1);
};

const makeDataCodewords = (bytes, version, level) => {
  const count = dataCodewordCount(version, level);
  const capacityBits = count * 8;
  const bits = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) appendBits(bits, byte, 8);

  const terminatorLength = Math.min(4, capacityBits - bits.length);
  for (let index = 0; index < terminatorLength; index += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data = new Uint8Array(count);
  for (let index = 0; index < bits.length; index += 1) {
    data[Math.floor(index / 8)] |= bits[index] << (7 - (index % 8));
  }
  let pad = 0xec;
  for (let index = bits.length / 8; index < data.length; index += 1) {
    data[index] = pad;
    pad = pad === 0xec ? 0x11 : 0xec;
  }
  return data;
};

export function encodeToCodewords(bytes, version, level) {
  requireBytes(bytes);
  requireVersion(version);
  requireLevel(level);
  if (bytes.length > payloadCapacity(version, level)) {
    throw new RangeError('bytes do not fit the requested QR version and level');
  }

  const row = EC_TABLE[version][level];
  const data = makeDataCodewords(bytes, version, level);
  const dataBlocks = [];
  let dataOffset = 0;
  for (const [blockCount, dataPerBlock] of row.groups) {
    for (let block = 0; block < blockCount; block += 1) {
      dataBlocks.push(data.slice(dataOffset, dataOffset + dataPerBlock));
      dataOffset += dataPerBlock;
    }
  }
  if (dataOffset !== data.length) throw new Error('QR data block split invariant failed');

  const ecBlocks = dataBlocks.map((block) => rsEncode(block, row.ecPerBlock));
  const codewords = new Uint8Array(totalCodewords(version));
  let outputOffset = 0;
  const longestDataBlock = Math.max(...dataBlocks.map((block) => block.length));
  for (let column = 0; column < longestDataBlock; column += 1) {
    for (const block of dataBlocks) {
      if (column < block.length) {
        codewords[outputOffset] = block[column];
        outputOffset += 1;
      }
    }
  }
  for (let column = 0; column < row.ecPerBlock; column += 1) {
    for (const block of ecBlocks) {
      codewords[outputOffset] = block[column];
      outputOffset += 1;
    }
  }
  if (outputOffset !== codewords.length) throw new Error('QR interleave invariant failed');
  return codewords;
}

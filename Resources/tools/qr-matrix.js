import {
  alignmentPositions,
  chooseVersion,
  encodeToCodewords,
  totalCodewords,
} from './qr.js';

const LEVEL_BITS = Object.freeze({ L: 0b01, M: 0b00, Q: 0b11, H: 0b10 });
const MIN_VERSION = 1;
const MAX_VERSION = 40;
const PENALTY_PATTERN_A = Uint8Array.of(1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0);
const PENALTY_PATTERN_B = Uint8Array.of(0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1);

const requireVersion = (version) => {
  if (!Number.isInteger(version) || version < MIN_VERSION || version > MAX_VERSION) {
    throw new RangeError('version must be an integer from 1 through 40');
  }
};

const requireLevel = (level) => {
  if (!Object.hasOwn(LEVEL_BITS, level)) throw new RangeError('level must be L, M, Q, or H');
};

const requireMask = (mask) => {
  if (!Number.isInteger(mask) || mask < 0 || mask > 7) {
    throw new RangeError('mask must be an integer from 0 through 7');
  }
};

const bchRemainder = (value, generator, degree) => {
  let remainder = value;
  for (let bit = 31 - Math.clz32(remainder); bit >= degree; bit -= 1) {
    if (((remainder >>> bit) & 1) !== 0) remainder ^= generator << (bit - degree);
  }
  return remainder;
};

export function formatBits(level, mask) {
  requireLevel(level);
  requireMask(mask);
  const data = (LEVEL_BITS[level] << 3) | mask;
  const remainder = bchRemainder(data << 10, 0x537, 10);
  return ((data << 10) | remainder) ^ 0x5412;
}

const versionBits = (version) => {
  const remainder = bchRemainder(version << 12, 0x1f25, 12);
  return (version << 12) | remainder;
};

const indexOf = (size, column, row) => row * size + column;

const createFunctionPatterns = (version) => {
  const size = 17 + 4 * version;
  const modules = new Uint8Array(size * size);
  const reserved = new Uint8Array(size * size);
  const setFunction = (column, row, value) => {
    if (column < 0 || row < 0 || column >= size || row >= size) return;
    const index = indexOf(size, column, row);
    modules[index] = value;
    reserved[index] = 1;
  };

  const drawFinder = (centerColumn, centerRow) => {
    for (let deltaRow = -4; deltaRow <= 4; deltaRow += 1) {
      for (let deltaColumn = -4; deltaColumn <= 4; deltaColumn += 1) {
        const radius = Math.max(Math.abs(deltaColumn), Math.abs(deltaRow));
        setFunction(
          centerColumn + deltaColumn,
          centerRow + deltaRow,
          radius !== 2 && radius !== 4 ? 1 : 0,
        );
      }
    }
  };

  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  for (let coordinate = 8; coordinate <= size - 9; coordinate += 1) {
    const value = coordinate % 2 === 0 ? 1 : 0;
    setFunction(coordinate, 6, value);
    setFunction(6, coordinate, value);
  }

  const alignmentCenters = alignmentPositions(version);
  const lastAlignmentIndex = alignmentCenters.length - 1;
  alignmentCenters.forEach((centerColumn, columnIndex) => {
    alignmentCenters.forEach((centerRow, rowIndex) => {
      const overlapsFinder = (
        (columnIndex === 0 && rowIndex === 0)
        || (columnIndex === 0 && rowIndex === lastAlignmentIndex)
        || (columnIndex === lastAlignmentIndex && rowIndex === 0)
      );
      if (overlapsFinder) return;
      for (let deltaRow = -2; deltaRow <= 2; deltaRow += 1) {
        for (let deltaColumn = -2; deltaColumn <= 2; deltaColumn += 1) {
          const radius = Math.max(Math.abs(deltaColumn), Math.abs(deltaRow));
          setFunction(
            centerColumn + deltaColumn,
            centerRow + deltaRow,
            radius === 1 ? 0 : 1,
          );
        }
      }
    });
  });

  const formatCoordinates = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
    ...Array.from({ length: 8 }, (_, bit) => [size - 1 - bit, 8]),
    ...Array.from({ length: 7 }, (_, bit) => [8, size - 7 + bit]),
  ];
  for (const [column, row] of formatCoordinates) setFunction(column, row, 0);
  setFunction(8, size - 8, 1);

  if (version >= 7) {
    for (let bit = 0; bit < 18; bit += 1) {
      const column = size - 11 + (bit % 3);
      const row = Math.floor(bit / 3);
      setFunction(column, row, 0);
      setFunction(row, column, 0);
    }
  }

  return { size, modules, reserved };
};

function* iterateDataCoordinates(size, reserved) {
  let upward = true;
  for (let rightColumn = size - 1; rightColumn >= 1; rightColumn -= 2) {
    if (rightColumn === 6) rightColumn = 5;
    for (let verticalOffset = 0; verticalOffset < size; verticalOffset += 1) {
      const row = upward ? size - 1 - verticalOffset : verticalOffset;
      for (let pairOffset = 0; pairOffset < 2; pairOffset += 1) {
        const column = rightColumn - pairOffset;
        if (reserved[indexOf(size, column, row)] === 0) yield [column, row];
      }
    }
    upward = !upward;
  }
}

export function* dataRegionIterator(size, version) {
  requireVersion(version);
  const expectedSize = 17 + 4 * version;
  if (!Number.isInteger(size) || size !== expectedSize) {
    throw new RangeError(`size must be ${expectedSize} for version ${version}`);
  }
  const { reserved } = createFunctionPatterns(version);
  yield* iterateDataCoordinates(size, reserved);
}

const maskMatches = (mask, row, column) => {
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
    default: throw new RangeError('mask must be an integer from 0 through 7');
  }
};

const writeFormatBits = (modules, size, level, mask) => {
  const bits = formatBits(level, mask);
  const setBit = (column, row, bit) => {
    modules[indexOf(size, column, row)] = (bits >>> bit) & 1;
  };

  for (let bit = 0; bit <= 5; bit += 1) setBit(8, bit, bit);
  setBit(8, 7, 6);
  setBit(8, 8, 7);
  setBit(7, 8, 8);
  for (let bit = 9; bit < 15; bit += 1) setBit(14 - bit, 8, bit);

  for (let bit = 0; bit < 8; bit += 1) setBit(size - 1 - bit, 8, bit);
  for (let bit = 8; bit < 15; bit += 1) setBit(8, size - 15 + bit, bit);
  modules[indexOf(size, 8, size - 8)] = 1;
};

const writeVersionBits = (modules, size, version) => {
  if (version < 7) return;
  const bits = versionBits(version);
  for (let bit = 0; bit < 18; bit += 1) {
    const column = size - 11 + (bit % 3);
    const row = Math.floor(bit / 3);
    const value = (bits >>> bit) & 1;
    modules[indexOf(size, column, row)] = value;
    modules[indexOf(size, row, column)] = value;
  }
};

const penaltyScore = (modules, size) => {
  const get = (column, row) => modules[indexOf(size, column, row)];
  let score = 0;

  const scoreLine = (read) => {
    let lineScore = 0;
    let runValue = read(0);
    let runLength = 1;
    for (let coordinate = 1; coordinate < size; coordinate += 1) {
      const value = read(coordinate);
      if (value === runValue) {
        runLength += 1;
      } else {
        if (runLength >= 5) lineScore += 3 + runLength - 5;
        runValue = value;
        runLength = 1;
      }
    }
    if (runLength >= 5) lineScore += 3 + runLength - 5;

    for (let start = 0; start <= size - 11; start += 1) {
      let firstPattern = true;
      let secondPattern = true;
      for (let offset = 0; offset < 11; offset += 1) {
        const value = read(start + offset);
        firstPattern &&= value === PENALTY_PATTERN_A[offset];
        secondPattern &&= value === PENALTY_PATTERN_B[offset];
      }
      if (firstPattern || secondPattern) lineScore += 40;
    }
    return lineScore;
  };

  for (let row = 0; row < size; row += 1) score += scoreLine((column) => get(column, row));
  for (let column = 0; column < size; column += 1) score += scoreLine((row) => get(column, row));

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

  let darkModules = 0;
  for (const module of modules) darkModules += module;
  score += Math.floor(
    Math.abs(darkModules * 20 - modules.length * 10) / modules.length,
  ) * 10;
  return score;
};

const requireBuildOptions = (options) => {
  if (options === undefined) return { mask: undefined };
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }
  if (options.mask !== undefined) requireMask(options.mask);
  return { mask: options.mask };
};

// `options.mask` is a deterministic Task 12 test seam; production callers omit it.
export function buildMatrix(codewords, version, level, options) {
  if (!(codewords instanceof Uint8Array)) {
    throw new TypeError('codewords must be a Uint8Array');
  }
  requireVersion(version);
  requireLevel(level);
  const expectedCodewords = totalCodewords(version);
  if (codewords.length !== expectedCodewords) {
    throw new RangeError(`version ${version} requires exactly ${expectedCodewords} codewords`);
  }
  const { mask: forcedMask } = requireBuildOptions(options);

  const { size, modules: baseModules, reserved } = createFunctionPatterns(version);
  const coordinates = [...iterateDataCoordinates(size, reserved)];
  const requiredBits = codewords.length * 8;
  if (coordinates.length < requiredBits) throw new Error('QR data region is too small');
  coordinates.forEach(([column, row], bitIndex) => {
    if (bitIndex >= requiredBits) return;
    baseModules[indexOf(size, column, row)] = (
      codewords[Math.floor(bitIndex / 8)] >>> (7 - (bitIndex % 8))
    ) & 1;
  });
  writeVersionBits(baseModules, size, version);

  const makeCandidate = (mask) => {
    const modules = baseModules.slice();
    for (const [column, row] of coordinates) {
      if (maskMatches(mask, row, column)) modules[indexOf(size, column, row)] ^= 1;
    }
    writeFormatBits(modules, size, level, mask);
    return { size, modules };
  };

  if (forcedMask !== undefined) return makeCandidate(forcedMask);

  let best = null;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = makeCandidate(mask);
    const penalty = penaltyScore(candidate.modules, size);
    if (penalty < bestPenalty) {
      best = candidate;
      bestPenalty = penalty;
    }
  }
  return best;
}

export function generateQr(text, options) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  if (options !== undefined && (
    options === null || typeof options !== 'object' || Array.isArray(options)
  )) throw new TypeError('options must be an object');
  const level = options?.level === undefined ? 'M' : options.level;
  requireLevel(level);
  if (text.length === 0) return { error: 'empty' };

  const bytes = new TextEncoder().encode(text);
  const version = chooseVersion(bytes.length, level);
  if (version === null) return { error: 'too-long' };
  const codewords = encodeToCodewords(bytes, version, level);
  const { size, modules } = buildMatrix(codewords, version, level);
  return { size, modules, version, level };
}

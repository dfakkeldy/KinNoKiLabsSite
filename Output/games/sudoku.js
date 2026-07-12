import { createRng, deriveSeed } from './core.js';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const peers = (index) => {
  const row = Math.floor(index / 9), column = index % 9;
  const values = new Set();
  for (let i = 0; i < 9; i += 1) {
    values.add(row * 9 + i);
    values.add(i * 9 + column);
  }
  const boxRow = Math.floor(row / 3) * 3, boxColumn = Math.floor(column / 3) * 3;
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) values.add((boxRow + r) * 9 + boxColumn + c);
  }
  values.delete(index);
  return [...values];
};

const PEERS = Array.from({ length: 81 }, (_, index) => peers(index));
const UNITS = [
  ...Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_, column) => row * 9 + column)),
  ...Array.from({ length: 9 }, (_, column) => Array.from({ length: 9 }, (_, row) => row * 9 + column)),
  ...Array.from({ length: 9 }, (_, box) => {
    const boxRow = Math.floor(box / 3) * 3;
    const boxColumn = (box % 3) * 3;
    return Array.from({ length: 9 }, (_, offset) => (
      (boxRow + Math.floor(offset / 3)) * 9 + boxColumn + (offset % 3)
    ));
  }),
];

const isPartialBoardValid = (board) => (
  Array.isArray(board)
  && board.length === 81
  && board.every((value, index) => (
    Number.isInteger(value)
    && value >= 0
    && value <= 9
    && (value === 0 || PEERS[index].every((peer) => board[peer] !== value))
  ))
);

export function isValidSudokuBoard(board) {
  return Array.isArray(board)
    && board.length === 81
    && board.every((value, index) => (
      Number.isInteger(value)
      && value >= 1
      && value <= 9
      && PEERS[index].every((peer) => board[peer] !== value)
    ));
}

const ALL_CANDIDATES = 0b1111111110;
const bitFor = (value) => 1 << value;
const bitCount = (mask) => {
  let value = mask, count = 0;
  while (value) { value &= value - 1; count += 1; }
  return count;
};
const valueForSingle = (mask) => DIGITS.find((value) => mask === bitFor(value));

const createCandidateState = (board) => ({
  board: [...board],
  masks: board.map((value, index) => {
    if (value) return bitFor(value);
    const used = PEERS[index].reduce((mask, peer) => mask | bitFor(board[peer]), 0);
    return ALL_CANDIDATES & ~used;
  }),
});

const cloneState = (state) => ({ board: [...state.board], masks: [...state.masks] });

const assign = (state, index, value) => {
  const bit = bitFor(value);
  if ((state.masks[index] & bit) === 0) return false;
  state.board[index] = value;
  state.masks[index] = bit;
  for (const peer of PEERS[index]) {
    if (state.board[peer] === value) return false;
    if (state.board[peer] !== 0 || (state.masks[peer] & bit) === 0) continue;
    state.masks[peer] &= ~bit;
    if (state.masks[peer] === 0) return false;
  }
  return true;
};

const removeMask = (state, index, mask) => {
  if (state.board[index] !== 0 || (state.masks[index] & mask) === 0) return 0;
  state.masks[index] &= ~mask;
  return state.masks[index] === 0 ? -1 : 1;
};

const applySingles = (state, techniques, recordTechniques) => {
  for (let index = 0; index < 81; index += 1) {
    if (state.board[index] !== 0) continue;
    if (state.masks[index] === 0) return -1;
    if (bitCount(state.masks[index]) === 1) {
      if (!assign(state, index, valueForSingle(state.masks[index]))) return -1;
      if (recordTechniques) techniques.add('naked-single');
      return 1;
    }
  }

  for (const unit of UNITS) {
    for (const value of DIGITS) {
      if (unit.some((index) => state.board[index] === value)) continue;
      const bit = bitFor(value);
      const positions = unit.filter((index) => (
        state.board[index] === 0 && (state.masks[index] & bit) !== 0
      ));
      if (positions.length === 0) return -1;
      if (positions.length === 1) {
        if (!assign(state, positions[0], value)) return -1;
        if (recordTechniques) techniques.add('hidden-single');
        return 1;
      }
    }
  }
  return 0;
};

const applyNakedPairs = (state) => {
  let changed = 0;
  for (const unit of UNITS) {
    const pairs = new Map();
    for (const index of unit) {
      if (state.board[index] !== 0 || bitCount(state.masks[index]) !== 2) continue;
      const matching = pairs.get(state.masks[index]) ?? [];
      matching.push(index);
      pairs.set(state.masks[index], matching);
    }
    for (const [mask, pair] of pairs) {
      if (pair.length !== 2) continue;
      for (const index of unit) {
        if (pair.includes(index)) continue;
        const result = removeMask(state, index, mask);
        if (result < 0) return -1;
        changed += result;
      }
    }
  }
  return changed;
};

const applyLockedCandidates = (state) => {
  let changed = 0;
  const boxes = UNITS.slice(18);
  for (const box of boxes) {
    for (const value of DIGITS) {
      const bit = bitFor(value);
      const positions = box.filter((index) => state.board[index] === 0 && (state.masks[index] & bit));
      if (positions.length < 2) continue;
      const rows = new Set(positions.map((index) => Math.floor(index / 9)));
      const columns = new Set(positions.map((index) => index % 9));
      const targets = [];
      if (rows.size === 1) targets.push(...UNITS[[...rows][0]].filter((index) => !box.includes(index)));
      if (columns.size === 1) targets.push(...UNITS[9 + [...columns][0]].filter((index) => !box.includes(index)));
      for (const index of targets) {
        const result = removeMask(state, index, bit);
        if (result < 0) return -1;
        changed += result;
      }
    }
  }
  return changed;
};

const applyNakedTriples = (state) => {
  let changed = 0;
  for (const unit of UNITS) {
    const cells = unit.filter((index) => {
      const count = bitCount(state.masks[index]);
      return state.board[index] === 0 && count >= 2 && count <= 3;
    });
    for (let a = 0; a < cells.length - 2; a += 1) {
      for (let b = a + 1; b < cells.length - 1; b += 1) {
        for (let c = b + 1; c < cells.length; c += 1) {
          const triple = [cells[a], cells[b], cells[c]];
          const mask = triple.reduce((union, index) => union | state.masks[index], 0);
          if (bitCount(mask) !== 3) continue;
          for (const index of unit) {
            if (triple.includes(index)) continue;
            const result = removeMask(state, index, mask);
            if (result < 0) return -1;
            changed += result;
          }
          if (changed) return changed;
        }
      }
    }
  }
  return changed;
};

const applyXWings = (state) => {
  let changed = 0;
  for (const value of DIGITS) {
    const bit = bitFor(value);
    for (const transpose of [false, true]) {
      const pairs = [];
      for (let primary = 0; primary < 9; primary += 1) {
        const secondary = [];
        for (let offset = 0; offset < 9; offset += 1) {
          const index = transpose ? offset * 9 + primary : primary * 9 + offset;
          if (state.board[index] === 0 && (state.masks[index] & bit)) secondary.push(offset);
        }
        if (secondary.length === 2) pairs.push({ primary, secondary });
      }
      for (let a = 0; a < pairs.length - 1; a += 1) {
        for (let b = a + 1; b < pairs.length; b += 1) {
          if (pairs[a].secondary[0] !== pairs[b].secondary[0]
            || pairs[a].secondary[1] !== pairs[b].secondary[1]) continue;
          for (let primary = 0; primary < 9; primary += 1) {
            if (primary === pairs[a].primary || primary === pairs[b].primary) continue;
            for (const secondary of pairs[a].secondary) {
              const index = transpose ? secondary * 9 + primary : primary * 9 + secondary;
              const result = removeMask(state, index, bit);
              if (result < 0) return -1;
              changed += result;
            }
          }
        }
      }
    }
  }
  return changed;
};

const applyLogic = (state, techniques, recordTechniques) => {
  while (true) {
    const singles = applySingles(state, techniques, recordTechniques);
    if (singles < 0) return false;
    if (singles > 0) continue;

    const intermediate = applyNakedPairs(state) || applyLockedCandidates(state);
    if (intermediate < 0) return false;
    if (intermediate > 0) {
      if (recordTechniques) techniques.add('candidate-elimination');
      continue;
    }

    const advanced = applyNakedTriples(state) || applyXWings(state);
    if (advanced < 0) return false;
    if (advanced > 0) {
      if (recordTechniques) techniques.add('advanced-elimination');
      continue;
    }
    return true;
  }
};

export function solveSudoku(puzzle, limit = 2) {
  const solutions = [];
  const techniques = new Set();
  const boundedLimit = Number.isInteger(limit) && limit > 0 ? limit : 2;

  if (!isPartialBoardValid(puzzle)) return { solutions, techniques: [] };

  const search = (startingState, depth = 0) => {
    if (solutions.length >= boundedLimit) return;
    const state = cloneState(startingState);
    if (!applyLogic(state, techniques, depth === 0)) return;

    let bestIndex = -1;
    let bestOptions = null;
    for (let index = 0; index < 81; index += 1) {
      if (state.board[index] !== 0) continue;
      const options = DIGITS.filter((value) => state.masks[index] & bitFor(value));
      if (options.length === 0) return;
      if (bestOptions === null || options.length < bestOptions.length) {
        bestIndex = index;
        bestOptions = options;
      }
    }

    if (bestIndex === -1) {
      solutions.push(state.board);
      return;
    }

    techniques.add('guess');
    for (const value of bestOptions) {
      const next = cloneState(state);
      if (assign(next, bestIndex, value)) search(next, depth + 1);
      if (solutions.length >= boundedLimit) return;
    }
  };

  search(createCandidateState(puzzle));
  return { solutions, techniques: [...techniques] };
}

const shuffledGroups = (rng) => rng.shuffle([0, 1, 2]).flatMap((group) => (
  rng.shuffle([0, 1, 2]).map((offset) => group * 3 + offset)
));

const solvedGrid = (rng) => {
  const digits = rng.shuffle(DIGITS);
  const rows = shuffledGroups(rng);
  const columns = shuffledGroups(rng);
  return rows.flatMap((row) => columns.map((column) => (
    digits[(row * 3 + Math.floor(row / 3) + column) % 9]
  )));
};

const clueCount = (board) => board.reduce((count, value) => count + (value === 0 ? 0 : 1), 0);

const difficultyRanges = {
  easy: { minimum: 40, maximum: 46, target: 44 },
  medium: { minimum: 32, maximum: 39, target: 36 },
  hard: { minimum: 26, maximum: 31, target: 28 },
};

const classifiedAs = (puzzle, difficulty) => {
  const clues = clueCount(puzzle);
  const range = difficultyRanges[difficulty];
  if (clues < range.minimum || clues > range.maximum) return false;

  const { solutions, techniques } = solveSudoku(puzzle, 1);
  if (solutions.length !== 1) return false;
  const hasCandidateElimination = techniques.includes('candidate-elimination');
  const hasAdvancedElimination = techniques.includes('advanced-elimination');
  if (techniques.includes('guess')) return false;
  if (difficulty === 'easy') return !hasCandidateElimination && !hasAdvancedElimination;
  if (difficulty === 'medium') return hasCandidateElimination && !hasAdvancedElimination;
  return hasAdvancedElimination;
};

const removeSymmetricClues = (solution, rng, target) => {
  const puzzle = [...solution];
  const pairs = rng.shuffle(Array.from({ length: 41 }, (_, index) => [index, 80 - index]));

  for (const pair of pairs) {
    const indices = [...new Set(pair)];
    if (clueCount(puzzle) - indices.length < target) continue;
    const removed = indices.map((index) => puzzle[index]);
    indices.forEach((index) => { puzzle[index] = 0; });
    if (solveSudoku(puzzle, 2).solutions.length !== 1) {
      indices.forEach((index, offset) => { puzzle[index] = removed[offset]; });
    }
    if (clueCount(puzzle) === target) break;
  }

  return puzzle;
};

export function generateSudoku({ difficulty, seed }) {
  const range = difficultyRanges[difficulty];
  if (!range) throw new RangeError(`Unsupported Sudoku difficulty: ${difficulty}`);

  const initialSeed = seed >>> 0;
  let generationSeed = initialSeed;
  for (let generation = 0; generation < 256; generation += 1) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const attemptSeed = deriveSeed(generationSeed, attempt);
      const rng = createRng(attemptSeed);
      const solution = solvedGrid(rng);
      const puzzle = removeSymmetricClues(solution, rng, range.target);
      if (classifiedAs(puzzle, difficulty)) {
        return { seed: initialSeed, difficulty, puzzle, solution, rating: difficulty };
      }
    }
    generationSeed = deriveSeed(generationSeed, 12);
  }

  throw new Error(`Unable to generate ${difficulty} Sudoku from seed ${initialSeed}`);
}

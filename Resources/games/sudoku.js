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

const candidates = (board, index) => {
  const used = new Set(PEERS[index].map((peer) => board[peer]).filter(Boolean));
  return DIGITS.filter((value) => !used.has(value));
};

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

const propagateSingles = (board, techniques) => {
  let changed = true;
  while (changed) {
    changed = false;

    for (let index = 0; index < 81; index += 1) {
      if (board[index] !== 0) continue;
      const options = candidates(board, index);
      if (options.length === 0) return false;
      if (options.length === 1) {
        board[index] = options[0];
        techniques.add('naked-single');
        changed = true;
      }
    }

    if (changed) continue;

    for (const unit of UNITS) {
      for (const value of DIGITS) {
        if (unit.some((index) => board[index] === value)) continue;
        const positions = unit.filter((index) => (
          board[index] === 0 && candidates(board, index).includes(value)
        ));
        if (positions.length === 0) return false;
        if (positions.length === 1) {
          board[positions[0]] = value;
          techniques.add('hidden-single');
          changed = true;
        }
      }
    }
  }
  return true;
};

export function solveSudoku(puzzle, limit = 2) {
  const solutions = [];
  const techniques = new Set();
  const boundedLimit = Number.isInteger(limit) && limit > 0 ? limit : 2;

  if (!isPartialBoardValid(puzzle)) return { solutions, techniques: [] };

  const search = (startingBoard, depth = 0) => {
    if (solutions.length >= boundedLimit) return;
    const board = [...startingBoard];
    if (!propagateSingles(board, techniques)) return;

    let bestIndex = -1;
    let bestOptions = null;
    for (let index = 0; index < 81; index += 1) {
      if (board[index] !== 0) continue;
      const options = candidates(board, index);
      if (options.length === 0) return;
      if (bestOptions === null || options.length < bestOptions.length) {
        bestIndex = index;
        bestOptions = options;
      }
    }

    if (bestIndex === -1) {
      solutions.push(board);
      return;
    }

    techniques.add('candidate-elimination');
    if (depth > 0 || bestOptions.length > 2) techniques.add('advanced-elimination');
    for (const value of bestOptions) {
      const next = [...board];
      next[bestIndex] = value;
      search(next, depth + 1);
      if (solutions.length >= boundedLimit) return;
    }
  };

  search([...puzzle]);
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

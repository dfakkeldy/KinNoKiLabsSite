import bundledEntries from './crossword-content.js';
import { createRng, deriveSeed } from './core.js';

const LIMITS = {
  easy: { size: 9, target: 7, attempts: 300 },
  medium: { size: 11, target: 10, attempts: 700 },
  hard: { size: 13, target: 13, attempts: 1200 },
};

const directions = {
  across: [0, 1],
  down: [1, 0],
};

const emptyGrid = (size) => Array.from({ length: size }, () => Array(size).fill(null));

const cloneGrid = (grid) => grid.map((row) => row.map((cell) => (
  cell ? { ...cell } : null
)));

function crossingCandidates(grid, answer) {
  const placements = [];
  const seen = new Set();
  for (let letter = 0; letter < answer.length; letter += 1) {
    for (let row = 0; row < grid.length; row += 1) {
      for (let column = 0; column < grid.length; column += 1) {
        if (grid[row][column]?.solution !== answer[letter]) continue;
        for (const candidate of [
          { row, column: column - letter, direction: 'across' },
          { row: row - letter, column, direction: 'down' },
        ]) {
          const key = `${candidate.row}:${candidate.column}:${candidate.direction}`;
          if (!seen.has(key)) {
            seen.add(key);
            placements.push(candidate);
          }
        }
      }
    }
  }
  return placements;
}

function placementScore(grid, answer, placement) {
  const [dr, dc] = directions[placement.direction];
  let crossings = 0;
  for (let index = 0; index < answer.length; index += 1) {
    if (grid[placement.row + dr * index][placement.column + dc * index]) crossings += 1;
  }
  return crossings * 100 + answer.length;
}

function canPlace(grid, answer, { row, column, direction }, requireCrossing = true) {
  const size = grid.length;
  const [dr, dc] = directions[direction];
  const endRow = row + dr * (answer.length - 1);
  const endColumn = column + dc * (answer.length - 1);
  if (row < 0 || column < 0 || endRow >= size || endColumn >= size) return false;

  const beforeRow = row - dr;
  const beforeColumn = column - dc;
  const afterRow = endRow + dr;
  const afterColumn = endColumn + dc;
  if (beforeRow >= 0 && beforeColumn >= 0 && beforeRow < size && beforeColumn < size
      && grid[beforeRow][beforeColumn]) return false;
  if (afterRow >= 0 && afterColumn >= 0 && afterRow < size && afterColumn < size
      && grid[afterRow][afterColumn]) return false;

  let crossings = 0;
  for (let index = 0; index < answer.length; index += 1) {
    const cellRow = row + dr * index;
    const cellColumn = column + dc * index;
    const cell = grid[cellRow][cellColumn];
    if (cell) {
      if (cell.solution !== answer[index] || cell[direction]) return false;
      crossings += 1;
      continue;
    }

    const sideA = direction === 'across'
      ? [cellRow - 1, cellColumn] : [cellRow, cellColumn - 1];
    const sideB = direction === 'across'
      ? [cellRow + 1, cellColumn] : [cellRow, cellColumn + 1];
    for (const [sideRow, sideColumn] of [sideA, sideB]) {
      if (sideRow >= 0 && sideColumn >= 0 && sideRow < size && sideColumn < size
          && grid[sideRow][sideColumn]) return false;
    }
  }
  return !requireCrossing || crossings > 0;
}

function placeAnswer(grid, entry, placement) {
  const next = cloneGrid(grid);
  const [dr, dc] = directions[placement.direction];
  for (let index = 0; index < entry.answer.length; index += 1) {
    const row = placement.row + dr * index;
    const column = placement.column + dc * index;
    next[row][column] = {
      ...(next[row][column] ?? { solution: entry.answer[index] }),
      [placement.direction]: true,
    };
  }
  return next;
}

function numberedPuzzle({ difficulty, seed, grid, placed, usedFallback }) {
  const starts = new Map();
  for (const placement of placed) starts.set(`${placement.row}:${placement.column}`, null);

  let number = 1;
  for (let row = 0; row < grid.length; row += 1) {
    for (let column = 0; column < grid.length; column += 1) {
      const key = `${row}:${column}`;
      if (starts.has(key)) {
        starts.set(key, number);
        number += 1;
      }
    }
  }

  const answers = placed.map(({ entry, row, column, direction }) => ({
    number: starts.get(`${row}:${column}`),
    direction,
    answer: entry.answer,
    clue: entry.clue,
    row,
    column,
  })).sort((left, right) => (
    left.number - right.number || (left.direction === 'across' ? -1 : 1)
  ));

  const answerAt = new Map(answers.map((answer) => (
    [`${answer.row}:${answer.column}:${answer.direction}`, answer.number]
  )));
  const cells = grid.map((gridRow, row) => gridRow.map((cell, column) => {
    if (!cell) return null;
    let across = null;
    let down = null;
    for (const answer of answers) {
      const [dr, dc] = directions[answer.direction];
      for (let index = 0; index < answer.answer.length; index += 1) {
        if (answer.row + dr * index === row && answer.column + dc * index === column) {
          if (answer.direction === 'across') across = answer.number;
          else down = answer.number;
        }
      }
    }
    return {
      solution: cell.solution,
      number: answerAt.get(`${row}:${column}:across`)
        ?? answerAt.get(`${row}:${column}:down`)
        ?? null,
      across,
      down,
    };
  }));

  return { seed: seed >>> 0, difficulty, size: grid.length, cells, answers, usedFallback };
}

function attemptPuzzle({ difficulty, seed, entries, limits }) {
  const rng = createRng(seed);
  const candidates = rng.shuffle(entries.filter((entry) => (
    entry.level === difficulty
      && /^[A-Z]{3,12}$/.test(entry.answer)
      && entry.answer.length <= limits.size
  )));
  const state = { attempts: 0 };

  const search = (grid, placed, remaining) => {
    if (placed.length >= limits.target) return { grid, placed };

    const options = [];
    for (const entry of rng.shuffle(remaining)) {
      for (const placement of rng.shuffle(crossingCandidates(grid, entry.answer))) {
        if (canPlace(grid, entry.answer, placement)) {
          options.push({
            entry,
            placement,
            score: placementScore(grid, entry.answer, placement),
          });
        }
      }
    }
    options.sort((left, right) => right.score - left.score);

    for (const option of options.slice(0, 2)) {
      if (state.attempts >= limits.attempts) return null;
      state.attempts += 1;
      const nextGrid = placeAnswer(grid, option.entry, option.placement);
      const result = search(
        nextGrid,
        [...placed, { entry: option.entry, ...option.placement }],
        remaining.filter((entry) => entry.answer !== option.entry.answer),
      );
      if (result) return result;
    }
    return null;
  };

  for (const entry of candidates) {
    if (state.attempts >= limits.attempts) break;
    state.attempts += 1;
    const column = Math.floor((limits.size - entry.answer.length) / 2);
    const placement = { row: Math.floor(limits.size / 2), column, direction: 'across' };
    const grid = emptyGrid(limits.size);
    if (!canPlace(grid, entry.answer, placement, false)) continue;
    const result = search(
      placeAnswer(grid, entry, placement),
      [{ entry, ...placement }],
      candidates.filter((candidate) => candidate.answer !== entry.answer),
    );
    if (result) return numberedPuzzle({
      difficulty,
      seed,
      grid: result.grid,
      placed: result.placed,
      usedFallback: false,
    });
  }
  return null;
}

const FALLBACK_LAYOUTS = {
  easy: [
    ['FIDDLE', 1, 1, 'across'], ['LOBSTER', 1, 5, 'down'],
    ['BELL', 3, 5, 'across'], ['MARS', 4, 2, 'across'],
    ['MAPLE', 4, 2, 'down'], ['JUPITER', 6, 0, 'across'],
    ['OCEAN', 8, 0, 'across'],
  ],
  medium: [
    ['HELIUM', 0, 4, 'across'], ['MARGAREE', 0, 9, 'down'],
    ['INVERNESS', 2, 4, 'down'], ['CHETICAMP', 2, 6, 'down'],
    ['ARICHAT', 4, 1, 'down'], ['DELTA', 5, 3, 'across'],
    ['CAPER', 7, 6, 'across'], ['RCMP', 7, 10, 'down'],
    ['WHALE', 8, 0, 'across'], ['ATLAS', 10, 0, 'across'],
  ],
  hard: [[
    ['ALBERTA', 0, 1, 'across'], ['BASKETBALL', 0, 3, 'down'],
    ['WINNIPEG', 0, 10, 'down'], ['GRAVITY', 1, 8, 'down'],
    ['STLAWRENCE', 2, 3, 'across'], ['OTTER', 4, 0, 'across'],
    ['ORCHESTRA', 4, 0, 'down'], ['DOLPHIN', 4, 6, 'down'],
    ['TRIANGLE', 4, 12, 'down'], ['BALLET', 6, 3, 'across'],
    ['LOUISBOURG', 9, 3, 'across'], ['SQUARE', 11, 7, 'across'],
    ['ACADIAN', 12, 0, 'across'],
  ], [
    ['ATLANTIC', 0, 5, 'down'], ['LOUISBOURG', 0, 7, 'down'],
    ['WINNIPEG', 0, 11, 'down'], ['SASKATOON', 1, 0, 'across'],
    ['SQUARE', 1, 0, 'down'], ['STLAWRENCE', 3, 3, 'down'],
    ['ISLAND', 3, 7, 'across'], ['STANNS', 4, 2, 'across'],
    ['CAUSEWAY', 5, 9, 'down'], ['MANITOBA', 6, 2, 'across'],
    ['CANSO', 7, 1, 'down'], ['MAGNET', 9, 5, 'across'],
    ['ORCHESTRA', 11, 1, 'across'],
  ], [
    ['STLAWRENCE', 0, 5, 'down'], ['CIRCLE', 0, 11, 'down'],
    ['CRYSTAL', 1, 1, 'across'], ['LOUISBOURG', 1, 7, 'down'],
    ['OTTER', 2, 7, 'across'], ['BALLET', 4, 9, 'down'],
    ['MANITOBA', 5, 2, 'down'], ['BASKETBALL', 6, 1, 'across'],
    ['MIKMAQ', 7, 0, 'down'], ['MAGNET', 7, 11, 'down'],
    ['CAUSEWAY', 8, 5, 'across'], ['MOOSE', 10, 0, 'across'],
    ['ATLANTIC', 12, 2, 'across'],
  ], [
    ['NORTH', 0, 2, 'down'], ['BALLET', 0, 10, 'down'],
    ['CAUSEWAY', 1, 4, 'across'], ['CIRCLE', 1, 4, 'down'],
    ['PORTHOOD', 2, 0, 'down'], ['OTTER', 3, 0, 'across'],
    ['LOUISBOURG', 3, 8, 'down'], ['MOOSE', 4, 6, 'across'],
    ['MAGNET', 4, 6, 'down'], ['PENGUIN', 6, 3, 'across'],
    ['DOLPHIN', 6, 11, 'down'], ['BASKETBALL', 8, 2, 'across'],
    ['ORCHESTRA', 11, 1, 'across'],
  ]],
};

const fallbackCache = new Map();

function clonePuzzle(puzzle) {
  return {
    ...puzzle,
    cells: puzzle.cells.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
    answers: puzzle.answers.map((answer) => ({ ...answer })),
  };
}

function freezePuzzle(puzzle) {
  for (const row of puzzle.cells) {
    for (const cell of row) if (cell) Object.freeze(cell);
    Object.freeze(row);
  }
  for (const answer of puzzle.answers) Object.freeze(answer);
  Object.freeze(puzzle.cells);
  Object.freeze(puzzle.answers);
  return Object.freeze(puzzle);
}

function bundledFallback(difficulty, seed) {
  const layouts = difficulty === 'hard' ? FALLBACK_LAYOUTS.hard : [FALLBACK_LAYOUTS[difficulty]];
  const variant = (seed >>> 0) % layouts.length;
  const cacheKey = `${difficulty}:${variant}`;
  if (!fallbackCache.has(cacheKey)) {
    const byAnswer = new Map(bundledEntries.map((entry) => [entry.answer, entry]));
    const placed = layouts[variant].map(([answer, row, column, direction]) => ({
      entry: byAnswer.get(answer), row, column, direction,
    }));
    let grid = emptyGrid(LIMITS[difficulty].size);
    for (const placement of placed) grid = placeAnswer(grid, placement.entry, placement);
    const puzzle = numberedPuzzle({
      difficulty, seed: 0, grid, placed, usedFallback: true,
    });
    const validation = validateCrossword(puzzle);
    if (!validation.valid) throw new Error(`Bundled ${difficulty} crossword is invalid`);
    fallbackCache.set(cacheKey, freezePuzzle(puzzle));
  }
  return { ...clonePuzzle(fallbackCache.get(cacheKey)), seed: seed >>> 0 };
}

export function generateCrossword({
  difficulty, seed, entries = bundledEntries,
}) {
  const limits = LIMITS[difficulty];
  if (!limits) throw new RangeError(`Unsupported crossword difficulty: ${difficulty}`);

  for (let attempt = 0; attempt < 1; attempt += 1) {
    const candidateSeed = attempt === 0 ? seed >>> 0 : deriveSeed(seed, attempt - 1);
    const boundedLimits = { ...limits, attempts: Math.min(limits.attempts, 240) };
    const puzzle = attemptPuzzle({ difficulty, seed: candidateSeed, entries, limits: boundedLimits });
    if (puzzle && validateCrossword(puzzle).valid) return puzzle;
  }
  return bundledFallback(difficulty, seed);
}

export function validateCrossword(puzzle) {
  const errors = [];
  const size = puzzle?.size;
  if (!Number.isInteger(size) || size < 1
      || !Array.isArray(puzzle?.cells) || puzzle.cells.length !== size
      || puzzle.cells.some((row) => !Array.isArray(row) || row.length !== size)) {
    return { valid: false, errors: ['Grid must be a square matching its declared size'] };
  }
  if (!Array.isArray(puzzle.answers) || puzzle.answers.length < 2) {
    return { valid: false, errors: ['Puzzle must contain at least two answers'] };
  }

  const reconstructed = emptyGrid(size);
  const answerKeys = new Set();
  const numbersByStart = new Map();
  const crossings = Array.from({ length: puzzle.answers.length }, () => new Set());
  const geometrySafe = new Set();

  puzzle.answers.forEach((answer, answerIndex) => {
    if (!answer || typeof answer !== 'object'
        || !Number.isInteger(answer.number) || answer.number < 1
        || !directions[answer.direction]
        || !/^[A-Z]{3,12}$/.test(answer.answer ?? '')
        || typeof answer.clue !== 'string' || answer.clue.length < 1
        || !Number.isInteger(answer.row) || !Number.isInteger(answer.column)) {
      errors.push(`Answer ${answerIndex + 1} has invalid metadata`);
      return;
    }
    if (answerKeys.has(answer.answer)) errors.push(`Duplicate answer ${answer.answer}`);
    answerKeys.add(answer.answer);

    const [dr, dc] = directions[answer.direction];
    const endRow = answer.row + dr * (answer.answer.length - 1);
    const endColumn = answer.column + dc * (answer.answer.length - 1);
    if (answer.row < 0 || answer.column < 0 || endRow >= size || endColumn >= size) {
      errors.push(`Answer ${answer.answer} is out of bounds`);
      return;
    }
    geometrySafe.add(answerIndex);

    const startKey = `${answer.row}:${answer.column}`;
    if (numbersByStart.has(startKey) && numbersByStart.get(startKey) !== answer.number) {
      errors.push(`Answers at ${startKey} do not share a number`);
    }
    numbersByStart.set(startKey, answer.number);

    for (let index = 0; index < answer.answer.length; index += 1) {
      const row = answer.row + dr * index;
      const column = answer.column + dc * index;
      const existing = reconstructed[row][column];
      if (existing && existing.solution !== answer.answer[index]) {
        errors.push(`Answer ${answer.answer} conflicts at ${row}:${column}`);
      }
      if (existing?.[answer.direction] !== undefined) {
        errors.push(`Answers overlap in the same direction at ${row}:${column}`);
      }
      if (existing) {
        for (const otherIndex of existing.answerIndexes) {
          crossings[answerIndex].add(otherIndex);
          crossings[otherIndex].add(answerIndex);
        }
      }
      reconstructed[row][column] = {
        ...(existing ?? { solution: answer.answer[index], answerIndexes: [] }),
        [answer.direction]: answer.number,
        answerIndexes: [...(existing?.answerIndexes ?? []), answerIndex],
      };
    }
  });

  const orderedStarts = [...numbersByStart.keys()].sort((left, right) => {
    const [leftRow, leftColumn] = left.split(':').map(Number);
    const [rightRow, rightColumn] = right.split(':').map(Number);
    return leftRow - rightRow || leftColumn - rightColumn;
  });
  orderedStarts.forEach((key, index) => {
    if (numbersByStart.get(key) !== index + 1) errors.push(`Invalid clue number at ${key}`);
  });

  puzzle.answers.forEach((answer, answerIndex) => {
    if (!geometrySafe.has(answerIndex)) return;
    const [dr, dc] = directions[answer.direction];
    const endRow = answer.row + dr * (answer.answer.length - 1);
    const endColumn = answer.column + dc * (answer.answer.length - 1);
    for (const [row, column] of [
      [answer.row - dr, answer.column - dc],
      [endRow + dr, endColumn + dc],
    ]) {
      if (row >= 0 && column >= 0 && row < size && column < size && reconstructed[row][column]) {
        errors.push(`Answer ${answer.answer} touches another answer at an end`);
      }
    }
    for (let index = 0; index < answer.answer.length; index += 1) {
      const row = answer.row + dr * index;
      const column = answer.column + dc * index;
      const cell = reconstructed[row][column];
      if (cell?.answerIndexes.length > 1) continue;
      const sides = answer.direction === 'across'
        ? [[row - 1, column], [row + 1, column]]
        : [[row, column - 1], [row, column + 1]];
      for (const [sideRow, sideColumn] of sides) {
        if (sideRow >= 0 && sideColumn >= 0 && sideRow < size && sideColumn < size
            && reconstructed[sideRow][sideColumn]) {
          errors.push(`Answer ${answer.answer} touches another answer at its side`);
        }
      }
    }
  });

  const visited = new Set([0]);
  const pending = [0];
  while (pending.length) {
    const current = pending.pop();
    for (const neighbour of crossings[current]) {
      if (!visited.has(neighbour)) {
        visited.add(neighbour);
        pending.push(neighbour);
      }
    }
  }
  if (crossings.some((neighbours) => neighbours.size === 0)) {
    errors.push('Every answer must cross another answer');
  }
  if (visited.size !== puzzle.answers.length) errors.push('Answers must form one connected group');

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const expected = reconstructed[row][column];
      const actual = puzzle.cells[row][column];
      if (!expected && actual !== null) {
        errors.push(`Unkeyed cell at ${row}:${column}`);
        continue;
      }
      if (expected && (!actual
          || actual.solution !== expected.solution
          || (actual.across ?? null) !== (expected.across ?? null)
          || (actual.down ?? null) !== (expected.down ?? null)
          || (actual.number ?? null) !== (numbersByStart.get(`${row}:${column}`) ?? null))) {
        errors.push(`Cell does not match answers at ${row}:${column}`);
      }
    }
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

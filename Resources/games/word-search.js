import bundledThemes from './word-search-content.js';
import { createRng, deriveSeed } from './core.js';

const DIRECTIONS = {
  easy: [[0, 1], [1, 0]],
  medium: [[0, 1], [1, 0], [1, 1], [1, -1]],
  hard: [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]],
};

const RULES = {
  easy: { size: 10, words: 8 },
  medium: { size: 13, words: 12 },
  hard: { size: 16, words: 16 },
};

const FILLER = 'EEEEEEEEEEEETTTTTTTTTAAAAAAAOOOOOOOIIIIIIINNNNNNNSSSSSSRRRRRRHHHHHLLLLDDDDCCCUUUMMMFFFGGPPWWYYBVKJXQZ';
const MAX_BOARD_ATTEMPTS = 64;

function cellsFor(word, row, column, [dr, dc]) {
  return [...word].map((letter, index) => ({
    letter,
    row: row + dr * index,
    column: column + dc * index,
  }));
}

const inBounds = (size, { row, column }) => (
  row >= 0 && column >= 0 && row < size && column < size
);

const normalizedWords = (theme, size) => [...new Set((theme.words ?? [])
  .filter((word) => typeof word === 'string')
  .map((word) => word.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase())
  .filter((word) => word.length >= 3 && word.length <= size))];

function candidatesFor(grid, word, directions) {
  const candidates = [];
  for (const direction of directions) {
    for (let row = 0; row < grid.length; row += 1) {
      for (let column = 0; column < grid.length; column += 1) {
        const cells = cellsFor(word, row, column, direction);
        if (!cells.every((cell) => inBounds(grid.length, cell))) continue;

        let overlaps = 0;
        let valid = true;
        for (const cell of cells) {
          const existing = grid[cell.row][cell.column];
          if (existing !== null && existing !== cell.letter) {
            valid = false;
            break;
          }
          if (existing === cell.letter) overlaps += 1;
        }
        if (valid) candidates.push({ row, column, direction, cells, overlaps });
      }
    }
  }
  return candidates;
}

function occurrenceCount(grid, word, directions) {
  let count = 0;
  for (let row = 0; row < grid.length; row += 1) {
    for (let column = 0; column < grid.length; column += 1) {
      for (const direction of directions) {
        const rendered = cellsFor(word, row, column, direction)
          .map(({ row: cellRow, column: cellColumn }) => grid[cellRow]?.[cellColumn])
          .join('');
        if (rendered === word) count += 1;
      }
    }
  }
  return count;
}

function attemptBoard(words, size, directions, seed) {
  const rng = createRng(seed);
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  const placements = [];

  const orderedWords = rng.shuffle(words).sort((left, right) => right.length - left.length);
  for (const word of orderedWords) {
    const candidates = candidatesFor(grid, word, directions);
    if (candidates.length === 0) return null;
    const bestScore = Math.max(...candidates.map((candidate) => candidate.overlaps));
    const placement = rng.shuffle(
      candidates.filter((candidate) => candidate.overlaps === bestScore),
    )[0];

    for (const cell of placement.cells) grid[cell.row][cell.column] = cell.letter;
    const last = placement.cells.at(-1);
    placements.push({
      word,
      start: { row: placement.row, column: placement.column },
      end: { row: last.row, column: last.column },
    });
  }

  let filled = grid;
  for (let fillerAttempt = 0; fillerAttempt < 8; fillerAttempt += 1) {
    filled = grid.map((row) => row.map((letter) => (
      letter ?? FILLER[rng.int(FILLER.length)]
    )));
    if (words.every((word) => occurrenceCount(filled, word, directions) === 1)) {
      return { grid: filled, placements };
    }
  }
  return { grid: filled, placements };
}

export function generateWordSearch({ difficulty, seed, themes = bundledThemes }) {
  const rules = RULES[difficulty];
  if (!rules) throw new RangeError(`Unknown Word Search difficulty: ${difficulty}`);
  if (!Array.isArray(themes)) throw new TypeError('Word Search themes must be an array');

  const eligibleThemes = themes.map((theme) => ({
    theme,
    words: normalizedWords(theme ?? {}, rules.size),
  })).filter(({ theme, words }) => (
    typeof theme?.name === 'string' && theme.name.length > 0 && words.length >= rules.words
  ));
  if (eligibleThemes.length === 0) {
    throw new RangeError(`No eligible theme has ${rules.words} words for ${difficulty}`);
  }

  const selectionRng = createRng(seed);
  const selectedTheme = eligibleThemes[selectionRng.int(eligibleThemes.length)];
  const words = selectionRng.shuffle(selectedTheme.words).slice(0, rules.words);

  for (let attempt = 0; attempt < MAX_BOARD_ATTEMPTS; attempt += 1) {
    const board = attemptBoard(
      words,
      rules.size,
      DIRECTIONS[difficulty],
      deriveSeed(seed, attempt),
    );
    if (board) {
      return {
        seed: seed >>> 0,
        difficulty,
        size: rules.size,
        theme: selectedTheme.theme.name,
        grid: board.grid,
        placements: board.placements,
      };
    }
  }

  throw new Error(`Unable to place Word Search after ${MAX_BOARD_ATTEMPTS} attempts`);
}

const sameCoordinate = (left, right) => (
  left?.row === right?.row && left?.column === right?.column
);

export function findSelection(puzzle, start, end) {
  if (!Array.isArray(puzzle?.placements) || !start || !end) return null;
  const canonical = puzzle.placements.find((placement) => (
    (sameCoordinate(placement?.start, start) && sameCoordinate(placement?.end, end))
      || (sameCoordinate(placement?.start, end) && sameCoordinate(placement?.end, start))
  ));
  if (canonical) return canonical;
  const rowDelta = end.row - start.row;
  const columnDelta = end.column - start.column;
  if (rowDelta !== 0 && columnDelta !== 0 && Math.abs(rowDelta) !== Math.abs(columnDelta)) return null;
  const length = Math.max(Math.abs(rowDelta), Math.abs(columnDelta)) + 1;
  const dr = Math.sign(rowDelta), dc = Math.sign(columnDelta);
  const allowed = DIRECTIONS[puzzle.difficulty]?.some(([allowedRow, allowedColumn]) => (
    (allowedRow === dr && allowedColumn === dc)
      || (allowedRow === -dr && allowedColumn === -dc)
  ));
  if (!allowed) return null;
  const rendered = Array.from({ length }, (_, index) => (
    puzzle.grid?.[start.row + dr * index]?.[start.column + dc * index]
  )).join('');
  const reverse = [...rendered].reverse().join('');
  return puzzle.placements.find(({ word }) => word === rendered || word === reverse) ?? null;
}

export function validateWordSearch(puzzle, catalog = bundledThemes) {
  const errors = [];
  const rules = RULES[puzzle?.difficulty];
  if (!rules) errors.push('Invalid difficulty');
  if (!Number.isInteger(puzzle?.seed) || puzzle.seed < 0) errors.push('Invalid seed');
  if (!rules || puzzle?.size !== rules.size) errors.push('Invalid grid size');
  const hasThemeName = typeof puzzle?.theme === 'string' && puzzle.theme.length > 0;
  if (!hasThemeName) errors.push('Invalid theme');
  const namedTheme = hasThemeName && Array.isArray(catalog)
    ? catalog.find((theme) => theme?.name === puzzle.theme)
    : null;
  if (hasThemeName && !namedTheme) errors.push(`Unknown theme: ${puzzle.theme}`);
  const themeWords = namedTheme ? new Set(normalizedWords(namedTheme, Infinity)) : null;

  const size = rules?.size ?? 0;
  const validGrid = Array.isArray(puzzle?.grid)
    && puzzle.grid.length === size
    && puzzle.grid.every((row) => (
      Array.isArray(row)
      && row.length === size
      && row.every((letter) => typeof letter === 'string' && /^[A-Z]$/.test(letter))
    ));
  if (!validGrid) errors.push('Invalid grid');

  const placements = Array.isArray(puzzle?.placements) ? puzzle.placements : [];
  if (!Array.isArray(puzzle?.placements) || !rules || placements.length !== rules.words) {
    errors.push('Invalid placement count');
  }

  const seen = new Set();
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index];
    const word = placement?.word;
    if (typeof word !== 'string' || !/^[A-Z]{3,16}$/.test(word)) {
      errors.push(`Invalid word at placement ${index}`);
      continue;
    }
    if (themeWords && !themeWords.has(word)) errors.push(`Word not in theme: ${word}`);
    if (seen.has(word)) errors.push(`Duplicate word: ${word}`);
    seen.add(word);

    const start = placement?.start;
    const end = placement?.end;
    if (!start || !end || !Number.isInteger(start.row) || !Number.isInteger(start.column)
        || !Number.isInteger(end.row) || !Number.isInteger(end.column)
        || !inBounds(size, start) || !inBounds(size, end)) {
      errors.push(`Invalid endpoints for ${word}`);
      continue;
    }

    const direction = [Math.sign(end.row - start.row), Math.sign(end.column - start.column)];
    const allowed = DIRECTIONS[puzzle.difficulty]?.some(([dr, dc]) => (
      dr === direction[0] && dc === direction[1]
    ));
    const expectedEnd = {
      row: start.row + direction[0] * (word.length - 1),
      column: start.column + direction[1] * (word.length - 1),
    };
    if (!allowed || !sameCoordinate(end, expectedEnd)) {
      errors.push(`Invalid direction for ${word}`);
      continue;
    }

    const cells = cellsFor(word, start.row, start.column, direction);
    if (!validGrid || cells.some((cell) => puzzle.grid[cell.row]?.[cell.column] !== cell.letter)) {
      errors.push(`Grid does not contain ${word}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

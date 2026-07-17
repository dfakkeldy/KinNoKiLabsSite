import { createRng, deriveSeed } from './core.js';
import { CHART_CATALOG } from './kinnoki-charts-content.js';

export const CHARTS_SIZE_BY_DIFFICULTY = Object.freeze({ easy: 5, medium: 10, hard: 15 });

// --- Clues -----------------------------------------------------------------

export function clueRuns(line) {
  const runs = [];
  let count = 0;
  for (const cell of line) {
    if (cell === 1) {
      count += 1;
    } else if (count > 0) {
      runs.push(count);
      count = 0;
    }
  }
  if (count > 0) runs.push(count);
  return runs;
}

export function buildClues(cells, size) {
  const rows = [];
  const columns = [];
  for (let row = 0; row < size; row += 1) {
    const line = [];
    for (let column = 0; column < size; column += 1) line.push(cells[row * size + column]);
    rows.push(clueRuns(line));
  }
  for (let column = 0; column < size; column += 1) {
    const line = [];
    for (let row = 0; row < size; row += 1) line.push(cells[row * size + column]);
    columns.push(clueRuns(line));
  }
  return { rows, columns };
}

// --- Line solver -------------------------------------------------------------
// For one line (row or column), enumerate every arrangement of the clue's runs
// that is consistent with the currently-known cells, then intersect every
// arrangement to find cells that are the same (0 or 1) in all of them. A cell
// that agrees across every valid arrangement is "forced"; anything else stays
// unknown (-1). Returns null when no arrangement fits the known cells at all
// (a contradiction), otherwise an Int8Array of -1/0/1 the same length as `line`.

const remaining = (clue, runIndex) => {
  let total = 0;
  for (let i = runIndex; i < clue.length; i += 1) {
    total += clue[i];
    if (i > runIndex) total += 1;
  }
  return total;
};

function lineDeductions(clue, line, size) {
  const always = new Int8Array(size).fill(-1);
  let any = false;

  const merge = (candidate) => {
    if (!any) {
      for (let i = 0; i < size; i += 1) always[i] = candidate[i];
      any = true;
      return;
    }
    for (let i = 0; i < size; i += 1) {
      if (always[i] !== candidate[i]) always[i] = -1;
    }
  };

  const place = (runIndex, cursor, acc) => {
    if (runIndex === clue.length) {
      const finished = acc.slice();
      for (let i = cursor; i < size; i += 1) {
        if (line[i] === 1) return; // a known-filled cell can't be left uncovered
        finished[i] = 0;
      }
      merge(finished);
      return;
    }
    const run = clue[runIndex];
    const minRemaining = remaining(clue, runIndex);
    const maxStart = size - minRemaining;
    for (let start = cursor; start <= maxStart; start += 1) {
      // The cell that just entered the gap (start - 1) can never be freed up
      // again by pushing the run further right, so a known-filled cell there
      // ends this run's search entirely rather than just skipping one offset.
      if (start > cursor && line[start - 1] === 1) break;

      let fits = true;
      for (let i = start; i < start + run; i += 1) {
        if (line[i] === 0) { fits = false; break; }
      }
      if (!fits) continue;

      const afterRun = start + run;
      if (afterRun < size && line[afterRun] === 1) continue; // mandatory gap cell can't be known-filled

      const next = acc.slice();
      for (let i = cursor; i < start; i += 1) next[i] = 0;
      for (let i = start; i < afterRun; i += 1) next[i] = 1;
      if (afterRun < size) next[afterRun] = 0;
      place(runIndex + 1, afterRun + 1, next);
    }
  };

  place(0, 0, new Int8Array(size).fill(-1));
  return any ? always : null;
}

export function solveChart(clues, size) {
  const total = size * size;
  const grid = new Int8Array(total).fill(-1);
  const maxPasses = size * 4;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;

    for (let row = 0; row < size; row += 1) {
      const line = new Int8Array(size);
      for (let column = 0; column < size; column += 1) line[column] = grid[row * size + column];
      const deduced = lineDeductions(clues.rows[row], line, size);
      if (!deduced) return { solvable: false, grid: null };
      for (let column = 0; column < size; column += 1) {
        if (deduced[column] !== -1 && grid[row * size + column] === -1) {
          grid[row * size + column] = deduced[column];
          changed = true;
        }
      }
    }

    for (let column = 0; column < size; column += 1) {
      const line = new Int8Array(size);
      for (let row = 0; row < size; row += 1) line[row] = grid[row * size + column];
      const deduced = lineDeductions(clues.columns[column], line, size);
      if (!deduced) return { solvable: false, grid: null };
      for (let row = 0; row < size; row += 1) {
        if (deduced[row] !== -1 && grid[row * size + column] === -1) {
          grid[row * size + column] = deduced[row];
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  const solvable = grid.every((value) => value !== -1);
  return { solvable, grid: solvable ? grid : null };
}

// --- Puzzle factory ----------------------------------------------------------
// NOTE: `chooseFreshDefinition` (core.js) gates on a per-game entry in the
// private MODE_RECORDS map, which does not yet include 'kinnoki-charts' (that
// registration is a later wiring task). Calling it here with game:
// 'kinnoki-charts' would throw before that registration lands, so this factory
// reimplements the same bounded, deriveSeed-based anti-repeat search locally.
// It should be safe to delegate to the real chooseFreshDefinition once the
// registration exists, but this local version is self-contained either way.

const MAX_PICTURE_ATTEMPTS = 64;

function selectFreshPicture({ pool, seed, previousSignatures }) {
  const avoid = new Set(
    previousSignatures == null
      ? []
      : Array.isArray(previousSignatures) ? previousSignatures.filter((value) => value != null) : [previousSignatures],
  );
  const initialSeed = seed >>> 0;
  let fallback = null;
  for (let attempt = 0; attempt < MAX_PICTURE_ATTEMPTS; attempt += 1) {
    const candidateSeed = attempt === 0 ? initialSeed : deriveSeed(initialSeed, attempt - 1);
    const picture = pool[createRng(candidateSeed).int(pool.length)];
    if (fallback === null) fallback = picture;
    if (!avoid.has(picture.id)) return picture;
  }
  return fallback; // every candidate collided with `avoid`; reuse is unavoidable (tiny pool)
}

export function createChartsPuzzle({ difficulty, seed, previousSignatures = null }) {
  const size = CHARTS_SIZE_BY_DIFFICULTY[difficulty];
  if (!size) throw new RangeError(`Unsupported Kinnoki Charts difficulty: ${difficulty}`);
  const pool = CHART_CATALOG[difficulty];
  if (!Array.isArray(pool) || pool.length === 0) {
    throw new RangeError(`No Kinnoki Charts catalog entries for difficulty: ${difficulty}`);
  }

  const picture = selectFreshPicture({ pool, seed, previousSignatures });
  const solution = [...picture.solution];
  return {
    definition: {
      id: picture.id,
      title: picture.title,
      size,
      solution,
      clues: buildClues(solution, size),
    },
  };
}

// --- Play state + reducer -----------------------------------------------------

export function createChartsPlay(size = 0) {
  const total = Number.isInteger(size) && size > 0 ? size * size : 0;
  return { marks: new Array(total).fill(0), selected: 0, errors: [], completed: false };
}

const totalCells = (definition) => definition.size * definition.size;
const sanitizedMarks = (state) => {
  const total = totalCells(state.definition);
  return Array.isArray(state.marks) && state.marks.length === total ? state.marks : new Array(total).fill(0);
};
const isComplete = (definition, marks) => (
  marks.every((mark, index) => (mark === 1) === (definition.solution[index] === 1))
);
const withMark = (state, definition, marks, selected, index, value) => {
  const nextMarks = marks.slice();
  nextMarks[index] = value;
  const errors = state.errors.filter((errorIndex) => errorIndex !== index);
  return { ...state, marks: nextMarks, selected, errors, completed: isComplete(definition, nextMarks) };
};

export function reduceCharts(state, action) {
  if (state.completed) return state;
  const { definition } = state;
  const size = definition.size;
  const total = size * size;
  const marks = sanitizedMarks(state);
  const selected = Number.isInteger(state.selected) ? Math.max(0, Math.min(total - 1, state.selected)) : 0;

  if (action.type === 'select') {
    return { ...state, marks, selected: Math.max(0, Math.min(total - 1, action.index)) };
  }
  if (action.type === 'move') {
    const row = Math.max(0, Math.min(size - 1, action.row));
    const column = Math.max(0, Math.min(size - 1, action.column));
    return { ...state, marks, selected: row * size + column };
  }
  if (action.type === 'cycle') {
    return withMark(state, definition, marks, selected, selected, (marks[selected] + 1) % 3);
  }
  if (action.type === 'fill') return withMark(state, definition, marks, selected, selected, 1);
  if (action.type === 'mark') return withMark(state, definition, marks, selected, selected, 2);
  if (action.type === 'erase') return withMark(state, definition, marks, selected, selected, 0);
  if (action.type === 'hint') {
    const target = marks.findIndex((mark, index) => definition.solution[index] === 1 && mark !== 1);
    if (target < 0) return { ...state, marks, selected };
    return withMark(state, definition, marks, target, target, 1);
  }
  if (action.type === 'check') {
    const errors = marks.flatMap((mark, index) => (
      mark === 1 && definition.solution[index] !== 1 ? [index] : []
    ));
    return { ...state, marks, selected, errors };
  }
  return { ...state, marks, selected };
}

export function validateChartsState(play, difficulty) {
  const size = CHARTS_SIZE_BY_DIFFICULTY[difficulty];
  if (!size) return { valid: false };
  const total = size * size;
  if (!play || typeof play !== 'object' || Array.isArray(play)) return { valid: false };

  const { marks, selected, errors, completed } = play;
  if (!Array.isArray(marks) || marks.length !== total) return { valid: false };
  if (!marks.every((mark) => mark === 0 || mark === 1 || mark === 2)) return { valid: false };
  if (!Number.isInteger(selected) || selected < 0 || selected >= total) return { valid: false };
  if (!Array.isArray(errors) || !errors.every((index) => Number.isInteger(index) && index >= 0 && index < total)) {
    return { valid: false };
  }
  if (typeof completed !== 'boolean') return { valid: false };

  return { valid: true };
}

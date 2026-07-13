import test from 'node:test';
import assert from 'node:assert/strict';
import entries from '../../Resources/games/crossword-content.js';
import { generateCrossword, validateCrossword } from '../../Resources/games/crossword.js';

function puzzleFromAnswers(size, answers) {
  const cells = Array.from({ length: size }, () => Array(size).fill(null));
  for (const answer of answers) {
    const [dr, dc] = answer.direction === 'across' ? [0, 1] : [1, 0];
    for (let index = 0; index < answer.answer.length; index += 1) {
      const row = answer.row + dr * index;
      const column = answer.column + dc * index;
      const cell = cells[row][column] ?? {
        solution: answer.answer[index], number: null, across: null, down: null,
      };
      cell[answer.direction] = answer.number;
      if (index === 0) cell.number = answer.number;
      cells[row][column] = cell;
    }
  }
  return { seed: 0, difficulty: 'easy', size, cells, answers, usedFallback: false };
}

function assertInvalidWithoutThrowing(puzzle) {
  let result;
  assert.doesNotThrow(() => { result = validateCrossword(puzzle); });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
}

test('curated clues have normalized unique answers and public-safe metadata', () => {
  assert.ok(entries.length >= 120);
  assert.equal(new Set(entries.map((entry) => entry.answer)).size, entries.length);

  const tagCounts = { general: 0, canada: 0, 'cape-breton': 0 };
  const levelCounts = { easy: 0, medium: 0, hard: 0 };
  for (const entry of entries) {
    assert.match(entry.answer, /^[A-Z]{3,12}$/);
    assert.ok(entry.clue.length >= 8);
    assert.ok(['easy', 'medium', 'hard'].includes(entry.level));
    assert.ok(entry.tags.includes('general')
      || entry.tags.includes('canada')
      || entry.tags.includes('cape-breton'));
    levelCounts[entry.level] += 1;
    for (const tag of Object.keys(tagCounts)) {
      if (entry.tags.includes(tag)) tagCounts[tag] += 1;
    }
  }

  assert.ok(tagCounts.general >= 50);
  assert.ok(tagCounts.canada >= 35);
  assert.ok(tagCounts['cape-breton'] >= 35);
  assert.ok(levelCounts.easy >= 30);
  assert.ok(levelCounts.medium >= 30);
  assert.ok(levelCounts.hard >= 30);
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`${difficulty} crossword is deterministic, connected, and consistent`, () => {
    const puzzle = generateCrossword({ difficulty, seed: 99, entries });
    assert.deepEqual(puzzle, generateCrossword({ difficulty, seed: 99, entries }));
    assert.deepEqual(validateCrossword(puzzle), { valid: true, errors: [] });
    assert.equal(puzzle.answers.length, { easy: 7, medium: 10, hard: 13 }[difficulty]);
  });
}

test('impossible content returns the bundled known-valid puzzle', () => {
  const puzzle = generateCrossword({ difficulty: 'easy', seed: 1, entries: [] });
  assert.equal(puzzle.usedFallback, true);
  assert.equal(validateCrossword(puzzle).valid, true);
});

test('bundled fallback calls return mutation-isolated puzzles', () => {
  const first = generateCrossword({ difficulty: 'easy', seed: 1, entries: [] });
  first.answers[0].clue = 'Mutated clue';
  first.cells[first.answers[0].row][first.answers[0].column].solution = 'X';

  const second = generateCrossword({ difficulty: 'easy', seed: 2, entries: [] });
  assert.notStrictEqual(second, first);
  assert.notEqual(second.answers[0].clue, 'Mutated clue');
  assert.deepEqual(validateCrossword(second), { valid: true, errors: [] });
});

test('missing answer metadata returns invalid without throwing', () => {
  const puzzle = generateCrossword({ difficulty: 'easy', seed: 99, entries });
  puzzle.answers[0] = undefined;
  assertInvalidWithoutThrowing(puzzle);
});

test('out-of-bounds answer row returns invalid without throwing', () => {
  const puzzle = generateCrossword({ difficulty: 'easy', seed: 99, entries });
  puzzle.answers[0].row = puzzle.size;
  assertInvalidWithoutThrowing(puzzle);
});

test('out-of-bounds answer column returns invalid without throwing', () => {
  const puzzle = generateCrossword({ difficulty: 'easy', seed: 99, entries });
  puzzle.answers[0].column = puzzle.size;
  assertInvalidWithoutThrowing(puzzle);
});

test('malformed answer direction returns invalid without throwing', () => {
  const puzzle = generateCrossword({ difficulty: 'easy', seed: 99, entries });
  puzzle.answers[0].direction = 'diagonal';
  assertInvalidWithoutThrowing(puzzle);
});

test('validator rejects duplicate answers', () => {
  const puzzle = generateCrossword({ difficulty: 'easy', seed: 99, entries });
  puzzle.answers[1].answer = puzzle.answers[0].answer;
  const result = validateCrossword(puzzle);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.startsWith('Duplicate answer')));
});

test('validator rejects disconnected crossing groups', () => {
  const answers = [
    { number: 1, direction: 'across', answer: 'CAT', clue: 'A common pet animal', row: 0, column: 0 },
    { number: 1, direction: 'down', answer: 'CAR', clue: 'A common road vehicle', row: 0, column: 0 },
    { number: 2, direction: 'across', answer: 'DOG', clue: 'Another common pet', row: 4, column: 4 },
    { number: 2, direction: 'down', answer: 'DOT', clue: 'A very small mark', row: 4, column: 4 },
  ];
  const result = validateCrossword(puzzleFromAnswers(7, answers));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('Answers must form one connected group'));
});

test('validator rejects answers that never cross', () => {
  const answers = [
    { number: 1, direction: 'across', answer: 'CAT', clue: 'A common pet animal', row: 0, column: 0 },
    { number: 2, direction: 'across', answer: 'DOG', clue: 'Another common pet', row: 2, column: 0 },
  ];
  const result = validateCrossword(puzzleFromAnswers(5, answers));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('Every answer must cross another answer'));
});

test('validator rejects invalid clue numbering', () => {
  const puzzle = generateCrossword({ difficulty: 'easy', seed: 99, entries });
  puzzle.answers[0].number = 99;
  const result = validateCrossword(puzzle);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.startsWith('Invalid clue number')));
});

test('validator rejects unkeyed cells', () => {
  const puzzle = generateCrossword({ difficulty: 'easy', seed: 99, entries });
  const row = puzzle.cells.findIndex((cells) => cells.some((cell) => cell === null));
  const column = puzzle.cells[row].findIndex((cell) => cell === null);
  puzzle.cells[row][column] = {
    solution: 'X', number: null, across: null, down: null,
  };
  const result = validateCrossword(puzzle);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes(`Unkeyed cell at ${row}:${column}`));
});

test('60 seeded crosswords meet their exact targets and validate', { timeout: 20000 }, () => {
  const targetAnswers = { easy: 7, medium: 10, hard: 13 };
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (let seed = 1; seed <= 20; seed += 1) {
      const puzzle = generateCrossword({ difficulty, seed, entries });
      assert.deepEqual(validateCrossword(puzzle), { valid: true, errors: [] });
      assert.equal(puzzle.answers.length, targetAnswers[difficulty]);
    }
  }
});

test('hard generation has a short real-time bound and returns a valid puzzle', { timeout: 5000 }, () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const started = performance.now();
    const puzzle = generateCrossword({ difficulty: 'hard', seed, entries });
    assert.ok(performance.now() - started < 250, `hard seed ${seed} exceeded 250ms`);
    assert.deepEqual(validateCrossword(puzzle), { valid: true, errors: [] });
  }
});

test('clock speed cannot change deterministic Crossword output', () => {
  let clock = 0;
  const normal = generateCrossword({ difficulty: 'medium', seed: 7, entries });
  const hostileClock = generateCrossword({
    difficulty: 'medium', seed: 7, entries, now: () => (clock += 100),
  });
  assert.deepEqual(hostileClock, normal);
});

test('100 hard seeds provide broad deterministic puzzle diversity', { timeout: 20000 }, () => {
  const signatures = new Set();
  for (let seed = 0; seed < 100; seed += 1) {
    const first = generateCrossword({ difficulty: 'hard', seed, entries });
    const second = generateCrossword({ difficulty: 'hard', seed, entries });
    assert.deepEqual(first, second, `hard seed ${seed} must repeat exactly`);
    assert.equal(first.answers.length, 13);
    assert.deepEqual(validateCrossword(first), { valid: true, errors: [] });
    signatures.add(JSON.stringify({
      answers: first.answers.map(({ answer, row, column, direction }) => (
        [answer, row, column, direction]
      )),
      grid: first.cells.map((row) => row.map((cell) => cell?.solution ?? '#').join('')).join('/'),
    }));
  }
  assert.ok(signatures.size >= 12, `expected at least 12 hard signatures, got ${signatures.size}`);
});

test('representative consecutive hard seeds differ for Play Another', () => {
  const signature = (puzzle) => JSON.stringify({
    answers: puzzle.answers.map(({ answer }) => answer),
    grid: puzzle.cells.map((row) => row.map((cell) => cell?.solution ?? '#')),
  });
  assert.notEqual(
    signature(generateCrossword({ difficulty: 'hard', seed: 41, entries })),
    signature(generateCrossword({ difficulty: 'hard', seed: 42, entries })),
  );
});

test('hard seeds 2 and 3 do not repeat the same answer and grid signature', () => {
  const signature = (puzzle) => JSON.stringify({
    answers: puzzle.answers.map(({ answer, row, column, direction }) => [answer, row, column, direction]),
    grid: puzzle.cells.map((row) => row.map((cell) => cell?.solution ?? '#')),
  });
  assert.notEqual(
    signature(generateCrossword({ difficulty: 'hard', seed: 2, entries })),
    signature(generateCrossword({ difficulty: 'hard', seed: 3, entries })),
  );
});

test('sparse custom content gets a valid deterministic seed-keyed fallback', () => {
  const fallbacks = [];
  for (const seed of [3, 92]) {
    const first = generateCrossword({ difficulty: 'hard', seed, entries: [] });
    assert.deepEqual(first, generateCrossword({ difficulty: 'hard', seed, entries: [] }));
    assert.equal(first.answers.length, 13);
    assert.deepEqual(validateCrossword(first), { valid: true, errors: [] });
    fallbacks.push(first);
  }
  const signature = (puzzle) => JSON.stringify({
    answers: puzzle.answers.map(({ answer, row, column, direction }) => [answer, row, column, direction]),
    grid: puzzle.cells.map((row) => row.map((cell) => cell?.solution ?? '#')),
  });
  assert.notEqual(signature(fallbacks[0]), signature(fallbacks[1]));
});

test('all difficulty generators remain individually and collectively bounded', { timeout: 20000 }, () => {
  const started = performance.now();
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (let seed = 0; seed < 40; seed += 1) {
      const seedStarted = performance.now();
      const puzzle = generateCrossword({ difficulty, seed, entries });
      const duration = performance.now() - seedStarted;
      assert.ok(duration < 250, `${difficulty} seed ${seed} took ${duration.toFixed(1)}ms`);
      assert.equal(puzzle.answers.length, { easy: 7, medium: 10, hard: 13 }[difficulty]);
      assert.deepEqual(validateCrossword(puzzle), { valid: true, errors: [] });
    }
  }
  assert.ok(performance.now() - started < 10000);
});

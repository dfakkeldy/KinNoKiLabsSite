import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSudoku, isValidSudokuBoard, solveSudoku } from '../../Resources/games/sudoku.js';

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`${difficulty} Sudoku is repeatable, valid, and unique`, () => {
    const first = generateSudoku({ difficulty, seed: 20260712 });
    const second = generateSudoku({ difficulty, seed: 20260712 });
    assert.deepEqual(first, second);
    assert.equal(first.puzzle.length, 81);
    assert.equal(isValidSudokuBoard(first.solution), true);
    const solved = solveSudoku(first.puzzle, 2);
    assert.equal(solved.solutions.length, 1);
    assert.equal(solved.techniques.includes('guess'), false);
    if (difficulty === 'easy') assert.equal(solved.techniques.includes('candidate-elimination'), false);
    if (difficulty === 'medium') assert.equal(solved.techniques.includes('candidate-elimination'), true);
    if (difficulty === 'hard') assert.equal(solved.techniques.includes('advanced-elimination'), true);
    assert.equal(first.rating, difficulty);
  });
}

test('different seeds produce different puzzles', () => {
  assert.notDeepEqual(
    generateSudoku({ difficulty: 'medium', seed: 1 }).puzzle,
    generateSudoku({ difficulty: 'medium', seed: 2 }).puzzle,
  );
});

test('recursive search is reported as guessing, not logical elimination', () => {
  const emptyBoard = Array(81).fill(0);
  const result = solveSudoku(emptyBoard, 1);
  assert.equal(result.solutions.length, 1);
  assert.equal(result.techniques.includes('guess'), true);
  assert.equal(result.techniques.includes('candidate-elimination'), false);
  assert.equal(result.techniques.includes('advanced-elimination'), false);
});

test('solver limit detects a known multi-solution puzzle', () => {
  const puzzle = [
    5, 3, 4, 0, 0, 8, 9, 1, 2,
    6, 7, 2, 1, 9, 5, 3, 4, 8,
    1, 9, 8, 3, 4, 2, 5, 6, 7,
    8, 5, 9, 0, 0, 1, 4, 2, 3,
    4, 2, 6, 8, 5, 3, 7, 9, 1,
    7, 1, 3, 9, 2, 4, 8, 5, 6,
    9, 6, 1, 5, 3, 7, 2, 8, 4,
    2, 8, 7, 4, 1, 9, 6, 3, 5,
    3, 4, 5, 2, 8, 6, 1, 7, 9,
  ];
  const result = solveSudoku(puzzle, 2);
  assert.equal(result.solutions.length, 2);
});

test('contradictory givens have no solution', () => {
  const contradictory = [1, 1, ...Array(79).fill(0)];
  assert.deepEqual(solveSudoku(contradictory, 2), { solutions: [], techniques: [] });
});

test('30 seeded Sudokus stay within clue ranges and remain uniquely solvable', { timeout: 20000 }, () => {
  const ranges = { easy: [40, 46], medium: [32, 39], hard: [26, 31] };

  for (const [difficulty, [minimum, maximum]] of Object.entries(ranges)) {
    for (let seed = 1; seed <= 10; seed += 1) {
      const result = generateSudoku({ difficulty, seed });
      const clues = result.puzzle.filter(Boolean).length;
      assert.ok(clues >= minimum && clues <= maximum);
      assert.equal(isValidSudokuBoard(result.solution), true);
      assert.equal(solveSudoku(result.puzzle, 2).solutions.length, 1);
      for (let index = 0; index < 81; index += 1) {
        assert.equal(result.puzzle[index] === 0, result.puzzle[80 - index] === 0);
      }
    }
  }
});

test('supported Sudoku seeds always return a deterministic exactly classified puzzle', { timeout: 30000 }, () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (let seed = 0; seed < 50; seed += 1) {
      const first = generateSudoku({ difficulty, seed });
      const second = generateSudoku({ difficulty, seed });
      assert.deepEqual(first, second, `${difficulty} seed ${seed} must repeat`);
      const solved = solveSudoku(first.puzzle, 2);
      assert.equal(solved.solutions.length, 1, `${difficulty} seed ${seed} must be unique`);
      assert.equal(solved.techniques.includes('guess'), false);
      assert.equal(first.rating, difficulty);
      if (difficulty === 'easy') assert.equal(solved.techniques.includes('candidate-elimination'), false);
      if (difficulty === 'medium') {
        assert.equal(solved.techniques.includes('candidate-elimination'), true);
        assert.equal(solved.techniques.includes('advanced-elimination'), false);
      }
      if (difficulty === 'hard') assert.equal(solved.techniques.includes('advanced-elimination'), true);
    }
  }
});

test('Sudoku generation obeys a wall-clock safety deadline and still returns a valid fallback', () => {
  let clock = 0;
  const puzzle = generateSudoku({ difficulty: 'medium', seed: 19, now: () => (clock += 100) });
  assert.equal(solveSudoku(puzzle.puzzle, 2).solutions.length, 1);
  assert.equal(puzzle.rating, 'medium');
});

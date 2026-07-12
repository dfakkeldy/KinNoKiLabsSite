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

test('30 seeded Sudokus stay within clue ranges and remain uniquely solvable', () => {
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

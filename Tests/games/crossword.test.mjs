import test from 'node:test';
import assert from 'node:assert/strict';
import entries from '../../Resources/games/crossword-content.js';
import { generateCrossword, validateCrossword } from '../../Resources/games/crossword.js';

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
    assert.ok(puzzle.answers.length >= { easy: 6, medium: 9, hard: 12 }[difficulty]);
  });
}

test('impossible content returns the bundled known-valid puzzle', () => {
  const puzzle = generateCrossword({ difficulty: 'easy', seed: 1, entries: [] });
  assert.equal(puzzle.usedFallback, true);
  assert.equal(validateCrossword(puzzle).valid, true);
});

test('60 seeded crosswords meet their targets and validate', { timeout: 20000 }, () => {
  const minimumAnswers = { easy: 6, medium: 9, hard: 12 };
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (let seed = 1; seed <= 20; seed += 1) {
      const puzzle = generateCrossword({ difficulty, seed, entries });
      assert.deepEqual(validateCrossword(puzzle), { valid: true, errors: [] });
      assert.ok(puzzle.answers.length >= minimumAnswers[difficulty]);
    }
  }
});

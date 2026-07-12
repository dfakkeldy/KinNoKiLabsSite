import test from 'node:test';
import assert from 'node:assert/strict';
import themes from '../../Resources/games/word-search-content.js';
import {
  findSelection,
  generateWordSearch,
  validateWordSearch,
} from '../../Resources/games/word-search.js';

const RULES = {
  easy: { size: 10, words: 8, directions: new Set(['0:1', '1:0']) },
  medium: { size: 13, words: 12, directions: new Set(['0:1', '1:0', '1:1', '1:-1']) },
  hard: {
    size: 16,
    words: 16,
    directions: new Set(['0:1', '0:-1', '1:0', '-1:0', '1:1', '1:-1', '-1:1', '-1:-1']),
  },
};

const directionOf = (placement) => {
  const rowDelta = Math.sign(placement.end.row - placement.start.row);
  const columnDelta = Math.sign(placement.end.column - placement.start.column);
  return `${rowDelta}:${columnDelta}`;
};

test('themes are public, normalized, and balanced across topic groups', () => {
  assert.ok(themes.length >= 12);
  const tagCounts = { general: 0, canada: 0, 'cape-breton': 0 };
  const requiredNames = new Set([
    'Atlantic Wildlife',
    'Canadian Places',
    'Kitchen',
    'Weather',
    'Cape Breton Music',
    'Coastal Words',
  ]);

  for (const theme of themes) {
    assert.ok(requiredNames.delete(theme.name) || typeof theme.name === 'string');
    assert.equal(theme.words.length, 18);
    assert.equal(new Set(theme.words).size, theme.words.length);
    for (const word of theme.words) assert.match(word, /^[A-Z]{3,16}$/);
    for (const tag of Object.keys(tagCounts)) {
      if (theme.tags.includes(tag)) tagCounts[tag] += 1;
    }
  }

  assert.equal(requiredNames.size, 0);
  assert.deepEqual(tagCounts, { general: 4, canada: 4, 'cape-breton': 4 });
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`${difficulty} word search is deterministic and contains every listed word`, () => {
    const puzzle = generateWordSearch({ difficulty, seed: 77, themes });
    const rules = RULES[difficulty];

    assert.deepEqual(puzzle, generateWordSearch({ difficulty, seed: 77, themes }));
    assert.deepEqual(validateWordSearch(puzzle), { valid: true, errors: [] });
    assert.equal(puzzle.size, rules.size);
    assert.equal(puzzle.grid.length, rules.size);
    assert.equal(puzzle.placements.length, rules.words);

    for (const placement of puzzle.placements) {
      assert.ok(rules.directions.has(directionOf(placement)));
      assert.equal(findSelection(puzzle, placement.start, placement.end)?.word, placement.word);
      assert.equal(findSelection(puzzle, placement.end, placement.start)?.word, placement.word);
    }
  });
}

test('different seeds produce different word searches', () => {
  assert.notDeepEqual(
    generateWordSearch({ difficulty: 'medium', seed: 1, themes }),
    generateWordSearch({ difficulty: 'medium', seed: 2, themes }),
  );
});

test('selection only matches tracked placement endpoints', () => {
  const puzzle = generateWordSearch({ difficulty: 'easy', seed: 31, themes });
  assert.equal(findSelection(puzzle, { row: 0, column: 0 }, { row: 0, column: 0 }), null);
  assert.equal(findSelection(puzzle, null, puzzle.placements[0].end), null);
});

test('invalid theme input fails without entering an unbounded placement loop', () => {
  assert.throws(
    () => generateWordSearch({
      difficulty: 'hard',
      seed: 1,
      themes: [{ name: 'Too Small', tags: ['general'], words: ['ONLY', 'THREE', 'WORDS'] }],
    }),
    /eligible theme/i,
  );
});

test('validator reports malformed puzzles instead of throwing', () => {
  const puzzle = generateWordSearch({ difficulty: 'easy', seed: 18, themes });
  puzzle.placements[0].end.row = puzzle.size;
  let result;
  assert.doesNotThrow(() => { result = validateWordSearch(puzzle); });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('90 seeded word searches meet exact rules and validate', { timeout: 20000 }, () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const rules = RULES[difficulty];
    for (let seed = 1; seed <= 30; seed += 1) {
      const puzzle = generateWordSearch({ difficulty, seed, themes });
      assert.deepEqual(validateWordSearch(puzzle), { valid: true, errors: [] });
      assert.equal(puzzle.size, rules.size);
      assert.equal(puzzle.placements.length, rules.words);
      for (const placement of puzzle.placements) {
        assert.ok(rules.directions.has(directionOf(placement)));
      }
    }
  }
});

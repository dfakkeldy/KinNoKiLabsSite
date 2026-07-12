import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateSudoku } from '../../Resources/games/sudoku.js';
import { generateCrossword } from '../../Resources/games/crossword.js';
import { generateWordSearch } from '../../Resources/games/word-search.js';
import { createDOMFixture, FixtureEvent, installDOM } from './dom-fixture.mjs';

const emptyStats = () => ({ totalCompleted: 0, currentStreak: 0, lastCompletedDate: null, games: {} });
const storeWith = (game, definition, play) => ({
  version: 1,
  runs: { [game]: { difficulty: definition.difficulty, seed: definition.seed, puzzle: { definition, play }, startedAt: Date.now(), elapsedBeforeStartMs: 0, assisted: false } },
  previousSeeds: {}, stats: emptyStats(),
});

test('Sudoku keeps focus through sequential digit, pencil, erase, and undo keys', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const module = await import('../../Resources/games/sudoku-ui.js');
    const definition = generateSudoku({ difficulty: 'easy', seed: 20260712 });
    const play = module.createSudokuState(definition);
    play.selected = definition.puzzle.findIndex((value) => value === 0);
    await module.renderSudoku(fixture.root, storeWith('sudoku', definition, play));
    let cell = fixture.root.querySelector(`[data-cell="${play.selected}"]`); cell.focus();
    for (const key of ['2', 'p', '3', 'Delete', 'u']) {
      fixture.document.activeElement.dispatchEvent(new FixtureEvent('keydown', { key }));
      cell = fixture.root.querySelector(`[data-cell="${play.selected}"]`);
      assert.equal(fixture.document.activeElement?.dataset.cell, cell.dataset.cell, `${key} restores focus to the selected replacement cell`);
    }
  } finally { restore(); }
});

test('Word Search native clicks choose first and second endpoints', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const module = await import('../../Resources/games/word-search-ui.js');
    const definition = generateWordSearch({ difficulty: 'easy', seed: 77 });
    const placement = definition.placements[0];
    await module.renderWordSearch(fixture.root, storeWith('word-search', definition, module.createWordSearchState(definition)));
    fixture.root.querySelector(`[data-cell="${placement.start.row}:${placement.start.column}"]`).click();
    assert.match(fixture.root.querySelector(`[data-cell="${placement.start.row}:${placement.start.column}"]`).className, /is-preview/);
    fixture.root.querySelector(`[data-cell="${placement.end.row}:${placement.end.column}"]`).click();
    assert.match(fixture.root.querySelector('.games-live-region').textContent, new RegExp(`${placement.word} found`, 'i'));
  } finally { restore(); }
});

test('Word Search suppresses the compatibility click after a pointer drag', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const module = await import('../../Resources/games/word-search-ui.js');
    const definition = generateWordSearch({ difficulty: 'easy', seed: 77 });
    const placement = definition.placements[0];
    await module.renderWordSearch(fixture.root, storeWith('word-search', definition, module.createWordSearchState(definition)));
    const start = fixture.root.querySelector(`[data-cell="${placement.start.row}:${placement.start.column}"]`);
    start.dispatchEvent(new FixtureEvent('pointerdown', { pointerId: 4 }));
    fixture.document.setHitTarget(fixture.root.querySelector(`[data-cell="${placement.end.row}:${placement.end.column}"]`));
    fixture.document.dispatchEvent(new FixtureEvent('pointermove', { pointerId: 4 }));
    fixture.document.dispatchEvent(new FixtureEvent('pointerup', { pointerId: 4 }));
    const savedBeforeClick = fixture.localStorage.getItem('kinnoki-games:v1');
    fixture.root.querySelector(`[data-cell="${placement.end.row}:${placement.end.column}"]`).click();
    assert.equal(fixture.localStorage.getItem('kinnoki-games:v1'), savedBeforeClick, 'compatibility click does not begin another selection');
  } finally { restore(); }
});

test('all persisted-run validators reject forged completion and semantic corruption', async () => {
  const sudokuModule = await import('../../Resources/games/sudoku-ui.js');
  const crosswordModule = await import('../../Resources/games/crossword-ui.js');
  const wordModule = await import('../../Resources/games/word-search-ui.js');
  const sudoku = generateSudoku({ difficulty: 'easy', seed: 20260712 });
  const sudokuPlay = sudokuModule.createSudokuState(sudoku); sudokuPlay.completed = true;
  assert.equal(sudokuModule.validateSudokuRun({ definition: sudoku, play: sudokuPlay }, 'easy'), false);
  const badSolution = { ...sudoku, solution: Array(81).fill(1) };
  assert.equal(sudokuModule.validateSudokuRun({ definition: badSolution }, 'easy'), false);

  const crossword = generateCrossword({ difficulty: 'easy', seed: 99 });
  const crosswordPlay = crosswordModule.createCrosswordState(crossword); crosswordPlay.completed = true;
  assert.equal(crosswordModule.validateCrosswordRun({ definition: crossword, play: crosswordPlay }, 'easy'), false);
  const badCrossword = structuredClone(crossword); badCrossword.cells.flat().find(Boolean).solution = '!';
  assert.equal(crosswordModule.validateCrosswordRun({ definition: badCrossword }, 'easy'), false);

  const wordSearch = generateWordSearch({ difficulty: 'easy', seed: 77 });
  const wordPlay = wordModule.createWordSearchState(wordSearch); wordPlay.completed = true;
  assert.equal(wordModule.validateWordSearchRun({ definition: wordSearch, play: wordPlay }, 'easy'), false);
  const badWordSearch = structuredClone(wordSearch); badWordSearch.placements[0].word = 'NOTINTHEME';
  assert.equal(wordModule.validateWordSearchRun({ definition: badWordSearch }, 'easy'), false);
});

test('Word Search exposes an accessible 44px pan rail that scrolls without selecting letters', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=hard&continue=1' }); const restore = installDOM(fixture);
  try {
    const module = await import('../../Resources/games/word-search-ui.js');
    const definition = generateWordSearch({ difficulty: 'hard', seed: 77 });
    await module.renderWordSearch(fixture.root, storeWith('word-search', definition, module.createWordSearchState(definition)));
    const rail = fixture.root.querySelector('.word-search-pan');
    const scroller = fixture.root.querySelector('.game-board-scroll');
    assert.ok(rail);
    assert.equal(rail.getAttribute('aria-label'), 'Horizontal board navigation');
    assert.equal(rail.querySelector('[data-pan-left]').textContent.includes('Left'), true);
    assert.equal(rail.querySelector('[data-pan-right]').textContent.includes('Right'), true);
    assert.equal(rail.querySelector('input[type="range"]').getAttribute('aria-label'), 'Horizontal board position');
    const saved = fixture.localStorage.getItem('kinnoki-games:v1');
    rail.querySelector('[data-pan-right]').click();
    assert.ok(scroller.scrollLeft > 0);
    const range = rail.querySelector('input[type="range"]'); range.value = '100'; range.dispatchEvent(new FixtureEvent('input'));
    assert.equal(scroller.scrollLeft, scroller.scrollWidth - scroller.clientWidth);
    assert.equal(fixture.localStorage.getItem('kinnoki-games:v1'), saved, 'panning does not change puzzle selection');
    const css = readFileSync(new URL('../../Resources/styles.css', import.meta.url), 'utf8');
    assert.match(css, /\.word-search-pan button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s);
    assert.match(css, /\.word-search-pan input\[type="range"\]\s*\{[^}]*min-height:\s*44px;/s);
  } finally { restore(); }
});

test('Word Search handles lost pointer capture on connected document listener', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' }); const restore = installDOM(fixture);
  try {
    const module = await import('../../Resources/games/word-search-ui.js');
    const definition = generateWordSearch({ difficulty: 'easy', seed: 77 });
    const placement = definition.placements[0];
    await module.renderWordSearch(fixture.root, storeWith('word-search', definition, module.createWordSearchState(definition)));
    fixture.root.querySelector(`[data-cell="${placement.start.row}:${placement.start.column}"]`).dispatchEvent(new FixtureEvent('pointerdown', { pointerId: 12 }));
    assert.equal(fixture.document.listenerCount('lostpointercapture'), 1);
    fixture.document.dispatchEvent(new FixtureEvent('lostpointercapture', { pointerId: 12 }));
    assert.equal(fixture.document.listenerCount('pointermove'), 0);
    assert.equal(fixture.document.listenerCount('lostpointercapture'), 0);
  } finally { restore(); }
});

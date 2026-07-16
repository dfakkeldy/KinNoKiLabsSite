import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, FixtureEvent, installDOM } from './dom-fixture.mjs';
import { createEmptyGameStore, STORE_KEYS } from '../../Resources/games/core.js';
import { createChartsPuzzle } from '../../Resources/games/kinnoki-charts.js';

const chartsPuzzle = createChartsPuzzle({ difficulty: 'easy', seed: 20260712 }).definition;
const size = chartsPuzzle.size;

const v2StoreWithRun = ({
  definition = chartsPuzzle,
  play,
  difficulty = 'easy',
  seed = 1,
  startedAt = 0,
  elapsedBeforeStartMs = 0,
  assisted = false,
}) => {
  const store = createEmptyGameStore();
  store.runs['kinnoki-charts'] = {
    game: 'kinnoki-charts',
    mode: 'default',
    difficulty,
    seed: seed >>> 0,
    signature: 'fixture:kinnoki-charts:' + JSON.stringify(definition),
    puzzle: { definition, ...(play === undefined ? {} : { play }) },
    startedAt,
    elapsedBeforeStartMs,
    assisted,
  };
  return store;
};

test('mount renders the toolbar, clue strips, and a size×size grid of charts cells', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const store = v2StoreWithRun({});
    await renderCharts(fixture.root, store);
    assert.equal(fixture.root.querySelector('[href="/games"]')?.textContent.includes('Games'), true);
    assert.ok(fixture.root.querySelector('[data-difficulty]'));
    assert.ok(fixture.root.querySelector('[data-timer]'));
    assert.ok(fixture.root.querySelector('[data-new-game]'));
    assert.ok(fixture.root.querySelector('[data-restart]'));
    assert.ok(fixture.root.querySelector('[data-hint]'));
    assert.ok(fixture.root.querySelector('[data-check]'));
    assert.ok(fixture.root.querySelector('[data-instructions]'));
    assert.equal(fixture.root.querySelector('[role="grid"]')?.getAttribute('aria-rowcount'), String(size));
    assert.equal(fixture.root.querySelectorAll('.charts-clue-row').length, size);
    assert.equal(fixture.root.querySelectorAll('.charts-clue-column').length, size);
    for (const clue of fixture.root.querySelectorAll('.charts-clue-row')) {
      assert.match(clue.textContent, /\S/, 'each row clue renders as text');
    }
    for (const clue of fixture.root.querySelectorAll('.charts-clue-column')) {
      assert.match(clue.textContent, /\S/, 'each column clue renders as text');
    }
    const cells = fixture.root.querySelectorAll('button.charts-cell');
    assert.equal(cells.length, size * size);
    assert.equal(fixture.root.querySelectorAll('[role="gridcell"]').length, size * size);
  } finally { restore(); }
});

test('Kinnoki Charts patches cell nodes in place instead of replacing them on dispatch', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const store = v2StoreWithRun({});
    await renderCharts(fixture.root, store);
    const before = fixture.root.querySelector('[data-cell="0"]');
    before.dispatchEvent(new FixtureEvent('keydown', { key: 'ArrowRight' }));
    assert.ok(fixture.root.querySelector('[data-cell="0"]') === before,
      'the cell node identity is preserved across a select dispatch');
    assert.equal(fixture.root.querySelectorAll('[data-cell]').length, size * size,
      'no cells were rebuilt or duplicated');
  } finally { restore(); }
});

test('arrow keys move the roving-tabindex selection', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const store = v2StoreWithRun({});
    await renderCharts(fixture.root, store);
    assert.equal(fixture.root.querySelector('[data-cell="0"]').getAttribute('tabindex'), '0');
    assert.equal(fixture.root.querySelector('[data-cell="1"]').getAttribute('tabindex'), '-1');
    fixture.root.querySelector('[data-cell="0"]').dispatchEvent(new FixtureEvent('keydown', { key: 'ArrowRight' }));
    assert.equal(fixture.root.querySelector('[data-cell="1"]').getAttribute('tabindex'), '0');
    assert.equal(fixture.root.querySelector('[data-cell="0"]').getAttribute('tabindex'), '-1');
    fixture.root.querySelector('[data-cell="1"]').dispatchEvent(new FixtureEvent('keydown', { key: 'ArrowDown' }));
    assert.equal(fixture.root.querySelector(`[data-cell="${size + 1}"]`).getAttribute('tabindex'), '0');
  } finally { restore(); }
});

test('the primary action cycles a cell blank -> filled -> marked -> blank', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const store = v2StoreWithRun({});
    await renderCharts(fixture.root, store);
    const cell = fixture.root.querySelector('[data-cell="0"]');
    cell.click();
    assert.ok(cell.classList.contains('is-filled'));
    assert.equal(cell.textContent, '■');
    cell.click();
    assert.ok(cell.classList.contains('is-marked'));
    assert.equal(cell.textContent, '×');
    cell.click();
    assert.equal(cell.classList.contains('is-filled'), false);
    assert.equal(cell.classList.contains('is-marked'), false);
    assert.equal(cell.textContent, '');
  } finally { restore(); }
});

test('Enter/Space cycle the currently selected cell via the keyboard', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const store = v2StoreWithRun({});
    await renderCharts(fixture.root, store);
    const cell = fixture.root.querySelector('[data-cell="0"]');
    cell.dispatchEvent(new FixtureEvent('keydown', { key: 'Enter' }));
    assert.ok(cell.classList.contains('is-filled'));
    cell.dispatchEvent(new FixtureEvent('keydown', { key: ' ' }));
    assert.ok(cell.classList.contains('is-marked'));
  } finally { restore(); }
});

test('X toggles a mark on the selected cell independent of cycling', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const store = v2StoreWithRun({});
    await renderCharts(fixture.root, store);
    const cell = fixture.root.querySelector('[data-cell="0"]');
    cell.dispatchEvent(new FixtureEvent('keydown', { key: 'x' }));
    assert.ok(cell.classList.contains('is-marked'));
    cell.dispatchEvent(new FixtureEvent('keydown', { key: 'x' }));
    assert.equal(cell.classList.contains('is-marked'), false);
    assert.equal(cell.classList.contains('is-filled'), false);
  } finally { restore(); }
});

test('a satisfied row gains .is-satisfied on its clue strip', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const marks = new Array(size * size).fill(0);
    for (let column = 0; column < size; column += 1) marks[column] = chartsPuzzle.solution[column];
    const play = { marks, selected: 0, errors: [], completed: false };
    const store = v2StoreWithRun({ play });
    await renderCharts(fixture.root, store);
    const rowClues = fixture.root.querySelectorAll('.charts-clue-row');
    assert.ok(rowClues[0].classList.contains('is-satisfied'), 'row 0 exactly matches its clue');
  } finally { restore(); }
});

test('a satisfied column gains .is-satisfied on its clue strip', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const marks = new Array(size * size).fill(0);
    for (let row = 0; row < size; row += 1) marks[row * size] = chartsPuzzle.solution[row * size];
    const play = { marks, selected: 0, errors: [], completed: false };
    const store = v2StoreWithRun({ play });
    await renderCharts(fixture.root, store);
    const columnClues = fixture.root.querySelectorAll('.charts-clue-column');
    assert.ok(columnClues[0].classList.contains('is-satisfied'), 'column 0 exactly matches its clue');
  } finally { restore(); }
});

test('Hint fills a cell and marks the run assisted', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const store = v2StoreWithRun({});
    await renderCharts(fixture.root, store);
    fixture.root.querySelector('[data-hint]').click();
    assert.match(fixture.localStorage.getItem(STORE_KEYS.v2), /"assisted":true/);
    assert.match(fixture.root.querySelector('.game-assisted-status').textContent, /assisted/i);
    assert.equal(fixture.root.querySelectorAll('.charts-cell.is-filled').length, 1);
  } finally { restore(); }
});

test('Check flags a wrongly filled cell, marks the run assisted, and announces the count', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const wrongIndex = chartsPuzzle.solution.findIndex((value) => value === 0);
    const marks = new Array(size * size).fill(0);
    marks[wrongIndex] = 1;
    const play = { marks, selected: wrongIndex, errors: [], completed: false };
    const store = v2StoreWithRun({ play });
    await renderCharts(fixture.root, store);
    fixture.root.querySelector('[data-check]').click();
    assert.ok(fixture.root.querySelector(`[data-cell="${wrongIndex}"]`).classList.contains('is-error'));
    assert.match(fixture.localStorage.getItem(STORE_KEYS.v2), /"assisted":true/);
    assert.match(fixture.root.querySelector('.games-live-region').textContent, /1 error.*assisted/i);
  } finally { restore(); }
});

test('completion reveals the picture, celebrates, and names the pictogram', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const lastFilledIndex = chartsPuzzle.solution.findIndex((value) => value === 1);
    const marks = chartsPuzzle.solution.map((value, index) => (index === lastFilledIndex ? 0 : value));
    const play = { marks, selected: lastFilledIndex, errors: [], completed: false };
    const store = v2StoreWithRun({ play });
    await renderCharts(fixture.root, store);
    const cell = fixture.root.querySelector(`[data-cell="${lastFilledIndex}"]`);
    cell.click();
    const filledCount = chartsPuzzle.solution.filter((value) => value === 1).length;
    assert.equal(fixture.root.querySelectorAll('.charts-cell.is-reveal').length, filledCount);
    const heading = fixture.root.querySelector('[data-complete-heading]');
    assert.ok(heading, 'the completion panel renders');
    assert.equal(heading.textContent, `Chart revealed: ${chartsPuzzle.title}`);
    assert.ok(fixture.root.querySelector('.game-complete-record'), 'a first-ever completion breaks the time record');
    assert.ok(fixture.root.querySelector('[data-play-another]'));
    assert.equal(fixture.document.activeElement, heading);
  } finally { restore(); }
});

test('completion locks the board so no further mutation is possible', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const lastFilledIndex = chartsPuzzle.solution.findIndex((value) => value === 1);
    const marks = chartsPuzzle.solution.map((value, index) => (index === lastFilledIndex ? 0 : value));
    const play = { marks, selected: lastFilledIndex, errors: [], completed: false };
    const store = v2StoreWithRun({ play });
    await renderCharts(fixture.root, store);
    const cell = fixture.root.querySelector(`[data-cell="${lastFilledIndex}"]`);
    cell.click();
    for (const button of fixture.root.querySelectorAll('button')) {
      if (button.hasAttribute('data-play-another')) continue;
      assert.equal(button.disabled, true, `${button.className || button.tagName} is disabled once terminal`);
    }
  } finally { restore(); }
});

test('save/resume round-trips a partially filled run through validateChartsState', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const { validateChartsState } = await import('../../Resources/games/kinnoki-charts.js');
    const marks = new Array(size * size).fill(0);
    marks[0] = 1; marks[1] = 2;
    const play = { marks, selected: 0, errors: [], completed: false };
    const store = v2StoreWithRun({ play });
    await renderCharts(fixture.root, store);
    assert.equal(fixture.root.querySelector('[data-cell="0"]').textContent, '■');
    assert.equal(fixture.root.querySelector('[data-cell="1"]').textContent, '×');
    fixture.root.querySelector('[data-cell="2"]').click();
    const saved = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    const savedPlay = saved.runs['kinnoki-charts'].puzzle.play;
    assert.equal(validateChartsState(savedPlay, 'easy').valid, true);
    assert.equal(savedPlay.marks[2], 1);
  } finally { restore(); }
});

test('Restart shows a confirm dialog instead of window.confirm, and confirming clears progress', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const store = v2StoreWithRun({});
    await renderCharts(fixture.root, store);
    fixture.root.querySelector('[data-cell="0"]').click();
    fixture.root.querySelector('[data-restart]').click();
    const dialog = fixture.root.querySelector('dialog.game-dialog');
    assert.ok(dialog, 'restart opens a confirm dialog rather than window.confirm');
    dialog.querySelector('[data-dialog-confirm]').click();
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null);
    assert.equal(fixture.root.querySelector('[data-cell="0"]').classList.contains('is-filled'), false,
      'confirming restart clears progress');
  } finally { restore(); }
});

test('New Game skips the confirm dialog with no progress, and prompts once a cell is set', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const store = v2StoreWithRun({});
    await renderCharts(fixture.root, store);
    fixture.root.querySelector('[data-new-game]').click();
    assert.equal(fixture.root.querySelector('dialog.game-dialog'), null, 'no progress means no confirm prompt');

    const store2 = v2StoreWithRun({});
    await renderCharts(fixture.root, store2);
    fixture.root.querySelector('[data-cell="0"]').click();
    fixture.root.querySelector('[data-new-game]').click();
    const dialog = fixture.root.querySelector('dialog.game-dialog');
    assert.ok(dialog, 'progress this session requires confirmation');
    assert.equal(dialog.querySelector('[data-dialog-confirm]').textContent, 'New Game');
  } finally { restore(); }
});

test('mounts effects-only audio controls', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const store = v2StoreWithRun({});
    await renderCharts(fixture.root, store);
    assert.equal(fixture.root.querySelectorAll('[data-audio-music-volume]').length, 0,
      'kinnoki charts audio controls are effects-only');
    assert.equal(fixture.root.querySelectorAll('[data-audio-effects-volume]').length, 1);
    assert.equal(fixture.root.querySelectorAll('[data-audio-effects-toggle]').length, 1);
  } finally { restore(); }
});

test('calling the controller renderer again disposes the previous interval and visibility listener', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const { renderCharts } = await import('../../Resources/games/kinnoki-charts-ui.js');
    const store = v2StoreWithRun({});
    await renderCharts(fixture.root, store);
    assert.equal(fixture.document.listenerCount('visibilitychange'), 1);
    assert.equal(fixture.activeIntervalCount(), 1);
    await renderCharts(fixture.root, v2StoreWithRun({}));
    assert.equal(fixture.document.listenerCount('visibilitychange'), 1,
      'the previous session is disposed rather than accumulating a second listener');
    assert.equal(fixture.activeIntervalCount(), 1);
  } finally { restore(); }
});

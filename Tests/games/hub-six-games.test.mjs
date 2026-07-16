import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyGameStore } from '../../Resources/games/core.js';
import { FixtureElement } from './dom-fixture.mjs';
import {
  formatRecord, gameCardModel, GAMES, renderHubMarkup, statsModel,
} from '../../Resources/games/hub-ui.js';

const parseModeGroups = (markup) => {
  const document = { activeElement: null };
  const root = new FixtureElement('main', document);
  for (const match of markup.matchAll(/<div class="difficulty-links"([^>]*)>([\s\S]*?)<\/div>/g)) {
    const group = new FixtureElement('div', document);
    group.setAttribute('class', 'difficulty-links');
    for (const attribute of match[1].matchAll(/([\w-]+)="([^"]*)"/g)) {
      group.setAttribute(attribute[1], attribute[2]);
    }
    for (const linkMatch of match[2].matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)) {
      const link = new FixtureElement('a', document);
      link.setAttribute('href', linkMatch[1]);
      link.textContent = linkMatch[2];
      group.append(link);
    }
    root.append(group);
  }
  return root;
};

test('catalogue is top-level frozen in exact six-game order with approved metadata', () => {
  assert.equal(Object.isFrozen(GAMES), true);
  assert.deepEqual(GAMES.map(({ id, title, modes, records }) => ({ id, title, modes, records })), [
    { id: 'sudoku', title: 'Sudoku', modes: [{ id: 'default', label: 'New puzzle' }], records: ['time'] },
    { id: 'crossword', title: 'Crossword', modes: [{ id: 'default', label: 'New puzzle' }], records: ['time'] },
    { id: 'word-search', title: 'Word Search', modes: [{ id: 'default', label: 'New puzzle' }], records: ['time'] },
    { id: 'kinnoki-stack', title: 'Kinnoki Stack', modes: [{ id: 'default', label: 'New run' }], records: ['score', 'combo'] },
    { id: 'kinnoki-yard', title: 'Kinnoki Yard', modes: [
      { id: 'contracts', label: 'Puzzle Contracts' },
      { id: 'endless', label: 'Endless Yard' },
    ], records: ['time', 'moves', 'score', 'combo'] },
    { id: 'kinnoki-charts', title: 'Kinnoki Charts', modes: [{ id: 'default', label: 'New chart' }], records: ['time'] },
  ]);
});

test('hub renders six cards without stale three-game language', () => {
  const markup = renderHubMarkup(createEmptyGameStore());
  for (const title of [
    'Sudoku', 'Crossword', 'Word Search', 'Kinnoki Stack', 'Kinnoki Yard', 'Kinnoki Charts',
  ]) assert.match(markup, new RegExp('<h2[^>]*>' + title + '</h2>'));
  assert.equal([...markup.matchAll(/<article class="game-card/g)].length, 6);
  assert.doesNotMatch(markup, /three familiar|three classics|three games/i);
});

test('Yard Continue preserves saved mode and difficulty', () => {
  const store = createEmptyGameStore();
  store.runs['kinnoki-yard'] = {
    game: 'kinnoki-yard', mode: 'endless', difficulty: 'hard',
    seed: 4, signature: 'yard-4', puzzle: {}, startedAt: 1,
    elapsedBeforeStartMs: 2, assisted: false,
  };
  const card = gameCardModel(store, {
    id: 'kinnoki-yard', title: 'Kinnoki Yard',
    modes: [{ id: 'contracts' }, { id: 'endless' }],
  });
  assert.equal(card.continueHref,
    '/games/kinnoki-yard?mode=endless&difficulty=hard&continue=1');
  assert.equal(card.continueLabel, 'Continue Endless Yard · Hard');
});

test('Yard mode actions preserve Contract then Endless order and exact URLs', () => {
  const card = gameCardModel(createEmptyGameStore(), GAMES[4]);
  assert.deepEqual(card.modeGroups.map(({ id, label, difficulties }) => ({
    id, label, hrefs: difficulties.map(({ href }) => href),
  })), [
    {
      id: 'contracts', label: 'Puzzle Contracts', hrefs: [
        '/games/kinnoki-yard?mode=contracts&difficulty=easy',
        '/games/kinnoki-yard?mode=contracts&difficulty=medium',
        '/games/kinnoki-yard?mode=contracts&difficulty=hard',
      ],
    },
    {
      id: 'endless', label: 'Endless Yard', hrefs: [
        '/games/kinnoki-yard?mode=endless&difficulty=easy',
        '/games/kinnoki-yard?mode=endless&difficulty=medium',
        '/games/kinnoki-yard?mode=endless&difficulty=hard',
      ],
    },
  ]);
});

test('Yard Continue copy and URLs distinguish Contract from Endless', () => {
  const cases = [
    ['contracts', 'medium', '/games/kinnoki-yard?mode=contracts&difficulty=medium&continue=1', 'Continue Puzzle Contract · Medium'],
    ['endless', 'easy', '/games/kinnoki-yard?mode=endless&difficulty=easy&continue=1', 'Continue Endless Yard · Easy'],
  ];
  for (const [mode, difficulty, href, label] of cases) {
    const store = createEmptyGameStore();
    store.runs['kinnoki-yard'] = { mode, difficulty };
    const card = gameCardModel(store, GAMES[4]);
    assert.equal(card.continueHref, href);
    assert.equal(card.continueLabel, label);
  }
});

test('Yard mode difficulty containers are DOM groups with mode-specific names', () => {
  const dom = parseModeGroups(renderHubMarkup(createEmptyGameStore()));
  const yardGroups = dom.querySelectorAll('[role="group"]')
    .filter((group) => group.getAttribute('aria-label')?.startsWith('Choose Kinnoki Yard'));
  assert.deepEqual(yardGroups.map((group) => ({
    label: group.getAttribute('aria-label'),
    links: group.querySelectorAll('a').map((link) => link.textContent),
  })), [
    {
      label: 'Choose Kinnoki Yard Puzzle Contracts difficulty',
      links: ['Easy', 'Medium', 'Hard'],
    },
    {
      label: 'Choose Kinnoki Yard Endless Yard difficulty',
      links: ['Easy', 'Medium', 'Hard'],
    },
  ]);
});

test('record types never share a formatter', () => {
  assert.equal(formatRecord('time', 61500), '1:01');
  assert.equal(formatRecord('moves', 31), '31 moves');
  assert.equal(formatRecord('score', 12340), '12,340');
  assert.equal(formatRecord('combo', 7), '7×');
  assert.equal(formatRecord('moves', 31.9), '31 moves');
  assert.equal(formatRecord('score', Number.MAX_VALUE), '9,007,199,254,740,991');
  assert.equal(formatRecord('combo', -1), '—');
  assert.equal(formatRecord('unknown', 4), '—');
});

test('typed stats choose mode-specific min or max records and preserve zero', () => {
  const store = createEmptyGameStore();
  const stack = store.stats.games['kinnoki-stack'].modes.default;
  Object.assign(stack.records.score, { easy: 0, medium: 1200, hard: 900 });
  Object.assign(stack.records.combo, { easy: 0, medium: 3, hard: 8 });
  const contracts = store.stats.games['kinnoki-yard'].modes.contracts;
  Object.assign(contracts.records.time, { easy: 62000, medium: 61000, hard: 0 });
  Object.assign(contracts.records.moves, { easy: 31, medium: 24, hard: 0 });
  const endless = store.stats.games['kinnoki-yard'].modes.endless;
  Object.assign(endless.records.score, { easy: 0, medium: 12340, hard: 100 });
  Object.assign(endless.records.combo, { easy: 0, medium: 7, hard: 2 });

  const stats = statsModel(store);
  assert.deepEqual(stats.games['kinnoki-stack'], {
    completed: '0 completed', best: '1,200', combo: '8×',
  });
  assert.deepEqual(stats.games['kinnoki-yard'], {
    completed: '0 completed', best: '0:00', moves: '0 moves', score: '12,340', combo: '7×',
  });
});

test('hostile typed stats normalize to finite safe output', () => {
  const store = createEmptyGameStore();
  const records = store.stats.games['kinnoki-yard'].modes.endless.records;
  Object.assign(records.score, { easy: Number.NaN, medium: Number.POSITIVE_INFINITY, hard: -4 });
  Object.assign(records.combo, { easy: '<img>', medium: {}, hard: null });
  assert.deepEqual(statsModel(store).games['kinnoki-yard'], {
    completed: '0 completed', best: '—', moves: '—', score: '—', combo: '—',
  });
  assert.doesNotMatch(renderHubMarkup(store), /Infinity|NaN|<img>/);
});

test('typed records render exact semantic dl labels', () => {
  const markup = renderHubMarkup(createEmptyGameStore());
  for (const label of [
    'Best score', 'Best combo', 'Contract time', 'Contract moves',
    'Endless score', 'Endless combo', 'Finished',
  ]) assert.match(markup, new RegExp('<dt>' + label + '</dt><dd>'));
});

test('reset explanation names every locally removed game-data category', () => {
  const markup = renderHubMarkup(createEmptyGameStore());
  for (const phrase of [
    'unfinished games', 'totals', 'streaks', 'time', 'moves', 'scores',
    'combos', 'music', 'effects',
  ]) assert.match(markup, new RegExp(phrase, 'i'));
});

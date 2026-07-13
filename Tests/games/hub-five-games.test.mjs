import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyGameStore } from '../../Resources/games/core.js';
import {
  formatRecord, gameCardModel, renderHubMarkup,
} from '../../Resources/games/hub-ui.js';

test('hub renders five cards without stale three-game language', () => {
  const markup = renderHubMarkup(createEmptyGameStore());
  for (const title of [
    'Sudoku', 'Crossword', 'Word Search', 'Kinnoki Stack', 'Kinnoki Yard',
  ]) assert.match(markup, new RegExp('<h2[^>]*>' + title + '</h2>'));
  assert.equal([...markup.matchAll(/<article class="game-card/g)].length, 5);
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

test('record types never share a formatter', () => {
  assert.equal(formatRecord('time', 61500), '1:01');
  assert.equal(formatRecord('moves', 31), '31 moves');
  assert.equal(formatRecord('score', 12340), '12,340');
  assert.equal(formatRecord('combo', 7), '7×');
});

test('reset explanation names every locally removed game-data category', () => {
  const markup = renderHubMarkup(createEmptyGameStore());
  for (const phrase of [
    'unfinished games', 'totals', 'streaks', 'time', 'moves', 'scores',
    'combos', 'music', 'effects',
  ]) assert.match(markup, new RegExp(phrase, 'i'));
});

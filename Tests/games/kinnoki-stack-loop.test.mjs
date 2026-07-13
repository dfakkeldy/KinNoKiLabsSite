import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STACK_CONFIG, STACK_MAX_FRAME_DELTA_MS, advanceStackTime,
  createStackDefinition, createStackState, reduceStack, validateStackState,
} from '../../Resources/games/kinnoki-stack.js';

const stackState = (difficulty, seed) => (
  createStackState(createStackDefinition({ difficulty, seed }))
);

const advanceBy = (state, totalMs) => {
  let result = { state, events: [] };
  let remaining = totalMs;
  while (remaining > 0) {
    const delta = Math.min(STACK_MAX_FRAME_DELTA_MS, remaining);
    const next = advanceStackTime(result.state, delta);
    result = { state: next.state, events: [...result.events, ...next.events] };
    remaining -= delta;
  }
  return result;
};

test('difficulty timing is strictly ordered and tide forecasts are always saved', () => {
  assert.ok(STACK_CONFIG.easy.fallMs > STACK_CONFIG.medium.fallMs);
  assert.ok(STACK_CONFIG.medium.fallMs > STACK_CONFIG.hard.fallMs);
  assert.ok(STACK_CONFIG.easy.lockDelayMs > STACK_CONFIG.medium.lockDelayMs);
  assert.ok(STACK_CONFIG.medium.lockDelayMs > STACK_CONFIG.hard.lockDelayMs);
  for (const difficulty of ['medium', 'hard']) {
    const forecast = stackState(difficulty, 17).tide;
    assert.match(forecast.direction, /^(left|right)$/);
    assert.ok(Number.isSafeInteger(forecast.placementsRemaining));
    assert.ok(forecast.placementsRemaining > 0);
  }
});

test('first blocked gravity grounds and expiry locks exactly once', () => {
  let state = stackState('easy', 4);
  state = {
    ...state,
    status: 'active',
    active: {
      ...state.active,
      row: 18 - state.active.bounds.height, column: 4,
    },
  };
  let result = advanceBy(state, STACK_CONFIG.easy.fallMs);
  assert.equal(result.state.grounded.kind, 'automatic');
  assert.equal(result.state.placements, 0);
  result = advanceBy(result.state, STACK_CONFIG.easy.lockDelayMs);
  assert.equal(result.state.placements, 1);
  assert.equal(result.state.lockHistory.length, 1);
  assert.deepEqual(validateStackState(result.state, 'easy'), { valid: true, errors: [] });
  const duplicate = advanceStackTime(result.state, 5000);
  assert.equal(duplicate.state.placements, 1);
});

test('one frame cannot process an unbounded sleep backlog', () => {
  const state = { ...stackState('hard', 8), status: 'active' };
  const result = advanceStackTime(state, 60000);
  assert.ok(result.state.gravityAccumulatorMs <= STACK_CONFIG.hard.fallMs);
  assert.ok(result.events.filter((event) => event.type === 'moved').length <= 1);
  assert.ok(result.state.active.row - state.active.row <= 1);
});

const atFloor = (difficulty = 'easy') => {
  const state = stackState(difficulty, 66);
  return {
    ...state, status: 'active',
    active: {
      ...state.active,
      row: 18 - state.active.bounds.height, column: 4,
    },
  };
};

test('Step Mode marks assistance once and requires two blocked Advances', () => {
  let result = reduceStack(atFloor(), { type: 'set-step-mode', enabled: true });
  assert.equal(result.state.assisted, true);
  assert.equal(result.events.filter((event) => event.type === 'assisted').length, 1);
  const frozen = advanceStackTime(result.state, 60000);
  assert.equal(frozen.state, result.state);
  result = reduceStack(result.state, { type: 'advance-step' });
  assert.deepEqual(result.state.grounded, { kind: 'step', blockedOnce: true });
  assert.equal(result.state.placements, 0);
  result = reduceStack(result.state, { type: 'advance-step' });
  assert.equal(result.state.placements, 1);
  assert.equal(result.state.lockHistory.length, 1);
  assert.deepEqual(validateStackState(result.state, 'easy'), { valid: true, errors: [] });
  assert.equal(result.events.filter((event) => event.type === 'placed').length, 1);
});

test('grounding clears only when a transformation opens descent', () => {
  const board = atFloor().board.map((row) => [...row]);
  board[17][5] = { pieceId: 20, typeId: 'crate-pair' };
  const grounded = {
    ...atFloor(), board,
    active: {
      pieceId: 90, sequenceIndex: 90, typeId: 'crate-pair', rotation: 0,
      row: 16, column: 4, bounds: { width: 2, height: 1 },
    },
    grounded: { kind: 'automatic', remainingMs: 321 },
  };
  const stillBlocked = reduceStack(grounded, { type: 'move', deltaColumn: 1 }).state;
  assert.deepEqual(stillBlocked.grounded, { kind: 'automatic', remainingMs: 321 });
  const opened = reduceStack(grounded, { type: 'move', deltaColumn: -1 }).state;
  assert.equal(opened.grounded, null);
});

test('Step toggle converts grounded models without erasing blocked progress', () => {
  const automatic = {
    ...atFloor(), grounded: { kind: 'automatic', remainingMs: 321 },
  };
  const enabled = reduceStack(automatic, { type: 'set-step-mode', enabled: true }).state;
  assert.deepEqual(enabled.grounded, { kind: 'step', blockedOnce: true });
  const disabled = reduceStack(enabled, { type: 'set-step-mode', enabled: false }).state;
  assert.deepEqual(disabled.grounded, {
    kind: 'automatic', remainingMs: STACK_CONFIG.easy.lockDelayMs,
  });
  assert.equal(disabled.gravityAccumulatorMs, 0);
  assert.equal(disabled.assisted, true);
});

test('pause freezes gravity and Hard Drop bypasses either grounded model', () => {
  let result = reduceStack(atFloor(), { type: 'pause', reason: 'user' });
  assert.deepEqual(result.events, [{ type: 'paused', reason: 'user' }]);
  assert.equal(advanceStackTime(result.state, 9000).state, result.state);
  result = reduceStack(result.state, { type: 'resume' });
  assert.equal(result.state.status, 'active');
  result = reduceStack({
    ...result.state, stepMode: true,
    grounded: { kind: 'step', blockedOnce: true },
  }, { type: 'hard-drop' });
  assert.equal(result.state.placements, 1);
});

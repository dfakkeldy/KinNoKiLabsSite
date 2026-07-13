import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, FixtureEvent, installDOM } from './dom-fixture.mjs';
import { createEmptyGameStore, STORE_KEYS } from '../../Resources/games/core.js';

test('Stack renders 216 non-tabbable cells and stays inert before Start', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  let audioStarts = 0;
  try {
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      audioFactory: () => ({
        start: async () => { audioStarts += 1; }, resume: async () => {},
        pause: async () => {}, stop: async () => {}, finish() {}, dispose: async () => {},
        setPreferences() {}, setIntensity() {}, playEffect() {},
      }),
    });
    const cells = fixture.root.querySelectorAll('[role="gridcell"]');
    assert.equal(cells.length, 216);
    assert.ok(cells.every((cell) => cell.getAttribute('tabindex') === '-1'));
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
    assert.equal(audioStarts, 0);
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    assert.equal(audioStarts, 1);
    assert.equal(fixture.document.listenerCount('keydown'), 1);
    assert.equal(fixture.activeFrameCount(), 1);
    controller.dispose();
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
  } finally { restore(); }
});

test('difficulty copy, previews, keyboard help, and audio ranges are explicit', async () => {
  for (const [difficulty, previewCount] of [['easy', 3], ['medium', 2], ['hard', 1]]) {
    const fixture = createDOMFixture({ search: `?difficulty=${difficulty}` });
    const restore = installDOM(fixture);
    try {
      const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
      const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore());
      assert.equal(fixture.root.querySelectorAll('[data-next-cargo]').length, previewCount);
      assert.match(fixture.root.querySelector('[data-difficulty-explanation]').textContent,
        new RegExp(difficulty, 'i'));
      assert.match(fixture.root.querySelector('[data-stack-keyboard-help]').textContent,
        /Left|Right|Space|Escape/);
      assert.equal(fixture.root.querySelector('[data-audio-music-volume]')
        .getAttribute('type'), 'range');
      assert.equal(fixture.root.querySelector('[data-audio-effects-volume]')
        .getAttribute('type'), 'range');
      controller.dispose();
    } finally { restore(); }
  }
});

test('Describe Dock is pure and Step Mode persists assistance before Advance', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore());
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    const before = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .runs['kinnoki-stack'].puzzle.play;
    fixture.root.querySelector('[data-describe-dock]').click();
    const after = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .runs['kinnoki-stack'].puzzle.play;
    assert.deepEqual(after, before);
    assert.ok(fixture.root.querySelector('[data-dock-description]').textContent.length > 20);
    fixture.root.querySelector('[data-step-mode]').click();
    const assisted = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .runs['kinnoki-stack'];
    assert.equal(assisted.assisted, true);
    assert.equal(fixture.root.querySelector('[data-advance-step]').hidden, false);
    fixture.document.dispatchEvent(new FixtureEvent('keydown', { key: 'Escape' }));
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.ok(fixture.root.querySelector('[data-resume-game]'));
    controller.dispose();
  } finally { restore(); }
});

test('terminal completion runs once and preserves the ending audio cadence', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  const calls = { finish: 0, stop: 0, dispose: 0 };
  try {
    const stack = await import('../../Resources/games/kinnoki-stack.js');
    const engine = {
      ...stack,
      reduceStack(state, action) {
        if (action.type !== 'hard-drop') return stack.reduceStack(state, action);
        return {
          state: {
            ...state, status: 'terminal', terminalReason: 'crane-line',
            active: null, score: 0, combo: 0, bestCombo: 0, dispatchedManifests: 0,
          },
          events: [{ type: 'terminal', reason: 'crane-line' }],
        };
      },
    };
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      engine,
      audioFactory: () => ({
        start: async () => {}, resume: async () => {}, pause: async () => {},
        stop: () => { calls.stop += 1; },
        finish: ({ outcome }) => { assert.equal(outcome, 'terminal'); calls.finish += 1; },
        dispose: () => { calls.dispose += 1; },
        setPreferences() {}, setIntensity() {}, playEffect() {},
      }),
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    fixture.root.querySelector('[data-stack-hard-drop]').click();
    fixture.root.querySelector('[data-stack-hard-drop]').click();
    assert.equal(calls.finish, 1);
    assert.equal(calls.stop, 0);
    assert.equal(fixture.root.querySelector('[data-complete-heading]').textContent,
      'Run complete');
    assert.equal(JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .stats.totalCompleted, 1);
  } finally { restore(); }
});

test('Restart returns to an unsaved preview that remains reload-safe', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  const silentAudio = () => ({
    start: async () => {}, resume: async () => {}, pause: async () => {},
    stop: async () => {}, finish() {}, dispose: async () => {},
    setPreferences() {}, setIntensity() {}, playEffect() {},
  });
  try {
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    assert.ok(JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .runs['kinnoki-stack']);
    fixture.root.querySelector('[data-restart]').click();
    await Promise.resolve(); await Promise.resolve();
    const saved = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(saved.runs['kinnoki-stack'], undefined);
    assert.ok(fixture.root.querySelector('[data-start-game]'));

    controller.dispose();
    const reloaded = await renderKinnokiStack(fixture.root, saved, {
      audioFactory: silentAudio,
    });
    assert.ok(fixture.root.querySelector('[data-start-game]'));
    reloaded.dispose();
  } finally { restore(); }
});

test('declining an active difficulty replacement leaves play and storage unchanged', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  const silentAudio = () => ({
    start: async () => {}, resume: async () => {}, pause: async () => {},
    stop: async () => {}, finish() {}, dispose: async () => {},
    setPreferences() {}, setIntensity() {}, playEffect() {},
  });
  try {
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      audioFactory: silentAudio,
      confirm: () => false,
    });
    fixture.root.querySelector('[data-start-game]').click();
    const hardDrop = fixture.root.querySelector('[data-stack-hard-drop]');
    for (let attempt = 0; attempt < 12 && hardDrop.disabled; attempt += 1) {
      await Promise.resolve();
    }
    assert.equal(hardDrop.disabled, false);
    const before = fixture.localStorage.getItem(STORE_KEYS.v2);
    const listeners = fixture.document.listenerCount('keydown');
    const frames = fixture.activeFrameCount();
    const difficulty = fixture.root.querySelector('[data-difficulty]');
    difficulty.value = 'medium';
    difficulty.dispatchEvent(new FixtureEvent('change'));
    await Promise.resolve();
    assert.equal(difficulty.value, 'easy');
    assert.equal(fixture.localStorage.getItem(STORE_KEYS.v2), before);
    assert.equal(fixture.document.listenerCount('keydown'), listeners);
    assert.equal(fixture.activeFrameCount(), frames);
    assert.equal(hardDrop.disabled, false);
    controller.dispose();
  } finally { restore(); }
});

test('validated assisted resume normalizes the generic run envelope before Continue', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy&continue=1' });
  const restore = installDOM(fixture);
  try {
    const stack = await import('../../Resources/games/kinnoki-stack.js');
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const { startRun } = await import('../../Resources/games/core.js');
    const definition = stack.createStackDefinition({ difficulty: 'easy', seed: 77 });
    let play = stack.reduceStack(stack.createStackState(definition), { type: 'start' }).state;
    play = stack.reduceStack(play, { type: 'set-step-mode', enabled: true }).state;
    play = stack.reduceStack(play, { type: 'pause', reason: 'user' }).state;
    let store = startRun(createEmptyGameStore(), {
      game: 'kinnoki-stack', mode: 'default', difficulty: 'easy', seed: 77,
      signature: stack.stackDefinitionSignature(definition),
      puzzle: { definition, play }, now: 100,
    });
    assert.equal(store.runs['kinnoki-stack'].assisted, false);
    const controller = await renderKinnokiStack(fixture.root, store);
    store = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(store.runs['kinnoki-stack'].assisted, true);
    assert.equal(store.runs['kinnoki-stack'].puzzle.play.assisted, true);
    controller.dispose();
  } finally { restore(); }
});

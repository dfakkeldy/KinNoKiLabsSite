import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, FixtureEvent, installDOM } from './dom-fixture.mjs';
import { createEmptyGameStore, STORE_KEYS } from '../../Resources/games/core.js';

const silentAudio = () => ({
  start: async () => {}, resume: async () => {}, pause: async () => {},
  stop: async () => {}, finish() {}, dispose: async () => {},
  setPreferences() {}, setIntensity() {}, playEffect() {},
});

async function terminalEngine(overrides = {}) {
  const stack = await import('../../Resources/games/kinnoki-stack.js');
  return {
    ...stack,
    ...overrides,
    reduceStack(state, action) {
      if (action.type !== 'hard-drop') return stack.reduceStack(state, action);
      return {
        state: {
          ...state, status: 'terminal', terminalReason: 'crane-line',
          active: null, score: 0, combo: 0, bestCombo: 0, dispatchedManifests: 0,
          ...(overrides.terminalState ?? {}),
        },
        events: [{ type: 'terminal', reason: 'crane-line' }],
      };
    },
  };
}

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

test('clock-only RAF ticks bound persistence and full-board paints', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  let writes = 0;
  const storage = {
    getItem: (...args) => fixture.localStorage.getItem(...args),
    removeItem: (...args) => fixture.localStorage.removeItem(...args),
    setItem(...args) { writes += 1; fixture.localStorage.setItem(...args); },
  };
  try {
    let now = 0;
    const stack = await import('../../Resources/games/kinnoki-stack.js');
    const engine = {
      ...stack,
      advanceStackTime(state, deltaMs) {
        return {
          state: { ...state, gravityAccumulatorMs: state.gravityAccumulatorMs + deltaMs },
          events: [],
        };
      },
    };
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      storage, monotonicNow: () => now, audioFactory: silentAudio, engine,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    const firstCell = fixture.root.querySelector('[data-stack-cell="0:0"]');
    const originalSetAttribute = firstCell.setAttribute.bind(firstCell);
    let firstCellPaints = 0;
    firstCell.setAttribute = (...args) => {
      if (args[0] === 'aria-label') firstCellPaints += 1;
      return originalSetAttribute(...args);
    };
    writes = 0;

    for (let frame = 0; frame < 120; frame += 1) {
      now = frame * 16;
      fixture.tickFrames(now);
    }

    assert.ok(writes <= 1, `expected at most one checkpoint write, received ${writes}`);
    assert.equal(firstCellPaints, 0);
    assert.equal(fixture.root.querySelector('[data-timer]').textContent, '0:01');
    controller.dispose();
  } finally { restore(); }
});

test('gravity, pause, and dispose promptly checkpoint exact resumable Stack semantics', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  let writes = 0;
  const storage = {
    getItem: (...args) => fixture.localStorage.getItem(...args),
    removeItem: (...args) => fixture.localStorage.removeItem(...args),
    setItem(...args) { writes += 1; fixture.localStorage.setItem(...args); },
  };
  try {
    let now = 0;
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      storage, monotonicNow: () => now, audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    const firstCell = fixture.root.querySelector('[data-stack-cell="0:0"]');
    const originalSetAttribute = firstCell.setAttribute.bind(firstCell);
    let firstCellPaints = 0;
    firstCell.setAttribute = (...args) => {
      if (args[0] === 'aria-label') firstCellPaints += 1;
      return originalSetAttribute(...args);
    };
    writes = 0;
    fixture.tickFrames(0);
    for (const timestamp of [250, 500, 750, 900]) {
      now = timestamp;
      fixture.tickFrames(timestamp);
    }
    assert.equal(writes, 1);
    assert.equal(firstCellPaints, 1);
    let saved = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(saved.runs['kinnoki-stack'].puzzle.play.active.row, 1);

    now = 1075;
    fixture.tickFrames(1075);
    fixture.root.querySelector('[data-pause-game]').click();
    saved = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(saved.runs['kinnoki-stack'].puzzle.play.status, 'paused');
    assert.equal(saved.runs['kinnoki-stack'].puzzle.play.gravityAccumulatorMs, 175);
    assert.equal(saved.runs['kinnoki-stack'].elapsedBeforeStartMs, 1075);

    fixture.root.querySelector('[data-resume-game]').click();
    await Promise.resolve();
    now = 1200;
    fixture.tickFrames(1200);
    controller.dispose();
    saved = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(saved.runs['kinnoki-stack'].puzzle.play.gravityAccumulatorMs, 0);
    assert.equal(saved.runs['kinnoki-stack'].elapsedBeforeStartMs, 1200);

    fixture.location.search = '?difficulty=easy&continue=1';
    const continued = await renderKinnokiStack(fixture.root, saved, {
      storage, monotonicNow: () => now, audioFactory: silentAudio,
    });
    assert.equal(fixture.root.querySelector('[data-continue-game]').hidden, false);
    fixture.root.querySelector('[data-continue-game]').click();
    await Promise.resolve();
    const resumed = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .runs['kinnoki-stack'];
    assert.equal(resumed.puzzle.play.active.row, 1);
    assert.equal(resumed.puzzle.play.gravityAccumulatorMs, 0);
    assert.equal(resumed.elapsedBeforeStartMs, 1200);
    continued.dispose();
  } finally { restore(); }
});

test('null terminal payload fails recoverably before lifecycle terminal settlement', async () => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  let finishes = 0;
  try {
    const engine = await terminalEngine({ stackCompletionPayload: () => null });
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      engine,
      audioFactory: () => ({ ...silentAudio(), finish() { finishes += 1; } }),
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    fixture.root.querySelector('[data-stack-hard-drop]').click();
    assert.match(fixture.root.querySelector('[role="alert"]').textContent,
      /without a completion payload/i);
    assert.equal(finishes, 0);
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
  } finally { restore(); }
});

test('invalid terminal payload fails before completion accounting', async () => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  try {
    const engine = await terminalEngine({
      stackCompletionPayload: () => ({
        game: 'kinnoki-stack', mode: 'default', records: { score: -1, combo: 0 },
        summary: {
          score: -1, dispatchedManifests: 0, bestCombo: 0, elapsedMs: 0,
          assisted: false, reason: 'crane-line',
        },
      }),
    });
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      engine, audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    fixture.root.querySelector('[data-stack-hard-drop]').click();
    assert.match(fixture.root.querySelector('[role="alert"]').textContent,
      /invalid completion payload/i);
    const saved = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(saved.stats.totalCompleted, 0);
  } finally { restore(); }
});

test('reentrant terminal storage callback cannot duplicate completion writes', async () => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  let completionWrites = 0;
  let hardDrop = null;
  const storage = {
    getItem: (...args) => fixture.localStorage.getItem(...args),
    removeItem: (...args) => fixture.localStorage.removeItem(...args),
    setItem(key, value) {
      fixture.localStorage.setItem(key, value);
      if (JSON.parse(value).stats.totalCompleted === 1) {
        completionWrites += 1;
        hardDrop?.click();
      }
    },
  };
  try {
    const engine = await terminalEngine();
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      engine, storage, audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    hardDrop = fixture.root.querySelector('[data-stack-hard-drop]');
    hardDrop.click();
    assert.equal(completionWrites, 1);
    assert.equal(JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .stats.totalCompleted, 1);
  } finally { restore(); }
});

test('terminal assistance inconsistency fails recoverably without duplicate accounting', async () => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  try {
    const engine = await terminalEngine({ terminalState: { assisted: false } });
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      engine, audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    fixture.root.querySelector('[data-step-mode]').click();
    assert.doesNotThrow(() => fixture.root.querySelector('[data-stack-hard-drop]').click());
    assert.match(fixture.root.querySelector('[role="alert"]').textContent,
      /assistance state is inconsistent/i);
    const saved = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(saved.stats.totalCompleted, 0);
    assert.equal(saved.runs['kinnoki-stack'], undefined);
  } finally { restore(); }
});

test('terminal storage write failure rolls accounting back and fails recoverably', async () => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  const storage = {
    getItem: () => null,
    setItem() { throw new Error('disk full'); },
    removeItem() {},
  };
  try {
    const engine = await terminalEngine();
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      engine, storage, audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    fixture.root.querySelector('[data-stack-hard-drop]').click();
    assert.match(fixture.root.querySelector('[role="alert"]').textContent,
      /could not be saved/i);
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
  } finally { restore(); }
});

test('keyboard and native controls dispatch while paint preserves control focus', async () => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    const initialColumn = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .runs['kinnoki-stack'].puzzle.play.active.column;
    const left = fixture.root.querySelector('[data-stack-left]');
    left.focus();
    left.click();
    assert.equal(fixture.document.activeElement, left);
    fixture.document.activeElement = null;
    fixture.document.dispatchEvent(new FixtureEvent('keydown', { key: 'ArrowRight' }));
    const play = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .runs['kinnoki-stack'].puzzle.play;
    assert.equal(play.active.column, initialColumn);
    controller.dispose();
  } finally { restore(); }
});

test('visibility and pagehide pause require explicit Resume without listener leaks', async () => {
  for (const source of ['visibility', 'pagehide']) {
    const fixture = createDOMFixture();
    const restore = installDOM(fixture);
    try {
      const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
      const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
        audioFactory: silentAudio,
      });
      fixture.root.querySelector('[data-start-game]').click();
      await Promise.resolve();
      if (source === 'visibility') {
        fixture.document.visibilityState = 'hidden';
        fixture.document.dispatchEvent(new FixtureEvent('visibilitychange'));
      } else fixture.window.dispatchEvent(new FixtureEvent('pagehide'));
      assert.equal(fixture.document.listenerCount('keydown'), 0);
      assert.equal(fixture.activeFrameCount(), 0);
      const resume = fixture.root.querySelector('[data-resume-game]');
      assert.equal(resume.hidden, false);
      if (source === 'visibility') {
        fixture.document.visibilityState = 'visible';
        fixture.document.dispatchEvent(new FixtureEvent('visibilitychange'));
      }
      assert.equal(fixture.document.listenerCount('keydown'), 0);
      resume.click();
      await Promise.resolve();
      assert.equal(fixture.document.listenerCount('keydown'), 1);
      controller.dispose();
    } finally { restore(); }
  }
});

test('accepted New Run abandons active storage and hostile saved state fails closed', async () => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      audioFactory: silentAudio, confirm: () => true,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    fixture.root.querySelector('[data-new-run]').click();
    await Promise.resolve(); await Promise.resolve();
    let saved = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(saved.runs['kinnoki-stack'], undefined);
    assert.ok(fixture.root.querySelector('[data-start-game]'));
    controller.dispose();

    const hostile = {
      ...saved,
      runs: { 'kinnoki-stack': {
        game: 'kinnoki-stack', mode: 'default', difficulty: 'easy', seed: 1,
        signature: 'forged', assisted: false, puzzle: { definition: {}, play: {} },
      } },
    };
    await renderKinnokiStack(fixture.root, hostile, { audioFactory: silentAudio });
    assert.match(fixture.root.querySelector('[role="alert"]').textContent,
      /saved Kinnoki Stack state is invalid/i);
    saved = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2));
    assert.equal(saved.runs['kinnoki-stack'], undefined);
  } finally { restore(); }
});

test('audio receives event effects, intensity, and persisted setting changes', async () => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  const calls = { effects: [], intensity: [], preferences: [] };
  try {
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      audioFactory: () => ({
        ...silentAudio(),
        playEffect(value) { calls.effects.push(value); },
        setIntensity(value) { calls.intensity.push(value); },
        setPreferences(value) { calls.preferences.push(value); },
      }),
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    fixture.root.querySelector('[data-stack-left]').click();
    assert.ok(calls.effects.includes('move'));
    assert.ok(calls.intensity.length >= 2);
    const volume = fixture.root.querySelector('[data-audio-music-volume]');
    volume.value = '0.2';
    volume.dispatchEvent(new FixtureEvent('input'));
    assert.equal(calls.preferences.at(-1).musicVolume, 0.2);
    assert.equal(JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2)).audio.musicVolume, 0.2);
    controller.dispose();
  } finally { restore(); }
});

test('the active piece renders only in the position-driven overlay, never as grid-cell classes', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      seedFactory: () => 42, audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    const overlay = fixture.root.querySelector('.stack-active-overlay');
    assert.ok(overlay, 'an active-piece overlay is mounted in the dock');
    const play = () => JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .runs['kinnoki-stack'].puzzle.play;
    assert.equal(overlay.style.getPropertyValue('--piece-col'), String(play().active.column));
    assert.equal(overlay.style.getPropertyValue('--piece-row'), String(play().active.row));
    assert.ok(overlay.children.length > 0, 'the overlay renders the active piece cells');
    const activeClassed = fixture.root.querySelectorAll('.stack-cargo-active');
    assert.ok(activeClassed.length > 0);
    assert.ok(activeClassed.every((node) => overlay.contains(node)),
      'stack-cargo-active only ever appears inside the overlay, never directly on a grid cell');
    assert.equal(fixture.root.querySelectorAll('[data-stack-cell].stack-cargo-active').length, 0);

    fixture.root.querySelector('[data-stack-left]').click();
    assert.equal(overlay.style.getPropertyValue('--piece-col'), String(play().active.column));
    controller.dispose();
  } finally { restore(); }
});

test('a locked piece paints settled classes on the grid and clears the overlay', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      seedFactory: () => 42, audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    fixture.root.querySelector('[data-stack-hard-drop]').click();
    const play = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .runs['kinnoki-stack'].puzzle.play;
    const [firstFilledRow] = play.board
      .map((row, index) => (row.some(Boolean) ? index : null))
      .filter((index) => index !== null);
    const column = play.board[firstFilledRow].findIndex(Boolean);
    const settled = fixture.root.querySelector(`[data-stack-cell="${firstFilledRow}:${column}"]`);
    assert.ok(settled.classList.contains('stack-cargo-settled'));
    assert.equal(settled.classList.contains('stack-cargo-active'), false);
    controller.dispose();
  } finally { restore(); }
});

test('dispatch flashes cleared cells and pops a floating score that self-removes', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const stack = await import('../../Resources/games/kinnoki-stack.js');
    const definition = stack.createStackDefinition({ difficulty: 'easy', seed: 42 });
    const initial = stack.createStackState(definition);
    const manifest = initial.manifests[0];
    const engine = {
      ...stack,
      reduceStack(state, action) {
        if (action.type !== 'hard-drop') return stack.reduceStack(state, action);
        const board = state.board.map((row) => [...row]);
        for (const { row, column } of manifest.cells) board[row][column] = null;
        return {
          state: {
            ...state, board, manifests: [], score: state.score + 800,
            combo: 1, bestCombo: 1, dispatchedManifests: 1,
          },
          events: [{
            type: 'dispatch', manifestIds: [manifest.id],
            cells: manifest.cells.length, combo: 1, scoreAdded: 800,
          }],
        };
      },
    };
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      engine, seedFactory: () => 42, audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    fixture.root.querySelector('[data-stack-hard-drop]').click();
    const key = manifest.cells[0].row + ':' + manifest.cells[0].column;
    const firstDispatched = fixture.root.querySelector(`[data-stack-cell="${key}"]`);
    assert.ok(firstDispatched.classList.contains('cargo-dispatching'));
    const pop = fixture.root.querySelector('.game-score-pop');
    assert.ok(pop, 'a score pop is spawned on dispatch');
    assert.equal(pop.textContent, '+800 ×1');
    pop.dispatchEvent(new FixtureEvent('animationend'));
    assert.equal(fixture.root.querySelector('.game-score-pop'), null,
      'the score pop removes itself on animationend');
    firstDispatched.dispatchEvent(new FixtureEvent('animationend'));
    assert.equal(firstDispatched.classList.contains('cargo-dispatching'), false);
    controller.dispose();
  } finally { restore(); }
});

test('tide warnings set a directional dock edge cue that clears once the tide resolves', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=medium' });
  const restore = installDOM(fixture);
  try {
    const stack = await import('../../Resources/games/kinnoki-stack.js');
    const engine = {
      ...stack,
      reduceStack(state, action) {
        if (action.type !== 'move') return stack.reduceStack(state, action);
        if (action.deltaColumn === -1) {
          return {
            state, events: [{ type: 'tide-warning', direction: 'left', placementsRemaining: 1 }],
          };
        }
        return {
          state, events: [{ type: 'tide-shift', direction: 'left', movedComponents: 2 }],
        };
      },
    };
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      engine, seedFactory: () => 42, audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    const dock = fixture.root.querySelector('.stack-dock');
    fixture.root.querySelector('[data-stack-left]').click();
    assert.ok(dock.classList.contains('is-tide-left'));
    assert.equal(dock.classList.contains('is-tide-right'), false);
    fixture.root.querySelector('[data-stack-right]').click();
    assert.equal(dock.classList.contains('is-tide-left'), false);
    assert.equal(dock.classList.contains('is-tide-right'), false);
    controller.dispose();
  } finally { restore(); }
});

test('a same-frame tide-shift followed by a fresh tide-warning re-asserts the edge cue', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=medium' });
  const restore = installDOM(fixture);
  try {
    const stack = await import('../../Resources/games/kinnoki-stack.js');
    const engine = {
      ...stack,
      reduceStack(state, action) {
        if (action.type !== 'move') return stack.reduceStack(state, action);
        return {
          state,
          events: [
            { type: 'tide-shift', direction: 'left', movedComponents: 2 },
            { type: 'tide-warning', direction: 'right', placementsRemaining: 1 },
          ],
        };
      },
    };
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      engine, seedFactory: () => 42, audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    const dock = fixture.root.querySelector('.stack-dock');
    fixture.root.querySelector('[data-stack-left]').click();
    assert.equal(dock.classList.contains('is-tide-left'), false,
      'the shift clears the previous edge, but the same-frame warning below wins');
    assert.ok(dock.classList.contains('is-tide-right'),
      'the fresh tide-warning in the same event batch re-asserts the edge cue');
    controller.dispose();
  } finally { restore(); }
});

test('the hard-drop destination is marked with a dashed ghost cue', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      seedFactory: () => 42, audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    const play = JSON.parse(fixture.localStorage.getItem(STORE_KEYS.v2))
      .runs['kinnoki-stack'].puzzle.play;
    const ghosts = fixture.root.querySelectorAll('.stack-cell.is-ghost');
    assert.ok(ghosts.length > 0, 'the empty board renders a hard-drop ghost preview');
    const bottomRow = 18 - play.active.bounds.height;
    const key = bottomRow + ':' + play.active.column;
    assert.ok(fixture.root.querySelector(`[data-stack-cell="${key}"]`).classList.contains('is-ghost'));
    controller.dispose();
  } finally { restore(); }
});

test('next-cargo previews render thumbnails with a visually-hidden accessible label', async () => {
  const fixture = createDOMFixture({ search: '?difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    const controller = await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      audioFactory: silentAudio,
    });
    const items = fixture.root.querySelectorAll('[data-next-cargo]');
    assert.ok(items.length > 0);
    for (const item of items) {
      const thumb = item.querySelector('.cargo-thumb');
      assert.ok(thumb, 'preview item renders a cargo-thumb');
      const label = item.querySelector('.visually-hidden');
      assert.ok(label, 'preview item keeps an accessible text label');
      assert.match(label.textContent, /pattern/);
    }
    controller.dispose();
  } finally { restore(); }
});

test('a new score record surfaces in the terminal summary and triggers celebration', async () => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  try {
    const engine = await terminalEngine({
      terminalState: {
        score: 5000, combo: 0, bestCombo: 3, dispatchedManifests: 2,
      },
    });
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    await renderKinnokiStack(fixture.root, createEmptyGameStore(), {
      engine, audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    fixture.root.querySelector('[data-stack-hard-drop]').click();
    const recordLine = fixture.root.querySelector('[data-complete-records]');
    assert.ok(recordLine, 'a record line renders when a record is broken');
    assert.match(recordLine.textContent, /best score/i);
    assert.ok(fixture.root.querySelector('.game-celebration'),
      'celebration fires when a new record is set');
  } finally { restore(); }
});

test('no celebration or record line renders when the run breaks no records', async () => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  const store = createEmptyGameStore();
  store.stats.games['kinnoki-stack'].modes.default.records.score.easy = 10000;
  store.stats.games['kinnoki-stack'].modes.default.records.combo.easy = 10;
  try {
    const engine = await terminalEngine();
    const { renderKinnokiStack } = await import('../../Resources/games/kinnoki-stack-ui.js');
    await renderKinnokiStack(fixture.root, store, {
      engine, audioFactory: silentAudio,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await Promise.resolve();
    fixture.root.querySelector('[data-stack-hard-drop]').click();
    assert.equal(fixture.root.querySelector('[data-complete-records]'), null);
    assert.equal(fixture.root.querySelector('.game-celebration'), null);
  } finally { restore(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, FixtureEvent, installDOM } from './dom-fixture.mjs';
import { createEmptyGameStore } from '../../Resources/games/core.js';

async function waitForYardState(predicate, message) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail(message);
}

const silentYardAudioFactory = () => ({
  start: async () => {}, resume: async () => {}, pause: async () => {},
  stop: async () => {}, finish() {}, dispose: async () => {},
  setPreferences() {}, setIntensity() {}, playEffect() {},
});

test('Yard asks for mode first and exposes one roving board tab stop', async () => {
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      seedFactory: () => 80,
      audioFactory: silentYardAudioFactory,
    });
    assert.equal(fixture.root.querySelector('[data-mode]').value, 'contracts');
    const cells = fixture.root.querySelectorAll('[data-yard-cell]');
    assert.ok(cells.length > 0);
    assert.equal(cells.filter((cell) => cell.getAttribute('tabindex') === '0').length, 1);
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Yard never entered observable active state',
    );
    const focused = fixture.root.querySelector('[data-yard-cell][tabindex="0"]');
    const row = Number(focused.getAttribute('data-yard-row'));
    const column = Number(focused.getAttribute('data-yard-column'));
    const direction = [
      ['ArrowRight', row, column + 1],
      ['ArrowDown', row + 1, column],
      ['ArrowLeft', row, column - 1],
      ['ArrowUp', row - 1, column],
    ].find(([, nextRow, nextColumn]) => {
      const candidate = fixture.root.querySelector(
        `[data-yard-cell="${nextRow}:${nextColumn}"]`,
      );
      return candidate && candidate.disabled === false;
    });
    assert.ok(direction, 'generated Contract must expose an adjacent target cell');
    focused.dispatchEvent(new FixtureEvent('keydown', { key: direction[0] }));
    const moved = fixture.root.querySelector('[data-yard-cell][tabindex="0"]');
    assert.equal(fixture.root.querySelectorAll('[data-yard-cell][tabindex="0"]').length, 1);
    assert.notEqual(moved.getAttribute('data-yard-cell'), focused.getAttribute('data-yard-cell'));
    assert.equal(fixture.document.activeElement, moved);
  } finally { restore(); }
});
import {
  createContractState, generateContract, reduceContract, yardDefinitionSignature,
} from '../../Resources/games/kinnoki-yard.js';
import {
  markAssisted, openGameStore, startRun, STORE_KEYS,
} from '../../Resources/games/core.js';

test('Contract and Endless expose their exact mode-specific controls', async () => {
  for (const [mode, hasHint] of [['contracts', true], ['endless', false]]) {
    const fixture = createDOMFixture({ search: `?mode=${mode}&difficulty=medium` });
    const restore = installDOM(fixture);
    try {
      const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
      const controller = await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
        audioFactory: silentYardAudioFactory,
      });
      assert.equal(Boolean(fixture.root.querySelector('[data-yard-hint]')), hasHint);
      assert.ok(fixture.root.querySelector('[data-yard-undo]'));
      assert.ok(fixture.root.querySelector('[data-yard-rotate]'));
      assert.equal(fixture.root.querySelector('[data-yard-pan-left]')
        .getAttribute('aria-label'), 'Pan yard left');
      assert.equal(fixture.root.querySelector('[data-yard-pan-right]')
        .getAttribute('aria-label'), 'Pan yard right');
      assert.equal(fixture.root.querySelector('[data-audio-music-volume]')
        .getAttribute('type'), 'range');
      assert.equal(fixture.root.querySelector('[data-audio-effects-volume]')
        .getAttribute('type'), 'range');
      controller.dispose();
      assert.equal(fixture.document.listenerCount('keydown'), 0);
    } finally { restore(); }
  }
});

test('declined mode replacement keeps exact Contract state and Continue copy', async () => {
  const definition = generateContract({ difficulty: 'easy', seed: 81 });
  let play = reduceContract(createContractState(definition), { type: 'start' }).state;
  const witness = definition.witness[0];
  play = reduceContract(play, { type: 'select-piece', pieceId: witness.pieceId }).state;
  while (play.selectedRotation !== witness.rotation) {
    play = reduceContract(play, { type: 'rotate-piece', quarterTurns: 1 }).state;
  }
  play = reduceContract(play, {
    type: 'place-piece', row: witness.row, column: witness.column,
  }).state;
  let store = startRun(createEmptyGameStore(), {
    game: 'kinnoki-yard', mode: 'contracts', difficulty: 'easy', seed: 81,
    signature: yardDefinitionSignature(definition),
    puzzle: { definition, play }, now: 100,
  });
  const fixture = createDOMFixture({ search: '?mode=endless&difficulty=hard' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    await renderKinnokiYard(fixture.root, store, { confirm: () => false });
    assert.equal(fixture.root.querySelector('[data-mode]').value, 'contracts');
    assert.equal(fixture.root.querySelector('[data-difficulty]').value, 'easy');
    assert.match(fixture.root.querySelector('[data-continue-game]').textContent,
      /Continue Puzzle Contract · Easy/);
    assert.deepEqual(store.runs['kinnoki-yard'].puzzle.play, play);
  } finally { restore(); }
});

test('Yard rejects a saved run whose signature does not match its definition', async () => {
  const definition = generateContract({ difficulty: 'easy', seed: 82 });
  const play = reduceContract(createContractState(definition), { type: 'start' }).state;
  const store = startRun(createEmptyGameStore(), {
    game: 'kinnoki-yard', mode: 'contracts', difficulty: 'easy', seed: 82,
    signature: 'forged-contract-signature',
    puzzle: { definition, play }, now: 100,
  });
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    await renderKinnokiYard(fixture.root, store, {
      audioFactory: silentYardAudioFactory,
    });
    assert.ok(fixture.root.querySelector('.game-error'));
    assert.match(fixture.root.textContent, /Saved Kinnoki Yard state is invalid/);
    assert.equal(fixture.root.querySelector('[data-continue-game]'), null);
  } finally { restore(); }
});

test('Yard rejects either saved assistance mismatch before Continue admission', async () => {
  const definition = generateContract({ difficulty: 'easy', seed: 820 });
  let assistedPlay = reduceContract(
    createContractState(definition), { type: 'start' },
  ).state;
  assistedPlay = reduceContract(assistedPlay, { type: 'hint' }).state;
  assert.equal(assistedPlay.assisted, true);

  const falseEnvelope = startRun(createEmptyGameStore(), {
    game: 'kinnoki-yard', mode: 'contracts', difficulty: 'easy', seed: 820,
    signature: yardDefinitionSignature(definition),
    puzzle: { definition, play: assistedPlay }, now: 100,
  });
  assert.equal(falseEnvelope.runs['kinnoki-yard'].assisted, false);

  const unassistedPlay = reduceContract(
    createContractState(definition), { type: 'start' },
  ).state;
  let trueEnvelope = startRun(createEmptyGameStore(), {
    game: 'kinnoki-yard', mode: 'contracts', difficulty: 'easy', seed: 820,
    signature: yardDefinitionSignature(definition),
    puzzle: { definition, play: unassistedPlay }, now: 100,
  });
  trueEnvelope = markAssisted(trueEnvelope, 'kinnoki-yard');
  assert.equal(trueEnvelope.runs['kinnoki-yard'].assisted, true);

  for (const store of [falseEnvelope, trueEnvelope]) {
    const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
    const restore = installDOM(fixture);
    try {
      const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
      await renderKinnokiYard(fixture.root, store, {
        storage: fixture.localStorage,
        audioFactory: silentYardAudioFactory,
      });
      assert.match(fixture.root.textContent, /Saved Kinnoki Yard state is invalid/);
      assert.equal(fixture.root.querySelector('[data-continue-game]'), null);
      assert.equal(openGameStore(fixture.localStorage).store.runs['kinnoki-yard'], undefined);
    } finally { restore(); }
  }
});

test('Yard rejects nonboolean saved assistance envelopes before Continue admission', async () => {
  const definition = generateContract({ difficulty: 'easy', seed: 821 });
  const play = reduceContract(createContractState(definition), { type: 'start' }).state;
  const base = startRun(createEmptyGameStore(), {
    game: 'kinnoki-yard', mode: 'contracts', difficulty: 'easy', seed: 821,
    signature: yardDefinitionSignature(definition),
    puzzle: { definition, play }, now: 100,
  });

  for (const hostileAssisted of ['false', 0, null]) {
    const store = structuredClone(base);
    store.runs['kinnoki-yard'].assisted = hostileAssisted;
    const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
    const restore = installDOM(fixture);
    try {
      const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
      await renderKinnokiYard(fixture.root, store, {
        storage: fixture.localStorage,
        audioFactory: silentYardAudioFactory,
      });
      assert.match(fixture.root.textContent, /Saved Kinnoki Yard state is invalid/);
      assert.equal(fixture.root.querySelector('[data-continue-game]'), null);
      assert.equal(openGameStore(fixture.localStorage).store.runs['kinnoki-yard'], undefined);
    } finally { restore(); }
  }
});

test('declined active mode replacement changes no lifecycle or saved state', async () => {
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const controller = await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      storage: fixture.localStorage,
      seedFactory: () => 83,
      audioFactory: silentYardAudioFactory,
      confirm: () => false,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-pause-game]').disabled === false,
      'Yard never entered observable active state',
    );
    const before = fixture.localStorage.getItem(STORE_KEYS.v2);
    assert.ok(before);

    const mode = fixture.root.querySelector('[data-mode]');
    mode.focus();
    mode.value = 'endless';
    mode.dispatchEvent(new FixtureEvent('change'));

    assert.equal(mode.value, 'contracts');
    assert.equal(fixture.root.querySelector('[data-pause-game]').disabled, false);
    assert.equal(fixture.root.querySelector('[data-resume-game]').hidden, true);
    assert.equal(fixture.localStorage.getItem(STORE_KEYS.v2), before);
    assert.equal(fixture.document.activeElement, mode);
    controller.dispose();
  } finally { restore(); }
});

test('Contract Hint persists assistance and Continue resumes the exact run', async () => {
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  let audioStarts = 0;
  const audioFactory = () => ({
    start: async ({ arrangement }) => {
      assert.equal(arrangement, 'yard');
      audioStarts += 1;
    },
    resume: async () => {}, pause: async () => {}, stop: async () => {},
    finish() {}, dispose: async () => {}, setPreferences() {},
    setIntensity() {}, playEffect() {},
  });
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const first = await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      storage: fixture.localStorage,
      seedFactory: () => 86,
      audioFactory,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-hint]').disabled === false,
      'Contract never entered observable active state',
    );
    fixture.root.querySelector('[data-yard-hint]').click();
    assert.match(fixture.root.querySelector('[data-assisted-status]').textContent,
      /Assisted run/);
    let saved = openGameStore(fixture.localStorage).store;
    assert.equal(saved.runs['kinnoki-yard'].assisted, true);
    assert.equal(saved.runs['kinnoki-yard'].puzzle.play.assisted, true);
    const savedPlay = saved.runs['kinnoki-yard'].puzzle.play;
    first.dispose();

    const second = await renderKinnokiYard(fixture.root, saved, {
      storage: fixture.localStorage,
      seedFactory: () => 999,
      audioFactory,
    });
    assert.equal(fixture.root.querySelector('[data-continue-game]').hidden, false);
    assert.deepEqual(
      openGameStore(fixture.localStorage).store.runs['kinnoki-yard'].puzzle.play,
      savedPlay,
    );
    fixture.root.querySelector('[data-continue-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-pause-game]').disabled === false,
      'saved Contract never resumed',
    );
    saved = openGameStore(fixture.localStorage).store;
    assert.equal(saved.runs['kinnoki-yard'].puzzle.play.status, 'active');
    assert.equal(saved.runs['kinnoki-yard'].assisted, true);
    assert.equal(audioStarts, 2);
    second.dispose();
  } finally { restore(); }
});

test('Endless touch controls place and undo cargo while pan remains board-local', async () => {
  const fixture = createDOMFixture({ search: '?mode=endless&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const controller = await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      storage: fixture.localStorage,
      seedFactory: () => 84,
      audioFactory: silentYardAudioFactory,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Yard never entered observable active state',
    );

    const scroller = fixture.root.querySelector('.yard-board-scroll');
    const beforePan = scroller.scrollLeft;
    fixture.root.querySelector('[data-yard-pan-right]').click();
    assert.equal(scroller.scrollLeft, beforePan + 176);

    const tray = fixture.root.querySelector('[data-yard-tray]');
    const piece = tray.querySelector('[data-yard-piece]');
    const pieceId = piece.getAttribute('data-yard-piece');
    tray.dispatchEvent(new FixtureEvent('click', {
      target: { closest: () => piece },
    }));
    assert.equal(
      tray.querySelector(`[data-yard-piece="${pieceId}"]`).getAttribute('aria-pressed'),
      'true',
    );

    const scoreBefore = fixture.root.querySelector('[data-yard-score]').textContent;
    const placementCell = fixture.root.querySelectorAll('[data-yard-cell]')
      .find((cell) => cell.disabled === false);
    assert.ok(placementCell);
    placementCell.click();
    assert.ok(fixture.root.querySelectorAll('.yard-cell-placed').length > 0);
    assert.notEqual(fixture.root.querySelector('[data-yard-score]').textContent, scoreBefore);

    const undo = fixture.root.querySelector('[data-yard-undo]');
    assert.equal(undo.disabled, false);
    undo.click();
    assert.equal(fixture.root.querySelectorAll('.yard-cell-placed').length, 0);
    assert.equal(fixture.root.querySelector('[data-yard-score]').textContent, scoreBefore);
    controller.dispose();
  } finally { restore(); }
});

test('Contract terminal accounting completes once, writes records, and focuses summary', async () => {
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  let monotonic = 0;
  const finishCalls = [];
  try {
    const yard = await import('../../Resources/games/kinnoki-yard.js');
    const engine = {
      ...yard,
      reduceYard(state, action) {
        if (action.type !== 'rotate-piece') return yard.reduceYard(state, action);
        return {
          state: { ...state, status: 'terminal', moves: 7 },
          events: [{ type: 'completed', moves: 7 }],
        };
      },
      yardCompletionPayload(state, elapsedMs) {
        if (state.status !== 'terminal') return null;
        return {
          game: 'kinnoki-yard', mode: 'contracts',
          records: { time: elapsedMs, moves: state.moves },
          summary: {
            elapsedMs, moves: state.moves, assisted: state.assisted,
            piecesPlaced: state.definition.pieces.length,
            totalPieces: state.definition.pieces.length,
          },
        };
      },
    };
    const audioFactory = () => ({
      start: async () => {}, resume: async () => {}, pause: async () => {},
      stop: async () => {}, finish: (options) => finishCalls.push(options),
      dispose: async () => {}, setPreferences() {}, setIntensity() {}, playEffect() {},
    });
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const controller = await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      storage: fixture.localStorage,
      seedFactory: () => 85,
      wallNow: () => 1_700_000_000_000,
      monotonicNow: () => monotonic,
      audioFactory,
      engine,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Yard never entered observable active state',
    );
    monotonic = 2_500;
    fixture.root.querySelector('[data-yard-rotate]').click();

    const heading = fixture.root.querySelector('[data-complete-heading]');
    assert.equal(heading.textContent, 'Contract complete');
    assert.equal(fixture.document.activeElement, heading);
    const opened = openGameStore(fixture.localStorage).store;
    const contracts = opened.stats.games['kinnoki-yard'].modes.contracts;
    assert.equal(opened.runs['kinnoki-yard'], undefined);
    assert.equal(opened.stats.totalCompleted, 1);
    assert.equal(contracts.completed, 1);
    assert.equal(contracts.records.time.easy, 2_500);
    assert.equal(contracts.records.moves.easy, 7);
    fixture.root.querySelector('[data-yard-rotate]').click();
    assert.equal(openGameStore(fixture.localStorage).store.stats.totalCompleted, 1);
    assert.deepEqual(finishCalls, [{ outcome: 'completion' }]);
    controller.dispose();
  } finally { restore(); }
});

test('invalid terminal payload fails before Yard completion accounting', async () => {
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const yard = await import('../../Resources/games/kinnoki-yard.js');
    const engine = {
      ...yard,
      reduceYard(state, action) {
        if (action.type !== 'rotate-piece') return yard.reduceYard(state, action);
        return { state: { ...state, status: 'terminal' }, events: [{ type: 'completed' }] };
      },
      yardCompletionPayload: () => ({
        game: 'kinnoki-yard', mode: 'contracts', records: { time: -1, moves: 0 },
        summary: {
          elapsedMs: -1, moves: 0, assisted: false, piecesPlaced: 0, totalPieces: 0,
        },
      }),
    };
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      storage: fixture.localStorage, engine, audioFactory: silentYardAudioFactory,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Contract never entered active state',
    );
    fixture.root.querySelector('[data-yard-rotate]').click();
    assert.match(fixture.root.querySelector('[role="alert"]').textContent,
      /invalid completion payload/i);
    assert.equal(openGameStore(fixture.localStorage).store.stats.totalCompleted, 0);
    assert.equal(fixture.document.listenerCount('keydown'), 0);
  } finally { restore(); }
});

test('terminal storage failure rolls Yard accounting back and fails recoverably', async () => {
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  const storage = {
    getItem: () => null,
    setItem() { throw new Error('disk full'); },
    removeItem() {},
  };
  try {
    const yard = await import('../../Resources/games/kinnoki-yard.js');
    const engine = {
      ...yard,
      reduceYard(state, action) {
        if (action.type !== 'rotate-piece') return yard.reduceYard(state, action);
        return {
          state: { ...state, status: 'terminal', moves: 0 },
          events: [{ type: 'completed', moves: 0 }],
        };
      },
      yardCompletionPayload(state, elapsedMs) {
        return {
          game: 'kinnoki-yard', mode: 'contracts', records: { time: elapsedMs, moves: 0 },
          summary: {
            elapsedMs, moves: 0, assisted: state.assisted,
            piecesPlaced: 0, totalPieces: state.definition.pieces.length,
          },
        };
      },
    };
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      storage, engine, audioFactory: silentYardAudioFactory,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Contract never entered active state',
    );
    fixture.root.querySelector('[data-yard-rotate]').click();
    assert.match(fixture.root.querySelector('[role="alert"]').textContent,
      /completion could not be saved/i);
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
  } finally { restore(); }
});

test('Endless zero-dispatch terminal writes exact zero records once', async () => {
  const fixture = createDOMFixture({ search: '?mode=endless&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const yard = await import('../../Resources/games/kinnoki-yard.js');
    const engine = {
      ...yard,
      reduceYard(state, action) {
        if (action.type !== 'rotate-piece') return yard.reduceYard(state, action);
        return {
          state: {
            ...state, status: 'terminal', terminalReason: 'no-placement',
            score: 0, bestCombo: 0, dispatchedManifests: 0,
          },
          events: [{ type: 'terminal', reason: 'no-placement' }],
        };
      },
    };
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      storage: fixture.localStorage, engine, audioFactory: silentYardAudioFactory,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Endless never entered active state',
    );
    fixture.root.querySelector('[data-yard-rotate]').click();
    const saved = openGameStore(fixture.localStorage).store;
    const bucket = saved.stats.games['kinnoki-yard'].modes.endless;
    assert.equal(saved.stats.totalCompleted, 1);
    assert.equal(bucket.completed, 1);
    assert.equal(bucket.records.score.easy, 0);
    assert.equal(bucket.records.combo.easy, 0);
    assert.equal(saved.runs['kinnoki-yard'], undefined);
  } finally { restore(); }
});

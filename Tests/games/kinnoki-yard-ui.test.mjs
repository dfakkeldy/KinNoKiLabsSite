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
  createContractState, generateContract, prepareContractForContinue, reduceContract,
  yardDefinitionSignature,
} from '../../Resources/games/kinnoki-yard.js';
import {
  markAssisted, openGameStore, startRun, STORE_KEYS,
} from '../../Resources/games/core.js';

// A small, deterministic Contract fixture (mirrors kinnoki-yard-contracts.test.mjs's
// `pairContract`): six fixed-rotation two-cell pieces tiling a 4x3 target with a
// known witness solution, so ghost/hint footprint tests don't depend on solver
// or generator randomness.
function buildPairContractDefinition() {
  return Object.freeze({
    version: 1, game: 'kinnoki-yard', mode: 'contracts', difficulty: 'easy', seed: 700,
    width: 4, height: 3,
    target: [0, 1, 2].flatMap((row) => (
      [0, 1, 2, 3].map((column) => ({ row, column }))
    )),
    pieces: [0, 1, 2, 3, 4, 5].map((pieceId) => ({
      pieceId, typeId: 'crate-pair', allowedRotations: [0],
      initialRotation: 0, trayIndex: pieceId,
    })),
    witness: [0, 1, 2, 3, 4, 5].map((pieceId) => ({
      pieceId, rotation: 0,
      row: Math.floor(pieceId / 2), column: (pieceId % 2) * 2,
    })),
    generation: {
      usedFallback: false, attempt: 0, sourceId: null,
      transformId: 'identity', operations: 0,
    },
  });
}

function pairContractStore() {
  const definition = buildPairContractDefinition();
  const active = reduceContract(createContractState(definition), { type: 'start' }).state;
  const play = prepareContractForContinue(active);
  const store = startRun(createEmptyGameStore(), {
    game: 'kinnoki-yard', mode: 'contracts', difficulty: 'easy', seed: 700,
    signature: yardDefinitionSignature(definition),
    puzzle: { definition, play }, now: 100,
  });
  return { definition, store };
}

function clickTrayPiece(fixture, pieceId) {
  const tray = fixture.root.querySelector('[data-yard-tray]');
  const piece = tray.querySelector(`[data-yard-piece="${pieceId}"]`);
  tray.dispatchEvent(new FixtureEvent('click', { target: { closest: () => piece } }));
  return piece;
}

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

test("Yard ghost preview tints the piece's full rotated footprint by placeability and clears on leave", async () => {
  const { store } = pairContractStore();
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const controller = await renderKinnokiYard(fixture.root, store, {
      audioFactory: silentYardAudioFactory,
    });
    fixture.root.querySelector('[data-continue-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Contract never resumed to active state',
    );
    clickTrayPiece(fixture, 0);

    const validOrigin = fixture.root.querySelector('[data-yard-cell="0:0"]');
    validOrigin.dispatchEvent(new FixtureEvent('pointerenter'));
    assert.ok(validOrigin.classList.contains('is-ghost-valid'));
    assert.ok(fixture.root.querySelector('[data-yard-cell="0:1"]')
      .classList.contains('is-ghost-valid'));
    assert.equal(fixture.root.querySelectorAll('.is-ghost-valid').length, 2);
    assert.equal(fixture.root.querySelectorAll('.is-ghost-invalid').length, 0);

    validOrigin.dispatchEvent(new FixtureEvent('pointerleave'));
    assert.equal(fixture.root.querySelectorAll('.is-ghost-valid').length, 0);

    // Piece 0 is a fixed-rotation two-cell horizontal piece; anchoring it at the
    // target's rightmost column pushes its second cell off the 4-wide board, so
    // this origin can never be a legal placement regardless of solver state.
    const invalidOrigin = fixture.root.querySelector('[data-yard-cell="0:3"]');
    invalidOrigin.dispatchEvent(new FixtureEvent('focusin'));
    assert.ok(invalidOrigin.classList.contains('is-ghost-invalid'));
    assert.equal(fixture.root.querySelectorAll('.is-ghost-valid').length, 0);

    invalidOrigin.dispatchEvent(new FixtureEvent('focusout'));
    assert.equal(fixture.root.querySelectorAll('.is-ghost-invalid').length, 0);

    controller.dispose();
  } finally { restore(); }
});

test('Contract hint highlights the full footprint and flashes the matching tray piece', async () => {
  const { store } = pairContractStore();
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const controller = await renderKinnokiYard(fixture.root, store, {
      audioFactory: silentYardAudioFactory,
    });
    fixture.root.querySelector('[data-continue-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-hint]').disabled === false,
      'Contract never resumed to active state',
    );
    fixture.root.querySelector('[data-yard-hint]').click();

    assert.ok(fixture.root.querySelector('[data-yard-cell="0:0"]').classList.contains('is-hint'));
    assert.ok(fixture.root.querySelector('[data-yard-cell="0:1"]').classList.contains('is-hint'));
    assert.equal(fixture.root.querySelectorAll('.is-hint').length, 2);

    const flashedPiece = fixture.root.querySelector('[data-yard-piece="0"]');
    assert.ok(flashedPiece.classList.contains('is-hint-flash'));
    assert.equal(fixture.root.querySelectorAll('.is-hint-flash').length, 1);

    controller.dispose();
  } finally { restore(); }
});

test('an invalid Contract placement gets a one-shot cell flash cleared on animationend', async () => {
  const { store } = pairContractStore();
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const controller = await renderKinnokiYard(fixture.root, store, {
      audioFactory: silentYardAudioFactory,
    });
    fixture.root.querySelector('[data-continue-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Contract never resumed to active state',
    );
    clickTrayPiece(fixture, 0);
    const invalidCell = fixture.root.querySelector('[data-yard-cell="0:3"]');
    invalidCell.click();
    assert.ok(invalidCell.classList.contains('yard-cell-invalid-flash'));
    assert.equal(fixture.root.querySelectorAll('.yard-cell-invalid-flash').length, 1);
    assert.equal(fixture.root.querySelectorAll('.yard-cell-invalid').length, 0);

    invalidCell.dispatchEvent(new FixtureEvent('animationend'));
    assert.equal(invalidCell.classList.contains('yard-cell-invalid-flash'), false);

    controller.dispose();
  } finally { restore(); }
});

test('reduced motion applies the static invalid stripe instead of the one-shot flash', async () => {
  const { store } = pairContractStore();
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  const originalMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = (query) => ({ matches: true, media: query });
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const controller = await renderKinnokiYard(fixture.root, store, {
      audioFactory: silentYardAudioFactory,
    });
    fixture.root.querySelector('[data-continue-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Contract never resumed to active state',
    );
    clickTrayPiece(fixture, 0);
    const invalidCell = fixture.root.querySelector('[data-yard-cell="0:3"]');
    invalidCell.click();
    assert.ok(invalidCell.classList.contains('yard-cell-invalid'));
    assert.equal(invalidCell.classList.contains('yard-cell-invalid-flash'), false);
    controller.dispose();
  } finally {
    if (originalMatchMedia === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = originalMatchMedia;
    restore();
  }
});

test('Yard tray thumbnails pre-rotate cargo cells and keep visually-hidden accessible labels', async () => {
  const fixture = createDOMFixture({ search: '?mode=endless&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const controller = await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      storage: fixture.localStorage, seedFactory: () => 90, audioFactory: silentYardAudioFactory,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Endless never entered active state',
    );
    const tray = fixture.root.querySelector('[data-yard-tray]');
    const piece = tray.querySelector('[data-yard-piece]');
    const thumb = piece.querySelector('.cargo-thumb');
    assert.ok(thumb, 'tray piece renders a cargo-thumb');
    // Seed 90's first Easy Endless piece is a hook-four dealt at rotation 3
    // (3 columns x 2 rows); pre-rotation means the thumbnail reflects that
    // bounding box, not the type's base (unrotated) shape.
    assert.equal(thumb.style.getPropertyValue('--cargo-thumb-columns'), '3');
    assert.equal(thumb.style.getPropertyValue('--cargo-thumb-rows'), '2');
    const label = piece.querySelector('.visually-hidden');
    assert.ok(label, 'tray piece keeps a visually-hidden accessible label');
    assert.match(label.textContent, /Four-crate hook/);

    fixture.root.querySelector('[data-yard-rotate]').click();
    const rotatedThumb = tray.querySelector('[data-yard-piece]').querySelector('.cargo-thumb');
    assert.equal(rotatedThumb.style.getPropertyValue('--cargo-thumb-columns'), '2');
    assert.equal(rotatedThumb.style.getPropertyValue('--cargo-thumb-rows'), '3');
    controller.dispose();
  } finally { restore(); }
});

test('Yard tray pieces keep the cargo pattern on the thumbnail cells, not the button background', async () => {
  const fixture = createDOMFixture({ search: '?mode=endless&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const controller = await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      storage: fixture.localStorage, seedFactory: () => 90, audioFactory: silentYardAudioFactory,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Endless never entered active state',
    );
    for (const piece of fixture.root.querySelectorAll('[data-yard-piece]')) {
      assert.doesNotMatch(piece.className, /cargo-pattern-/,
        'the tray button itself carries no pattern background that would drown the silhouette');
      const pattern = piece.getAttribute('data-pattern');
      assert.ok(pattern, 'the pattern identity stays exposed as a data attribute');
      const patternedCells = piece.querySelectorAll(`.cargo-thumb-cell.cargo-pattern-${pattern}`);
      assert.ok(patternedCells.length > 0,
        'the non-colour pattern cue lives on the thumbnail cells');
      assert.match(piece.querySelector('.visually-hidden').textContent, new RegExp(`${pattern} pattern`),
        'the accessible label still names the pattern');
    }
    controller.dispose();
  } finally { restore(); }
});

test('Yard timer text is written at most once per displayed second', async () => {
  const fixture = createDOMFixture({ search: '?mode=contracts&difficulty=easy' });
  const restore = installDOM(fixture);
  let monotonic = 0;
  try {
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const controller = await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      seedFactory: () => 91,
      monotonicNow: () => monotonic,
      audioFactory: silentYardAudioFactory,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Yard never entered observable active state',
    );
    const timer = fixture.root.querySelector('[data-timer]');
    let writes = 0;
    let current = timer.textContent;
    Object.defineProperty(timer, 'textContent', {
      configurable: true,
      get() { return current; },
      set(value) { writes += 1; current = value; },
    });

    for (let tick = 0; tick < 5; tick += 1) {
      monotonic += 100;
      fixture.tickFrames(monotonic);
    }
    assert.equal(writes, 0, 'no textContent write while the displayed second is unchanged');

    monotonic = 1000;
    fixture.tickFrames(monotonic);
    assert.equal(writes, 1, 'textContent written exactly once when the displayed second changes');

    controller.dispose();
  } finally { restore(); }
});

test('Endless dispatch reuses the Task 8 score pop and dispatch flash', async () => {
  const fixture = createDOMFixture({ search: '?mode=endless&difficulty=easy' });
  const restore = installDOM(fixture);
  try {
    const yard = await import('../../Resources/games/kinnoki-yard.js');
    let dispatchedManifest = null;
    const engine = {
      ...yard,
      reduceYard(state, action) {
        if (state.kind !== 'endless' || action.type !== 'rotate-piece') {
          return yard.reduceYard(state, action);
        }
        const manifest = state.manifests[0];
        dispatchedManifest = manifest;
        const nextState = {
          ...state,
          manifests: state.manifests.slice(1),
          score: state.score + 250,
          combo: 1,
          bestCombo: Math.max(state.bestCombo, 1),
          dispatchedManifests: state.dispatchedManifests + 1,
        };
        return {
          state: nextState,
          events: [{
            type: 'dispatch', manifestIds: [manifest.id],
            cells: manifest.cells.length, combo: 1, scoreAdded: 250,
          }],
        };
      },
    };
    const { renderKinnokiYard } = await import('../../Resources/games/kinnoki-yard-ui.js');
    const controller = await renderKinnokiYard(fixture.root, createEmptyGameStore(), {
      storage: fixture.localStorage, seedFactory: () => 90, engine,
      audioFactory: silentYardAudioFactory,
    });
    fixture.root.querySelector('[data-start-game]').click();
    await waitForYardState(
      () => fixture.root.querySelector('[data-yard-rotate]').disabled === false,
      'Endless never entered active state',
    );
    fixture.root.querySelector('[data-yard-rotate]').click();
    assert.ok(dispatchedManifest, 'the fixture manifest was captured before dispatch');
    const pop = fixture.root.querySelector('.game-score-pop');
    assert.ok(pop, 'dispatch spawns a score pop');
    assert.equal(pop.textContent, '+250 ×1');
    for (const { row, column } of dispatchedManifest.cells) {
      assert.ok(
        fixture.root.querySelector(`[data-yard-cell="${row}:${column}"]`)
          .classList.contains('cargo-dispatching'),
        `cell ${row}:${column} should flash as dispatched`,
      );
    }

    pop.dispatchEvent(new FixtureEvent('animationend'));
    assert.equal(fixture.root.querySelector('.game-score-pop'), null);
    controller.dispose();
  } finally { restore(); }
});

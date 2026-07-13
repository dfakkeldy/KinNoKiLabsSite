import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, FixtureEvent, installDOM } from './dom-fixture.mjs';

test('explicit lifecycle is inert until Start and visible return requires Resume', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  let now = 100; const calls = [];
  try {
    const { createGameLifecycle } = await import('../../Resources/games/controller-common.js');
    const lifecycle = createGameLifecycle({
      root: fixture.root,
      initialElapsedMs: 500,
      monotonicNow: () => now,
      onActivate: (kind, api) => {
        calls.push(kind);
        api.listenActive(fixture.document, 'keydown', () => calls.push('key'));
        api.requestActiveFrame(() => calls.push('frame'));
      },
      onPause: (reason) => calls.push(reason),
      onSnapshot: () => calls.push('snapshot'),
      onDispose: () => calls.push('disposed'),
    });
    assert.equal(lifecycle.state, 'preview');
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
    await lifecycle.start('start');
    assert.equal(fixture.document.listenerCount('keydown'), 1);
    assert.equal(fixture.activeFrameCount(), 1);
    now = 1100;
    fixture.document.visibilityState = 'hidden';
    fixture.document.dispatchEvent(new FixtureEvent('visibilitychange'));
    assert.equal(lifecycle.state, 'paused');
    assert.equal(lifecycle.elapsed(), 1500);
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
    fixture.document.visibilityState = 'visible';
    fixture.document.dispatchEvent(new FixtureEvent('visibilitychange'));
    assert.equal(lifecycle.state, 'paused');
    await lifecycle.start('resume');
    assert.equal(calls.includes('resume'), true);
    fixture.window.dispatchEvent(new FixtureEvent('pagehide'));
    assert.equal(lifecycle.state, 'paused');
    assert.equal(calls.at(-1), 'hidden');
  } finally { restore(); }
});

test('finish and dispose are idempotent', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createGameLifecycle } = await import('../../Resources/games/controller-common.js');
    let finishes = 0;
    const lifecycle = createGameLifecycle({
      root: fixture.root, initialElapsedMs: 0, monotonicNow: () => 0,
      onActivate() {}, onPause() {}, onSnapshot() {},
      onDispose: () => { finishes += 1; },
    });
    await lifecycle.start('start');
    assert.equal(lifecycle.finish(), true);
    assert.equal(lifecycle.finish(), false);
    lifecycle.dispose(); lifecycle.dispose();
    assert.equal(finishes, 1);
  } finally { restore(); }
});

test('fatal failure snapshots once, clears active resources, and reports once', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createGameLifecycle } = await import('../../Resources/games/controller-common.js');
    const errors = []; let snapshots = 0;
    const lifecycle = createGameLifecycle({
      root: fixture.root, initialElapsedMs: 0, monotonicNow: () => 50,
      onActivate: (_kind, api) => {
        api.listenActive(fixture.document, 'keydown', () => {});
        api.requestActiveFrame(() => {});
      },
      onPause() {},
      onSnapshot: () => { snapshots += 1; },
      onError: (error) => errors.push(error.message),
      onDispose() {},
    });
    await lifecycle.start('start');
    assert.equal(lifecycle.fail(new Error('bad state')), true);
    assert.equal(lifecycle.fail(new Error('duplicate')), false);
    assert.equal(lifecycle.state, 'error');
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
    assert.equal(snapshots, 1);
    assert.deepEqual(errors, ['bad state']);
  } finally { restore(); }
});

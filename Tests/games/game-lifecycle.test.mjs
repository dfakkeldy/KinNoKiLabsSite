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

test('continue activates preview and replacement disposes the ordinary previous owner', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createGameLifecycle } = await import('../../Resources/games/controller-common.js');
    const calls = [];
    const first = createGameLifecycle({
      root: fixture.root,
      onActivate: (kind, api) => {
        calls.push(kind);
        api.listenActive(fixture.document, 'keydown', () => {});
      },
      onDispose: () => calls.push('disposed-first'),
    });
    assert.equal(await first.start('continue'), true);
    const second = createGameLifecycle({ root: fixture.root });
    assert.equal(first.state, 'disposed');
    assert.equal(second.state, 'preview');
    assert.deepEqual(calls, ['continue', 'disposed-first']);
    assert.equal(fixture.document.listenerCount('keydown'), 0);
  } finally { restore(); }
});

test('reentrant replacement preserves the lifecycle created by prior disposal', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createGameLifecycle } = await import('../../Resources/games/controller-common.js');
    let nested;
    const first = createGameLifecycle({
      root: fixture.root,
      onDispose: () => {
        nested = createGameLifecycle({
          root: fixture.root,
          onActivate: (_kind, api) => {
            api.listenActive(fixture.document, 'keydown', () => {});
            api.requestActiveFrame(() => {});
          },
        });
        void nested.start('start');
      },
    });
    const returned = createGameLifecycle({ root: fixture.root });
    assert.equal(first.state, 'disposed');
    assert.equal(returned, nested);
    assert.equal(nested.state, 'active');
    assert.equal(fixture.document.listenerCount('keydown'), 1);
    assert.equal(fixture.activeFrameCount(), 1);
    nested.dispose();
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
  } finally { restore(); }
});

test('snapshot reentrancy gives terminal and error transitions precedence over pause', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createGameLifecycle } = await import('../../Resources/games/controller-common.js');
    const pauses = [];
    let finishing;
    finishing = createGameLifecycle({
      root: fixture.root,
      onActivate: (_kind, api) => api.listenActive(fixture.document, 'keydown', () => {}),
      onSnapshot: () => finishing.finish(),
      onPause: (reason) => pauses.push(reason),
    });
    await finishing.start('start');
    assert.equal(finishing.pause('user'), true);
    assert.equal(finishing.state, 'terminal');
    assert.deepEqual(pauses, []);
    assert.equal(fixture.document.listenerCount('keydown'), 0);

    const errors = [];
    let failing;
    failing = createGameLifecycle({
      root: fixture.root,
      onActivate: (_kind, api) => api.requestActiveFrame(() => {}),
      onSnapshot: () => failing.fail(new Error('snapshot chose error')),
      onError: (error) => errors.push(error.message),
    });
    await failing.start('start');
    assert.equal(failing.pause('user'), true);
    assert.equal(failing.state, 'error');
    assert.deepEqual(errors, ['snapshot chose error']);
    assert.equal(fixture.activeFrameCount(), 0);
  } finally { restore(); }
});

test('throwing callbacks fail closed without leaked resources or duplicate error reports', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createGameLifecycle } = await import('../../Resources/games/controller-common.js');
    const errors = [];
    const lifecycle = createGameLifecycle({
      root: fixture.root,
      onActivate: (_kind, api) => {
        api.listenActive(fixture.document, 'keydown', () => {});
        api.requestActiveFrame(() => {});
      },
      onSnapshot: () => { throw new Error('snapshot exploded'); },
      onError: (error) => { errors.push(error.message); throw new Error('report exploded'); },
    });
    await lifecycle.start('start');
    assert.doesNotThrow(() => lifecycle.pause('user'));
    assert.equal(lifecycle.state, 'error');
    assert.deepEqual(errors, ['snapshot exploded']);
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
    assert.equal(lifecycle.fail(new Error('duplicate')), false);
    assert.deepEqual(errors, ['snapshot exploded']);

    const activationErrors = [];
    const activationFailure = createGameLifecycle({
      root: fixture.root,
      onActivate: (_kind, api) => {
        api.listenActive(fixture.document, 'keyup', () => {});
        throw new Error('activation exploded');
      },
      onError: (error) => activationErrors.push(error.message),
    });
    assert.equal(await activationFailure.start('start'), false);
    assert.equal(activationFailure.state, 'error');
    assert.deepEqual(activationErrors, ['activation exploded']);
    assert.equal(fixture.document.listenerCount('keyup'), 0);

    const disposing = createGameLifecycle({
      root: fixture.root,
      onActivate: (_kind, api) => api.requestActiveFrame(() => {}),
      onDispose: () => { throw new Error('dispose exploded'); },
    });
    await disposing.start('start');
    assert.doesNotThrow(() => disposing.dispose());
    assert.equal(disposing.state, 'disposed');
    assert.equal(fixture.activeFrameCount(), 0);
  } finally { restore(); }
});

test('cleanup is reverse ordered and fractional elapsed truncates across active epochs', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  let now = 10.25;
  try {
    const { createGameLifecycle } = await import('../../Resources/games/controller-common.js');
    const removals = [];
    const target = {
      addEventListener() {},
      removeEventListener(_type, listener) { removals.push(listener.name); },
    };
    const lifecycle = createGameLifecycle({
      root: fixture.root, initialElapsedMs: 3.9, monotonicNow: () => now,
      onActivate: (_kind, api) => {
        api.listenActive(target, 'event', function first() {});
        api.listenActive(target, 'event', function second() {});
      },
    });
    await lifecycle.start('start');
    now = 11.10;
    lifecycle.pause();
    assert.equal(lifecycle.elapsed(), 3);
    assert.deepEqual(removals, ['second', 'first']);
    now = 20.20;
    await lifecycle.start('resume');
    now = 22.95;
    assert.equal(lifecycle.elapsed(), 5);
    lifecycle.pause();
    assert.equal(lifecycle.elapsed(), 5);
  } finally { restore(); }
});

test('recursive animation requests are deferred to the next explicit fixture frame', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createGameLifecycle } = await import('../../Resources/games/controller-common.js');
    const timestamps = [];
    const lifecycle = createGameLifecycle({
      root: fixture.root,
      onActivate: (_kind, api) => {
        api.requestActiveFrame((timestamp) => {
          timestamps.push(timestamp);
          api.requestActiveFrame((nextTimestamp) => timestamps.push(nextTimestamp));
        });
      },
    });
    await lifecycle.start('start');
    fixture.tickFrames(10);
    assert.deepEqual(timestamps, [10]);
    assert.equal(fixture.activeFrameCount(), 1);
    fixture.tickFrames(20);
    assert.deepEqual(timestamps, [10, 20]);
    assert.equal(fixture.activeFrameCount(), 0);
  } finally { restore(); }
});

test('finish keeps terminal precedence while reporting a throwing snapshot exactly once', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createGameLifecycle } = await import('../../Resources/games/controller-common.js');
    const errors = [];
    const lifecycle = createGameLifecycle({
      root: fixture.root,
      onActivate: (_kind, api) => {
        api.listenActive(fixture.document, 'keydown', () => {});
        api.requestActiveFrame(() => {});
      },
      onSnapshot: () => { throw new Error('terminal snapshot exploded'); },
      onError: (error) => {
        errors.push(error.message);
        throw new Error('report callback exploded');
      },
    });
    await lifecycle.start('start');
    assert.doesNotThrow(() => assert.equal(lifecycle.finish(), true));
    assert.equal(lifecycle.state, 'terminal');
    assert.equal(fixture.document.listenerCount('keydown'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
    assert.deepEqual(errors, ['terminal snapshot exploded']);
    assert.equal(lifecycle.finish(), false);
    assert.deepEqual(errors, ['terminal snapshot exploded']);
  } finally { restore(); }
});

test('explicit fail reports its original error once when snapshot also throws', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createGameLifecycle } = await import('../../Resources/games/controller-common.js');
    const errors = [];
    const lifecycle = createGameLifecycle({
      root: fixture.root,
      onActivate: (_kind, api) => api.requestActiveFrame(() => {}),
      onSnapshot: () => { throw new Error('secondary snapshot error'); },
      onError: (error) => errors.push(error.message),
    });
    await lifecycle.start('start');
    assert.equal(lifecycle.fail(new Error('primary failure')), true);
    assert.equal(lifecycle.state, 'error');
    assert.equal(fixture.activeFrameCount(), 0);
    assert.deepEqual(errors, ['primary failure']);
    assert.equal(lifecycle.fail(new Error('duplicate')), false);
    assert.deepEqual(errors, ['primary failure']);
  } finally { restore(); }
});

test('throwing onPause clears resources and reports one deterministic error', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createGameLifecycle } = await import('../../Resources/games/controller-common.js');
    const errors = [];
    const lifecycle = createGameLifecycle({
      root: fixture.root,
      onActivate: (_kind, api) => {
        api.listenActive(fixture.document, 'keyup', () => {});
        api.requestActiveFrame(() => {});
      },
      onPause: () => { throw new Error('pause callback exploded'); },
      onError: (error) => errors.push(error.message),
    });
    await lifecycle.start('start');
    assert.doesNotThrow(() => assert.equal(lifecycle.pause('user'), true));
    assert.equal(lifecycle.state, 'error');
    assert.equal(fixture.document.listenerCount('keyup'), 0);
    assert.equal(fixture.activeFrameCount(), 0);
    assert.deepEqual(errors, ['pause callback exploded']);
    assert.equal(lifecycle.pause('duplicate'), false);
    assert.deepEqual(errors, ['pause callback exploded']);
  } finally { restore(); }
});

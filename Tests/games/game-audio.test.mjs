import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KINNOKI_MOTIF, createGameAudio,
} from '../../Resources/games/game-audio.js';
import { createAudioControls } from '../../Resources/games/controller-common.js';
import { createDOMFixture } from './dom-fixture.mjs';

class FakeParam {
  constructor(value = 0) { this.value = value; this.events = []; }
  setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
  linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]); }
  cancelScheduledValues(time) { this.events.push(['cancel', time]); }
}

class FakeNode {
  constructor() {
    this.frequency = new FakeParam();
    this.gain = new FakeParam(1);
    this.connections = [];
    this.started = [];
    this.stopped = [];
  }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
  start(time) { this.started.push(time); }
  stop(time) { this.stopped.push(time); }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0; this.state = 'suspended'; this.destination = new FakeNode();
    this.oscillators = []; this.gains = []; this.closeCount = 0;
  }
  createOscillator() { const node = new FakeNode(); this.oscillators.push(node); return node; }
  createGain() { const node = new FakeNode(); this.gains.push(node); return node; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.closeCount += 1; this.state = 'closed'; return Promise.resolve(); }
}

const preferences = {
  musicEnabled: true, musicVolume: 0.35,
  effectsEnabled: true, effectsVolume: 0.50,
};

const fakeClock = () => {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout(callback, delay) {
      const id = nextId; nextId += 1;
      timers.set(id, { callback, due: now + delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    advance(milliseconds) {
      now += milliseconds;
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.due <= now)
        .sort((left, right) => left[1].due - right[1].due);
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.callback();
      }
    },
    size: () => timers.size,
  };
};

test('context is not created until Start and pause/resume has no backlog', async () => {
  let creations = 0;
  const context = new FakeAudioContext();
  const audio = createGameAudio({
    audioContextFactory: () => { creations += 1; return context; }, preferences,
  });
  assert.equal(creations, 0);
  await audio.start({ arrangement: 'yard' });
  assert.equal(creations, 1);
  await audio.pause();
  context.currentTime = 100;
  await audio.resume();
  assert.ok(audio.debugState().nextNoteTime <= 100.25);
  await audio.dispose();
  assert.equal(context.state, 'closed');
});

test('pause cancels lookahead music voices before a backlog-free resume', async () => {
  const context = new FakeAudioContext();
  const audio = createGameAudio({ audioContextFactory: () => context, preferences });
  await audio.start({ arrangement: 'yard' });
  const oldMusic = [...context.oscillators];
  assert.ok(oldMusic.length >= 2);
  assert.ok(audio.debugState().activeSources >= 2);
  context.currentTime = 100;
  await audio.pause();
  assert.equal(audio.debugState().activeSources, 0);
  assert.ok(oldMusic.every((source) => source.stopped.includes(100)));
  await audio.resume();
  assert.ok(audio.debugState().nextNoteTime <= 100.25);
  assert.equal(context.oscillators.length, oldMusic.length,
    'resume waits for fresh lookahead instead of flushing old music');
  await audio.dispose();
});

test('both arrangements share one frozen motif and exact tempos', async () => {
  assert.deepEqual(KINNOKI_MOTIF, [0, 7, 11, 14, 9, 16]);
  assert.equal(Object.isFrozen(KINNOKI_MOTIF), true);
  for (const [arrangement, tempo] of [['yard', 76], ['stack', 118]]) {
    const context = new FakeAudioContext();
    const audio = createGameAudio({ audioContextFactory: () => context, preferences });
    await audio.start({ arrangement });
    assert.equal(audio.debugState().tempo, tempo);
    if (arrangement === 'yard') assert.ok(context.oscillators.length >= 2);
    await audio.dispose();
  }
});

test('Stack intensity adds layers and channel preferences stay independent', async () => {
  const context = new FakeAudioContext();
  let schedule = null;
  const audio = createGameAudio({
    audioContextFactory: () => context, preferences,
    setIntervalFn: (callback) => { schedule = callback; return 1; }, clearIntervalFn: () => {},
  });
  await audio.start({ arrangement: 'stack' });
  const melodyOnly = context.oscillators.length;
  audio.setIntensity({ height: 1, tidePressure: 1 });
  context.currentTime = 1;
  schedule();
  const intense = audio.debugState();
  assert.ok(intense.layerGains.bass > 0);
  assert.ok(intense.layerGains.harmony > 0);
  assert.ok(intense.layerGains.percussion > 0);
  assert.ok(context.oscillators.length >= melodyOnly + 4);
  audio.setPreferences({ ...preferences, musicEnabled: false, effectsVolume: 0.2 });
  assert.equal(audio.debugState().musicGain, 0);
  assert.equal(audio.debugState().effectsGain, 0.2);
  await audio.dispose();
});

test('rapid effects are rate-limited and voice count is bounded', async () => {
  const context = new FakeAudioContext();
  const audio = createGameAudio({
    audioContextFactory: () => context, preferences, monotonicNow: () => 10,
  });
  await audio.start({ arrangement: 'stack' });
  for (let index = 0; index < 20; index += 1) audio.playEffect('move');
  assert.ok(audio.debugState().activeEffectVoices <= 1);
  for (const name of [
    'rotate', 'placement', 'dispatch', 'tide-warning', 'tide-shift',
    'invalid', 'completion', 'terminal',
  ]) audio.playEffect(name);
  assert.ok(audio.debugState().activeEffectVoices <= 8);
  await audio.dispose();
});

test('ended scheduled voices leave source and effect tracking', async () => {
  const context = new FakeAudioContext();
  const audio = createGameAudio({
    audioContextFactory: () => context, preferences, monotonicNow: () => 10,
  });
  await audio.start({ arrangement: 'stack' });
  audio.playEffect('move');
  assert.ok(audio.debugState().activeSources > 0);
  for (const oscillator of context.oscillators) oscillator.onended?.();
  assert.equal(audio.debugState().activeSources, 0);
  assert.equal(audio.debugState().activeEffectVoices, 0);
  await audio.dispose();
});

test('finish preserves one cadence, then fades and self-disposes without leaks', async () => {
  const clock = fakeClock();
  const context = new FakeAudioContext();
  const audio = createGameAudio({
    audioContextFactory: () => context, preferences,
    setTimeoutFn: clock.setTimeout, clearTimeoutFn: clock.clearTimeout,
  });
  await audio.start({ arrangement: 'yard' });
  audio.finish({ outcome: 'completion' });
  const sourcesAfterFirstFinish = context.oscillators.length;
  audio.finish({ outcome: 'terminal' });
  assert.equal(context.oscillators.length, sourcesAfterFirstFinish);
  assert.equal(audio.debugState().disposed, false);
  assert.ok(audio.debugState().activeSources > 0);
  clock.advance(999);
  assert.equal(audio.debugState().disposed, false);
  clock.advance(1);
  await Promise.resolve();
  assert.equal(audio.debugState().disposed, true);
  assert.equal(audio.debugState().activeSources, 0);
  assert.equal(clock.size(), 0);
});

test('pause during terminal fade preserves exactly-once self-disposal', async () => {
  const clock = fakeClock();
  const context = new FakeAudioContext();
  const audio = createGameAudio({
    audioContextFactory: () => context, preferences,
    setTimeoutFn: clock.setTimeout, clearTimeoutFn: clock.clearTimeout,
  });
  await audio.start({ arrangement: 'stack' });
  assert.equal(audio.finish({ outcome: 'terminal' }), true);
  await audio.pause();
  assert.equal(clock.size(), 1, 'pause must retain terminal disposal timer');
  clock.advance(1000);
  await Promise.resolve();
  assert.equal(audio.debugState().disposed, true);
  assert.equal(audio.debugState().activeSources, 0);
  assert.equal(context.state, 'closed');
  assert.equal(context.closeCount, 1);
  await audio.dispose();
  assert.equal(context.closeCount, 1);
});

test('audio failure is silent and notices at most once', async () => {
  const notices = [];
  const audio = createGameAudio({
    audioContextFactory: () => { throw new Error('denied'); }, preferences,
    onNotice: (message) => notices.push(message),
  });
  await assert.doesNotReject(audio.start({ arrangement: 'yard' }));
  assert.doesNotThrow(() => audio.playEffect('placement'));
  assert.doesNotThrow(() => audio.setIntensity({ height: 1, tidePressure: 1 }));
  assert.equal(notices.length, 1);
});

test('puzzle effect names schedule without throwing under the fake context', async () => {
  const context = new FakeAudioContext();
  const audio = createGameAudio({
    audioContextFactory: () => context, preferences, monotonicNow: () => 10,
    setIntervalFn: () => 1, clearIntervalFn: () => {},
  });
  try {
    await audio.start({ arrangement: 'stack' });
    for (const name of ['puzzle-place', 'puzzle-found', 'puzzle-error']) {
      assert.doesNotThrow(() => audio.playEffect(name));
    }
    assert.ok(audio.debugState().activeEffectVoices > 0, 'puzzle effects schedule audible voices');
  } finally {
    await audio.dispose();
  }
});

test('createAudioControls({ channels: ["effects"] }) renders only the effects row', () => {
  const fixture = createDOMFixture();
  const controls = createAudioControls({
    document: fixture.document,
    channels: ['effects'],
    preferences: {
      musicEnabled: true, musicVolume: 0.35,
      effectsEnabled: true, effectsVolume: 0.50,
    },
  });
  fixture.root.append(controls.element);
  assert.equal(fixture.root.querySelectorAll('[data-audio-music-volume]').length, 0,
    'the music row is omitted when channels excludes it');
  assert.equal(fixture.root.querySelectorAll('[data-audio-music-toggle]').length, 0);
  assert.equal(fixture.root.querySelectorAll('[data-audio-effects-volume]').length, 1);
  assert.equal(fixture.root.querySelectorAll('[data-audio-effects-toggle]').length, 1);
});

test('createAudioControls without channels keeps rendering both rows (existing callers unaffected)', () => {
  const fixture = createDOMFixture();
  const controls = createAudioControls({
    document: fixture.document,
    preferences: {
      musicEnabled: true, musicVolume: 0.35,
      effectsEnabled: true, effectsVolume: 0.50,
    },
  });
  fixture.root.append(controls.element);
  assert.equal(fixture.root.querySelectorAll('[data-audio-music-volume]').length, 1);
  assert.equal(fixture.root.querySelectorAll('[data-audio-effects-volume]').length, 1);
});

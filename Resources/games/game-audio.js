export const KINNOKI_MOTIF = Object.freeze([0, 7, 11, 14, 9, 16]);

const ARRANGEMENTS = Object.freeze({
  yard: { tempo: 76, rootMidi: 45, waveform: 'sine' },
  stack: { tempo: 118, rootMidi: 50, waveform: 'triangle' },
});

const EFFECT_RATE_MS = Object.freeze({
  move: 50, rotate: 70, placement: 90, dispatch: 120,
  'tide-warning': 250, 'tide-shift': 180, invalid: 180,
  completion: 300, terminal: 300,
});

const clampVolume = (value, fallback) => Number.isFinite(value)
  ? Math.min(1, Math.max(0, value)) : fallback;
const midiHz = (midi) => 440 * (2 ** ((midi - 69) / 12));

export function createGameAudio({
  audioContextFactory = () => {
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Context) throw new Error('Web Audio unavailable');
    return new Context();
  },
  preferences: initialPreferences,
  onNotice = () => {},
  monotonicNow = () => globalThis.performance?.now?.() ?? Date.now(),
  setIntervalFn = globalThis.setInterval.bind(globalThis),
  clearIntervalFn = globalThis.clearInterval.bind(globalThis),
  setTimeoutFn = globalThis.setTimeout.bind(globalThis),
  clearTimeoutFn = globalThis.clearTimeout.bind(globalThis),
} = {}) {
  let preferences = {
    musicEnabled: initialPreferences?.musicEnabled !== false,
    musicVolume: clampVolume(initialPreferences?.musicVolume, 0.35),
    effectsEnabled: initialPreferences?.effectsEnabled !== false,
    effectsVolume: clampVolume(initialPreferences?.effectsVolume, 0.50),
  };
  let context = null;
  let arrangement = null;
  let musicMaster = null;
  let effectsMaster = null;
  let scheduler = null;
  let finishTimer = null;
  let started = false;
  let disposed = false;
  let silent = false;
  let noticeShown = false;
  let finishing = false;
  let nextNoteIndex = 0;
  let nextNoteTime = 0;
  let intensity = { height: 0, tidePressure: 0 };
  let layerGains = { bass: 0, harmony: 0, percussion: 0 };
  const sources = new Set();
  const musicVoices = new Set();
  const effectVoices = [];
  const timeouts = new Set();
  const lastEffectAt = new Map();

  const silence = () => {
    silent = true;
    if (!noticeShown) {
      noticeShown = true;
      onNotice('Audio is unavailable; play continues in silence.');
    }
  };
  const clearScheduler = () => {
    if (scheduler !== null) clearIntervalFn(scheduler);
    scheduler = null;
  };
  const trackTimeout = (callback, delay) => {
    const handle = setTimeoutFn(() => {
      timeouts.delete(handle);
      callback();
    }, delay);
    timeouts.add(handle);
    return handle;
  };
  const scheduleTone = ({
    frequency, at, duration, destination, waveform = 'sine', amplitude = 0.12,
    channel = 'effect',
  }) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const voice = { oscillator, gain };
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(amplitude, at + 0.01);
    gain.gain.linearRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain).connect(destination);
    oscillator.onended = () => {
      sources.delete(oscillator);
      musicVoices.delete(voice);
      const effectIndex = effectVoices.indexOf(voice);
      if (effectIndex >= 0) effectVoices.splice(effectIndex, 1);
      try { oscillator.disconnect(); gain.disconnect(); } catch { /* already disconnected */ }
    };
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
    sources.add(oscillator);
    if (channel === 'music') musicVoices.add(voice);
    return voice;
  };
  const scheduleMusic = () => {
    if (!context || silent || disposed || !arrangement) return;
    const config = ARRANGEMENTS[arrangement];
    const beat = 60 / config.tempo;
    while (nextNoteTime < context.currentTime + 0.25) {
      const interval = KINNOKI_MOTIF[nextNoteIndex % KINNOKI_MOTIF.length];
      scheduleTone({
        frequency: midiHz(config.rootMidi + interval), at: nextNoteTime,
        duration: beat * 0.8, destination: musicMaster, waveform: config.waveform,
        channel: 'music',
      });
      if (arrangement === 'yard') {
        scheduleTone({
          frequency: midiHz(config.rootMidi - 5), at: nextNoteTime,
          duration: beat * 1.8, destination: musicMaster,
          waveform: 'sine', amplitude: 0.035, channel: 'music',
        });
      } else {
        if (layerGains.bass > 0) scheduleTone({
          frequency: midiHz(config.rootMidi - 12), at: nextNoteTime,
          duration: beat * 0.9, destination: musicMaster,
          waveform: 'triangle', amplitude: layerGains.bass, channel: 'music',
        });
        if (layerGains.harmony > 0) scheduleTone({
          frequency: midiHz(config.rootMidi + interval + 7), at: nextNoteTime,
          duration: beat * 0.7, destination: musicMaster,
          waveform: 'sine', amplitude: layerGains.harmony, channel: 'music',
        });
        if (layerGains.percussion > 0) scheduleTone({
          frequency: midiHz(config.rootMidi - 24), at: nextNoteTime,
          duration: 0.045, destination: musicMaster,
          waveform: 'square', amplitude: layerGains.percussion, channel: 'music',
        });
      }
      nextNoteIndex += 1;
      nextNoteTime += beat;
    }
  };
  const beginScheduler = () => {
    clearScheduler();
    scheduleMusic();
    scheduler = setIntervalFn(scheduleMusic, 100);
  };

  const start = async ({ arrangement: requested }) => {
    if (disposed || started) return;
    try {
      const config = ARRANGEMENTS[requested];
      if (!config) throw new TypeError('Unknown game-audio arrangement');
      context = audioContextFactory();
      musicMaster = context.createGain();
      effectsMaster = context.createGain();
      musicMaster.connect(context.destination);
      effectsMaster.connect(context.destination);
      arrangement = requested;
      started = true;
      musicMaster.gain.value = preferences.musicEnabled ? preferences.musicVolume : 0;
      effectsMaster.gain.value = preferences.effectsEnabled ? preferences.effectsVolume : 0;
      await context.resume();
      nextNoteTime = context.currentTime + 0.05;
      beginScheduler();
    } catch { silence(); }
  };
  const setPreferences = (value) => {
    preferences = {
      musicEnabled: typeof value?.musicEnabled === 'boolean'
        ? value.musicEnabled : preferences.musicEnabled,
      musicVolume: clampVolume(value?.musicVolume, preferences.musicVolume),
      effectsEnabled: typeof value?.effectsEnabled === 'boolean'
        ? value.effectsEnabled : preferences.effectsEnabled,
      effectsVolume: clampVolume(value?.effectsVolume, preferences.effectsVolume),
    };
    if (musicMaster) {
      musicMaster.gain.value = preferences.musicEnabled ? preferences.musicVolume : 0;
    }
    if (effectsMaster) {
      effectsMaster.gain.value = preferences.effectsEnabled ? preferences.effectsVolume : 0;
    }
  };
  const setIntensity = (value) => {
    intensity = {
      height: clampVolume(value?.height, 0),
      tidePressure: clampVolume(value?.tidePressure, 0),
    };
    const pressure = Math.max(intensity.height, intensity.tidePressure);
    layerGains = {
      bass: pressure >= 0.34 ? 0.18 : 0,
      harmony: pressure >= 0.58 ? 0.14 : 0,
      percussion: pressure >= 0.78 ? 0.10 : 0,
    };
  };
  const scheduleEffect = (name, bypassRateLimit = false) => {
    if (!context || silent || disposed || !preferences.effectsEnabled) return false;
    const now = monotonicNow();
    if (!bypassRateLimit
        && now - (lastEffectAt.get(name) ?? -Infinity) < EFFECT_RATE_MS[name]) return false;
    lastEffectAt.set(name, now);
    while (effectVoices.length >= 8) {
      const oldest = effectVoices.shift();
      try {
        oldest.oscillator.stop(context.currentTime);
        oldest.oscillator.disconnect();
      } catch { /* already stopped */ }
      sources.delete(oldest.oscillator);
    }
    const semitone = {
      move: 0, rotate: 3, placement: -5, dispatch: 12,
      'tide-warning': -2, 'tide-shift': -7, invalid: -12,
      completion: 16, terminal: -16,
    }[name];
    if (semitone === undefined) return false;
    const voice = scheduleTone({
      frequency: midiHz(60 + semitone), at: context.currentTime,
      duration: name === 'completion' ? 0.65 : 0.18,
      destination: effectsMaster,
      waveform: name === 'terminal' ? 'sawtooth' : 'sine',
    });
    effectVoices.push(voice);
    return true;
  };
  const playEffect = (name) => {
    try { return scheduleEffect(name, false); } catch { silence(); return false; }
  };
  const cancelFinish = () => {
    if (finishTimer !== null) clearTimeoutFn(finishTimer);
    timeouts.delete(finishTimer);
    finishTimer = null;
  };
  const stopSources = () => {
    for (const source of sources) {
      try { source.stop(context?.currentTime ?? 0); source.disconnect(); }
      catch { /* already stopped */ }
    }
    sources.clear();
    musicVoices.clear();
    effectVoices.length = 0;
  };
  const stopMusic = () => {
    for (const voice of musicVoices) {
      try {
        voice.oscillator.stop(context?.currentTime ?? 0);
        voice.oscillator.disconnect();
        voice.gain.disconnect();
      } catch { /* already stopped */ }
      sources.delete(voice.oscillator);
    }
    musicVoices.clear();
  };
  const pause = async () => {
    if (finishing || disposed) return;
    clearScheduler();
    stopMusic();
    try { await context?.suspend?.(); } catch { silence(); }
  };
  const resume = async () => {
    if (!context || disposed || silent || finishing) return;
    try {
      await context.resume();
      nextNoteTime = context.currentTime + 0.05;
      clearScheduler();
      scheduler = setIntervalFn(scheduleMusic, 100);
    } catch { silence(); }
  };
  const stop = () => {
    cancelFinish();
    clearScheduler();
    for (const handle of timeouts) clearTimeoutFn(handle);
    timeouts.clear();
    stopSources();
  };
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    stop();
    try {
      musicMaster?.disconnect();
      effectsMaster?.disconnect();
      await context?.close?.();
    } catch { silence(); }
  };
  const finish = ({ outcome }) => {
    if (finishing || disposed) return false;
    finishing = true;
    clearScheduler();
    try {
      scheduleEffect(outcome === 'completion' ? 'completion' : 'terminal', true);
      const now = context?.currentTime ?? 0;
      for (const master of [musicMaster, effectsMaster]) {
        master?.gain.cancelScheduledValues(now);
        master?.gain.setValueAtTime(master.gain.value, now);
        master?.gain.linearRampToValueAtTime(0, now + 0.9);
      }
      finishTimer = trackTimeout(() => {
        finishTimer = null;
        void dispose();
      }, 1000);
    } catch { silence(); void dispose(); }
    return true;
  };
  const debugState = () => Object.freeze({
    started, arrangement,
    tempo: arrangement ? ARRANGEMENTS[arrangement].tempo : null,
    contextState: context?.state ?? null,
    schedulerActive: scheduler !== null,
    activeSources: sources.size,
    activeMusicVoices: musicVoices.size,
    activeEffectVoices: effectVoices.length,
    musicGain: musicMaster?.gain.value ?? 0,
    effectsGain: effectsMaster?.gain.value ?? 0,
    layerGains: { ...layerGains }, intensity: { ...intensity }, nextNoteIndex,
    nextNoteTime, noticeShown, disposed,
  });
  return {
    start, resume, pause, stop, dispose, finish, setPreferences,
    setIntensity, playEffect, debugState,
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const playerSource = readFileSync(
  new URL('../../Resources/listen/listen.js', import.meta.url),
  'utf8',
);

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(value) {
    this.values.add(value);
  }

  remove(value) {
    this.values.delete(value);
  }

  toggle(value, force) {
    if (force === undefined) {
      if (this.values.has(value)) this.values.delete(value);
      else this.values.add(value);
      return;
    }
    if (force) this.values.add(value);
    else this.values.delete(value);
  }
}

class FakeNode {
  constructor() {
    this._textContent = '';
    this.attributes = new Map();
    this.children = [];
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.style = {
      display: '',
      setProperty() {},
    };
    this.hidden = false;
    this.disabled = false;
    this.value = '';
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  get firstChild() {
    return this.children[0] || null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) listener({ type, target: this });
  }

  click() {
    this.dispatch('click');
  }

  closest() {
    return null;
  }
}

async function bootPlayer(savedRate) {
  const ids = [
    'cover', 'bookTitle', 'bookSubtitle', 'bookByline', 'chapterCount', 'chapterList',
    'chapterNow', 'captionPanel', 'captionWords', 'captionText', 'status', 'playPause',
    'iconPlay', 'iconPause', 'back30', 'fwd30', 'speed', 'scrubber', 'timeNow',
    'timeTotal', 'library', 'honesty',
  ];
  const elements = new Map(ids.map((id) => [id, new FakeNode()]));
  const main = new FakeNode();
  const room = new FakeNode();
  const storage = new Map();
  const debugLogs = [];
  if (savedRate !== undefined) storage.set('kinnoki-listen-rate', savedRate);

  let audio;
  class FakeAudio {
    constructor() {
      audio = this;
      this.currentTime = 0;
      this.duration = 120;
      this.paused = true;
      this.playbackRate = 1;
      this.listeners = new Map();
      this.children = [];
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }

    dispatch(type) {
      for (const listener of this.listeners.get(type) || []) listener({ type, target: this });
    }

    load() {
      // Browsers reset the effective playback rate while loading a new source.
      this.playbackRate = 1;
      this.dispatch('loadedmetadata');
    }

    play() {
      this.paused = false;
      this.dispatch('play');
      return Promise.resolve();
    }

    pause() {
      this.paused = true;
      this.dispatch('pause');
    }
  }

  const catalog = {
    books: [{
      slug: 'test-book',
      title: 'Test Book',
      subtitle: '',
      curator: 'Test Curator',
      writtenBy: 'Test Writer',
      cover: '/cover.jpg',
      durationSeconds: 120,
      chapters: [{ title: 'Chapter One', start: 0 }],
      audio: { status: 'available', url: 'https://example.test/book.m4b', mimeType: 'audio/mp4' },
      links: { epub: '/book.epub', read: 'https://example.test/book.md' },
    }],
  };

  const window = {
    EchoListenCore: { libraryActions: () => [] },
    addEventListener() {},
  };
  const document = {
    title: '',
    getElementById: (id) => elements.get(id),
    querySelector: (selector) => (selector === '.room-main' ? main : room),
    createElement: () => new FakeNode(),
    createTextNode: (text) => {
      const node = new FakeNode();
      node.textContent = text;
      return node;
    },
    addEventListener() {},
  };

  runInNewContext(playerSource, {
    Audio: FakeAudio,
    URL,
    URLSearchParams,
    console: { debug: (...args) => debugLogs.push(args.join(' ')) },
    document,
    fetch: async () => ({ ok: true, json: async () => catalog }),
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    location: { href: 'https://kinnokilabs.com/listen/', search: '?book=test-book' },
    navigator: {},
    requestAnimationFrame: (callback) => callback(),
    window,
  }, { filename: 'Resources/listen/listen.js' });

  await new Promise((resolve) => setImmediate(resolve));

  return {
    audio,
    debugLogs,
    speedButton: elements.get('speed'),
    storage,
  };
}

function speedState(player) {
  return {
    actualRate: player.audio.playbackRate,
    buttonText: player.speedButton.textContent,
    ariaLabel: player.speedButton.getAttribute('aria-label'),
    storedRate: player.storage.get('kinnoki-listen-rate'),
  };
}

test('saved playback rate survives metadata loading and the next click wraps from 1.5x to 1x', async () => {
  const player = await bootPlayer('1.5');

  assert.deepEqual(speedState(player), {
    actualRate: 1.5,
    buttonText: '1.5×',
    ariaLabel: 'Playback speed, currently 1.5×',
    storedRate: '1.5',
  });

  player.audio.playbackRate = 1;
  player.audio.dispatch('loadedmetadata');
  assert.equal(player.audio.playbackRate, 1.5);

  player.speedButton.click();
  assert.deepEqual(speedState(player), {
    actualRate: 1,
    buttonText: '1×',
    ariaLabel: 'Playback speed, currently 1×',
    storedRate: '1',
  });
  assert.deepEqual(player.debugLogs, []);
});

test('fresh playback starts at 1x and keeps the existing speed cycle', async () => {
  const player = await bootPlayer();

  assert.equal(player.audio.playbackRate, 1);
  for (const expectedRate of [1.25, 1.5, 1]) {
    player.speedButton.click();
    assert.equal(player.audio.playbackRate, expectedRate);
    assert.equal(player.storage.get('kinnoki-listen-rate'), String(expectedRate));
  }
});

test('unsupported persisted playback rates normalize to 1x', async () => {
  const player = await bootPlayer('2');

  assert.deepEqual(speedState(player), {
    actualRate: 1,
    buttonText: '1×',
    ariaLabel: 'Playback speed, currently 1×',
    storedRate: '1',
  });
});

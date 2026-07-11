import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const core = require('../../Resources/listen/listen-core.js');
const listenRoot = new URL('../../Resources/listen/', import.meta.url);
const playerSource = readFileSync(new URL('listen.js', listenRoot), 'utf8');
const playerTemplate = readFileSync(new URL('index.html', listenRoot), 'utf8');
const publishedCatalog = JSON.parse(readFileSync(new URL('books.json', listenRoot), 'utf8'));
const emptyMessage = 'No book is streaming right now — the library below has the EPUBs, free.';
const audioErrorMessage = 'The audio stream couldn’t load. It streams from the public library on GitHub — reload to retry, or grab the EPUB below.';

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
    const enabled = force === undefined ? !this.values.has(value) : force;
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    return enabled;
  }
}

class FakeNode {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this._textContent = '';
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.style = { display: '', setProperty() {} };
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.href = '';
    this.target = '';
    this.rel = '';
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
    child.parentNode = this;
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

  closest() {
    return null;
  }
}

function isVisible(node) {
  for (let current = node; current; current = current.parentNode) {
    if (current.hidden) return false;
  }
  return true;
}

function descendants(node, predicate) {
  const matches = [];
  for (const child of node.children) {
    if (predicate(child)) matches.push(child);
    matches.push(...descendants(child, predicate));
  }
  return matches;
}

function cloneCatalog(transform = (book) => book) {
  const catalog = structuredClone(publishedCatalog);
  catalog.books = catalog.books.map(transform);
  return catalog;
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

async function bootPlayer({ catalog = cloneCatalog(), catalogFailure = false } = {}) {
  const ids = [
    'cover', 'bookTitle', 'bookSubtitle', 'bookByline', 'chapterCount', 'chapterList',
    'chapterNow', 'captionPanel', 'captionWords', 'captionText', 'status', 'emptyState',
    'selectedFormats', 'playPause', 'iconPlay', 'iconPause', 'back30', 'fwd30',
    'speed', 'scrubber', 'timeNow', 'timeTotal', 'library', 'honesty',
  ];
  const elements = new Map(ids.map((id) => [id, new FakeNode()]));
  elements.get('playPause').disabled = true;
  elements.get('scrubber').disabled = true;
  elements.get('emptyState').hidden = true;
  elements.get('selectedFormats').hidden = true;

  const main = new FakeNode('main');
  const room = new FakeNode('section');
  main.appendChild(room);
  room.appendChild(elements.get('status'));
  room.appendChild(elements.get('selectedFormats'));
  main.appendChild(elements.get('emptyState'));
  main.appendChild(elements.get('library'));
  main.appendChild(elements.get('honesty'));

  let audio;
  class FakeAudio {
    constructor() {
      audio = this;
      this.currentTime = 0;
      this.duration = 11140;
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

    load() {}

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

  const document = {
    title: '',
    getElementById: (id) => elements.get(id),
    querySelector: (selector) => (selector === '.room-main' ? main : room),
    createElement: (tagName) => new FakeNode(tagName),
    createTextNode: (text) => {
      const node = new FakeNode('#text');
      node.textContent = text;
      return node;
    },
    addEventListener() {},
  };
  const debugLogs = [];

  runInNewContext(playerSource, {
    Audio: FakeAudio,
    URL,
    URLSearchParams,
    console: { debug: (...args) => debugLogs.push(args.join(' ')) },
    document,
    fetch: async (input) => {
      if (input === 'books.json') {
        if (catalogFailure) return { ok: false, status: 503 };
        return { ok: true, json: async () => catalog };
      }
      if (String(input).endsWith('blocks.json')) {
        return { ok: true, json: async () => ({ blocks: [] }) };
      }
      return { ok: true, json: async () => [] };
    },
    localStorage: { getItem: () => null, setItem() {} },
    location: { href: 'https://kinnokilabs.com/listen/', search: '?book=chicken-predators' },
    navigator: {},
    requestAnimationFrame: (callback) => callback(),
    window: { EchoListenCore: core, addEventListener() {} },
  }, { filename: 'Resources/listen/listen.js' });

  await settle();
  return { audio, debugLogs, elements, main, room };
}

function selectedFallbacks(player) {
  return descendants(player.elements.get('selectedFormats'), (node) => node.tagName === 'A');
}

function assertChickenFallbacks(player) {
  const chicken = publishedCatalog.books.find((book) => book.slug === 'chicken-predators');
  const links = selectedFallbacks(player);
  assert.equal(player.elements.get('selectedFormats').hidden, false);
  assert.equal(links.length, 2);
  assert.deepEqual(links.map((link) => link.textContent), ['EPUB', 'Read']);
  assert.equal(links[0].href, chicken.links.epub);
  assert.equal(links[0].target, '');
  assert.equal(links[0].rel, '');
  assert.equal(links[1].href, chicken.links.read);
  assert.equal(links[1].target, '_blank');
  assert.equal(links[1].rel, 'noopener');
}

test('the template keeps the empty state outside the player and selected formats inside it', () => {
  const roomStart = playerTemplate.indexOf('<section class="room"');
  const roomEnd = playerTemplate.indexOf('</section>', roomStart);
  const selectedFormats = playerTemplate.indexOf('id="selectedFormats"');
  const emptyState = playerTemplate.indexOf('id="emptyState"');

  assert.ok(roomStart >= 0 && roomEnd > roomStart);
  assert.ok(selectedFormats > roomStart && selectedFormats < roomEnd);
  assert.ok(emptyState > roomEnd);
  assert.match(playerTemplate, /id="selectedFormats"[^>]+aria-label="Other formats for this book"[^>]+hidden/);
  assert.match(playerTemplate, /id="emptyState"[^>]+role="status"[^>]+aria-live="polite"[^>]+hidden/);
});

test('an all-text catalog hides the player but shows one honest streaming status and all formats', async () => {
  const catalog = cloneCatalog((book) => ({ ...book, audio: { status: 'none' } }));
  const player = await bootPlayer({ catalog });
  const emptyState = player.elements.get('emptyState');
  const library = player.elements.get('library');
  const libraryLinks = descendants(library, (node) => node.tagName === 'A');

  assert.equal(player.room.hidden, true);
  assert.equal(isVisible(emptyState), true);
  assert.equal(emptyState.textContent, emptyMessage);
  assert.equal(isVisible(player.elements.get('status')), false);
  assert.equal(library.children.length, 11);
  assert.equal(libraryLinks.filter((link) => link.textContent === 'Listen').length, 0);
});

test('the selected playable book stays off the secondary list but keeps its EPUB and Read fallbacks', async () => {
  const player = await bootPlayer();
  const library = player.elements.get('library');
  const libraryTitles = library.children.map((item) => item.children[0].textContent);

  assert.equal(player.room.hidden, false);
  assert.equal(player.elements.get('emptyState').hidden, true);
  assert.equal(library.children.length, 10);
  assert.ok(!libraryTitles.includes('Chicken Predators'));
  assertChickenFallbacks(player);
});

test('an audio source error disables play without removing the selected book fallbacks', async () => {
  const player = await bootPlayer();
  const source = player.audio.children[0];
  assert.ok(source, 'selected playable book creates an audio source');

  source.dispatch('error');

  assert.equal(player.elements.get('playPause').disabled, true);
  assert.equal(player.elements.get('status').textContent, audioErrorMessage);
  assert.ok(player.elements.get('status').classList.values.has('error'));
  assertChickenFallbacks(player);
});

test('a catalog failure keeps its explicit visible retry status and no empty-state duplicate', async () => {
  const player = await bootPlayer({ catalogFailure: true });

  assert.equal(player.room.hidden, false);
  assert.equal(isVisible(player.elements.get('status')), true);
  assert.equal(player.elements.get('status').textContent, 'The book catalog couldn’t load. Reload to retry.');
  assert.equal(player.elements.get('emptyState').hidden, true);
  assert.equal(player.elements.get('selectedFormats').hidden, true);
});

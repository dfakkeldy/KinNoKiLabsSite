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
const playerStyles = readFileSync(new URL('listen.css', listenRoot), 'utf8');
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

  get className() {
    return [...this.classList.values].join(' ');
  }

  set className(value) {
    this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean));
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

async function bootPlayer({
  catalog = cloneCatalog(), catalogFailure = false, mediaSession = false,
  blocks = [], anchors = [], trackImages = false, search = '?book=chicken-predators',
} = {}) {
  const ids = [
    'cover', 'bookTitle', 'bookSubtitle', 'bookByline', 'chapterCount', 'chapterList',
    'chapterNow', 'captionPanel', 'captionWords', 'captionText', 'status', 'emptyState',
    'selectedFormats', 'playPause', 'iconPlay', 'iconPause', 'back30', 'fwd30',
    'speed', 'scrubber', 'timeNow', 'timeTotal', 'library', 'honesty',
    'figurePanel', 'figureImg', 'figureCaption',
    'bookSeries', 'seriesProgress', 'seriesPrevious', 'seriesNext', 'editionStatus',
    'seriesShelves', 'seriesLibrary', 'moreBooksShelf',
  ];
  const elements = new Map(ids.map((id) => [id, new FakeNode(id === 'figureImg' ? 'img' : 'div')]));
  elements.get('playPause').disabled = true;
  elements.get('scrubber').disabled = true;
  elements.get('emptyState').hidden = true;
  elements.get('selectedFormats').hidden = true;
  elements.get('figurePanel').hidden = true;
  elements.get('figureCaption').hidden = true;
  for (const id of ['bookSeries', 'seriesProgress', 'seriesPrevious', 'seriesNext', 'editionStatus', 'seriesShelves']) {
    elements.get(id).hidden = true;
  }

  const main = new FakeNode('main');
  const room = new FakeNode('section');
  const cta = new FakeNode('section');
  main.appendChild(room);
  room.appendChild(elements.get('bookSeries'));
  room.appendChild(elements.get('seriesProgress'));
  const seriesNavigation = new FakeNode('nav');
  seriesNavigation.hidden = true;
  seriesNavigation.appendChild(elements.get('seriesPrevious'));
  seriesNavigation.appendChild(elements.get('seriesNext'));
  room.appendChild(seriesNavigation);
  room.appendChild(elements.get('editionStatus'));
  const figurePanel = elements.get('figurePanel');
  figurePanel.appendChild(elements.get('figureImg'));
  figurePanel.appendChild(elements.get('figureCaption'));
  room.appendChild(figurePanel);
  room.appendChild(elements.get('status'));
  room.appendChild(elements.get('selectedFormats'));
  main.appendChild(elements.get('emptyState'));
  main.appendChild(cta);
  elements.get('seriesShelves').appendChild(elements.get('seriesLibrary'));
  main.appendChild(elements.get('seriesShelves'));
  elements.get('moreBooksShelf').appendChild(elements.get('library'));
  main.appendChild(elements.get('moreBooksShelf'));
  main.appendChild(elements.get('honesty'));

  const preloadedImages = [];
  class FakeImage {
    constructor() {
      this.src = '';
      preloadedImages.push(this);
    }
  }

  let audio;
  class FakeAudio {
    constructor() {
      audio = this;
      this.currentTime = 0;
      this.duration = 11140;
      this.paused = true;
      this.playbackRate = 1;
      this.playCalls = 0;
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
      this.playCalls += 1;
      this.paused = false;
      this.dispatch('play');
      return Promise.resolve();
    }

    pause() {
      this.paused = true;
      this.dispatch('pause');
    }
  }

  const documentListeners = new Map();
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
    addEventListener(type, listener) {
      const listeners = documentListeners.get(type) || [];
      listeners.push(listener);
      documentListeners.set(type, listeners);
    },
  };
  const debugLogs = [];
  const mediaSessionHandlers = new Map();
  const navigator = mediaSession ? {
    mediaSession: {
      playbackState: 'none',
      setActionHandler(action, handler) {
        mediaSessionHandlers.set(action, handler);
      },
      setPositionState() {},
    },
  } : {};

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
        return { ok: true, json: async () => ({ blocks }) };
      }
      return { ok: true, json: async () => anchors };
    },
    localStorage: { getItem: () => null, setItem() {} },
    location: { href: 'https://kinnokilabs.com/listen/', search },
    MediaMetadata: class MediaMetadata {
      constructor(value) {
        Object.assign(this, value);
      }
    },
    navigator,
    requestAnimationFrame: (callback) => callback(),
    window: { EchoListenCore: core, addEventListener() {} },
    ...(trackImages ? { Image: FakeImage } : {}),
  }, { filename: 'Resources/listen/listen.js' });

  await settle();
  return {
    audio,
    cta,
    debugLogs,
    elements,
    main,
    mediaSessionHandlers,
    mediaSessionMetadata: () => navigator.mediaSession?.metadata,
    preloadedImages,
    room,
    seek(t) {
      audio.currentTime = t;
      audio.dispatch('timeupdate');
    },
    dispatchKeydown(overrides = {}) {
      const event = {
        key: ' ',
        defaultPrevented: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        target: new FakeNode('body'),
        preventDefault() {
          this.defaultPrevented = true;
        },
        ...overrides,
      };
      for (const listener of documentListeners.get('keydown') || []) listener(event);
      return event;
    },
  };
}

function cssDeclarations(selector) {
  const start = playerStyles.indexOf(selector + ' {');
  assert.ok(start >= 0, `${selector} CSS rule exists`);
  const declarationsStart = playerStyles.indexOf('{', start) + 1;
  const end = playerStyles.indexOf('}', declarationsStart);
  return playerStyles.slice(declarationsStart, end);
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
  const cta = playerTemplate.indexOf('class="room-cta', roomEnd);

  assert.ok(roomStart >= 0 && roomEnd > roomStart);
  assert.ok(selectedFormats > roomStart && selectedFormats < roomEnd);
  assert.ok(emptyState > roomEnd);
  assert.ok(cta > roomEnd);
  assert.match(playerTemplate, /id="selectedFormats"[^>]+aria-label="Other formats for this book"[^>]+hidden/);
  assert.match(playerTemplate, /id="emptyState"[^>]+role="status"[^>]+aria-live="polite"[^>]+hidden/);
});

test('the template exposes semantic series metadata, adjacent links, and complete library shelves', () => {
  const title = playerTemplate.indexOf('id="bookTitle"');
  const series = playerTemplate.indexOf('id="bookSeries"');
  const progress = playerTemplate.indexOf('id="seriesProgress"');
  const previous = playerTemplate.indexOf('id="seriesPrevious"');
  const next = playerTemplate.indexOf('id="seriesNext"');
  const edition = playerTemplate.indexOf('id="editionStatus"');

  assert.ok(series >= 0 && series < title);
  assert.ok(progress > series && progress < title);
  assert.ok(previous > progress && previous < title);
  assert.ok(next > previous && next < title);
  assert.ok(edition > next && edition < title);
  assert.match(playerTemplate, /<p id="bookSeries" class="book-series" hidden><\/p>/);
  assert.match(playerTemplate, /<p id="seriesProgress" class="series-progress" hidden><\/p>/);
  assert.match(playerTemplate, /<nav class="series-navigation" aria-label="Published volumes in this series" hidden>/);
  assert.match(playerTemplate, /<a id="seriesPrevious" class="series-link" hidden><\/a>/);
  assert.match(playerTemplate, /<a id="seriesNext" class="series-link" hidden><\/a>/);
  assert.match(playerTemplate, /<p id="editionStatus" class="edition-status" hidden><\/p>/);

  const seriesShelves = playerTemplate.indexOf('id="seriesShelves"');
  const seriesLibrary = playerTemplate.indexOf('id="seriesLibrary"');
  const moreBooks = playerTemplate.indexOf('id="moreBooksShelf"');
  const library = playerTemplate.indexOf('id="library"');
  assert.ok(seriesShelves > title && seriesLibrary > seriesShelves);
  assert.ok(moreBooks > seriesLibrary && library > moreBooks);
  assert.match(playerTemplate, /<section id="seriesShelves" class="room-library" aria-labelledby="seriesLibraryTitle" hidden>/);
  assert.match(playerTemplate, /<h2 id="seriesLibraryTitle">Series<\/h2>/);
  assert.match(playerTemplate, /<section id="moreBooksShelf" class="room-library" aria-labelledby="moreBooksTitle">/);
  assert.match(playerTemplate, /<h2 id="moreBooksTitle">More books<\/h2>/);
});

function claudeSeriesCatalog() {
  const playableSources = publishedCatalog.books.filter((candidate) => candidate.audio.status === 'available');
  const [firstSource, secondSource, thirdSource, standaloneSource] = playableSources.slice(0, 4);
  const disclosure = 'Automated checks passed. Full human first-listen review is pending.';
  return {
    version: 2,
    series: [{
      id: 'claude-platform',
      title: 'Claude Platform Documentation',
      description: 'A mechanism-first guide to building on the Claude Platform.',
      plannedVolumeCount: 9,
      featured: true,
      volumes: [
        { number: 1, book: 'claude-platform-01-the-message' },
        { number: 2, book: 'claude-platform-02-thinking-and-reliable-responses' },
        { number: 3, book: 'claude-platform-03-giving-claude-tools' },
      ],
    }],
    books: [
      { ...firstSource, slug: 'claude-platform-01-the-message', title: 'The Message', edition: { disclosure } },
      {
        ...secondSource,
        slug: 'claude-platform-02-thinking-and-reliable-responses',
        title: 'Making Claude Think and Respond Reliably',
        edition: { disclosure },
      },
      {
        ...thirdSource,
        slug: 'claude-platform-03-giving-claude-tools',
        title: 'Giving Claude Tools',
        edition: { disclosure },
      },
      { ...standaloneSource, slug: 'standalone-book', title: 'Standalone Book' },
    ],
  };
}

function cardWithTitle(root, title) {
  return descendants(root, (node) => (
    node.tagName === 'LI' && descendants(node, (child) => (
      child.classList.values.has('room-lib-title') && child.textContent === title
    )).length === 1
  ))[0];
}

test('featured series becomes the default and exposes its volume track', async () => {
  const player = await bootPlayer({ catalog: claudeSeriesCatalog(), search: '' });

  assert.equal(player.elements.get('bookTitle').textContent, 'The Message');
  assert.equal(player.elements.get('bookSeries').hidden, false);
  assert.equal(player.elements.get('bookSeries').textContent, 'Claude Platform Documentation · Volume 1');
  assert.equal(player.elements.get('seriesProgress').hidden, false);
  assert.equal(player.elements.get('seriesProgress').textContent, '3 of 9 planned volumes available');
  assert.equal(player.elements.get('seriesPrevious').hidden, true);
  assert.equal(player.elements.get('seriesNext').hidden, false);
  assert.equal(player.elements.get('seriesNext').textContent, 'Next: Volume 2');
  assert.equal(player.elements.get('seriesNext').href, '?book=claude-platform-02-thinking-and-reliable-responses');
});

test('Volume 2 links backward to Volume 1 and forward to Volume 3', async () => {
  const catalog = claudeSeriesCatalog();
  const player = await bootPlayer({
    catalog,
    search: '?book=claude-platform-02-thinking-and-reliable-responses',
  });

  assert.equal(player.elements.get('bookTitle').textContent, 'Making Claude Think and Respond Reliably');
  assert.equal(player.elements.get('bookSeries').textContent, 'Claude Platform Documentation · Volume 2');
  assert.equal(player.elements.get('seriesPrevious').hidden, false);
  assert.equal(player.elements.get('seriesPrevious').textContent, 'Previous: Volume 1');
  assert.equal(player.elements.get('seriesPrevious').href, '?book=claude-platform-01-the-message');
  assert.equal(player.elements.get('seriesNext').hidden, false);
  assert.equal(player.elements.get('seriesNext').textContent, 'Next: Volume 3');
  assert.equal(player.elements.get('seriesNext').href, '?book=claude-platform-03-giving-claude-tools');
  assert.equal(player.elements.get('editionStatus').hidden, false);
  assert.equal(player.elements.get('editionStatus').textContent, catalog.books[1].edition.disclosure);
});

test('Volume 3 links backward to Volume 2 without a future placeholder', async () => {
  const catalog = claudeSeriesCatalog();
  const player = await bootPlayer({
    catalog,
    search: '?book=claude-platform-03-giving-claude-tools',
  });

  assert.equal(player.elements.get('bookTitle').textContent, 'Giving Claude Tools');
  assert.equal(player.elements.get('bookSeries').textContent, 'Claude Platform Documentation · Volume 3');
  assert.equal(player.elements.get('seriesPrevious').hidden, false);
  assert.equal(player.elements.get('seriesPrevious').textContent, 'Previous: Volume 2');
  assert.equal(player.elements.get('seriesPrevious').href, '?book=claude-platform-02-thinking-and-reliable-responses');
  assert.equal(player.elements.get('seriesNext').hidden, true, 'no future-volume placeholder link');
  assert.equal(player.elements.get('editionStatus').hidden, false);
  assert.equal(player.elements.get('editionStatus').textContent, catalog.books[2].edition.disclosure);
});

test('series navigation never links to an adjacent published volume without streaming audio', async () => {
  const nextUnavailable = claudeSeriesCatalog();
  nextUnavailable.books[1].audio = { status: 'none' };
  const first = await bootPlayer({
    catalog: nextUnavailable,
    search: '?book=claude-platform-01-the-message',
  });
  assert.equal(first.elements.get('seriesNext').hidden, true);
  assert.equal(first.elements.get('seriesNext').href, '');
  assert.equal(first.elements.get('seriesNext').parentNode.hidden, true);

  const previousUnavailable = claudeSeriesCatalog();
  previousUnavailable.books[0].audio = { status: 'none' };
  const second = await bootPlayer({
    catalog: previousUnavailable,
    search: '?book=claude-platform-02-thinking-and-reliable-responses',
  });
  assert.equal(second.elements.get('seriesPrevious').hidden, true);
  assert.equal(second.elements.get('seriesPrevious').href, '');
  assert.equal(second.elements.get('seriesPrevious').parentNode.hidden, false, 'Volume 3 remains a valid next link');
  assert.equal(second.elements.get('seriesNext').hidden, false);
  assert.equal(second.elements.get('seriesNext').href, '?book=claude-platform-03-giving-claude-tools');
});

test('series and standalone shelves stay structurally complete while selected cards lose redundant Listen actions', async () => {
  const catalog = claudeSeriesCatalog();
  const player = await bootPlayer({ catalog, search: '?book=claude-platform-01-the-message' });
  const seriesLibrary = player.elements.get('seriesLibrary');
  const library = player.elements.get('library');

  assert.equal(player.elements.get('seriesShelves').hidden, false);
  assert.equal(seriesLibrary.children.length, 1, 'one ordered shelf for the Claude series');
  const shelf = seriesLibrary.children[0];
  assert.match(shelf.textContent + descendants(shelf, () => true).map((node) => node.textContent).join(' '), /Claude Platform Documentation/);
  assert.match(descendants(shelf, (node) => node.classList.values.has('series-shelf-description'))[0].textContent, /mechanism-first/);
  assert.equal(descendants(shelf, (node) => node.classList.values.has('series-shelf-availability'))[0].textContent, '3 of 9 planned volumes available');
  const orderedLists = descendants(shelf, (node) => node.tagName === 'OL');
  assert.equal(orderedLists.length, 1);
  assert.equal(orderedLists[0].children.length, 3);
  assert.deepEqual(
    orderedLists[0].children.map((card) => (
      descendants(card, (node) => node.classList.values.has('room-lib-volume'))[0].textContent
    )),
    ['Volume 1', 'Volume 2', 'Volume 3'],
  );

  const selected = cardWithTitle(seriesLibrary, 'The Message');
  assert.equal(selected.getAttribute('aria-current'), 'page');
  assert.deepEqual(descendants(selected, (node) => node.tagName === 'A').map((link) => link.textContent), ['EPUB', 'Read']);
  const second = cardWithTitle(seriesLibrary, 'Making Claude Think and Respond Reliably');
  assert.deepEqual(descendants(second, (node) => node.tagName === 'A').map((link) => link.textContent), ['Listen', 'EPUB', 'Read']);
  const third = cardWithTitle(seriesLibrary, 'Giving Claude Tools');
  assert.deepEqual(descendants(third, (node) => node.tagName === 'A').map((link) => link.textContent), ['Listen', 'EPUB', 'Read']);

  assert.equal(player.elements.get('moreBooksShelf').hidden, false);
  assert.equal(library.children.length, 1);
  assert.equal(cardWithTitle(library, 'Standalone Book').getAttribute('aria-current'), null);
});

test('an active standalone remains in More books and is marked without a redundant Listen action', async () => {
  const player = await bootPlayer({ catalog: claudeSeriesCatalog(), search: '?book=standalone-book' });
  const selected = cardWithTitle(player.elements.get('library'), 'Standalone Book');

  assert.equal(selected.getAttribute('aria-current'), 'page');
  assert.deepEqual(descendants(selected, (node) => node.tagName === 'A').map((link) => link.textContent), ['EPUB', 'Read']);
  assert.equal(player.elements.get('bookSeries').hidden, true);
  assert.equal(player.elements.get('seriesProgress').hidden, true);
  assert.equal(player.elements.get('editionStatus').hidden, true);
});

test('an invalid explicit slug keeps an error while the featured default remains usable', async () => {
  const player = await bootPlayer({ catalog: claudeSeriesCatalog(), search: '?book=missing-volume' });

  assert.equal(player.elements.get('bookTitle').textContent, 'The Message');
  assert.equal(player.elements.get('status').textContent, 'The requested book isn’t available in the Listening Room.');
  assert.ok(player.elements.get('status').classList.values.has('error'));
});

test('fallback links and the primary empty state use the high-contrast theme text token', () => {
  assert.match(cssDeclarations('.room-formats a'), /color:\s*var\(--text\);/);
  const hover = cssDeclarations('.room-formats a:hover');
  assert.match(hover, /^\s*color:\s*var\(--text\);\s*$/m);
  assert.doesNotMatch(hover, /^\s*color:\s*var\(--gold-text\);\s*$/m);
  assert.match(hover, /text-decoration-color:\s*var\(--gold-text\);/);
  assert.match(hover, /text-decoration-thickness:\s*2px;/);
  assert.match(cssDeclarations('.room-empty'), /color:\s*var\(--text\);/);
  assert.match(cssDeclarations('.room-empty'), /font-size:\s*17px;/);
});

test('an all-text catalog hides the player but shows one honest streaming status and all formats', async () => {
  const catalog = cloneCatalog((book) => ({ ...book, audio: { status: 'none' } }));
  const player = await bootPlayer({ catalog });
  const emptyState = player.elements.get('emptyState');
  const library = player.elements.get('library');
  const libraryCards = allLibraryCards(player);
  const libraryLinks = libraryCards.flatMap((card) => descendants(card, (node) => node.tagName === 'A'));

  assert.equal(player.room.hidden, true);
  assert.equal(isVisible(emptyState), true);
  assert.equal(emptyState.textContent, emptyMessage);
  assert.equal(isVisible(player.elements.get('status')), false);
  assert.equal(isVisible(player.cta), true);
  assert.equal(libraryCards.length, catalog.books.length);
  assert.equal(libraryLinks.filter((link) => link.textContent === 'Listen').length, 0);
});

test('the selected playable standalone stays in the complete secondary list and keeps its fallbacks', async () => {
  const player = await bootPlayer();
  const library = player.elements.get('library');
  const selected = cardWithTitle(library, 'Chicken Predators');

  assert.equal(player.room.hidden, false);
  assert.equal(player.elements.get('emptyState').hidden, true);
  assert.equal(allLibraryCards(player).length, publishedCatalog.books.length);
  assert.equal(selected.getAttribute('aria-current'), 'page');
  assert.deepEqual(descendants(selected, (node) => node.tagName === 'A').map((link) => link.textContent), ['EPUB', 'Read']);
  assertChickenFallbacks(player);
});

test('an audio source error blocks keyboard and MediaSession play without removing fallbacks', async () => {
  const player = await bootPlayer({ mediaSession: true });
  const source = player.audio.children[0];
  assert.ok(source, 'selected playable book creates an audio source');

  source.dispatch('error');

  assert.equal(player.elements.get('playPause').disabled, true);
  assert.equal(player.elements.get('status').textContent, audioErrorMessage);
  assert.ok(player.elements.get('status').classList.values.has('error'));
  assertChickenFallbacks(player);

  const keyEvent = player.dispatchKeydown();
  assert.equal(keyEvent.defaultPrevented, true);
  assert.equal(player.audio.playCalls, 0);
  assert.equal(player.elements.get('status').textContent, audioErrorMessage);
  assert.equal(player.elements.get('playPause').disabled, true);

  player.mediaSessionHandlers.get('play')();
  assert.equal(player.audio.playCalls, 0);
  assert.equal(player.elements.get('status').textContent, audioErrorMessage);
  assert.equal(player.elements.get('playPause').disabled, true);
});

test('an enabled normal player keeps Space-bar playback', async () => {
  const player = await bootPlayer();
  player.audio.dispatch('loadedmetadata');

  assert.equal(player.elements.get('playPause').disabled, false);
  const keyEvent = player.dispatchKeydown();
  assert.equal(keyEvent.defaultPrevented, true);
  assert.equal(player.audio.playCalls, 1);
  assert.equal(player.audio.paused, false);
});

test('a catalog failure keeps its explicit visible retry status and no empty-state duplicate', async () => {
  const player = await bootPlayer({ catalogFailure: true });

  assert.equal(player.room.hidden, false);
  assert.equal(isVisible(player.elements.get('status')), true);
  assert.equal(player.elements.get('status').textContent, 'The book catalog couldn’t load. Reload to retry.');
  assert.equal(player.elements.get('emptyState').hidden, true);
  assert.equal(player.elements.get('selectedFormats').hidden, true);
});

/* ── Slideshow: figure stage ─────────────────────────────
   Synthetic figure-bearing read-along data for the selected book
   (chicken-predators). Figures fig1/fig2 carry their own sidecar anchors,
   so their display windows are explicit: fig1 [100, 140), fig2 [400, 500).
   The cover image block (chapterIndex null) must never produce a cue. */
const figureBlocks = [
  { id: 'cover-art', kind: 'image', imagePath: 'books/chicken-predators/cover.jpg', text: null, chapterIndex: null, sequenceIndex: 0 },
  { id: 'b1', kind: 'text', text: 'Feathers on the ramp tell you who came hunting.', chapterIndex: 0, sequenceIndex: 1 },
  { id: 'fig1', kind: 'image', imagePath: 'books/chicken-predators/figures/coop-diagram.png', text: 'A predator-proof coop layout', chapterIndex: 0, sequenceIndex: 2 },
  { id: 'b2', kind: 'text', text: 'The coop is your first and best defence.', chapterIndex: 0, sequenceIndex: 3 },
  { id: 'fig2', kind: 'image', imagePath: 'books/chicken-predators/figures/electric-fence.png', text: null, chapterIndex: 0, sequenceIndex: 4 },
  { id: 'b3', kind: 'text', text: 'Electric fencing works when it is tight and hot.', chapterIndex: 0, sequenceIndex: 5 },
];
const figureAnchors = [
  { blockId: 'b1', timestamp: 0 },
  { blockId: 'fig1', timestamp: 100 },
  { blockId: 'b2', timestamp: 140 },
  { blockId: 'fig2', timestamp: 400 },
  { blockId: 'b3', timestamp: 500 },
];
const textOnlyBlocks = figureBlocks.filter((block) => block.kind !== 'image' || block.chapterIndex === null);
const textOnlyAnchors = figureAnchors.filter((anchor) => !anchor.blockId.startsWith('fig'));

test('the template puts the figure stage inside the stage above the captions, hidden by default', () => {
  const stageStart = playerTemplate.indexOf('<div class="room-stage">');
  const figurePanel = playerTemplate.indexOf('id="figurePanel"');
  const captionPanel = playerTemplate.indexOf('id="captionPanel"');

  assert.ok(stageStart >= 0);
  assert.ok(figurePanel > stageStart && figurePanel < captionPanel);
  assert.match(playerTemplate, /<figure id="figurePanel" class="room-figure" hidden>/);
  assert.match(playerTemplate, /<img id="figureImg" alt="" decoding="async">/);
  assert.match(playerTemplate, /<figcaption id="figureCaption" hidden><\/figcaption>/);
});

test('the figure stage and library covers reuse existing room tokens', () => {
  const figure = cssDeclarations('.room-figure');
  assert.match(figure, /background:\s*var\(--surface\);/);
  assert.match(figure, /border:\s*1px solid var\(--separator\);/);
  assert.match(playerStyles, /\.room-figure\[hidden\]\s*\{\s*display:\s*none;\s*\}/);

  const figureImg = cssDeclarations('.room-figure img');
  assert.match(figureImg, /max-height:\s*46vh;/);
  assert.match(figureImg, /object-fit:\s*contain;/);

  assert.match(cssDeclarations('.room-figure figcaption'), /color:\s*var\(--room-text-tertiary\);/);

  // The crossfade only runs when the visitor allows motion.
  assert.match(
    playerStyles,
    /@media \(prefers-reduced-motion: no-preference\) \{\n {2}\.room-figure \{ transition: opacity 0\.2s var\(--ease\); \}\n {2}\.room-figure\.swap \{ opacity: 0; \}\n\}/,
  );

  const cover = cssDeclarations('.room-library li .room-lib-cover');
  assert.match(cover, /border:\s*1px solid var\(--separator\);/);
  assert.match(cover, /background:\s*var\(--fill-2\);/);

  // Library covers follow the player cover frame's convention: a fixed
  // width, an automatic height, and no forced shape — so square covers
  // render square instead of being cropped to a portrait ratio.
  assert.match(cover, /width:\s*76px;/);
  assert.match(cover, /height:\s*auto;/);
  assert.doesNotMatch(cover, /aspect-ratio:/);
  assert.doesNotMatch(cover, /object-fit:/);
  assert.match(cssDeclarations('.room-cover-frame img'), /width:\s*100%;\s*height:\s*auto;/);
});

test('a figure cue shows the panel with src, alt, and caption inside its window and hides it outside', async () => {
  const player = await bootPlayer({ blocks: figureBlocks, anchors: figureAnchors });
  const panel = player.elements.get('figurePanel');
  const img = player.elements.get('figureImg');
  const caption = player.elements.get('figureCaption');

  assert.equal(panel.hidden, true, 'panel starts hidden');

  player.seek(120);
  assert.equal(panel.hidden, false);
  assert.equal(isVisible(img), true);
  assert.equal(img.src, 'books/chicken-predators/figures/coop-diagram.png');
  assert.equal(img.alt, 'A predator-proof coop layout');
  assert.equal(caption.hidden, false);
  assert.equal(caption.textContent, 'A predator-proof coop layout');

  player.seek(200);
  assert.equal(panel.hidden, true, 'panel hides outside the display window');

  player.seek(50);
  assert.equal(panel.hidden, true);
});

test('a captionless figure keeps the figcaption hidden and falls back to a generic alt', async () => {
  const player = await bootPlayer({ blocks: figureBlocks, anchors: figureAnchors });

  player.seek(450);
  assert.equal(player.elements.get('figurePanel').hidden, false);
  assert.equal(player.elements.get('figureImg').src, 'books/chicken-predators/figures/electric-fence.png');
  assert.equal(player.elements.get('figureImg').alt, 'Figure from this chapter');
  assert.equal(player.elements.get('figureCaption').hidden, true);
  assert.equal(player.elements.get('figureCaption').textContent, '');
});

test('a cover-only book never shows the figure panel while captions keep running', async () => {
  const player = await bootPlayer({ blocks: textOnlyBlocks, anchors: textOnlyAnchors });
  const panel = player.elements.get('figurePanel');

  for (const t of [0, 120, 450, 600, 10000]) {
    player.seek(t);
    assert.equal(panel.hidden, true, `panel stays hidden at ${t}s`);
  }

  player.seek(450);
  assert.equal(player.elements.get('captionText').textContent, 'The coop is your first and best defence.');
});

test('a figure image error hides the panel, keeps captions running, and only latches that src', async () => {
  const player = await bootPlayer({ blocks: figureBlocks, anchors: figureAnchors });
  const panel = player.elements.get('figurePanel');
  const img = player.elements.get('figureImg');

  player.seek(120);
  assert.equal(panel.hidden, false);

  img.dispatch('error');
  assert.equal(panel.hidden, true);
  assert.ok(player.debugLogs.some((line) => line.includes('figure image failed')));

  // Captions keep running after the failure.
  player.seek(150);
  assert.equal(player.elements.get('captionText').textContent, 'The coop is your first and best defence.');
  assert.equal(panel.hidden, true);

  // Re-entering the failed figure's window must not retry that src.
  img.src = 'SENTINEL';
  player.seek(130);
  assert.equal(panel.hidden, true);
  assert.equal(img.src, 'SENTINEL', 'failed src is not re-set every tick');

  // A different figure still gets its own attempt.
  player.seek(450);
  assert.equal(panel.hidden, false);
  assert.equal(img.src, 'books/chicken-predators/figures/electric-fence.png');
});

test('showing a figure preloads the next interior figure in document order', async () => {
  const player = await bootPlayer({ blocks: figureBlocks, anchors: figureAnchors, trackImages: true });

  player.seek(120);
  assert.deepEqual(
    player.preloadedImages.map((image) => image.src),
    ['books/chicken-predators/figures/electric-fence.png'],
  );

  // The last interior figure has no successor; the cover block never counts.
  player.seek(450);
  assert.equal(player.preloadedImages.length, 1);
});

test('a figure image reused by a later block still preloads its own successor', async () => {
  // fig1 and fig3 legitimately share one file (a recurring diagram). The
  // successor lookup must key off the block, not the path — matching on the
  // path finds fig1 first and would preload fig2 again after fig3.
  const recurring = 'books/chicken-predators/figures/coop-diagram.png';
  const blocks = [
    { id: 'cover-art', kind: 'image', imagePath: 'books/chicken-predators/cover.jpg', text: null, chapterIndex: null, sequenceIndex: 0 },
    { id: 'b1', kind: 'text', text: 'Feathers on the ramp tell you who came hunting.', chapterIndex: 0, sequenceIndex: 1 },
    { id: 'fig1', kind: 'image', imagePath: recurring, text: 'A predator-proof coop layout', chapterIndex: 0, sequenceIndex: 2 },
    { id: 'b2', kind: 'text', text: 'The coop is your first and best defence.', chapterIndex: 0, sequenceIndex: 3 },
    { id: 'fig2', kind: 'image', imagePath: 'books/chicken-predators/figures/electric-fence.png', text: null, chapterIndex: 0, sequenceIndex: 4 },
    { id: 'b3', kind: 'text', text: 'Electric fencing works when it is tight and hot.', chapterIndex: 0, sequenceIndex: 5 },
    { id: 'fig3', kind: 'image', imagePath: recurring, text: 'The same layout, revisited', chapterIndex: 0, sequenceIndex: 6 },
    { id: 'b4', kind: 'text', text: 'Back to the coop with everything you now know.', chapterIndex: 0, sequenceIndex: 7 },
    { id: 'fig4', kind: 'image', imagePath: 'books/chicken-predators/figures/night-latch.png', text: null, chapterIndex: 0, sequenceIndex: 8 },
    { id: 'b5', kind: 'text', text: 'A latch a raccoon cannot work is the last word.', chapterIndex: 0, sequenceIndex: 9 },
  ];
  const anchors = [
    { blockId: 'b1', timestamp: 0 },
    { blockId: 'fig1', timestamp: 100 },
    { blockId: 'b2', timestamp: 140 },
    { blockId: 'fig2', timestamp: 400 },
    { blockId: 'b3', timestamp: 500 },
    { blockId: 'fig3', timestamp: 600 },
    { blockId: 'b4', timestamp: 700 },
    { blockId: 'fig4', timestamp: 800 },
    { blockId: 'b5', timestamp: 900 },
  ];
  const player = await bootPlayer({ blocks, anchors, trackImages: true });

  player.seek(120);
  assert.deepEqual(player.preloadedImages.map((image) => image.src), [
    'books/chicken-predators/figures/electric-fence.png',
  ]);

  // fig3 shares fig1's path; its successor is fig4, not fig1's successor.
  player.seek(650);
  assert.deepEqual(player.preloadedImages.map((image) => image.src), [
    'books/chicken-predators/figures/electric-fence.png',
    'books/chicken-predators/figures/night-latch.png',
  ]);
});

/* ── Library grid ──────────────────────────────────────── */

function allLibraryCards(player) {
  return [
    ...descendants(player.elements.get('seriesLibrary'), (node) => node.tagName === 'LI'),
    ...player.elements.get('library').children,
  ];
}

test('library entries with covers render visual cards with cover, subtitle, byline, and unchanged actions', async () => {
  const catalog = cloneCatalog((book) => ({
    ...book,
    cover: book.cover ?? `books/${book.slug}/cover.jpg`,
    coverAlt: book.coverAlt ?? `Cover of ${book.title}`,
    coverWidth: 480,
    coverHeight: 768,
    subtitle: book.slug === 'why-it-feels-right' ? 'How intuition works' : book.subtitle,
  }));
  const player = await bootPlayer({ catalog });
  const library = player.elements.get('library');
  const libraryCards = allLibraryCards(player);

  assert.equal(libraryCards.length, catalog.books.length);
  for (const item of libraryCards) {
    const cover = item.children[0];
    const title = item.children.find((child) => child.classList.values.has('room-lib-title'));
    assert.equal(cover.tagName, 'IMG');
    assert.ok(cover.classList.values.has('room-lib-cover'));
    assert.ok(title, 'card has a title after optional volume metadata');
    assert.equal(title.className, 'room-lib-title');
    assert.equal(cover.alt, `Cover of ${title.textContent}`);
    assert.match(cover.src, /^books\/[a-z0-9-]+\/cover\.jpg$/);
    assert.equal(cover.loading, 'lazy');
    // The size hints mirror the catalog's stated pixel dimensions.
    assert.equal(cover.getAttribute('width'), '480');
    assert.equal(cover.getAttribute('height'), '768');

    const byline = descendants(item, (node) => node.classList.values.has('room-lib-by'));
    assert.equal(byline.length, 1);
    assert.match(byline[0].textContent, /^Written by .+$/);
  }

  const withSubtitle = libraryCards.find((item) => item.children[1].textContent === 'Why It Feels Right');
  const subtitle = descendants(withSubtitle, (node) => node.classList.values.has('room-lib-subtitle'));
  assert.equal(subtitle.length, 1);
  assert.equal(subtitle[0].textContent, 'How intuition works');

  const withoutSubtitle = libraryCards.find((item) => item.children[1].textContent === 'Tests First');
  assert.equal(descendants(withoutSubtitle, (node) => node.classList.values.has('room-lib-subtitle')).length, 0);

  // Actions are untouched: every recovered public book is now playable and
  // therefore keeps Listen → EPUB → Read unless it is the selected book.
  const rodents = libraryCards.find((item) => item.children[1].textContent === 'Rodents in the Walls');
  const rodentsBook = publishedCatalog.books.find((book) => book.slug === 'rodents-in-the-walls');
  const rodentsLinks = descendants(rodents, (node) => node.tagName === 'A');
  assert.deepEqual(rodentsLinks.map((link) => link.textContent), ['Listen', 'EPUB', 'Read']);
  assert.equal(rodentsLinks[0].href, '?book=rodents-in-the-walls');
  assert.ok(rodentsLinks[0].classList.values.has('room-lib-listen') || rodentsLinks[0].className === 'room-lib-listen');
  assert.equal(rodentsLinks[1].href, rodentsBook.links.epub);
  assert.equal(rodentsLinks[2].href, rodentsBook.links.read);
  assert.equal(rodentsLinks[2].target, '_blank');
  assert.equal(rodentsLinks[2].rel, 'noopener');

  const textLinks = descendants(withoutSubtitle, (node) => node.tagName === 'A');
  assert.deepEqual(textLinks.map((link) => link.textContent), ['Listen', 'EPUB', 'Read']);
});

/* The paired-m4b books ship square 768×768 art on purpose, so the grid
   must take its ratio from the catalog rather than assume every cover is a
   480×768 portrait. */
function sizedCatalog(sizes) {
  return cloneCatalog((book) => {
    const { coverWidth, coverHeight, ...rest } = book;
    return {
      ...rest,
      cover: rest.cover ?? `books/${rest.slug}/cover.jpg`,
      coverAlt: rest.coverAlt ?? `Cover of ${rest.title}`,
      ...(sizes[rest.slug] ?? {}),
    };
  });
}

function libraryCover(player, title) {
  const item = player.elements.get('library').children
    .find((node) => node.children[1]?.textContent === title);
  assert.ok(item, `${title} is in the library`);
  return item.children[0];
}

test('a square cover keeps its own dimensions instead of a forced portrait ratio', async () => {
  const player = await bootPlayer({
    catalog: sizedCatalog({
      'the-new-deal': { coverWidth: 768, coverHeight: 768 },
      'rodents-in-the-walls': { coverWidth: 480, coverHeight: 768 },
    }),
  });

  const square = libraryCover(player, 'The New Deal');
  assert.equal(square.getAttribute('width'), '768');
  assert.equal(square.getAttribute('height'), '768');

  const portrait = libraryCover(player, 'Rodents in the Walls');
  assert.equal(portrait.getAttribute('width'), '480');
  assert.equal(portrait.getAttribute('height'), '768');
});

test('a cover without catalog dimensions gets neither width nor height', async () => {
  const player = await bootPlayer({ catalog: sizedCatalog({}) });
  const libraryCards = allLibraryCards(player);

  assert.equal(libraryCards.length, publishedCatalog.books.length);
  for (const item of libraryCards) {
    const cover = item.children[0];
    assert.equal(cover.tagName, 'IMG');
    assert.equal(cover.getAttribute('width'), null);
    assert.equal(cover.getAttribute('height'), null);
  }
});

test('a cover with only one usable dimension asserts no ratio at all', async () => {
  const player = await bootPlayer({
    catalog: sizedCatalog({
      'the-new-deal': { coverWidth: 768 },
      'rodents-in-the-walls': { coverWidth: 480, coverHeight: 0 },
      'tests-first': { coverWidth: 480, coverHeight: 768.5 },
    }),
  });

  for (const title of ['The New Deal', 'Rodents in the Walls', 'Tests First']) {
    const cover = libraryCover(player, title);
    assert.equal(cover.getAttribute('width'), null, `${title} width`);
    assert.equal(cover.getAttribute('height'), null, `${title} height`);
  }
});

test('MediaSession artwork sizes come from the catalog and are omitted when unstated', async () => {
  const square = await bootPlayer({
    mediaSession: true,
    catalog: sizedCatalog({ 'chicken-predators': { coverWidth: 768, coverHeight: 768 } }),
  });
  const squareArt = square.mediaSessionMetadata().artwork[0];
  assert.equal(squareArt.src, 'https://kinnokilabs.com/listen/books/chicken-predators/cover.jpg');
  assert.equal(squareArt.type, 'image/jpeg');
  assert.equal(squareArt.sizes, '768x768');

  const unsized = await bootPlayer({ mediaSession: true, catalog: sizedCatalog({}) });
  const unsizedArt = unsized.mediaSessionMetadata().artwork[0];
  assert.equal(unsizedArt.src, 'https://kinnokilabs.com/listen/books/chicken-predators/cover.jpg');
  assert.equal(unsizedArt.type, 'image/jpeg');
  assert.ok(!('sizes' in unsizedArt), 'no size is asserted when the catalog states none');
});

test('library entries without covers render no img and keep title-first markup and actions', async () => {
  const catalog = cloneCatalog((book) => {
    const { cover, coverAlt, ...rest } = book;
    return rest;
  });
  const player = await bootPlayer({ catalog });
  const libraryCards = allLibraryCards(player);

  assert.equal(libraryCards.length, catalog.books.length);
  assert.equal(libraryCards.flatMap((card) => descendants(card, (node) => node.tagName === 'IMG')).length, 0);
  for (const item of libraryCards) {
    const title = item.children.find((child) => child.classList.values.has('room-lib-title'));
    assert.ok(title, 'card keeps its title after optional volume metadata');
    assert.ok(title.textContent.length > 0);
    const links = descendants(item, (node) => node.tagName === 'A');
    assert.ok(links.length >= 2);
    assert.deepEqual(links.slice(-2).map((link) => link.textContent), ['EPUB', 'Read']);
  }
});

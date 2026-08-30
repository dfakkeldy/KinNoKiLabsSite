/* Drives Resources/fiction/fiction.js against a fake DOM.

   Two states matter, and the shelf now holds both. Three books are still
   awaiting narration, and the room must say so without pretending the
   transport works. The Human Exception and Reversible Containment stream,
   and the same code drives a live transport, seekable chapters and
   word-by-word captions — fiction.js was never edited to make that happen,
   which is the whole claim of the catalog contract.

   The inert path is therefore tested against a synthetic all-pending
   catalog rather than the published one: with a streaming book on the
   shelf, the room rightly opens on it, and reconstructing the state the
   shelf had last week is the only way to keep covering the path the three
   remaining books still take. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { FakeNode, descendants, settle } from './dom-fixture.mjs';

const require = createRequire(import.meta.url);
const core = require('../../Resources/listen/listen-core.js');
const fictionRoot = new URL('../../Resources/fiction/', import.meta.url);
const playerSource = readFileSync(new URL('fiction.js', fictionRoot), 'utf8');
const publishedCatalog = JSON.parse(readFileSync(new URL('books.json', fictionRoot), 'utf8'));

const ELEMENT_IDS = [
  'cover', 'bookForm', 'bookTitle', 'bookSubtitle', 'bookByline', 'editionNote',
  'chapterCount', 'chapterList', 'chapterNow', 'captionPanel', 'captionWords',
  'captionText', 'figurePanel', 'figureImg', 'figureCaption', 'status', 'playPause',
  'iconPlay', 'iconPause', 'back30', 'fwd30', 'speed', 'scrubber', 'timeNow',
  'timeTotal', 'selectedFormats', 'emptyState', 'shelf', 'shelfSub',
];

const NARRATED_BLOCKS = [
  { id: 'b1', kind: 'text', text: 'Green across the board, and the room believed it.', chapterIndex: 0, sequenceIndex: 0 },
  { id: 'b2', kind: 'text', text: 'Mara did not.', chapterIndex: 1, sequenceIndex: 1 },
];
const NARRATED_ANCHORS = [
  { blockId: 'b1', timestamp: 0 },
  { blockId: 'b2', timestamp: 10 },
];

/* The shelf as it stood before any narration landed: every book inert,
   every streaming field stripped back off. Reverting a book this way is
   the exact inverse of what Tools/stage-fiction-book.mjs writes, so it
   keeps describing the state the un-narrated books are really in. */
function allPending() {
  const catalog = structuredClone(publishedCatalog);
  for (const book of catalog.books) {
    if (book.audio.status !== 'available') continue;
    book.audio = { status: 'pending' };
    book.production = { state: 'narration-in-progress', label: 'Narration in progress' };
    delete book.durationSeconds;
    delete book.text;
    delete book.alignment;
    delete book.editionNote;
    for (const chapter of book.chapters) {
      delete chapter.start;
      delete chapter.end;
    }
  }
  return catalog;
}

/* An all-pending shelf with one book promoted to a complete narrated
   edition, on a short synthetic timeline — exactly the diff a narration
   drop makes, small enough to assert caption-level behaviour against. */
function withNarratedBook(slug = 'six-months-behind') {
  const catalog = allPending();
  const book = catalog.books.find((candidate) => candidate.slug === slug);
  book.durationSeconds = 20;
  book.audio = {
    status: 'available',
    url: 'https://raw.githubusercontent.com/dfakkeldy/explainer-audiobooks/' +
      '0123456789abcdef0123456789abcdef01234567/books/' + slug + '/' + slug + '.m4b',
    mimeType: 'audio/mp4',
  };
  book.chapters = [
    { number: 1, title: 'Green Across the Board', start: 0, end: 10 },
    { number: 2, title: 'Comparator Six', start: 10, end: 20 },
  ];
  book.text = { blocks: 'books/' + slug + '/blocks.json' };
  book.alignment = { sidecar: 'books/' + slug + '/alignment.json' };
  return catalog;
}

async function bootPlayer({
  catalog = structuredClone(publishedCatalog),
  catalogFailure = false,
  search = '',
  blocks = NARRATED_BLOCKS,
  anchors = NARRATED_ANCHORS,
  storedSpeed = null,
} = {}) {
  const elements = new Map(ELEMENT_IDS.map((id) => [id, new FakeNode(id === 'figureImg' ? 'img' : 'div')]));
  for (const id of ['playPause', 'scrubber', 'back30', 'fwd30', 'speed']) {
    elements.get(id).disabled = true;
  }
  for (const id of ['emptyState', 'selectedFormats', 'figurePanel', 'figureCaption', 'bookSubtitle', 'editionNote']) {
    elements.get(id).hidden = true;
  }

  const main = new FakeNode('main');
  const room = new FakeNode('section');
  main.appendChild(room);
  room.appendChild(elements.get('figurePanel'));
  elements.get('figurePanel').appendChild(elements.get('figureImg'));
  elements.get('figurePanel').appendChild(elements.get('figureCaption'));
  room.appendChild(elements.get('captionPanel'));
  elements.get('captionPanel').appendChild(elements.get('captionWords'));
  elements.get('captionPanel').appendChild(elements.get('captionText'));
  room.appendChild(elements.get('status'));
  main.appendChild(elements.get('emptyState'));
  main.appendChild(elements.get('shelf'));

  let audio;
  class FakeAudio {
    constructor() {
      audio = this;
      this.currentTime = 0;
      this.duration = 20;
      this.paused = true;
      this.playbackRate = 1;
      this.playCalls = 0;
      this.loadCalls = 0;
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

    load() { this.loadCalls += 1; }

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

  const stored = new Map();
  if (storedSpeed !== null) stored.set('kinnoki-fiction-rate', storedSpeed);
  const debugLogs = [];
  const requestedUrls = [];

  runInNewContext(playerSource, {
    Audio: FakeAudio,
    URL,
    URLSearchParams,
    console: { debug: (...args) => debugLogs.push(args.join(' ')) },
    document,
    fetch: async (input) => {
      requestedUrls.push(String(input));
      if (input === 'books.json') {
        if (catalogFailure) return { ok: false, status: 503 };
        return { ok: true, json: async () => catalog };
      }
      if (String(input).endsWith('blocks.json')) return { ok: true, json: async () => ({ blocks }) };
      return { ok: true, json: async () => anchors };
    },
    localStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
    },
    location: { href: 'https://kinnokilabs.com/fiction/', search },
    navigator: {},
    requestAnimationFrame: (callback) => callback(),
    window: { EchoListenCore: core, addEventListener() {} },
  }, { filename: 'Resources/fiction/fiction.js' });

  await settle();
  await settle();
  return { audio, document, elements, main, room, stored, debugLogs, requestedUrls };
}

const el = (harness, id) => harness.elements.get(id);
const bootAwaiting = (options = {}) => bootPlayer({ catalog: allPending(), ...options });

/* ── Awaiting narration: the path four books are still on ─ */

test('opens on the featured book and names it honestly', async () => {
  const harness = await bootAwaiting();
  assert.equal(harness.room.hidden, false);
  assert.equal(el(harness, 'bookTitle').textContent, 'Six Months Behind');
  assert.equal(harness.document.title,
    'Six Months Behind — Fiction Listening Room — KinNoKi Labs');
  assert.equal(el(harness, 'bookForm').textContent,
    'Original fiction · Novel · Techno-thriller');
  assert.match(el(harness, 'bookByline').textContent,
    /^by Dan Fakkeldy · 34 chapters · ~80\.1k words · ≈9 h once narrated$/);
});

test('the transport stays dead while there is nothing to play', async () => {
  const harness = await bootAwaiting();
  for (const id of ['playPause', 'scrubber', 'back30', 'fwd30', 'speed']) {
    assert.equal(el(harness, id).disabled, true, `${id} must stay disabled`);
  }
  assert.equal(el(harness, 'timeNow').textContent, '--:--');
  assert.equal(el(harness, 'timeTotal').textContent, '--:--');
  assert.equal(harness.audio.loadCalls, 0, 'no stream is requested');
  assert.equal(harness.audio.children.length, 0, 'no <source> is attached');
});

test('the caption panel carries the real opening lines, labelled as such', async () => {
  const harness = await bootAwaiting();
  const words = el(harness, 'captionWords');
  const excerpt = publishedCatalog.books[0].excerpt;

  assert.equal(words.children.length, 1);
  assert.equal(words.children[0].className, 'excerpt');
  assert.match(words.renderedText, /^Opening lines/);
  assert.ok(words.renderedText.includes(excerpt.slice(0, 60)));
  // Screen readers get the same content, announced once.
  assert.equal(el(harness, 'captionText').textContent, 'Opening lines. ' + excerpt);
  // Never the karaoke spans: nothing is being heard.
  assert.equal(descendants(words, (node) => node.className === 'w').length, 0);
});

test('status reports the production state instead of implying playback', async () => {
  const harness = await bootAwaiting();
  const status = el(harness, 'status').textContent;
  assert.match(status, /^Narration queued —/);
  assert.match(status, /no audio to stream yet/);
  assert.equal(el(harness, 'status').classList.contains('error'), false);
});

test('chapters list as plain rows, not controls, until they can be seeked', async () => {
  const harness = await bootAwaiting();
  const list = el(harness, 'chapterList');
  assert.equal(el(harness, 'chapterCount').textContent, '(34)');
  assert.equal(list.children.length, 34);

  const buttons = descendants(list, (node) => node.tagName === 'BUTTON');
  assert.equal(buttons.length, 0, 'nothing to seek to means nothing clickable');
  const rows = descendants(list, (node) => node.className === 'fic-chapter-row');
  assert.equal(rows.length, 34);
  assert.match(rows[0].renderedText, /Green Across the Board/);
  assert.match(rows[33].renderedText, /The Letter/);
  assert.equal(el(harness, 'chapterNow').textContent, 'ch. 1 — Green Across the Board');
});

test('every shelf card renders with its coming-soon state', async () => {
  const harness = await bootAwaiting();
  const cards = el(harness, 'shelf').children;
  assert.equal(cards.length, 5);

  assert.equal(cards[0].getAttribute('aria-current'), 'page', 'the stage title is marked current');
  for (const card of cards) {
    assert.equal(card.classList.contains('is-playable'), false);
    const badges = descendants(card, (node) => node.className === 'fic-badge');
    assert.equal(badges.length, 1);
    assert.equal(badges[0].textContent, 'Coming soon');
    assert.equal(descendants(card, (node) => node.className === 'fic-listen').length, 0,
      'no card offers a listen link while nothing streams');
    const covers = descendants(card, (node) => node.className === 'fic-cover');
    assert.equal(covers.length, 1);
    assert.equal(covers[0].getAttribute('width'), '600');
    assert.equal(covers[0].getAttribute('height'), '600');
  }
  assert.equal(descendants(cards[1], (node) => node.className === 'fic-status')[0].textContent,
    'Narration in progress');
  assert.match(el(harness, 'shelfSub').textContent, /^Nothing is narrated yet/);
});

test('a book with no published manuscript renders no format nav at all', async () => {
  const harness = await bootAwaiting();
  assert.equal(el(harness, 'selectedFormats').hidden, true);
  assert.equal(el(harness, 'selectedFormats').children.length, 0);
});

test('an explicit ?book= opens that title', async () => {
  const harness = await bootAwaiting({ search: '?book=duty-of-care' });
  assert.equal(el(harness, 'bookTitle').textContent, 'Duty of Care');
  assert.equal(el(harness, 'chapterCount').textContent, '(22)');
  assert.match(el(harness, 'status').textContent, /^Manuscript finished —/);
});

test('an unknown ?book= falls back to the featured title and says so', async () => {
  const harness = await bootAwaiting({ search: '?book=not-a-book' });
  assert.equal(el(harness, 'bookTitle').textContent, 'Six Months Behind');
  assert.equal(el(harness, 'status').textContent,
    'That book isn’t on the fiction shelf — showing Six Months Behind instead.');
  assert.equal(el(harness, 'status').classList.contains('error'), true);
});

test('a catalog that will not load leaves a recoverable message', async () => {
  const harness = await bootPlayer({ catalogFailure: true });
  assert.equal(harness.room.hidden, false);
  assert.equal(el(harness, 'status').textContent, 'The book catalog couldn’t load. Reload to retry.');
  assert.equal(el(harness, 'status').classList.contains('error'), true);
});

test('an empty shelf hides the player rather than showing an empty instrument', async () => {
  const harness = await bootPlayer({ catalog: { version: 1, collection: 'fiction', books: [] } });
  assert.equal(harness.room.hidden, true);
  assert.equal(el(harness, 'emptyState').hidden, false);
  assert.match(el(harness, 'emptyState').textContent, /shelf is empty/);
});

/* ── The published shelf, exactly as it ships ──────────── */
/* These run against Resources/fiction/books.json itself. They are the
   proof that the contract paid off: each narrated title was added to the
   catalog and nothing in fiction.js changed. The first streaming book
   in shelf order still holds the default stage. */

const HUMAN_EXCEPTION = publishedCatalog.books.find((book) => book.slug === 'the-human-exception');
const REVERSIBLE_CONTAINMENT = publishedCatalog.books.find((book) => book.slug === 'reversible-containment');

test('the room opens on the narrated book, not the featured one', async () => {
  const harness = await bootPlayer();
  assert.equal(el(harness, 'bookTitle').textContent, 'The Human Exception');
  assert.equal(harness.document.title,
    'The Human Exception — Fiction Listening Room — KinNoKi Labs');
  // Real runtime, not the "≈N h once narrated" estimate.
  assert.equal(el(harness, 'bookByline').textContent,
    'by Dan Fakkeldy · 24 chapters · ~58.3k words · 7:53:23');
  assert.equal(el(harness, 'editionNote').hidden, false);
  assert.match(el(harness, 'editionNote').textContent, /first listen/i);
});

test('the published stream is wired from the release asset', async () => {
  const harness = await bootPlayer();
  assert.equal(harness.audio.loadCalls, 1);
  assert.equal(harness.audio.children.length, 1);
  assert.equal(harness.audio.children[0].src, HUMAN_EXCEPTION.audio.url);
  // GitHub serves the asset as application/octet-stream, so the element
  // has to carry the real type or Safari will not touch it.
  assert.equal(harness.audio.children[0].type, 'audio/mp4');
  assert.deepEqual(harness.requestedUrls.slice(1).sort(), [
    'books/the-human-exception/alignment.json',
    'books/the-human-exception/blocks.json',
  ]);
});

test('all twenty-four published chapters become seek controls', async () => {
  const harness = await bootPlayer();
  harness.audio.duration = HUMAN_EXCEPTION.durationSeconds;
  harness.audio.dispatch('loadedmetadata');

  assert.equal(el(harness, 'chapterCount').textContent, '(24)');
  const buttons = descendants(el(harness, 'chapterList'), (node) => node.tagName === 'BUTTON');
  assert.equal(buttons.length, 24);
  assert.match(buttons[0].renderedText, /The Margin0:00/);
  assert.equal(el(harness, 'timeTotal').textContent, '7:53:23');

  buttons[23].dispatch('click');
  assert.ok(Math.abs(harness.audio.currentTime - 26894.535) < 0.001, 'seeks into the last chapter');
  assert.equal(el(harness, 'chapterNow').textContent, 'ch. 24 — The Guardian');
});

test('the published book offers its manuscript in every format it has', async () => {
  const harness = await bootPlayer();
  const links = el(harness, 'selectedFormats');
  assert.equal(links.hidden, false);
  assert.deepEqual(links.children.map((link) => link.textContent),
    ['Read as Markdown', 'EPUB', 'Book folder']);
  for (const link of links.children) {
    assert.equal(link.target, '_blank');
    assert.equal(link.rel, 'noopener');
    assert.match(link.href, /^https:\/\/github\.com\/dfakkeldy\/explainer-audiobooks\//);
  }
});

test('the published shelf marks both streaming titles and counts them', async () => {
  const harness = await bootPlayer();
  const cards = el(harness, 'shelf').children;
  assert.equal(cards.length, 5);
  const humanException = cards[1];
  const reversible = cards[2];
  assert.equal(humanException.classList.contains('is-playable'), true);
  assert.equal(reversible.classList.contains('is-playable'), true);
  assert.equal(humanException.getAttribute('aria-current'), 'page',
    'the first streaming book in shelf order holds the stage');
  assert.equal(descendants(humanException, (node) => node.className === 'fic-badge').length, 0);
  assert.equal(descendants(reversible, (node) => node.className === 'fic-badge').length, 0);
  assert.match(el(harness, 'shelfSub').textContent, /^2 novels are streaming now/);

  for (const card of [cards[0], cards[3], cards[4]]) {
    assert.equal(card.classList.contains('is-playable'), false);
    assert.equal(descendants(card, (node) => node.className === 'fic-badge')[0].textContent, 'Coming soon');
  }
});

test('?book=reversible-containment streams the first-listen package', async () => {
  const harness = await bootPlayer({ search: '?book=reversible-containment' });
  assert.equal(el(harness, 'bookTitle').textContent, 'Reversible Containment');
  assert.equal(harness.document.title,
    'Reversible Containment — Fiction Listening Room — KinNoKi Labs');
  assert.equal(el(harness, 'bookByline').textContent,
    'by Dan Fakkeldy · 30 chapters · ~79.8k words · 9:56:19');
  assert.equal(el(harness, 'editionNote').hidden, false);
  assert.match(el(harness, 'editionNote').textContent, /first listen/i);
  assert.match(el(harness, 'editionNote').textContent, /review/i);
  assert.equal(harness.audio.loadCalls, 1);
  assert.equal(harness.audio.children[0].src, REVERSIBLE_CONTAINMENT.audio.url);
  assert.equal(harness.audio.children[0].type, 'audio/mp4');
  assert.deepEqual(harness.requestedUrls.slice(1).sort(), [
    'books/reversible-containment/alignment.json',
    'books/reversible-containment/blocks.json',
  ]);
  const links = el(harness, 'selectedFormats');
  assert.equal(links.hidden, false);
  for (const link of links.children) {
    assert.match(link.href, /c03c1d0c760e64790cdae5fa60984662682aaacb/);
  }
});

test('an unknown ?book= now falls back to the streaming title and says so', async () => {
  const harness = await bootPlayer({ search: '?book=not-a-book' });
  assert.equal(el(harness, 'bookTitle').textContent, 'The Human Exception');
  assert.equal(el(harness, 'status').textContent,
    'That book isn’t on the fiction shelf — playing The Human Exception instead.');
  assert.equal(el(harness, 'status').classList.contains('error'), true);
});

test('an un-narrated title still opens inert while another book streams', async () => {
  const harness = await bootPlayer({ search: '?book=six-months-behind' });
  assert.equal(el(harness, 'bookTitle').textContent, 'Six Months Behind');
  for (const id of ['playPause', 'scrubber', 'back30', 'fwd30', 'speed']) {
    assert.equal(el(harness, id).disabled, true, `${id} must stay disabled`);
  }
  assert.equal(harness.audio.loadCalls, 0, 'the other book’s stream is never fetched');
  assert.match(el(harness, 'status').textContent, /^Narration queued —/);
});

/* ── Narrated mechanics, on a short synthetic timeline ─── */

test('a narrated edition takes the stage over the featured book', async () => {
  const harness = await bootPlayer({ catalog: withNarratedBook('duty-of-care') });
  // duty-of-care is not the featured book, but it is the one that streams.
  assert.equal(el(harness, 'bookTitle').textContent, 'Duty of Care');
  assert.match(el(harness, 'bookByline').textContent, /· 0:20$/, 'byline switches to real runtime');
});

test('a narrated book wires the stream and enables the transport', async () => {
  const harness = await bootPlayer({ catalog: withNarratedBook() });
  assert.equal(harness.audio.loadCalls, 1);
  assert.equal(harness.audio.children.length, 1);
  assert.match(harness.audio.children[0].src, /\/six-months-behind\.m4b$/);
  assert.equal(harness.audio.children[0].type, 'audio/mp4');

  // Controls unlock on loadedmetadata, exactly as the browser would.
  assert.equal(el(harness, 'playPause').disabled, true);
  harness.audio.dispatch('loadedmetadata');
  for (const id of ['playPause', 'scrubber', 'back30', 'fwd30', 'speed']) {
    assert.equal(el(harness, id).disabled, false, `${id} must unlock`);
  }
  assert.equal(el(harness, 'timeTotal').textContent, '0:20');
});

test('chapters become seek controls once they carry times', async () => {
  const harness = await bootPlayer({ catalog: withNarratedBook() });
  harness.audio.dispatch('loadedmetadata');

  const buttons = descendants(el(harness, 'chapterList'), (node) => node.tagName === 'BUTTON');
  assert.equal(buttons.length, 2);
  assert.match(buttons[0].renderedText, /Green Across the Board0:00/);
  buttons[1].dispatch('click');
  assert.ok(Math.abs(harness.audio.currentTime - 10.01) < 0.001, 'seeks to chapter two');
  assert.equal(el(harness, 'chapterNow').textContent, 'ch. 2 — Comparator Six');
});

test('captions light up word by word against the sidecar', async () => {
  const harness = await bootPlayer({ catalog: withNarratedBook() });
  harness.audio.dispatch('loadedmetadata');
  harness.audio.currentTime = 4;
  harness.audio.dispatch('timeupdate');

  const spans = descendants(el(harness, 'captionWords'), (node) => node.className.startsWith('w'));
  assert.equal(spans.length, core.words(NARRATED_BLOCKS[0].text).length);
  assert.ok(spans.some((span) => span.className.includes('heard')), 'earlier words are washed gold');
  assert.equal(spans.filter((span) => span.className.includes('active')).length, 1);
  assert.equal(el(harness, 'captionText').textContent, NARRATED_BLOCKS[0].text);
});

test('the shelf marks the streaming title and offers the others a listen link', async () => {
  const harness = await bootPlayer({ catalog: withNarratedBook(), search: '?book=duty-of-care' });
  const cards = el(harness, 'shelf').children;
  const streaming = cards[0];
  assert.equal(streaming.classList.contains('is-playable'), true);
  assert.equal(descendants(streaming, (node) => node.className === 'fic-badge').length, 0);
  const listen = descendants(streaming, (node) => node.className === 'fic-listen');
  assert.equal(listen.length, 1);
  assert.equal(listen[0].href, '?book=six-months-behind');
  assert.match(el(harness, 'shelfSub').textContent, /^One novel is streaming now/);
});

test('playback speed persists and cycles through the fiction ladder', async () => {
  const harness = await bootPlayer({ catalog: withNarratedBook(), storedSpeed: '1.5' });
  harness.audio.dispatch('loadedmetadata');
  assert.equal(harness.audio.playbackRate, 1.5);
  assert.equal(el(harness, 'speed').textContent, '1.5×');

  el(harness, 'speed').dispatch('click');
  assert.equal(harness.audio.playbackRate, 2);
  assert.equal(harness.stored.get('kinnoki-fiction-rate'), '2');
  el(harness, 'speed').dispatch('click');
  assert.equal(harness.audio.playbackRate, 1, 'wraps back to 1×');
});

test('position is remembered per book under a fiction-scoped key', async () => {
  const harness = await bootPlayer({ catalog: withNarratedBook() });
  harness.audio.dispatch('loadedmetadata');
  harness.audio.currentTime = 12;
  harness.audio.dispatch('pause');
  assert.equal(harness.stored.get('kinnoki-fiction-six-months-behind'), JSON.stringify({ t: 12 }));
});

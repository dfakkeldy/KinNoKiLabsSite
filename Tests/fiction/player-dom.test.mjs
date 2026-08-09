/* Drives Resources/fiction/fiction.js against a fake DOM.

   Two states matter. Today every book is awaiting narration, and the room
   must say so without pretending the transport works. The other state is
   the one this page was built for: the same code, the same catalog shape,
   with a narrated edition added — the transport comes alive, chapters
   become seek targets and the captions light up word by word. Testing
   both is what makes "add the audio fields and it just works" a claim
   rather than a hope. */

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

/* The published catalog with one book promoted to a complete narrated
   edition — exactly the diff a real narration drop would make. */
function withNarratedBook(slug = 'six-months-behind') {
  const catalog = structuredClone(publishedCatalog);
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

/* ── Awaiting narration: today's published state ───────── */

test('opens on the featured book and names it honestly', async () => {
  const harness = await bootPlayer();
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
  const harness = await bootPlayer();
  for (const id of ['playPause', 'scrubber', 'back30', 'fwd30', 'speed']) {
    assert.equal(el(harness, id).disabled, true, `${id} must stay disabled`);
  }
  assert.equal(el(harness, 'timeNow').textContent, '--:--');
  assert.equal(el(harness, 'timeTotal').textContent, '--:--');
  assert.equal(harness.audio.loadCalls, 0, 'no stream is requested');
  assert.equal(harness.audio.children.length, 0, 'no <source> is attached');
});

test('the caption panel carries the real opening lines, labelled as such', async () => {
  const harness = await bootPlayer();
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
  const harness = await bootPlayer();
  const status = el(harness, 'status').textContent;
  assert.match(status, /^Narration queued —/);
  assert.match(status, /no audio to stream yet/);
  assert.equal(el(harness, 'status').classList.contains('error'), false);
});

test('chapters list as plain rows, not controls, until they can be seeked', async () => {
  const harness = await bootPlayer();
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
  const harness = await bootPlayer();
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

test('no dead format links ship while the manuscripts are unpublished', async () => {
  const harness = await bootPlayer();
  assert.equal(el(harness, 'selectedFormats').hidden, true);
  assert.equal(el(harness, 'selectedFormats').children.length, 0);
});

test('an explicit ?book= opens that title', async () => {
  const harness = await bootPlayer({ search: '?book=duty-of-care' });
  assert.equal(el(harness, 'bookTitle').textContent, 'Duty of Care');
  assert.equal(el(harness, 'chapterCount').textContent, '(22)');
  assert.match(el(harness, 'status').textContent, /^Manuscript finished —/);
});

test('an unknown ?book= falls back to the featured title and says so', async () => {
  const harness = await bootPlayer({ search: '?book=not-a-book' });
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

/* ── Narrated: the state this room was built to reach ──── */

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

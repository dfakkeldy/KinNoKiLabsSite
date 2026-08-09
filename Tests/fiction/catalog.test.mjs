/* Contract for the hand-maintained Fiction Listening Room catalog.

   Resources/fiction/books.json has no generator — it is curated the way
   Content/tenders is — so these assertions are the gate that keeps a
   half-finished entry from reaching the page. The important one is the
   audio gate: a book may only claim `audio.status: "available"` when the
   entire streaming contract is present, so the day narration lands the
   player turns on with real chapter times and a real sidecar or the
   build fails. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const fictionRoot = new URL('../../Resources/fiction/', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('books.json', fictionRoot), 'utf8'));

const expectedBooks = [
  'six-months-behind',
  'the-human-exception',
  'reversible-containment',
  'the-appeal-window',
  'duty-of-care',
];
const expectedChapterCounts = new Map([
  ['six-months-behind', 34],
  ['the-human-exception', 24],
  ['reversible-containment', 30],
  ['the-appeal-window', 28],
  ['duty-of-care', 22],
]);
const productionStates = new Set([
  'narration-queued',
  'narration-in-progress',
  'manuscript-finished',
  'illustrated-draft',
]);
const formatKeys = ['read', 'epub', 'folder'];

test('catalog publishes exactly the curated fiction shelf, in shelf order', () => {
  assert.equal(catalog.version, 1);
  assert.equal(catalog.collection, 'fiction');
  assert.deepEqual(catalog.books.map((book) => book.slug), expectedBooks);
});

test('exactly one book is featured, so the room always has a stage title', () => {
  const featured = catalog.books.filter((book) => book.featured === true);
  assert.equal(featured.length, 1);
  assert.equal(featured[0].slug, 'six-months-behind');
});

for (const book of catalog.books) {
  test(`${book.slug} carries the fields the room renders`, () => {
    for (const field of ['title', 'subtitle', 'author', 'form', 'genre', 'hook', 'excerpt']) {
      assert.equal(typeof book[field], 'string', `${field} must be a string`);
      assert.ok(book[field].length > 0, `${field} must not be empty`);
    }
    assert.equal(book.author, 'Dan Fakkeldy');
    assert.ok(book.wordCount > 1000, 'wordCount is a real manuscript length');
    assert.ok(book.estimatedHours > 0);
    assert.ok(productionStates.has(book.production.state),
      `unknown production state ${book.production.state}`);
    assert.ok(book.production.label.length > 0);
  });

  /* The excerpt fills the caption panel while a book is awaiting
     narration, so its length is layout: too long and the panel outgrows
     the player, pushing the transport off the first screen. */
  test(`${book.slug} excerpt is sized to the caption panel`, () => {
    const words = book.excerpt.split(/\s+/).length;
    assert.ok(words >= 35 && words <= 60, `excerpt is ${words} words; keep it between 35 and 60`);
    assert.match(book.excerpt, /[.?!”"]$/, 'excerpt ends on a complete sentence');
    assert.doesNotMatch(book.excerpt, /[*_#]/, 'excerpt is plain prose, not Markdown');
  });

  test(`${book.slug} chapter list matches the delivered manuscript`, () => {
    assert.equal(book.chapters.length, expectedChapterCounts.get(book.slug));
    book.chapters.forEach((chapter, index) => {
      assert.equal(chapter.number, index + 1, 'chapter numbers are dense and 1-based');
      assert.equal(typeof chapter.title, 'string');
      assert.ok(chapter.title.length > 0);
      // The ordinal lives in `number`; a title that still carries its own
      // "Chapter 12 —" prefix means the parse leaked into the copy.
      assert.doesNotMatch(chapter.title, /^Chapter\b/i);
    });
  });

  test(`${book.slug} cover is on disk at the dimensions the catalog claims`, () => {
    assert.equal(book.cover, `books/${book.slug}/cover.jpg`);
    assert.ok(book.coverAlt.length > 0);
    const file = new URL(book.cover, fictionRoot);
    assert.ok(statSync(file).size > 1024, 'cover must be a real image');
    const bytes = readFileSync(file);
    assert.equal(bytes.readUInt16BE(0), 0xffd8, 'cover must be a JPEG');
    assert.deepEqual(jpegSize(bytes), { width: book.coverWidth, height: book.coverHeight });
  });

  test(`${book.slug} declares only format links that are canonical and live`, () => {
    assert.equal(typeof book.links, 'object');
    for (const key of Object.keys(book.links)) {
      assert.ok(formatKeys.includes(key), `unknown format link ${key}`);
      const href = book.links[key];
      assert.match(href, /^https:\/\/(github|raw\.githubusercontent)\.com\/dfakkeldy\/explainer-audiobooks\//,
        'format links point at the public book repo');
      assert.ok(href.includes(book.slug), 'format link points at this book');
    }
  });

  /* The gate. `pending` must stay inert, and `available` must be complete.
     Nothing in between is publishable. */
  test(`${book.slug} audio state is either fully inert or fully streamable`, () => {
    const audio = book.audio;
    assert.ok(['pending', 'available'].includes(audio.status),
      `unknown audio status ${audio.status}`);

    if (audio.status === 'pending') {
      assert.equal(audio.url, undefined, 'a pending book must not carry a stream URL');
      assert.equal(book.durationSeconds, undefined);
      assert.equal(book.alignment, undefined);
      assert.equal(book.text, undefined);
      for (const chapter of book.chapters) {
        assert.equal(chapter.start, undefined, 'a pending book has no chapter times');
      }
      return;
    }

    assert.match(audio.url, /^https:\/\/raw\.githubusercontent\.com\/dfakkeldy\/explainer-audiobooks\/[0-9a-f]{40}\//,
      'a streaming URL is pinned to an exact source commit');
    assert.ok(audio.url.endsWith('.m4b'));
    assert.equal(typeof audio.mimeType, 'string');
    assert.ok(book.durationSeconds > 0);
    assert.equal(typeof book.text.blocks, 'string');
    assert.equal(typeof book.alignment.sidecar, 'string');

    let previousEnd = 0;
    book.chapters.forEach((chapter, index) => {
      assert.equal(typeof chapter.start, 'number');
      assert.equal(typeof chapter.end, 'number');
      assert.ok(chapter.end > chapter.start, `chapter ${index + 1} must have positive length`);
      assert.equal(chapter.start, previousEnd, 'chapter windows are contiguous');
      previousEnd = chapter.end;
    });
    assert.ok(Math.abs(previousEnd - book.durationSeconds) < 1,
      'the last chapter ends at the audio duration');
  });
}

test('the shelf is honest about narration while no book is streamable', () => {
  // This flips on its own the moment a real edition is added; it exists so
  // that adding audio is a deliberate act with the rest of the contract
  // attached, not a one-word edit.
  const streamable = catalog.books.filter((book) => book.audio.status === 'available');
  const inProgress = catalog.books.filter((book) => book.production.state !== 'manuscript-finished');
  assert.ok(streamable.length > 0 || inProgress.length > 0,
    'a shelf with nothing streaming must still say where narration stands');
});

/* Minimal JPEG SOF walker — the catalog's cover dimensions travel to the
   player as width/height hints, so a wrong pair is a real layout bug. */
function jpegSize(bytes) {
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error('not a JPEG segment at ' + offset);
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    // SOF0–SOF15, excluding the non-frame markers DHT (c4), JPG (c8), DAC (cc).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error('no JPEG frame header found');
}

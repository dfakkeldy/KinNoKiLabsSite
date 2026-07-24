// Echo Listening Room — tests for the pure ports in Resources/listen/listen-core.js.
// Mirrors Echo's own unit suites (WordTimingInterpolatorTests,
// VisualListeningCueResolverTests) so the JS ports track the Swift semantics.
// Run: make test-listen   (node --test Tests/listen/)
import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../../Resources/listen/listen-core.js';

test('interpolate splits proportionally by character length', () => {
  const w = core.interpolateWords('ab cde', 0, 10); // weights 3 & 3 (trailing space rule)
  assert.equal(w.length, 2);
  assert.equal(w[0].word, 'ab');
  assert.ok(Math.abs(w[0].end - 5.0) < 1e-9);
  assert.ok(Math.abs(w[1].start - 5.0) < 1e-9);
  assert.ok(Math.abs(w[1].end - 10.0) < 1e-9);
});

test('empty text produces no words', () => {
  assert.deepEqual(core.interpolateWords('   ', 0, 10), []);
});

test('monotonic non-overlapping times, exact tiling', () => {
  const w = core.interpolateWords('the quick brown fox', 2, 6);
  for (let i = 1; i < w.length; i++) assert.ok(w[i].start >= w[i - 1].end - 1e-4);
  assert.ok(w[0].start >= 2);
  assert.ok(w[w.length - 1].end <= 6 + 1e-4);
});

test('tokenizer keeps punctuation attached and collapses whitespace runs', () => {
  assert.deepEqual(core.words('Hello,  world!\n  (yes)'), ['Hello,', 'world!', '(yes)']);
});

test('timeline drops unknown anchors and tiles to duration', () => {
  const blocks = [
    { id: 's2-b0', kind: 'paragraph', text: 'a', chapterIndex: 0, sequenceIndex: 0 },
    { id: 's2-b1', kind: 'paragraph', text: 'b', chapterIndex: 0, sequenceIndex: 1 },
  ];
  const anchors = [
    { blockId: 's2-b0', timestamp: 0 },
    { blockId: 'ghost-b9', timestamp: 5 },
    { blockId: 's2-b1', timestamp: 10 },
  ];
  const { rows, droppedAnchorCount } = core.buildTimeline(anchors, blocks, 20);
  assert.equal(droppedAnchorCount, 1);
  assert.deepEqual(rows.map(r => [r.blockId, r.start, r.end]),
    [['s2-b0', 0, 10], ['s2-b1', 10, 20]]);
});

test('activeRowIndex binary search honors [start,end)', () => {
  const rows = [{ start: 0, end: 10 }, { start: 10, end: 20 }];
  assert.equal(core.activeRowIndex(rows, 0), 0);
  assert.equal(core.activeRowIndex(rows, 9.999), 0);
  assert.equal(core.activeRowIndex(rows, 10), 1);
  assert.equal(core.activeRowIndex(rows, 25), -1);
  assert.equal(core.activeRowIndex(rows, -1), -1);
});

test('word progress uses display ordinals even for sparse source indices', () => {
  const wordRows = [
    { index: 0, word: 'alpha', start: 0, end: 1 },
    { index: 10000, word: 'beta', start: 1, end: 2 },
    { index: 20000, word: 'gamma', start: 2, end: 3 },
  ];
  const p = core.wordProgress(wordRows, 1.5);
  assert.equal(p.activeWordIndex, 1);
  assert.equal(p.alreadyHeardWordCount, 1);
});

test('word progress before/after the block yields no active word', () => {
  const wordRows = [{ index: 0, word: 'a', start: 1, end: 2 }];
  assert.equal(core.wordProgress(wordRows, 0.5).activeWordIndex, null);
  assert.equal(core.wordProgress(wordRows, 0.5).alreadyHeardWordCount, 0);
  const after = core.wordProgress(wordRows, 3);
  assert.equal(after.activeWordIndex, null);
  assert.equal(after.alreadyHeardWordCount, 1);
});

test('begin and midpoint derived windows differ ([10,20] vs [5,25])', () => {
  const blocks = [
    { id: 'img', kind: 'image', text: 'cap', imagePath: 'x.png', chapterIndex: 0, sequenceIndex: 0 },
    { id: 'txt', kind: 'paragraph', text: 'hello world', chapterIndex: 0, sequenceIndex: 1 },
  ];
  const rows = [{ start: 10, end: 20, blockId: 'txt', chapterIndex: 0, sequenceIndex: 1 }];
  const wordsByBlockId = new Map();
  const begin = core.resolveSnapshot({ blocks, rows, wordsByBlockId, time: 15, syncPoint: 'begin' });
  assert.equal(begin.imageCue.displayStartTime, 10);
  assert.equal(begin.imageCue.displayEndTime, 20);
  const mid = core.resolveSnapshot({ blocks, rows, wordsByBlockId, time: 6, syncPoint: 'midpoint' });
  assert.equal(mid.imageCue.displayStartTime, 5);
  assert.equal(mid.imageCue.displayEndTime, 25);
  assert.equal(mid.imageCue.source, 'derivedFromNearbyText');
});

test('image with its own timeline row uses explicit window', () => {
  const blocks = [
    { id: 'img', kind: 'image', text: 'figure caption', imagePath: 'x.png', chapterIndex: 0, sequenceIndex: 0 },
    { id: 'txt', kind: 'paragraph', text: 'nearby words', chapterIndex: 0, sequenceIndex: 1 },
  ];
  const rows = [
    { start: 30, end: 40, blockId: 'img', chapterIndex: 0, sequenceIndex: 0 },
    { start: 40, end: 50, blockId: 'txt', chapterIndex: 0, sequenceIndex: 1 },
  ];
  const s = core.resolveSnapshot({ blocks, rows, wordsByBlockId: new Map(), time: 35, syncPoint: 'begin' });
  assert.equal(s.imageCue.source, 'explicitTimeline');
  assert.equal(s.imageCue.displayStartTime, 30);
  assert.equal(s.imageCue.displayEndTime, 40);
  assert.equal(s.imageCue.subtitleBlockId, 'txt');
});

test('hidden or path-less images never become cues', () => {
  const blocks = [
    { id: 'img1', kind: 'image', text: '', imagePath: '', chapterIndex: 0, sequenceIndex: 0 },
    { id: 'txt', kind: 'paragraph', text: 'words here', chapterIndex: 0, sequenceIndex: 1 },
  ];
  const rows = [{ start: 0, end: 10, blockId: 'txt', chapterIndex: 0, sequenceIndex: 1 }];
  const s = core.resolveSnapshot({ blocks, rows, wordsByBlockId: new Map(), time: 5, syncPoint: 'midpoint' });
  assert.equal(s.imageCue, null);
});

test('latest applicable figure wins on overlap', () => {
  const blocks = [
    { id: 'imgA', kind: 'image', text: 'A', imagePath: 'a.png', chapterIndex: 0, sequenceIndex: 0 },
    { id: 'imgB', kind: 'image', text: 'B', imagePath: 'b.png', chapterIndex: 0, sequenceIndex: 2 },
    { id: 'txt', kind: 'paragraph', text: 'shared reference', chapterIndex: 0, sequenceIndex: 1 },
  ];
  const rows = [{ start: 0, end: 10, blockId: 'txt', chapterIndex: 0, sequenceIndex: 1 }];
  const s = core.resolveSnapshot({ blocks, rows, wordsByBlockId: new Map(), time: 5, syncPoint: 'begin' });
  assert.equal(s.imageCue.blockId, 'imgB');
});

test('all books render karaoke one word ahead with a contiguous heard wash', () => {
  const blocks = [{ id: 't1', kind: 'paragraph', text: 'one two three', chapterIndex: 0, sequenceIndex: 0 }];
  const rows = [{ start: 0, end: 3, blockId: 't1', chapterIndex: 0, sequenceIndex: 0 }];
  const wordsByBlockId = new Map([['t1', core.interpolateWords('one two three', 0, 3)]]);
  const s = core.resolveSnapshot({ blocks, rows, wordsByBlockId, time: 1.6, syncPoint: 'midpoint' });
  assert.equal(s.imageCue, null);
  assert.equal(s.subtitleCue.blockId, 't1');
  assert.equal(s.subtitleCue.activeWordIndex, 2);
  assert.equal(s.subtitleCue.alreadyHeardWordCount, 2);
  assert.equal(s.activeBlockId, 't1');
});

test('one-word karaoke lead clamps to the final word', () => {
  const blocks = [{ id: 't1', kind: 'paragraph', text: 'one two three', chapterIndex: 0, sequenceIndex: 0 }];
  const rows = [{ start: 0, end: 3, blockId: 't1', chapterIndex: 0, sequenceIndex: 0 }];
  const wordsByBlockId = new Map([['t1', core.interpolateWords('one two three', 0, 3)]]);
  const s = core.resolveSnapshot({ blocks, rows, wordsByBlockId, time: 2.6, syncPoint: 'begin' });
  assert.equal(s.subtitleCue.activeWordIndex, 2);
  assert.equal(s.subtitleCue.alreadyHeardWordCount, 2);
});

test('subtitle falls back to full block text without word timing', () => {
  const blocks = [{ id: 't1', kind: 'paragraph', text: 'plain block', chapterIndex: 0, sequenceIndex: 0 }];
  const rows = [{ start: 0, end: 3, blockId: 't1', chapterIndex: 0, sequenceIndex: 0 }];
  const s = core.resolveSnapshot({ blocks, rows, wordsByBlockId: new Map(), time: 1, syncPoint: 'begin' });
  assert.equal(s.subtitleCue.text, 'plain block');
  assert.equal(s.subtitleCue.activeWordIndex, null);
  assert.equal(s.subtitleCue.alreadyHeardWordCount, 0);
});

test('subtitle skips heading/image active blocks in favor of cue reference text', () => {
  // Active block is the image itself (explicit window); subtitle should come
  // from the reference text block, not the (caption-less) image.
  const blocks = [
    { id: 'img', kind: 'image', text: '', imagePath: 'x.png', chapterIndex: 0, sequenceIndex: 0 },
    { id: 'txt', kind: 'paragraph', text: 'reference words', chapterIndex: 0, sequenceIndex: 1 },
  ];
  const rows = [
    { start: 0, end: 10, blockId: 'img', chapterIndex: 0, sequenceIndex: 0 },
    { start: 10, end: 20, blockId: 'txt', chapterIndex: 0, sequenceIndex: 1 },
  ];
  const s = core.resolveSnapshot({ blocks, rows, wordsByBlockId: new Map(), time: 5, syncPoint: 'begin' });
  assert.equal(s.imageCue.blockId, 'img');
  assert.equal(s.subtitleCue.blockId, 'txt');
  assert.equal(s.subtitleCue.text, 'reference words');
});

test('library actions expose Listen first only for playable books', () => {
  const links = { epub: 'book.epub', read: 'book.md' };
  assert.deepEqual(core.libraryActions({ slug: 'playable & more', audio: { status: 'available' }, links }), [
    { label: 'Listen', href: '?book=playable%20%26%20more', external: false, className: 'room-lib-listen' },
    { label: 'EPUB', href: 'book.epub', external: false, className: '' },
    { label: 'Read', href: 'book.md', external: true, className: '' },
  ]);
  assert.deepEqual(core.libraryActions({ slug: 'text-only', audio: { status: 'none' }, links }), [
    { label: 'EPUB', href: 'book.epub', external: false, className: '' },
    { label: 'Read', href: 'book.md', external: true, className: '' },
  ]);
});

function seriesCatalog() {
  return {
    version: 2,
    series: [
      {
        id: 'claude-platform',
        title: 'Claude Platform Documentation',
        description: 'A mechanism-first guide.',
        plannedVolumeCount: 9,
        featured: true,
        volumes: [
          { number: 1, book: 'claude-platform-01-the-message' },
          { number: 2, book: 'claude-platform-02-thinking-and-reliable-responses' },
          { number: 3, book: 'claude-platform-03-giving-claude-tools' },
        ],
      },
    ],
    books: [
      { slug: 'standalone-book', audio: { status: 'available' } },
      { slug: 'claude-platform-01-the-message', audio: { status: 'available' } },
      { slug: 'claude-platform-02-thinking-and-reliable-responses', audio: { status: 'available' } },
      { slug: 'claude-platform-03-giving-claude-tools', audio: { status: 'available' } },
    ],
  };
}

test('series context resolves adjacent published volumes without synthesizing planned ones', () => {
  const context = core.seriesContext(
    seriesCatalog(),
    'claude-platform-02-thinking-and-reliable-responses',
  );

  assert.equal(context.series.id, 'claude-platform');
  assert.equal(context.volume.number, 2);
  assert.equal(context.availableCount, 3);
  assert.equal(context.plannedCount, 9);
  assert.equal(context.previous.book, 'claude-platform-01-the-message');
  assert.equal(context.next.book, 'claude-platform-03-giving-claude-tools');
  assert.deepEqual(
    context.series.volumes.map((volume) => volume.book),
    [
      'claude-platform-01-the-message',
      'claude-platform-02-thinking-and-reliable-responses',
      'claude-platform-03-giving-claude-tools',
    ],
  );
});

test('standalone books have no series context', () => {
  assert.equal(core.seriesContext(seriesCatalog(), 'standalone-book'), null);
});

test('default book is the first playable published volume of the featured series', () => {
  assert.equal(core.defaultBookSlug(seriesCatalog()), 'claude-platform-01-the-message');

  const catalog = seriesCatalog();
  catalog.books.find((book) => book.slug === 'claude-platform-01-the-message').audio.status = 'none';
  assert.equal(
    core.defaultBookSlug(catalog),
    'claude-platform-02-thinking-and-reliable-responses',
  );
});

test('default book falls back to the first playable catalog book', () => {
  const catalog = seriesCatalog();
  catalog.series[0].volumes = [
    { number: 1, book: 'missing-book' },
    { number: 2, book: 'not-playable' },
  ];
  catalog.books.push({ slug: 'not-playable', audio: { status: 'none' } });

  assert.equal(core.defaultBookSlug(catalog), 'standalone-book');
});

test('library sections preserve published series order and separate standalone books', () => {
  assert.deepEqual(core.librarySections(seriesCatalog(), 'claude-platform-01-the-message'), {
    series: [{
      id: 'claude-platform',
      books: [
        'claude-platform-01-the-message',
        'claude-platform-02-thinking-and-reliable-responses',
        'claude-platform-03-giving-claude-tools',
      ],
    }],
    moreBooks: ['standalone-book'],
  });
});

test('library sections retain active books in their structural shelf', () => {
  assert.deepEqual(core.librarySections(seriesCatalog(), 'standalone-book'), {
    series: [{
      id: 'claude-platform',
      books: [
        'claude-platform-01-the-message',
        'claude-platform-02-thinking-and-reliable-responses',
        'claude-platform-03-giving-claude-tools',
      ],
    }],
    moreBooks: ['standalone-book'],
  });
});

test('series helpers tolerate malformed input and duplicate references', () => {
  assert.equal(core.seriesContext(null, 'anything'), null);
  assert.equal(core.seriesContext({ books: null, series: {} }, 'anything'), null);
  assert.equal(core.defaultBookSlug(undefined), null);
  assert.equal(core.defaultBookSlug({ books: [null, {}, { slug: 'silent' }] }), null);
  assert.deepEqual(core.librarySections(null, 'anything'), { series: [], moreBooks: [] });

  const catalog = {
    books: [
      null,
      { slug: 'one', audio: { status: 'available' } },
      { slug: 'two', audio: { status: 'available' } },
      { slug: 'solo', audio: { status: 'none' } },
      { slug: 'one', audio: { status: 'available' } },
    ],
    series: [
      null,
      {
        id: 'first',
        volumes: [
          null,
          { number: 1, book: 'one' },
          { number: 2, book: 'one' },
          { number: 3, book: 'missing' },
          { number: 4 },
        ],
      },
      {
        id: 'second',
        volumes: [
          { number: 1, book: 'one' },
          { number: 2, book: 'two' },
        ],
      },
      { id: 'first', volumes: [{ number: 5, book: 'two' }] },
      { id: '', volumes: [{ number: 1, book: 'solo' }] },
    ],
  };

  assert.deepEqual(core.librarySections(catalog, 'one'), {
    series: [
      { id: 'first', books: ['one'] },
      { id: 'second', books: ['two'] },
    ],
    moreBooks: ['solo'],
  });
  assert.equal(core.seriesContext(catalog, 'one').series.id, 'first');
  assert.equal(core.seriesContext(catalog, 'two').series.id, 'second');
});

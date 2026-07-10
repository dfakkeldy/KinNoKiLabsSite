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

test('cover-only book yields null imageCue but live captions', () => {
  const blocks = [{ id: 't1', kind: 'paragraph', text: 'one two three', chapterIndex: 0, sequenceIndex: 0 }];
  const rows = [{ start: 0, end: 3, blockId: 't1', chapterIndex: 0, sequenceIndex: 0 }];
  const wordsByBlockId = new Map([['t1', core.interpolateWords('one two three', 0, 3)]]);
  const s = core.resolveSnapshot({ blocks, rows, wordsByBlockId, time: 1.6, syncPoint: 'midpoint' });
  assert.equal(s.imageCue, null);
  assert.equal(s.subtitleCue.blockId, 't1');
  assert.equal(s.subtitleCue.activeWordIndex, 1);
  assert.equal(s.subtitleCue.alreadyHeardWordCount, 1);
  assert.equal(s.activeBlockId, 't1');
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

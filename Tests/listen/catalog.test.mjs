import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const listenRoot = new URL('../../Resources/listen/', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('books.json', listenRoot), 'utf8'));
const builderSource = readFileSync(new URL('../../Tools/build-listen-catalog.sh', import.meta.url), 'utf8');
const expectedBooks = [
  'echo-from-the-inside',
  'why-it-feels-right',
  'you-are-the-architect',
  'the-bug-is-a-clue',
  'tests-first',
  'git-happens',
  'findable',
  'the-voice-in-the-machine',
  'chicken-predators',
  'rodents-in-the-walls',
  'the-new-deal',
];
const expectedPlayable = ['chicken-predators', 'rodents-in-the-walls', 'the-new-deal'];
const expectedAnchorCounts = new Map([
  ['chicken-predators', 231],
  ['rodents-in-the-walls', 245],
  ['the-new-deal', 151],
]);

test('catalog publishes the exact approved public library in order', () => {
  assert.deepEqual(catalog.books.map((book) => book.slug), expectedBooks);
});

test('catalog publishes exactly the three approved playable books with complete read-along assets', () => {
  const playable = catalog.books.filter((book) => book.audio.status === 'available');
  assert.deepEqual(playable.map((book) => book.slug), expectedPlayable);
  assert.match(catalog.source.commit, /^[0-9a-f]{40}$/);

  for (const book of playable) {
    assert.ok(book.durationSeconds > 0, `${book.slug} duration`);
    assert.ok(book.chapters.length > 0, `${book.slug} chapters`);
    assert.ok(book.cover && book.text?.blocks && book.alignment?.sidecar, `${book.slug} local assets`);
    assert.ok(book.links?.folder && book.links?.epub && book.links?.read, `${book.slug} links`);
    assert.equal(book.audio.mimeType, 'audio/mp4');
    assert.ok(book.audio.url.includes(`/${catalog.source.commit}/books/${book.slug}/${book.slug}.m4b`));

    const blocks = JSON.parse(readFileSync(new URL(book.text.blocks, listenRoot), 'utf8')).blocks;
    const anchors = JSON.parse(readFileSync(new URL(book.alignment.sidecar, listenRoot), 'utf8'));
    const blockIDs = new Set(blocks.map((block) => block.id));
    assert.ok(anchors.length > 0, `${book.slug} anchors are nonempty`);
    assert.equal(anchors.length, expectedAnchorCounts.get(book.slug), `${book.slug} anchor count`);
    assert.ok(anchors.every((anchor) => blockIDs.has(anchor.blockId)), `${book.slug} anchor parity`);
    assert.ok(anchors.every((anchor, index) => index === 0 || anchor.timestamp >= anchors[index - 1].timestamp));
  }
});

test('private books remain absent', () => {
  const slugs = catalog.books.map((book) => book.slug);
  assert.ok(!slugs.includes('the-long-route'));
  assert.ok(!slugs.includes('the-living-knowledge-base'));
});

test('builder requires exact playable approval and rejects unapproved media', () => {
  assert.match(builderSource, /if grep -Fxq "\$slug" <<<"\$AUDIO_EXPECTED"; then/);
  assert.match(builderSource, /approved playable book missing M4B: \$slug/);
  assert.match(builderSource, /approved playable book missing alignment sidecar: \$slug/);
  assert.match(builderSource, /unexpected playable media for non-audio-approved book: \$slug/);
});

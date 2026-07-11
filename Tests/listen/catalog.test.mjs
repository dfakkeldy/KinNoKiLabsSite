import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const listenRoot = new URL('../../Resources/listen/', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('books.json', listenRoot), 'utf8'));
const expectedPlayable = ['chicken-predators', 'rodents-in-the-walls', 'the-new-deal'];

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
    assert.ok(anchors.every((anchor) => blockIDs.has(anchor.blockId)), `${book.slug} anchor parity`);
    assert.ok(anchors.every((anchor, index) => index === 0 || anchor.timestamp >= anchors[index - 1].timestamp));
  }
});

test('private books remain absent', () => {
  const slugs = catalog.books.map((book) => book.slug);
  assert.ok(!slugs.includes('the-long-route'));
  assert.ok(!slugs.includes('the-living-knowledge-base'));
});

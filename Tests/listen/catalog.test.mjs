import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

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

function assertNoAbsolutePaths(value, location = 'JSON') {
  if (typeof value === 'string') {
    assert.ok(
      !value.startsWith('/') && !value.startsWith('file://') && !/^[A-Za-z]:[\\/]/.test(value),
      `${location}: ${value}`,
    );
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoAbsolutePaths(item, `${location}[${index}]`));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => assertNoAbsolutePaths(item, `${location}.${key}`));
  }
}

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

test('playable asset tree contains only approved books and complete generated files', () => {
  const assetRoot = new URL('books/', listenRoot);
  const assetEntries = readdirSync(assetRoot, { withFileTypes: true });
  assert.ok(assetEntries.every((entry) => entry.isDirectory()), 'asset root contains only book directories');
  const assetDirectories = assetEntries.map((entry) => entry.name).sort();

  assert.deepEqual(assetDirectories, [...expectedPlayable].sort());
  for (const slug of expectedPlayable) {
    const entries = readdirSync(new URL(`${slug}/`, assetRoot), { withFileTypes: true });
    assert.ok(entries.every((entry) => entry.isFile()), `${slug} contains only generated files`);
    const files = entries.map((entry) => entry.name).sort();
    assert.deepEqual(files, ['alignment.json', 'blocks.json', 'cover.jpg'], `${slug} generated files`);
  }
});

test('published catalog and generated JSON assets contain no absolute filesystem paths', () => {
  assertNoAbsolutePaths(catalog, 'books.json');
  for (const slug of expectedPlayable) {
    for (const file of ['alignment.json', 'blocks.json']) {
      const value = JSON.parse(readFileSync(new URL(`books/${slug}/${file}`, listenRoot), 'utf8'));
      assertNoAbsolutePaths(value, `${slug}/${file}`);
    }
  }
});

test('absolute path guard rejects file URLs', () => {
  assert.throws(
    () => assertNoAbsolutePaths({ path: 'file:///private/tmp/listen.json' }),
    /file:\/\/\/private\/tmp\/listen\.json/,
  );
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

test('builder validates full and no-blocks staged contracts independently', () => {
  assert.doesNotMatch(builderSource, /asset_dir="\$OUT_DIR\/books\/\$slug"/);
  assert.match(builderSource, /asset_dir="\$STAGED_BOOKS\/\$slug"/);
  assert.match(builderSource, /validate_staged_bundle/);
  assert.match(builderSource, /current_source_sha="\$\(git -C "\$BOOKS_REPO" rev-parse HEAD\)"/);
  assert.match(builderSource, /actual_catalog_slugs/);
  assert.match(builderSource, /expected_asset_entries="alignment\.json\ncover\.jpg"/);
  assert.match(builderSource, /staged no-blocks catalog text must be null/);
  assert.match(builderSource, /all\(range\(1; \$timestamps \| length\)/);
  assert.match(builderSource, /startswith\("file:\/\/"\)/);
  assert.match(builderSource, /listen_catalog_transaction_init "\$OUT_DIR"/);
});

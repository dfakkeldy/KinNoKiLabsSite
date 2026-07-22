import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const listenRoot = new URL('../../Resources/listen/', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('books.json', listenRoot), 'utf8'));
const builderSource = readFileSync(new URL('../../Tools/build-listen-catalog.sh', import.meta.url), 'utf8');
const seriesSource = JSON.parse(
  readFileSync(new URL('../../Tools/listen-series.json', import.meta.url), 'utf8'),
);
const FIRST_LISTEN_DISCLOSURE =
  "This edition has passed package and audio checks. The creator's full listening review is still underway.";
const expectedBooks = [
  'an-unsettling-conversation',
  'jspace-inside-the-machine',
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
  'is-there-anyone-in-here',
  'claude-platform-01-the-message',
  'claude-platform-02-thinking-and-reliable-responses',
  'claude-platform-03-giving-claude-tools',
  'beyond-the-tax-sale-packet',
];
const expectedPlayable = [...expectedBooks];
const expectedAnchorCounts = new Map([
  ['an-unsettling-conversation', 963],
  ['jspace-inside-the-machine', 755],
  ['echo-from-the-inside', 547],
  ['why-it-feels-right', 400],
  ['you-are-the-architect', 444],
  ['the-bug-is-a-clue', 525],
  ['tests-first', 223],
  ['git-happens', 461],
  ['findable', 263],
  ['the-voice-in-the-machine', 369],
  ['chicken-predators', 231],
  ['rodents-in-the-walls', 245],
  ['the-new-deal', 151],
  ['is-there-anyone-in-here', 139],
  ['claude-platform-01-the-message', 571],
  ['claude-platform-02-thinking-and-reliable-responses', 346],
  ['claude-platform-03-giving-claude-tools', 822],
  ['beyond-the-tax-sale-packet', 612],
]);
// Covers are NOT all one shape: approved player books with paired art are square
// because Tools/sync-paired-cover-assets.sh re-derives them from the paired
// square m4b art after the builder runs. The player sizes thumbnails from the
// published dimensions, so a wrong pair here crops real artwork.
const squareCovers = expectedBooks.filter((slug) => slug !== 'rodents-in-the-walls');
const expectedCoverSizes = new Map(
  expectedBooks.map((slug) => [
    slug,
    squareCovers.includes(slug) ? { width: 768, height: 768 } : { width: 480, height: 768 },
  ]),
);

// Read the real pixel dimensions out of the JPEG's SOF segment, so the catalog
// is checked against the staged bytes rather than against a restated constant.
function readJpegSize(url) {
  const buffer = readFileSync(url);
  assert.equal(buffer.readUInt16BE(0), 0xffd8, `${url}: missing JPEG SOI marker`);
  let offset = 2;
  while (offset < buffer.length) {
    assert.equal(buffer[offset], 0xff, `${url}: expected a segment marker at ${offset}`);
    let marker = buffer[offset + 1];
    while (marker === 0xff) {
      offset += 1;
      marker = buffer[offset + 1];
    }
    offset += 2;
    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) continue;
    const length = buffer.readUInt16BE(offset);
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  throw new Error(`${url}: no SOF segment found`);
}

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

test('catalog publishes the curated version 2 series exactly', () => {
  assert.equal(catalog.version, 2);
  assert.deepEqual(catalog.series, seriesSource.series);
  assert.equal(catalog.series.filter((series) => series.featured).length, 1);
  assert.equal(catalog.series[0].plannedVolumeCount, 9);
  assert.deepEqual(
    catalog.series[0].volumes.map((volume) => volume.book),
    [
      'claude-platform-01-the-message',
      'claude-platform-02-thinking-and-reliable-responses',
      'claude-platform-03-giving-claude-tools',
    ],
  );
});

test('public-first-listen books disclose their edition while legacy books remain unclassified', () => {
  const firstListenSlugs = new Set([
    'claude-platform-01-the-message',
    'claude-platform-02-thinking-and-reliable-responses',
    'claude-platform-03-giving-claude-tools',
    'beyond-the-tax-sale-packet',
  ]);
  for (const book of catalog.books) {
    if (firstListenSlugs.has(book.slug)) {
      assert.deepEqual(book.edition, {
        status: 'public-first-listen',
        humanListeningStatus: 'pending',
        disclosure: FIRST_LISTEN_DISCLOSURE,
      });
    } else {
      assert.equal(book.edition, null, `${book.slug} legacy edition`);
    }
  }
});

test('every public book carries a staged cover with alt text', () => {
  for (const book of catalog.books) {
    assert.equal(book.cover, `books/${book.slug}/cover.jpg`, `${book.slug} cover path`);
    assert.equal(book.coverAlt, `Cover of ${book.title}`, `${book.slug} cover alt`);
    assert.ok(statSync(new URL(book.cover, listenRoot)).isFile(), `${book.slug} staged cover`);
  }
});

test('every public book publishes integer cover dimensions matching its staged cover.jpg', () => {
  assert.equal(catalog.books.length, expectedBooks.length);
  for (const book of catalog.books) {
    assert.ok(
      Number.isInteger(book.coverWidth) && book.coverWidth > 0,
      `${book.slug} coverWidth is a positive integer: ${book.coverWidth}`,
    );
    assert.ok(
      Number.isInteger(book.coverHeight) && book.coverHeight > 0,
      `${book.slug} coverHeight is a positive integer: ${book.coverHeight}`,
    );
    assert.deepEqual(
      { width: book.coverWidth, height: book.coverHeight },
      readJpegSize(new URL(book.cover, listenRoot)),
      `${book.slug} declared dimensions match the staged cover bytes`,
    );
  }
});

test('paired square covers publish square dimensions and the rest stay portrait', () => {
  for (const book of catalog.books) {
    assert.deepEqual(
      { width: book.coverWidth, height: book.coverHeight },
      expectedCoverSizes.get(book.slug),
      `${book.slug} cover shape`,
    );
  }
  const squares = catalog.books
    .filter((book) => book.coverWidth === book.coverHeight)
    .map((book) => book.slug);
  assert.deepEqual(squares, squareCovers, 'exactly the paired-art books are square');
});

test('playable books declare interior figure counts with resolvable catalog-relative image paths', () => {
  const playable = catalog.books.filter((book) => book.audio.status === 'available');
  assert.deepEqual(playable.map((book) => book.slug), expectedPlayable);

  for (const book of playable) {
    assert.deepEqual(book.visuals, { figures: 0 }, `${book.slug} is cover-only today`);

    const blocks = JSON.parse(readFileSync(new URL(book.text.blocks, listenRoot), 'utf8')).blocks;
    const imageBlocks = blocks.filter((block) => block.kind === 'image');
    assert.ok(imageBlocks.length > 0, `${book.slug} has at least the cover image block`);

    const interior = imageBlocks.filter((block) => block.chapterIndex !== null);
    assert.equal(interior.length, book.visuals.figures, `${book.slug} figure count parity`);

    for (const block of imageBlocks) {
      if (block.chapterIndex === null) {
        assert.equal(block.imagePath, `books/${book.slug}/cover.jpg`, `${book.slug} cover image block path`);
      } else {
        assert.match(
          block.imagePath,
          new RegExp(`^books/${book.slug}/figures/[^/]+$`),
          `${book.slug} interior figure path shape`,
        );
      }
      assert.ok(
        statSync(new URL(block.imagePath, listenRoot)).isFile(),
        `${book.slug} image path resolves to a staged file: ${block.imagePath}`,
      );
    }
  }
});

test('catalog publishes exactly the approved playable books with complete read-along assets', () => {
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

test('asset tree contains every public book with exactly its expected generated files', () => {
  const assetRoot = new URL('books/', listenRoot);
  const assetEntries = readdirSync(assetRoot, { withFileTypes: true });
  assert.ok(assetEntries.every((entry) => entry.isDirectory()), 'asset root contains only book directories');
  const assetDirectories = assetEntries.map((entry) => entry.name).sort();

  assert.deepEqual(assetDirectories, [...expectedBooks].sort());
  for (const book of catalog.books) {
    const entries = readdirSync(new URL(`${book.slug}/`, assetRoot), { withFileTypes: true });
    const names = entries.map((entry) => entry.name).sort();
    if (book.audio.status === 'available') {
      const expected = book.visuals.figures > 0
        ? ['alignment.json', 'blocks.json', 'cover.jpg', 'figures']
        : ['alignment.json', 'blocks.json', 'cover.jpg'];
      assert.deepEqual(names, expected, `${book.slug} generated files`);
      for (const entry of entries) {
        if (entry.name === 'figures') {
          assert.ok(entry.isDirectory(), `${book.slug} figures is a directory`);
        } else {
          assert.ok(entry.isFile(), `${book.slug} ${entry.name} is a file`);
        }
      }
    } else {
      assert.deepEqual(names, ['cover.jpg'], `${book.slug} links-only assets`);
      assert.ok(entries.every((entry) => entry.isFile()), `${book.slug} contains only files`);
    }
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

test('builder verifies required public-first-listen receipts before staging', () => {
  assert.match(builderSource, /PUBLICATION_REQUIRED=/);
  assert.match(builderSource, /publication\.json/);
  assert.match(builderSource, /verify_public_first_listen\.py/);
  assert.match(builderSource, /publicationStatus/);
  assert.match(builderSource, /humanListeningStatus/);
  assert.match(builderSource, /disclosure/);
});

test('builder validates curated series before publishing the transaction', () => {
  assert.match(builderSource, /validate_series\(\)/);
  assert.match(builderSource, /# BEGIN VALIDATE_SERIES/);
  assert.match(builderSource, /# END VALIDATE_SERIES/);
  assert.match(builderSource, /validate_series "\$SERIES_SOURCE" "\$STAGED_CATALOG"/);
  assert.match(builderSource, /version: 2/);
  assert.match(builderSource, /series: \$series\[0\]\.series/);
  assert.match(builderSource, /books: \$books/);
});

test('builder validates full and no-blocks staged contracts independently', () => {
  assert.doesNotMatch(builderSource, /asset_dir="\$OUT_DIR\/books\/\$slug"/);
  assert.match(builderSource, /asset_dir="\$STAGED_BOOKS\/\$slug"/);
  assert.match(builderSource, /validate_staged_bundle/);
  assert.match(builderSource, /current_source_sha="\$\(git -C "\$BOOKS_REPO" rev-parse HEAD\)"/);
  assert.match(builderSource, /actual_catalog_slugs/);
  assert.match(builderSource, /expected_asset_entries="alignment\.json\ncover\.jpg"/);
  assert.match(builderSource, /staged no-blocks catalog text must be null/);
  assert.match(builderSource, /staged no-blocks catalog visuals must be null/);
  assert.match(builderSource, /all\(range\(1; \$timestamps \| length\)/);
  assert.match(builderSource, /startswith\("file:\/\/"\)/);
  assert.match(builderSource, /listen_catalog_transaction_init "\$OUT_DIR"/);
});

test('builder stages covers for every public book and validates the full allow-list tree', () => {
  assert.match(builderSource, /expected_asset_entries="cover\.jpg"/);
  assert.match(builderSource, /staged asset directories do not match the public allow-list/);
  assert.match(builderSource, /missing coverAlt for \$slug/);
  assert.match(builderSource, /invalid staged cover path for \$slug/);
});

test('builder emits and validates real cover dimensions for every book', () => {
  assert.match(builderSource, /coverWidth: \$coverWidth, coverHeight: \$coverHeight/);
  assert.match(builderSource, /cover_dimensions\(\)/);
  assert.match(builderSource, /coverWidth\/coverHeight must be positive integers for \$slug/);
  assert.match(builderSource, /do not match cover\.jpg/);
  // Both staging branches — playable and links-only — must measure their cover.
  assert.equal(builderSource.match(/cover_dims="\$\(cover_dimensions "\$asset_dir\/cover\.jpg"\)"/g)?.length, 2);
});

test('builder matches EPUB figure names without locale or escape mangling', () => {
  // zipinfo mangles non-ASCII names to '?' under the builder's own C locale,
  // and awk -v would expand escapes in a basename containing a backslash.
  assert.match(builderSource, /LC_ALL=en_US\.UTF-8 unzip -Z1/);
  assert.match(builderSource, /ENVIRON\["FIGURE_NAME"\]/);
  assert.doesNotMatch(builderSource, /awk -F\/ -v name=/);
  // Extraction must stay locale-independent.
  assert.doesNotMatch(builderSource, /LC_ALL=[^ ]* unzip -p/);
});

test('paired-cover sync repatches dimensions for the square player covers', () => {
  const syncSource = readFileSync(new URL('../../Tools/sync-paired-cover-assets.sh', import.meta.url), 'utf8');
  assert.match(syncSource, /\.coverWidth = \$provenance\[0\]\.books\[\.slug\]\.square\.derivativeDimensions\[0\]/);
  assert.match(syncSource, /\.coverHeight = \$provenance\[0\]\.books\[\.slug\]\.square\.derivativeDimensions\[1\]/);
  assert.match(syncSource, /wrong player derivative dimensions for \$slug/);
  assert.match(syncSource, /do not match the installed cover/);
  // The hash/receipt verification this script exists for must remain intact.
  assert.match(syncSource, /\.coverSourceSha256 = \$provenance\[0\]\.books\[\.slug\]\.square\.sourceSha256/);
  assert.match(syncSource, /\.coverDerivativeSha256 = \$provenance\[0\]\.books\[\.slug\]\.square\.derivativeSha256/);
});

test('builder stages interior figures fail-closed and pins the slideshow data contract', () => {
  assert.match(builderSource, /figure not found in EPUB/);
  assert.match(builderSource, /figure basename is ambiguous in EPUB/);
  assert.match(builderSource, /exceeds the 20 MB Cloudflare Pages guardrail/);
  assert.match(builderSource, /figure is larger than 2 MB/);
  assert.match(builderSource, /"books\/\$slug\/figures\/"/);
  assert.match(builderSource, /\{figures: \$figures\}/);
  assert.match(builderSource, /does not resolve to a staged file/);
  assert.match(builderSource, /does not match interior image blocks/);
});

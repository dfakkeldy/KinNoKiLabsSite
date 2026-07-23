import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const provenance = JSON.parse(readFileSync(path.join(root, 'Resources/learn/paired-cover-provenance.json')));
const sourceManifest = JSON.parse(readFileSync(path.join(root, 'Resources/learn/paired-cover-source-manifest.json')));
const catalog = JSON.parse(readFileSync(path.join(root, 'Resources/listen/books.json')));
const syncSource = readFileSync(path.join(root, 'Tools/sync-paired-cover-assets.sh'), 'utf8');

const portraitSlugs = [
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
  'rodents-in-the-walls',
  'chicken-predators',
  'the-new-deal',
  'is-there-anyone-in-here',
  'claude-platform-01-the-message',
  'claude-platform-02-thinking-and-reliable-responses',
  'claude-platform-03-giving-claude-tools',
  'beyond-the-tax-sale-packet',
];
const migratedPlayerSlugs = portraitSlugs.filter((slug) => slug !== 'rodents-in-the-walls');
const legacyPairSlugs = new Set([
  'you-are-the-architect',
  'the-bug-is-a-clue',
  'tests-first',
  'git-happens',
  'the-voice-in-the-machine',
]);

function hash(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function dimensions(file) {
  const output = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
  return [
    Number(output.match(/pixelWidth: (\d+)/)[1]),
    Number(output.match(/pixelHeight: (\d+)/)[1]),
  ];
}

test('all paired covers are verified 1600 by 2560 portraits', () => {
  assert.equal(sourceManifest.schemaVersion, 2);
  assert.equal(sourceManifest.sourceCommit, '4cedf19540bc128edc7561333a95facddb05e31a');
  assert.equal(provenance.source.commit, sourceManifest.sourceCommit);
  assert.deepEqual(Object.keys(provenance.books), portraitSlugs);
  for (const slug of portraitSlugs) {
    const file = path.join(root, `Resources/learn/covers/${slug}.png`);
    const entry = provenance.books[slug];
    assert.deepEqual(dimensions(file), [1600, 2560]);
    assert.equal(hash(file), entry.portrait.sourceSha256);
    assert.match(entry.selectionReceiptSha256, /^[a-f0-9]{64}$/);
    assert.equal(entry.receiptKind, sourceManifest.books[slug].receiptKind);
    if (legacyPairSlugs.has(slug)) {
      assert.equal(entry.receiptKind, 'legacy-cover-pair-v1');
    }
  }
});

test('migrated playable books use square derivatives tied to canonical square hashes', () => {
  for (const slug of migratedPlayerSlugs) {
    const book = catalog.books.find((candidate) => candidate.slug === slug);
    const file = path.join(root, `Resources/listen/books/${slug}/cover.jpg`);
    const entry = provenance.books[slug].square;
    assert.deepEqual(dimensions(file), [768, 768]);
    assert.equal(hash(file), entry.derivativeSha256);
    assert.equal(book.coverSourceSha256, entry.sourceSha256);
    assert.equal(book.coverDerivativeSha256, entry.derivativeSha256);
  }
});

test('Rodents keeps its existing player derivative and legacy receipt identity', () => {
  const book = catalog.books.find((candidate) => candidate.slug === 'rodents-in-the-walls');
  assert.equal(provenance.books['rodents-in-the-walls'].receiptKind, 'legacy-selection-v1');
  assert.equal(provenance.books['rodents-in-the-walls'].receiptSchemaVersion, 1);
  assert.equal(provenance.books['rodents-in-the-walls'].square, null);
  assert.equal(book.coverSourceSha256, undefined);
});

test('recovery receipts pin the EPUB archive and its embedded cover identity', () => {
  assert.match(syncSource, /\.portrait\.epub_sha256 == \$epubSha/);
  assert.match(syncSource, /recovery EPUB cover member mismatch/);
  assert.match(syncSource, /verify_hash "recovery EPUB cover"/);
});

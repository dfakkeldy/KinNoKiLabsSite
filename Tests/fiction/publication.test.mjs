import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePublication, matchesNarration } from '../../Tools/fiction-publication.mjs';

function classic(slug = 'merchant-of-venice-play') {
  return {
    slug, schemaVersion: 1, packageKind: 'classic-adaptation',
    editionId: '20261004T050000Z', permissionToPublish: true,
    publicationStatus: 'public-first-listen', originalAuthor: 'William Shakespeare',
    source: { status: 'public-domain' },
    licenses: { recordingNotice: 'AUDIO-LICENSE.md' },
    files: Object.fromEntries([
      `${slug}.epub`, `${slug}.md`, `${slug}.alignment.json`, 'cover.png',
      'LICENSE-CONTENT.md', 'AUDIO-LICENSE.md', 'CREDITS.md',
    ].map(file => [file, { sha256: 'a'.repeat(64), sizeBytes: 100 }])),
  };
}

test('the two approved classic packages adapt their file receipts without losing hashes', () => {
  for (const slug of ['merchant-of-venice-play', 'merchant-of-venice-novel']) {
    const receipt = classic(slug);
    const result = normalizePublication(receipt, slug);
    assert.equal(result.artifacts.epub.file, `${slug}.epub`);
    assert.equal(result.artifacts.alignment.file, `${slug}.alignment.json`);
    assert.equal(result.artifacts.manuscript.file, `${slug}.md`);
    assert.equal(result.artifacts.cover.file, 'cover.png');
    assert.equal(Object.keys(result.artifacts).length, Object.keys(receipt.files).length);
    for (const entry of Object.values(result.artifacts)) {
      assert.deepEqual({ sha256: entry.sha256, sizeBytes: entry.sizeBytes }, receipt.files[entry.file]);
    }
    assert.equal(receipt.artifacts, undefined, 'the original receipt is not mutated');
  }
});

test('classic staging refuses private, unapproved, other-edition and incomplete packages', () => {
  for (const change of [
    { permissionToPublish: false }, { publicationStatus: 'private' },
    { editionId: 'another-edition' }, { originalAuthor: 'Another author' },
    { source: { status: 'unknown' } }, { licenses: {} }, { files: {} },
    { publicGate: { privacy: false } },
  ]) {
    assert.throws(() => normalizePublication({ ...classic(), ...change }, 'merchant-of-venice-play'));
  }
  assert.throws(() => normalizePublication(classic('unapproved-classic'), 'unapproved-classic'));
  assert.throws(() => normalizePublication(classic(), 'merchant-of-venice-novel'));
});

test('the existing original-fiction publication gates still fail closed', () => {
  const receipt = { slug: 'original-novel', permissionToPublish: true,
    classification: 'public-safe', publicGate: { privacy: true }, artifacts: { epub: { file: 'book.epub' } } };
  assert.deepEqual(normalizePublication(receipt, receipt.slug), receipt);
  assert.throws(() => normalizePublication({ ...receipt, classification: 'private' }, receipt.slug));
  assert.throws(() => normalizePublication({ ...receipt, publicGate: { privacy: false } }, receipt.slug));
});

test('only Merchant play chapter headings allow the documented spoken act-number spelling', () => {
  const block = { id: 's2-b0', kind: 'heading', chapterIndex: 0,
    text: 'Act IV — Scene I. Venice. A court of justice.' };
  const spoken = 'Act 4 , Scene I. Venice. A court of justice.';
  assert.equal(matchesNarration('merchant-of-venice-play', block, spoken), true);
  assert.equal(block.text, 'Act IV — Scene I. Venice. A court of justice.');
  assert.equal(matchesNarration('merchant-of-venice-play', block, block.text), true);
  assert.equal(matchesNarration('merchant-of-venice-novel', block, spoken), false);
  assert.equal(matchesNarration('merchant-of-venice-play', { ...block, kind: 'paragraph' }, spoken), false);
  assert.equal(matchesNarration('merchant-of-venice-play', { ...block, id: 's2-b1' }, spoken), false);
  assert.equal(matchesNarration('merchant-of-venice-play', { ...block, chapterIndex: null }, spoken), false);
  assert.equal(matchesNarration('merchant-of-venice-play', block, spoken.replace('Venice', 'Belmont')), false);
  assert.equal(matchesNarration('merchant-of-venice-play', block, spoken.replace('Act 4', 'Act 5')), false);
});

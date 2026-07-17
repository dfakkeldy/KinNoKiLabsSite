import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(root, 'Tools/sync-paired-cover-assets.sh');
const slugs = [
  'an-unsettling-conversation', 'jspace-inside-the-machine',
  'echo-from-the-inside', 'why-it-feels-right', 'findable',
  'rodents-in-the-walls', 'chicken-predators', 'the-new-deal',
  'is-there-anyone-in-here',
];
const candidates = {
  'an-unsettling-conversation': 'cut-in-the-page',
  'jspace-inside-the-machine': 'learned-watershed',
  'echo-from-the-inside': 'rooms-inside-the-app',
  'why-it-feels-right': 'impossible-teapot',
  findable: 'exact-phrase',
  'rodents-in-the-walls': 'c2a-compact-ribbon-editorial-footer',
  'chicken-predators': 'night-at-the-fence',
  'the-new-deal': 'weight-of-the-mailbag',
  'is-there-anyone-in-here': 'one-lit-aperture',
};

const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const run = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: 'utf8' }).trim();

function writeJSON(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeFixture() {
  const base = mkdtempSync(path.join(os.tmpdir(), 'paired-cover-sync-test.'));
  const booksRepo = path.join(base, 'books-repo');
  const output = path.join(base, 'output');
  const manifest = { schemaVersion: 1, sourceCommit: '', books: {} };
  mkdirSync(path.join(booksRepo, 'books'), { recursive: true });
  mkdirSync(path.join(output, 'learn'), { recursive: true });
  mkdirSync(path.join(output, 'listen-books', 'chicken-predators'), { recursive: true });
  mkdirSync(path.join(output, 'listen-books', 'the-new-deal'), { recursive: true });
  mkdirSync(path.join(output, 'listen-books', 'an-unsettling-conversation'), { recursive: true });
  mkdirSync(path.join(output, 'listen-books', 'jspace-inside-the-machine'), { recursive: true });
  mkdirSync(path.join(output, 'listen-books', 'is-there-anyone-in-here'), { recursive: true });
  cpSync(path.join(root, 'Resources/listen/books.json'), path.join(output, 'books.json'));
  writeFileSync(path.join(output, 'learn', 'keep.txt'), 'learn-before\n');
  writeFileSync(path.join(output, 'listen-books', 'keep.txt'), 'listen-before\n');

  for (const slug of slugs) {
    const dir = path.join(booksRepo, 'books', slug);
    mkdirSync(dir, { recursive: true });
    const portrait = path.join(dir, 'cover.png');
    const square = path.join(dir, 'm4b-cover.png');
    const portraitSpec = path.join(dir, 'cover-spec.json');
    const squareSpec = path.join(dir, 'm4b-cover-spec.json');
    const receipt = path.join(dir, 'cover-selection.json');
    cpSync(path.join(root, 'Resources/learn/covers', `${slug}.png`), portrait);
    execFileSync('sips', ['-s', 'format', 'png', '-z', '2400', '2400', portrait, '--out', square], { stdio: 'ignore' });
    writeJSON(portraitSpec, { fixture: slug, variant: 'portrait' });
    writeJSON(squareSpec, { fixture: slug, variant: 'square' });
    const entry = {
      receiptSha256: '', candidateId: candidates[slug],
      portrait: { sha256: hash(portrait), specSha256: hash(portraitSpec) },
      square: slug === 'rodents-in-the-walls' ? null : { sha256: hash(square), specSha256: hash(squareSpec) },
    };
    if (slug === 'rodents-in-the-walls') {
      writeJSON(receipt, {
        schema_version: 1, book_slug: slug, selected_candidate: candidates[slug],
        rendered_cover_sha256: entry.portrait.sha256, spec_sha256: entry.portrait.specSha256,
        privacy: { classification: 'public-safe', permission_to_publish: 'granted' },
      });
    } else {
      writeJSON(receipt, {
        schema_version: 2, book_slug: slug, candidate: { id: candidates[slug] },
        privacy: { classification: 'public-safe', permission_to_publish: true },
        variants: {
          portrait: { cover_sha256: entry.portrait.sha256, specification_sha256: entry.portrait.specSha256 },
          square: { cover_sha256: entry.square.sha256, specification_sha256: entry.square.specSha256 },
        },
      });
    }
    entry.receiptSha256 = hash(receipt);
    manifest.books[slug] = entry;
  }

  run('git', ['init', '-q'], booksRepo);
  run('git', ['add', 'books'], booksRepo);
  run('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', 'fixture'], booksRepo);
  manifest.sourceCommit = run('git', ['rev-parse', 'HEAD'], booksRepo);
  const manifestPath = path.join(base, 'manifest.json');
  writeJSON(manifestPath, manifest);
  return { base, booksRepo, output, manifest, manifestPath };
}

function commitFixture(fixture) {
  run('git', ['add', 'books'], fixture.booksRepo);
  run('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', 'mutation'], fixture.booksRepo);
  fixture.manifest.sourceCommit = run('git', ['rev-parse', 'HEAD'], fixture.booksRepo);
  writeJSON(fixture.manifestPath, fixture.manifest);
}

function invoke(fixture, extra = {}) {
  return spawnSync(script, [], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      BOOKS_REPO: fixture.booksRepo,
      SOURCE_MANIFEST_PATH: fixture.manifestPath,
      LEARN_ROOT: path.join(fixture.output, 'learn'),
      CATALOG_PATH: path.join(fixture.output, 'books.json'),
      LISTEN_BOOKS_ROOT: path.join(fixture.output, 'listen-books'),
      ...extra,
    },
  });
}

function treeHash(directory) {
  const entries = [];
  function visit(current) {
    for (const name of readdirSync(current).sort()) {
      const file = path.join(current, name);
      if (statSync(file).isDirectory()) visit(file);
      else entries.push(`${path.relative(directory, file)}:${hash(file)}`);
    }
  }
  visit(directory);
  return createHash('sha256').update(entries.join('\n')).digest('hex');
}

test('paired cover sync fails closed for every reviewed negative contract', async (t) => {
  await t.test('rejects a legacy Rodents privacy refusal', () => {
    const f = makeFixture();
    try {
      const receipt = path.join(f.booksRepo, 'books/rodents-in-the-walls/cover-selection.json');
      const value = JSON.parse(readFileSync(receipt));
      value.privacy.permission_to_publish = 'refused';
      writeJSON(receipt, value);
      f.manifest.books['rodents-in-the-walls'].receiptSha256 = hash(receipt);
      commitFixture(f);
      const result = invoke(f);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Rodents.*privacy|public publication/i);
    } finally { rmSync(f.base, { recursive: true, force: true }); }
  });

  await t.test('rejects a substituted receipt even at the pinned commit', () => {
    const f = makeFixture();
    try {
      const receipt = path.join(f.booksRepo, 'books/echo-from-the-inside/cover-selection.json');
      const value = JSON.parse(readFileSync(receipt));
      value.candidate.direction_name = 'substituted';
      writeJSON(receipt, value);
      commitFixture(f);
      const result = invoke(f);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /receipt hash mismatch/i);
    } finally { rmSync(f.base, { recursive: true, force: true }); }
  });

  await t.test('rejects a receipt slug mismatch', () => {
    const f = makeFixture();
    try {
      const receipt = path.join(f.booksRepo, 'books/findable/cover-selection.json');
      const value = JSON.parse(readFileSync(receipt));
      value.book_slug = 'wrong-slug';
      writeJSON(receipt, value);
      f.manifest.books.findable.receiptSha256 = hash(receipt);
      commitFixture(f);
      const result = invoke(f);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /receipt slug mismatch/i);
    } finally { rmSync(f.base, { recursive: true, force: true }); }
  });

  await t.test('rejects a locally edited tracked specification', () => {
    const f = makeFixture();
    try {
      writeJSON(path.join(f.booksRepo, 'books/chicken-predators/cover-spec.json'), { substituted: true });
      const result = invoke(f);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /locally modified/i);
    } finally { rmSync(f.base, { recursive: true, force: true }); }
  });

  await t.test('rejects wrong canonical dimensions', () => {
    const f = makeFixture();
    try {
      const dir = path.join(f.booksRepo, 'books/why-it-feels-right');
      cpSync(path.join(dir, 'm4b-cover.png'), path.join(dir, 'cover.png'));
      const receipt = path.join(dir, 'cover-selection.json');
      const value = JSON.parse(readFileSync(receipt));
      value.variants.portrait.cover_sha256 = hash(path.join(dir, 'cover.png'));
      writeJSON(receipt, value);
      f.manifest.books['why-it-feels-right'].portrait.sha256 = value.variants.portrait.cover_sha256;
      f.manifest.books['why-it-feels-right'].receiptSha256 = hash(receipt);
      commitFixture(f);
      const result = invoke(f);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /wrong portrait dimensions/i);
    } finally { rmSync(f.base, { recursive: true, force: true }); }
  });

  await t.test('rejects a changed Rodents candidate', () => {
    const f = makeFixture();
    try {
      const receipt = path.join(f.booksRepo, 'books/rodents-in-the-walls/cover-selection.json');
      const value = JSON.parse(readFileSync(receipt));
      value.selected_candidate = 'mutated-rodents';
      writeJSON(receipt, value);
      f.manifest.books['rodents-in-the-walls'].receiptSha256 = hash(receipt);
      commitFixture(f);
      const result = invoke(f);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /candidate.*mismatch|approved candidate changed/i);
    } finally { rmSync(f.base, { recursive: true, force: true }); }
  });

  await t.test('rolls back every installed path after a forced rename failure', () => {
    const f = makeFixture();
    try {
      const before = treeHash(f.output);
      const result = invoke(f, { PAIRED_COVER_FAIL_AFTER_RENAME: '2' });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /forced install failure/i);
      assert.equal(treeHash(f.output), before);
    } finally { rmSync(f.base, { recursive: true, force: true }); }
  });
});

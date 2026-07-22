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
  'echo-from-the-inside', 'why-it-feels-right',
  'you-are-the-architect', 'the-bug-is-a-clue', 'tests-first',
  'git-happens', 'findable', 'the-voice-in-the-machine',
  'rodents-in-the-walls', 'chicken-predators', 'the-new-deal',
  'is-there-anyone-in-here', 'claude-platform-01-the-message',
  'claude-platform-02-thinking-and-reliable-responses',
  'claude-platform-03-giving-claude-tools',
  'beyond-the-tax-sale-packet',
];
const candidates = {
  'an-unsettling-conversation': 'cut-in-the-page',
  'jspace-inside-the-machine': 'learned-watershed',
  'echo-from-the-inside': 'rooms-inside-the-app',
  'why-it-feels-right': 'impossible-teapot',
  'you-are-the-architect': 'directed-construction',
  'the-bug-is-a-clue': 'revealing-shadow',
  'tests-first': 'safety-block',
  'git-happens': 'the-deliberate-knot',
  findable: 'exact-phrase',
  'the-voice-in-the-machine': 'sentence-to-sound',
  'rodents-in-the-walls': 'c2a-compact-ribbon-editorial-footer',
  'chicken-predators': 'night-at-the-fence',
  'the-new-deal': 'weight-of-the-mailbag',
  'is-there-anyone-in-here': 'one-lit-aperture',
  'claude-platform-01-the-message': 'route-and-return',
  'claude-platform-02-thinking-and-reliable-responses': 'event-by-event',
  'claude-platform-03-giving-claude-tools': 'application-keeps-key',
  'beyond-the-tax-sale-packet': 'packet-lifts',
};
const recoverySlugs = new Set([
  'you-are-the-architect', 'the-bug-is-a-clue', 'tests-first',
  'git-happens', 'the-voice-in-the-machine',
]);

const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const run = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: 'utf8' }).trim();

function writeJSON(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeFixture() {
  const base = mkdtempSync(path.join(os.tmpdir(), 'paired-cover-sync-test.'));
  const booksRepo = path.join(base, 'books-repo');
  const output = path.join(base, 'output');
  const squareTemplate = path.join(base, 'square.png');
  const manifest = { schemaVersion: 2, sourceCommit: '', books: {} };
  mkdirSync(path.join(booksRepo, 'books'), { recursive: true });
  mkdirSync(path.join(output, 'learn'), { recursive: true });
  mkdirSync(path.join(output, 'listen-books'), { recursive: true });
  cpSync(path.join(root, 'Resources/listen/books.json'), path.join(output, 'books.json'));
  execFileSync('sips', [
    '-s', 'format', 'png', '-z', '2400', '2400',
    path.join(root, 'Resources/learn/covers/an-unsettling-conversation.png'),
    '--out', squareTemplate,
  ], { stdio: 'ignore' });
  writeFileSync(path.join(output, 'learn', 'keep.txt'), 'learn-before\n');
  writeFileSync(path.join(output, 'listen-books', 'keep.txt'), 'listen-before\n');

  for (const slug of slugs) {
    const dir = path.join(booksRepo, 'books', slug);
    mkdirSync(dir, { recursive: true });
    const portrait = path.join(dir, 'cover.png');
    const square = path.join(dir, 'm4b-cover.png');
    const portraitSpec = path.join(dir, 'cover-spec.json');
    const squareSpec = path.join(dir, 'm4b-cover-spec.json');
    cpSync(path.join(root, 'Resources/learn/covers', `${slug}.png`), portrait);
    writeJSON(portraitSpec, { fixture: slug, variant: 'portrait' });
    const portraitHash = hash(portrait);

    if (slug === 'rodents-in-the-walls') {
      const receipt = path.join(dir, 'cover-selection.json');
      writeJSON(receipt, {
        schema_version: 1, book_slug: slug, selected_candidate: candidates[slug],
        rendered_cover_sha256: portraitHash, spec_sha256: hash(portraitSpec),
        privacy: { classification: 'public-safe', permission_to_publish: 'granted' },
      });
      manifest.books[slug] = {
        receiptKind: 'legacy-selection-v1', receiptPath: 'cover-selection.json',
        receiptSha256: hash(receipt), candidateId: candidates[slug],
        portrait: { sha256: portraitHash, specSha256: hash(portraitSpec) },
        square: null,
      };
    } else if (recoverySlugs.has(slug)) {
      const receipt = path.join(dir, 'legacy-cover-pair.json');
      const renderReceipt = path.join(dir, 'm4b-cover.render.json');
      const epub = path.join(dir, `${slug}.epub`);
      const epubMember = 'OEBPS/cover.png';
      const epubRoot = path.join(dir, 'OEBPS');
      mkdirSync(epubRoot);
      cpSync(portrait, path.join(epubRoot, 'cover.png'));
      execFileSync('zip', ['-q', epub, epubMember], { cwd: dir });
      rmSync(epubRoot, { recursive: true });
      cpSync(squareTemplate, square);
      writeJSON(squareSpec, { fixture: slug, variant: 'square' });
      writeJSON(renderReceipt, { fixture: slug, renderer: 'paired-cover-sync-test' });
      writeJSON(receipt, {
        schema_version: 1,
        book_slug: slug,
        candidate_id: candidates[slug],
        privacy: { classification: 'public-safe', permission_to_publish: true },
        portrait: {
          path: 'cover.png', dimensions: [1600, 2560], sha256: portraitHash,
          epub_path: `${slug}.epub`, epub_sha256: hash(epub),
          epub_cover_member: epubMember, epub_cover_sha256: portraitHash,
        },
        square: {
          path: 'm4b-cover.png', dimensions: [2400, 2400], sha256: hash(square),
          spec_path: 'm4b-cover-spec.json', spec_sha256: hash(squareSpec),
          render_path: 'm4b-cover.render.json', render_sha256: hash(renderReceipt),
        },
      });
      manifest.books[slug] = {
        receiptKind: 'legacy-cover-pair-v1', receiptPath: 'legacy-cover-pair.json',
        receiptSha256: hash(receipt), candidateId: candidates[slug],
        portrait: {
          sha256: portraitHash, epubSha256: hash(epub), epubMember,
          epubCoverSha256: portraitHash,
        },
        square: {
          sha256: hash(square), specSha256: hash(squareSpec),
          renderSha256: hash(renderReceipt),
        },
      };
    } else {
      const receipt = path.join(dir, 'cover-selection.json');
      cpSync(squareTemplate, square);
      writeJSON(squareSpec, { fixture: slug, variant: 'square' });
      writeJSON(receipt, {
        schema_version: 2, book_slug: slug, candidate: { id: candidates[slug] },
        privacy: { classification: 'public-safe', permission_to_publish: true },
        variants: {
          portrait: { cover_sha256: portraitHash, specification_sha256: hash(portraitSpec) },
          square: { cover_sha256: hash(square), specification_sha256: hash(squareSpec) },
        },
      });
      manifest.books[slug] = {
        receiptKind: 'cover-selection-v2', receiptPath: 'cover-selection.json',
        receiptSha256: hash(receipt), candidateId: candidates[slug],
        portrait: {
          sha256: portraitHash, specSha256: hash(portraitSpec),
          receiptSpecSha256: hash(portraitSpec),
        },
        square: {
          sha256: hash(square), specSha256: hash(squareSpec),
          receiptSpecSha256: hash(squareSpec),
        },
      };
    }
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
  await t.test('installs every receipt family and is byte-identical when repeated', () => {
    const f = makeFixture();
    try {
      const first = invoke(f);
      assert.equal(first.status, 0, first.stderr);
      assert.match(first.stdout, /18 portrait covers and 17 square player derivatives/);
      const provenance = JSON.parse(readFileSync(path.join(f.output, 'learn/paired-cover-provenance.json')));
      assert.equal(provenance.books['an-unsettling-conversation'].receiptKind, 'cover-selection-v2');
      assert.equal(provenance.books['you-are-the-architect'].receiptKind, 'legacy-cover-pair-v1');
      assert.equal(provenance.books['rodents-in-the-walls'].receiptKind, 'legacy-selection-v1');
      const afterFirst = treeHash(f.output);
      const second = invoke(f);
      assert.equal(second.status, 0, second.stderr);
      assert.equal(treeHash(f.output), afterFirst);
    } finally { rmSync(f.base, { recursive: true, force: true }); }
  });

  await t.test('rejects a recovery receipt with the wrong EPUB member', () => {
    const f = makeFixture();
    try {
      const slug = 'you-are-the-architect';
      const receipt = path.join(f.booksRepo, `books/${slug}/legacy-cover-pair.json`);
      const value = JSON.parse(readFileSync(receipt));
      value.portrait.epub_cover_member = 'OEBPS/wrong-cover.png';
      writeJSON(receipt, value);
      f.manifest.books[slug].receiptSha256 = hash(receipt);
      commitFixture(f);
      const result = invoke(f);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /recovery EPUB cover member mismatch/i);
    } finally { rmSync(f.base, { recursive: true, force: true }); }
  });

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

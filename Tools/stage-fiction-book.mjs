#!/usr/bin/env node
/* Stage one narrated fiction book into Resources/fiction/.
 *
 *   node Tools/stage-fiction-book.mjs the-human-exception
 *
 * The fiction catalog is hand-curated, but the read-along assets are not
 * hand-authorable: blocks.json has to carry the exact block ids Echo's
 * aligner emitted, or every caption silently fails to resolve. This
 * derives them from the published EPUB and proves the derivation against
 * the alignment sidecar before writing anything.
 *
 * Sources, all from the public book package in dfakkeldy/explainer-audiobooks:
 *   publication.json  receipt — artifact hashes and the release pointer
 *   <slug>.epub       manuscript, the source of block ids and text
 *   <slug>.alignment.json  word timings, keyed by block id
 *   the release asset <slug>.m4b  duration and chapter windows (ffprobe)
 *
 * Fails closed: a hash mismatch, an unresolved anchor, a block whose text
 * disagrees with what was spoken, or a non-public package stops the run
 * with nothing written.
 *
 * Env:
 *   BOOKS_REPO  local explainer-audiobooks checkout (default ~/Developer/explainer-audiobooks)
 *   BOOKS_REF   git ref to read the package from (default origin/main)
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const slug = process.argv[2];
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  fail('usage: node Tools/stage-fiction-book.mjs <slug>');
}

const repo = process.env.BOOKS_REPO || path.join(homedir(), 'Developer/explainer-audiobooks');
const ref = process.env.BOOKS_REF || 'origin/main';
const siteRoot = new URL('../', import.meta.url);
const catalogPath = new URL('Resources/fiction/books.json', siteRoot);
const assetDir = new URL(`Resources/fiction/books/${slug}/`, siteRoot);

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function show(file) {
  try {
    return execFileSync('git', ['-C', repo, 'show', `${ref}:books/${slug}/${file}`],
      { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 });
  } catch {
    return fail(`cannot read books/${slug}/${file} at ${ref} in ${repo}`);
  }
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/* ── The receipt gates everything else ─────────────────── */

const receipt = JSON.parse(show('publication.json').toString('utf8'));
if (receipt.slug !== slug) fail(`receipt slug ${receipt.slug} does not match ${slug}`);
if (receipt.permissionToPublish !== true) fail('receipt does not grant permission to publish');
if (receipt.classification !== 'public-safe') fail(`classification is ${receipt.classification}`);
for (const [gate, value] of Object.entries(receipt.publicGate || {})) {
  if (value !== true) fail(`public gate ${gate} is not satisfied`);
}

const artifacts = {};
for (const [name, entry] of Object.entries(receipt.artifacts)) {
  const bytes = show(entry.file);
  const digest = sha256(bytes);
  if (digest !== entry.sha256) fail(`${entry.file} hash ${digest} != receipt ${entry.sha256}`);
  artifacts[name] = bytes;
}
console.log(`receipt verified — ${Object.keys(artifacts).length} artifacts match their hashes`);

/* ── Blocks, derived from the EPUB spine ───────────────── */

/* Echo ids a block as s<spineIndex>-b<indexWithinSpineItem>, counting
   headings and paragraphs in document order. Reproducing that exactly is
   the whole job; the alignment check below is what proves we did. */

const epub = artifacts.epub;
const files = unzip(epub);
const container = files.get('META-INF/container.xml').toString('utf8');
const opfPath = container.match(/full-path="([^"]+)"/)[1];
const opfDir = path.posix.dirname(opfPath);
const opf = files.get(opfPath).toString('utf8');

const manifest = new Map(
  [...opf.matchAll(/<item\b[^>]*\/?>/g)].map((m) => [
    m[0].match(/id="([^"]+)"/)?.[1],
    m[0].match(/href="([^"]+)"/)?.[1],
  ]),
);
const spine = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map((m) => m[1]);

const entities = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&', nbsp: ' ' };
const textOf = (html) => html
  .replace(/<[^>]+>/g, '')
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&([a-z]+);/gi, (m, name) => entities[name.toLowerCase()] ?? m)
  .replace(/\s+/g, ' ')
  .trim();

const blocks = [];
let sequenceIndex = 0;
let chapterIndex = 0;

spine.forEach((idref, spineIndex) => {
  const href = manifest.get(idref);
  if (!href) fail(`spine item ${idref} is not in the manifest`);
  const doc = files.get(path.posix.join(opfDir, href));
  if (!doc) fail(`spine document ${href} is missing from the EPUB`);
  const html = doc.toString('utf8');
  const body = html.slice(html.indexOf('<body'));

  const isCover = /<img\b/i.test(body) && spineIndex === 0;
  if (isCover) {
    // The cover renders from the catalog's own staged artwork, not from
    // the EPUB's copy, so the room shows one cover everywhere.
    blocks.push({
      chapterIndex: null,
      id: `s${spineIndex}-b0`,
      imagePath: `books/${slug}/cover.jpg`,
      kind: 'image',
      sequenceIndex: sequenceIndex++,
      text: '',
      wordCount: 1,
    });
    return;
  }

  const found = [...body.matchAll(/<(h[1-6]|p)\b[^>]*>([\s\S]*?)<\/\1>/g)];
  if (found.length === 0) return;

  // Front matter carries no chapter; chapters number from zero in spine order.
  const isChapter = /epub:type="chapter"/.test(body);
  const chapter = isChapter ? chapterIndex++ : null;

  found.forEach((match, blockIndex) => {
    const text = textOf(match[2]);
    blocks.push({
      chapterIndex: chapter,
      id: `s${spineIndex}-b${blockIndex}`,
      kind: match[1][0] === 'h' ? 'heading' : 'paragraph',
      sequenceIndex: sequenceIndex++,
      text,
      wordCount: text.length === 0 ? 0 : text.split(/\s+/).length,
    });
  });
});

console.log(`extracted ${blocks.length} blocks across ${spine.length} spine items, ${chapterIndex} chapters`);

/* ── Prove the derivation against the sidecar ──────────── */

const anchors = JSON.parse(artifacts.alignment.toString('utf8'));
const byId = new Map(blocks.map((b) => [b.id, b]));

const unresolved = anchors.filter((a) => !byId.has(a.blockId));
if (unresolved.length > 0) {
  fail(`${unresolved.length} sidecar anchors do not resolve to a block ` +
    `(first: ${unresolved[0].blockId}) — the block id scheme does not match this EPUB`);
}

let mismatches = 0;
let firstMismatch = null;
for (const anchor of anchors) {
  const block = byId.get(anchor.blockId);
  const spoken = anchor.words.map((w) => w.word).join(' ');
  if (spoken !== block.text) {
    mismatches += 1;
    firstMismatch ??= { id: anchor.blockId, spoken: spoken.slice(0, 80), text: block.text.slice(0, 80) };
  }
}
if (mismatches > 0) {
  fail(`${mismatches} blocks disagree with what was narrated — ` +
    `${firstMismatch.id}: spoken "${firstMismatch.spoken}" vs block "${firstMismatch.text}"`);
}
console.log(`all ${anchors.length} anchors resolve and match their block text`);

const hasWordTimings = anchors.every((a) => Array.isArray(a.words) && a.words.length > 0 &&
  a.words.every((w) => typeof w.start === 'number' && typeof w.end === 'number'));

/* ── Duration and chapter windows from the release M4B ─── */

const release = receipt.release;
if (!release?.tag || !release?.assetFile) fail('receipt has no release asset to stream');
const audioUrl =
  `https://github.com/dfakkeldy/explainer-audiobooks/releases/download/${release.tag}/${release.assetFile}`;

console.log(`probing ${release.assetFile} …`);
let probe;
try {
  probe = JSON.parse(execFileSync('ffprobe',
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_chapters', audioUrl],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
} catch {
  fail(`ffprobe could not read ${audioUrl} — is the release public?`);
}

const durationSeconds = Number(probe.format?.duration);
if (!(durationSeconds > 0)) fail('probe returned no duration');

const probed = probe.chapters || [];
if (probed.length === 0) fail('the M4B carries no chapter marks');

const chapters = probed.map((chapter, index) => ({
  number: index + 1,
  // "ch. 3: Forty-Eight Hours" — the ordinal lives in `number`.
  title: String(chapter.tags?.title ?? '').replace(/^\s*ch\.?\s*\d+\s*[:—-]\s*/i, '').trim(),
  start: Number(chapter.start_time),
  end: Number(chapter.end_time),
}));

chapters.forEach((chapter, index) => {
  if (!chapter.title) fail(`chapter ${index + 1} has no title`);
  if (!(chapter.end > chapter.start)) fail(`chapter ${index + 1} has no length`);
  const previousEnd = index === 0 ? 0 : chapters[index - 1].end;
  if (Math.abs(chapter.start - previousEnd) > 0.001) {
    fail(`chapter ${index + 1} starts at ${chapter.start}, leaving a gap after ${previousEnd}`);
  }
});
if (Math.abs(chapters[chapters.length - 1].end - durationSeconds) > 1) {
  fail(`chapters end at ${chapters[chapters.length - 1].end} but the audio is ${durationSeconds}s`);
}
if (chapters.length !== chapterIndex) {
  fail(`${chapters.length} audio chapters but ${chapterIndex} manuscript chapters`);
}
console.log(`probed ${chapters.length} chapters over ${durationSeconds.toFixed(3)}s`);

/* ── Write ─────────────────────────────────────────────── */

mkdirSync(assetDir, { recursive: true });
writeFileSync(new URL('blocks.json', assetDir),
  `${JSON.stringify({ blocks, source: { epub: `${slug}.epub` }, version: 1 }, null, 2)}\n`);
writeFileSync(new URL('alignment.json', assetDir), artifacts.alignment);

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const book = catalog.books.find((candidate) => candidate.slug === slug);
if (!book) fail(`${slug} is not on the fiction shelf`);

book.durationSeconds = durationSeconds;
book.estimatedHours = Math.round((durationSeconds / 3600) * 10) / 10;
book.chapters = chapters;
book.audio = { status: 'available', url: audioUrl, mimeType: 'audio/mp4' };
book.text = { blocks: `books/${slug}/blocks.json` };
book.alignment = { sidecar: `books/${slug}/alignment.json`, hasWordTimings };

/* The manuscript, EPUB and folder are public in the same package, pinned
   to the commit that published it so the bytes always match the receipt
   hashes verified above. */
const commit = execFileSync('git', ['-C', repo, 'rev-parse', ref], { encoding: 'utf8' }).trim();
const blob = `https://github.com/dfakkeldy/explainer-audiobooks`;
book.links = {
  read: `${blob}/blob/${commit}/books/${slug}/${receipt.artifacts.manuscript.file}`,
  epub: `${blob}/raw/${commit}/books/${slug}/${receipt.artifacts.epub.file}`,
  folder: `${blob}/tree/${commit}/books/${slug}`,
};

/* A first listen is not a reviewed edition, and the room says which it
   is. The receipt is the authority; its own disclosure is the copy. */
const reviewed = receipt.humanReadingStatus === 'complete' && receipt.humanListeningStatus === 'complete';
book.production = reviewed
  ? { state: 'published', label: 'Streaming now' }
  : { state: 'first-listen', label: 'Streaming — first listen' };
book.editionNote = reviewed
  ? 'Narrated with Echo voices. The creator completed the full reading and listening review.'
  : 'Public first listen — narrated with Echo voices, automated package and audio checks passed. ' +
    'The human reading and listening reviews are still open.';

writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

console.log(`staged ${slug}: ${chapters.length} chapters, ` +
  `${(durationSeconds / 3600).toFixed(2)} h, word timings ${hasWordTimings ? 'yes' : 'no'}`);
console.log('run `make test-fiction` and `make generate`.');

/* ── A minimal stored/deflate zip reader ───────────────── */

function unzip(buffer) {
  // Walk the central directory backwards from the end-of-central-directory
  // record; EPUBs are small and flat, so this stays simple.
  let eocd = buffer.length - 22;
  while (eocd >= 0 && buffer.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) fail('EPUB is not a zip archive');

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();

  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) fail('corrupt EPUB central directory');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, method === 0 ? data : inflateRawSync(data));

    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

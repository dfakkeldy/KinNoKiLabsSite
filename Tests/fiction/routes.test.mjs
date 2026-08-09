/* Generated-route assertions for /fiction.

   The room is hand-authored under Resources/ and copied verbatim by
   Publish, so these tests confirm the copy actually happened and that
   every asset the page reaches for — including the two files it borrows
   from /listen — is present at the URL the browser will request.

   Requires a generated Output/: run `make generate` first. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const repoRoot = new URL('../../', import.meta.url);
const outputRoot = new URL('Output/', repoRoot);
const resourceRoot = new URL('Resources/', repoRoot);
const page = readFileSync(new URL('fiction/index.html', outputRoot), 'utf8');
const catalog = JSON.parse(readFileSync(new URL('Resources/fiction/books.json', repoRoot), 'utf8'));

/* Publish copies Resources/ verbatim; a divergence means something
   edited Output/ by hand, which the project forbids. */
const copiedVerbatim = [
  'fiction/index.html',
  'fiction/fiction.css',
  'fiction/fiction.js',
  'fiction/books.json',
  ...catalog.books.map((book) => `fiction/${book.cover}`),
];

test('the room and its assets are published verbatim from Resources/', () => {
  for (const relative of copiedVerbatim) {
    const source = readFileSync(new URL(relative, resourceRoot));
    const published = readFileSync(new URL(relative, outputRoot));
    assert.ok(published.equals(source), `${relative} differs from its source in Resources/`);
  }
});

test('every asset the page requests exists at its published URL', () => {
  const referenced = [...page.matchAll(/(?:href|src)="([^"#]+)"/g)]
    .map((match) => match[1])
    .filter((href) => !href.startsWith('http') && !href.startsWith('mailto:'));
  assert.ok(referenced.length > 0, 'the page must reference assets');

  for (const href of referenced) {
    // Directory routes resolve to their index.html; root-relative hrefs
    // resolve against the site root, page-relative ones against /fiction/.
    const path = href.endsWith('/') ? `${href}index.html` : href;
    const base = path.startsWith('/') ? outputRoot : new URL('fiction/', outputRoot);
    assert.ok(existsSync(new URL(path.replace(/^\//, ''), base)), `${href} is not published`);
  }
});

test('the room borrows the shared listening-room material rather than forking it', () => {
  assert.match(page, /href="\/listen\/listen\.css"/);
  assert.match(page, /src="\/listen\/listen-core\.js"/);
  assert.ok(existsSync(new URL('listen/listen.css', outputRoot)));
  assert.ok(existsSync(new URL('listen/listen-core.js', outputRoot)));
});

test('the two rooms link to each other', () => {
  const listen = readFileSync(new URL('listen/index.html', outputRoot), 'utf8');
  assert.match(page, /href="\/listen\/"/, '/fiction must point back at the Echo room');
  assert.match(listen, /href="\/fiction\/"/, '/listen must point at the fiction room');
});

test('the page renders without JavaScript having anything to hide', () => {
  // The room is player-driven, so the no-JS path must still route readers
  // somewhere real instead of leaving an empty stage.
  assert.match(page, /<noscript>/);
  assert.match(page, /github\.com\/dfakkeldy/);
});

test('the shelf ships no placeholder or dead-link markup', () => {
  assert.doesNotMatch(page, /href="#"/, 'no placeholder anchors');
  assert.doesNotMatch(page, /(lorem ipsum|TODO|FIXME)/i);
});

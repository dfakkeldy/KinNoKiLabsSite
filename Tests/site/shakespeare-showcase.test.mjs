import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';

const output = new URL('../../Output/', import.meta.url);
const pageURL = new URL('shakespeare/merchant-of-venice/index.html', output);
const html = existsSync(pageURL) ? readFileSync(pageURL, 'utf8') : '';
const main = html.match(/<main\b[^>]*class="shakespeare-main"[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '';

function section(id) {
  return main.match(new RegExp(`<section\\b[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/section>`))?.[1] ?? '';
}

test('the Merchant work route generates its own page and discoverable metadata', () => {
  assert.ok(existsSync(pageURL), 'generate the Shakespeare page');
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<body class="page-page page-shakespeare">/);
  assert.match(html, /<title>The Merchant of Venice — KinNoKi Labs<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/kinnokilabs\.com\/shakespeare\/merchant-of-venice"/);
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
  assert.match(html, /name="description" content="Watch Word Is Bond, explore original songs,/);
  assert.equal((main.match(/<h1\b/g) ?? []).length, 1);
  assert.match(main, /<h1 id="shakespeare-title">The Merchant of Venice<\/h1>/);
  assert.match(html, /<main[^>]*aria-labelledby="shakespeare-title"/);
  assert.match(readFileSync(new URL('sitemap.xml', output), 'utf8'), /https:\/\/kinnokilabs\.com\/shakespeare/);
});

test('the page index reaches five real sections in reading order', () => {
  const ids = [...main.matchAll(/<section\b[^>]*id="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(ids, ['watch', 'listen', 'read', 'sources', 'code']);
  const index = main.match(/<nav\b[^>]*aria-label="On this page"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '';
  const anchors = [...index.matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(anchors, ids);
  assert.equal((main.match(/<h2\b/g) ?? []).length, 5);
  assert.equal((section('read').match(/<h3\b/g) ?? []).length, 2);
});

test('the film offers an on-demand player and a working YouTube fallback', () => {
  assert.match(section('watch'), /id="merchant-video" class="shakespeare-video"/);
  assert.match(section('watch'), /<button id="merchant-video-play"[^>]*type="button" hidden>/);
  assert.match(section('watch'), /Play Word Is Bond/);
  assert.match(section('watch'), /href="https:\/\/www\.youtube\.com\/watch\?v=ikYvGMdBV2E"/);
  assert.doesNotMatch(section('watch'), /coming soon|will follow|<(?:iframe|video|audio)\b/i);
});

test('unpublished Merchant project code exposes no action and page load starts no media', () => {
  const pendingCode = section('code').match(/<li class="shakespeare-code-pending">([\s\S]*?)<\/li>/)?.[1] ?? '';
  assert.match(pendingCode, /Merchant project code/);
  assert.match(pendingCode, /Publication pending/);
  assert.doesNotMatch(pendingCode, /<(?:a|button)\b/);
  assert.doesNotMatch(main, /href="#"|\bdisabled\b|aria-disabled|\/Users\/|file:|sediment:/i);
  assert.doesNotMatch(main, /<(?:script|iframe|audio|video)\b|class="[^"]*\breveal\b/i);
});

test('edition buttons open the matching listening room and retain both release downloads', () => {
  const read = section('read');
  const downloads = [...read.matchAll(/<a\b[^>]*class="btn shakespeare-download"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)];
  assert.deepEqual(downloads.map(match => [match[1], match[2]]), ['play', 'novel'].flatMap(edition => {
    const slug = `merchant-of-venice-${edition}`;
    const prefix = `https://github.com/dfakkeldy/explainer-audiobooks/releases/download/classic-${slug}-20261004T050000Z/${slug}`;
    const label = edition === 'play' ? 'Play' : 'Novel';
    return [[`${prefix}.epub`, `${label} EPUB`], [`/fiction/?book=${slug}`, `${label} audiobook`],
      [`${prefix}.m4b`, `Download ${edition} M4B`]];
  }));
  assert.match(read, /EPUB 1\.6 MB · M4B 35\.9 MB/);
  assert.match(read, /EPUB 1\.5 MB · M4B 32\.8 MB/);
  assert.match(read, /2h 19m 14s/);
  assert.match(read, /2h 06m 18s/);
  assert.match(read, /human reading and listening review remain pending/);
  assert.doesNotMatch(read, /Release pending|Cover concept|<(?:iframe|audio|button)\b/);
});

test('the public playlist, edition notices and source links are explicit', () => {
  const external = [...main.matchAll(/<a\b[^>]*href="(https:[^"]+)"[^>]*>/g)];
  assert.deepEqual(external.map(match => match[1]), [
    'https://www.youtube.com/watch?v=ikYvGMdBV2E',
    'https://suno.com/playlist/2a02c169-de0a-43e5-a6de-6184c804920f',
    'https://github.com/dfakkeldy/explainer-audiobooks/releases/download/classic-merchant-of-venice-play-20261004T050000Z/merchant-of-venice-play.epub',
    'https://github.com/dfakkeldy/explainer-audiobooks/releases/download/classic-merchant-of-venice-play-20261004T050000Z/merchant-of-venice-play.m4b',
    'https://github.com/dfakkeldy/explainer-audiobooks/releases/tag/classic-merchant-of-venice-play-20261004T050000Z',
    'https://github.com/dfakkeldy/explainer-audiobooks/releases/download/classic-merchant-of-venice-novel-20261004T050000Z/merchant-of-venice-novel.epub',
    'https://github.com/dfakkeldy/explainer-audiobooks/releases/download/classic-merchant-of-venice-novel-20261004T050000Z/merchant-of-venice-novel.m4b',
    'https://github.com/dfakkeldy/explainer-audiobooks/releases/tag/classic-merchant-of-venice-novel-20261004T050000Z',
    'https://shakespeare.mit.edu/merchant/full.html',
    'https://www.folger.edu/explore/shakespeares-works/the-merchant-of-venice/read/',
    'https://github.com/dfakkeldy/KinNoKiLabsSite',
    'https://github.com/dfakkeldy/explainer-audiobooks',
    'https://github.com/dfakkeldy/explainer-audiobooks/tree/4bf38dd2b67ffb205344e4331b6dd78fc2668fb1/books/merchant-of-venice-play',
    'https://github.com/dfakkeldy/explainer-audiobooks/tree/4bf38dd2b67ffb205344e4331b6dd78fc2668fb1/books/merchant-of-venice-novel',
  ]);
  for (const [tag] of external) {
    if (tag.includes('/releases/download/')) continue;
    assert.match(tag, /target="_blank"/);
    assert.match(tag, /rel="noopener noreferrer"/);
    const noticeID = tag.match(/aria-describedby="([^"]+)"/)?.[1];
    assert.ok(noticeID, 'external links announce a new tab');
    assert.match(main, new RegExp(`id="${noticeID}"[^>]*>[^<]*[Oo]pens[^<]*new tab`));
  }
  assert.match(section('listen'), /Listen on Suno/);
  assert.match(section('listen'), /including “Word Is Bond”/);
  assert.doesNotMatch(section('listen'), /16 songs|Fourteen original|Album art concept/);
  assert.match(section('sources'), /CC BY 4\.0 terms for the rights Dan holds/);
  assert.match(section('sources'), /Each audiobook has its own recording reuse notice/);
  assert.match(section('sources'), /antisemitic prejudice and a coerced conversion/);
});

test('the page retains shared theme, font and navigation controls', () => {
  assert.match(html, /class="site-header"/);
  assert.match(html, /class="site-footer"/);
  assert.match(html, /class="theme-toggle"/);
  assert.match(html, /class="font-toggle"[^>]*aria-pressed="false"/);
  assert.match(html, /class="nav-burger"/);
  assert.match(html, /class="mobile-menu"/);
  assert.match(html, /src="\/site\.js\?v=20260719"[^>]*defer/);
});

test('existing artwork is responsive, generated byte-for-byte and accurately labelled', () => {
  const local = [...html.matchAll(/(?:href|src)="(\/[^"#]+)"/g)].map(match => match[1].split('?')[0]);
  for (const path of local) {
    if (path === '/') continue;
    const relative = path.replace(/^\//, '');
    assert.ok(existsSync(new URL(relative, output)) || existsSync(new URL(`${relative.replace(/\/$/, '')}/index.html`, output)), `${path} must resolve`);
  }
  const manifest = JSON.parse(readFileSync(new URL('../../Resources/images/shakespeare/artwork-source.json', import.meta.url)));
  assert.deepEqual(manifest.assets.map(asset => asset.id), ['merchant-shylock', 'merchant-bond', 'merchant-portia']);
  for (const asset of manifest.assets) for (const derivative of asset.derivatives) {
    const source = readFileSync(new URL(`../../Resources/images/shakespeare/${derivative.file}`, import.meta.url));
    assert.deepEqual(readFileSync(new URL(`images/shakespeare/${derivative.file}`, output)), source);
    assert.equal(createHash('sha256').update(source).digest('hex'), derivative.sha256);
    assert.equal(source.length, derivative.sizeBytes);
    assert.ok(source.length < 60000, 'artwork stays small enough for the mobile page');
    assert.equal(derivative.width / derivative.height, 16 / 9, 'retain the full frame');
    assert.ok(main.includes(derivative.file), 'each responsive candidate is offered by the page');
  }
  assert.equal((main.match(/srcset=/g) || []).length, 3);
  assert.match(main, /alt="Shylock in the anime artwork for Word Is Bond" fetchpriority="high"/);
  assert.match(section('watch'), /alt="Shylock holds the sealed bond over a Venetian canal at sunset"/);
  assert.match(section('listen'), /Portia at Belmont · Film still/);
  assert.doesNotMatch(main, /venice-arch\.svg|bridge-night\.svg|caskets\.svg|Concept illustration|Album art concept/);
  for (const [name, sha] of [
    ['merchant-play-cover.png', '41a4fde6d906ff4067075a053b9546ab10531494164a2d2abac97c52cc6cda32'],
    ['merchant-novel-cover.png', '0e8bbb20492f776d4837ccae978cf497fdd00dfd70d045880a556d10cacb3e50'],
  ]) {
    const generated = readFileSync(new URL(`images/shakespeare/${name}`, output));
    assert.deepEqual(generated, readFileSync(new URL(`../../Resources/images/shakespeare/${name}`, import.meta.url)));
    assert.equal(createHash('sha256').update(generated).digest('hex'), sha, 'retain the approved cover bytes');
  }
  assert.match(section('read'), /alt="The Merchant of Venice, modern-English play: Shylock portrait cover"/);
  assert.match(section('read'), /alt="The Merchant of Venice, modern-English novel: Shylock portrait cover"/);
});

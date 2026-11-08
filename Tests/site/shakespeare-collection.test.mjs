import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const output = new URL('../../Output/', import.meta.url);
const routes = [
  ['shakespeare', 'Shakespeare'],
  ['shakespeare/merchant-of-venice', 'The Merchant of Venice'],
  ['shakespeare/a-midsummer-nights-dream', "A Midsummer Night's Dream"],
];
const pages = routes.map(([route, title]) => {
  const url = new URL(`${route}/index.html`, output);
  const html = existsSync(url) ? readFileSync(url, 'utf8') : '';
  const main = html.match(/<main\b[^>]*class="shakespeare-main"[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '';
  return { route, title, html, main };
});
const [collection, merchant, midsummer] = pages;

test('collection and work routes each have distinct discoverable metadata and one H1', () => {
  const sitemap = readFileSync(new URL('sitemap.xml', output), 'utf8');
  for (const { route, title, html, main } of pages) {
    assert.ok(html, `${route} must be generated`);
    assert.ok(html.includes(`<title>${title} — KinNoKi Labs</title>`));
    assert.ok(html.includes(`rel="canonical" href="https://kinnokilabs.com/${route}"`));
    assert.match(html, /name="description" content="[^\"]{30,}"/);
    assert.equal((main.match(/<h1\b/g) ?? []).length, 1);
    assert.ok(main.includes(`<h1 id="shakespeare-title">${title}</h1>`));
    assert.ok(sitemap.includes(`<loc>https://kinnokilabs.com/${route}</loc>`));
  }
});

test('the collection links two real work cards with explicit availability and formats', () => {
  const cards = [...collection.main.matchAll(/<article\b[^>]*class="shakespeare-work-card"[^>]*>([\s\S]*?)<\/article>/g)].map(m => m[1]);
  assert.equal(cards.length, 2);
  assert.match(cards[0], /The Merchant of Venice/);
  // The status line is the state only; the Available list names the items.
  assert.match(cards[0], /<p class="shakespeare-status">Released<\/p>/);
  assert.match(cards[0], /Album on Suno/);
  assert.match(cards[0], /Word Is Bond film/);
  assert.doesNotMatch(cards[0], /Coming soon|video player/);
  assert.match(cards[0], /EPUB/);
  assert.match(cards[0], /M4B audiobooks/);
  assert.match(cards[1], /A Midsummer Night's Dream/);
  assert.match(cards[1], /Edition complete · Release pending/);
  // The status line states availability once; the formats block names
  // what is coming instead of an empty "Available" row.
  const coming = cards[1].match(/<dt>Coming<\/dt><dd>([\s\S]*?)<\/dd>/)?.[1] ?? '';
  assert.deepEqual([...coming.matchAll(/<li>([^<]+)<\/li>/g)].map(m => m[1]),
    ['Book editions', 'Audiobook', 'Video', 'Project code']);
  const available = cards[0].match(/<dt>Available<\/dt><dd>([\s\S]*?)<\/dd>/)?.[1] ?? '';
  assert.deepEqual([...available.matchAll(/<li>([^<]+)<\/li>/g)].map(m => m[1]),
    ['Word Is Bond film', 'Album on Suno', 'Play and novel EPUBs', 'Online listening and M4B audiobooks']);
  assert.doesNotMatch(cards[1], /No public releases yet|<dt>Available<\/dt>/);
  const links = [...collection.main.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].map(m => m[1]);
  assert.deepEqual(links, ['/shakespeare/merchant-of-venice/', '/shakespeare/a-midsummer-nights-dream/']);
  assert.doesNotMatch(collection.main, /<(?:iframe|audio|video|button)\b|target="_blank"|\bdownload\b/);
});

test('work pages return to the collection and connect to the other work', () => {
  for (const [page, other] of [[merchant, midsummer], [midsummer, merchant]]) {
    assert.match(page.main, /href="\/shakespeare\/"[^>]*>[\s\S]*?Shakespeare collection/);
    assert.ok(page.main.includes(`href="/${other.route}/"`));
    assert.match(page.main, /aria-label="More Shakespeare"/);
  }
});

test('Midsummer separates the completed edition from pending public releases', () => {
  assert.match(midsummer.main, /The edition is complete/);
  assert.match(midsummer.main, /<h2 id="project-status-title">Release status<\/h2>/);
  assert.doesNotMatch(midsummer.html, /in progress|being made in the studio/i);
  // Four per-format statuses, each status said once: book editions,
  // audiobook and video share "Release pending"; project code is
  // "Publication pending".
  const status = midsummer.main.match(/<dl class="shakespeare-release-status">([\s\S]*?)<\/dl>/)?.[1] ?? '';
  const groups = [...status.matchAll(/<div>([\s\S]*?)<\/div>/g)].map(match => ({
    formats: [...match[1].matchAll(/<dt>([^<]+)<\/dt>/g)].map(dt => dt[1]),
    state: match[1].match(/<dd>([^<]+)<\/dd>/)?.[1],
  }));
  assert.deepEqual(groups, [
    { formats: ['Book editions', 'Audiobook', 'Video'], state: 'Release pending' },
    { formats: ['Project code'], state: 'Publication pending' },
  ]);
  assert.equal((midsummer.main.match(/Release pending/g) ?? []).length, 1);
  assert.equal((midsummer.main.match(/Publication pending/g) ?? []).length, 1);
  assert.doesNotMatch(midsummer.main, /<(?:iframe|audio|video|button|img)\b|\bdownload\b|href="(?:https?:|#")|target="_blank"/i);
  assert.doesNotMatch(midsummer.main, /\.epub|\.m4b|youtube\.com|suno\.com|github\.com|\/Users\/|sediment:|file:/i);
});

test('all pages retain the shared controls, focus enhancement and unambiguous IDs', () => {
  for (const { html, main, route } of pages) {
    assert.match(html, /<body class="page-page page-shakespeare">/);
    assert.match(html, /class="site-header"/);
    assert.match(html, /class="site-footer"/);
    assert.match(html, /class="theme-toggle"/);
    assert.match(html, /class="font-toggle"/);
    assert.match(html, /src="\/shakespeare\.js\?v=20261012-shakespeare-film" defer/);
    assert.match(html, /href="\/styles\.css\?v=20261012-shakespeare-film"/);
    assert.match(html, /<main[^>]*aria-labelledby="shakespeare-title"/);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${route} IDs must be unique`);
    assert.doesNotMatch(main, /href="#"|\bdisabled\b|aria-disabled|class="[^"]*\breveal\b/);
  }
});

test('internal work links and section anchors resolve to the generated content', () => {
  for (const { html, route } of pages) {
    assert.ok(html, `${route} must exist before checking its links`);
    for (const match of html.matchAll(/(?:href|src)="(\/[^"#]+|#[^"]+)"/g)) {
      const path = match[1].split('?')[0];
      if (path.startsWith('#')) {
        assert.ok(html.includes(`id="${path.slice(1)}"`), `${route}: ${path} must resolve`);
      } else if (path !== '/') {
        const relative = path.replace(/^\//, '');
        assert.ok(existsSync(new URL(relative, output)) || existsSync(new URL(`${relative.replace(/\/$/, '')}/index.html`, output)), `${route}: ${path} must resolve`);
      }
    }
  }
});

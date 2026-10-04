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
  assert.match(cards[0], /Album available/);
  assert.match(cards[0], /16-song album on Suno/);
  assert.match(cards[0], /Pending release/);
  assert.match(cards[0], /EPUB/);
  assert.match(cards[0], /M4B audiobook/);
  assert.match(cards[1], /A Midsummer Night's Dream/);
  assert.match(cards[1], /In progress/);
  assert.match(cards[1], /No public releases yet/);
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

test('Midsummer remains honest in progress with no media, download or public project-repo actions', () => {
  assert.match(midsummer.main, /This project is in progress/);
  assert.match(midsummer.main, /Book editions/);
  assert.match(midsummer.main, /Audiobook/);
  assert.match(midsummer.main, /Video/);
  assert.match(midsummer.main, /Project code/);
  assert.equal((midsummer.main.match(/Release pending/g) ?? []).length, 3);
  assert.match(midsummer.main, /Publication pending/);
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
    assert.match(html, /src="\/shakespeare\.js" defer/);
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

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

// Factual corrections from the October 2026 site review: Routey is
// discontinued, source licences vary, the tender PDF claim matches what the
// builder checks, unknown paths get a real 404, and static apps are in the
// sitemap.

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const theme = read('Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift');
const home = read('Output/index.html');
const apps = read('Output/apps/index.html');
const support = read('Output/support/index.html');
const tenders = read('Output/tenders/index.html');
const routey = read('Output/apps/routey/index.html');
const sitemap = read('Output/sitemap.xml');
const feed = read('Output/feed.rss');

test('Routey is gone from the homepage, apps listing, and support page', () => {
  for (const html of [home, apps, support]) {
    assert.doesNotMatch(html, /\/apps\/routey/);
    assert.doesNotMatch(html, /Routey/);
  }
  assert.match(home, /<span>4 apps in development<\/span>/);
  assert.match(home, /<span>4 in TestFlight<\/span>/);
  assert.match(apps, /Four apps, honestly statused\./);
  assert.match(apps, /All four have TestFlight builds running/);
  for (const source of [theme, home, apps]) {
    assert.doesNotMatch(source, /\b5 apps\b|\b5 in TestFlight\b|Five apps|All five/);
  }
});

test('the Routey page stays reachable but unlisted', () => {
  assert.match(routey, /<meta name="robots" content="noindex"\/>/);
  assert.doesNotMatch(sitemap, /apps\/routey/);
  assert.doesNotMatch(feed, /apps\/routey/);
  assert.doesNotMatch(home, /<meta name="robots"/);
});

test('open-source claims say the source is public and licences vary', () => {
  for (const source of [theme, home, apps]) {
    assert.doesNotMatch(source, /Every one is open source/);
    assert.doesNotMatch(source, /Open source on GitHub/);
  }
  assert.match(home, /Source is public on GitHub; licences vary/);
  assert.match(apps, /Source is public on GitHub; licences vary\./);
});

test('tender hub claims a tagged, accessible PDF and presents closed briefs as worked examples', () => {
  assert.doesNotMatch(tenders, /PDF\/UA/);
  assert.match(tenders, /tender-starter-guide\.pdf — tagged, accessible PDF/);
  assert.doesNotMatch(tenders, /Check back later/);
  assert.doesNotMatch(tenders, /showcase of current Nova Scotia/);
  assert.match(tenders, /closed worked examples/);
  assert.match(tenders, /Request a free custom preview/);
});

test('a top-level 404 page exists with site chrome, noindex, and no canonical', () => {
  const url = new URL('../../Output/404.html', import.meta.url);
  assert.ok(existsSync(url), 'Cloudflare Pages needs Output/404.html to stop serving the homepage for unknown paths');
  const html = readFileSync(url, 'utf8');
  assert.match(html, /<title>Page not found — KinNoKi Labs<\/title>/);
  assert.match(html, /<meta name="robots" content="noindex"\/>/);
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.doesNotMatch(html, /og:url/);
  assert.match(html, /class="site-header"/);
  assert.match(html, /class="site-footer"/);
  assert.match(html, /<link rel="stylesheet" href="\/styles\.css"\/>/);
  assert.doesNotMatch(sitemap, /404/);
});

test('sitemap lists the static Listening Room and NS Marks map routes', () => {
  for (const path of ['listen/', 'apps/nsmarksthespot/map/']) {
    assert.match(sitemap, new RegExp(`<loc>https://kinnokilabs\\.com/${path.replaceAll('/', '\\/')}</loc>`));
    assert.ok(existsSync(new URL(`../../Output/${path}index.html`, import.meta.url)), `${path} must be a real page`);
  }
  assert.match(sitemap, /<\/urlset>$/);
});

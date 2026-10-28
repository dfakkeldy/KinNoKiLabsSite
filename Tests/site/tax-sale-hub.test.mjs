import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const content = readFileSync(new URL('../../Content/taxsale.md', import.meta.url), 'utf8');
const appContent = readFileSync(new URL('../../Content/apps/nsmarksthespot.md', import.meta.url), 'utf8');
const theme = readFileSync(
  new URL('../../Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift', import.meta.url),
  'utf8',
);
const generated = readFileSync(new URL('../../Output/taxsale/index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../Resources/styles.css', import.meta.url), 'utf8');
const generatedStyles = readFileSync(new URL('../../Output/styles.css', import.meta.url), 'utf8');
const redirects = readFileSync(new URL('../../Resources/_redirects', import.meta.url), 'utf8');
const generatedRedirects = readFileSync(new URL('../../Output/_redirects', import.meta.url), 'utf8');
const publicEpub = new URL('../../Resources/taxsale/beyond-the-tax-sale-packet.epub', import.meta.url);
const generatedEpub = new URL('../../Output/taxsale/beyond-the-tax-sale-packet.epub', import.meta.url);
const publicCover = readFileSync(new URL('../../Resources/taxsale/cover.png', import.meta.url));
const generatedCover = readFileSync(new URL('../../Output/taxsale/cover.png', import.meta.url));

test('publishes the short Nova Scotia tax-sale hub route', () => {
  assert.match(content, /title: Nova Scotia Tax Sale Hub/);
  assert.match(content, /image: \/images\/taxsale\/og\.png/);
  assert.match(theme, /case "taxsale":\s+main = taxSaleHubMain\(\)/);
  assert.match(generated, /<link rel="canonical" href="https:\/\/kinnokilabs\.com\/taxsale"\/>/);
  assert.match(generated, /<body class="page-page page-tax-sale">/);
  assert.match(generated, /<h1 id="tax-hero-title">Nova Scotia<br><em>tax sales, mapped\.<\/em><\/h1>/);
});

test('keeps only upcoming posted dates in the current sale desk', () => {
  assert.match(generated, /<span class="tax-desk-day">23<\/span>/);
  assert.match(generated, /November<\/strong><small>Victoria County · public auction, 11:00 a\.m\.<\/small>/);
  assert.match(generated, /<strong>Dec 8<\/strong> CBRM · public auction, Sydney/);
  assert.match(generated, /Dates checked October 23, 2026 on each municipality’s page/);
  assert.equal(generated.match(/class="tax-date-card reveal"/g)?.length, 2);
  assert.match(generated, /Monday, November 23 at 11:00 a\.m\./);
  assert.match(generated, /St\. Mark’s Masonic Lodge, 24 Queen Street, Baddeck/);
  assert.match(generated, /Tuesday, December 8; registration opens at 10:00 a\.m\./);
  assert.match(generated, /Centre 200 Main Concourse, 481 George Street, Sydney/);
  assert.match(generated, /https:\/\/victoriacounty\.com\/property-tax-sale-notice\//);
  assert.match(generated, /https:\/\/cbrm\.ns\.ca\/business\/property-sales-management\/tax-sales\//);
  assert.match(generated, /Lists change until the sale\./);
  assert.match(generated, /<span>Next sale · November 23<\/span><strong>Victoria County tax-sales page<\/strong>/);
  assert.match(generated, /<span>Next sale · December 8<\/span><strong>CBRM tax-sales page<\/strong>/);
  assert.doesNotMatch(generated, /tenders close 12:00 noon<\/small>/);
  assert.doesNotMatch(generated, /25 current mapped PIDs across two notices/);
});

test('presents passed sale dates as past without claiming outcomes', () => {
  assert.equal(
    generated.match(/class="tax-date-card tax-date-past reveal"/g)?.length,
    5,
  );
  assert.equal(generated.match(/Sale date passed · Results with the municipality/g)?.length, 5);
  assert.match(generated, /Advertised for Tuesday, September 15; tenders closed at 10:00 a\.m\./);
  assert.match(generated, /Advertised for Monday, September 14; tenders closed at 12:00 noon/);
  assert.match(generated, /Advertised for Monday, August 31; tenders closed at 1:00 p\.m\./);
  assert.match(generated, /Last notice snapshot July 23: 1 advertised row · 0 withdrawn rows/);
  assert.match(generated, /Advertised for Tuesday, August 11 at 9:30 a\.m\./);
  assert.match(generated, /Advertised for Thursday, August 20 at 10:00 a\.m\./);
  assert.match(generated, /Last notice snapshot August 10: 27 advertised rows · 18 withdrawn rows/);
  assert.match(generated, /Last notice snapshot August 18: 2 advertised rows · 0 withdrawn rows/);
  assert.match(generated, /https:\/\/annapoliscounty\.ca\/tax-finance\/tax-sale/);
  assert.match(generated, /https:\/\/www\.halifax\.ca\/home-property\/property-taxes\/tax-sale/);
  assert.match(generated, /https:\/\/invernesscounty\.ca\/services\/finance-taxation\/tax-sales\//);
  assert.match(generated, /https:\/\/www\.discovermiddleton\.ca\/property-tax-sale-information/);
  assert.doesNotMatch(generated, /\b(?:un)?sold\b/i);
});

test('states each limit once instead of qualifying every line', () => {
  for (const hedge of [
    /Posted does not mean final/,
    /A past date is not evidence of outcome/,
    /It cannot tell you/,
    /Neither this hub, the map, nor the guide proves/,
  ]) {
    assert.doesNotMatch(generated, hedge);
  }
  assert.match(generated, /The map shows you <em>where\.<\/em><br>The records tell you <em>whether\.<\/em>/);
});

test('explore map copy names postal community in search', () => {
  for (const source of [theme, generated]) {
    assert.match(
      source,
      /Search an eight-digit PID, Nova Scotia civic address, or postal community, open a mapped tax-sale parcel/,
    );
    assert.match(
      source,
      /<span>Search<\/span><strong>PID, civic address, postal community, or visible parcel<\/strong>/,
    );
    assert.doesNotMatch(source, /Search an eight-digit PID or Nova Scotia civic address,/);
    assert.doesNotMatch(
      source,
      /<span>Search<\/span><strong>PID, civic address, or visible parcel<\/strong>/,
    );
  }
  assert.doesNotMatch(generated, /Canada Post/);
  assert.doesNotMatch(generated, /National Address Register/);
  assert.doesNotMatch(generated, /paid API/i);
});

test('shows truthful format status and connects the existing app page', () => {
  assert.match(generated, /Free guide · PDF, EPUB and audiobook/);
  assert.match(generated, /<h3>Illustrated PDF<\/h3>/);
  assert.match(generated, /Illustrated PDF · 149 pages · 13 chapters · 39 figures · free/);
  assert.match(generated, /href="\/listen\/\?book=beyond-the-tax-sale-packet"/);
  assert.match(generated, /The first edition, narrated in full \(4 hours 13 minutes\)/);
  assert.doesNotMatch(generated, /Video edition/);
  assert.match(generated, /\/apps\/nsmarksthespot\/map\//);
  assert.match(generated, /\/images\/taxsale\/og\.png/);
  assert.match(appContent, /\[Nova Scotia Tax Sale Hub\]\(\/taxsale\/\)/);
});

test('publishes the exact approved EPUB through a stable first-party redirect', () => {
  assert.match(generated, /href="\/taxsale\/beyond-the-tax-sale-packet\.epub" download/);
  assert.match(generated, /src="\/images\/covers\/beyond-the-tax-sale-packet-640\.webp"/);
  assert.match(generated, /href="\/tools\/epub-reader\/"/);
  const expectedRedirect =
    '/taxsale/beyond-the-tax-sale-packet.epub https://raw.githubusercontent.com/dfakkeldy/explainer-audiobooks/4cedf19540bc128edc7561333a95facddb05e31a/books/beyond-the-tax-sale-packet/beyond-the-tax-sale-packet.epub 302';
  assert.match(redirects, new RegExp(`^${expectedRedirect}$`, 'm'));
  assert.equal(generatedRedirects, redirects);
  assert.equal(existsSync(publicEpub), false, 'oversized EPUB stays out of the Pages artifact');
  assert.equal(existsSync(generatedEpub), false, 'generated Pages artifact stays below the file limit');
  assert.equal(publicCover.length > 0, true);
  assert.deepEqual(generatedCover, publicCover);
});

test('serves the illustrated PDF and EPUB first-party under the Pages file limit', () => {
  const limit = 25 * 1024 * 1024;
  for (const name of ['beyond-the-tax-sale-packet-illustrated.pdf', 'beyond-the-tax-sale-packet-illustrated.epub']) {
    const source = readFileSync(new URL(`../../Resources/taxsale/${name}`, import.meta.url));
    const output = readFileSync(new URL(`../../Output/taxsale/${name}`, import.meta.url));
    assert.ok(source.length > 1024 * 1024, `${name} is present`);
    assert.ok(source.length < limit, `${name} stays under the 25 MiB Pages limit`);
    assert.deepEqual(output, source, `${name} is copied unchanged`);
    assert.match(generated, new RegExp(`href="/taxsale/${name.replace(/\./g, '\\.')}" download`));
  }
});

test('uses the live map palette across source and generated styles', () => {
  for (const color of ['#12343b', '#2f80ed', '#be4d3c', '#718b56', '#e7a86b', '#eef7f5']) {
    assert.match(styles, new RegExp(color), `${color} must remain in the tax-sale palette`);
  }
  assert.match(styles, /\.tax-map-section\s*\{[^}]*background-color: var\(--tax-water-soft\)/);
  assert.match(styles, /\.tax-format-card:nth-child\(3\)[^}]*var\(--tax-lavender\)/);
  assert.equal(generatedStyles, styles, 'generated CSS must match the reviewed source palette');
});

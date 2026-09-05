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
  assert.doesNotMatch(generated, /Inverness County · 9:30 a\.m\./);
  assert.doesNotMatch(generated, /35 advertised rows/);
  assert.doesNotMatch(generated, /39 current mapped PIDs/);
  assert.doesNotMatch(generated, /Annapolis County · tenders close 1:00 p\.m\./);
  assert.match(generated, /September<\/strong><small>Victoria County · tenders close 12:00 noon<\/small>/);
  assert.match(generated, /<strong>5<\/strong> advertised rows/);
  assert.match(generated, /<strong>5<\/strong> active mapped PIDs/);
  assert.match(generated, /25 current mapped PIDs across two notices/);
  assert.doesNotMatch(generated, /Monday, August 31; tenders close at/);
  assert.match(generated, /Monday, September 14; tenders close at 12:00 noon/);
  assert.match(generated, /Tuesday, September 15; tenders close at 10:00 a\.m\./);
  assert.match(generated, /https:\/\/annapoliscounty\.ca\/tax-finance\/tax-sale/);
  assert.match(generated, /https:\/\/victoriacounty\.com\/residents\/property-taxation-services\/tax-sales\//);
  assert.match(generated, /https:\/\/www\.halifax\.ca\/home-property\/property-taxes\/tax-sale/);
  assert.doesNotMatch(generated, /1 advertised row · 0 withdrawn rows · 1 active PID mapped/);
  assert.match(generated, /5 advertised rows · 4 opaque source rows excluded · 5 active PIDs mapped/);
  assert.match(generated, /19 advertised rows · 0 withdrawn rows · 20 of 20 PIDs mapped/);
  assert.match(generated, /Halifax and Victoria notices re-checked September 3, 2026 · Annapolis snapshot July 23/);
  assert.doesNotMatch(generated, /CBRM \+ Inverness County notices/);
  assert.match(generated, /<span>Mapped now<\/span><strong>Two current municipal notices · 25 active PIDs<\/strong>/);
  assert.match(
    generated,
    /<span>Current notice<\/span><strong>Halifax tax-sale page<\/strong>/,
  );
  assert.match(
    generated,
    /<span>Past event source<\/span><strong>CBRM tax-sales page<\/strong>/,
  );
  assert.equal(
    generated.match(/class="tax-date-card reveal"/g)?.length,
    2,
  );
  assert.match(generated, /Posted does not mean final\./);
});

test('presents passed sale dates as past without claiming outcomes', () => {
  assert.equal(
    generated.match(/class="tax-date-card tax-date-past reveal"/g)?.length,
    3,
  );
  assert.equal(generated.match(/Sale date passed · Verify results/g)?.length, 3);
  assert.match(generated, /Advertised for Monday, August 31; tenders closed at 1:00 p\.m\./);
  assert.match(generated, /Last notice snapshot July 23: 1 advertised row · 0 withdrawn rows/);
  assert.match(generated, /Advertised for Tuesday, August 11 at 9:30 a\.m\./);
  assert.match(generated, /Advertised for Thursday, August 20 at 10:00 a\.m\./);
  assert.equal(
    generated.match(
      /A past date is not evidence of outcome—verify results and current status with the municipality\./g,
    )?.length,
    3,
  );
  assert.match(generated, /Last notice snapshot August 10: 27 advertised rows · 18 withdrawn rows/);
  assert.match(generated, /Last notice snapshot August 18: 2 advertised rows · 0 withdrawn rows/);
  assert.match(generated, /https:\/\/invernesscounty\.ca\/services\/finance-taxation\/tax-sales\//);
  assert.match(generated, /https:\/\/www\.discovermiddleton\.ca\/property-tax-sale-information/);
  assert.doesNotMatch(generated, /\b(?:un)?sold\b/i);
});

test('shows truthful format status and connects the existing app page', () => {
  assert.match(generated, /Public EPUB \+ audiobook · available now/);
  assert.match(generated, /EPUB text edition/);
  assert.match(generated, /href="\/listen\/\?book=beyond-the-tax-sale-packet"/);
  assert.match(
    generated,
    /This edition has passed package and audio checks\. The creator completed the full listening review and approved this edition for publication\./,
  );
  assert.match(generated, /No finished public video is available yet\./);
  assert.match(generated, /\/apps\/nsmarksthespot\/map\//);
  assert.match(generated, /\/images\/taxsale\/og\.png/);
  assert.match(appContent, /\[Nova Scotia Tax Sale Hub\]\(\/taxsale\/\)/);
});

test('publishes the exact approved EPUB through a stable first-party redirect', () => {
  assert.match(generated, /href="\/taxsale\/beyond-the-tax-sale-packet\.epub" download/);
  assert.match(generated, /src="\/taxsale\/cover\.png"/);
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

test('uses the live map palette across source and generated styles', () => {
  for (const color of ['#12343b', '#2f80ed', '#be4d3c', '#718b56', '#e7a86b', '#eef7f5']) {
    assert.match(styles, new RegExp(color), `${color} must remain in the tax-sale palette`);
  }
  assert.match(styles, /\.tax-map-section\s*\{[^}]*background-color: var\(--tax-water-soft\)/);
  assert.match(styles, /\.tax-format-card:nth-child\(3\)[^}]*var\(--tax-lavender\)/);
  assert.equal(generatedStyles, styles, 'generated CSS must match the reviewed source palette');
});

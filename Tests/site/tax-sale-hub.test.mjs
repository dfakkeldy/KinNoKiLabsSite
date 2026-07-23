import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
const publicEpub = readFileSync(
  new URL('../../Resources/taxsale/beyond-the-tax-sale-packet.epub', import.meta.url),
);
const generatedEpub = readFileSync(
  new URL('../../Output/taxsale/beyond-the-tax-sale-packet.epub', import.meta.url),
);
const publicCover = readFileSync(new URL('../../Resources/taxsale/cover.png', import.meta.url));
const generatedCover = readFileSync(new URL('../../Output/taxsale/cover.png', import.meta.url));

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('publishes the short Nova Scotia tax-sale hub route', () => {
  assert.match(content, /title: Nova Scotia Tax Sale Hub/);
  assert.match(content, /image: \/images\/taxsale\/og\.png/);
  assert.match(theme, /case "taxsale":\s+main = taxSaleHubMain\(\)/);
  assert.match(generated, /<link rel="canonical" href="https:\/\/kinnokilabs\.com\/taxsale"\/>/);
  assert.match(generated, /<body class="page-page page-tax-sale">/);
  assert.match(generated, /<h1 id="tax-hero-title">Nova Scotia<br><em>tax sales, mapped\.<\/em><\/h1>/);
});

test('keeps current posted dates tied to official municipal sources', () => {
  assert.match(generated, /Tuesday, July 21 at 11:00 a\.m\./);
  assert.match(generated, /Tuesday, August 11 at 9:30 a\.m\./);
  assert.match(generated, /https:\/\/cbrm\.ns\.ca\/business\/property-sales-management\/tax-sales\//);
  assert.match(generated, /https:\/\/invernesscounty\.ca\/services\/finance-taxation\/tax-sales\//);
  assert.match(generated, /67 advertised rows · 68 unique PIDs mapped/);
  assert.match(generated, /40 advertised rows · 5 withdrawn rows · 40 active PIDs mapped/);
  assert.match(generated, /Posted does not mean final\./);
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

test('publishes the exact approved EPUB and selected cover as first-party downloads', () => {
  assert.match(generated, /href="\/taxsale\/beyond-the-tax-sale-packet\.epub" download/);
  assert.match(generated, /src="\/taxsale\/cover\.png"/);
  assert.match(generated, /href="\/tools\/epub-reader\/"/);
  assert.equal(sha256(publicEpub), 'b2399f3850e98050fe58e913ba1bd8cfd1cc5a86331b4b3a4f884959f82d666d');
  assert.equal(sha256(publicCover), 'fffaf3037b43f6341a822cb004a0a4d1829e8ef56df80c753400471ffe53ddf6');
  assert.deepEqual(generatedEpub, publicEpub);
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

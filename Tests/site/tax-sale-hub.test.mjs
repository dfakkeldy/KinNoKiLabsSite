import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const content = readFileSync(new URL('../../Content/taxsale.md', import.meta.url), 'utf8');
const appContent = readFileSync(new URL('../../Content/apps/nsmarksthespot.md', import.meta.url), 'utf8');
const theme = readFileSync(
  new URL('../../Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift', import.meta.url),
  'utf8',
);
const generated = readFileSync(new URL('../../Output/taxsale/index.html', import.meta.url), 'utf8');

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
  assert.match(generated, /45 advertised rows · 47 unique PIDs mapped/);
  assert.match(generated, /Posted does not mean final\./);
});

test('shows truthful format status and connects the existing app page', () => {
  assert.match(generated, /Illustrated book/);
  assert.match(generated, /No finished public audiobook exists yet\./);
  assert.match(generated, /No finished public video exists yet\./);
  assert.match(generated, /\/apps\/nsmarksthespot\/map\//);
  assert.match(generated, /\/images\/taxsale\/og\.png/);
  assert.match(appContent, /\[Nova Scotia Tax Sale Hub\]\(\/taxsale\/\)/);
});

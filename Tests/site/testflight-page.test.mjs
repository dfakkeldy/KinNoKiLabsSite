import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pageURL = new URL('../../Output/testflight/index.html', import.meta.url);
const sitemapURL = new URL('../../Output/sitemap.xml', import.meta.url);

test('publishes the TestFlight page with the public Turn Timer and Echo betas', () => {
  assert.ok(existsSync(pageURL), 'expected the generated /testflight route');

  const html = readFileSync(pageURL, 'utf8');
  assert.match(html, /<h1>TestFlight betas<\/h1>/);
  assert.match(html, /<h2>Turn Timer<\/h2>/);
  assert.match(
    html,
    /href="https:\/\/testflight\.apple\.com\/join\/s7w4YGWU"/,
  );
  assert.match(html, /<h2>Echo<\/h2>/);
  assert.match(
    html,
    /href="https:\/\/testflight\.apple\.com\/join\/Zu9rzg59"/,
  );

  const sitemap = readFileSync(sitemapURL, 'utf8');
  assert.match(sitemap, /<loc>https:\/\/kinnokilabs\.com\/testflight<\/loc>/);
});

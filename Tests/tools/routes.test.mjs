import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const toolPages = [
  ['tools', 'hub'],
  ['tools/qr-code', 'qr-code'],
  ['tools/epub-reader', 'epub-reader'],
  ['tools/dilution', 'dilution'],
  ['tools/contrast', 'contrast'],
  ['tools/word-count', 'word-count'],
  ['tools/unit-converter', 'unit-converter'],
  ['tools/passphrase', 'passphrase'],
];

function resourceFiles(directory = new URL('../../Resources/tools/', import.meta.url), prefix = '') {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = `${prefix}${entry.name}`;
      if (entry.isDirectory()) {
        return resourceFiles(new URL(`${entry.name}/`, directory), `${relative}/`);
      }
      return [relative];
    })
    .sort();
}

function precacheURLs(workerSource) {
  const body = workerSource.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1];
  assert.notEqual(body, undefined, 'service worker must declare a PRECACHE array');

  const literals = [...body.matchAll(/'([^'\\]*)'/g)];
  const residue = body.replace(/'[^'\\]*'/g, '').replace(/[\s,]/g, '');
  assert.equal(residue, '', 'PRECACHE must contain only literal URL strings');

  const urls = literals.map((match) => match[1]);
  assert.ok(urls.length > 0, 'PRECACHE must not be empty');
  assert.equal(new Set(urls).size, urls.length, 'PRECACHE URLs must be unique');
  return urls;
}

function outputURLForPrecache(urlPath) {
  assert.match(urlPath, /^\/[A-Za-z0-9._/-]+$/, `invalid precache URL: ${urlPath}`);
  const suffix = urlPath.endsWith('/') ? 'index.html' : '';
  return new URL(`../../Output${urlPath}${suffix}`, import.meta.url);
}

for (const [route, page] of toolPages) {
  test(`${route} has the tools shell, module, manifest, and no Arcade Hall shell`, () => {
    const html = readFileSync(new URL(`../../Output/${route}/index.html`, import.meta.url), 'utf8');

    assert.match(html, new RegExp(`data-tool-page="${page}"`));
    assert.match(html, /<script[^>]+type="module"[^>]+src="\/tools\/ui\.js"/);
    assert.match(html, /<link[^>]+rel="manifest"[^>]+href="\/tools\/manifest\.webmanifest"/);
    assert.doesNotMatch(
      html,
      /data-game-page=|id="games-app"|class="[^"]*\bgames-(?:main|app|live-region)\b|src="\/games\/ui\.js"/,
    );
  });
}

test('site navigation links to Tools by name', () => {
  const html = readFileSync(new URL('../../Output/index.html', import.meta.url), 'utf8');
  assert.match(html, /<a[^>]+href="\/tools"[^>]*>\s*Tools(?:\s*<)/);
});

test('every tools resource is copied byte-for-byte to generated output', () => {
  const files = resourceFiles();
  assert.ok(files.includes('sw.js'));
  assert.ok(files.includes('manifest.webmanifest'));
  assert.ok(files.includes('icons/icon-192.png'));
  assert.ok(files.includes('icons/icon-512.png'));
  assert.ok(files.includes('wordlist.js'));

  for (const relative of files) {
    const source = readFileSync(new URL(`../../Resources/tools/${relative}`, import.meta.url));
    const output = readFileSync(new URL(`../../Output/tools/${relative}`, import.meta.url));
    assert.deepEqual(output, source, `${relative} must be copied without modification`);
  }
});

test('generated manifest keeps the Tools install scope and declares copied icons', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../Output/tools/manifest.webmanifest', import.meta.url), 'utf8'),
  );

  assert.equal(manifest.start_url, '/tools/');
  assert.equal(manifest.scope, '/tools/');
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(manifest.icons, [
    { src: '/tools/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/tools/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  ]);
  for (const icon of manifest.icons) {
    assert.equal(existsSync(outputURLForPrecache(icon.src)), true, `${icon.src} must exist in Output`);
  }
});

test('every service-worker precache URL resolves to generated output', () => {
  const workerSource = readFileSync(new URL('../../Output/tools/sw.js', import.meta.url), 'utf8');
  for (const urlPath of precacheURLs(workerSource)) {
    assert.equal(
      existsSync(outputURLForPrecache(urlPath)),
      true,
      `${urlPath} must resolve to a generated file`,
    );
  }
});

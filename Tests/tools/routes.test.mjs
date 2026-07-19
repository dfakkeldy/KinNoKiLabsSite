import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const toolPages = [
  {
    route: 'tools', pageID: 'hub', title: 'Tools — KinNoKi Labs',
    description: 'Seven small web utilities from KinNoKi Labs — QR codes, EPUB reading, dilution math, contrast checks and more. Offline-capable; everything stays on your device.',
  },
  {
    route: 'tools/qr-code', pageID: 'qr-code', title: 'QR Code Generator — KinNoKi Labs',
    description: 'Generate crisp QR codes as SVG or PNG, entirely in your browser.',
  },
  {
    route: 'tools/epub-reader', pageID: 'epub-reader', title: 'EPUB Reader — KinNoKi Labs',
    description: 'Read EPUB books in your browser while keeping each book on your device.',
  },
  {
    route: 'tools/dilution', pageID: 'dilution', title: 'Dilution Calculator — KinNoKi Labs',
    description: 'Calculate concentrate and water amounts for a precise dilution.',
  },
  {
    route: 'tools/contrast', pageID: 'contrast', title: 'Contrast Checker — KinNoKi Labs',
    description: 'Check text and background colour contrast against WCAG guidance.',
  },
  {
    route: 'tools/word-count', pageID: 'word-count', title: 'Word Counter — KinNoKi Labs',
    description: 'Count words and estimate reading and narration time in your text.',
  },
  {
    route: 'tools/unit-converter', pageID: 'unit-converter', title: 'Unit Converter — KinNoKi Labs',
    description: 'Convert common units from length and mass to data sizes.',
  },
  {
    route: 'tools/passphrase', pageID: 'passphrase', title: 'Passphrase Generator — KinNoKi Labs',
    description: 'Generate strong, memorable passphrases entirely in your browser.',
  },
];

const expectedNavigation = [
  ['/', 'Home'],
  ['/games', 'Games'],
  ['/tools', 'Tools'],
  ['/services', 'Services'],
  ['/apps', 'Apps'],
  ['/posts', 'Posts'],
  ['/about', 'About'],
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

function navigationEntries(markup) {
  return [...markup.matchAll(/<a([^>]*)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => ({
    href: match[2],
    label: match[4].replace(/<[^>]+>/g, '').trim(),
    current: `${match[1]} ${match[3]}`.includes('aria-current="page"'),
  }));
}

for (const { route, pageID, title, description } of toolPages) {
  test(`${route} has independent metadata, install head, tools shell, and no Arcade Hall shell`, () => {
    const html = readFileSync(new URL(`../../Output/${route}/index.html`, import.meta.url), 'utf8');
    const canonical = `https://kinnokilabs.com/${route}`;

    assert.ok(html.includes(`<title>${title}</title>`));
    assert.ok(html.includes(`<meta name="description" content="${description}"/>`));
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}"/>`));
    assert.ok(html.includes(`<meta property="og:url" content="${canonical}"/>`));
    assert.match(html, new RegExp(`data-tool-page="${pageID}"`));
    assert.match(html, /<script[^>]+type="module"[^>]+src="\/tools\/ui\.js"/);
    assert.match(html, /<link[^>]+rel="manifest"[^>]+href="\/tools\/manifest\.webmanifest"/);
    assert.match(html, /<meta name="theme-color" content="#000000"/);
    assert.doesNotMatch(
      html,
      /data-game-page=|id="games-app"|class="[^"]*\bgames-(?:main|app|live-region)\b|src="\/games\/ui\.js"/,
    );

    const desktop = html.match(/<ul class="nav-links">([\s\S]*?)<\/ul>/)?.[1];
    const mobile = html.match(/<div class="mobile-menu">[\s\S]*?<nav>([\s\S]*?)<\/nav>/)?.[1];
    for (const [name, markup] of [['desktop', desktop], ['mobile', mobile]]) {
      assert.notEqual(markup, undefined, `${name} navigation must exist`);
      assert.deepEqual(
        navigationEntries(markup),
        expectedNavigation.map(([href, label]) => ({ href, label, current: href === '/tools' })),
        `${name} navigation order and current page`,
      );
    }
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

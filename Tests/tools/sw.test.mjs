import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { FixtureElement } from '../games/dom-fixture.mjs';
import * as core from '../../Resources/tools/core.js';
import { renderToolsHub } from '../../Resources/tools/hub-ui.js';

const readOptional = (url) => {
  try { return readFileSync(url, 'utf8'); } catch { return ''; }
};

const workerURL = new URL('../../Resources/tools/sw.js', import.meta.url);
const manifestURL = new URL('../../Resources/tools/manifest.webmanifest', import.meta.url);
const workerSource = readOptional(workerURL);
const uiSource = readFileSync(new URL('../../Resources/tools/ui.js', import.meta.url), 'utf8');
const themeSource = readFileSync(
  new URL('../../Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift', import.meta.url),
  'utf8',
);
const cssSource = readFileSync(new URL('../../Resources/styles.css', import.meta.url), 'utf8');

function precacheEntries(source) {
  const body = source.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] ?? '';
  return [...body.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function currentToolAssets() {
  const directory = new URL('../../Resources/tools/', import.meta.url);
  return readdirSync(directory)
    .filter((name) => name.endsWith('.js') && name !== 'sw.js')
    .sort()
    .map((name) => `/tools/${name}`);
}

function currentToolPages() {
  const directory = new URL('../../Content/tools/', import.meta.url);
  return ['/tools/', ...readdirSync(directory)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => `/tools/${name.slice(0, -3)}/`)];
}

function actualFontPath() {
  const relative = cssSource.match(/url\(['"]?([^'")]*OpenDyslexic-Regular\.otf)/)?.[1];
  assert.equal(relative, 'OpenDyslexic-Regular.otf');
  return `/${relative}`;
}

function actualBackgroundColor() {
  return cssSource.match(/:root\s*\{[\s\S]*?--bg:\s*(#[0-9a-fA-F]{6})/)?.[1];
}

function createDocument() {
  const document = { activeElement: null };
  document.createElement = (tag) => new FixtureElement(tag, document);
  return document;
}

function loadWorker() {
  const handlers = new Map();
  const opened = [];
  const deleted = [];
  const added = [];
  const puts = [];
  const matches = [];
  const cache = {
    async addAll(urls) { added.push(...urls); },
    async put(key, response) { puts.push({ key, response }); },
  };
  const context = {
    URL,
    Response: { error: () => ({ type: 'error', status: 0 }) },
    fetch: async () => ({ ok: true, type: 'basic', clone() { return this; } }),
    caches: {
      async open(name) { opened.push(name); return cache; },
      async keys() { return ['kinnoki-tools-v0', 'kinnoki-tools-v1', 'unrelated-v3']; },
      async delete(name) { deleted.push(name); return true; },
      async match(key) { matches.push(key); return null; },
    },
    self: {
      location: { origin: 'https://kinnokilabs.com' },
      clients: { claimed: false, async claim() { this.claimed = true; } },
      skipped: false,
      async skipWaiting() { this.skipped = true; },
      addEventListener(type, handler) { handlers.set(type, handler); },
    },
  };
  if (workerSource) runInNewContext(workerSource, context, { filename: 'sw.js' });
  return { handlers, context, opened, deleted, added, puts, matches };
}

function waitableEvent(extra = {}) {
  let promise;
  return {
    ...extra,
    waitUntil(value) { promise = Promise.resolve(value); },
    done() { return promise; },
  };
}

test('precache is an exact inventory of every current tools page, module, shared asset, manifest, and icon', () => {
  const expected = [
    ...currentToolPages(),
    ...currentToolAssets(),
    '/tools/manifest.webmanifest',
    '/tools/icons/icon-192.png',
    '/tools/icons/icon-512.png',
    '/styles.css',
    '/site.js',
    actualFontPath(),
  ].sort();
  const actual = precacheEntries(workerSource).sort();

  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual).size, actual.length, 'precache entries must not be duplicated');
});

test('manifest is installable, uses actual site colors, and declares real PNG icons', () => {
  const text = readOptional(manifestURL);
  assert.notEqual(text, '', 'manifest.webmanifest must exist');
  const manifest = JSON.parse(text);
  const background = actualBackgroundColor();

  assert.equal(manifest.name, 'KinNoKi Tools');
  assert.equal(manifest.short_name, 'Tools');
  assert.equal(manifest.start_url, '/tools/');
  assert.equal(manifest.scope, '/tools/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.background_color, background);
  assert.equal(manifest.theme_color, background);
  assert.deepEqual(manifest.icons, [
    { src: '/tools/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/tools/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  ]);

  for (const icon of manifest.icons) {
    const bytes = readFileSync(new URL(`../../Resources${icon.src}`, import.meta.url));
    assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
    const size = Number(icon.sizes.split('x')[0]);
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
});

test('worker installs atomically, activates its own cache version, and leaves unrelated caches alone', async () => {
  const worker = loadWorker();
  assert.deepEqual([...worker.handlers.keys()].sort(), ['activate', 'fetch', 'install']);

  const install = waitableEvent();
  worker.handlers.get('install')(install);
  await install.done();
  assert.deepEqual(worker.opened, ['kinnoki-tools-v1']);
  assert.deepEqual(worker.added.sort(), precacheEntries(workerSource).sort());
  assert.equal(worker.context.self.skipped, true);

  const activate = waitableEvent();
  worker.handlers.get('activate')(activate);
  await activate.done();
  assert.deepEqual(worker.deleted, ['kinnoki-tools-v0']);
  assert.equal(worker.context.self.clients.claimed, true);
});

test('worker handles only same-origin GET and caches only successful non-opaque responses', async () => {
  const worker = loadWorker();
  assert.ok(worker.handlers.get('fetch'), 'fetch handler must be registered');

  for (const request of [
    { method: 'POST', url: 'https://kinnokilabs.com/tools/', mode: 'navigate' },
    { method: 'GET', url: 'https://example.com/tools/', mode: 'navigate' },
  ]) {
    let response;
    worker.handlers.get('fetch')({ request, respondWith(value) { response = value; } });
    assert.equal(response, undefined);
  }

  for (const fresh of [
    { ok: false, type: 'basic', clone() { return this; } },
    { ok: true, type: 'opaque', clone() { return this; } },
    { ok: true, type: 'error', clone() { return this; } },
  ]) {
    worker.context.fetch = async () => fresh;
    let response;
    worker.handlers.get('fetch')({
      request: { method: 'GET', url: 'https://kinnokilabs.com/tools/ui.js', mode: 'same-origin' },
      respondWith(value) { response = value; },
    });
    assert.equal(await response, fresh);
  }
  assert.equal(worker.puts.length, 0);

  const fresh = { ok: true, type: 'basic', clone() { return { cloned: true }; } };
  worker.context.fetch = async () => fresh;
  let response;
  worker.handlers.get('fetch')({
    request: { method: 'GET', url: 'https://kinnokilabs.com/tools/ui.js?fresh=1', mode: 'same-origin' },
    respondWith(value) { response = value; },
  });
  assert.equal(await response, fresh);
  assert.deepEqual(worker.puts, [{ key: '/tools/ui.js', response: { cloned: true } }]);
});

test('offline navigation normalization and hub fallback stay inside the tools scope', async () => {
  const worker = loadWorker();
  assert.ok(worker.handlers.get('fetch'), 'fetch handler must be registered');
  worker.context.fetch = async () => { throw new Error('offline'); };
  const cachedPage = { cached: 'word-count' };
  worker.context.caches.match = async (key) => {
    worker.matches.push(key);
    return key === '/tools/word-count/' ? cachedPage : null;
  };

  let response;
  worker.handlers.get('fetch')({
    request: { method: 'GET', url: 'https://kinnokilabs.com/tools/word-count?source=home', mode: 'navigate' },
    respondWith(value) { response = value; },
  });
  assert.equal(await response, cachedPage);
  assert.deepEqual(worker.matches, ['/tools/word-count/']);

  worker.matches.length = 0;
  const hub = { cached: 'hub' };
  worker.context.caches.match = async (key) => {
    worker.matches.push(key);
    return key === '/tools/' ? hub : null;
  };
  worker.handlers.get('fetch')({
    request: { method: 'GET', url: 'https://kinnokilabs.com/tools/missing', mode: 'navigate' },
    respondWith(value) { response = value; },
  });
  assert.equal(await response, hub);
  assert.deepEqual(worker.matches, ['/tools/missing/', '/tools/']);

  worker.matches.length = 0;
  worker.handlers.get('fetch')({
    request: { method: 'GET', url: 'https://kinnokilabs.com/about', mode: 'navigate' },
    respondWith(value) { response = value; },
  });
  assert.deepEqual(await response, { type: 'error', status: 0 });
  assert.deepEqual(worker.matches, ['/about']);
});

test('connectivity chip mounts once, unmounts online, and remounts in hub and tool shells', () => {
  assert.equal(typeof core.updateToolsConnectivity, 'function');
  const document = createDocument();

  for (const mount of [
    (root) => renderToolsHub(root),
    (root) => core.toolShell(root, { title: 'Tool', lede: 'Lede' }),
  ]) {
    const root = document.createElement('main');
    mount(root);
    assert.ok(root.querySelector('[data-tool-connectivity]'));
    core.updateToolsConnectivity(root, false);
    const first = root.querySelector('.tool-offline-chip');
    assert.equal(first?.textContent, 'Offline — everything here still works');
    core.updateToolsConnectivity(root, false);
    assert.equal(root.querySelectorAll('.tool-offline-chip').length, 1);
    core.updateToolsConnectivity(root, true);
    assert.equal(root.querySelector('.tool-offline-chip'), null);
    core.updateToolsConnectivity(root, false);
    assert.notEqual(root.querySelector('.tool-offline-chip'), first);
  }
});

test('tools bootstrap registers the scoped worker and disposes connectivity watching at page hide', () => {
  assert.match(uiSource, /registerToolsServiceWorker\(window\.navigator\?\.serviceWorker\)/);
  assert.match(uiSource, /watchConnectivity\(window,/);
  assert.match(uiSource, /updateToolsConnectivity\(root, online\)/);
  assert.match(uiSource, /addEventListener\('pagehide', disposeConnectivity/);
  assert.match(uiSource, /removeEventListener\('pagehide', disposeConnectivity/);
});

test('only tools pages request the tools manifest and actual-color browser theme', () => {
  assert.match(themeSource, /let toolsHead = page\.path\.string == "tools"\s*\|\| page\.path\.string\.hasPrefix\("tools\/"\)/);
  assert.match(themeSource, /siteHead\(for: page, context: context, toolsHead: toolsHead\)/);
  assert.match(themeSource, /\.if\(toolsHead,\s*\.link\([\s\S]*?rel[\s\S]*?manifest[\s\S]*?\/tools\/manifest\.webmanifest/);
  assert.match(themeSource, /\.if\(toolsHead,\s*\.meta\([\s\S]*?theme-color[\s\S]*?#000000/);
});

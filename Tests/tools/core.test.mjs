import test from 'node:test';
import assert from 'node:assert/strict';
import { FixtureElement } from '../games/dom-fixture.mjs';
import {
  copyText,
  createAnnouncer,
  element,
  formatNumber,
  openToolPrefs,
  parseDecimal,
  registerToolsServiceWorker,
  safeLocalStorage,
  saveToolPrefs,
  setToolPrefs,
  toolPrefs,
  toolShell,
  watchConnectivity,
} from '../../Resources/tools/core.js';

const createDocument = () => {
  const document = { activeElement: null };
  document.createElement = (tag) => new FixtureElement(tag, document);
  return document;
};

const createStorage = () => {
  const values = Object.create(null);
  return {
    values,
    getItem(key) { return values[key] ?? null; },
    setItem(key, value) { values[key] = String(value); },
    removeItem(key) { delete values[key]; },
  };
};

test('element sets text, attributes, and children using its supplied document', () => {
  const document = createDocument();
  const child = document.createElement('strong');
  child.textContent = 'child';

  const node = element('p', { class: 'notice', text: 'Hello ', ownerDocument: document }, child);

  assert.equal(node.getAttribute('class'), 'notice');
  assert.equal(node.getAttribute('ownerDocument'), null);
  assert.equal(node.textContent, 'Hello child');
  assert.equal(node.children[0], child);
});

test('safeLocalStorage returns usable storage and guards inaccessible storage', () => {
  const storage = createStorage();
  assert.equal(safeLocalStorage({ localStorage: storage }), storage);
  assert.equal(safeLocalStorage({ get localStorage() { throw new Error('blocked'); } }), null);
});

test('openToolPrefs returns fresh empty preferences for missing, corrupt, and wrong-version storage', () => {
  const storage = createStorage();
  const empty = { version: 1, tools: {} };

  assert.deepEqual(openToolPrefs(storage), empty);
  storage.setItem('kinnoki-tools:v1', '{not JSON');
  assert.deepEqual(openToolPrefs(storage), empty);
  storage.setItem('kinnoki-tools:v1', JSON.stringify({ version: 2, tools: {} }));
  assert.deepEqual(openToolPrefs(storage), empty);
});

test('preference helpers persist and merge a tool bag under the versioned key', () => {
  const storage = createStorage();
  const initial = openToolPrefs(storage);
  const next = setToolPrefs(storage, initial, 'word-count', { words: 42 });
  const merged = setToolPrefs(storage, next, 'word-count', { readingMinutes: 1 });

  assert.deepEqual(toolPrefs(merged, 'word-count'), { words: 42, readingMinutes: 1 });
  assert.deepEqual(openToolPrefs(storage), merged);
  assert.equal(saveToolPrefs(null, merged), false);
});

test('parseDecimal accepts supported decimal forms and rejects invalid input', () => {
  assert.equal(parseDecimal('1,5'), 1.5);
  assert.equal(parseDecimal('1.5'), 1.5);
  assert.equal(parseDecimal(' 12 '), 12);
  assert.equal(parseDecimal(''), null);
  assert.equal(parseDecimal('1.2.3'), null);
  assert.equal(parseDecimal('-3,5'), -3.5);
});

test('formatNumber trims trailing zeros and observes a decimal precision limit', () => {
  assert.equal(formatNumber(33.3000), '33.3');
  assert.equal(formatNumber(50), '50');
  assert.equal(formatNumber(0.125, 2), '0.13');
  assert.equal(formatNumber(Number.NaN), '—');
});

test('createAnnouncer writes text content to its live region', () => {
  const liveRegion = createDocument().createElement('p');
  const announce = createAnnouncer(liveRegion);

  announce('Copied');

  assert.equal(liveRegion.textContent, 'Copied');
  assert.doesNotThrow(() => createAnnouncer(null)('Ignored'));
});

test('toolShell replaces root content and returns its body after mounting the standard copy', () => {
  const document = createDocument();
  const root = document.createElement('main');
  root.append(document.createElement('span'));

  const body = toolShell(root, { title: 'Word counter', lede: 'Count the words in your text.' });

  assert.equal(root.children.length, 2);
  assert.equal(root.querySelector('h1')?.textContent, 'Word counter');
  assert.equal(root.querySelector('.tool-lede')?.textContent, 'Count the words in your text.');
  assert.equal(root.querySelector('.tool-privacy')?.textContent,
    'Runs entirely in your browser. Nothing you enter leaves this device.');
  assert.equal(body, root.querySelector('.tool-body'));
});

test('copyText reports clipboard success and failure', async () => {
  const copied = [];
  assert.equal(await copyText('private text', { writeText: async (text) => copied.push(text) }), true);
  assert.deepEqual(copied, ['private text']);
  assert.equal(await copyText('private text', { writeText: async () => { throw new Error('denied'); } }), false);
});

test('watchConnectivity reports changes and disposes both registered listeners', () => {
  const listeners = new Map();
  const target = {
    navigator: { onLine: true },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
  };
  const values = [];

  const dispose = watchConnectivity(target, (online) => values.push(online));
  assert.deepEqual(values, [true]);
  assert.equal(listeners.size, 2);
  target.navigator.onLine = false;
  listeners.get('offline')();
  assert.deepEqual(values, [true, false]);

  dispose();
  assert.equal(listeners.size, 0);
});

test('registerToolsServiceWorker uses the fixed tools route and ignores unavailable containers', async () => {
  const registrations = [];
  registerToolsServiceWorker({ register(path) { registrations.push(path); return Promise.resolve(); } });
  registerToolsServiceWorker();

  await Promise.resolve();
  assert.deepEqual(registrations, ['/tools/sw.js']);
});

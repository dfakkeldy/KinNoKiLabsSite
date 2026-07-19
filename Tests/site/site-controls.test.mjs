import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const siteScript = readFileSync(new URL('../../Resources/site.js', import.meta.url), 'utf8');

function classList(initial = []) {
  const values = new Set(initial);
  return {
    add(name) { values.add(name); },
    remove(name) { values.delete(name); },
    contains(name) { return values.has(name); },
    toggle(name, force) {
      if (force === true) values.add(name);
      else if (force === false) values.delete(name);
      else if (values.has(name)) values.delete(name);
      else values.add(name);
      return values.has(name);
    },
  };
}

function button() {
  const attributes = new Map();
  const listeners = new Map();
  return {
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name); },
    addEventListener(type, callback) { listeners.set(type, callback); },
    querySelector() { return null; },
    click() { listeners.get('click')?.(); },
  };
}

function legacyNodeList(items) {
  const collection = { length: items.length };
  items.forEach((item, index) => { collection[index] = item; });
  return collection;
}

function runSiteScript(savedFont) {
  const fontButtons = [button(), button(), button()];
  const body = { classList: classList() };
  const rootAttributes = new Map([['data-theme', 'dark']]);
  const storage = new Map([['kinnoki-dyslexic', savedFont ? 'true' : 'false']]);
  const localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, String(value)); },
  };
  const document = {
    body,
    documentElement: {
      classList: classList(),
      getAttribute(name) { return rootAttributes.get(name) ?? null; },
      setAttribute(name, value) { rootAttributes.set(name, String(value)); },
    },
    querySelector() { return null; },
    querySelectorAll(selector) {
      if (selector === '.font-toggle') return fontButtons;
      return [];
    },
    addEventListener() {},
  };
  const window = { matchMedia: () => ({ matches: true }) };

  vm.runInNewContext(siteScript, { document, window, localStorage }, { filename: 'site.js' });
  return { body, fontButtons, storage };
}

test('saved OpenDyslexic state and every duplicate toggle stay synchronized', () => {
  const { body, fontButtons, storage } = runSiteScript(true);

  assert.equal(body.classList.contains('font-opendyslexic'), true);
  assert.deepEqual(fontButtons.map((item) => item.getAttribute('aria-pressed')), ['true', 'true', 'true']);

  fontButtons[1].click();
  assert.equal(body.classList.contains('font-opendyslexic'), false);
  assert.equal(storage.get('kinnoki-dyslexic'), 'false');
  assert.deepEqual(fontButtons.map((item) => item.getAttribute('aria-pressed')), ['false', 'false', 'false']);

  fontButtons[2].click();
  assert.equal(body.classList.contains('font-opendyslexic'), true);
  assert.equal(storage.get('kinnoki-dyslexic'), 'true');
  assert.deepEqual(fontButtons.map((item) => item.getAttribute('aria-pressed')), ['true', 'true', 'true']);
});

test('site controls initialize when Safari returns NodeLists without forEach', () => {
  const themeButton = button();
  const fontButton = button();
  const burgerButton = button();
  const closeButton = button();
  const menuLink = button();
  const body = { classList: classList() };
  const menu = {
    classList: classList(),
    querySelectorAll() { return legacyNodeList([closeButton, menuLink]); },
  };
  const rootAttributes = new Map([['data-theme', 'dark']]);
  const storage = new Map();
  const localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, String(value)); },
  };
  const collections = new Map([
    ['.theme-toggle', legacyNodeList([themeButton])],
    ['.font-toggle', legacyNodeList([fontButton])],
    ['.nav-burger', legacyNodeList([burgerButton])],
    ['.reveal', legacyNodeList([])],
  ]);
  const document = {
    body,
    documentElement: {
      classList: classList(),
      getAttribute(name) { return rootAttributes.get(name) ?? null; },
      setAttribute(name, value) { rootAttributes.set(name, String(value)); },
    },
    querySelector(selector) { return selector === '.mobile-menu' ? menu : null; },
    querySelectorAll(selector) { return collections.get(selector) ?? legacyNodeList([]); },
    addEventListener() {},
  };
  const window = { matchMedia: () => ({ matches: true }) };

  assert.doesNotThrow(() => {
    vm.runInNewContext(siteScript, { document, window, localStorage }, { filename: 'site.js' });
  });

  themeButton.click();
  assert.equal(rootAttributes.get('data-theme'), 'light');
  fontButton.click();
  assert.equal(body.classList.contains('font-opendyslexic'), true);
  burgerButton.click();
  assert.equal(menu.classList.contains('open'), true);
  closeButton.click();
  assert.equal(menu.classList.contains('open'), false);
});

test('site controls wait for the DOM when a mobile browser ignores defer timing', () => {
  const themeButton = button();
  const fontButton = button();
  const burgerButton = button();
  const closeButton = button();
  const menu = {
    classList: classList(),
    querySelectorAll() { return [closeButton]; },
  };
  const body = { classList: classList() };
  const rootAttributes = new Map([['data-theme', 'dark']]);
  let domReady = false;
  let domReadyCallback;
  const document = {
    body: null,
    readyState: 'loading',
    documentElement: {
      classList: classList(),
      getAttribute(name) { return rootAttributes.get(name) ?? null; },
      setAttribute(name, value) { rootAttributes.set(name, String(value)); },
    },
    querySelector(selector) { return domReady && selector === '.mobile-menu' ? menu : null; },
    querySelectorAll(selector) {
      if (!domReady) return [];
      if (selector === '.theme-toggle') return [themeButton];
      if (selector === '.font-toggle') return [fontButton];
      if (selector === '.nav-burger') return [burgerButton];
      return [];
    },
    addEventListener(type, callback) {
      if (type === 'DOMContentLoaded') domReadyCallback = callback;
    },
  };
  const localStorage = { getItem() { return null; }, setItem() {} };
  const window = { matchMedia: () => ({ matches: true }) };

  vm.runInNewContext(siteScript, { document, window, localStorage }, { filename: 'site.js' });
  domReady = true;
  document.body = body;
  domReadyCallback?.();

  themeButton.click();
  assert.equal(rootAttributes.get('data-theme'), 'light');
  fontButton.click();
  assert.equal(body.classList.contains('font-opendyslexic'), true);
  burgerButton.click();
  assert.equal(menu.classList.contains('open'), true);
});

function fontToggleTags(html) {
  return html.match(/<button\b[^>]*class="[^"]*font-toggle[^"]*"[^>]*>/g) ?? [];
}

test('static and generated font controls start with deterministic pressed state', () => {
  const staticListen = readFileSync(new URL('../../Resources/listen/index.html', import.meta.url), 'utf8');
  const swiftTheme = readFileSync(new URL('../../Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift', import.meta.url), 'utf8');
  const generatedHome = readFileSync(new URL('../../Output/index.html', import.meta.url), 'utf8');
  const generatedListen = readFileSync(new URL('../../Output/listen/index.html', import.meta.url), 'utf8');

  assert.match(swiftTheme, /value: "\/site\.js\?v=20260719"/);
  assert.match(generatedHome, /src="\/site\.js\?v=20260719"/);

  const staticTags = fontToggleTags(staticListen);
  assert.equal(staticTags.length, 1);
  assert.ok(staticTags.every((tag) => tag.includes('aria-pressed="false"')));

  const swiftControls = [...swiftTheme.matchAll(/\.class\("font-toggle"\),([\s\S]{0,400}?)\.text\(/g)];
  assert.equal(swiftControls.length, 3);
  assert.ok(swiftControls.every((match) => (
    match[1].includes('.attribute(named: "aria-pressed", value: "false")')
  )));

  for (const [name, html] of [['home', generatedHome], ['listen', generatedListen]]) {
    const tags = fontToggleTags(html);
    assert.ok(tags.length > 0, `${name} must render at least one font toggle`);
    assert.ok(tags.every((tag) => tag.includes('aria-pressed="false"')), `${name} font toggles must start false`);
  }
});

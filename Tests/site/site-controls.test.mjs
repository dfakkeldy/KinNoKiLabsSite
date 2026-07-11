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

function fontToggleTags(html) {
  return html.match(/<button\b[^>]*class="[^"]*font-toggle[^"]*"[^>]*>/g) ?? [];
}

test('static and generated font controls start with deterministic pressed state', () => {
  const staticListen = readFileSync(new URL('../../Resources/listen/index.html', import.meta.url), 'utf8');
  const swiftTheme = readFileSync(new URL('../../Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift', import.meta.url), 'utf8');
  const generatedHome = readFileSync(new URL('../../Output/index.html', import.meta.url), 'utf8');
  const generatedListen = readFileSync(new URL('../../Output/listen/index.html', import.meta.url), 'utf8');

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

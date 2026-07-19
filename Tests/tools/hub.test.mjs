import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FixtureElement } from '../games/dom-fixture.mjs';
import { TOOLS, renderToolsHub } from '../../Resources/tools/hub-ui.js';

test('catalogue is frozen, seven tools, approved order and hrefs', () => {
  assert.equal(Object.isFrozen(TOOLS), true);
  assert.deepEqual(TOOLS.map(({ id, href }) => ({ id, href })), [
    { id: 'qr-code', href: '/tools/qr-code' },
    { id: 'epub-reader', href: '/tools/epub-reader' },
    { id: 'dilution', href: '/tools/dilution' },
    { id: 'contrast', href: '/tools/contrast' },
    { id: 'word-count', href: '/tools/word-count' },
    { id: 'unit-converter', href: '/tools/unit-converter' },
    { id: 'passphrase', href: '/tools/passphrase' },
  ]);
  for (const tool of TOOLS) {
    assert.equal(typeof tool.title, 'string');
    assert.ok(tool.tagline.length > 0);
  }
});

test('hub mounts one card per tool with title link', () => {
  const document = { activeElement: null };
  document.createElement = (tag) => new FixtureElement(tag, document);
  const root = new FixtureElement('div', document);
  renderToolsHub(root);
  const cards = root.children.filter((child) => (child.getAttribute('class') ?? '').includes('tool-hub-grid'))
    .flatMap((grid) => grid.children);
  assert.equal(cards.length, 7);
  assert.equal(cards[0].getAttribute('class'), 'tool-card');
  assert.deepEqual(cards.map((card) => {
    const titleLink = card.querySelector('h2 a');
    return { text: titleLink?.textContent, href: titleLink?.getAttribute('href') };
  }), TOOLS.map(({ title, href }) => ({ text: title, href })));
});

test('shared tools scaffold exposes the privacy disclosure to JavaScript users', () => {
  const theme = readFileSync(new URL('../../Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift', import.meta.url), 'utf8');
  const toolsMain = theme.slice(
    theme.indexOf('private func toolsMain'),
    theme.indexOf('private func postsListMain'),
  );
  const disclosure = toolsMain.indexOf('Runs entirely in your browser. Nothing you enter leaves this device.');
  const noscript = toolsMain.indexOf('.element(named: "noscript"');
  assert.ok(disclosure >= 0, 'toolsMain must include the exact visible privacy disclosure');
  assert.ok(disclosure < noscript, 'privacy disclosure must appear outside noscript for JavaScript users');
});

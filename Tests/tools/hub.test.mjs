import test from 'node:test';
import assert from 'node:assert/strict';
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
});

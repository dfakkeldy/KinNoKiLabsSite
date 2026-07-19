import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeChapter } from '../../Resources/tools/epub-sanitize.js';

const text = (textContent) => ({ nodeType: 3, textContent });

const source = (tagName, attrs = {}, childNodes = []) => ({
  nodeType: 1,
  tagName: tagName.toUpperCase(),
  childNodes,
  getAttribute(name) { return attrs[name] ?? null; },
});

function outputFactories() {
  const createElement = (tagName) => ({
    nodeType: 1,
    tagName: tagName.toLowerCase(),
    attributes: new Map(),
    childNodes: [],
    append(...children) { this.childNodes.push(...children); },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    set innerHTML(_) { throw new Error('innerHTML must not be used'); },
  });
  const createTextNode = (textContent) => ({ nodeType: 3, textContent });
  return { createElement, createTextNode };
}

const attrsOf = (node) => Object.fromEntries(node.attributes);
const allText = (node) => (
  node.nodeType === 3
    ? node.textContent
    : node.childNodes.map(allText).join('')
);

const sanitize = (root, overrides = {}) => sanitizeChapter(root, {
  ...outputFactories(),
  resolveImage: () => null,
  resolveLink: () => null,
  ...overrides,
});

test('builds a new allowlisted tree and copies only a safe global id', () => {
  const root = source('body', {}, [
    source('p', {
      id: 'opening', style: 'color:red', onclick: 'steal()', class: 'publisher',
    }, [
      text('Read '),
      source('em', {}, [text('this')]),
      text(' first.'),
    ]),
    source('h2', {}, [text('Next')]),
  ]);

  const result = sanitize(root);

  assert.equal(result.tagName, 'div');
  assert.notEqual(result, root);
  assert.deepEqual(result.childNodes.map((node) => node.tagName), ['p', 'h2']);
  assert.deepEqual(attrsOf(result.childNodes[0]), { id: 'opening' });
  assert.deepEqual(result.childNodes[0].childNodes.map((node) => node.tagName ?? '#text'), [
    '#text', 'em', '#text',
  ]);
  assert.equal(allText(result), 'Read this first.Next');
});

test('drops active and network-risk elements with all descendants', () => {
  const dangerous = [
    'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
    'link', 'meta', 'video', 'audio', 'svg', 'math', 'base', 'canvas', 'template',
    'picture', 'source', 'track', 'select', 'textarea',
  ];
  const root = source('body', {}, [
    text('before'),
    ...dangerous.map((tag) => source(tag, {}, [text(`poison-${tag}`)])),
    text('after'),
  ]);

  const result = sanitize(root);

  assert.equal(allText(result), 'beforeafter');
  assert.deepEqual(result.childNodes.map((node) => node.nodeType), [3, 3]);
});

test('unwraps unknown harmless elements while preserving child order', () => {
  const root = source('body', {}, [
    source('foo', { id: 'discarded-wrapper' }, [
      text('A'),
      source('strong', {}, [text('B')]),
      text('C'),
    ]),
    source('p', {}, [text('D')]),
  ]);

  const result = sanitize(root);

  assert.deepEqual(result.childNodes.map((node) => node.tagName ?? '#text'), [
    '#text', 'strong', '#text', 'p',
  ]);
  assert.equal(allText(result), 'ABCD');
});

test('keeps only resolver-produced blob images and bounded alt text', () => {
  const calls = [];
  const resolveImage = (src) => {
    calls.push(src);
    if (src === '../images/cover.png') return 'blob:https://reader.test/cover';
    if (src === 'missing.png') return null;
    if (src === 'bad-result.png') return 'https://tracker.test/image.png';
    return 'blob:https://reader.test/other';
  };
  const root = source('body', {}, [
    source('img', { src: '../images/cover.png', alt: 'Book cover', style: 'width:100%' }),
    source('img', { src: 'missing.png', alt: 'Missing' }),
    source('img', { src: 'bad-result.png', alt: 'Remote result' }),
    source('img', { src: 'javascript:alert(1)', alt: 'Script' }),
    source('img', { src: 'data:image/png;base64,AAAA', alt: 'Data' }),
    source('img', { src: 'file:///private/cover.png', alt: 'File' }),
    source('img', { src: 'https://tracker.test/cover.png', alt: 'Remote' }),
    source('img', { src: '//tracker.test/cover.png', alt: 'Remote shorthand' }),
    source('img', { src: 'other.png', alt: 'x'.repeat(513) }),
  ]);

  const result = sanitize(root, { resolveImage });

  assert.deepEqual(calls, ['../images/cover.png', 'missing.png', 'bad-result.png', 'other.png']);
  assert.equal(result.childNodes.length, 2);
  assert.deepEqual(attrsOf(result.childNodes[0]), {
    src: 'blob:https://reader.test/cover',
    alt: 'Book cover',
  });
  assert.deepEqual(attrsOf(result.childNodes[1]), {
    src: 'blob:https://reader.test/other',
  });
});

test('anchors use resolver data only and external links are HTTP(S)', () => {
  const calls = [];
  const resolveLink = (href) => {
    calls.push(href);
    if (href === 'https://example.com/read') return { external: true, href };
    if (href === 'http://example.com/plain') return { external: true, href };
    if (href === 'ch2.xhtml') return { spineHref: 'OPS/ch2.xhtml' };
    if (href === 'forged.xhtml') return { external: true, href: 'javascript:alert(1)' };
    return null;
  };
  const links = [
    ['https://example.com/read', 'HTTPS'],
    ['http://example.com/plain', 'HTTP'],
    ['ch2.xhtml', 'Internal'],
    ['missing.xhtml', 'Missing'],
    ['forged.xhtml', 'Forged'],
    ['javascript:alert(1)', 'Script'],
    ['data:text/html,bad', 'Data'],
    ['file:///private/book.xhtml', 'File'],
    ['//example.com/network', 'Network'],
  ];
  const root = source('body', {}, links.map(([href, label]) => (
    source('a', { href, onclick: 'bad()', target: '_self' }, [text(label)])
  )));

  const result = sanitize(root, { resolveLink });

  assert.deepEqual(calls, [
    'https://example.com/read', 'http://example.com/plain', 'ch2.xhtml',
    'missing.xhtml', 'forged.xhtml',
  ]);
  assert.deepEqual(result.childNodes.map((node) => node.tagName ?? '#text'), [
    'a', 'a', 'a', '#text', '#text', '#text', '#text', '#text', '#text',
  ]);
  assert.deepEqual(attrsOf(result.childNodes[0]), {
    href: 'https://example.com/read', target: '_blank', rel: 'noopener',
  });
  assert.deepEqual(attrsOf(result.childNodes[1]), {
    href: 'http://example.com/plain', target: '_blank', rel: 'noopener',
  });
  assert.deepEqual(attrsOf(result.childNodes[2]), {
    'data-spine-href': 'OPS/ch2.xhtml',
  });
  assert.equal(allText(result), links.map(([, label]) => label).join(''));
});

test('table spans, ids, and alt text are copied only within safe limits', () => {
  const root = source('body', {}, [
    source('table', {}, [
      source('tr', {}, [
        source('th', { colspan: '2', rowspan: '3', id: 'heading' }, [text('Good')]),
        source('td', { colspan: '0', rowspan: '65535', id: 'has whitespace' }, [text('Bad')]),
        source('td', { colspan: '1001', rowspan: '-1', id: 'x'.repeat(129) }, [text('Also bad')]),
      ]),
    ]),
  ]);

  const cells = sanitize(root).childNodes[0].childNodes[0].childNodes;

  assert.deepEqual(attrsOf(cells[0]), { id: 'heading', colspan: '2', rowspan: '3' });
  assert.deepEqual(attrsOf(cells[1]), {});
  assert.deepEqual(attrsOf(cells[2]), {});
});

test('preserves normal nested allowed structure without recursive stack pressure', () => {
  let nested = text('bottom');
  for (let depth = 0; depth < 64; depth += 1) {
    nested = source('span', {}, [nested]);
  }

  const result = sanitize(source('body', {}, [text('first'), nested, text('last')]));

  assert.equal(allText(result), 'firstbottomlast');
  let cursor = result.childNodes[1];
  let depth = 0;
  while (cursor?.tagName === 'span') {
    depth += 1;
    cursor = cursor.childNodes[0];
  }
  assert.equal(depth, 64);
  assert.equal(cursor.textContent, 'bottom');
});

test('bounds flat-wide source iteration and output node work', () => {
  let pulled = 0;
  const childNodes = {
    [Symbol.iterator]() {
      let index = 0;
      return {
        next() {
          pulled += 1;
          if (index >= 20_000) return { done: true };
          const value = text(String(index));
          index += 1;
          return { done: false, value };
        },
      };
    },
  };
  const root = { ...source('body'), childNodes };

  const result = sanitize(root);

  assert.equal(pulled, 10_000);
  assert.equal(result.childNodes.length, 10_000);
  assert.equal(result.childNodes[0].textContent, '0');
  assert.equal(result.childNodes.at(-1).textContent, '9999');
});

test('caps aggregate text across multiple source text nodes', () => {
  const result = sanitize(source('body', {}, [
    text('a'.repeat(200_000)),
    text('b'.repeat(200_000)),
    text('tail'),
  ]));

  assert.equal(allText(result).length, 262_144);
  assert.equal(allText(result), `${'a'.repeat(200_000)}${'b'.repeat(62_144)}`);
});

test('caps adversarial nesting at 128 element levels', () => {
  let nested = text('too deep');
  for (let depth = 0; depth < 200; depth += 1) {
    nested = source('span', {}, [nested]);
  }

  const result = sanitize(source('body', {}, [nested]));
  let cursor = result.childNodes[0];
  let depth = 0;
  while (cursor?.tagName === 'span') {
    depth += 1;
    cursor = cursor.childNodes[0];
  }

  assert.equal(depth, 128);
  assert.equal(cursor, undefined);
});

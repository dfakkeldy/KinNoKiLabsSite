import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findAll,
  findFirst,
  localName,
  parseXml,
} from '../../Resources/tools/epub-xml.js';

function assertBadXml(xml) {
  assert.throws(
    () => parseXml(xml),
    (error) => error?.code === 'bad-xml',
  );
}

test('parseXml builds a namespace-preserving tree with quoted attributes', () => {
  const root = parseXml(`
    <?xml version="1.0"?>
    <opf:package xmlns:opf="urn:opf" version='3.0'>
      <opf:metadata>
        <dc:title xml:lang='en'>A title</dc:title>
        <meta property="role" />
      </opf:metadata>
    </opf:package>
  `);

  assert.equal(root.name, 'opf:package');
  assert.deepEqual(root.attrs, { 'xmlns:opf': 'urn:opf', version: '3.0' });
  assert.equal(root.children[0].name, 'opf:metadata');
  assert.deepEqual(root.children[0].children[0].attrs, { 'xml:lang': 'en' });
  assert.equal(root.children[0].children[1].name, 'meta');
  assert.deepEqual(root.children[0].children[1].children, []);
});

test('parseXml skips declarations and comments while preserving CDATA text', () => {
  const root = parseXml(`<?xml version="1.0"?>
    <!-- before -->
    <root>alpha<!-- middle --><![CDATA[<b>& raw</b>]]>omega</root>
    <!-- after -->`);

  assert.equal(root.text, 'alpha<b>& raw</b>omega');
  assert.deepEqual(root.children, []);
});

test('parseXml decodes named and numeric entities in text and attributes', () => {
  const root = parseXml(
    `<root label="A &amp; B &quot;Q&quot; &apos;x&apos; &#35; &#x1F642;">` +
      `&amp;&lt;&gt;&quot;&apos; &#65; &#x42;</root>`,
  );

  assert.equal(root.attrs.label, `A & B "Q" 'x' # 🙂`);
  assert.equal(root.text, `&<>"' A B`);
});

test('element text concatenates descendant text in document order', () => {
  const root = parseXml('<root>one<a>two<b>three</b>four</a>five</root>');

  assert.equal(root.text, 'onetwothreefourfive');
  assert.equal(root.children[0].text, 'twothreefour');
});

test('localName and find helpers match element names ignoring prefixes', () => {
  const root = parseXml(
    '<package><metadata><dc:title>One</dc:title><title>Two</title></metadata></package>',
  );

  assert.equal(localName('dc:title'), 'title');
  assert.equal(localName('title'), 'title');
  assert.deepEqual(findAll(root, 'title').map((node) => node.text), ['One', 'Two']);
  assert.equal(findFirst(root, 'title')?.name, 'dc:title');
  assert.equal(findFirst(root, 'missing'), null);
});

test('parseXml rejects malformed element structure', () => {
  for (const xml of [
    '<root><child></root>',
    '<root><child></child>',
    '<root></root><second />',
    'outside<root />',
    '<root/ trailing>',
    '<root attr=nope />',
    '<root a="one" a="two" />',
    '<root><!-- unclosed</root>',
    '<root><![CDATA[unclosed</root>',
    '<!DOCTYPE root><root />',
  ]) {
    assertBadXml(xml);
  }
});

test('parseXml rejects invalid entities and numeric references', () => {
  for (const xml of [
    '<root>&unknown;</root>',
    '<root>&amp</root>',
    '<root>&#;</root>',
    '<root>&#x;</root>',
    '<root>&#0;</root>',
    '<root>&#xD800;</root>',
    '<root>&#x110000;</root>',
    '<root attr="&bogus;" />',
  ]) {
    assertBadXml(xml);
  }
});

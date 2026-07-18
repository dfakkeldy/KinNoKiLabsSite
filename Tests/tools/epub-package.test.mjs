import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseContainer,
  parsePackage,
  parseToc,
  resolveZipPath,
} from '../../Resources/tools/epub-package.js';

test('resolveZipPath resolves OPF-relative paths and decodes safe URL segments', () => {
  assert.equal(resolveZipPath('OEBPS/content.opf', '../images/a.png'), 'images/a.png');
  assert.equal(resolveZipPath('content.opf', 'ch1.xhtml'), 'ch1.xhtml');
  assert.equal(
    resolveZipPath('OEBPS/package.opf', './Text/A%20Chapter.xhtml#opening'),
    'OEBPS/Text/A Chapter.xhtml',
  );
});

test('resolveZipPath rejects root escape, absolute paths, and encoded traversal', () => {
  for (const [baseFile, relative] of [
    ['content.opf', '../outside.xhtml'],
    ['OEBPS/content.opf', '../../outside.xhtml'],
    ['OEBPS/content.opf', '/outside.xhtml'],
    ['OEBPS/content.opf', '\\outside.xhtml'],
    ['OEBPS/content.opf', '%2e%2e/outside.xhtml'],
    ['OEBPS/content.opf', '..%2foutside.xhtml'],
    ['OEBPS/content.opf', '..%5coutside.xhtml'],
    ['OEBPS/content.opf', 'Text%2fchapter.xhtml'],
    ['OEBPS/content.opf', 'Text/%zz.xhtml'],
    ['../content.opf', 'chapter.xhtml'],
    ['OEBPS/content.opf', 'https://example.com/chapter.xhtml'],
  ]) {
    assert.throws(
      () => resolveZipPath(baseFile, relative),
      (error) => error?.code === 'bad-path',
      `${baseFile} + ${relative}`,
    );
  }
});

test('parseContainer returns the first safe rootfile full-path', () => {
  const xml = `<?xml version="1.0"?>
    <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles>
        <rootfile media-type="application/oebps-package+xml"
          full-path="OEBPS/content.opf" />
        <rootfile full-path="alternate.opf" />
      </rootfiles>
    </container>`;

  assert.equal(parseContainer(xml), 'OEBPS/content.opf');
});

test('parseContainer rejects malformed, missing, and unsafe rootfiles', () => {
  for (const xml of [
    '<container><rootfiles /></container>',
    '<container><rootfile full-path="../content.opf" /></container>',
    '<container><rootfile full-path="%2e%2e/content.opf" /></container>',
    '<container><rootfile full-path="/content.opf" /></container>',
    '<container><rootfile full-path="content.opf"></container>',
    '<container>&bogus;</container>',
  ]) {
    assert.throws(
      () => parseContainer(xml),
      (error) => error?.code === 'bad-container',
    );
  }
});

test('parsePackage reads EPUB 3 metadata, cover, nav, and ordered spine', () => {
  const opf = `<?xml version="1.0"?>
    <package xmlns="http://www.idpf.org/2007/opf"
      xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0">
      <metadata>
        <dc:title>  A &amp; B  </dc:title>
        <dc:title>Ignored title</dc:title>
        <dc:creator> First Author </dc:creator>
        <dc:creator>Second Author</dc:creator>
      </metadata>
      <manifest>
        <item id="chapter" href="Text/ch1.xhtml" media-type="application/xhtml+xml" />
        <item id="chapter" href="Text/duplicate.xhtml" media-type="application/xhtml+xml" />
        <item id="cover" href="../Images/cover.jpg" media-type="image/jpeg"
          properties="scripted cover-image remote-resources" />
        <item id="navigation" href="nav.xhtml" media-type="application/xhtml+xml"
          properties="nav" />
        <item id="unsafe" href="%2e%2e/%2e%2e/private" media-type="text/plain" />
      </manifest>
      <spine>
        <itemref idref="chapter" />
        <itemref idref="missing" />
        <itemref idref="chapter" />
      </spine>
    </package>`;

  const result = parsePackage(opf, 'OEBPS/content.opf');

  assert.equal(result.title, 'A & B');
  assert.equal(result.author, 'First Author');
  assert.equal(result.coverHref, 'Images/cover.jpg');
  assert.equal(result.navHref, 'OEBPS/nav.xhtml');
  assert.equal(result.ncxHref, null);
  assert.deepEqual(result.manifest.get('chapter'), {
    href: 'OEBPS/Text/ch1.xhtml',
    mediaType: 'application/xhtml+xml',
    properties: '',
  });
  assert.equal(result.manifest.has('unsafe'), false);
  assert.deepEqual(result.spine, [
    {
      idref: 'chapter',
      href: 'OEBPS/Text/ch1.xhtml',
      mediaType: 'application/xhtml+xml',
    },
    {
      idref: 'chapter',
      href: 'OEBPS/Text/ch1.xhtml',
      mediaType: 'application/xhtml+xml',
    },
  ]);
});

test('parsePackage reads EPUB 2 cover metadata and NCX reference', () => {
  const opf = `<package xmlns="http://www.idpf.org/2007/opf"
      xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
    <metadata>
      <dc:title>EPUB Two</dc:title>
      <dc:creator>Writer</dc:creator>
      <meta name="cover" content="cover-item" />
    </metadata>
    <manifest>
      <item id="cover-item" href="images/cover.png" media-type="image/png" />
      <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />
      <item id="one" href="one.xhtml" media-type="application/xhtml+xml" />
    </manifest>
    <spine toc="ncx"><itemref idref="one" /></spine>
  </package>`;

  const result = parsePackage(opf, 'OPS/book.opf');

  assert.equal(result.title, 'EPUB Two');
  assert.equal(result.author, 'Writer');
  assert.equal(result.coverHref, 'OPS/images/cover.png');
  assert.equal(result.navHref, null);
  assert.equal(result.ncxHref, 'OPS/toc.ncx');
});

test('parsePackage uses exact metadata fallbacks and null optional references', () => {
  const result = parsePackage(
    `<package><metadata><dc:title> </dc:title><dc:creator /></metadata>
      <manifest><item id="cover" href="cover.jpg" media-type="image/jpeg" /></manifest>
      <spine toc="missing"><itemref idref="missing" /></spine></package>`,
    'book.opf',
  );

  assert.equal(result.title, 'Untitled');
  assert.equal(result.author, 'Unknown author');
  assert.equal(result.coverHref, null);
  assert.equal(result.navHref, null);
  assert.equal(result.ncxHref, null);
  assert.deepEqual(result.spine, []);
});

test('parsePackage rejects malformed XML and an unsafe OPF path', () => {
  for (const [opf, path] of [
    ['<package><manifest></package>', 'content.opf'],
    ['<package />', '../content.opf'],
  ]) {
    assert.throws(
      () => parsePackage(opf, path),
      (error) => error?.code === 'bad-package',
    );
  }
});

test('parseToc reads only the EPUB 3 toc nav and strips fragments for v1', () => {
  const nav = `<html xmlns="http://www.w3.org/1999/xhtml"
      xmlns:epub="http://www.idpf.org/2007/ops">
    <body>
      <nav epub:type="landmarks"><ol><li><a href="cover.xhtml">Cover</a></li></ol></nav>
      <nav epub:type="toc">
        <ol>
          <li><a href="Text/ch1.xhtml#opening"> Chapter <span>One</span> </a></li>
          <li><a href="../shared/ch2.xhtml#middle">Chapter Two</a></li>
          <li><a href="https://example.com/outside">External</a></li>
          <li><span>Missing link</span></li>
        </ol>
      </nav>
    </body>
  </html>`;

  assert.deepEqual(parseToc(nav, 'OEBPS/nav.xhtml', 'nav'), [
    { label: 'Chapter One', href: 'OEBPS/Text/ch1.xhtml' },
    { label: 'Chapter Two', href: 'shared/ch2.xhtml' },
  ]);
});

test('parseToc reads nested NCX navPoints in document order', () => {
  const ncx = `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
    <navMap>
      <navPoint id="one">
        <navLabel><text>Chapter One</text></navLabel>
        <content src="Text/ch1.xhtml#opening" />
        <navPoint id="one-a">
          <navLabel><text>Part A</text></navLabel>
          <content src="Text/ch1a.xhtml#part" />
        </navPoint>
      </navPoint>
      <navPoint id="missing"><navLabel><text>No content</text></navLabel></navPoint>
      <navPoint id="two">
        <navLabel><text>  Chapter   Two  </text></navLabel>
        <content src="Text/ch2.xhtml" />
      </navPoint>
    </navMap>
  </ncx>`;

  assert.deepEqual(parseToc(ncx, 'OEBPS/toc.ncx', 'ncx'), [
    { label: 'Chapter One', href: 'OEBPS/Text/ch1.xhtml' },
    { label: 'Part A', href: 'OEBPS/Text/ch1a.xhtml' },
    { label: 'Chapter Two', href: 'OEBPS/Text/ch2.xhtml' },
  ]);
});

test('parseToc returns an empty list for malformed, unknown, or unusable input', () => {
  assert.deepEqual(parseToc('<nav><a href="chapter.xhtml">One</nav>', 'toc.xhtml', 'nav'), []);
  assert.deepEqual(parseToc('<nav />', 'toc.xhtml', 'other'), []);
  assert.deepEqual(
    parseToc('<nav><a href="%2e%2e/outside.xhtml">Outside</a></nav>', 'toc.xhtml', 'nav'),
    [],
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import * as zlib from 'node:zlib';

import { createDOMFixture, FixtureEvent, installDOM } from '../games/dom-fixture.mjs';
import { renderEpubTool } from '../../Resources/tools/epub-reader-ui.js';
import { fakeIndexedDb } from './fake-idb.mjs';

const encoder = new TextEncoder();

const bytes = (value) => (
  typeof value === 'string' ? encoder.encode(value) : Uint8Array.from(value)
);

const joinBytes = (...chunks) => {
  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
};

const record = (length, write) => {
  const output = new Uint8Array(length);
  write(new DataView(output.buffer));
  return output;
};

function buildZip(entries) {
  const local = [];
  const central = [];
  let localOffset = 0;
  for (const description of entries) {
    const name = encoder.encode(description.name);
    const plain = bytes(description.data ?? []);
    const method = description.method ?? 0;
    const flags = description.flags ?? 0;
    const compressed = method === 8
      ? Uint8Array.from(zlib.deflateRawSync(plain))
      : plain;
    const localHeader = record(30, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, flags, true);
      view.setUint16(8, method, true);
      view.setUint32(18, compressed.length, true);
      view.setUint32(22, plain.length, true);
      view.setUint16(26, name.length, true);
    });
    const localRecord = joinBytes(localHeader, name, compressed);
    local.push(localRecord);

    const centralHeader = record(46, (view) => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, flags, true);
      view.setUint16(10, method, true);
      view.setUint32(20, compressed.length, true);
      view.setUint32(24, plain.length, true);
      view.setUint16(28, name.length, true);
      view.setUint32(42, localOffset, true);
    });
    central.push(joinBytes(centralHeader, name));
    localOffset += localRecord.length;
  }
  const localBytes = joinBytes(...local);
  const centralBytes = joinBytes(...central);
  const eocd = record(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, entries.length, true);
    view.setUint16(10, entries.length, true);
    view.setUint32(12, centralBytes.length, true);
    view.setUint32(16, localBytes.length, true);
  });
  return joinBytes(localBytes, centralBytes, eocd).buffer;
}

const containerXml = `<?xml version="1.0"?>
  <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles><rootfile full-path="OPS/content.opf" /></rootfiles>
  </container>`;

const opf = (title, author) => `<package xmlns="http://www.idpf.org/2007/opf"
    xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0">
  <metadata><dc:title>${title}</dc:title><dc:creator>${author}</dc:creator></metadata>
  <manifest>
    <item id="cover" href="images/cover.png" media-type="image/png" properties="cover-image" />
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="one" href="ch1.xhtml" media-type="application/xhtml+xml" />
    <item id="two" href="ch2.xhtml" media-type="application/xhtml+xml" />
    <item id="inline" href="images/inline.png" media-type="image/png" />
  </manifest>
  <spine><itemref idref="one" /><itemref idref="two" /></spine>
</package>`;

const nav = `<html xmlns="http://www.w3.org/1999/xhtml"
    xmlns:epub="http://www.idpf.org/2007/ops"><body>
  <nav epub:type="toc"><ol>
    <li><a href="ch1.xhtml#start">Chapter One</a></li>
    <li><a href="ch2.xhtml">Chapter Two</a></li>
  </ol></nav>
</body></html>`;

function bookFixture({
  title = 'Fixture Book',
  author = 'Fixture Author',
  chapterMethod = 0,
  inlineMethod = 0,
  encrypted = false,
  unsupported = false,
} = {}) {
  return buildZip([
    { name: 'mimetype', data: 'application/epub+zip' },
    { name: 'META-INF/container.xml', data: containerXml },
    { name: 'OPS/content.opf', data: opf(title, author) },
    { name: 'OPS/nav.xhtml', data: nav },
    {
      name: 'OPS/ch1.xhtml',
      data: '<html><body><h1>Chapter One</h1><img src="images/inline.png" /></body></html>',
      method: unsupported ? 12 : chapterMethod,
      flags: encrypted ? 1 : 0,
    },
    { name: 'OPS/ch2.xhtml', data: '<html><body><h1>Chapter Two</h1></body></html>' },
    { name: 'OPS/images/cover.png', data: [137, 80, 78, 71] },
    { name: 'OPS/images/inline.png', data: [1, 2, 3, 4], method: inlineMethod },
  ]);
}

const epubFile = (buffer, name = 'fixture.epub') => {
  const file = new Blob([buffer], { type: 'application/epub+zip' });
  Object.defineProperty(file, 'name', { configurable: true, value: name });
  return file;
};

const sourceText = (textContent) => ({ nodeType: 3, textContent });
const source = (tagName, attrs = {}, childNodes = []) => ({
  nodeType: 1,
  tagName: tagName.toUpperCase(),
  childNodes,
  getAttribute(name) { return attrs[name] ?? null; },
});

function parserStub({ parserErrorFirst = false } = {}) {
  const calls = [];
  let xhtmlAttempts = 0;
  return {
    calls,
    parseFromString(markup, type) {
      calls.push({ markup, type });
      if (parserErrorFirst && type === 'application/xhtml+xml' && xhtmlAttempts++ === 0) {
        return {
          body: null,
          querySelector(selector) {
            return selector === 'parsererror' ? source('parsererror') : null;
          },
        };
      }
      const second = markup.includes('Chapter Two');
      const body = source('body', {}, second ? [
        source('h1', {}, [sourceText('Chapter Two')]),
      ] : [
        source('h1', { id: 'start' }, [sourceText('Chapter One')]),
        source('p', {}, [sourceText('Safe text')]),
        source('script', {}, [sourceText('poison')]),
        source('img', { src: 'images/inline.png', alt: 'Inline art' }),
        source('a', { href: 'ch2.xhtml#middle' }, [sourceText('Continue')]),
        source('a', { href: 'https://example.com/reference' }, [sourceText('Reference')]),
        source('a', { href: '../outside.xhtml' }, [sourceText('Outside')]),
      ]);
      return {
        body,
        querySelector(selector) {
          if (selector === 'parsererror') return null;
          if (selector === 'body') return body;
          return null;
        },
      };
    },
  };
}

const inflateWithNode = async (input) => Uint8Array.from(zlib.inflateRawSync(input));

const storageFixture = () => {
  const values = new Map();
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
};

const urlRecorder = () => {
  const created = [];
  const revoked = [];
  return {
    created,
    revoked,
    factory: {
      create(blob) {
        const url = `blob:epub-${created.length + 1}`;
        created.push({ blob, url });
        return url;
      },
      revoke(url) { revoked.push(url); },
    },
  };
};

const waitFor = async (predicate, message = 'condition') => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(`Timed out waiting for ${message}`);
};

const findButton = (root, label) => {
  const match = root.querySelectorAll('button').find((button) => button.textContent === label);
  assert.ok(match, `${label} button should exist`);
  return match;
};

const importThroughInput = async (root, file) => {
  const input = root.querySelector('input[type=file]');
  assert.ok(input, 'file input should exist');
  input.files = [file];
  input.dispatchEvent(new FixtureEvent('change'));
  await waitFor(
    () => root.querySelector('.epub-book-card') || root.querySelector('.tool-error'),
    'EPUB import result',
  );
};

async function mountedTool(run, overrides = {}) {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  const idb = overrides.idb ?? fakeIndexedDb();
  const storage = overrides.storage ?? storageFixture();
  const urls = overrides.urls ?? urlRecorder();
  const parser = overrides.domParser ?? parserStub();
  const announcements = [];
  const storageCalls = { estimate: 0, persist: 0 };
  const navigator = overrides.navigator ?? {
    storage: {
      async estimate() { storageCalls.estimate += 1; return { usage: 2.5 * 1024 * 1024 }; },
      async persist() { storageCalls.persist += 1; return true; },
    },
  };
  let dispose;
  try {
    dispose = renderEpubTool(fixture.root, {
      idb,
      storage,
      announce: (message) => announcements.push(message),
      inflate: inflateWithNode,
      domParser: parser,
      urlFactory: urls.factory,
      navigator,
      ...overrides,
    });
    await waitFor(
      () => fixture.root.querySelector('.epub-library-grid') || fixture.root.querySelector('.tool-error'),
      'initial EPUB library',
    );
    await run({
      fixture, idb, storage, urls, parser, announcements, storageCalls, dispose,
    });
  } finally {
    dispose?.();
    restore();
  }
}

test('exports the EPUB reader controller contract', () => {
  assert.equal(typeof renderEpubTool, 'function');
});

test('mounts an accessible empty library and imports a real fixture EPUB locally', async () => {
  await mountedTool(async ({ fixture, idb, urls, storageCalls }) => {
    assert.match(fixture.root.textContent, /No books yet/);
    const input = fixture.root.querySelector('input[type=file]');
    assert.equal(input.getAttribute('accept'), '.epub');
    assert.equal(fixture.root.querySelector(`label[for=${input.id}]`).textContent, 'Choose an EPUB');
    const drop = fixture.root.querySelector('.epub-drop');
    assert.equal(drop.getAttribute('role'), 'button');
    assert.equal(drop.getAttribute('tabindex'), '0');
    assert.match(fixture.root.textContent, /Using about 2.5 MB/);

    await importThroughInput(fixture.root, epubFile(bookFixture()));

    const card = fixture.root.querySelector('.epub-book-card');
    assert.match(card.textContent, /Fixture Book/);
    assert.match(card.textContent, /Fixture Author/);
    assert.match(card.textContent, /Progress 0%/i);
    const stored = [...idb.inspect('kinnoki-tools-epub').stores.get('books').records.values()];
    assert.equal(stored.length, 1);
    assert.equal(stored[0].title, 'Fixture Book');
    assert.equal(stored[0].author, 'Fixture Author');
    assert.equal(stored[0].spineCount, 2);
    assert.ok(stored[0].file instanceof Blob);
    assert.ok(stored[0].coverBlob instanceof Blob);
    assert.equal(await stored[0].coverBlob.arrayBuffer().then((value) => value.byteLength), 4);
    const cover = card.querySelector('img');
    assert.equal(cover.getAttribute('src'), urls.created.at(-1).url);
    assert.equal(cover.getAttribute('alt'), 'Cover of Fixture Book');
    assert.equal(storageCalls.persist, 1);

    const second = epubFile(bookFixture({ title: 'Second Book' }), 'second.epub');
    const picker = fixture.root.querySelector('input[type=file]');
    picker.files = [second];
    picker.dispatchEvent(new FixtureEvent('change'));
    await waitFor(() => fixture.root.querySelectorAll('.epub-book-card').length === 2, 'second import');
    assert.equal(storageCalls.persist, 1, 'persistent storage is requested once per mount');
  });
});

test('prevents form and drop navigation and disables import without an inflater', async () => {
  await mountedTool(async ({ fixture }) => {
    const input = fixture.root.querySelector('input[type=file]');
    const error = fixture.root.querySelector('.tool-error');
    assert.equal(input.disabled, true);
    assert.match(error.textContent, /needs a newer browser/i);
    assert.equal(fixture.root.querySelector('.epub-drop').getAttribute('aria-disabled'), 'true');

    const submit = new FixtureEvent('submit');
    fixture.root.querySelector('form').dispatchEvent(submit);
    assert.equal(submit.defaultPrevented, true);
    const drag = new FixtureEvent('dragover', { dataTransfer: { files: [] } });
    fixture.root.querySelector('.epub-drop').dispatchEvent(drag);
    assert.equal(drag.defaultPrevented, true);
    const drop = new FixtureEvent('drop', { dataTransfer: { files: [epubFile(bookFixture())] } });
    fixture.root.querySelector('.epub-drop').dispatchEvent(drop);
    assert.equal(drop.defaultPrevented, true);
  }, { inflate: null });
});

test('maps corrupt, encrypted/DRM, and unsupported archives to distinct messages', async () => {
  await mountedTool(async ({ fixture }) => {
    await importThroughInput(fixture.root, epubFile(bytes('not a zip').buffer));
    assert.match(fixture.root.querySelector('.tool-error').textContent, /couldn.t read/i);

    await importThroughInput(fixture.root, epubFile(bookFixture({ encrypted: true }), 'locked.epub'));
    assert.match(fixture.root.querySelector('.tool-error').textContent, /DRM/i);

    await importThroughInput(fixture.root, epubFile(bookFixture({ unsupported: true }), 'legacy.epub'));
    assert.match(fixture.root.querySelector('.tool-error').textContent, /unsupported compression/i);
  });
});

test('deletes only after a two-button inline confirmation and revokes its cover URL', async () => {
  await mountedTool(async ({ fixture, urls }) => {
    fixture.window.confirm = () => assert.fail('window.confirm must not be called');
    await importThroughInput(fixture.root, epubFile(bookFixture()));
    const coverUrl = fixture.root.querySelector('.epub-book-card img').getAttribute('src');

    findButton(fixture.root, 'Delete').click();
    const confirmation = fixture.root.querySelector('.epub-delete-confirm');
    assert.ok(confirmation);
    assert.ok(findButton(confirmation, 'Cancel'));
    assert.ok(findButton(confirmation, 'Delete book'));
    assert.ok(fixture.root.querySelector('.epub-book-card'));
    findButton(confirmation, 'Cancel').click();
    assert.equal(fixture.root.querySelector('.epub-delete-confirm'), null);

    findButton(fixture.root, 'Delete').click();
    findButton(fixture.root.querySelector('.epub-delete-confirm'), 'Delete book').click();
    await waitFor(() => fixture.root.querySelector('.epub-book-card') === null, 'book deletion');
    assert.match(fixture.root.textContent, /No books yet/);
    assert.ok(urls.revoked.includes(coverUrl));
  });
});

test('disposal revokes cover URLs held by the mounted library', async () => {
  await mountedTool(async ({ fixture, urls, dispose }) => {
    await importThroughInput(fixture.root, epubFile(bookFixture()));
    const coverUrl = fixture.root.querySelector('.epub-book-card img').getAttribute('src');

    dispose();

    assert.ok(urls.revoked.includes(coverUrl));
  });
});

test('persistent storage is requested only once across controller remounts', async () => {
  const idb = fakeIndexedDb();
  let persistCalls = 0;
  const navigator = {
    storage: {
      async estimate() { return {}; },
      async persist() { persistCalls += 1; return true; },
    },
  };
  await mountedTool(async ({ fixture, dispose }) => {
    await importThroughInput(fixture.root, epubFile(bookFixture()));
    assert.equal(persistCalls, 1);
    dispose();

    const nextDispose = renderEpubTool(fixture.root, {
      idb,
      storage: storageFixture(),
      inflate: inflateWithNode,
      domParser: parserStub(),
      urlFactory: urlRecorder().factory,
      navigator,
    });
    await waitFor(() => fixture.root.querySelector('.epub-book-card'), 'remounted library');
    const picker = fixture.root.querySelector('input[type=file]');
    picker.files = [epubFile(bookFixture({ title: 'Another Book' }))];
    picker.dispatchEvent(new FixtureEvent('change'));
    await waitFor(() => fixture.root.querySelectorAll('.epub-book-card').length === 2, 'remounted import');

    assert.equal(persistCalls, 1);
    nextDispose();
  }, { idb, navigator });
});

test('opens, sanitizes, navigates by controls/link/TOC, and revokes chapter URLs', async () => {
  await mountedTool(async ({ fixture, urls, parser, idb }) => {
    await importThroughInput(fixture.root, epubFile(bookFixture()));
    const coverUrl = fixture.root.querySelector('.epub-book-card img').getAttribute('src');
    findButton(fixture.root, 'Open').click();
    await waitFor(() => fixture.root.querySelector('.epub-chapter h1'), 'first chapter');

    assert.ok(fixture.root.querySelector('.epub-reader'));
    assert.match(fixture.root.querySelector('.epub-chapter').textContent, /Chapter One/);
    assert.equal(fixture.root.textContent.includes('poison'), false);
    assert.ok(urls.revoked.includes(coverUrl));
    const inline = fixture.root.querySelector('.epub-chapter img');
    const inlineUrl = inline.getAttribute('src');
    assert.match(inlineUrl, /^blob:epub-/);
    const internal = fixture.root.querySelector('.epub-chapter a[data-spine-href]');
    assert.equal(internal.getAttribute('data-spine-href'), 'OPS/ch2.xhtml');
    assert.equal(internal.hasAttribute('href'), false);
    const external = fixture.root.querySelector('.epub-chapter a[href]');
    assert.equal(external.getAttribute('href'), 'https://example.com/reference');
    assert.equal(external.getAttribute('target'), '_blank');
    assert.equal(fixture.root.querySelector('.epub-chapter').textContent.includes('Outside'), true);

    const previous = findButton(fixture.root, 'Previous');
    const next = findButton(fixture.root, 'Next');
    assert.equal(previous.disabled, true);
    assert.equal(next.disabled, false);
    const tocButton = findButton(fixture.root, 'Table of contents');
    const toc = fixture.root.querySelector('.epub-toc');
    assert.equal(toc.classList.contains('is-open'), false);
    tocButton.click();
    assert.equal(toc.classList.contains('is-open'), true);
    assert.deepEqual(toc.querySelectorAll('button').map((button) => button.textContent), [
      'Chapter One', 'Chapter Two',
    ]);
    findButton(toc, 'Chapter Two').click();
    await waitFor(() => fixture.root.querySelector('.epub-chapter').textContent.includes('Chapter Two'), 'TOC navigation');
    assert.ok(urls.revoked.includes(inlineUrl));
    assert.equal(previous.disabled, false);
    assert.equal(next.disabled, true);
    const position = [...idb.inspect('kinnoki-tools-epub').stores.get('positions').records.values()][0];
    assert.equal(position.spineIndex, 1);

    previous.click();
    await waitFor(() => fixture.root.querySelector('.epub-chapter').textContent.includes('Chapter One'), 'previous navigation');
    fixture.root.querySelector('.epub-chapter a[data-spine-href]').click();
    await waitFor(() => fixture.root.querySelector('.epub-chapter').textContent.includes('Chapter Two'), 'inline link navigation');
    assert.equal(parser.calls.filter((call) => call.type === 'application/xhtml+xml').length >= 3, true);

    const activeChapterUrl = urls.created.findLast(({ blob }) => blob.type === 'image/png')?.url;
    findButton(fixture.root, 'Back to library').click();
    await waitFor(() => fixture.root.querySelector('.epub-library-grid'), 'back to library');
    assert.equal(fixture.activeIntervalCount(), 0);
    if (activeChapterUrl) assert.ok(urls.revoked.includes(activeChapterUrl));
  });
});

test('falls back from XHTML parsererror to HTML parsing', async () => {
  const domParser = parserStub({ parserErrorFirst: true });
  await mountedTool(async ({ fixture }) => {
    await importThroughInput(fixture.root, epubFile(bookFixture()));
    findButton(fixture.root, 'Open').click();
    await waitFor(() => fixture.root.querySelector('.epub-chapter h1'), 'fallback chapter');
    assert.deepEqual(domParser.calls.slice(0, 2).map((call) => call.type), [
      'application/xhtml+xml', 'text/html',
    ]);
  }, { domParser });
});

test('persists reader preferences and interval-ticked dirty scroll without a timeout', async () => {
  await mountedTool(async ({ fixture, storage, idb }) => {
    await importThroughInput(fixture.root, epubFile(bookFixture()));
    findButton(fixture.root, 'Open').click();
    await waitFor(() => fixture.root.querySelector('.epub-chapter h1'), 'reader controls');
    const chapter = fixture.root.querySelector('.epub-chapter');
    assert.equal(chapter.style.getPropertyValue('font-size'), '100%');
    findButton(fixture.root, 'Increase font size').click();
    assert.equal(chapter.style.getPropertyValue('font-size'), '110%');
    const font = fixture.root.querySelector('select[name=fontFamily]');
    assert.deepEqual(font.querySelectorAll('option').map((option) => option.textContent), [
      'Serif', 'Sans serif', 'OpenDyslexic',
    ]);
    font.value = 'OpenDyslexic';
    font.dispatchEvent(new FixtureEvent('change'));
    assert.match(chapter.style.getPropertyValue('font-family'), /OpenDyslexic/);
    const saved = JSON.parse(storage.values.get('kinnoki-tools:v1')).tools['epub-reader'];
    assert.equal(saved.fontSize, 110);
    assert.equal(saved.fontFamily, 'OpenDyslexic');

    fixture.root.scrollTop = 250;
    fixture.root.scrollHeight = 1000;
    fixture.root.clientHeight = 500;
    const before = idb.transactions.filter((entry) => entry.mode === 'readwrite').length;
    fixture.root.dispatchEvent(new FixtureEvent('scroll', { bubbles: false }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      idb.transactions.filter((entry) => entry.mode === 'readwrite').length,
      before,
      'scroll only marks the position dirty',
    );
    fixture.tickIntervals();
    await waitFor(() => {
      const stored = [...idb.inspect('kinnoki-tools-epub').stores.get('positions').records.values()][0];
      return stored?.scrollFraction === 0.5;
    }, 'interval scroll checkpoint');
  });
});

test('restores saved spine and scroll position after a full controller remount', async () => {
  const idb = fakeIndexedDb();
  await mountedTool(async ({ fixture, dispose }) => {
    await importThroughInput(fixture.root, epubFile(bookFixture()));
    findButton(fixture.root, 'Open').click();
    await waitFor(() => fixture.root.querySelector('.epub-chapter h1'), 'initial reader');
    findButton(fixture.root, 'Next').click();
    await waitFor(() => fixture.root.querySelector('.epub-chapter').textContent.includes('Chapter Two'), 'second chapter');
    fixture.root.scrollTop = 150;
    fixture.root.scrollHeight = 800;
    fixture.root.clientHeight = 500;
    fixture.root.dispatchEvent(new FixtureEvent('scroll', { bubbles: false }));
    fixture.tickIntervals();
    await waitFor(() => (
      [...idb.inspect('kinnoki-tools-epub').stores.get('positions').records.values()][0]?.scrollFraction === 0.5
    ), 'saved position');
    dispose();

    const scrolls = [];
    fixture.root.scrollTo = (options) => scrolls.push(options);
    const nextDispose = renderEpubTool(fixture.root, {
      idb,
      storage: storageFixture(),
      inflate: inflateWithNode,
      domParser: parserStub(),
      urlFactory: urlRecorder().factory,
      navigator: {},
    });
    await waitFor(() => fixture.root.querySelector('.epub-book-card'), 'reloaded library');
    findButton(fixture.root, 'Open').click();
    await waitFor(() => fixture.root.querySelector('.epub-chapter')?.textContent.includes('Chapter Two'), 'restored chapter');
    assert.deepEqual(scrolls.at(-1), { top: 150, behavior: 'auto' });
    nextDispose();
  }, { idb });
});

test('remount invalidates pending imports and removes listeners from detached controls', async () => {
  const idb = fakeIndexedDb();
  await mountedTool(async ({ fixture }) => {
    let resolveBuffer;
    const pending = new Promise((resolve) => { resolveBuffer = resolve; });
    const staleFile = { name: 'stale.epub', arrayBuffer: () => pending };
    const oldInput = fixture.root.querySelector('input[type=file]');
    oldInput.files = [staleFile];
    oldInput.dispatchEvent(new FixtureEvent('change'));

    const secondDispose = renderEpubTool(fixture.root, {
      idb,
      storage: storageFixture(),
      inflate: inflateWithNode,
      domParser: parserStub(),
      urlFactory: urlRecorder().factory,
      navigator: {},
    });
    resolveBuffer(bookFixture());
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(idb.inspect('kinnoki-tools-epub').stores.get('books').records.size, 0);

    oldInput.files = [epubFile(bookFixture())];
    oldInput.dispatchEvent(new FixtureEvent('change'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(idb.inspect('kinnoki-tools-epub').stores.get('books').records.size, 0);
    secondDispose();
  }, { idb });
});

test('back and disposal cancel stale chapter image work without leaking object URLs', async () => {
  let resolveInflate;
  const pendingInflate = new Promise((resolve) => { resolveInflate = resolve; });
  const urls = urlRecorder();
  await mountedTool(async ({ fixture }) => {
    await importThroughInput(fixture.root, epubFile(bookFixture({ inlineMethod: 8 })));
    findButton(fixture.root, 'Open').click();
    await waitFor(() => fixture.root.querySelector('.epub-reader'), 'reader shell before image inflate');
    findButton(fixture.root, 'Back to library').click();
    await waitFor(() => fixture.root.querySelector('.epub-library-grid'), 'library while image is pending');
    const createdBefore = urls.created.length;
    resolveInflate(Uint8Array.of(1, 2, 3, 4));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(urls.created.length, createdBefore, 'stale image bytes never gain an object URL');
    assert.equal(fixture.activeIntervalCount(), 0);
  }, {
    urls,
    inflate: async () => pendingInflate,
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as zlib from 'node:zlib';
import * as epubZip from '../../Resources/tools/epub-zip.js';

const encoder = new TextEncoder();

const asBytes = (value) => (
  typeof value === 'string' ? encoder.encode(value) : Uint8Array.from(value)
);

const joinBytes = (...chunks) => {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return joined;
};

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return crc >>> 0;
});

const crc32 = (bytes) => {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(bytes) >>> 0;
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
};

const record = (length, write) => {
  const bytes = new Uint8Array(length);
  write(new DataView(bytes.buffer));
  return bytes;
};

function buildZip(entries, { comment = new Uint8Array() } = {}) {
  const localParts = [];
  const centralParts = [];
  const records = [];
  let localOffset = 0;

  for (const description of entries) {
    const name = encoder.encode(description.name);
    const localName = encoder.encode(description.localName ?? description.name);
    const localExtra = asBytes(description.localExtra ?? []);
    const centralExtra = asBytes(description.centralExtra ?? []);
    const centralComment = asBytes(description.centralComment ?? []);
    const plain = asBytes(description.data ?? []);
    const method = description.method ?? 0;
    const flags = description.flags ?? 0;
    const compressed = method === 8
      ? Uint8Array.from(zlib.deflateRawSync(plain))
      : plain;
    const checksum = crc32(plain);

    const localHeader = record(30, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, flags, true);
      view.setUint16(8, method, true);
      view.setUint32(14, checksum, true);
      view.setUint32(18, compressed.length, true);
      view.setUint32(22, plain.length, true);
      view.setUint16(26, localName.length, true);
      view.setUint16(28, localExtra.length, true);
    });
    const localRecord = joinBytes(localHeader, localName, localExtra, compressed);
    localParts.push(localRecord);

    const centralHeader = record(46, (view) => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, flags, true);
      view.setUint16(10, method, true);
      view.setUint32(16, checksum, true);
      view.setUint32(20, compressed.length, true);
      view.setUint32(24, plain.length, true);
      view.setUint16(28, name.length, true);
      view.setUint16(30, centralExtra.length, true);
      view.setUint16(32, centralComment.length, true);
      view.setUint32(42, localOffset, true);
    });
    const centralRecord = joinBytes(
      centralHeader,
      name,
      centralExtra,
      centralComment,
    );
    centralParts.push(centralRecord);
    records.push({
      name: description.name,
      localOffset,
      localHeaderLength: 30 + localName.length + localExtra.length,
      centralRelativeOffset: centralParts
        .slice(0, -1)
        .reduce((total, part) => total + part.length, 0),
    });
    localOffset += localRecord.length;
  }

  const localBytes = joinBytes(...localParts);
  const centralBytes = joinBytes(...centralParts);
  const archiveComment = asBytes(comment);
  const eocd = record(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, entries.length, true);
    view.setUint16(10, entries.length, true);
    view.setUint32(12, centralBytes.length, true);
    view.setUint32(16, localBytes.length, true);
    view.setUint16(20, archiveComment.length, true);
  });
  const bytes = joinBytes(localBytes, centralBytes, eocd, archiveComment);

  return {
    buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    bytes,
    centralOffset: localBytes.length,
    centralSize: centralBytes.length,
    eocdOffset: localBytes.length + centralBytes.length,
    records,
  };
}

const cloneFixture = (fixture) => {
  const bytes = Uint8Array.from(fixture.bytes);
  return {
    ...fixture,
    bytes,
    buffer: bytes.buffer,
  };
};

const viewOf = (fixture) => new DataView(
  fixture.bytes.buffer,
  fixture.bytes.byteOffset,
  fixture.bytes.byteLength,
);

const assertCode = (expected) => (error) => {
  assert.equal(error?.code, expected);
  return true;
};

const inflateWithNode = async (bytes) => Uint8Array.from(zlib.inflateRawSync(bytes));

test('exports exactly the EPUB ZIP contract', () => {
  assert.deepEqual(Object.keys(epubZip).sort(), [
    'inflateWithDecompressionStream',
    'parseZip',
    'readEntry',
    'supportsInflate',
  ]);
});

test('parseZip returns stored and deflated central-directory entries', () => {
  const fixture = buildZip([
    { name: 'mimetype', data: 'application/epub+zip' },
    { name: 'META-INF/container.xml', data: '<container />' },
    { name: 'OEBPS/chapitre-é.xhtml', data: '<p>Hello</p>', method: 8 },
  ]);

  const { entries } = epubZip.parseZip(fixture.buffer);

  assert.deepEqual([...entries.keys()], [
    'mimetype',
    'META-INF/container.xml',
    'OEBPS/chapitre-é.xhtml',
  ]);
  assert.deepEqual(entries.get('mimetype'), {
    method: 0,
    encrypted: false,
    compressedSize: 20,
    uncompressedSize: 20,
    headerOffset: 0,
  });
  const chapter = entries.get('OEBPS/chapitre-é.xhtml');
  assert.equal(chapter.method, 8);
  assert.equal(chapter.encrypted, false);
  assert.equal(chapter.uncompressedSize, encoder.encode('<p>Hello</p>').length);
  assert.ok(chapter.compressedSize > 0);
});

test('readEntry returns exact stored and injected-inflate bytes', async () => {
  const stored = Uint8Array.from([0, 1, 2, 127, 128, 254, 255]);
  const deflated = encoder.encode('A chapter with enough repeated words. '.repeat(8));
  const fixture = buildZip([
    { name: 'stored.bin', data: stored },
    { name: 'chapter.xhtml', data: deflated, method: 8 },
  ]);
  const { entries } = epubZip.parseZip(fixture.buffer);

  assert.deepEqual(
    await epubZip.readEntry(fixture.buffer, entries.get('stored.bin')),
    stored,
  );
  assert.deepEqual(
    await epubZip.readEntry(
      fixture.buffer,
      entries.get('chapter.xhtml'),
      inflateWithNode,
    ),
    deflated,
  );
});

test('native deflate-raw inflation works when the runtime advertises support', async () => {
  assert.equal(epubZip.supportsInflate(), typeof DecompressionStream === 'function');
  if (!epubZip.supportsInflate()) return;

  const expected = encoder.encode('native deflate-raw round trip');
  const fixture = buildZip([{ name: 'chapter.xhtml', data: expected, method: 8 }]);
  const entry = epubZip.parseZip(fixture.buffer).entries.get('chapter.xhtml');

  assert.deepEqual(await epubZip.readEntry(fixture.buffer, entry), expected);
});

test('readEntry uses the local header name and extra lengths', async () => {
  const expected = encoder.encode('local header lengths select these exact bytes');
  const fixture = buildZip([{
    name: 'OEBPS/chapter.xhtml',
    localName: 'c.xhtml',
    localExtra: [9, 8, 7, 6, 5, 4, 3],
    centralExtra: [1, 2],
    data: expected,
  }]);
  const entry = epubZip.parseZip(fixture.buffer).entries.get('OEBPS/chapter.xhtml');

  assert.deepEqual(await epubZip.readEntry(fixture.buffer, entry), expected);
});

test('encrypted entries reject before any header or data slicing', async () => {
  const fixture = buildZip([{ name: 'locked.xhtml', data: 'secret', flags: 1 }]);
  const parsed = epubZip.parseZip(fixture.buffer).entries.get('locked.xhtml');
  const impossible = {
    ...parsed,
    headerOffset: Number.MAX_SAFE_INTEGER,
    compressedSize: Number.MAX_SAFE_INTEGER,
  };

  await assert.rejects(
    epubZip.readEntry(fixture.buffer, impossible),
    assertCode('encrypted'),
  );
});

test('parseZip rejects garbage and truncated EOCD records', () => {
  assert.throws(
    () => epubZip.parseZip(encoder.encode('not a zip').buffer),
    assertCode('not-a-zip'),
  );
  const truncated = record(21, (view) => view.setUint32(0, 0x06054b50, true));
  assert.throws(
    () => epubZip.parseZip(truncated.buffer),
    assertCode('not-a-zip'),
  );
});

test('EOCD scanning handles a maximum-length trailing comment', () => {
  const comment = new Uint8Array(0xffff);
  comment.fill(0x61);
  const fixture = buildZip([{ name: 'mimetype', data: 'application/epub+zip' }], { comment });

  assert.equal(epubZip.parseZip(fixture.buffer).entries.size, 1);
});

test('EOCD scanning ignores a structurally invalid signature inside the comment', () => {
  const fakeEocd = record(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, 1, true);
    view.setUint16(10, 1, true);
    view.setUint32(12, 46, true);
    view.setUint32(16, 0xffffff00, true);
  });
  const fixture = buildZip(
    [{ name: 'mimetype', data: 'application/epub+zip' }],
    { comment: joinBytes(encoder.encode('comment-prefix'), fakeEocd) },
  );

  assert.equal(epubZip.parseZip(fixture.buffer).entries.size, 1);
});

test('EOCD signatures farther back than the maximum comment window are ignored', () => {
  const fixture = buildZip([{ name: 'mimetype', data: 'application/epub+zip' }]);
  const tooMuchTrailingData = joinBytes(fixture.bytes, new Uint8Array(0x10000));

  assert.throws(
    () => epubZip.parseZip(tooMuchTrailingData.buffer),
    assertCode('not-a-zip'),
  );
});

test('parseZip rejects every ZIP64 sentinel exposed by supported records', () => {
  const base = buildZip([{ name: 'chapter.xhtml', data: 'text' }]);
  const cases = [
    ['EOCD disk entry count', base.eocdOffset + 8, 'u16'],
    ['EOCD total entry count', base.eocdOffset + 10, 'u16'],
    ['EOCD central size', base.eocdOffset + 12, 'u32'],
    ['EOCD central offset', base.eocdOffset + 16, 'u32'],
    ['central compressed size', base.centralOffset + 20, 'u32'],
    ['central uncompressed size', base.centralOffset + 24, 'u32'],
    ['central local-header offset', base.centralOffset + 42, 'u32'],
  ];

  for (const [label, offset, width] of cases) {
    const fixture = cloneFixture(base);
    const view = viewOf(fixture);
    if (width === 'u16') view.setUint16(offset, 0xffff, true);
    else view.setUint32(offset, 0xffffffff, true);
    assert.throws(
      () => epubZip.parseZip(fixture.buffer),
      assertCode('zip64-unsupported'),
      label,
    );
  }
});

test('parseZip rejects split archives and inconsistent EOCD counts', () => {
  const base = buildZip([{ name: 'one', data: '1' }]);
  const mutations = [
    ['disk number', 4, 1],
    ['central-directory disk', 6, 1],
    ['entries on disk mismatch', 8, 0],
    ['declared count exceeds records', 10, 2],
  ];

  for (const [label, relativeOffset, value] of mutations) {
    const fixture = cloneFixture(base);
    viewOf(fixture).setUint16(fixture.eocdOffset + relativeOffset, value, true);
    assert.throws(
      () => epubZip.parseZip(fixture.buffer),
      assertCode('not-a-zip'),
      label,
    );
  }
});

test('parseZip validates central-directory offsets, sizes, signatures, and record bounds', () => {
  const base = buildZip([{ name: 'one', data: '1' }]);
  const corruptions = [
    ['offset outside archive', (fixture) => {
      viewOf(fixture).setUint32(fixture.eocdOffset + 16, fixture.bytes.length + 1, true);
    }],
    ['size overlaps EOCD', (fixture) => {
      viewOf(fixture).setUint32(fixture.eocdOffset + 12, fixture.centralSize + 1, true);
    }],
    ['bad central signature', (fixture) => {
      viewOf(fixture).setUint32(fixture.centralOffset, 0x01020304, true);
    }],
    ['central variable fields exceed declared directory', (fixture) => {
      viewOf(fixture).setUint16(fixture.centralOffset + 28, 0xffff, true);
    }],
    ['local offset points into central directory', (fixture) => {
      viewOf(fixture).setUint32(fixture.centralOffset + 42, fixture.centralOffset, true);
    }],
  ];

  for (const [label, corrupt] of corruptions) {
    const fixture = cloneFixture(base);
    corrupt(fixture);
    assert.throws(
      () => epubZip.parseZip(fixture.buffer),
      assertCode('not-a-zip'),
      label,
    );
  }
});

test('readEntry rejects bad local signatures, truncated headers, and out-of-bounds data', async () => {
  const base = buildZip([{ name: 'chapter.xhtml', data: 'chapter' }]);
  const entry = epubZip.parseZip(base.buffer).entries.get('chapter.xhtml');

  const badSignature = cloneFixture(base);
  viewOf(badSignature).setUint32(entry.headerOffset, 0x01020304, true);
  await assert.rejects(
    epubZip.readEntry(badSignature.buffer, entry),
    assertCode('bad-entry'),
  );

  await assert.rejects(
    epubZip.readEntry(new Uint8Array(12).buffer, { ...entry, headerOffset: 0 }),
    assertCode('bad-entry'),
  );

  const hugeLocalName = cloneFixture(base);
  viewOf(hugeLocalName).setUint16(entry.headerOffset + 26, 0xffff, true);
  await assert.rejects(
    epubZip.readEntry(hugeLocalName.buffer, entry),
    assertCode('bad-entry'),
  );

  await assert.rejects(
    epubZip.readEntry(base.buffer, { ...entry, compressedSize: base.bytes.length }),
    assertCode('bad-entry'),
  );
});

test('readEntry rejects unsupported compression methods', async () => {
  const fixture = buildZip([{ name: 'legacy.bin', data: 'legacy', method: 12 }]);
  const entry = epubZip.parseZip(fixture.buffer).entries.get('legacy.bin');

  await assert.rejects(
    epubZip.readEntry(fixture.buffer, entry),
    assertCode('unsupported-method'),
  );
});

test('readEntry rejects stored size mismatches and inflated size mismatches', async () => {
  const storedFixture = buildZip([{ name: 'stored.bin', data: '1234' }]);
  const storedEntry = epubZip.parseZip(storedFixture.buffer).entries.get('stored.bin');
  await assert.rejects(
    epubZip.readEntry(storedFixture.buffer, { ...storedEntry, uncompressedSize: 5 }),
    assertCode('bad-entry'),
  );

  const deflatedFixture = buildZip([{ name: 'chapter.xhtml', data: 'chapter', method: 8 }]);
  const deflatedEntry = epubZip.parseZip(deflatedFixture.buffer).entries.get('chapter.xhtml');
  await assert.rejects(
    epubZip.readEntry(
      deflatedFixture.buffer,
      deflatedEntry,
      async () => encoder.encode('wrong-size'),
    ),
    assertCode('bad-entry'),
  );
});

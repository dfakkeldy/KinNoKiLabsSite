const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const EOCD_LENGTH = 22;
const MAX_COMMENT_LENGTH = 0xffff;
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;
// These are intentionally generous for EPUB while bounding metadata work before
// any filenames are decoded or retained.
const MAX_ENTRY_COUNT = 10_000;
const MAX_CENTRAL_DIRECTORY_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_NAME_BYTES = 16 * 1024 * 1024;
const ZIP64_U16 = 0xffff;
const ZIP64_U32 = 0xffffffff;
const entryMetadata = new WeakMap();

function zipError(code) {
  return Object.assign(new Error(code), { code });
}

function archiveBytes(arrayBuffer, code) {
  try {
    return new Uint8Array(arrayBuffer);
  } catch {
    throw zipError(code);
  }
}

function hasRange(bytes, offset, length) {
  return Number.isSafeInteger(offset)
    && Number.isSafeInteger(length)
    && offset >= 0
    && length >= 0
    && offset <= bytes.length
    && length <= bytes.length - offset;
}

function validateCentralBudget(bytes, view, centralOffset, centralEnd, entryCount) {
  let cursor = centralOffset;
  let totalNameBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (!hasRange(bytes, cursor, 46)) throw zipError('not-a-zip');
    if (view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) {
      throw zipError('not-a-zip');
    }

    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const recordLength = 46 + nameLength + extraLength + commentLength;
    if (!hasRange(bytes, cursor, recordLength) || cursor + recordLength > centralEnd) {
      throw zipError('not-a-zip');
    }
    if (nameLength > MAX_TOTAL_NAME_BYTES - totalNameBytes) {
      throw zipError('not-a-zip');
    }

    totalNameBytes += nameLength;
    cursor += recordLength;
  }

  if (cursor !== centralEnd) throw zipError('not-a-zip');
}

const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readCentralDirectory(bytes, eocdOffset, view) {
  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDisk = view.getUint16(eocdOffset + 6, true);
  const diskEntryCount = view.getUint16(eocdOffset + 8, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);

  if (
    diskNumber === ZIP64_U16
    || centralDisk === ZIP64_U16
    || diskEntryCount === ZIP64_U16
    || entryCount === ZIP64_U16
    || centralSize === ZIP64_U32
    || centralOffset === ZIP64_U32
  ) {
    throw zipError('zip64-unsupported');
  }
  if (diskNumber !== 0 || centralDisk !== 0 || diskEntryCount !== entryCount) {
    throw zipError('not-a-zip');
  }
  if (
    entryCount > MAX_ENTRY_COUNT
    || centralSize > MAX_CENTRAL_DIRECTORY_BYTES
  ) {
    throw zipError('not-a-zip');
  }
  if (!hasRange(bytes, centralOffset, centralSize)) throw zipError('not-a-zip');

  const centralEnd = centralOffset + centralSize;
  if (centralEnd !== eocdOffset) throw zipError('not-a-zip');
  validateCentralBudget(bytes, view, centralOffset, centralEnd, entryCount);

  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const entries = new Map();
  const parsedEntries = [];
  let cursor = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (!hasRange(bytes, cursor, 46)) throw zipError('not-a-zip');
    if (view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) {
      throw zipError('not-a-zip');
    }

    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const checksum = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const startingDisk = view.getUint16(cursor + 34, true);
    const headerOffset = view.getUint32(cursor + 42, true);

    if (
      compressedSize === ZIP64_U32
      || uncompressedSize === ZIP64_U32
      || headerOffset === ZIP64_U32
      || startingDisk === ZIP64_U16
    ) {
      throw zipError('zip64-unsupported');
    }
    if (startingDisk !== 0 || headerOffset >= centralOffset) {
      throw zipError('not-a-zip');
    }

    const recordLength = 46 + nameLength + extraLength + commentLength;
    if (!hasRange(bytes, cursor, recordLength) || cursor + recordLength > centralEnd) {
      throw zipError('not-a-zip');
    }

    const nameStart = cursor + 46;
    let name;
    try {
      name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    } catch {
      throw zipError('not-a-zip');
    }
    if (entries.has(name)) throw zipError('not-a-zip');

    const entry = {
      method,
      encrypted: Boolean(flags & 1),
      compressedSize,
      uncompressedSize,
      headerOffset,
    };
    entries.set(name, entry);
    parsedEntries.push({ entry, flags, checksum });
    cursor += recordLength;
  }

  if (cursor !== centralEnd) throw zipError('not-a-zip');

  const localOrder = [...parsedEntries].sort(
    (left, right) => left.entry.headerOffset - right.entry.headerOffset,
  );
  for (let index = 0; index < localOrder.length; index += 1) {
    const current = localOrder[index];
    const boundary = localOrder[index + 1]?.entry.headerOffset ?? centralOffset;
    if (
      current.entry.headerOffset + 30 > boundary
      || current.entry.headerOffset === localOrder[index + 1]?.entry.headerOffset
    ) {
      throw zipError('not-a-zip');
    }
    entryMetadata.set(current.entry, {
      boundary,
      flags: current.flags,
      checksum: current.checksum,
    });
  }
  return { entries };
}

export function parseZip(arrayBuffer) {
  const bytes = archiveBytes(arrayBuffer, 'not-a-zip');
  if (bytes.length < EOCD_LENGTH) throw zipError('not-a-zip');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const firstCandidate = bytes.length - EOCD_LENGTH;
  const lastCandidate = Math.max(0, firstCandidate - MAX_COMMENT_LENGTH);
  const candidates = [];
  let sawZip64 = false;

  for (let offset = firstCandidate; offset >= lastCandidate; offset -= 1) {
    if (view.getUint32(offset, true) !== EOCD_SIGNATURE) continue;
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + EOCD_LENGTH + commentLength !== bytes.length) continue;

    try {
      candidates.push(readCentralDirectory(bytes, offset, view));
    } catch (error) {
      if (error?.code === 'zip64-unsupported') sawZip64 = true;
    }
  }

  if (candidates.length === 1 && !sawZip64) return candidates[0];
  if (candidates.length > 1) throw zipError('not-a-zip');
  throw zipError(sawZip64 ? 'zip64-unsupported' : 'not-a-zip');
}

function byteView(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw zipError('bad-entry');
}

function outputBytes(value) {
  return byteView(value).slice();
}

export async function readEntry(
  arrayBuffer,
  entry,
  inflate = inflateWithDecompressionStream,
) {
  if (entry?.encrypted) throw zipError('encrypted');
  if (!entry || (entry.method !== 0 && entry.method !== 8)) {
    throw zipError(entry ? 'unsupported-method' : 'bad-entry');
  }

  if (
    !Number.isSafeInteger(entry.compressedSize)
    || !Number.isSafeInteger(entry.uncompressedSize)
    || entry.compressedSize < 0
    || entry.uncompressedSize < 0
    || entry.compressedSize > MAX_ENTRY_BYTES
    || entry.uncompressedSize > MAX_ENTRY_BYTES
  ) {
    throw zipError('bad-entry');
  }

  const metadata = entryMetadata.get(entry);
  if (!metadata) throw zipError('bad-entry');

  const bytes = archiveBytes(arrayBuffer, 'bad-entry');
  const { headerOffset, compressedSize, uncompressedSize } = entry;
  if (!hasRange(bytes, headerOffset, 30)) throw zipError('bad-entry');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(headerOffset, true) !== LOCAL_SIGNATURE) {
    throw zipError('bad-entry');
  }
  const localFlags = view.getUint16(headerOffset + 6, true);
  if (localFlags & 1) throw zipError('encrypted');
  if (Boolean(localFlags & 8) !== Boolean(metadata.flags & 8)) {
    throw zipError('bad-entry');
  }
  if (view.getUint16(headerOffset + 8, true) !== entry.method) {
    throw zipError('bad-entry');
  }
  if (!(localFlags & 8)) {
    const localChecksum = view.getUint32(headerOffset + 14, true);
    const localCompressedSize = view.getUint32(headerOffset + 18, true);
    const localUncompressedSize = view.getUint32(headerOffset + 22, true);
    if (
      localChecksum !== metadata.checksum
      || localCompressedSize !== compressedSize
      || localUncompressedSize !== uncompressedSize
    ) {
      throw zipError('bad-entry');
    }
  }
  const nameLength = view.getUint16(headerOffset + 26, true);
  const extraLength = view.getUint16(headerOffset + 28, true);
  const dataOffset = headerOffset + 30 + nameLength + extraLength;
  if (
    !hasRange(bytes, dataOffset, compressedSize)
    || dataOffset + compressedSize > metadata.boundary
  ) {
    throw zipError('bad-entry');
  }

  const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
  let output;
  if (entry.method === 0) {
    if (compressedSize !== uncompressedSize) throw zipError('bad-entry');
    output = compressed;
  } else {
    try {
      output = outputBytes(await inflate(compressed, uncompressedSize));
    } catch {
      throw zipError('bad-entry');
    }
  }

  if (output.length !== uncompressedSize) throw zipError('bad-entry');
  if (crc32(output) !== metadata.checksum) throw zipError('bad-entry');
  return output;
}

async function cancelReader(reader) {
  try {
    await reader.cancel();
  } catch {
    // The original malformed-entry error remains authoritative.
  }
}

export async function inflateWithDecompressionStream(
  bytes,
  expectedSize,
  DecompressionStreamType = DecompressionStream,
) {
  const hasExpectedSize = expectedSize !== undefined;
  if (
    hasExpectedSize
    && (!Number.isSafeInteger(expectedSize)
      || expectedSize < 0
      || expectedSize > MAX_ENTRY_BYTES)
  ) {
    throw zipError('bad-entry');
  }

  const limit = hasExpectedSize ? expectedSize : MAX_ENTRY_BYTES;
  let reader;
  try {
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStreamType('deflate-raw'));
    reader = stream.getReader();
  } catch {
    throw zipError('bad-entry');
  }

  const output = hasExpectedSize ? new Uint8Array(expectedSize) : null;
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = byteView(value);
      if (chunk.length > limit - total) {
        await cancelReader(reader);
        throw zipError('bad-entry');
      }
      if (output) output.set(chunk, total);
      else chunks.push(chunk.slice());
      total += chunk.length;
    }
  } catch (error) {
    await cancelReader(reader);
    throw error?.code === 'bad-entry' ? error : zipError('bad-entry');
  } finally {
    reader.releaseLock();
  }

  if (hasExpectedSize) {
    if (total !== expectedSize) throw zipError('bad-entry');
    return output;
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined;
}

export function supportsInflate() {
  return typeof DecompressionStream === 'function';
}

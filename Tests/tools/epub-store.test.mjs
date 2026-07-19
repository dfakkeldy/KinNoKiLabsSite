import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addBook,
  deleteBook,
  getBook,
  getPosition,
  listBooks,
  openLibrary,
  savePosition,
} from '../../Resources/tools/epub-store.js';
import { fakeIndexedDb } from './fake-idb.mjs';

test('openLibrary creates the version-one books and positions stores', async () => {
  const indexedDb = fakeIndexedDb();
  const db = await openLibrary(indexedDb);

  assert.equal(db.version, 1);
  assert.deepEqual([...db.objectStoreNames], ['books', 'positions']);
  assert.equal(indexedDb.inspect('kinnoki-tools-epub').stores.get('books').keyPath, 'id');
  assert.equal(indexedDb.inspect('kinnoki-tools-epub').stores.get('positions').keyPath, 'bookId');

  await openLibrary(indexedDb);
  assert.deepEqual([...db.objectStoreNames], ['books', 'positions']);
});

test('openLibrary rejects with the IndexedDB open error', async () => {
  const indexedDb = fakeIndexedDb();
  const expected = new Error('storage unavailable');
  indexedDb.failNext('open', expected);

  await assert.rejects(openLibrary(indexedDb), (error) => error === expected);
});

test('books round-trip with blobs intact and stable newest-first sorting', async () => {
  const indexedDb = fakeIndexedDb();
  const db = await openLibrary(indexedDb);
  const originalFile = new Blob(['whole epub'], { type: 'application/epub+zip' });
  const originalCover = new Blob(['cover'], { type: 'image/png' });
  const books = [
    { id: 'older', title: 'Older', author: 'A', addedAt: 1, coverBlob: null, file: new Blob(['old']) },
    { id: 'same-a', title: 'Same A', author: 'B', addedAt: 5, coverBlob: originalCover, file: originalFile },
    { id: 'same-b', title: 'Same B', author: 'C', addedAt: 5, coverBlob: null, file: new Blob(['same']) },
    { id: 'newer', title: 'Newer', author: 'D', addedAt: 9, coverBlob: null, file: new Blob(['new']) },
  ];

  for (const book of books) await addBook(db, book);

  assert.deepEqual((await listBooks(db)).map((book) => book.id), [
    'newer', 'same-a', 'same-b', 'older',
  ]);
  const restored = await getBook(db, 'same-a');
  assert.notEqual(restored.file, originalFile);
  assert.notEqual(restored.coverBlob, originalCover);
  assert.equal(await restored.file.text(), 'whole epub');
  assert.equal(restored.file.type, 'application/epub+zip');
  assert.equal(await restored.coverBlob.text(), 'cover');
  assert.equal(restored.coverBlob.type, 'image/png');
});

test('positions round-trip and unknown positions are undefined', async () => {
  const indexedDb = fakeIndexedDb();
  const db = await openLibrary(indexedDb);
  const position = {
    bookId: 'book-1', spineIndex: 3, scrollFraction: 0.4, updatedAt: 123,
  };

  await savePosition(db, position);

  assert.deepEqual(await getPosition(db, 'book-1'), position);
  assert.equal(await getPosition(db, 'missing'), undefined);
});

test('deleteBook atomically removes a book and its position in one transaction', async () => {
  const indexedDb = fakeIndexedDb();
  const db = await openLibrary(indexedDb);
  await addBook(db, {
    id: 'book-1', title: 'Book', author: 'Author', addedAt: 1, coverBlob: null, file: new Blob(['epub']),
  });
  await savePosition(db, {
    bookId: 'book-1', spineIndex: 1, scrollFraction: 0.25, updatedAt: 2,
  });

  await deleteBook(db, 'book-1');

  assert.equal(await getBook(db, 'book-1'), undefined);
  assert.equal(await getPosition(db, 'book-1'), undefined);
  const deletion = indexedDb.transactions.findLast((transaction) => (
    transaction.mode === 'readwrite' && transaction.storeNames.length === 2
  ));
  assert.deepEqual(deletion.storeNames, ['books', 'positions']);
});

test('a failed second delete aborts the transaction without deleting either record', async () => {
  const indexedDb = fakeIndexedDb();
  const db = await openLibrary(indexedDb);
  const book = {
    id: 'book-1', title: 'Book', author: 'Author', addedAt: 1, coverBlob: null, file: new Blob(['epub']),
  };
  const position = {
    bookId: 'book-1', spineIndex: 1, scrollFraction: 0.25, updatedAt: 2,
  };
  await addBook(db, book);
  await savePosition(db, position);
  indexedDb.failAfter('delete', 1, new Error('delete blocked'));

  await assert.rejects(deleteBook(db, 'book-1'), /delete blocked/);
  assert.deepEqual(await getBook(db, 'book-1'), book);
  assert.deepEqual(await getPosition(db, 'book-1'), position);
});

test('write failures reject and do not commit the transaction', async () => {
  const indexedDb = fakeIndexedDb();
  const db = await openLibrary(indexedDb);
  const expected = new Error('quota exceeded');
  indexedDb.failNext('put', expected);

  await assert.rejects(addBook(db, {
    id: 'book-1', title: 'Book', author: 'Author', addedAt: 1, coverBlob: null, file: new Blob(['epub']),
  }), (error) => error === expected);
  assert.deepEqual(await listBooks(db), []);
});

test('overlapping readwrite transactions serialize without losing writes', async () => {
  const indexedDb = fakeIndexedDb();
  const db = await openLibrary(indexedDb);
  const first = {
    id: 'first', title: 'First', author: 'A', addedAt: 1, coverBlob: null, file: new Blob(['first']),
  };
  const second = {
    id: 'second', title: 'Second', author: 'B', addedAt: 2, coverBlob: null, file: new Blob(['second']),
  };

  await Promise.all([addBook(db, first), addBook(db, second)]);

  assert.deepEqual((await listBooks(db)).map((book) => book.id), ['second', 'first']);
});

test('a multi-store delete waits for an earlier conflicting book write', async () => {
  const indexedDb = fakeIndexedDb();
  const db = await openLibrary(indexedDb);
  await addBook(db, {
    id: 'old', title: 'Old', author: 'A', addedAt: 1, coverBlob: null, file: new Blob(['old']),
  });
  await savePosition(db, {
    bookId: 'old', spineIndex: 0, scrollFraction: 0.5, updatedAt: 1,
  });
  const replacement = {
    id: 'new', title: 'New', author: 'B', addedAt: 2, coverBlob: null, file: new Blob(['new']),
  };

  await Promise.all([addBook(db, replacement), deleteBook(db, 'old')]);

  assert.deepEqual((await listBooks(db)).map((book) => book.id), ['new']);
  assert.equal(await getPosition(db, 'old'), undefined);
});

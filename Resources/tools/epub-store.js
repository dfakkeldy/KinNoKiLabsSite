const DATABASE_NAME = 'kinnoki-tools-epub';
const DATABASE_VERSION = 1;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionToPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(
      transaction.error ?? new Error('IndexedDB transaction failed'),
    );
    transaction.onabort = () => reject(
      transaction.error ?? new Error('IndexedDB transaction aborted'),
    );
  });
}

async function performRequest(db, storeName, mode, operation) {
  const transaction = db.transaction([storeName], mode);
  const completion = transactionToPromise(transaction);
  const request = operation(transaction.objectStore(storeName));
  const [result] = await Promise.all([requestToPromise(request), completion]);
  return result;
}

export function openLibrary(indexedDbFactory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!indexedDbFactory?.open) {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }

    let request;
    try {
      request = indexedDbFactory.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      reject(error);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('positions')) {
        db.createObjectStore('positions', { keyPath: 'bookId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open EPUB library'));
  });
}

export async function addBook(db, book) {
  await performRequest(db, 'books', 'readwrite', (store) => store.put(book));
}

export async function listBooks(db) {
  const books = await performRequest(db, 'books', 'readonly', (store) => store.getAll());
  return books.sort((left, right) => right.addedAt - left.addedAt);
}

export function getBook(db, id) {
  return performRequest(db, 'books', 'readonly', (store) => store.get(id));
}

export async function deleteBook(db, id) {
  const transaction = db.transaction(['books', 'positions'], 'readwrite');
  const completion = transactionToPromise(transaction);
  const bookRequest = transaction.objectStore('books').delete(id);
  const positionRequest = transaction.objectStore('positions').delete(id);
  await Promise.all([
    requestToPromise(bookRequest),
    requestToPromise(positionRequest),
    completion,
  ]);
}

export async function savePosition(db, position) {
  await performRequest(
    db,
    'positions',
    'readwrite',
    (store) => store.put(position),
  );
}

export function getPosition(db, bookId) {
  return performRequest(
    db,
    'positions',
    'readonly',
    (store) => store.get(bookId),
  );
}

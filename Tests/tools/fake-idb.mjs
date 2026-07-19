const cloneMap = (source) => new Map(source);
const cloneValue = (value) => structuredClone(value);

const namesList = (stores) => ({
  contains: (name) => stores.has(name),
  item: (index) => [...stores.keys()][index] ?? null,
  get length() { return stores.size; },
  [Symbol.iterator]: function* names() { yield* stores.keys(); },
});

export function fakeIndexedDb() {
  const databases = new Map();
  const failures = new Map();
  const transactions = [];

  const takeFailure = (operation) => {
    const failure = failures.get(operation);
    if (!failure) return undefined;
    if (failure.after > 0) {
      failure.after -= 1;
      return undefined;
    }
    failures.delete(operation);
    return failure.error;
  };

  const factory = {
    transactions,
    failNext(operation, error = new Error(`fake IndexedDB ${operation} failure`)) {
      this.failAfter(operation, 0, error);
    },
    failAfter(operation, count, error = new Error(`fake IndexedDB ${operation} failure`)) {
      failures.set(operation, { after: count, error });
    },
    inspect(name) {
      const record = databases.get(name);
      return record ? { version: record.version, stores: record.stores } : undefined;
    },
    open(name, version) {
      const request = { result: undefined, error: null };
      queueMicrotask(() => {
        const failure = takeFailure('open');
        if (failure) {
          request.error = failure;
          request.onerror?.({ target: request });
          return;
        }

        let record = databases.get(name);
        const oldVersion = record?.version ?? 0;
        if (record && version < record.version) {
          request.error = new Error('VersionError');
          request.onerror?.({ target: request });
          return;
        }
        if (!record) {
          record = { version: 0, stores: new Map() };
          databases.set(name, record);
        }

        const db = {
          get version() { return record.version; },
          get objectStoreNames() { return namesList(record.stores); },
          createObjectStore(storeName, { keyPath }) {
            if (record.stores.has(storeName)) throw new Error('ConstraintError');
            const store = { keyPath, records: new Map() };
            record.stores.set(storeName, store);
            return store;
          },
          transaction(storeNames, mode = 'readonly') {
            const names = Array.isArray(storeNames) ? [...storeNames] : [storeNames];
            for (const storeName of names) {
              if (!record.stores.has(storeName)) throw new Error('NotFoundError');
            }

            const snapshots = new Map(names.map((storeName) => {
              const store = record.stores.get(storeName);
              return [storeName, { ...store, records: cloneMap(store.records) }];
            }));
            let pending = 0;
            let settled = false;
            let completionQueued = false;
            const transaction = {
              mode,
              storeNames: names,
              error: null,
              objectStore(storeName) {
                const snapshot = snapshots.get(storeName);
                if (!snapshot) throw new Error('NotFoundError');
                const request = (operation, action) => {
                  const result = { result: undefined, error: null };
                  pending += 1;
                  queueMicrotask(() => {
                    if (settled) return;
                    const failure = takeFailure(operation);
                    if (failure) {
                      result.error = failure;
                      transaction.error = failure;
                      result.onerror?.({ target: result });
                      settled = true;
                      transaction.onabort?.({ target: transaction });
                      return;
                    }
                    try {
                      result.result = action(snapshot);
                      result.onsuccess?.({ target: result });
                    } catch (error) {
                      result.error = error;
                      transaction.error = error;
                      result.onerror?.({ target: result });
                      settled = true;
                      transaction.onabort?.({ target: transaction });
                      return;
                    }
                    pending -= 1;
                    if (pending === 0 && !completionQueued) {
                      completionQueued = true;
                      queueMicrotask(() => {
                        if (settled || pending !== 0) return;
                        settled = true;
                        if (mode === 'readwrite') {
                          for (const [changedName, changed] of snapshots) {
                            record.stores.get(changedName).records = changed.records;
                          }
                        }
                        transaction.oncomplete?.({ target: transaction });
                      });
                    }
                  });
                  return result;
                };
                return {
                  put(value) {
                    return request('put', (store) => {
                      const key = value?.[store.keyPath];
                      if (key === undefined) throw new Error('DataError');
                      store.records.set(key, cloneValue(value));
                      return key;
                    });
                  },
                  get(key) {
                    return request('get', (store) => cloneValue(store.records.get(key)));
                  },
                  getAll() {
                    return request(
                      'getAll',
                      (store) => [...store.records.values()].map(cloneValue),
                    );
                  },
                  delete(key) {
                    return request('delete', (store) => {
                      store.records.delete(key);
                      return undefined;
                    });
                  },
                };
              },
            };
            transactions.push(transaction);
            return transaction;
          },
        };

        request.result = db;
        if (version > oldVersion) {
          record.version = version;
          request.onupgradeneeded?.({ oldVersion, newVersion: version, target: request });
        }
        request.onsuccess?.({ target: request });
      });
      return request;
    },
  };

  return factory;
}

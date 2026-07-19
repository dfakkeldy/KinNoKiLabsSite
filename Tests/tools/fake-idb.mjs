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

  const conflicts = (left, right) => (
    (left.mode === 'readwrite' || right.mode === 'readwrite')
    && left.storeNames.some((name) => right.storeNames.includes(name))
  );

  const scheduleTransactions = (record) => {
    if (record.pumpQueued) return;
    record.pumpQueued = true;
    queueMicrotask(() => {
      record.pumpQueued = false;
      for (let index = 0; index < record.queue.length; index += 1) {
        const transaction = record.queue[index];
        if (transaction.started || transaction.settled) continue;
        const blockedByActive = [...record.active].some((active) => (
          conflicts(active, transaction)
        ));
        const blockedByEarlier = record.queue.slice(0, index).some((earlier) => (
          !earlier.started && !earlier.settled && conflicts(earlier, transaction)
        ));
        if (!blockedByActive && !blockedByEarlier) transaction.activate();
      }
    });
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
          record = {
            version: 0,
            stores: new Map(),
            queue: [],
            active: new Set(),
            pumpQueued: false,
          };
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

            let snapshots;
            let pending = 0;
            let settled = false;
            let completionQueued = false;
            const requests = [];

            const release = () => {
              record.active.delete(transaction);
              record.queue = record.queue.filter((queued) => queued !== transaction);
              scheduleTransactions(record);
            };

            const queueCompletion = () => {
              if (completionQueued || settled) return;
              completionQueued = true;
              queueMicrotask(() => {
                completionQueued = false;
                if (settled || pending !== 0) return;
                settled = true;
                transaction.settled = true;
                if (mode === 'readwrite') {
                  for (const [changedName, changed] of snapshots) {
                    record.stores.get(changedName).records = changed.records;
                  }
                }
                transaction.oncomplete?.({ target: transaction });
                release();
              });
            };

            const abort = (request, error) => {
              request.error = error;
              transaction.error = error;
              request.onerror?.({ target: request });
              settled = true;
              transaction.settled = true;
              transaction.onerror?.({ target: transaction });
              transaction.onabort?.({ target: transaction });
              release();
            };

            const runRequest = (entry) => {
              queueMicrotask(() => {
                if (settled) return;
                const failure = takeFailure(entry.operation);
                if (failure) {
                  abort(entry.request, failure);
                  return;
                }
                try {
                  entry.request.result = entry.action(snapshots.get(entry.storeName));
                  entry.request.onsuccess?.({ target: entry.request });
                } catch (error) {
                  abort(entry.request, error);
                  return;
                }
                pending -= 1;
                queueCompletion();
              });
            };

            const transaction = {
              mode,
              storeNames: names,
              error: null,
              started: false,
              settled: false,
              activate() {
                this.started = true;
                record.active.add(this);
                snapshots = new Map(names.map((storeName) => {
                  const store = record.stores.get(storeName);
                  return [storeName, { ...store, records: cloneMap(store.records) }];
                }));
                for (const entry of requests) runRequest(entry);
                queueCompletion();
              },
              objectStore(storeName) {
                if (!names.includes(storeName)) throw new Error('NotFoundError');
                const request = (operation, action) => {
                  const result = { result: undefined, error: null };
                  pending += 1;
                  const entry = { operation, action, request: result, storeName };
                  requests.push(entry);
                  if (transaction.started) runRequest(entry);
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
            record.queue.push(transaction);
            scheduleTransactions(record);
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

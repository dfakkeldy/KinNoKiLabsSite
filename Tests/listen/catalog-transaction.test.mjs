import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const transactionLibrary = fileURLToPath(
  new URL('../../Tools/lib/listen-catalog-transaction.sh', import.meta.url),
);

const fixtureScript = String.raw`
set -euo pipefail
source "$TRANSACTION_LIBRARY"
listen_catalog_install_cleanup_traps
listen_catalog_transaction_init "$OUT_DIR"

mkdir -p "$STAGED_BOOKS/chicken-predators" "$STAGED_BOOKS/the-new-deal"
printf 'new chicken\n' > "$STAGED_BOOKS/chicken-predators/marker.txt"
printf 'new deal\n' > "$STAGED_BOOKS/the-new-deal/marker.txt"
printf '{"bundle":"new"}\n' > "$STAGED_CATALOG"

if [ "$EXISTING_FINALS" -eq 1 ]; then
  mkdir -p "$FINAL_BOOKS/revoked-test"
  printf 'old revoked\n' > "$FINAL_BOOKS/revoked-test/marker.txt"
  printf '{"bundle":"old"}\n' > "$FINAL_CATALOG"
fi

listen_catalog_publish_staged_bundle
`;

const mvWrapper = String.raw`#!/usr/bin/env bash
set -euo pipefail
count=0
if [ -f "$MV_COUNT_FILE" ]; then
  count="$(cat "$MV_COUNT_FILE")"
fi
count=$((count + 1))
printf '%s\n' "$count" > "$MV_COUNT_FILE"

if [ "$count" -eq "$MV_FAIL_AT" ]; then
  exit "$MV_FAIL_STATUS"
fi
if [ "$count" -eq "$MV_SIGNAL_AT" ]; then
  kill -s "$MV_SIGNAL" "$PPID"
  exit "$MV_SIGNAL_STATUS"
fi

exec /bin/mv "$@"
`;

const mkdirWrapper = String.raw`#!/usr/bin/env bash
set -euo pipefail
count=0
if [ -f "$MKDIR_COUNT_FILE" ]; then
  count="$(cat "$MKDIR_COUNT_FILE")"
fi
count=$((count + 1))
printf '%s\n' "$count" > "$MKDIR_COUNT_FILE"

if [ "$count" -eq "$MKDIR_FAIL_AT" ]; then
  exit "$MKDIR_FAIL_STATUS"
fi

exec /bin/mkdir "$@"
`;

function makeFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'listen-catalog-transaction-'));
  const out = join(root, 'out');
  const bin = join(root, 'bin');
  mkdirSync(out);
  mkdirSync(bin);
  writeFileSync(join(bin, 'mv'), mvWrapper);
  writeFileSync(join(bin, 'mkdir'), mkdirWrapper);
  chmodSync(join(bin, 'mv'), 0o755);
  chmodSync(join(bin, 'mkdir'), 0o755);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, out, bin };
}

function runFixture(t, options = {}) {
  const { root, out, bin } = makeFixture(t);
  const result = spawnSync('/bin/bash', ['-c', fixtureScript], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH}`,
      TRANSACTION_LIBRARY: transactionLibrary,
      OUT_DIR: out,
      EXISTING_FINALS: options.existingFinals === false ? '0' : '1',
      MV_COUNT_FILE: join(root, 'mv-count'),
      MV_FAIL_AT: String(options.failAt ?? 0),
      MV_FAIL_STATUS: '97',
      MV_SIGNAL_AT: String(options.signalAt ?? 0),
      MV_SIGNAL: options.signal ?? 'TERM',
      MV_SIGNAL_STATUS: options.signal === 'INT' ? '130' : '143',
      MKDIR_COUNT_FILE: join(root, 'mkdir-count'),
      MKDIR_FAIL_AT: '0',
    },
  });
  return { root, out, bin, result };
}

function diagnostic(result) {
  return `status=${result.status}\nstdout=${result.stdout}\nstderr=${result.stderr}`;
}

function assertNoBuildRoots(out) {
  const leaked = readdirSync(out).filter((name) => name.startsWith('.listen-catalog-build.'));
  assert.deepEqual(leaked, []);
}

function assertOldBundleRestored(out) {
  assert.equal(readFileSync(join(out, 'books.json'), 'utf8'), '{"bundle":"old"}\n');
  assert.equal(readFileSync(join(out, 'books/revoked-test/marker.txt'), 'utf8'), 'old revoked\n');
  assert.equal(existsSync(join(out, 'books/chicken-predators')), false);
  assertNoBuildRoots(out);
}

test('successful transaction swaps the complete bundle and prunes stale directories', (t) => {
  const { out, result } = runFixture(t);
  assert.equal(result.status, 0, diagnostic(result));
  assert.equal(readFileSync(join(out, 'books.json'), 'utf8'), '{"bundle":"new"}\n');
  assert.deepEqual(readdirSync(join(out, 'books')).sort(), ['chicken-predators', 'the-new-deal']);
  assert.equal(existsSync(join(out, 'books/revoked-test')), false);
  assertNoBuildRoots(out);
});

for (let failAt = 1; failAt <= 6; failAt += 1) {
  test(`rename failure ${failAt}/6 restores the previous complete bundle and status`, (t) => {
    const { out, result } = runFixture(t, { failAt });
    assert.equal(result.status, 97, diagnostic(result));
    assertOldBundleRestored(out);
  });
}

test('failure after installing books returns initially missing final paths to absent', (t) => {
  const { out, result } = runFixture(t, { existingFinals: false, failAt: 4 });
  assert.equal(result.status, 97, diagnostic(result));
  assert.equal(existsSync(join(out, 'books')), false);
  assert.equal(existsSync(join(out, 'books.json')), false);
  assertNoBuildRoots(out);
});

for (const [signal, expectedStatus] of [['TERM', 143], ['INT', 130]]) {
  test(`${signal} during a critical rename restores the previous bundle and status`, (t) => {
    const { out, result } = runFixture(t, { signalAt: 6, signal });
    assert.equal(result.status, expectedStatus, diagnostic(result));
    assertOldBundleRestored(out);
  });
}

test('cleanup is safe before transaction initialization and preserves status', (t) => {
  const { out } = makeFixture(t);
  const foreignBuildRoot = join(out, 'foreign-build-root');
  mkdirSync(foreignBuildRoot);
  writeFileSync(join(foreignBuildRoot, 'keep.txt'), 'not this transaction\n');
  const result = spawnSync(
    '/bin/bash',
    ['-c', 'set -euo pipefail; source "$TRANSACTION_LIBRARY"; listen_catalog_install_cleanup_traps; exit 42'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        TRANSACTION_LIBRARY: transactionLibrary,
        BUILD_ROOT: foreignBuildRoot,
      },
    },
  );
  assert.equal(result.status, 42, diagnostic(result));
  assert.equal(readFileSync(join(foreignBuildRoot, 'keep.txt'), 'utf8'), 'not this transaction\n');
  assertNoBuildRoots(out);
});

test('initialization failure cleans an already-created build root and preserves status', (t) => {
  const { root, out, bin } = makeFixture(t);
  const result = spawnSync(
    '/bin/bash',
    [
      '-c',
      'set -euo pipefail; source "$TRANSACTION_LIBRARY"; listen_catalog_install_cleanup_traps; listen_catalog_transaction_init "$OUT_DIR"',
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}${delimiter}${process.env.PATH}`,
        TRANSACTION_LIBRARY: transactionLibrary,
        OUT_DIR: out,
        MKDIR_COUNT_FILE: join(root, 'mkdir-count'),
        MKDIR_FAIL_AT: '2',
        MKDIR_FAIL_STATUS: '88',
      },
    },
  );
  assert.equal(result.status, 88, diagnostic(result));
  assertNoBuildRoots(out);
});

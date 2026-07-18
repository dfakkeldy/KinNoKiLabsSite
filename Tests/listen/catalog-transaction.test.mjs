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
const builderPath = fileURLToPath(new URL('../../Tools/build-listen-catalog.sh', import.meta.url));
const builderSource = readFileSync(builderPath, 'utf8');

function validationFunctionSource() {
  const begin = builderSource.indexOf('# BEGIN VALIDATE_SERIES');
  const end = builderSource.indexOf('# END VALIDATE_SERIES');
  assert.notEqual(begin, -1, 'builder exposes the real series validator to transaction tests');
  assert.notEqual(end, -1, 'builder terminates the real series validator marker');
  return builderSource.slice(begin, end + '# END VALIDATE_SERIES'.length);
}

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

const seriesFixtureScript = String.raw`
set -euo pipefail
source "$TRANSACTION_LIBRARY"
listen_catalog_install_cleanup_traps
listen_catalog_transaction_init "$OUT_DIR"

mkdir -p "$STAGED_BOOKS/claude-platform-01-the-message" "$STAGED_BOOKS/claude-platform-02-thinking-and-reliable-responses"
printf 'new volume one\n' > "$STAGED_BOOKS/claude-platform-01-the-message/marker.txt"
printf 'new volume two\n' > "$STAGED_BOOKS/claude-platform-02-thinking-and-reliable-responses/marker.txt"
cp "$STAGED_INPUT_CATALOG" "$STAGED_CATALOG"

mkdir -p "$FINAL_BOOKS/installed-book"
printf 'old asset\n' > "$FINAL_BOOKS/installed-book/marker.txt"
printf '{"bundle":"old"}\n' > "$FINAL_CATALOG"

eval "$VALIDATE_SERIES_FUNCTION"
validate_series "$SERIES_SOURCE" "$STAGED_CATALOG"
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

function validSeries() {
  return {
    series: [
      {
        id: 'claude-platform',
        title: 'Claude Platform Documentation',
        description: 'A mechanism-first guide to building on the Claude Platform.',
        plannedVolumeCount: 9,
        featured: true,
        volumes: [
          { number: 1, book: 'claude-platform-01-the-message' },
          { number: 2, book: 'claude-platform-02-thinking-and-reliable-responses' },
        ],
      },
    ],
  };
}

function runSeriesFixture(t, mutateSeries) {
  const { root, out } = makeFixture(t);
  const series = validSeries();
  mutateSeries(series);
  const seriesPath = join(root, 'listen-series.json');
  const catalogPath = join(root, 'staged-books.json');
  writeFileSync(seriesPath, `${JSON.stringify(series)}\n`);
  writeFileSync(catalogPath, `${JSON.stringify({
    version: 2,
    series: series.series,
    books: [
      { slug: 'claude-platform-01-the-message', audio: { status: 'available' } },
      { slug: 'claude-platform-02-thinking-and-reliable-responses', audio: { status: 'available' } },
    ],
  })}\n`);
  const result = spawnSync('/bin/bash', ['-c', seriesFixtureScript], {
    encoding: 'utf8',
    env: {
      ...process.env,
      TRANSACTION_LIBRARY: transactionLibrary,
      OUT_DIR: out,
      SERIES_SOURCE: seriesPath,
      STAGED_INPUT_CATALOG: catalogPath,
      VALIDATE_SERIES_FUNCTION: validationFunctionSource(),
    },
  });
  return { out, result };
}

function assertSeriesValidationPreservesInstalledBundle(out, result) {
  assert.notEqual(result.status, 0, diagnostic(result));
  assert.equal(readFileSync(join(out, 'books.json'), 'utf8'), '{"bundle":"old"}\n');
  assert.equal(readFileSync(join(out, 'books/installed-book/marker.txt'), 'utf8'), 'old asset\n');
  assert.equal(existsSync(join(out, 'books/claude-platform-01-the-message')), false);
  assertNoBuildRoots(out);
}

test('valid series metadata passes validation and installs the complete staged bundle', (t) => {
  const { out, result } = runSeriesFixture(t, () => {});
  assert.equal(result.status, 0, diagnostic(result));
  const installed = JSON.parse(readFileSync(join(out, 'books.json'), 'utf8'));
  assert.equal(installed.version, 2);
  assert.deepEqual(installed.series, validSeries().series);
  assert.deepEqual(readdirSync(join(out, 'books')).sort(), [
    'claude-platform-01-the-message',
    'claude-platform-02-thinking-and-reliable-responses',
  ]);
  assert.equal(existsSync(join(out, 'books/installed-book')), false);
  assertNoBuildRoots(out);
});

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

const invalidSeriesFixtures = [
  ['duplicate ID', (source) => source.series.push({ ...source.series[0] })],
  ['unsorted volume numbers', (source) => source.series[0].volumes.reverse()],
  ['missing book', (source) => { source.series[0].volumes[1].book = 'missing-book'; }],
  ['duplicate membership', (source) => source.series.push({
    id: 'second-series',
    title: 'Second Series',
    description: 'A second valid-looking series.',
    plannedVolumeCount: 1,
    featured: false,
    volumes: [{ number: 1, book: 'claude-platform-01-the-message' }],
  })],
  ['absolute path', (source) => { source.series[0].description = '/Users/example/private'; }],
  ['mixed-case file URL', (source) => { source.series[0].description = 'FILE:///Users/private'; }],
];

for (const [name, mutate] of invalidSeriesFixtures) {
  test(`invalid series ${name} fails before install and preserves the existing bundle`, (t) => {
    const { out, result } = runSeriesFixture(t, mutate);
    assertSeriesValidationPreservesInstalledBundle(out, result);
  });
}

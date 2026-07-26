import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = new URL('../../', import.meta.url);
const syncTool = new URL('../../Tools/sync-ns-marks-web.mjs', import.meta.url);

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`,
  );
  return result.stdout.trim();
}

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'kinnoki-ns-map-'));
  const source = join(root, 'source');
  const web = join(source, 'web');
  const destination = join(root, 'published-map');
  mkdirSync(web, { recursive: true });
  writeFileSync(join(web, 'package.json'), JSON.stringify({
    name: 'ns-map-fixture',
    version: '1.0.0',
    scripts: { build: 'node build.mjs' },
  }, null, 2));
  writeFileSync(join(web, 'package-lock.json'), JSON.stringify({
    name: 'ns-map-fixture',
    version: '1.0.0',
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': { name: 'ns-map-fixture', version: '1.0.0' },
    },
  }, null, 2));
  writeFileSync(join(web, 'build.mjs'), `
    import { mkdirSync, writeFileSync } from 'node:fs';
    mkdirSync('dist/assets', { recursive: true });
    writeFileSync('dist/index.html', '<script type="module" src="./assets/app.js"></script>');
    writeFileSync('dist/assets/app.js', 'console.log("map")');
  `);

  run('git', ['init', '-q'], source);
  run('git', ['config', 'user.email', 'tests@kinnokilabs.com'], source);
  run('git', ['config', 'user.name', 'KinNoKi Tests'], source);
  run('git', ['add', '.'], source);
  run('git', ['commit', '-qm', 'fixture'], source);
  const commit = run('git', ['rev-parse', 'HEAD'], source);
  return { root, source, destination, commit };
}

test('sync tool builds the pinned NS Marks commit into a self-contained static route', () => {
  const fixture = makeFixture();
  try {
    const config = join(fixture.root, 'source.json');
    writeFileSync(config, JSON.stringify({
      repository: 'https://github.com/dfakkeldy/ns-marks-the-spot',
      commit: fixture.commit,
      publicPath: '/apps/nsmarksthespot/map/',
    }));

    const result = spawnSync(process.execPath, [
      syncTool.pathname,
      '--config', config,
      '--source', fixture.source,
      '--destination', fixture.destination,
    ], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(fixture.destination, 'index.html')), true);
    assert.equal(existsSync(join(fixture.destination, 'assets/app.js')), true);
    assert.deepEqual(
      JSON.parse(readFileSync(join(fixture.destination, 'source.json'), 'utf8')),
      {
        repository: 'https://github.com/dfakkeldy/ns-marks-the-spot',
        commit: fixture.commit,
        publicPath: '/apps/nsmarksthespot/map/',
      },
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('sync tool rejects a checkout that does not match the pinned commit', () => {
  const fixture = makeFixture();
  try {
    const config = join(fixture.root, 'source.json');
    writeFileSync(config, JSON.stringify({
      repository: 'https://github.com/dfakkeldy/ns-marks-the-spot',
      commit: '0'.repeat(40),
      publicPath: '/apps/nsmarksthespot/map/',
    }));

    const result = spawnSync(process.execPath, [
      syncTool.pathname,
      '--config', config,
      '--source', fixture.source,
      '--destination', fixture.destination,
    ], { encoding: 'utf8' });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not match pinned commit/i);
    assert.equal(existsSync(fixture.destination), false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('committed and generated map routes carry the pinned source receipt byte-for-byte', () => {
  const sourceConfig = JSON.parse(readFileSync(
    new URL('../../Tools/ns-marks-web-source.json', import.meta.url),
    'utf8',
  ));
  assert.match(sourceConfig.commit, /^[0-9a-f]{40}$/);
  assert.equal(sourceConfig.publicPath, '/apps/nsmarksthespot/map/');

  for (const root of ['Resources', 'Output']) {
    const route = new URL(`../../${root}/apps/nsmarksthespot/map/`, import.meta.url);
    const index = readFileSync(new URL('index.html', route), 'utf8');
    const receipt = JSON.parse(readFileSync(new URL('source.json', route), 'utf8'));
    assert.match(index, /(?:src|href)="\.\/assets\//);
    assert.doesNotMatch(index, /(?:src|href)="\/assets\//);
    assert.deepEqual(receipt, sourceConfig);
  }

  const resourceIndex = readFileSync(
    new URL('../../Resources/apps/nsmarksthespot/map/index.html', import.meta.url),
  );
  const outputIndex = readFileSync(
    new URL('../../Output/apps/nsmarksthespot/map/index.html', import.meta.url),
  );
  assert.deepEqual(outputIndex, resourceIndex);
});

test('the short /map URL redirects to the pinned online map route', () => {
  const expectedRedirect = '/map /apps/nsmarksthespot/map/ 301';
  for (const root of ['Resources', 'Output']) {
    const redirects = readFileSync(
      new URL(`../../${root}/_redirects`, import.meta.url),
      'utf8',
    );
    assert.match(redirects, new RegExp(`^${expectedRedirect}$`, 'm'));
  }
});

test('KinNoKi app surfaces lead to the internal product page and online map', () => {
  const content = readFileSync(
    new URL('../../Content/apps/nsmarksthespot.md', import.meta.url),
    'utf8',
  );
  const theme = readFileSync(
    new URL('../../Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift', import.meta.url),
    'utf8',
  );
  const generated = readFileSync(
    new URL('../../Output/apps/nsmarksthespot/index.html', import.meta.url),
    'utf8',
  );

  assert.match(content, /\[Open Online Map\]\(\/apps\/nsmarksthespot\/map\/\)/);
  assert.equal(
    [...theme.matchAll(/class="app-card" href="\/apps\/nsmarksthespot\/"/g)].length,
    2,
  );
  assert.match(generated, /href="\/apps\/nsmarksthespot\/map\/"[^>]*>Open Online Map<\/a>/);
});

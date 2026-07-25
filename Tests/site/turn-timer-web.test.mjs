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

const syncTool = new URL('../../Tools/sync-turn-timer-web.mjs', import.meta.url);

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
  const root = mkdtempSync(join(tmpdir(), 'kinnoki-turn-timer-'));
  const source = join(root, 'source');
  const web = join(source, 'web');
  const destination = join(root, 'published-timer');
  mkdirSync(web, { recursive: true });
  writeFileSync(join(web, 'package.json'), JSON.stringify({
    name: 'turn-timer-fixture',
    version: '1.0.0',
    scripts: { build: 'node build.mjs' },
  }, null, 2));
  writeFileSync(join(web, 'package-lock.json'), JSON.stringify({
    name: 'turn-timer-fixture',
    version: '1.0.0',
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': { name: 'turn-timer-fixture', version: '1.0.0' },
    },
  }, null, 2));
  writeFileSync(join(web, 'build.mjs'), `
    import { mkdirSync, writeFileSync } from 'node:fs';
    mkdirSync('dist/assets', { recursive: true });
    writeFileSync('dist/index.html', '<script type="module" src="./assets/app.js"></script>');
    writeFileSync('dist/assets/app.js', 'console.log("timer")');
  `);

  run('git', ['init', '-q'], source);
  run('git', ['config', 'user.email', 'tests@kinnokilabs.com'], source);
  run('git', ['config', 'user.name', 'KinNoKi Tests'], source);
  run('git', ['add', '.'], source);
  run('git', ['commit', '-qm', 'fixture'], source);
  const commit = run('git', ['rev-parse', 'HEAD'], source);
  return { root, source, destination, commit };
}

function writeConfig(fixture, commit) {
  const config = join(fixture.root, 'source.json');
  writeFileSync(config, JSON.stringify({
    repository: 'https://github.com/dfakkeldy/VisualTimer.git',
    commit,
    publicPath: '/tools/turn-timer/',
  }));
  return config;
}

test('sync tool builds the pinned VisualTimer commit into a self-contained static route', () => {
  const fixture = makeFixture();
  try {
    const config = writeConfig(fixture, fixture.commit);
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
        repository: 'https://github.com/dfakkeldy/VisualTimer.git',
        commit: fixture.commit,
        publicPath: '/tools/turn-timer/',
      },
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('sync tool rejects a checkout that does not match the pinned commit', () => {
  const fixture = makeFixture();
  try {
    const config = writeConfig(fixture, '0'.repeat(40));
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

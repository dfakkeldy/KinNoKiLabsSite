import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const promotionTool = new URL(
  '../../Tools/prepare-ns-marks-web-promotion.mjs',
  import.meta.url,
);

function run(command, args, cwd, expectedStatus = 0) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(
    result.status,
    expectedStatus,
    `${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`,
  );
  return result;
}

function commit(source, message) {
  run('git', ['add', '.'], source);
  run('git', ['commit', '-qm', message], source);
  return run('git', ['rev-parse', 'HEAD'], source).stdout.trim();
}

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'kinnoki-ns-map-promotion-'));
  const source = join(root, 'source');
  const config = join(root, 'source.json');
  const githubOutput = join(root, 'github-output.txt');

  mkdirSync(join(source, 'web'), { recursive: true });
  mkdirSync(join(source, 'docs', 'assets'), { recursive: true });
  writeFileSync(join(source, 'web', 'app.js'), 'version one\n');
  writeFileSync(join(source, 'docs', 'assets', 'app-icon.svg'), '<svg />\n');
  writeFileSync(join(source, 'README.md'), 'Initial docs\n');

  run('git', ['init', '-q'], source);
  run('git', ['config', 'user.email', 'tests@kinnokilabs.com'], source);
  run('git', ['config', 'user.name', 'KinNoKi Tests'], source);
  const initialCommit = commit(source, 'initial');

  writeFileSync(config, `${JSON.stringify({
    repository: 'https://github.com/dfakkeldy/ns-marks-the-spot',
    commit: initialCommit,
    publicPath: '/apps/nsmarksthespot/map/',
  }, null, 2)}\n`);

  return {
    config,
    githubOutput,
    initialCommit,
    root,
    source,
  };
}

function prepare(fixture) {
  return spawnSync(process.execPath, [
    promotionTool.pathname,
    '--config', fixture.config,
    '--source', fixture.source,
    '--github-output', fixture.githubOutput,
  ], { encoding: 'utf8' });
}

test('web changes advance the exact source pin and GitHub outputs', () => {
  const fixture = makeFixture();
  try {
    writeFileSync(join(fixture.source, 'web', 'app.js'), 'version two\n');
    const latestCommit = commit(fixture.source, 'web change');

    const result = prepare(fixture);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      JSON.parse(readFileSync(fixture.config, 'utf8')).commit,
      latestCommit,
    );
    assert.match(readFileSync(fixture.githubOutput, 'utf8'), /changed=true/);
    assert.match(
      readFileSync(fixture.githubOutput, 'utf8'),
      new RegExp(`source_commit=${latestCommit}`),
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('non-web commits do not advance the deployed source pin', () => {
  const fixture = makeFixture();
  try {
    writeFileSync(join(fixture.source, 'README.md'), 'Updated docs\n');
    commit(fixture.source, 'docs only');

    const result = prepare(fixture);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      JSON.parse(readFileSync(fixture.config, 'utf8')).commit,
      fixture.initialCommit,
    );
    assert.match(readFileSync(fixture.githubOutput, 'utf8'), /changed=false/);
    assert.match(readFileSync(fixture.githubOutput, 'utf8'), /reason=no-web-changes/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('an already pinned source is a successful no-op', () => {
  const fixture = makeFixture();
  try {
    const result = prepare(fixture);

    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(fixture.githubOutput, 'utf8'), /changed=false/);
    assert.match(readFileSync(fixture.githubOutput, 'utf8'), /reason=up-to-date/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('dirty web inputs fail closed before changing the pin', () => {
  const fixture = makeFixture();
  try {
    writeFileSync(join(fixture.source, 'web', 'app.js'), 'uncommitted change\n');

    const result = prepare(fixture);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /web inputs must be clean/i);
    assert.equal(
      JSON.parse(readFileSync(fixture.config, 'utf8')).commit,
      fixture.initialCommit,
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('a non-fast-forward source fails closed', () => {
  const fixture = makeFixture();
  try {
    run('git', ['switch', '-qc', 'pinned'], fixture.source);
    writeFileSync(join(fixture.source, 'web', 'app.js'), 'pinned branch\n');
    const pinnedCommit = commit(fixture.source, 'pinned branch');

    run('git', ['switch', '-q', '--detach', fixture.initialCommit], fixture.source);
    writeFileSync(join(fixture.source, 'README.md'), 'diverged branch\n');
    commit(fixture.source, 'diverged branch');

    const config = JSON.parse(readFileSync(fixture.config, 'utf8'));
    config.commit = pinnedCommit;
    writeFileSync(fixture.config, `${JSON.stringify(config, null, 2)}\n`);

    const result = prepare(fixture);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not a fast-forward/i);
    assert.equal(JSON.parse(readFileSync(fixture.config, 'utf8')).commit, pinnedCommit);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('promotion workflow polls cheaply and preserves the review gate', () => {
  const workflow = readFileSync(
    new URL('../../.github/workflows/promote-ns-marks-web.yml', import.meta.url),
    'utf8',
  );
  const makefile = readFileSync(new URL('../../Makefile', import.meta.url), 'utf8');

  assert.match(workflow, /cron: "23 \* \* \* \*"/);
  assert.match(workflow, /detect:[\s\S]*runs-on: ubuntu-latest/);
  assert.match(
    workflow,
    /promote:[\s\S]*if: needs\.detect\.outputs\.changed == 'true'[\s\S]*runs-on: macos-15/,
  );
  assert.match(workflow, /pull-requests: write/);
  assert.match(workflow, /startswith\("automation\/ns-marks-web-"\)/);
  assert.match(workflow, /Holding for existing deployment PR/);
  assert.match(workflow, /make generate PUBLISH_BIN="swift run KinNoKiLabsSite"/);
  assert.match(workflow, /gh pr create/);
  assert.doesNotMatch(workflow, /gh pr merge|--auto/);
  assert.match(makefile, /PUBLISH_BIN \?= publish/);
  assert.match(makefile, /\$\(PUBLISH_BIN\) generate/);
});

#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  throw new Error(message);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    fail([
      `${command} ${args.join(' ')} failed in ${cwd}`,
      result.stdout.trim(),
      result.stderr.trim(),
    ].filter(Boolean).join('\n'));
  }
  return result.stdout.trim();
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!['--config', '--source', '--destination'].includes(flag) || !value) {
      fail('Usage: sync-ns-marks-web.mjs [--config path] [--source path] [--destination path]');
    }
    options[flag.slice(2)] = resolve(value);
  }
  return options;
}

function defaultSourcePath() {
  const commonGitDirectory = run(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    projectRoot,
  );
  return resolve(dirname(dirname(commonGitDirectory)), 'ns-marks-the-spot');
}

function readConfig(path) {
  const config = JSON.parse(readFileSync(path, 'utf8'));
  if (
    typeof config.repository !== 'string'
    || !/^[0-9a-f]{40}$/.test(config.commit)
    || config.publicPath !== '/apps/nsmarksthespot/map/'
  ) {
    fail(`Invalid NS Marks web source config: ${path}`);
  }
  return config;
}

function validateBuild(dist) {
  const indexPath = join(dist, 'index.html');
  if (!existsSync(indexPath)) {
    fail('NS Marks web build did not produce dist/index.html');
  }
  const index = readFileSync(indexPath, 'utf8');
  if (!/(?:src|href)="\.\/assets\//.test(index)) {
    fail('NS Marks web build must use relative ./assets/ URLs');
  }
  if (/(?:src|href)="\/assets\//.test(index) || index.includes('/src/main')) {
    fail('NS Marks web build contains a development or root-relative asset URL');
  }
}

function installBuild(dist, destination, config) {
  const parent = dirname(destination);
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(join(parent, '.ns-map-stage-'));
  const backup = join(parent, `.ns-map-backup-${process.pid}`);
  let movedPrevious = false;

  try {
    for (const entry of readdirSync(dist)) {
      cpSync(join(dist, entry), join(staging, entry), { recursive: true });
    }
    writeFileSync(join(staging, 'source.json'), `${JSON.stringify(config, null, 2)}\n`);

    if (existsSync(backup)) {
      fail(`Refusing to overwrite unexpected backup path: ${backup}`);
    }
    if (existsSync(destination)) {
      renameSync(destination, backup);
      movedPrevious = true;
    }
    renameSync(staging, destination);
  } catch (error) {
    if (movedPrevious && !existsSync(destination) && existsSync(backup)) {
      renameSync(backup, destination);
    }
    throw error;
  } finally {
    if (existsSync(staging)) {
      rmSync(staging, { recursive: true, force: true });
    }
  }

  if (existsSync(backup)) {
    rmSync(backup, { recursive: true, force: true });
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const configPath = options.config ?? join(projectRoot, 'Tools/ns-marks-web-source.json');
  const source = options.source ?? process.env.NS_MARKS_REPO ?? defaultSourcePath();
  const destination = options.destination
    ?? join(projectRoot, 'Resources/apps/nsmarksthespot/map');
  const config = readConfig(configPath);

  const actualCommit = run('git', ['rev-parse', 'HEAD'], source);
  if (actualCommit !== config.commit) {
    fail(`NS Marks checkout ${actualCommit} does not match pinned commit ${config.commit}`);
  }
  const dirtyInputs = run(
    'git',
    ['status', '--short', '--', 'web', 'docs/assets/app-icon.svg'],
    source,
  );
  if (dirtyInputs) {
    fail(`NS Marks web inputs must be clean before syncing:\n${dirtyInputs}`);
  }

  const web = join(source, 'web');
  run('npm', ['ci'], web);
  run('npm', ['run', 'build'], web);
  const dist = join(web, 'dist');
  validateBuild(dist);
  installBuild(dist, destination, config);
  process.stdout.write(`Synced NS Marks web ${config.commit} to ${destination}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

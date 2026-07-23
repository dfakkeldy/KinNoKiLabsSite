#!/usr/bin/env node

import {
  appendFileSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const relevantInputs = ['web', 'docs/assets/app-icon.svg'];

function fail(message) {
  throw new Error(message);
}

function run(command, args, cwd, acceptedStatuses = [0]) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (!acceptedStatuses.includes(result.status)) {
    fail([
      `${command} ${args.join(' ')} failed in ${cwd}`,
      result.stdout.trim(),
      result.stderr.trim(),
    ].filter(Boolean).join('\n'));
  }
  return result;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!['--config', '--source', '--github-output'].includes(flag) || !value) {
      fail(
        'Usage: prepare-ns-marks-web-promotion.mjs '
        + '[--config path] --source path [--github-output path]',
      );
    }
    options[flag.slice(2)] = resolve(value);
  }
  if (!options.source) {
    fail('--source is required');
  }
  return options;
}

function readConfig(path) {
  const config = JSON.parse(readFileSync(path, 'utf8'));
  if (
    config.repository !== 'https://github.com/dfakkeldy/ns-marks-the-spot'
    || !/^[0-9a-f]{40}$/.test(config.commit)
    || config.publicPath !== '/apps/nsmarksthespot/map/'
  ) {
    fail(`Invalid NS Marks web source config: ${path}`);
  }
  return config;
}

function writeConfigAtomically(path, config) {
  const temporary = join(dirname(path), `.ns-marks-source-${process.pid}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`);
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function writeOutputs(path, values) {
  if (!path) {
    return;
  }
  appendFileSync(
    path,
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n',
  );
}

function prepare({ configPath, source, githubOutput }) {
  const config = readConfig(configPath);
  const sourceCommit = run('git', ['rev-parse', 'HEAD'], source).stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
    fail(`Invalid NS Marks source commit: ${sourceCommit}`);
  }

  const dirtyInputs = run(
    'git',
    ['status', '--short', '--', ...relevantInputs],
    source,
  ).stdout.trim();
  if (dirtyInputs) {
    fail(`NS Marks web inputs must be clean before promotion:\n${dirtyInputs}`);
  }

  if (sourceCommit === config.commit) {
    return {
      changed: false,
      reason: 'up-to-date',
      sourceCommit,
    };
  }

  const ancestry = run(
    'git',
    ['merge-base', '--is-ancestor', config.commit, sourceCommit],
    source,
    [0, 1],
  );
  if (ancestry.status !== 0) {
    fail(
      `Refusing NS Marks promotion because ${sourceCommit} is not a fast-forward `
      + `from pinned source ${config.commit}`,
    );
  }

  const relevantDiff = run(
    'git',
    ['diff', '--quiet', config.commit, sourceCommit, '--', ...relevantInputs],
    source,
    [0, 1],
  );
  if (relevantDiff.status === 0) {
    return {
      changed: false,
      reason: 'no-web-changes',
      sourceCommit,
    };
  }

  writeConfigAtomically(configPath, {
    ...config,
    commit: sourceCommit,
  });
  return {
    changed: true,
    reason: 'web-changes',
    sourceCommit,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const configPath = options.config
    ?? join(projectRoot, 'Tools/ns-marks-web-source.json');
  const result = prepare({
    configPath,
    source: options.source,
    githubOutput: options['github-output'],
  });

  const outputs = {
    changed: result.changed ? 'true' : 'false',
    reason: result.reason,
    source_commit: result.sourceCommit,
  };
  writeOutputs(options['github-output'], outputs);
  process.stdout.write(`${JSON.stringify(outputs)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

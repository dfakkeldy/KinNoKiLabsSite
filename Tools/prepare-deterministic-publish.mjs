#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, utimesSync } from 'node:fs';
import { join, relative } from 'node:path';

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const child = join(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(child);
      return entry.name.endsWith('.md') ? [child] : [];
    })
    .sort();
}

function parseEpoch(raw, context) {
  const epoch = Number(raw);
  if (!Number.isSafeInteger(epoch) || epoch <= 0) {
    throw new Error(`Could not determine a Git timestamp for ${context}.`);
  }
  return epoch;
}

const root = git(process.cwd(), ['rev-parse', '--show-toplevel']);
const dirtyContent = git(root, ['status', '--porcelain=v1', '--untracked-files=all', '--', 'Content']);
if (dirtyContent !== '') {
  throw new Error(
    'Content/ has uncommitted changes. Commit or stash them before generation; no files were modified.',
  );
}

const headEpoch = parseEpoch(git(root, ['log', '-1', '--format=%ct', 'HEAD']), 'HEAD');

for (const file of markdownFiles(join(root, 'Content'))) {
  const sourcePath = relative(root, file);
  const committed = git(root, ['log', '-1', '--format=%ct', '--', sourcePath]);
  const epoch = committed === '' ? headEpoch : parseEpoch(committed, sourcePath);
  utimesSync(file, epoch, epoch);
}

// Publish 0.8 caches RSS without including generateRSSFeed's explicit date in
// the cache key. Removing only that derived cache prevents stale feed bytes
// from overriding the deterministic date supplied by the custom pipeline.
rmSync(join(root, '.publish/Caches/generate-rss-feed/feed'), { force: true });

function latestEpoch(paths, context) {
  const committed = git(root, ['log', '-1', '--format=%ct', '--', ...paths]);
  return committed === '' ? headEpoch : parseEpoch(committed, context);
}

const feedEpoch = latestEpoch(['Content/apps', 'Content/posts'], 'RSS content');
const appsEpoch = latestEpoch(['Content/apps'], 'apps section');
const postsEpoch = latestEpoch(['Content/posts'], 'posts section');
process.stdout.write(`${feedEpoch} ${appsEpoch} ${postsEpoch}`);

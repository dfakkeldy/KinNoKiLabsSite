import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const preflightURL = new URL('../../Tools/prepare-deterministic-publish.mjs', import.meta.url);

function git(cwd, args, env = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  }).trim();
}

function commit(cwd, message, isoDate) {
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-m', message], {
    GIT_AUTHOR_DATE: isoDate,
    GIT_COMMITTER_DATE: isoDate,
  });
}

function latestCommitEpoch(paths) {
  return Number(git(repositoryRoot, ['log', '-1', '--format=%ct', '--', ...paths]));
}

function sitemapEntries(xml) {
  return new Map([...xml.matchAll(/<url><loc>([^<]+)<\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod><\/url>/g)]
    .map((match) => [match[1], match[2]]));
}

function contentFiles(directory = join(repositoryRoot, 'Content')) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = join(directory, entry.name);
    return entry.isDirectory() ? contentFiles(child) : entry.name.endsWith('.md') ? [child] : [];
  });
}

function routeForContent(file) {
  const sourcePath = relative(join(repositoryRoot, 'Content'), file);
  if (sourcePath === 'index.md') return null;
  const withoutExtension = sourcePath.slice(0, -3);
  return withoutExtension.endsWith('/index')
    ? withoutExtension.slice(0, -'/index'.length)
    : withoutExtension;
}

function canonicalFeedContent(feed) {
  const withoutDates = feed.replace(
    /<(?:lastBuildDate|pubDate)>[^<]+<\/(?:lastBuildDate|pubDate)>/g,
    '',
  );
  const items = [...withoutDates.matchAll(/<item>[\s\S]*?<\/item>/g)]
    .map((match) => match[0])
    .sort();
  return withoutDates.replace(/<item>[\s\S]*?<\/item>/g, '') + items.join('');
}

function halifaxCalendarDate(epoch) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Halifax', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(epoch * 1000)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

test('generation preflight uses Git dates, ignores later Tools-only commits for RSS, and clears stale RSS cache', () => {
  assert.equal(existsSync(preflightURL), true, 'deterministic generation preflight must exist');

  const fixture = mkdtempSync(join(tmpdir(), 'kinnoki-publish-dates-'));
  try {
    git(fixture, ['init', '-q']);
    git(fixture, ['config', 'user.name', 'Test']);
    git(fixture, ['config', 'user.email', 'test@example.com']);
    for (const name of ['Content/index.md', 'Content/apps/echo.md', 'Content/posts/index.md']) {
      mkdirSync(dirname(join(fixture, name)), { recursive: true });
      writeFileSync(join(fixture, name), `# ${basename(name)}\n`);
    }
    const feedDate = '2026-01-02T03:04:05Z';
    commit(fixture, 'feed content', feedDate);

    writeFileSync(join(fixture, 'Content/tools.md'), '# Tools\n');
    commit(fixture, 'tools only', '2026-02-03T04:05:06Z');

    for (const file of contentFiles(join(fixture, 'Content'))) {
      utimesSync(file, new Date('2035-01-01T00:00:00Z'), new Date('2035-01-01T00:00:00Z'));
    }
    const cache = join(fixture, '.publish/Caches/generate-rss-feed/feed');
    mkdirSync(dirname(cache), { recursive: true });
    writeFileSync(cache, 'stale');

    const expectedFeedEpoch = Math.floor(Date.parse(feedDate) / 1000);
    const run = () => execFileSync(process.execPath, [fileURLToPath(preflightURL)], {
      cwd: fixture,
      encoding: 'utf8',
    }).trim().split(/\s+/).map(Number);

    assert.deepEqual(
      run(),
      [expectedFeedEpoch, expectedFeedEpoch, expectedFeedEpoch],
      'preflight must provide deterministic RSS, apps-section, and posts-section dates',
    );
    assert.equal(existsSync(cache), false, 'stale Publish RSS cache must be removed');
    for (const file of contentFiles(join(fixture, 'Content'))) {
      const actual = Math.round(statSync(file).mtimeMs / 1000);
      const fileEpoch = Number(git(fixture, ['log', '-1', '--format=%ct', '--', relative(fixture, file)]));
      assert.equal(actual, fileEpoch, `${relative(fixture, file)} must use its Git commit date`);
    }

    utimesSync(join(fixture, 'Content/tools.md'), new Date('2040-01-01T00:00:00Z'), new Date('2040-01-01T00:00:00Z'));
    assert.deepEqual(
      run(),
      [expectedFeedEpoch, expectedFeedEpoch, expectedFeedEpoch],
      'a repeat run must return the same generation dates',
    );
    assert.equal(
      Math.round(statSync(join(fixture, 'Content/tools.md')).mtimeMs / 1000),
      Number(git(fixture, ['log', '-1', '--format=%ct', '--', 'Content/tools.md'])),
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('generation preflight fails before mutation for dirty or untracked Content', async (t) => {
  for (const changeKind of ['tracked', 'untracked']) {
    await t.test(changeKind, () => {
      const fixture = mkdtempSync(join(tmpdir(), `kinnoki-publish-dirty-${changeKind}-`));
      try {
        git(fixture, ['init', '-q']);
        git(fixture, ['config', 'user.name', 'Test']);
        git(fixture, ['config', 'user.email', 'test@example.com']);
        for (const name of ['Content/index.md', 'Content/apps/echo.md', 'Content/posts/index.md']) {
          mkdirSync(dirname(join(fixture, name)), { recursive: true });
          writeFileSync(join(fixture, name), `# ${basename(name)}\n`);
        }
        commit(fixture, 'content', '2026-01-02T03:04:05Z');

        const changedFile = changeKind === 'tracked'
          ? join(fixture, 'Content/index.md')
          : join(fixture, 'Content/new.md');
        writeFileSync(changedFile, '# Work in progress\n');
        utimesSync(changedFile, new Date('2035-01-01T00:00:00Z'), new Date('2035-01-01T00:00:00Z'));
        const contentBefore = new Map(contentFiles(join(fixture, 'Content')).map((file) => [
          relative(fixture, file),
          { bytes: readFileSync(file), mtimeMs: statSync(file).mtimeMs },
        ]));

        const cache = join(fixture, '.publish/Caches/generate-rss-feed/feed');
        mkdirSync(dirname(cache), { recursive: true });
        writeFileSync(cache, 'stale');

        const result = spawnSync(process.execPath, [fileURLToPath(preflightURL)], {
          cwd: fixture,
          encoding: 'utf8',
        });

        assert.notEqual(result.status, 0, 'dirty Content must stop deterministic generation');
        assert.match(result.stderr, /Content\/ has uncommitted changes/);
        for (const [sourcePath, before] of contentBefore) {
          const file = join(fixture, sourcePath);
          assert.deepEqual(readFileSync(file), before.bytes, `${sourcePath} bytes must be preserved`);
          assert.equal(statSync(file).mtimeMs, before.mtimeMs, `${sourcePath} mtime must be preserved`);
        }
        assert.equal(existsSync(cache), true, 'preflight must fail before clearing derived caches');
      } finally {
        rmSync(fixture, { recursive: true, force: true });
      }
    });
  }
});

test('generated feed dates come from feed-source commits without unrelated feed content churn', () => {
  const feed = readFileSync(join(repositoryRoot, 'Output/feed.rss'), 'utf8');
  const buildDate = feed.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/)?.[1];
  const expectedBuildEpoch = latestCommitEpoch(['Content/apps', 'Content/posts']);
  assert.equal(Math.floor(Date.parse(buildDate) / 1000), expectedBuildEpoch);

  for (const file of contentFiles(join(repositoryRoot, 'Content/apps')).filter((path) => basename(path) !== 'index.md')) {
    const url = `https://kinnokilabs.com/apps/${basename(file, '.md')}`;
    const item = feed.match(new RegExp(`<item><guid[^>]*>${url.replaceAll('.', '\\.')}` + '[\\s\\S]*?</item>'))?.[0];
    assert.ok(item, `${url} must remain in the feed`);
    const itemDate = item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1];
    assert.equal(Math.floor(Date.parse(itemDate) / 1000), latestCommitEpoch([relative(repositoryRoot, file)]));
  }

  assert.equal(
    createHash('sha256').update(canonicalFeedContent(feed)).digest('hex'),
    '7da1aa7787e8d83e376fb125817cc9dd17fefc39fe45078d255a7e1b9f63f65d',
    'deterministic generation must not churn unrelated feed content',
  );
});

test('generated sitemap last-modified dates come from each content file commit', () => {
  const entries = sitemapEntries(readFileSync(join(repositoryRoot, 'Output/sitemap.xml'), 'utf8'));

  const sectionRoutes = [
    { url: 'https://kinnokilabs.com/apps', source: 'Content/apps' },
    { url: 'https://kinnokilabs.com/posts', source: 'Content/posts' },
  ];
  for (const { url, source } of sectionRoutes) {
    const expected = halifaxCalendarDate(latestCommitEpoch([source]));
    assert.equal(entries.get(url), expected, `${url} section date must come from ${source} history`);
  }

  for (const file of contentFiles()) {
    const route = routeForContent(file);
    if (route === null || route === 'apps' || route === 'posts') continue;
    const url = `https://kinnokilabs.com/${route}`;
    const expected = halifaxCalendarDate(latestCommitEpoch([relative(repositoryRoot, file)]));
    assert.equal(entries.get(url), expected, `${url} must use ${relative(repositoryRoot, file)} history`);
  }
});

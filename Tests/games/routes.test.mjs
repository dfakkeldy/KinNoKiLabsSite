import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('reviewed Arcade Hall social art is exact and generator-copied byte-for-byte', () => {
  const source = readFileSync(new URL('../../Resources/images/games/og.png', import.meta.url));
  const output = readFileSync(new URL('../../Output/images/games/og.png', import.meta.url));
  assert.equal(source.toString('ascii', 1, 4), 'PNG');
  assert.equal(source.readUInt32BE(16), 1734);
  assert.equal(source.readUInt32BE(20), 907);
  assert.equal(createHash('sha256').update(source).digest('hex'),
    'e6246c17edf3e48206a8ed1f49cc948fe578d1b0c9437f3edbf12534e8c1d3bb');
  assert.deepEqual(output, source);
});

for (const page of ['kinnoki-stack', 'kinnoki-yard', 'kinnoki-charts']) {
  test(`${page} has a metadata-only content source`, () => {
    const source = readFileSync(new URL(`../../Content/games/${page}.md`, import.meta.url), 'utf8');
    assert.match(source, /^---\n[\s\S]+\n---\n$/);
    assert.match(source, /image: \/images\/games\/og\.png/);
  });
}

test('bootstrap opens validated Stack, Yard, and Charts runs and lazy-loads all three controllers', () => {
  const source = readFileSync(new URL('../../Resources/games/ui.js', import.meta.url), 'utf8');
  assert.match(source, /openGameStore\(storage, \{ runValidators \}\)/);
  assert.match(source, /validateStackState\(run\?\.puzzle\?\.play, run\?\.difficulty\)\.valid/);
  assert.match(source, /validateYardState\(run\?\.puzzle\?\.play, run\?\.difficulty, run\?\.mode\)\.valid/);
  assert.match(source, /validateChartsState\(run\?\.puzzle\?\.play, run\?\.difficulty\)\.valid/);
  assert.match(source, /import\('\.\/kinnoki-stack-ui\.js'\)/);
  assert.match(source, /import\('\.\/kinnoki-yard-ui\.js'\)/);
  assert.match(source, /import\('\.\/kinnoki-charts-ui\.js'\)/);
  assert.match(source, /renderGameError\(root,/);
});

for (const resource of [
  'cargo-geometry.js', 'kinnoki-stack.js', 'kinnoki-yard.js', 'game-audio.js',
  'sudoku-ui.js', 'crossword-ui.js', 'word-search-ui.js',
  'kinnoki-stack-ui.js', 'kinnoki-yard-ui.js',
  'kinnoki-charts.js', 'kinnoki-charts-ui.js', 'kinnoki-charts-content.js', 'celebration.js',
]) {
  test(`${resource} is shipped with generated game resources`, () => {
    assert.equal(existsSync(new URL(`../../Output/games/${resource}`, import.meta.url)), true);
  });
}

for (const [route, page] of [
  ['games', 'hub'],
  ['games/sudoku', 'sudoku'],
  ['games/crossword', 'crossword'],
  ['games/word-search', 'word-search'],
  ['games/kinnoki-stack', 'kinnoki-stack'],
  ['games/kinnoki-yard', 'kinnoki-yard'],
  ['games/kinnoki-charts', 'kinnoki-charts'],
]) {
  test(`${route} has the game shell, module, navigation, and current metadata`, () => {
    const html = readFileSync(new URL(`../../Output/${route}/index.html`, import.meta.url), 'utf8');
    assert.match(html, new RegExp(`data-game-page="${page}"`));
    assert.match(html, /type="module"[^>]+src="\/games\/ui\.js"/);
    assert.match(html, /og:image[^>]+\/images\/games\/og\.png/);
    assert.equal([...html.matchAll(/href="\/games"[^>]*aria-current="page"/g)].length, 2);
    assert.doesNotMatch(html, /three familiar|three classics|three games/i);
  });
}

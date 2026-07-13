import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

for (const controller of ['sudoku-ui.js', 'crossword-ui.js', 'word-search-ui.js']) {
  test(`${controller} is shipped with generated game resources`, () => {
    assert.equal(existsSync(new URL(`../../Output/games/${controller}`, import.meta.url)), true);
  });
}

for (const [route, page] of [
  ['games', 'hub'],
  ['games/sudoku', 'sudoku'],
  ['games/crossword', 'crossword'],
  ['games/word-search', 'word-search'],
]) {
  test(`${route} has the game shell and module`, () => {
    const path = new URL(`../../Output/${route}/index.html`, import.meta.url);
    assert.equal(existsSync(path), true);

    const html = readFileSync(path, 'utf8');
    assert.match(html, new RegExp(`data-game-page="${page}"`));
    assert.match(html, /<script[^>]+type="module"[^>]+src="\/games\/ui\.js"/);
    assert.match(html, /<meta property="og:image" content="https:\/\/kinnokilabs\.com\/images\/games\/og\.png"\s*\/?>/);
    assert.match(html, /href="\/games"[^>]*aria-current="page"/);
    assert.equal(
      [...html.matchAll(/href="\/games"[^>]*aria-current="page"/g)].length,
      2,
      'Games must be current in both desktop and mobile navigation',
    );
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../Output/learn/index.html', import.meta.url), 'utf8');
const count = (text) => html.split(text).length - 1;

test('learn page lists each approved new public book exactly once', () => {
  assert.equal(count('<h3>Chicken Predators</h3>'), 1);
  assert.equal(count('<h3>Rodents in the Walls</h3>'), 1);
  assert.equal(count('<h3>The New Deal</h3>'), 1);
  assert.match(html, /books\/the-new-deal\/the-new-deal\.epub/);
  assert.match(html, /books\/the-new-deal\/the-new-deal\.md/);
});

test('private books remain absent from learn', () => {
  assert.doesNotMatch(html, /The Long Route/);
  assert.doesNotMatch(html, /The Living Knowledge Base/);
});

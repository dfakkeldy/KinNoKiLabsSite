import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('only a user request loads the approved film, with inline playback and keyboard focus', () => {
  let click, frame;
  const play = { hidden: true, addEventListener(type, callback, options) {
    assert.equal(type, 'click');
    assert.equal(options.once, true);
    click = callback;
  } };
  const player = { replaceChildren(element) { frame = element; } };
  const document = {
    body: { classList: { contains: () => true } },
    querySelector: () => null,
    getElementById: (id) => ({ 'merchant-video': player, 'merchant-video-play': play })[id],
    createElement(tag) {
      assert.equal(tag, 'iframe');
      return { focus() { document.activeElement = this; } };
    },
  };
  vm.runInNewContext(readFileSync(new URL('../../Resources/shakespeare.js', import.meta.url), 'utf8'), { document });
  assert.equal(play.hidden, false);
  assert.equal(frame, undefined, 'page load must not load YouTube or start playback');
  click();
  const url = new URL(frame.src);
  assert.equal(url.origin, 'https://www.youtube-nocookie.com');
  assert.equal(url.pathname, '/embed/ikYvGMdBV2E');
  assert.equal(url.searchParams.get('autoplay'), '1', 'the play action requests playback');
  assert.equal(url.searchParams.get('playsinline'), '1');
  assert.equal(frame.referrerPolicy, 'strict-origin-when-cross-origin', 'YouTube requires the embedding origin');
  assert.equal(frame.allowFullscreen, true);
  assert.match(frame.title, /Word Is Bond/);
  assert.equal(document.activeElement, frame, 'keyboard focus follows the activated player');
});

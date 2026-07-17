import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, FixtureEvent, installDOM } from './dom-fixture.mjs';

test('celebrate mounts exactly one hidden overlay containing particleCount particles', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { celebrate } = await import('../../Resources/games/celebration.js');
    celebrate({ root: fixture.root, reducedMotion: false, particleCount: 5 });
    const overlays = fixture.root.querySelectorAll('.game-celebration');
    assert.equal(overlays.length, 1, 'exactly one overlay is mounted');
    assert.equal(overlays[0].getAttribute('aria-hidden'), 'true');
    assert.equal(overlays[0].querySelectorAll('.game-celebration-particle').length, 5);
  } finally { restore(); }
});

test('simulating animationend on every particle removes the overlay', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { celebrate } = await import('../../Resources/games/celebration.js');
    celebrate({ root: fixture.root, reducedMotion: false, particleCount: 3 });
    const particles = fixture.root.querySelectorAll('.game-celebration-particle');
    assert.equal(particles.length, 3);
    for (const [index, particle] of particles.entries()) {
      particle.dispatchEvent(new FixtureEvent('animationend'));
      if (index < particles.length - 1) {
        assert.equal(fixture.root.querySelectorAll('.game-celebration').length, 1,
          'overlay stays mounted until every particle finishes animating');
      }
    }
    assert.equal(fixture.root.querySelectorAll('.game-celebration').length, 0);
  } finally { restore(); }
});

test('dispose() removes the overlay early, before particles finish animating', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { celebrate } = await import('../../Resources/games/celebration.js');
    const { dispose } = celebrate({ root: fixture.root, reducedMotion: false, particleCount: 4 });
    assert.equal(fixture.root.querySelectorAll('.game-celebration').length, 1);
    dispose();
    assert.equal(fixture.root.querySelectorAll('.game-celebration').length, 0);
  } finally { restore(); }
});

test('celebrate with reducedMotion: true mounts nothing and dispose is a safe no-op', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { celebrate } = await import('../../Resources/games/celebration.js');
    const { dispose } = celebrate({ root: fixture.root, reducedMotion: true });
    assert.equal(fixture.root.querySelectorAll('.game-celebration').length, 0);
    assert.doesNotThrow(() => dispose());
  } finally { restore(); }
});

test('celebrate defaults reducedMotion from prefersReducedMotion() when omitted', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { celebrate } = await import('../../Resources/games/celebration.js');
    celebrate({ root: fixture.root });
    assert.equal(fixture.root.querySelectorAll('.game-celebration').length, 1,
      'no matchMedia on the fixture means motion is not reduced by default');
  } finally { restore(); }
});

test('celebrate without a root does not throw and returns a no-op dispose', async () => {
  const { celebrate } = await import('../../Resources/games/celebration.js');
  const { dispose } = celebrate({});
  assert.doesNotThrow(() => dispose());
});

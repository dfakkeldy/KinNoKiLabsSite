import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, installDOM } from './dom-fixture.mjs';

test('announcer prioritizes meaningful events and silences gravity', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createEventAnnouncer } = await import('../../Resources/games/controller-common.js');
    let now = 100;
    const region = fixture.document.createElement('p');
    const announcer = createEventAnnouncer({
      region, monotonicNow: () => now, minimumGapMs: 180,
    });
    assert.equal(announcer.announce({
      type: 'moved', source: 'gravity', row: 4, column: 5,
    }), false);
    assert.equal(region.textContent, '');
    announcer.announce({
      type: 'tide-warning', direction: 'left', placementsRemaining: 2,
    });
    assert.equal(region.textContent, 'Left tide in 2 placements.');
    announcer.announce({ type: 'invalid', action: 'move', reason: 'Blocked.' });
    const first = region.textContent;
    now += 20;
    assert.equal(announcer.announce({
      type: 'invalid', action: 'move', reason: 'Blocked.',
    }), false);
    assert.equal(region.textContent, first);
    now += 200;
    announcer.announce({ type: 'terminal', reason: 'no-placement' });
    assert.equal(region.textContent, 'Run ended. No legal cargo placement remains.');
    announcer.announce({ type: 'terminal', reason: 'crane-line' });
    assert.equal(region.textContent, 'Run ended. Cargo reached the crane line.');
    announcer.announce({ type: 'terminal', reason: 'spawn-blocked' });
    assert.equal(region.textContent, 'Run ended. The next cargo could not enter the dock.');
  } finally { restore(); }
});

test('music and effects expose independent mute and normalized range controls', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { createAudioControls } = await import('../../Resources/games/controller-common.js');
    const updates = [];
    const controls = createAudioControls({
      document: fixture.document,
      preferences: {
        musicEnabled: true, musicVolume: 0.35,
        effectsEnabled: true, effectsVolume: 0.50,
      },
      onChange: (value) => updates.push(value),
    });
    fixture.root.append(controls.element);
    const musicRange = fixture.root.querySelector('[data-audio-music-volume]');
    const effectsRange = fixture.root.querySelector('[data-audio-effects-volume]');
    assert.equal(musicRange.getAttribute('type'), 'range');
    assert.equal(musicRange.getAttribute('aria-label'), 'Music volume');
    assert.equal(effectsRange.getAttribute('aria-label'), 'Effects volume');
    musicRange.value = '0.8'; musicRange.dispatchEvent(new Event('input'));
    assert.equal(updates.at(-1).musicVolume, 0.8);
    assert.equal(updates.at(-1).effectsVolume, 0.5);
    fixture.root.querySelector('[data-audio-effects-toggle]').click();
    assert.equal(updates.at(-1).effectsEnabled, false);
    assert.equal(updates.at(-1).musicEnabled, true);
  } finally { restore(); }
});

test('fatal recovery and saved Yard links preserve a usable destination', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { renderGameError, renderReplacementKept } = await import(
      '../../Resources/games/controller-common.js'
    );
    renderGameError(fixture.root, {
      title: 'Cargo state unavailable',
      message: 'The saved run could not be validated.',
      newGameHref: '/games/kinnoki-yard?mode=contracts&difficulty=easy',
    });
    assert.equal(fixture.root.querySelector('[role="alert"] h1').textContent,
      'Cargo state unavailable');
    assert.equal(fixture.root.querySelector('.btn-gold').getAttribute('href'),
      '/games/kinnoki-yard?mode=contracts&difficulty=easy');
    assert.equal(fixture.root.querySelector('.back-link').getAttribute('href'), '/games');

    renderReplacementKept(fixture.root, 'kinnoki-yard', 'hard', 'endless');
    assert.equal(fixture.root.querySelector('.btn-gold').getAttribute('href'),
      '/games/kinnoki-yard?mode=endless&difficulty=hard&continue=1');
    assert.equal(fixture.root.querySelector('.btn-gold').textContent,
      'Continue Endless Yard · Hard');
  } finally { restore(); }
});

test('cargoThumb builds a percentage-positioned thumbnail from cell coordinates', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { cargoThumb } = await import('../../Resources/games/controller-common.js');
    const thumb = cargoThumb([
      { row: 0, column: 0 }, { row: 0, column: 1 }, { row: 1, column: 1 },
    ], { patternClass: 'cargo-pattern-dots', rotation: 1 });
    assert.equal(thumb.className, 'cargo-thumb');
    assert.equal(thumb.getAttribute('aria-hidden'), 'true');
    assert.equal(thumb.getAttribute('data-rotation'), '1');
    assert.equal(thumb.style.getPropertyValue('--cargo-thumb-columns'), '2');
    assert.equal(thumb.style.getPropertyValue('--cargo-thumb-rows'), '2');
    assert.equal(thumb.children.length, 3);
    const [first, second, third] = thumb.children;
    assert.equal(first.className, 'cargo-thumb-cell cargo-pattern-dots');
    assert.equal(first.style.getPropertyValue('--cargo-thumb-cell-column'), '0');
    assert.equal(first.style.getPropertyValue('--cargo-thumb-cell-row'), '0');
    assert.equal(second.style.getPropertyValue('--cargo-thumb-cell-column'), '1');
    assert.equal(second.style.getPropertyValue('--cargo-thumb-cell-row'), '0');
    assert.equal(third.style.getPropertyValue('--cargo-thumb-cell-column'), '1');
    assert.equal(third.style.getPropertyValue('--cargo-thumb-cell-row'), '1');
  } finally { restore(); }
});

test('cargoThumb rotation metadata defaults to 0 and normalizes out-of-range values', async () => {
  const fixture = createDOMFixture(); const restore = installDOM(fixture);
  try {
    const { cargoThumb } = await import('../../Resources/games/controller-common.js');
    const plain = cargoThumb([{ row: 0, column: 0 }], { patternClass: 'cargo-pattern-solid' });
    assert.equal(plain.getAttribute('data-rotation'), '0');
    const negative = cargoThumb([{ row: 0, column: 0 }], {
      patternClass: 'cargo-pattern-solid', rotation: -1,
    });
    assert.equal(negative.getAttribute('data-rotation'), '3');
    const large = cargoThumb([{ row: 0, column: 0 }], {
      patternClass: 'cargo-pattern-solid', rotation: 5,
    });
    assert.equal(large.getAttribute('data-rotation'), '1');
  } finally { restore(); }
});

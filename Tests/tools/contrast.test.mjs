import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contrastRatio,
  hexToRgb,
  rgbToHex,
  suggestPassing,
  verdicts,
} from '../../Resources/tools/contrast.js';

test('hexToRgb expands shorthand and parses six-digit colours', () => {
  assert.deepEqual(hexToRgb('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(hexToRgb('#1a2b3c'), { r: 26, g: 43, b: 60 });
});

test('hexToRgb rejects invalid colours', () => {
  assert.equal(hexToRgb('red'), null);
  assert.equal(hexToRgb('#12'), null);
});

test('contrastRatio calculates WCAG black-white and same-colour ratios', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 0.01);
  assert.equal(contrastRatio('#1a2b3c', '#1a2b3c'), 1);
});

test('contrastRatio pins the site gold on near-black token ratio', () => {
  const ratio = contrastRatio('#d4af37', '#0b0b0c');
  assert.equal(Number(ratio.toFixed(2)), 9.36);
  assert.ok(ratio >= 7);
});

test('verdicts marks WCAG thresholds independently', () => {
  assert.deepEqual(verdicts(4.6), {
    aaNormal: true,
    aaLarge: true,
    aaaNormal: false,
    aaaLarge: true,
    uiComponent: true,
  });
  assert.deepEqual(verdicts(2.9), {
    aaNormal: false,
    aaLarge: false,
    aaaNormal: false,
    aaaLarge: false,
    uiComponent: false,
  });
});

test('suggestPassing minimally nudges foreground lightness to meet a target', () => {
  const suggestion = suggestPassing('#777777', '#888888', 4.5);
  assert.notEqual(suggestion, null);
  assert.ok(contrastRatio(suggestion, '#888888') >= 4.5);
});

test('suggestPassing rejects non-finite, non-numeric, and out-of-range targets', () => {
  for (const target of [null, -1, 0, 21.1, '4.5', Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(suggestPassing('#777777', '#888888', target), null);
  }
});

test('suggestPassing returns the normalized foreground when it already meets the target', () => {
  assert.equal(suggestPassing('#000', '#fff', 21), '#000000');
});

test('suggestPassing returns the closest representable lightness-adjusted candidate', () => {
  assert.equal(suggestPassing('#777777', '#888888', 4.5), '#212121');
});

test('suggestPassing finds the closest passing candidate on a coloured HSL path', () => {
  const candidate = suggestPassing('#0099cc', '#0b0b0c', 12);
  assert.equal(candidate, '#65d8ff');
  assert.ok(contrastRatio(candidate, '#0b0b0c') >= 12);
  assert.equal(Number(contrastRatio(candidate, '#0b0b0c').toFixed(2)), 12.01);
  assert.ok(contrastRatio('#65d7ff', '#0b0b0c') < 12);
});

test('suggestPassing returns null when its target is impossible', () => {
  assert.equal(suggestPassing('#808080', '#808080', 21), null);
});

test('rgbToHex round-trips a parsed hex colour', () => {
  assert.equal(rgbToHex(hexToRgb('#1a2b3c')), '#1a2b3c');
});

test('rgbToHex and relativeLuminance reject invalid RGB values', async () => {
  const { relativeLuminance } = await import('../../Resources/tools/contrast.js');
  for (const invalid of [null, 'rgb', {}, { r: 0, g: 0, b: Number.NaN },
    { r: 0, g: Number.POSITIVE_INFINITY, b: 0 }]) {
    assert.equal(rgbToHex(invalid), null);
    assert.equal(relativeLuminance(invalid), null);
  }
});

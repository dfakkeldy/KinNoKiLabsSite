import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../Resources/styles.css', import.meta.url), 'utf8');
function declarations(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]+)\\}`))?.[1];
  assert.ok(body, `Missing scoped rule: ${selector}`);
  return Object.fromEntries([...body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
}
function luminance(hex) {
  assert.match(hex, /^#[\da-f]{6}$/i);
  const channels = hex.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(foreground, background, minimum, description) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  const ratio = (values[0] + 0.05) / (values[1] + 0.05);
  assert.ok(ratio >= minimum, `${description}: ${ratio.toFixed(2)}:1 < ${minimum}:1`);
}

for (const [name, themeSelector, scope] of [
  ['dark', ':root', '.page-shakespeare'],
  ['light', '[data-theme="light"]', '[data-theme="light"] .page-shakespeare'],
]) {
  test(`${name} showcase text and focus meet contrast on every page surface`, () => {
    const palette = declarations(themeSelector);
    const tokens = declarations(scope);
    for (const surface of ['--bg', '--surface', '--surface-2']) {
      contrast(palette['--text'], palette[surface], 4.5, `${name} body on ${surface}`);
      contrast(palette['--text'], palette[surface], 3, `${name} headings on ${surface}`);
      for (const token of ['--shakespeare-muted', '--shakespeare-secondary', '--shakespeare-accent']) {
        contrast(tokens[token], palette[surface], 4.5, `${name} ${token} on ${surface}`);
      }
      contrast(tokens['--shakespeare-focus'], palette[surface], 3, `${name} focus on ${surface}`);
    }
  });
}

test('Suno and downloads keep readable text in default, hover and keyboard-focus states', () => {
  const button = declarations('.page-shakespeare .shakespeare-suno,\n.page-shakespeare .shakespeare-suno:hover,\n.page-shakespeare .shakespeare-suno:focus-visible,\n.page-shakespeare .shakespeare-download,\n.page-shakespeare .shakespeare-download:hover,\n.page-shakespeare .shakespeare-download:focus-visible');
  assert.equal(button.background, '#f1d596');
  assert.equal(button.color, '#1d1d1f');
  contrast(button.color, button.background, 4.5, 'Suno label');
});

test('Concept captions and cover lettering remain readable over their fixed backgrounds', () => {
  for (const selector of ['.page-shakespeare .shakespeare-art-caption', '.page-shakespeare .shakespeare-cover']) {
    const style = declarations(selector);
    contrast(style.color, style.background, 4.5, selector);
  }
});

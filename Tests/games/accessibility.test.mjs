import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../Resources/styles.css', import.meta.url), 'utf8');

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function ruleBody(selector) {
  const match = css.match(new RegExp(`${escaped(selector)}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `missing CSS rule for ${selector}`);
  return match[1];
}

function colorToken(selector, name) {
  const match = ruleBody(selector).match(new RegExp(`${escaped(name)}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  assert.ok(match, `${selector} must declare ${name} as a six-digit hex color`);
  return match[1];
}

function relativeLuminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => parseInt(value, 16) / 255);
  const linear = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(a, b) {
  const luminances = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

for (const theme of [
  { name: 'dark', selector: ':root' },
  { name: 'light', selector: '[data-theme="light"]' },
]) {
  test(`${theme.name} game text tokens meet WCAG AA on every game surface`, () => {
    const backgrounds = ['--bg', '--surface', '--surface-2'].map((name) => colorToken(theme.selector, name));
    for (const name of [
      '--game-text-primary', '--game-text-secondary', '--game-text-tertiary', '--game-text-accent',
    ]) {
      const foreground = colorToken(theme.selector, name);
      for (const background of backgrounds) {
        const ratio = contrastRatio(foreground, background);
        assert.ok(
          ratio >= 4.5,
          `${theme.name} ${name} ${foreground} is ${ratio.toFixed(2)}:1 on ${background}; expected >= 4.5:1`,
        );
      }
    }
  });
}

test('all normal and small game text uses measured game tokens', () => {
  const selectorTokens = new Map([
    ['.games-hero > p:last-child', '--game-text-secondary'],
    ['.game-card-description', '--game-text-secondary'],
    ['.difficulty-links a', '--game-text-primary'],
    ['.difficulty-links > span', '--game-text-tertiary'],
    ['.game-card-stats dt', '--game-text-tertiary'],
    ['.game-card-stats dd', '--game-text-primary'],
    ['.games-stats > div > p:last-child', '--game-text-secondary'],
    ['.games-stats-summary dt', '--game-text-secondary'],
    ['.game-card-eyebrow', '--game-text-accent'],
    ['.game-card-symbol', '--game-text-accent'],
    ['.games-stats-summary dd', '--game-text-accent'],
    ['.games-main .eyebrow', '--game-text-accent'],
    ['.games-reset', '--game-text-primary'],
    ['.game-storage-notice', '--game-text-primary'],
    ['.game-dialog form > p:not(.eyebrow)', '--game-text-secondary'],
    ['.game-error p', '--game-text-secondary'],
  ]);

  for (const [selector, token] of selectorTokens) {
    assert.match(ruleBody(selector), new RegExp(`color:\\s*var\\(${escaped(token)}\\)`));
  }
});

test('difficulty links and reset control are at least 44 by 44 CSS pixels', () => {
  const difficulty = ruleBody('.difficulty-links a');
  assert.match(difficulty, /min-width:\s*44px/);
  assert.match(difficulty, /min-height:\s*44px/);

  const reset = ruleBody('.games-reset');
  assert.match(reset, /min-width:\s*44px/);
  assert.match(reset, /min-height:\s*44px/);
  assert.doesNotMatch(reset, /height:\s*(?:[0-3]?\d|4[0-3])px/);
});

test('cargo controls and Yard cells retain 44 CSS-pixel targets', () => {
  for (const selector of [
    '.stack-controls button', '.yard-controls button',
    '.yard-cell', '.yard-tray-piece', '.yard-pan-controls button',
    '.game-audio-controls button', '.game-audio-controls input[type="range"]',
  ]) {
    const body = ruleBody(selector);
    assert.match(body, /min-width:\s*44px/);
    assert.match(body, /min-height:\s*44px/);
  }
});

test('cargo state has non-colour patterns and local overflow containment', () => {
  for (const selector of [
    '.cargo-pattern-dots', '.cargo-pattern-diagonal',
    '.cargo-pattern-crosshatch', '.cargo-pattern-bands',
  ]) assert.match(ruleBody(selector), /background-image:/);
  assert.match(ruleBody('.yard-board-scroll'), /overflow:\s*auto/);
  assert.match(ruleBody('.games-app'), /overflow-x:\s*clip/);
});

test('cargo motion and board panning have reduced-motion overrides', () => {
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.stack-cargo-active[\s\S]*?animation:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.cargo-dispatching[\s\S]*?transition:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.cargo-tide-shifting[\s\S]*?transform:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.yard-board-scroll[\s\S]*?scroll-behavior:\s*auto/);
});

test('celebration overlay and completion entrance have reduced-motion overrides', () => {
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.game-celebration[\s\S]*?display:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.game-complete[\s\S]*?animation:\s*none/);
});

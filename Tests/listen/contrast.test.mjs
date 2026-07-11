import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const siteCss = readFileSync(new URL('../../Resources/styles.css', import.meta.url), 'utf8');
const listenCss = readFileSync(new URL('../../Resources/listen/listen.css', import.meta.url), 'utf8');

function escaped(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ruleBody(css, selector) {
  const match = css.match(new RegExp(`${escaped(selector)}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `missing CSS rule for ${selector}`);
  return match[1];
}

function customProperty(css, selector, name) {
  const body = ruleBody(css, selector);
  const match = body.match(new RegExp(`${escaped(name)}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  assert.ok(match, `${selector} must declare ${name} as an explicit six-digit hex color`);
  return match[1];
}

function customPropertyValue(css, selector, name) {
  const body = ruleBody(css, selector);
  const match = body.match(new RegExp(`${escaped(name)}\\s*:\\s*([^;]+);`));
  assert.ok(match, `${selector} must declare ${name}`);
  return match[1].trim();
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

const textTokens = [
  '--room-text-secondary',
  '--room-text-tertiary',
  '--room-text-accent',
  '--room-text-error',
];

const controlTokens = [
  '--room-control-border',
  '--room-track',
];

for (const theme of [
  { name: 'dark', selector: ':root' },
  { name: 'light', selector: '[data-theme="light"]' },
]) {
  test(`${theme.name} player tokens meet WCAG contrast on background and surface`, () => {
    const backgrounds = ['--bg', '--surface'].map((name) => (
      customProperty(siteCss, theme.selector, name)
    ));

    for (const name of textTokens) {
      const foreground = customProperty(listenCss, theme.selector, name);
      for (const background of backgrounds) {
        const ratio = contrastRatio(foreground, background);
        assert.ok(
          ratio >= 4.5,
          `${theme.name} ${name} ${foreground} is ${ratio.toFixed(2)}:1 on ${background}; expected >= 4.5:1`,
        );
      }
    }

    for (const name of controlTokens) {
      const foreground = customProperty(listenCss, theme.selector, name);
      for (const background of backgrounds) {
        const ratio = contrastRatio(foreground, background);
        assert.ok(
          ratio >= 3,
          `${theme.name} ${name} ${foreground} is ${ratio.toFixed(2)}:1 on ${background}; expected >= 3:1`,
        );
      }
    }
  });
}

test('normal-size player copy and actions use accessible semantic tokens', () => {
  const selectorTokens = new Map([
    ['.room-back', '--room-text-secondary'],
    ['.room-eyebrow', '--room-text-accent'],
    ['.room-subtitle', '--room-text-secondary'],
    ['.room-byline', '--room-text-tertiary'],
    ['.room-chapters summary', '--room-text-secondary'],
    ['.room-chapters summary::after', '--room-text-tertiary'],
    ['.room-chapter-count', '--room-text-tertiary'],
    ['.room-chapter-btn', '--room-text-secondary'],
    ['.room-chapter-btn .t', '--room-text-tertiary'],
    ['.room-chapters [aria-current="true"] .room-chapter-btn', '--room-text-accent'],
    ['.room-now', '--room-text-accent'],
    ['.room-captions .w', '--room-text-secondary'],
    ['.room-captions .w.heard', '--room-text-accent'],
    ['.room-captions .quiet', '--room-text-tertiary'],
    ['.room-status', '--room-text-tertiary'],
    ['.room-status a', '--room-text-secondary'],
    ['.room-status.error', '--room-text-error'],
    ['.room-skip', '--room-text-secondary'],
    ['.room-speed', '--room-text-secondary'],
    ['.room-times', '--room-text-tertiary'],
    ['.room-cta p', '--room-text-secondary'],
    ['.room-library-sub', '--room-text-secondary'],
    ['.room-library li a', '--room-text-secondary'],
    ['.room-library li a.room-lib-listen', '--room-text-accent'],
    ['.room-library li a:hover', '--room-text-accent'],
    ['.room-honesty', '--room-text-tertiary'],
    ['.room-honesty a', '--room-text-secondary'],
    ['.room-noscript', '--room-text-secondary'],
    ['.room-foot', '--room-text-tertiary'],
    ['.room-foot a', '--room-text-secondary'],
  ]);

  for (const [selector, token] of selectorTokens) {
    assert.match(
      ruleBody(listenCss, selector),
      new RegExp(`(?:^|;)\\s*color\\s*:\\s*var\\(${escaped(token)}\\)\\s*;?`),
      `${selector} must use ${token}`,
    );
  }

  assert.doesNotMatch(
    listenCss,
    /(?<![-\w])color:\s*var\(--(?:text-muted|text-quaternary|gold-text)\)/,
    'player text colors must not fall back to inaccessible global muted or gold text tokens',
  );
});

test('player controls use accessible boundaries and track colors', () => {
  for (const selector of ['.room-bar .font-toggle', '.room-bar .theme-toggle']) {
    const body = ruleBody(listenCss, selector);
    assert.match(body, /color:\s*var\(--room-text-secondary\)/);
    assert.match(body, /border-color:\s*var\(--room-control-border\)/);
  }

  assert.match(ruleBody(listenCss, 'body.font-opendyslexic .room-bar .font-toggle'), /color:\s*var\(--room-text-accent\)/);
  assert.match(ruleBody(listenCss, '.room-play'), /border:\s*1px solid var\(--room-control-border\)/);
  assert.match(ruleBody(listenCss, '.room-speed'), /border:\s*1px solid var\(--room-control-border\)/);

  const webkitTrack = ruleBody(listenCss, '.room-scrub input[type="range"]::-webkit-slider-runnable-track');
  assert.match(webkitTrack, /var\(--room-text-accent\)/);
  assert.match(webkitTrack, /var\(--room-track\)/);
  assert.match(ruleBody(listenCss, '.room-scrub input[type="range"]::-webkit-slider-thumb'), /background:\s*var\(--room-text-accent\)/);
  assert.match(ruleBody(listenCss, '.room-scrub input[type="range"]::-moz-range-track'), /background:\s*var\(--room-track\)/);
  assert.match(ruleBody(listenCss, '.room-scrub input[type="range"]::-moz-range-progress'), /background:\s*var\(--room-text-accent\)/);
  assert.match(ruleBody(listenCss, '.room-scrub input[type="range"]::-moz-range-thumb'), /background:\s*var\(--room-text-accent\)/);
});

for (const theme of [
  { name: 'dark', selector: ':root' },
  { name: 'light', selector: '[data-theme="light"]' },
]) {
  test(`${theme.name} player CTA text meets AA at every real gold gradient stop`, () => {
    const actionText = customProperty(listenCss, theme.selector, '--room-action-text');
    const gradient = customPropertyValue(siteCss, ':root', '--grad-gold');
    const stops = gradient.match(/#[0-9a-fA-F]{6}/g) ?? [];
    assert.ok(stops.length > 0, 'the real --grad-gold declaration must contain explicit hex stops');

    for (const stop of stops) {
      const ratio = contrastRatio(actionText, stop);
      assert.ok(
        ratio >= 4.5,
        `${theme.name} CTA ${actionText} is ${ratio.toFixed(2)}:1 on gradient stop ${stop}; expected >= 4.5:1`,
      );
    }
  });
}

test('player CTA keeps its accessible action text in normal and hover states', () => {
  for (const selector of ['.room-cta .btn-gold', '.room-cta .btn-gold:hover']) {
    assert.match(
      ruleBody(listenCss, selector),
      /(?:^|;)\s*color:\s*var\(--room-action-text\)/,
      `${selector} must use --room-action-text`,
    );
  }
});

test('selected-book recovery links remain primary text in every state', () => {
  assert.match(ruleBody(listenCss, '.room-formats a'), /(?:^|;)\s*color:\s*var\(--text\)/);
  assert.match(ruleBody(listenCss, '.room-formats a:hover'), /(?:^|;)\s*color:\s*var\(--text\)/);
});

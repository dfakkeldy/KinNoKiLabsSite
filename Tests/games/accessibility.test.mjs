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
    '.charts-cell', '.charts-controls button', '.game-preplay button',
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

test('Stack overlay glide, score pop and cargo thumbnails have reduced-motion overrides', () => {
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.stack-active-overlay[\s\S]*?transition:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.stack-overlay-cell[\s\S]*?animation:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.game-score-pop[\s\S]*?animation:\s*none/);
});

test('Yard cell transitions, invalid one-shot flash and tray hint-flash have reduced-motion overrides', () => {
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.yard-cell\s*\{[\s\S]*?transition:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.yard-cell-invalid-flash[\s\S]*?animation:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.yard-tray-piece\.is-hint-flash[\s\S]*?animation:\s*none/);
});

test('the Yard invalid one-shot flash reuses the persistent invalid stripe pattern, not hue alone', () => {
  const persistent = ruleBody('.yard-cell-invalid');
  const flash = ruleBody('.yard-cell-invalid-flash');
  assert.match(persistent, /background-image:\s*repeating-linear-gradient/);
  const stripe = persistent.match(/background-image:\s*(repeating-linear-gradient\([^;]+\))/)[1];
  assert.ok(flash.includes(stripe), 'the one-shot flash reuses the exact stripe pattern');
  assert.match(flash, /animation\s*:\s*games-cell-shake/);
});

test('the Yard ghost preview cues are structural and distinct from each other and the hint cue', () => {
  const valid = ruleBody('.yard-cell.is-ghost-valid');
  assert.match(valid, /outline:\s*3px\s+solid/);
  const invalid = ruleBody('.yard-cell.is-ghost-invalid');
  assert.match(invalid, /outline:\s*3px\s+solid/);
  assert.match(invalid, /background-image:\s*repeating-linear-gradient/,
    'the invalid ghost cue carries the invalid stripe cue, not hue alone');
  assert.notEqual(valid, invalid, 'the valid and invalid ghost cues are distinct rules');
  const hint = ruleBody('.yard-cell.is-hint');
  assert.match(hint, /outline:\s*4px\s+dotted/);
});

test('the hard-drop ghost cue is structural (dashed outline), distinct from the manifest target dash', () => {
  const ghost = ruleBody('.stack-cell.is-ghost');
  assert.match(ghost, /outline:\s*2px\s+dashed/);
  const manifest = ruleBody('.stack-manifest-cell');
  assert.match(manifest, /outline:\s*2px\s+dashed/);
  assert.notEqual(ghost, manifest, 'the ghost cue is a distinct rule from the manifest-target cue');
});

test('the tide edge cue is a positioned bar (structural, not a pure hue shift)', () => {
  const left = ruleBody('.stack-dock.is-tide-left::before');
  const right = ruleBody('.stack-dock.is-tide-right::before');
  assert.match(left, /left:\s*0/);
  assert.match(right, /right:\s*0/);
  for (const body of [left, right]) {
    assert.match(body, /width:/, 'the tide cue is a discrete edge bar, not just a background tint');
    assert.match(body, /position:\s*absolute/);
  }
});

test('cargo thumbnails position every cell by percentage from cell-coordinate custom properties', () => {
  const thumb = ruleBody('.cargo-thumb');
  assert.match(thumb, /aspect-ratio:\s*var\(--cargo-thumb-columns/);
  const cell = ruleBody('.cargo-thumb-cell');
  assert.match(cell, /position:\s*absolute/);
  assert.match(cell, /left:\s*calc\(var\(--cargo-thumb-cell-column/);
  assert.match(cell, /top:\s*calc\(var\(--cargo-thumb-cell-row/);
});

test('every declared animation references a keyframe that actually exists', () => {
  const seen = new Set();
  for (const match of css.matchAll(/animation:\s*([a-zA-Z][\w-]*)/g)) {
    const name = match[1];
    if (name === 'none' || seen.has(name)) continue;
    seen.add(name);
    assert.match(css, new RegExp(`@keyframes\\s+${escaped(name)}\\s*\\{`),
      `animation "${name}" has no matching @keyframes definition`);
  }
  assert.ok(seen.size > 5, 'sanity check: the stylesheet does declare several animations');
});

test('celebration overlay and completion entrance have reduced-motion overrides', () => {
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.game-celebration[\s\S]*?display:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.game-complete[\s\S]*?animation:\s*none/);
});

test('Sudoku cell transition, error shake and celebration bloom have reduced-motion overrides', () => {
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.sudoku-cell\s*\{[\s\S]*?transition:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.sudoku-cell\.is-error[\s\S]*?animation:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.sudoku-cell\.is-celebrating[\s\S]*?animation:\s*none/);
});

test('Crossword cell transition, error shake and celebration bloom have reduced-motion overrides', () => {
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.crossword-cell\s*\{[\s\S]*?transition:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.crossword-cell\.is-error[\s\S]*?animation:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.crossword-cell\.is-celebrating[\s\S]*?animation:\s*none/);
});

test('Word Search cell transition, rejection shake and celebration bloom have reduced-motion overrides', () => {
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.word-search-cell\s*\{[\s\S]*?transition:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.word-search-cell\.is-rejected[\s\S]*?animation:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.word-search-cell\.is-found[\s\S]*?animation:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.word-search-cell\.is-celebrating[\s\S]*?animation:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.word-search-list li\.is-found-item[\s\S]*?transition:\s*none/);
});

test('Word Search rejection cue carries a structural non-colour cue beyond the shake', () => {
  const rejected = ruleBody('.word-search-cell.is-rejected');
  assert.match(rejected, /outline[^;]*:/i, 'the rejection cue carries a structural edge marker, not just a shake');
  assert.match(rejected, /animation\s*:\s*games-cell-shake/);
});

test('Word Search found-word list item carries the strike-through non-colour cue', () => {
  const item = ruleBody('.word-search-list li.is-found-item');
  assert.match(item, /text-decoration\s*:\s*line-through/);
});

test('Word Search found-cell pop animation references a defined keyframe', () => {
  const found = ruleBody('.word-search-cell.is-found');
  const match = found.match(/animation\s*:\s*([\w-]+)/);
  assert.ok(match, 'is-found declares an animation');
  assert.match(css, new RegExp(`@keyframes\\s+${escaped(match[1])}\\s*\\{`), `${match[1]} keyframes must actually be defined`);
});

test('Kinnoki Charts cell transition, error shake and reveal bloom have reduced-motion overrides', () => {
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.charts-cell\s*\{[\s\S]*?transition:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.charts-cell\.is-error[\s\S]*?animation:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.charts-cell\.is-reveal[\s\S]*?animation:\s*none/);
});

test('Kinnoki Charts satisfied clue carries the strike-through non-colour cue, not opacity alone', () => {
  const satisfied = ruleBody('.charts-clue.is-satisfied');
  assert.match(satisfied, /text-decoration\s*:\s*line-through/);
  assert.match(satisfied, /opacity\s*:\s*\.45/);
});

test('Kinnoki Charts is-reveal uses its own bloom-to-gold keyframe, distinct from the shared cell bloom', () => {
  const reveal = ruleBody('.charts-cell.is-reveal');
  const match = reveal.match(/animation\s*:\s*([\w-]+)/);
  assert.ok(match, 'is-reveal declares an animation');
  assert.notEqual(match[1], 'games-cell-bloom', 'the reveal celebration ends filled gold, not back at --surface');
  assert.match(css, new RegExp(`@keyframes\\s+${escaped(match[1])}\\s*\\{`), `${match[1]} keyframes must actually be defined`);
});

test('Crossword active-entry and active-clue states carry non-colour cues', () => {
  const activeEntry = ruleBody('.crossword-cell.is-active-entry');
  assert.match(activeEntry, /background:/, 'the active entry mirrors the sudoku is-related tint pattern');
  assert.match(activeEntry, /(?:box-shadow\s*:\s*inset|outline[^;]*:|border[^;]*:)/i,
    'the active entry carries a structural non-colour cue (edge marker), not just a tint');
  const activeClue = ruleBody('[data-clue].is-active');
  assert.match(activeClue, /border[^;]*:/i, 'the active clue gets a gold hairline');
  assert.match(activeClue, /font-weight\s*:\s*(?:7\d\d|800|900|bold)/i,
    'the active clue also carries a non-colour cue beyond the hairline');
});

for (const theme of [
  { name: 'dark', selector: ':root' },
  { name: 'light', selector: '[data-theme="light"]' },
]) {
  test(`${theme.name} board-frame token meets 3:1 non-text boundary contrast on page and board surfaces`, () => {
    const frame = colorToken(theme.selector, '--game-board-frame');
    for (const name of ['--bg', '--surface', '--surface-2']) {
      const background = colorToken(theme.selector, name);
      const ratio = contrastRatio(frame, background);
      assert.ok(
        ratio >= 3,
        `${theme.name} --game-board-frame ${frame} is ${ratio.toFixed(2)}:1 on ${name} ${background}; expected >= 3:1`,
      );
    }
  });
}

test('board frames carry their boundary with the measured frame token', () => {
  for (const selector of ['.game-board', '.stack-dock', '.yard-board-scroll']) {
    assert.match(ruleBody(selector), /border:\s*1px\s+solid\s+var\(--game-board-frame\)/);
  }
});

const SHARED_CONTROL_SELECTOR = '.game-toolbar button, .game-toolbar select, .game-controls button, '
  + '.sudoku-number-pad button, .word-search-pan button, .stack-controls button, .yard-controls button, '
  + '.yard-pan-controls button, .yard-tray-piece, .difficulty-links a, .charts-controls button, '
  + '.game-audio-controls button, .game-preplay button';

test('shared control feedback rule declares the transition on every game control', () => {
  const body = ruleBody(SHARED_CONTROL_SELECTOR);
  assert.match(body, /transition:\s*border-color[^;]*,\s*background-color[^;]*,\s*transform[^;]*;/);
});

test('audio toggle buttons carry the shared control surface styling, not the native default', () => {
  const body = ruleBody('.game-audio-controls button');
  assert.match(body, /color:\s*var\(--game-text-primary\)/);
  assert.match(body, /background:\s*var\(--surface-2\)/);
  assert.match(body, /border:\s*1px\s+solid\s+var\(--separator\)/);
  assert.match(body, /border-radius:/);
});

test('preplay Start/Continue/Resume buttons carry the shared control surface styling', () => {
  const body = ruleBody('.game-preplay button');
  assert.match(body, /color:\s*var\(--game-text-primary\)/);
  assert.match(body, /background:\s*var\(--surface-2\)/);
  assert.match(body, /border:\s*1px\s+solid\s+var\(--separator\)/);
  assert.match(body, /border-radius:/);
});

test('game-mode-actions pins the mode links to the bottom of the card', () => {
  assert.match(ruleBody('.game-mode-actions'), /margin-top:\s*auto/);
});

test('card entrance, shimmer, dialog motion and shared control transitions have reduced-motion overrides', () => {
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.game-card-grid \.game-card[\s\S]*?animation:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.games-app:empty::before[\s\S]*?animation:\s*none/);
  assert.match(css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?dialog\.game-dialog\[open\][\s\S]*?animation:\s*none/);
  assert.match(css,
    new RegExp(`@media\\s*\\(prefers-reduced-motion:\\s*reduce\\)[\\s\\S]*?${escaped('.game-toolbar button')}[\\s\\S]*?transition:\\s*none`));
});

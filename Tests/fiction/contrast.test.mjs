/* fiction.css adds no colours of its own.

   Tests/listen/contrast.test.mjs already audits the --room-text-* tokens
   against both themes, so the cheapest way to keep the fiction shelf
   accessible is to require it to spend only those tokens rather than
   re-deriving ratios here. The rule earns its keep: the shelf badge
   first shipped as --gold-text, which lands at 4.1:1 on light at 10.5px
   — under AA, and invisible to a token-level audit of listen.css. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../Resources/fiction/fiction.css', import.meta.url), 'utf8');

/* Audited in Tests/listen/contrast.test.mjs, plus --text, which is the
   theme's own foreground and passes by construction. */
const auditedTextTokens = new Set([
  '--room-text-secondary',
  '--room-text-tertiary',
  '--room-text-accent',
  '--room-text-error',
  '--text',
]);

function colorDeclarations() {
  // `color:` but not `background-color:`, `border-color:`, `-color:` …
  return [...css.matchAll(/(?:^|[^-\w])color\s*:\s*([^;]+);/g)].map((match) => match[1].trim());
}

test('every text colour comes from an audited theme token', () => {
  const declarations = colorDeclarations();
  assert.ok(declarations.length > 0, 'expected fiction.css to set text colours');

  for (const value of declarations) {
    const token = value.match(/^var\((--[a-z0-9-]+)\)$/);
    assert.ok(token, `text colour "${value}" must be a bare var() of an audited token`);
    assert.ok(auditedTextTokens.has(token[1]),
      `${token[1]} is not contrast-audited; use one of ${[...auditedTextTokens].join(', ')}`);
  }
});

test('no literal colours are introduced alongside the tokens', () => {
  // color-mix on --gold-500 is fine for borders and fills — it is the
  // shared room hairline treatment — but a raw hex means a colour that
  // no audit covers.
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, 'fiction.css must not hard-code hex colours');
  assert.doesNotMatch(css, /\brgba?\(/, 'fiction.css must not hard-code rgb colours');
});

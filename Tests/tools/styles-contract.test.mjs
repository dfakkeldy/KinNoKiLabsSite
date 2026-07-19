import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../../Resources/styles.css', import.meta.url), 'utf8');

const declarationsFor = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...css.matchAll(new RegExp(`([^{}]*)\\{([^{}]*)\\}`, 'gu'))]
    .filter(([, selectors]) => selectors.split(',').some((value) => value.trim() === selector))
    .map(([, , declarations]) => declarations)
    .join('\n');
};

test('EPUB layout and disclosure selectors implement the binding CSS contract', () => {
  for (const selector of [
    '.epub-library-grid',
    '.epub-book-card',
    '.epub-drop.is-dragover',
    '.epub-reader',
    '.epub-chapter',
    '.epub-reader-controls',
  ]) {
    assert.notEqual(declarationsFor(selector), '', `${selector} must be styled`);
  }
  assert.match(declarationsFor('.epub-toc'), /display\s*:\s*none/u);
  assert.match(declarationsFor('.epub-toc.is-open'), /display\s*:\s*(?:block|grid|flex)/u);
  assert.match(css, /@media[^{}]*\(min-width:\s*640px\)[\s\S]*?\.epub-library-grid\s*\{/u);
});

test('tool and EPUB interactive controls have the 44px touch-target contract', () => {
  for (const selector of [
    '.tool-form input:not([type="checkbox"])',
    '.tool-form textarea',
    '.tool-form select',
    '.tool-form button',
    '.tool-check',
    '.epub-reader-controls button',
    '.epub-reader-controls select',
    '.epub-toc button',
    '.epub-drop',
    '.epub-book-card button',
  ]) {
    assert.match(declarationsFor(selector), /min-height\s*:\s*44px/u, `${selector} needs a 44px target`);
  }
});

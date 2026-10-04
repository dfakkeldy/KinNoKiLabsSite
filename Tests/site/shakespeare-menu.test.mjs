import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

function menuFixture() {
  const listeners = new Map();
  const document = { activeElement: null, addEventListener(type, fn) { listeners.set(type, fn); } };
  function element() {
    const events = new Map(), attributes = new Map();
    return {
      inert: false,
      setAttribute(key, value) { attributes.set(key, String(value)); },
      getAttribute(key) { return attributes.get(key); },
      addEventListener(type, fn) { events.set(type, fn); },
      click() { events.get('click')?.(); },
      focus() { document.activeElement = this; },
    };
  }
  const opener = element(), close = element(), home = element(), font = element();
  const background = [element(), element(), element()];
  const menu = element();
  menu.querySelector = () => close;
  menu.querySelectorAll = (selector) => selector === 'a[href], button' ? [close, home, font] : [close, home];
  document.querySelector = (selector) => selector === '.mobile-menu' ? menu : opener;
  document.querySelectorAll = () => background;
  document.body = { classList: { contains: () => true } };
  const path = new URL('../../Resources/shakespeare.js', import.meta.url);
  assert.ok(existsSync(path), 'The showcase menu enhancement must exist');
  vm.runInNewContext(readFileSync(path, 'utf8'), { document });
  function key(key, shiftKey = false) {
    let prevented = false;
    listeners.get('keydown')?.({ key, shiftKey, preventDefault() { prevented = true; } });
    return prevented;
  }
  return { document, menu, opener, close, home, font, background, key };
}

test('keyboard opening focuses the menu, isolates its background and Escape restores the opener', () => {
  const ui = menuFixture();
  ui.opener.focus();
  ui.opener.click();
  assert.equal(ui.document.activeElement, ui.close);
  assert.ok(ui.background.every((item) => item.inert));
  assert.equal(ui.menu.getAttribute('aria-modal'), 'true');
  assert.equal(ui.opener.getAttribute('aria-expanded'), 'true');
  assert.equal(ui.key('Escape'), true);
  assert.equal(ui.document.activeElement, ui.opener);
  assert.ok(ui.background.every((item) => !item.inert));
  assert.equal(ui.opener.getAttribute('aria-expanded'), 'false');
});

test('Tab wraps only at menu boundaries and closing by its button restores focus', () => {
  const ui = menuFixture();
  ui.opener.click();
  assert.equal(ui.key('Tab', true), true);
  assert.equal(ui.document.activeElement, ui.font);
  assert.equal(ui.key('Tab'), true);
  assert.equal(ui.document.activeElement, ui.close);
  ui.home.focus();
  assert.equal(ui.key('Tab'), false);
  ui.close.click();
  assert.equal(ui.document.activeElement, ui.opener);
});

/* Minimal fake DOM for driving Resources/fiction/fiction.js under node.
   Only the surface fiction.js actually touches is modelled — enough to
   assert what the room renders, not a browser. */

export class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }

  toggle(value, force) {
    const enabled = force === undefined ? !this.values.has(value) : force;
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    return enabled;
  }
}

export class FakeNode {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this._textContent = '';
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.style = { display: '', setProperty() {} };
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.href = '';
    this.src = '';
    this.alt = '';
    this.type = '';
    this.target = '';
    this.rel = '';
    this.loading = '';
    this.decoding = '';
  }

  get className() { return [...this.classList.values].join(' '); }

  set className(value) {
    this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  get textContent() { return this._textContent; }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  /* Text of this node plus everything under it, which is how the caption
     panel and shelf cards actually read on screen. */
  get renderedText() {
    if (this.children.length === 0) return this._textContent;
    return this.children.map((child) => child.renderedText).join('');
  }

  get firstChild() { return this.children[0] || null; }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) listener({ type, target: this });
  }

  closest() { return null; }
}

export function descendants(node, predicate) {
  const matches = [];
  for (const child of node.children) {
    if (predicate(child)) matches.push(child);
    matches.push(...descendants(child, predicate));
  }
  return matches;
}

export async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

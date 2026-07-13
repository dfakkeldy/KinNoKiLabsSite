class ClassList {
  constructor(element) { this.element = element; }
  values() { return this.element.className.split(/\s+/).filter(Boolean); }
  contains(value) { return this.values().includes(value); }
  add(...values) { this.element.className = [...new Set([...this.values(), ...values])].join(' '); }
  remove(...values) { this.element.className = this.values().filter((value) => !values.includes(value)).join(' '); }
  toggle(value, force) {
    const enabled = force ?? !this.contains(value);
    if (enabled) this.add(value); else this.remove(value);
    return enabled;
  }
}

const selectorParts = (selector) => selector.trim().split(/\s+/);

function matchesSimple(element, selector) {
  const attributes = [...selector.matchAll(/\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]/g)];
  const withoutAttributes = selector.replace(/\[[^\]]+\]/g, '');
  const id = withoutAttributes.match(/#([\w-]+)/)?.[1];
  const classes = [...withoutAttributes.matchAll(/\.([\w-]+)/g)].map((match) => match[1]);
  const tag = withoutAttributes.match(/^[\w-]+/)?.[0];
  if (tag && element.tagName !== tag.toUpperCase()) return false;
  if (id && element.id !== id) return false;
  if (classes.some((name) => !element.classList.contains(name))) return false;
  return attributes.every(([, name, value]) => (
    element.hasAttribute(name) && (value === undefined || element.getAttribute(name) === value)
  ));
}

function matchesSelector(element, selector) {
  const parts = selectorParts(selector);
  if (!matchesSimple(element, parts.at(-1))) return false;
  let ancestor = element.parentNode;
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    while (ancestor && !matchesSimple(ancestor, parts[index])) ancestor = ancestor.parentNode;
    if (!ancestor) return false;
    ancestor = ancestor.parentNode;
  }
  return true;
}

export class FixtureEvent {
  constructor(type, options = {}) {
    Object.assign(this, options);
    this.type = type;
    this.bubbles = options.bubbles ?? true;
    this.defaultPrevented = false;
  }
  preventDefault() { this.defaultPrevented = true; }
}

export class FixtureElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = '';
    this.classList = new ClassList(this);
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.scrollLeft = 0;
    this.clientWidth = 320;
    this.scrollWidth = 704;
    this.capturedPointers = new Set();
    this._textContent = '';
  }
  set id(value) { this.setAttribute('id', value); }
  get id() { return this.getAttribute('id') ?? ''; }
  set textContent(value) {
    if (this.contains(this.ownerDocument.activeElement)) this.ownerDocument.activeElement = null;
    this._textContent = String(value ?? ''); this.children = [];
  }
  get textContent() { return this._textContent + this.children.map((child) => child.textContent).join(''); }
  set innerHTML(value) { if (value !== '') throw new Error('Fixture only supports clearing innerHTML'); this.textContent = ''; }
  get innerHTML() { return this.textContent; }
  append(...children) {
    for (const child of children.flat()) {
      if (typeof child !== 'object' || child == null) this._textContent += String(child);
      else { child.parentNode = this; this.children.push(child); }
    }
  }
  appendChild(child) { this.append(child); return child; }
  replaceChildren(...children) {
    if (this.contains(this.ownerDocument.activeElement)) this.ownerDocument.activeElement = null;
    this._textContent = ''; this.children = []; this.append(...children);
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.className = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
  }
  getAttribute(name) { return name === 'class' ? this.className || null : this.attributes.get(name) ?? null; }
  hasAttribute(name) { return name === 'class' ? Boolean(this.className) : this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener); this.listeners.set(type, listeners);
  }
  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    for (const listener of this.listeners.get(event.type) ?? []) listener.call(this, event);
    if (event.bubbles && this.parentNode) this.parentNode.dispatchEvent(event);
    return !event.defaultPrevented;
  }
  click() { this.dispatchEvent(new FixtureEvent('click')); }
  focus() { this.ownerDocument.activeElement = this; this.dispatchEvent(new FixtureEvent('focus', { bubbles: false })); }
  setPointerCapture(pointerId) { this.capturedPointers.add(pointerId); }
  releasePointerCapture(pointerId) { this.capturedPointers.delete(pointerId); }
  hasPointerCapture(pointerId) { return this.capturedPointers.has(pointerId); }
  contains(node) {
    if (!node) return false;
    if (node === this) return true;
    return this.children.some((child) => child.contains(node));
  }
  scrollBy(options) {
    const left = typeof options === 'number' ? options : options?.left ?? 0;
    this.scrollLeft = Math.max(0, Math.min(this.scrollWidth - this.clientWidth, this.scrollLeft + left));
    this.dispatchEvent(new FixtureEvent('scroll', { bubbles: false }));
  }
  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (matchesSelector(child, selector)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

export function createDOMFixture({ search = '?difficulty=easy', confirm = true } = {}) {
  const listeners = new Map();
  const windowListeners = new Map();
  const intervals = new Map();
  const frames = new Map();
  let nextInterval = 1;
  let nextFrame = 1;
  let hitTarget = null;
  const document = {
    activeElement: null,
    visibilityState: 'visible',
    createElement(tag) { return new FixtureElement(tag, document); },
    addEventListener(type, listener) { listeners.set(type, [...(listeners.get(type) ?? []), listener]); },
    removeEventListener(type, listener) { listeners.set(type, (listeners.get(type) ?? []).filter((value) => value !== listener)); },
    dispatchEvent(event) { for (const listener of listeners.get(event.type) ?? []) listener(event); },
    elementFromPoint() { return hitTarget; },
    listenerCount(type) { return (listeners.get(type) ?? []).length; },
    setHitTarget(target) { hitTarget = target; },
  };
  document.body = document.createElement('body');
  document.querySelector = (...args) => document.body.querySelector(...args);
  document.querySelectorAll = (...args) => document.body.querySelectorAll(...args);
  const root = document.createElement('main');
  root.id = 'games-app';
  document.body.append(root);
  const values = new Map();
  const localStorage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const location = { search, href: '' };
  const window = {
    document, localStorage, location, confirm: () => confirm,
    requestAnimationFrame(callback) {
      const id = nextFrame; nextFrame += 1; frames.set(id, callback); return id;
    },
    cancelAnimationFrame(id) { frames.delete(id); },
    addEventListener(type, listener) { windowListeners.set(type, [...(windowListeners.get(type) ?? []), listener]); },
    removeEventListener(type, listener) { windowListeners.set(type, (windowListeners.get(type) ?? []).filter((value) => value !== listener)); },
    dispatchEvent(event) { for (const listener of windowListeners.get(event.type) ?? []) listener(event); },
    listenerCount(type) { return (windowListeners.get(type) ?? []).length; },
    setInterval(callback) { const id = nextInterval; nextInterval += 1; intervals.set(id, callback); return id; },
    clearInterval(id) { intervals.delete(id); },
  };
  return {
    document, window, root, localStorage, location, Event: FixtureEvent,
    activeIntervalCount: () => intervals.size,
    tickIntervals: () => [...intervals.values()].forEach((callback) => callback()),
    activeFrameCount: () => frames.size,
    tickFrames(timestamp) {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(timestamp);
    },
  };
}

export function installDOM(fixture) {
  const keys = [
    'document', 'window', 'localStorage', 'location', 'Event', 'setInterval', 'clearInterval',
    'requestAnimationFrame', 'cancelAnimationFrame',
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, fixture.window, {
    window: fixture.window, Event: FixtureEvent,
    setInterval: fixture.window.setInterval, clearInterval: fixture.window.clearInterval,
    requestAnimationFrame: fixture.window.requestAnimationFrame,
    cancelAnimationFrame: fixture.window.cancelAnimationFrame,
  });
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  };
}

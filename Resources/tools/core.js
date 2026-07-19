export function element(tag, attrs = {}, ...children) {
  const doc = attrs.ownerDocument ?? document;
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'ownerDocument') continue;
    if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

export function safeLocalStorage(scope = globalThis) {
  try {
    const storage = scope.localStorage;
    const probe = '__kinnoki_tools_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch { return null; }
}

const PREFS_KEY = 'kinnoki-tools:v1';
const emptyPrefs = () => ({ version: 1, tools: {} });

export function openToolPrefs(storage) {
  if (!storage) return emptyPrefs();
  try {
    const parsed = JSON.parse(storage.getItem(PREFS_KEY) ?? '');
    if (parsed?.version === 1 && typeof parsed.tools === 'object' && parsed.tools !== null) return parsed;
  } catch { /* fall through */ }
  return emptyPrefs();
}

export function saveToolPrefs(storage, prefs) {
  if (!storage) return false;
  try { storage.setItem(PREFS_KEY, JSON.stringify(prefs)); return true; } catch { return false; }
}

export function toolPrefs(prefs, toolId) { return prefs.tools[toolId] ?? {}; }

export function setToolPrefs(storage, prefs, toolId, bag) {
  const next = { ...prefs, tools: { ...prefs.tools, [toolId]: { ...toolPrefs(prefs, toolId), ...bag } } };
  saveToolPrefs(storage, next);
  return next;
}

export function parseDecimal(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const text = String(raw).trim().replace(/\s+/g, '');
  if (!text) return null;
  const normalized = text.includes(',') && !text.includes('.') ? text.replace(',', '.') : text;
  if (!/^-?\d*\.?\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function formatNumber(value, maxDecimals = 2) {
  if (!Number.isFinite(value)) return '—';
  return String(Number(value.toFixed(maxDecimals)));
}

export function createAnnouncer(liveRegion) {
  return (text) => { if (liveRegion) liveRegion.textContent = text; };
}

export function toolShell(root, { title, lede }) {
  const doc = root.ownerDocument ?? document;
  root.replaceChildren();
  const body = element('section', { class: 'tool-body', ownerDocument: doc });
  root.append(
    element('header', { class: 'tool-shell', ownerDocument: doc },
      element('h1', { text: title, ownerDocument: doc }),
      element('p', { class: 'tool-lede', text: lede, ownerDocument: doc }),
      element('p', { class: 'tool-privacy', text: 'Runs entirely in your browser. Nothing you enter leaves this device.', ownerDocument: doc }),
      element('div', { class: 'tool-connectivity-status', 'data-tool-connectivity': '', ownerDocument: doc })),
    body);
  return body;
}

export async function copyText(text, clipboard = globalThis.navigator?.clipboard) {
  try { await clipboard.writeText(text); return true; } catch { return false; }
}

export function watchConnectivity(target, onChange) {
  const notify = () => onChange(target.navigator ? target.navigator.onLine !== false : true);
  target.addEventListener('online', notify);
  target.addEventListener('offline', notify);
  notify();
  return () => { target.removeEventListener('online', notify); target.removeEventListener('offline', notify); };
}

export function updateToolsConnectivity(root, isOnline) {
  const slot = root?.querySelector?.('[data-tool-connectivity]');
  if (!slot) return;
  const current = slot.querySelector('.tool-offline-chip');
  if (isOnline) {
    current?.remove();
    return;
  }
  if (current) return;
  const doc = root.ownerDocument ?? document;
  slot.append(element('span', {
    class: 'tool-offline-chip',
    role: 'status',
    text: 'Offline — everything here still works',
    ownerDocument: doc,
  }));
}

export function registerToolsServiceWorker(container = globalThis.navigator?.serviceWorker) {
  if (!container?.register) return;
  container.register('/tools/sw.js', { scope: '/tools/' }).catch(() => {});
}

import { element } from './core.js';

export const TOOLS = Object.freeze([
  Object.freeze({ id: 'qr-code', title: 'QR Code Generator', tagline: 'Text or link in, crisp SVG out.', href: '/tools/qr-code' }),
  Object.freeze({ id: 'epub-reader', title: 'EPUB Reader', tagline: 'Read your own books, kept on this device.', href: '/tools/epub-reader' }),
  Object.freeze({ id: 'dilution', title: 'Dilution Calculator', tagline: 'Concentrate + water, without the algebra.', href: '/tools/dilution' }),
  Object.freeze({ id: 'contrast', title: 'Contrast Checker', tagline: 'WCAG verdicts with fix suggestions.', href: '/tools/contrast' }),
  Object.freeze({ id: 'word-count', title: 'Word Counter', tagline: 'Counts plus reading and narration time.', href: '/tools/word-count' }),
  Object.freeze({ id: 'unit-converter', title: 'Unit Converter', tagline: 'Length to data sizes, converted live.', href: '/tools/unit-converter' }),
  Object.freeze({ id: 'passphrase', title: 'Passphrase Generator', tagline: 'Strong passphrases, generated locally.', href: '/tools/passphrase' }),
]);

export function renderToolsHub(root) {
  const doc = root.ownerDocument ?? document;
  root.replaceChildren();
  const cards = TOOLS.map((tool) => element('article', { class: 'tool-card', ownerDocument: doc },
    element('h2', { ownerDocument: doc }, element('a', { href: tool.href, text: tool.title, ownerDocument: doc })),
    element('p', { text: tool.tagline, ownerDocument: doc })));
  root.append(
    element('header', { class: 'tool-shell', ownerDocument: doc },
      element('h1', { text: 'Web tools', ownerDocument: doc }),
      element('p', { class: 'tool-lede', text: 'Small, fast utilities. They load once, work offline, and keep everything on your device.', ownerDocument: doc }),
      element('div', { class: 'tool-connectivity-status', 'data-tool-connectivity': '', ownerDocument: doc })),
    element('div', { class: 'tool-hub-grid', ownerDocument: doc }, ...cards)
  );
}

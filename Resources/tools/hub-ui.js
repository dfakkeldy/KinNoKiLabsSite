import { element } from './core.js';

export const TOOLS = Object.freeze([
  Object.freeze({ id: 'qr-code', title: 'QR Code Generator', tagline: 'Text or link in, crisp SVG out.', href: '/tools/qr-code' }),
  Object.freeze({ id: 'epub-reader', title: 'EPUB Reader', tagline: 'Your own books, kept on this device.', href: '/tools/epub-reader' }),
  Object.freeze({ id: 'dilution', title: 'Dilution Calculator', tagline: 'Mix ratios without the algebra.', href: '/tools/dilution' }),
  Object.freeze({ id: 'contrast', title: 'Contrast Checker', tagline: 'WCAG verdicts with fix suggestions.', href: '/tools/contrast' }),
  Object.freeze({ id: 'word-count', title: 'Word Counter', tagline: 'Counts plus read-aloud time.', href: '/tools/word-count' }),
  Object.freeze({ id: 'unit-converter', title: 'Unit Converter', tagline: 'Length to data sizes, converted live.', href: '/tools/unit-converter' }),
  Object.freeze({ id: 'click-counter', title: 'Click Counter', tagline: 'Scale a number to 60 whole clicks.', href: '/tools/click-counter' }),
  Object.freeze({ id: 'passphrase', title: 'Passphrase Generator', tagline: 'Strong passphrases, generated locally.', href: '/tools/passphrase' }),
  Object.freeze({ id: 'turn-timer', title: 'Turn Timer', tagline: 'Visual turns, routines, countdowns.', href: '/tools/turn-timer/' }),
]);

export function renderToolsHub(root) {
  const doc = root.ownerDocument ?? document;
  root.replaceChildren();
  // data-tool picks each card's glyph in styles.css (a CSS mask, so the
  // markup stays text-only and the glyph follows the theme's gold).
  const cards = TOOLS.map((tool) => element('article', { class: 'tool-card', 'data-tool': tool.id, ownerDocument: doc },
    element('h2', { ownerDocument: doc }, element('a', { href: tool.href, text: tool.title, ownerDocument: doc })),
    element('p', { text: tool.tagline, ownerDocument: doc })));
  root.append(
    element('header', { class: 'tool-shell', ownerDocument: doc },
      element('p', { class: 'eyebrow', text: 'Tools', ownerDocument: doc }),
      element('h1', { text: 'Web tools', ownerDocument: doc }),
      element('p', { class: 'tool-lede', text: 'Small, fast utilities. They load once and keep working offline.', ownerDocument: doc }),
      element('div', { class: 'tool-connectivity-status', 'data-tool-connectivity': '', ownerDocument: doc })),
    element('div', { class: 'tool-hub-grid', ownerDocument: doc }, ...cards),
    element('p', { class: 'eyebrow tool-live-eyebrow', text: 'Live data', ownerDocument: doc }),
    element('section', { class: 'tool-live-data', 'data-tool': 'gas', ownerDocument: doc },
      element('h2', { ownerDocument: doc }, element('a', { href: '/gas/', text: 'Gas Price Watch', ownerDocument: doc })),
      element('p', { text: 'Official Nova Scotia gasoline prices and experimental rolling estimates.', ownerDocument: doc }),
      element('span', { class: 'tool-online-chip', text: 'Needs a connection for the latest prices', ownerDocument: doc }))
  );
}

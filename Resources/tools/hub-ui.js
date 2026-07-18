const el = (doc, tag, attrs = {}, ...children) => {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
};

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
  while (root.firstChild) root.firstChild.remove();
  const cards = TOOLS.map((tool) => el(doc, 'article', { class: 'tool-card' },
    el(doc, 'h2', {}, el(doc, 'a', { href: tool.href, text: tool.title })),
    el(doc, 'p', { text: tool.tagline })));
  root.append(
    el(doc, 'header', { class: 'tool-shell' },
      el(doc, 'h1', { text: 'Web tools' }),
      el(doc, 'p', { class: 'tool-lede', text: 'Small, fast utilities. They load once, work offline, and keep everything on your device.' })),
    el(doc, 'div', { class: 'tool-hub-grid' }, ...cards)
  );
}

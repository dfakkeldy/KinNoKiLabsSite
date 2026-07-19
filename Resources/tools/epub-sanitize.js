const ALLOWED_TAGS = new Set([
  'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'em', 'strong', 'i', 'b', 'u', 'small', 'sub', 'sup', 'br', 'hr',
  'img', 'figure', 'figcaption', 'blockquote', 'ul', 'ol', 'li',
  'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
  'a', 'section', 'article', 'aside', 'header', 'footer', 'pre', 'code',
  'cite', 'q', 'abbr', 'time',
]);

const DROPPED_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
  'link', 'meta', 'video', 'audio', 'svg', 'math', 'base', 'canvas', 'template',
  'noscript', 'picture', 'source', 'track', 'select', 'option', 'textarea',
  'frame', 'frameset', 'portal',
]);

const VOID_TAGS = new Set(['br', 'hr', 'img']);
const MAX_NODES = 10_000;
const MAX_DEPTH = 128;
const MAX_TEXT_LENGTH = 262_144;
const MAX_REFERENCE_LENGTH = 2_048;

const append = (parent, child) => {
  if (typeof parent.append === 'function') parent.append(child);
  else parent.appendChild(child);
};

const childIterator = (node) => {
  const children = node?.childNodes;
  if (typeof children?.[Symbol.iterator] === 'function') {
    return children[Symbol.iterator]();
  }
  let index = 0;
  return {
    next() {
      if (!children || index >= children.length) return { done: true };
      const value = children[index];
      index += 1;
      return { done: false, value };
    },
  };
};

const safeId = (value) => (
  typeof value === 'string'
  && value.length > 0
  && value.length <= 128
  && !/[\u0000-\u0020\u007f]/u.test(value)
);

const safeAlt = (value) => (
  typeof value === 'string'
  && value.length <= 512
  && !/[\u0000\u007f]/u.test(value)
);

const safeSpan = (value, maximum) => {
  if (typeof value !== 'string' || !/^[1-9]\d*$/u.test(value)) return false;
  return Number(value) <= maximum;
};

const safeReference = (value, { allowHttp = false } = {}) => {
  if (typeof value !== 'string') return null;
  const reference = value.trim();
  if (
    reference.length === 0
    || reference.length > MAX_REFERENCE_LENGTH
    || /[\u0000-\u001f\u007f]/u.test(reference)
    || reference.startsWith('//')
  ) return null;

  const scheme = reference.match(/^([a-z][a-z\d+.-]*):/iu)?.[1]?.toLowerCase();
  if (scheme && !(allowHttp && (scheme === 'http' || scheme === 'https'))) {
    return null;
  }
  return reference;
};

const safeBlobUrl = (value) => (
  typeof value === 'string'
  && value.length <= MAX_REFERENCE_LENGTH
  && /^blob:/iu.test(value)
  && !/[\u0000-\u0020\u007f]/u.test(value)
);

const safeExternalUrl = (value) => {
  if (typeof value !== 'string' || value.length > MAX_REFERENCE_LENGTH) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && !/[\u0000-\u0020\u007f]/u.test(value);
  } catch {
    return false;
  }
};

const safeSpineHref = (value) => (
  typeof value === 'string'
  && value.length > 0
  && value.length <= MAX_REFERENCE_LENGTH
  && !/[\u0000-\u0020\u007f]/u.test(value)
  && !value.startsWith('//')
  && !/^[a-z][a-z\d+.-]*:/iu.test(value)
);

const resolvedImage = (source, resolveImage) => {
  const reference = safeReference(source.getAttribute('src'));
  if (!reference) return null;
  try {
    const result = resolveImage(reference);
    return safeBlobUrl(result) ? result : null;
  } catch {
    return null;
  }
};

const resolvedLink = (source, resolveLink) => {
  const reference = safeReference(source.getAttribute('href'), { allowHttp: true });
  if (!reference) return null;
  try {
    const result = resolveLink(reference);
    if (result?.external === true && safeExternalUrl(result.href)) {
      return { href: result.href, target: '_blank', rel: 'noopener' };
    }
    if (safeSpineHref(result?.spineHref)) {
      return { 'data-spine-href': result.spineHref };
    }
  } catch {
    return null;
  }
  return null;
};

const copyAttributes = (source, output, tagName) => {
  const id = source.getAttribute('id');
  if (safeId(id)) output.setAttribute('id', id);

  if (tagName === 'img') {
    const alt = source.getAttribute('alt');
    if (safeAlt(alt)) output.setAttribute('alt', alt);
  }
  if (tagName === 'td' || tagName === 'th') {
    const colspan = source.getAttribute('colspan');
    const rowspan = source.getAttribute('rowspan');
    if (safeSpan(colspan, 1_000)) output.setAttribute('colspan', colspan);
    if (safeSpan(rowspan, 65_534)) output.setAttribute('rowspan', rowspan);
  }
};

export function sanitizeChapter(sourceRoot, {
  createElement,
  createTextNode,
  resolveImage,
  resolveLink,
}) {
  const outputRoot = createElement('div');
  const stack = [{ iterator: childIterator(sourceRoot), parent: outputRoot, depth: 1 }];
  let visited = 0;
  let textLength = 0;

  while (stack.length > 0 && visited < MAX_NODES) {
    const frame = stack.at(-1);
    const next = frame.iterator.next();
    if (next.done) {
      stack.pop();
      continue;
    }

    const { parent, depth } = frame;
    const source = next.value;
    visited += 1;
    if (!source || depth > MAX_DEPTH) continue;

    if (source.nodeType === 3) {
      const value = String(source.textContent ?? '');
      const remaining = MAX_TEXT_LENGTH - textLength;
      if (remaining <= 0) continue;
      const bounded = value.slice(0, remaining);
      textLength += bounded.length;
      append(parent, createTextNode(bounded));
      continue;
    }
    if (source.nodeType !== 1) continue;

    const tagName = String(source.tagName ?? '').toLowerCase();
    if (DROPPED_TAGS.has(tagName)) continue;
    if (!ALLOWED_TAGS.has(tagName)) {
      if (depth < MAX_DEPTH) {
        stack.push({ iterator: childIterator(source), parent, depth: depth + 1 });
      }
      continue;
    }

    if (tagName === 'img') {
      const src = resolvedImage(source, resolveImage);
      if (!src) continue;
      const image = createElement('img');
      image.setAttribute('src', src);
      copyAttributes(source, image, tagName);
      append(parent, image);
      continue;
    }

    if (tagName === 'a') {
      const linkAttributes = resolvedLink(source, resolveLink);
      if (!linkAttributes) {
        if (depth < MAX_DEPTH) {
          stack.push({ iterator: childIterator(source), parent, depth: depth + 1 });
        }
        continue;
      }
      const link = createElement('a');
      copyAttributes(source, link, tagName);
      for (const [name, value] of Object.entries(linkAttributes)) {
        link.setAttribute(name, value);
      }
      append(parent, link);
      if (depth < MAX_DEPTH) {
        stack.push({ iterator: childIterator(source), parent: link, depth: depth + 1 });
      }
      continue;
    }

    const output = createElement(tagName);
    copyAttributes(source, output, tagName);
    append(parent, output);
    if (!VOID_TAGS.has(tagName) && depth < MAX_DEPTH) {
      stack.push({ iterator: childIterator(source), parent: output, depth: depth + 1 });
    }
  }

  return outputRoot;
}

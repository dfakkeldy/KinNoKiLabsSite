import { localName, parseXml } from './epub-xml.js';

const CONTAINER_NAMESPACE = 'urn:oasis:names:tc:opendocument:xmlns:container';
const DC_NAMESPACE = 'http://purl.org/dc/elements/1.1/';
const NCX_NAMESPACE = 'http://www.daisy.org/z3986/2005/ncx/';
const OPF_NAMESPACE = 'http://www.idpf.org/2007/opf';
const OPS_NAMESPACE = 'http://www.idpf.org/2007/ops';
const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function pathError() {
  return codedError('bad-path', 'Unsafe EPUB path');
}

function decodedSegments(rawPath) {
  if (typeof rawPath !== 'string' || !rawPath || rawPath.startsWith('/') || rawPath.includes('\\')) {
    throw pathError();
  }

  const segments = rawPath.split('/');
  const decoded = segments.map((segment) => {
    let value;
    try {
      value = decodeURIComponent(segment);
    } catch {
      throw pathError();
    }

    if (value.includes('/') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) {
      throw pathError();
    }
    if ((value === '.' || value === '..') && segment !== value) throw pathError();
    return value;
  });

  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(decoded[0] ?? '')) throw pathError();
  return decoded;
}

function normalizeRootPath(path) {
  const parts = [];
  for (const segment of decodedSegments(path)) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (parts.length === 0) throw pathError();
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  if (parts.length === 0) throw pathError();
  return parts.join('/');
}

export function resolveZipPath(baseFile, relative) {
  const cleanBase = normalizeRootPath(baseFile);
  // v1 TOC navigation intentionally drops URL fragments and lands at chapter top.
  const withoutFragment = typeof relative === 'string'
    ? relative.split('#', 1)[0].split('?', 1)[0]
    : relative;
  const baseParts = cleanBase.split('/');
  baseParts.pop();

  for (const segment of decodedSegments(withoutFragment)) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (baseParts.length === 0) throw pathError();
      baseParts.pop();
    } else {
      baseParts.push(segment);
    }
  }

  if (baseParts.length === 0) throw pathError();
  return baseParts.join('/');
}

function tokens(value) {
  return String(value ?? '').trim().split(/\s+/).filter(Boolean);
}

function normalizedText(node) {
  return node?.text?.replace(/\s+/g, ' ').trim() ?? '';
}

function namespaceIndex(root) {
  const scopes = new WeakMap();

  function visit(node, parent) {
    const declarations = new Map();
    for (const [name, value] of Object.entries(node.attrs)) {
      if (name === 'xmlns') declarations.set('', value);
      else if (name.startsWith('xmlns:')) declarations.set(name.slice(6), value);
    }
    const scope = { declarations, parent };
    scopes.set(node, scope);
    for (const child of node.children) visit(child, scope);
  }

  function resolve(scope, prefix) {
    for (let current = scope; current; current = current.parent) {
      if (current.declarations.has(prefix)) return current.declarations.get(prefix);
    }
    return null;
  }

  visit(root, null);
  return {
    uri(node, name, attribute = false) {
      const separator = name.indexOf(':');
      if (separator === -1) return attribute ? null : resolve(scopes.get(node), '');
      return resolve(scopes.get(node), name.slice(0, separator));
    },
  };
}

function isElement(node, local, namespace, namespaces) {
  return Boolean(node) && localName(node.name) === local &&
    namespaces.uri(node, node.name) === namespace;
}

function descendants(node, local, namespace, namespaces) {
  const matches = [];
  for (const child of node?.children ?? []) {
    if (isElement(child, local, namespace, namespaces)) matches.push(child);
    matches.push(...descendants(child, local, namespace, namespaces));
  }
  return matches;
}

function firstDescendant(node, local, namespace, namespaces) {
  for (const child of node?.children ?? []) {
    if (isElement(child, local, namespace, namespaces)) return child;
    const match = firstDescendant(child, local, namespace, namespaces);
    if (match) return match;
  }
  return null;
}

function directChildren(node, local, namespace, namespaces) {
  return (node?.children ?? []).filter(
    (child) => isElement(child, local, namespace, namespaces),
  );
}

function nodesIncludingRoot(root, local, namespace, namespaces) {
  const nested = descendants(root, local, namespace, namespaces);
  return isElement(root, local, namespace, namespaces) ? [root, ...nested] : nested;
}

function namespacedAttribute(node, local, namespace, namespaces) {
  for (const [name, value] of Object.entries(node.attrs)) {
    if (localName(name) === local && namespaces.uri(node, name, true) === namespace) {
      return value;
    }
  }
  return null;
}

export function parseContainer(xmlText) {
  try {
    const root = parseXml(xmlText);
    const namespaces = namespaceIndex(root);
    if (!isElement(root, 'container', CONTAINER_NAMESPACE, namespaces)) throw pathError();
    for (const rootfile of descendants(
      root,
      'rootfile',
      CONTAINER_NAMESPACE,
      namespaces,
    )) {
      const fullPath = rootfile.attrs['full-path'];
      if (!fullPath || fullPath.includes('#') || fullPath.includes('?')) continue;
      return normalizeRootPath(fullPath);
    }
  } catch {
    // Container errors deliberately expose one stable boundary to the reader UI.
  }
  throw codedError('bad-container', 'Invalid EPUB container');
}

export function parsePackage(opfText, opfPath) {
  let root;
  let packagePath;
  let namespaces;
  try {
    packagePath = normalizeRootPath(opfPath);
    root = parseXml(opfText);
    namespaces = namespaceIndex(root);
    if (!isElement(root, 'package', OPF_NAMESPACE, namespaces)) throw pathError();
  } catch {
    throw codedError('bad-package', 'Invalid EPUB package');
  }

  const metadata = directChildren(root, 'metadata', OPF_NAMESPACE, namespaces)[0];
  const title = normalizedText(
    firstDescendant(metadata, 'title', DC_NAMESPACE, namespaces),
  ) || 'Untitled';
  const author = normalizedText(
    firstDescendant(metadata, 'creator', DC_NAMESPACE, namespaces),
  ) || 'Unknown author';
  const manifestNode = directChildren(root, 'manifest', OPF_NAMESPACE, namespaces)[0];
  const spineNode = directChildren(root, 'spine', OPF_NAMESPACE, namespaces)[0];
  if (!manifestNode || !spineNode) {
    throw codedError('bad-package', 'Invalid EPUB package');
  }
  const manifest = new Map();

  for (const item of directChildren(manifestNode, 'item', OPF_NAMESPACE, namespaces)) {
    const id = item.attrs.id;
    const rawHref = item.attrs.href;
    if (!id || !rawHref || manifest.has(id)) continue;
    try {
      manifest.set(id, {
        href: resolveZipPath(packagePath, rawHref),
        mediaType: item.attrs['media-type'] ?? '',
        properties: item.attrs.properties ?? '',
      });
    } catch {
      // A bad entry cannot be allowed to escape the ZIP root; other entries remain usable.
    }
  }

  const spine = [];
  const seenIdrefs = new Set();
  for (const itemref of directChildren(spineNode, 'itemref', OPF_NAMESPACE, namespaces)) {
    const idref = itemref.attrs.idref;
    const item = manifest.get(idref);
    if (!idref || !item) throw codedError('bad-package', 'Invalid EPUB package');
    if (seenIdrefs.has(idref)) continue;
    seenIdrefs.add(idref);
    spine.push({ idref, href: item.href, mediaType: item.mediaType });
  }
  if (spine.length === 0) throw codedError('bad-package', 'Invalid EPUB package');

  let coverHref = null;
  let navHref = null;
  for (const item of manifest.values()) {
    const properties = tokens(item.properties);
    if (!coverHref && properties.includes('cover-image')) coverHref = item.href;
    if (!navHref && properties.includes('nav')) navHref = item.href;
  }

  if (!coverHref) {
    const coverMeta = descendants(metadata, 'meta', OPF_NAMESPACE, namespaces).find(
      (node) => String(node.attrs.name ?? '').toLowerCase() === 'cover',
    );
    coverHref = manifest.get(coverMeta?.attrs.content)?.href ?? null;
  }

  const ncxHref = manifest.get(spineNode?.attrs.toc)?.href ?? null;
  return { title, author, coverHref, spine, manifest, navHref, ncxHref };
}

function tocHref(tocPath, rawHref) {
  try {
    return resolveZipPath(tocPath, rawHref);
  } catch {
    return null;
  }
}

export function parseToc(xmlText, tocPath, kind) {
  if (kind !== 'nav' && kind !== 'ncx') return [];

  let root;
  let namespaces;
  try {
    root = parseXml(xmlText);
    namespaces = namespaceIndex(root);
    normalizeRootPath(tocPath);
  } catch {
    return [];
  }

  if (kind === 'nav') {
    if (!isElement(root, 'html', XHTML_NAMESPACE, namespaces)) return [];
    const navs = nodesIncludingRoot(root, 'nav', XHTML_NAMESPACE, namespaces);
    const tocNav = navs.find((node) => tokens(
      namespacedAttribute(node, 'type', OPS_NAMESPACE, namespaces),
    ).includes('toc'));
    if (!tocNav) return [];

    return descendants(tocNav, 'a', XHTML_NAMESPACE, namespaces).flatMap((anchor) => {
      const label = normalizedText(anchor);
      const href = tocHref(tocPath, anchor.attrs.href);
      return label && href ? [{ label, href }] : [];
    });
  }

  if (!isElement(root, 'ncx', NCX_NAMESPACE, namespaces)) return [];
  return nodesIncludingRoot(root, 'navPoint', NCX_NAMESPACE, namespaces).flatMap((navPoint) => {
    const labelNode = directChildren(navPoint, 'navLabel', NCX_NAMESPACE, namespaces)[0];
    const textNode = firstDescendant(labelNode, 'text', NCX_NAMESPACE, namespaces);
    const contentNode = directChildren(navPoint, 'content', NCX_NAMESPACE, namespaces)[0];
    const label = normalizedText(textNode ?? labelNode);
    const href = tocHref(tocPath, contentNode?.attrs.src);
    return label && href ? [{ label, href }] : [];
  });
}

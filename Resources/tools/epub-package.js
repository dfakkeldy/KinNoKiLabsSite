import { findAll, findFirst, localName, parseXml } from './epub-xml.js';

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

function directChildren(node, local) {
  return (node?.children ?? []).filter((child) => localName(child.name) === local);
}

function tokens(value) {
  return String(value ?? '').trim().split(/\s+/).filter(Boolean);
}

function normalizedText(node) {
  return node?.text?.replace(/\s+/g, ' ').trim() ?? '';
}

export function parseContainer(xmlText) {
  try {
    const root = parseXml(xmlText);
    if (localName(root.name) !== 'container') throw pathError();
    for (const rootfile of findAll(root, 'rootfile')) {
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
  try {
    packagePath = normalizeRootPath(opfPath);
    root = parseXml(opfText);
    if (localName(root.name) !== 'package') throw pathError();
  } catch {
    throw codedError('bad-package', 'Invalid EPUB package');
  }

  const metadata = findFirst(root, 'metadata');
  const title = normalizedText(findFirst(metadata, 'title')) || 'Untitled';
  const author = normalizedText(findFirst(metadata, 'creator')) || 'Unknown author';
  const manifestNode = findFirst(root, 'manifest');
  const manifest = new Map();

  for (const item of directChildren(manifestNode, 'item')) {
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

  const spineNode = findFirst(root, 'spine');
  const spine = [];
  for (const itemref of directChildren(spineNode, 'itemref')) {
    const idref = itemref.attrs.idref;
    const item = manifest.get(idref);
    if (!item) continue;
    spine.push({ idref, href: item.href, mediaType: item.mediaType });
  }

  let coverHref = null;
  let navHref = null;
  for (const item of manifest.values()) {
    const properties = tokens(item.properties);
    if (!coverHref && properties.includes('cover-image')) coverHref = item.href;
    if (!navHref && properties.includes('nav')) navHref = item.href;
  }

  if (!coverHref) {
    const coverMeta = findAll(metadata, 'meta').find(
      (node) => String(node.attrs.name ?? '').toLowerCase() === 'cover',
    );
    coverHref = manifest.get(coverMeta?.attrs.content)?.href ?? null;
  }

  const ncxHref = manifest.get(spineNode?.attrs.toc)?.href ?? null;
  return { title, author, coverHref, spine, manifest, navHref, ncxHref };
}

function nodesIncludingRoot(root, local) {
  const descendants = findAll(root, local);
  return localName(root.name) === local ? [root, ...descendants] : descendants;
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
  try {
    root = parseXml(xmlText);
    normalizeRootPath(tocPath);
  } catch {
    return [];
  }

  if (kind === 'nav') {
    const navs = nodesIncludingRoot(root, 'nav');
    const tocNav = navs.find((node) => Object.entries(node.attrs).some(
      ([name, value]) => localName(name) === 'type' && tokens(value).includes('toc'),
    )) ?? navs[0];
    if (!tocNav) return [];

    return findAll(tocNav, 'a').flatMap((anchor) => {
      const label = normalizedText(anchor);
      const href = tocHref(tocPath, anchor.attrs.href);
      return label && href ? [{ label, href }] : [];
    });
  }

  return nodesIncludingRoot(root, 'navPoint').flatMap((navPoint) => {
    const labelNode = directChildren(navPoint, 'navLabel')[0];
    const textNode = findFirst(labelNode, 'text');
    const contentNode = directChildren(navPoint, 'content')[0];
    const label = normalizedText(textNode ?? labelNode);
    const href = tocHref(tocPath, contentNode?.attrs.src);
    return label && href ? [{ label, href }] : [];
  });
}

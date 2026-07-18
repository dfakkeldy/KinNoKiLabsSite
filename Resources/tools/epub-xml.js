const MAX_INPUT_LENGTH = 1_048_576;
const MAX_DOCTYPE_LENGTH = 65_536;
const MAX_DEPTH = 128;
const MAX_NODES = 10_000;
const MAX_TEXT_LENGTH = 262_144;

function badXml() {
  const error = new Error('Malformed XML');
  error.code = 'bad-xml';
  return error;
}

function validateLiteralCharacters(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index);
    if (!isXmlCharacter(codePoint)) throw badXml();
    if (codePoint > 0xffff) index += 1;
  }
}

function isXmlCharacter(codePoint) {
  return codePoint === 0x09 ||
    codePoint === 0x0a ||
    codePoint === 0x0d ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff);
}

function decodeEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    quot: '"',
  };

  let decoded = '';
  let cursor = 0;
  while (cursor < value.length) {
    const ampersand = value.indexOf('&', cursor);
    if (ampersand === -1) return decoded + value.slice(cursor);

    decoded += value.slice(cursor, ampersand);
    const semicolon = value.indexOf(';', ampersand + 1);
    if (semicolon === -1) throw badXml();

    const entity = value.slice(ampersand + 1, semicolon);
    if (Object.hasOwn(named, entity)) {
      decoded += named[entity];
    } else {
      const hexadecimal = entity.match(/^#x([0-9a-f]+)$/i);
      const decimal = entity.match(/^#([0-9]+)$/);
      if (!hexadecimal && !decimal) throw badXml();

      const codePoint = Number.parseInt(
        hexadecimal?.[1] ?? decimal[1],
        hexadecimal ? 16 : 10,
      );
      if (!isXmlCharacter(codePoint)) throw badXml();
      decoded += String.fromCodePoint(codePoint);
    }
    cursor = semicolon + 1;
  }
  return decoded;
}

function tagEnd(text, start) {
  let quote = null;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index;
    }
  }
  throw badXml();
}

function doctypeEnd(text, start) {
  let comment = false;
  let quote = null;
  let subsetDepth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (index - start > MAX_DOCTYPE_LENGTH) throw badXml();
    const character = text[index];
    if (comment) {
      if (text.startsWith('-->', index)) {
        comment = false;
        index += 2;
      }
    } else if (quote) {
      if (character === quote) quote = null;
    } else if (text.startsWith('<!--', index)) {
      comment = true;
      index += 3;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '[') {
      subsetDepth += 1;
    } else if (character === ']') {
      if (subsetDepth === 0) throw badXml();
      subsetDepth -= 1;
    } else if (character === '>' && subsetDepth === 0) {
      return index;
    }
  }
  throw badXml();
}

function parseDoctypeName(text, start, end) {
  const body = text.slice(start, end).trim();
  const name = body.match(/^([A-Za-z_][\w:.-]*)([\s\S]*)$/);
  if (!name) throw badXml();

  let quote = null;
  let subsetStart = -1;
  const remainder = name[2].trim();
  for (let index = 0; index < remainder.length; index += 1) {
    const character = remainder[index];
    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '[') {
      subsetStart = index;
      break;
    }
  }

  if (quote) throw badXml();
  const header = (subsetStart === -1 ? remainder : remainder.slice(0, subsetStart)).trim();
  if (subsetStart !== -1 && !remainder.endsWith(']')) throw badXml();
  const literal = `(?:"[^"]*"|'[^']*')`;
  const externalId = new RegExp(
    `^(?:SYSTEM\\s+${literal}|PUBLIC\\s+${literal}\\s+${literal})$`,
  );
  if (header && !externalId.test(header)) throw badXml();
  return name[1];
}

function parseOpenTag(source) {
  let body = source.trim();
  const selfClosing = body.endsWith('/');
  if (selfClosing) body = body.slice(0, -1).trimEnd();

  const nameMatch = body.match(/^([A-Za-z_][\w:.-]*)/);
  if (!nameMatch) throw badXml();

  const attrs = {};
  let cursor = nameMatch[0].length;
  while (cursor < body.length) {
    const spacing = body.slice(cursor).match(/^\s+/);
    if (!spacing) throw badXml();
    cursor += spacing[0].length;
    if (cursor === body.length) break;

    const attribute = body.slice(cursor).match(
      /^([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/,
    );
    if (!attribute || Object.hasOwn(attrs, attribute[1])) throw badXml();

    const rawValue = attribute[2] ?? attribute[3];
    if (rawValue.includes('<')) throw badXml();

    Object.defineProperty(attrs, attribute[1], {
      configurable: true,
      enumerable: true,
      value: decodeEntities(rawValue),
      writable: true,
    });
    cursor += attribute[0].length;
  }

  return {
    node: { name: nameMatch[1], attrs, children: [] },
    selfClosing,
  };
}

export function parseXml(input) {
  if (typeof input !== 'string' || input.length > MAX_INPUT_LENGTH) throw badXml();
  validateLiteralCharacters(input);
  const text = input.startsWith('\ufeff') ? input.slice(1) : input;
  const stack = [];
  const content = new WeakMap();
  let root = null;
  let cursor = 0;
  let doctypeSeen = false;
  let declaredRootName = null;
  let prologMarkupSeen = false;
  let xmlDeclarationSeen = false;
  let nodeCount = 0;
  let textLength = 0;

  function appendText(value, decode = true) {
    if (decode && value.includes(']]>')) throw badXml();
    const fragment = decode ? decodeEntities(value) : value;
    if (stack.length === 0) {
      if (fragment.trim()) throw badXml();
      return;
    }
    textLength += fragment.length;
    if (textLength > MAX_TEXT_LENGTH) throw badXml();
    const node = stack[stack.length - 1];
    contentFor(node).push(fragment);
  }

  function contentFor(node) {
    return content.get(node);
  }

  while (cursor < text.length) {
    const opening = text.indexOf('<', cursor);
    if (opening === -1) {
      appendText(text.slice(cursor));
      break;
    }
    appendText(text.slice(cursor, opening));

    if (text.startsWith('<!--', opening)) {
      const end = text.indexOf('-->', opening + 4);
      if (end === -1 || text.slice(opening + 4, end).includes('--')) throw badXml();
      if (!root) prologMarkupSeen = true;
      cursor = end + 3;
      continue;
    }

    if (text.startsWith('<![CDATA[', opening)) {
      const end = text.indexOf(']]>', opening + 9);
      if (end === -1 || stack.length === 0) throw badXml();
      appendText(text.slice(opening + 9, end), false);
      cursor = end + 3;
      continue;
    }

    if (text.startsWith('<?', opening)) {
      const end = text.indexOf('?>', opening + 2);
      if (end === -1) throw badXml();
      const declaration = text.slice(opening + 2, end);
      const validDeclaration = /^xml\s+version\s*=\s*(?:"1\.[0-9]+"|'1\.[0-9]+')(?:\s+encoding\s*=\s*(?:"[A-Za-z][A-Za-z0-9._-]*"|'[A-Za-z][A-Za-z0-9._-]*'))?(?:\s+standalone\s*=\s*(?:"(?:yes|no)"|'(?:yes|no)'))?\s*$/.test(declaration);
      if (!validDeclaration || xmlDeclarationSeen || prologMarkupSeen || root || stack.length > 0) {
        throw badXml();
      }
      xmlDeclarationSeen = true;
      cursor = end + 2;
      continue;
    }

    if (text.startsWith('<!DOCTYPE', opening)) {
      if (root || stack.length > 0 || doctypeSeen ||
          !/^<!DOCTYPE\s/.test(text.slice(opening, opening + 12))) {
        throw badXml();
      }
      const end = doctypeEnd(text, opening + 9);
      declaredRootName = parseDoctypeName(text, opening + 9, end);
      doctypeSeen = true;
      prologMarkupSeen = true;
      cursor = end + 1;
      continue;
    }

    if (text.startsWith('</', opening)) {
      const end = text.indexOf('>', opening + 2);
      if (end === -1) throw badXml();
      const closing = text.slice(opening + 2, end).trim();
      if (!/^[A-Za-z_][\w:.-]*$/.test(closing)) throw badXml();
      const node = stack.pop();
      if (!node || node.name !== closing) throw badXml();
      cursor = end + 1;
      continue;
    }

    if (text.startsWith('<!', opening)) throw badXml();

    const end = tagEnd(text, opening + 1);
    const { node, selfClosing } = parseOpenTag(text.slice(opening + 1, end));
    if (!root && declaredRootName && node.name !== declaredRootName) throw badXml();
    nodeCount += 1;
    if (nodeCount > MAX_NODES || stack.length + 1 > MAX_DEPTH) throw badXml();
    content.set(node, []);
    Object.defineProperty(node, 'text', {
      configurable: true,
      enumerable: true,
      get() {
        return contentFor(node)
          .map((piece) => typeof piece === 'string' ? piece : piece.text)
          .join('');
      },
    });
    if (stack.length > 0) {
      const parent = stack[stack.length - 1];
      parent.children.push(node);
      contentFor(parent).push(node);
    } else if (root) {
      throw badXml();
    } else {
      root = node;
    }
    if (!selfClosing) stack.push(node);
    cursor = end + 1;
  }

  if (!root || stack.length > 0) throw badXml();
  return root;
}

export function localName(name) {
  return String(name).split(':').at(-1);
}

export function findAll(node, local) {
  const matches = [];
  for (const child of node?.children ?? []) {
    if (localName(child.name) === local) matches.push(child);
    matches.push(...findAll(child, local));
  }
  return matches;
}

export function findFirst(node, local) {
  for (const child of node?.children ?? []) {
    if (localName(child.name) === local) return child;
    const descendant = findFirst(child, local);
    if (descendant) return descendant;
  }
  return null;
}

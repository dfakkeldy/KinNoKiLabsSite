function badXml() {
  const error = new Error('Malformed XML');
  error.code = 'bad-xml';
  return error;
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

    Object.defineProperty(attrs, attribute[1], {
      configurable: true,
      enumerable: true,
      value: decodeEntities(attribute[2] ?? attribute[3]),
      writable: true,
    });
    cursor += attribute[0].length;
  }

  return {
    node: { name: nameMatch[1], attrs, children: [], text: '' },
    selfClosing,
  };
}

export function parseXml(input) {
  if (typeof input !== 'string') throw badXml();
  const text = input.startsWith('\ufeff') ? input.slice(1) : input;
  const stack = [];
  const content = new WeakMap();
  let root = null;
  let cursor = 0;

  function appendText(value, decode = true) {
    const fragment = decode ? decodeEntities(value) : value;
    if (stack.length === 0) {
      if (fragment.trim()) throw badXml();
      return;
    }
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
      cursor = end + 2;
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
    content.set(node, []);
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

  function collectText(node) {
    node.text = contentFor(node)
      .map((piece) => typeof piece === 'string' ? piece : collectText(piece))
      .join('');
    return node.text;
  }
  collectText(root);
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

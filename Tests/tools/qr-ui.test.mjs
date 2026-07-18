import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, installDOM } from '../games/dom-fixture.mjs';
import { generateQr } from '../../Resources/tools/qr-matrix.js';
import { matrixToSvg, renderQrTool } from '../../Resources/tools/qr-ui.js';

const createStorage = () => {
  const values = Object.create(null);
  return {
    values,
    getItem(key) { return values[key] ?? null; },
    setItem(key, value) { values[key] = String(value); },
    removeItem(key) { delete values[key]; },
  };
};

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const field = (root, name) => {
  const node = root.querySelector(`[name=${name}]`);
  assert.ok(node, `field named ${name} should exist`);
  return node;
};

const inputText = (root, value) => {
  const input = field(root, 'text');
  input.value = value;
  input.dispatchEvent(new Event('input'));
  return input;
};

const button = (root, text) => {
  const node = root.querySelectorAll('button').find((candidate) => candidate.textContent === text);
  assert.ok(node, `${text} button should exist`);
  return node;
};

const withTool = async (run, deps = {}) => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  const storage = deps.storage ?? createStorage();
  const announcements = [];
  try {
    const dispose = renderQrTool(fixture.root, {
      storage,
      announce: (text) => announcements.push(text),
      ...deps,
    });
    await run({ fixture, storage, announcements, dispose });
  } finally {
    restore();
  }
};

test('matrixToSvg adds a four-module light quiet zone and one path command per dark row run', () => {
  const modules = new Uint8Array(21 * 21);
  modules[0] = 1;
  modules[1] = 1;
  modules[3] = 1;
  modules[21 + 3] = 1;

  const svg = matrixToSvg({ size: 21, modules });

  assert.equal(svg.startsWith('<svg'), true);
  assert.match(svg, /viewBox="0 0 29 29"/);
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="QR code"/);
  assert.match(svg, /<rect[^>]*fill="#fff"/);
  assert.match(svg, /<path[^>]*fill="#000"/);
  assert.match(svg, /d="M4 4h2v1h-2zM7 4h1v1h-1zM7 5h1v1h-1z"/);
  assert.equal((svg.match(/M/g) ?? []).length, 3);
});

test('matrixToSvg supports an explicit quiet zone and rejects malformed matrices', () => {
  assert.match(
    matrixToSvg({ size: 1, modules: Uint8Array.of(1) }, { quietZone: 0 }),
    /viewBox="0 0 1 1"/,
  );
  assert.throws(() => matrixToSvg({ size: 2, modules: Uint8Array.of(1) }), /modules/i);
  assert.throws(
    () => matrixToSvg({ size: 1, modules: Uint8Array.of(1) }, { quietZone: -1 }),
    /quiet zone/i,
  );
});

test('mounts labelled text and EC controls with an empty stage and the exact input hint', async () => withTool(async ({ fixture }) => {
  const input = field(fixture.root, 'text');
  assert.equal(input.getAttribute('type'), 'text');
  assert.equal(fixture.root.querySelector(`label[for=${input.id}]`).textContent, 'Text or URL');

  const level = field(fixture.root, 'level');
  assert.deepEqual(level.querySelectorAll('option').map((option) => option.value), ['L', 'M', 'Q', 'H']);
  assert.equal(level.value, 'M');
  assert.equal(fixture.root.querySelector(`label[for=${level.id}]`).textContent, 'Error correction');
  assert.ok(fixture.root.querySelector('.qr-stage'));
  assert.equal(fixture.root.querySelector('.qr-stage').children.length, 0);
  assert.equal(fixture.root.querySelector('.qr-hint').textContent, 'Enter text or a URL to make a QR code.');
  assert.equal(button(fixture.root, 'Download SVG').disabled, true);
  assert.equal(button(fixture.root, 'Download PNG').disabled, true);
  assert.equal(button(fixture.root, 'Copy PNG').disabled, true);
}));

test('renders a real accessible SVG on every input event and persists text plus EC level', async () => withTool(async ({ fixture, storage, announcements }) => {
  inputText(fixture.root, 'https://kinnokilabs.com');

  const expected = generateQr('https://kinnokilabs.com');
  const svg = fixture.root.querySelector('.qr-stage svg');
  assert.ok(svg);
  assert.equal(svg.tagName, 'SVG');
  assert.equal(svg.getAttribute('viewBox'), `0 0 ${expected.size + 8} ${expected.size + 8}`);
  assert.equal(svg.getAttribute('shape-rendering'), 'crispEdges');
  assert.equal(svg.getAttribute('role'), 'img');
  assert.equal(svg.getAttribute('aria-label'), 'QR code');
  assert.equal(svg.querySelectorAll('rect').length, 1);
  assert.equal(svg.querySelectorAll('path').length, 1);
  assert.equal(fixture.root.querySelector('.qr-hint').textContent,
    `Version ${expected.version} · M error correction`);
  assert.equal(announcements.at(-1), `Version ${expected.version} · M error correction`);
  assert.deepEqual(JSON.parse(storage.values['kinnoki-tools:v1']).tools['qr-code'], {
    text: 'https://kinnokilabs.com', level: 'M',
  });

  const level = field(fixture.root, 'level');
  level.value = 'H';
  level.dispatchEvent(new Event('change'));
  const expectedHigh = generateQr('https://kinnokilabs.com', { level: 'H' });
  assert.equal(fixture.root.querySelector('.qr-hint').textContent,
    `Version ${expectedHigh.version} · H error correction`);
  assert.deepEqual(JSON.parse(storage.values['kinnoki-tools:v1']).tools['qr-code'], {
    text: 'https://kinnokilabs.com', level: 'H',
  });
}));

test('clearing input empties the stage, restores the exact hint, and disables output actions', async () => withTool(async ({ fixture, announcements }) => {
  inputText(fixture.root, 'hello');
  inputText(fixture.root, '');

  assert.equal(fixture.root.querySelector('.qr-stage').children.length, 0);
  assert.equal(fixture.root.querySelector('.qr-hint').textContent, 'Enter text or a URL to make a QR code.');
  assert.equal(fixture.root.querySelector('.tool-error'), null);
  assert.equal(button(fixture.root, 'Download SVG').disabled, true);
  assert.equal(button(fixture.root, 'Download PNG').disabled, true);
  assert.equal(button(fixture.root, 'Copy PNG').disabled, true);
  assert.equal(announcements.at(-1), 'Enter text or a URL to make a QR code.');
}));

test('too-long input empties the stage and shows the exact inline error without throwing', async () => withTool(async ({ fixture, announcements }) => {
  inputText(fixture.root, 'a'.repeat(5000));

  const error = fixture.root.querySelector('.tool-error');
  assert.ok(error);
  assert.equal(error.textContent, 'That text is too long for a QR code at this error correction level.');
  assert.equal(fixture.root.querySelector('.qr-stage').children.length, 0);
  assert.equal(fixture.root.querySelector('.qr-hint'), null);
  assert.equal(announcements.at(-1), error.textContent);
  assert.equal(button(fixture.root, 'Download SVG').disabled, true);
}));

test('restores valid persisted input and EC preferences into a live preview', async () => {
  const storage = createStorage();
  storage.setItem('kinnoki-tools:v1', JSON.stringify({
    version: 1,
    tools: { 'qr-code': { text: 'remember me', level: 'Q' } },
  }));
  await withTool(async ({ fixture }) => {
    assert.equal(field(fixture.root, 'text').value, 'remember me');
    assert.equal(field(fixture.root, 'level').value, 'Q');
    assert.ok(fixture.root.querySelector('.qr-stage svg'));
    assert.match(fixture.root.querySelector('.qr-hint').textContent, /^Version \d+ · Q error correction$/);
  }, { storage });
});

test('downloads SVG through one object URL, clicks the anchor, and revokes the URL', async () => {
  const created = [];
  const revoked = [];
  const anchors = [];
  await withTool(async ({ fixture, announcements }) => {
    inputText(fixture.root, 'download me');
    button(fixture.root, 'Download SVG').click();

    assert.equal(created.length, 1);
    assert.ok(created[0] instanceof Blob);
    assert.equal(created[0].type, 'image/svg+xml;charset=utf-8');
    assert.match(await created[0].text(), /^<svg/);
    assert.deepEqual(revoked, ['blob:qr-1']);
    assert.equal(anchors.length, 1);
    assert.equal(anchors[0].href, 'blob:qr-1');
    assert.equal(anchors[0].download, 'qr-code.svg');
    assert.equal(anchors[0].clicks, 1);
    assert.equal(announcements.at(-1), 'SVG downloaded.');
  }, {
    urlFactory: {
      create(blob) { created.push(blob); return `blob:qr-${created.length}`; },
      revoke(url) { revoked.push(url); },
    },
    anchorFactory: () => {
      const anchor = { href: '', download: '', clicks: 0, click() { this.clicks += 1; } };
      anchors.push(anchor);
      return anchor;
    },
  });
});

const recordingCanvas = ({ useBlob = true, blobDeferred } = {}) => {
  const fills = [];
  const calls = { toBlob: 0, toDataURL: 0 };
  const context = {
    fillStyle: '',
    imageSmoothingEnabled: true,
    fillRect(...args) { fills.push({ fillStyle: this.fillStyle, args }); },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext(kind) { assert.equal(kind, '2d'); return context; },
  };
  if (useBlob) {
    canvas.toBlob = (callback, type) => {
      calls.toBlob += 1;
      assert.equal(type, 'image/png');
      if (blobDeferred) blobDeferred.callback = callback;
      else callback(new Blob(['png'], { type: 'image/png' }));
    };
  } else {
    canvas.toDataURL = (type) => {
      calls.toDataURL += 1;
      assert.equal(type, 'image/png');
      return 'data:image/png;base64,cG5n';
    };
  }
  return { canvas, calls, fills, context };
};

test('Download PNG paints a white field plus one black rectangle per dark module and uses toBlob', async () => {
  const recording = recordingCanvas();
  const downloaded = [];
  await withTool(async ({ fixture, announcements }) => {
    const text = 'paint me';
    inputText(fixture.root, text);
    button(fixture.root, 'Download PNG').click();
    await settle();

    const qr = generateQr(text);
    const darkModules = [...qr.modules].filter(Boolean).length;
    assert.equal(recording.calls.toBlob, 1);
    assert.equal(recording.calls.toDataURL, 0);
    assert.equal(recording.canvas.width, (qr.size + 8) * 8);
    assert.equal(recording.canvas.height, (qr.size + 8) * 8);
    assert.equal(recording.context.imageSmoothingEnabled, false);
    assert.equal(recording.fills.filter(({ fillStyle }) => fillStyle === '#000').length, darkModules);
    assert.deepEqual(recording.fills[0], {
      fillStyle: '#fff', args: [0, 0, recording.canvas.width, recording.canvas.height],
    });
    assert.deepEqual(downloaded, [{ name: 'qr-code.png', type: 'image/png' }]);
    assert.equal(announcements.at(-1), 'PNG downloaded.');
  }, {
    canvasFactory: () => recording.canvas,
    urlFactory: { create: () => 'blob:png', revoke() {} },
    anchorFactory: () => ({
      href: '', set download(value) { this.name = value; }, get download() { return this.name; },
      click() { downloaded.push({ name: this.name, type: 'image/png' }); },
    }),
  });
});

test('Download PNG falls back to a data URL when canvas.toBlob is unavailable', async () => {
  const recording = recordingCanvas({ useBlob: false });
  const blobs = [];
  await withTool(async ({ fixture }) => {
    inputText(fixture.root, 'fallback image');
    button(fixture.root, 'Download PNG').click();
    await settle();

    assert.equal(recording.calls.toBlob, 0);
    assert.equal(recording.calls.toDataURL, 1);
    assert.equal(blobs.length, 1);
    assert.equal(blobs[0].type, 'image/png');
    assert.equal(await blobs[0].text(), 'png');
  }, {
    canvasFactory: () => recording.canvas,
    urlFactory: { create(blob) { blobs.push(blob); return 'blob:fallback'; }, revoke() {} },
    anchorFactory: () => ({ click() {} }),
  });
});

test('Copy PNG writes a ClipboardItem when the image clipboard is available', async () => {
  const recording = recordingCanvas();
  const clipboardItems = [];
  const writes = [];
  class ClipboardItemStub {
    constructor(items) { this.items = items; clipboardItems.push(this); }
  }
  await withTool(async ({ fixture, announcements }) => {
    inputText(fixture.root, 'copy image');
    button(fixture.root, 'Copy PNG').click();
    await settle();

    assert.equal(clipboardItems.length, 1);
    assert.ok(clipboardItems[0].items['image/png'] instanceof Blob);
    assert.deepEqual(writes, [clipboardItems]);
    assert.equal(announcements.at(-1), 'PNG copied.');
  }, {
    canvasFactory: () => recording.canvas,
    ClipboardItem: ClipboardItemStub,
    clipboard: { async write(items) { writes.push(items); } },
    urlFactory: { create() { assert.fail('copy should not download'); }, revoke() {} },
  });
});

test('Copy PNG falls back to a PNG download when image clipboard support is unavailable', async () => {
  const recording = recordingCanvas();
  let clicks = 0;
  await withTool(async ({ fixture, announcements }) => {
    inputText(fixture.root, 'download fallback');
    button(fixture.root, 'Copy PNG').click();
    await settle();

    assert.equal(clicks, 1);
    assert.equal(announcements.at(-1), 'Image clipboard unavailable. PNG downloaded instead.');
  }, {
    canvasFactory: () => recording.canvas,
    ClipboardItem: null,
    clipboard: null,
    urlFactory: { create: () => 'blob:copy-fallback', revoke() {} },
    anchorFactory: () => ({ click() { clicks += 1; } }),
  });
});

test('stale PNG work cannot download or announce after the text changes', async () => {
  const pending = {};
  const recording = recordingCanvas({ blobDeferred: pending });
  let creates = 0;
  await withTool(async ({ fixture, announcements }) => {
    inputText(fixture.root, 'first value');
    button(fixture.root, 'Download PNG').click();
    assert.equal(typeof pending.callback, 'function');
    inputText(fixture.root, 'second value');
    const announcementCount = announcements.length;
    pending.callback(new Blob(['stale'], { type: 'image/png' }));
    await settle();

    assert.equal(creates, 0);
    assert.equal(announcements.length, announcementCount);
    assert.match(fixture.root.querySelector('.qr-hint').textContent, /^Version \d+ · M error correction$/);
  }, {
    canvasFactory: () => recording.canvas,
    urlFactory: { create() { creates += 1; return 'blob:stale'; }, revoke() {} },
    anchorFactory: () => ({ click() {} }),
  });
});

test('cleanup and repeated mounting remove old control listeners and invalidate pending work', async () => {
  let generations = 0;
  const generateQrFn = (text, options) => {
    generations += 1;
    return generateQr(text, options);
  };
  await withTool(async ({ fixture, dispose }) => {
    const firstInput = field(fixture.root, 'text');
    const secondDispose = renderQrTool(fixture.root, { storage: createStorage(), generateQrFn });
    const baseline = generations;
    firstInput.value = 'detached';
    firstInput.dispatchEvent(new Event('input'));
    assert.equal(generations, baseline);

    const secondInput = field(fixture.root, 'text');
    secondInput.value = 'active';
    secondInput.dispatchEvent(new Event('input'));
    assert.equal(generations, baseline + 1);
    secondDispose();
    secondInput.value = 'disposed';
    secondInput.dispatchEvent(new Event('input'));
    assert.equal(generations, baseline + 1);
    assert.doesNotThrow(dispose);
  });
});

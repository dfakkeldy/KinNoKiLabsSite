import {
  createAnnouncer,
  element,
  openToolPrefs,
  safeLocalStorage,
  setToolPrefs,
  toolPrefs,
  toolShell,
} from './core.js';
import { generateQr } from './qr-matrix.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const QUIET_ZONE = 4;
const PNG_SCALE = 8;
const EMPTY_HINT = 'Enter text or a URL to make a QR code.';
const TOO_LONG_ERROR = 'That text is too long for a QR code at this error correction level.';
const LEVELS = Object.freeze(['L', 'M', 'Q', 'H']);
const mountedControllers = new WeakMap();

const validateMatrix = (qr) => {
  if (!qr || !Number.isInteger(qr.size) || qr.size < 1) {
    throw new TypeError('QR size must be a positive integer');
  }
  if (!qr.modules || qr.modules.length !== qr.size * qr.size) {
    throw new TypeError('QR modules must contain size squared entries');
  }
};

const validateQuietZone = (quietZone) => {
  if (!Number.isInteger(quietZone) || quietZone < 0) {
    throw new RangeError('quiet zone must be a non-negative integer');
  }
};

const pathData = (qr, quietZone) => {
  const commands = [];
  for (let row = 0; row < qr.size; row += 1) {
    let column = 0;
    while (column < qr.size) {
      if (qr.modules[row * qr.size + column] !== 1) {
        column += 1;
        continue;
      }
      const start = column;
      while (column < qr.size && qr.modules[row * qr.size + column] === 1) column += 1;
      const length = column - start;
      commands.push(
        `M${start + quietZone} ${row + quietZone}h${length}v1h-${length}z`,
      );
    }
  }
  return commands.join('');
};

export function matrixToSvg(qr, { quietZone = QUIET_ZONE } = {}) {
  validateMatrix(qr);
  validateQuietZone(quietZone);
  const extent = qr.size + quietZone * 2;
  const data = pathData(qr, quietZone);
  return `<svg xmlns="${SVG_NAMESPACE}" viewBox="0 0 ${extent} ${extent}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${extent}" height="${extent}" fill="#fff"/><path d="${data}" fill="#000"/></svg>`;
}

const svgElement = (doc, tag) => (
  typeof doc.createElementNS === 'function'
    ? doc.createElementNS(SVG_NAMESPACE, tag)
    : doc.createElement(tag)
);

const svgFromMatrix = (qr, doc, quietZone = QUIET_ZONE) => {
  validateMatrix(qr);
  validateQuietZone(quietZone);
  const extent = qr.size + quietZone * 2;
  const svg = svgElement(doc, 'svg');
  svg.setAttribute('xmlns', SVG_NAMESPACE);
  svg.setAttribute('viewBox', `0 0 ${extent} ${extent}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'QR code');

  const background = svgElement(doc, 'rect');
  background.setAttribute('width', extent);
  background.setAttribute('height', extent);
  background.setAttribute('fill', '#fff');
  const modules = svgElement(doc, 'path');
  modules.setAttribute('d', pathData(qr, quietZone));
  modules.setAttribute('fill', '#000');
  svg.append(background, modules);
  return svg;
};

const defaultUrlFactory = () => ({
  create(blob) { return globalThis.URL.createObjectURL(blob); },
  revoke(url) { globalThis.URL.revokeObjectURL(url); },
});

const dataUrlToBlob = (dataUrl, decodeBase64 = globalThis.atob) => {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new TypeError('Canvas returned an invalid data URL');
  const metadata = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma + 1);
  const [type = 'image/png'] = metadata.split(';');
  let bytes;
  if (metadata.split(';').includes('base64')) {
    if (typeof decodeBase64 !== 'function') throw new Error('Base64 decoding is unavailable');
    const binary = decodeBase64(payload);
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(payload));
  }
  return new Blob([bytes], { type });
};

const canvasBlob = async (canvas, decodeBase64) => {
  if (typeof canvas.toBlob === 'function') {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) return blob;
  }
  if (typeof canvas.toDataURL !== 'function') throw new Error('PNG export is unavailable');
  return dataUrlToBlob(canvas.toDataURL('image/png'), decodeBase64);
};

const drawPng = async (qr, canvasFactory, decodeBase64) => {
  const canvas = canvasFactory();
  const extent = qr.size + QUIET_ZONE * 2;
  canvas.width = extent * PNG_SCALE;
  canvas.height = extent * PNG_SCALE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas rendering is unavailable');
  context.imageSmoothingEnabled = false;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000';
  for (let row = 0; row < qr.size; row += 1) {
    for (let column = 0; column < qr.size; column += 1) {
      if (qr.modules[row * qr.size + column] !== 1) continue;
      context.fillRect(
        (column + QUIET_ZONE) * PNG_SCALE,
        (row + QUIET_ZONE) * PNG_SCALE,
        PNG_SCALE,
        PNG_SCALE,
      );
    }
  }
  return canvasBlob(canvas, decodeBase64);
};

const option = (doc, level) => {
  const node = element('option', { value: level, text: level, ownerDocument: doc });
  node.value = level;
  return node;
};

export function renderQrTool(root, deps = {}) {
  mountedControllers.get(root)?.();

  const doc = root.ownerDocument ?? document;
  const storage = deps.storage ?? safeLocalStorage();
  const announce = deps.announce ?? createAnnouncer(doc.querySelector('.tools-live-region'));
  const generateQrFn = deps.generateQrFn ?? generateQr;
  const canvasFactory = deps.canvasFactory ?? (() => doc.createElement('canvas'));
  const anchorFactory = deps.anchorFactory ?? (() => doc.createElement('a'));
  const urlFactory = deps.urlFactory ?? defaultUrlFactory();
  const ClipboardItemClass = Object.hasOwn(deps, 'ClipboardItem')
    ? deps.ClipboardItem
    : globalThis.ClipboardItem;
  const clipboard = Object.hasOwn(deps, 'clipboard')
    ? deps.clipboard
    : globalThis.navigator?.clipboard;
  const decodeBase64 = deps.atob ?? globalThis.atob;

  let prefs = openToolPrefs(storage);
  const saved = toolPrefs(prefs, 'qr-code');
  let text = typeof saved.text === 'string' ? saved.text : '';
  let level = LEVELS.includes(saved.level) ? saved.level : 'M';
  let currentQr = null;
  let revision = 0;
  let disposed = false;

  const body = toolShell(root, {
    title: 'QR Code Generator',
    lede: 'Create a QR code for text or a URL, ready to copy or download.',
  });
  const form = element('form', { class: 'tool-form', ownerDocument: doc });
  const input = element('input', {
    id: 'qr-text', name: 'text', type: 'text', autocomplete: 'off', ownerDocument: doc,
  });
  input.value = text;
  const levelSelect = element('select', {
    id: 'qr-level', name: 'level', ownerDocument: doc,
  }, ...LEVELS.map((value) => option(doc, value)));
  levelSelect.value = level;
  const stage = element('div', { class: 'qr-stage', ownerDocument: doc });
  const status = element('div', { class: 'qr-status', ownerDocument: doc });
  const actionStatus = element('div', { class: 'qr-action-status', ownerDocument: doc });
  const downloadSvg = element('button', {
    type: 'button', text: 'Download SVG', ownerDocument: doc,
  });
  const downloadPng = element('button', {
    type: 'button', text: 'Download PNG', ownerDocument: doc,
  });
  const copyPng = element('button', {
    type: 'button', text: 'Copy PNG', ownerDocument: doc,
  });
  const actions = element('div', { class: 'tool-actions', ownerDocument: doc },
    downloadSvg, downloadPng, copyPng);

  const save = () => {
    prefs = setToolPrefs(storage, prefs, 'qr-code', { text, level });
  };

  const setActionsEnabled = (enabled) => {
    for (const action of [downloadSvg, downloadPng, copyPng]) action.disabled = !enabled;
  };

  const showStatus = (className, message) => {
    status.replaceChildren(element('p', { class: className, text: message, ownerDocument: doc }));
    announce(message);
  };

  const regenerate = () => {
    revision += 1;
    currentQr = null;
    actionStatus.replaceChildren();
    stage.replaceChildren();
    const result = generateQrFn(text, { level });
    if (result.error === 'empty') {
      showStatus('qr-hint', EMPTY_HINT);
      setActionsEnabled(false);
      return;
    }
    if (result.error === 'too-long') {
      showStatus('tool-error', TOO_LONG_ERROR);
      setActionsEnabled(false);
      return;
    }
    currentQr = result;
    stage.append(svgFromMatrix(result, doc));
    const hint = `Version ${result.version} · ${result.level} error correction`;
    showStatus('qr-hint', hint);
    setActionsEnabled(true);
  };

  const downloadBlob = (blob, filename) => {
    let url;
    try {
      url = urlFactory.create(blob);
      const anchor = anchorFactory();
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      return true;
    } catch {
      return false;
    } finally {
      if (url !== undefined) {
        try { urlFactory.revoke(url); } catch { /* URL is already no longer needed. */ }
      }
    }
  };

  const showActionError = (message) => {
    actionStatus.replaceChildren(element('p', {
      class: 'tool-error', text: message, ownerDocument: doc,
    }));
    announce(message);
  };

  const onInput = (event) => {
    text = event.currentTarget.value;
    save();
    regenerate();
  };
  const onLevelChange = (event) => {
    level = LEVELS.includes(event.currentTarget.value) ? event.currentTarget.value : 'M';
    levelSelect.value = level;
    save();
    regenerate();
  };
  const onSubmit = (event) => {
    event.preventDefault();
  };
  const onDownloadSvg = () => {
    if (!currentQr || disposed) return;
    actionStatus.replaceChildren();
    const blob = new Blob([matrixToSvg(currentQr)], { type: 'image/svg+xml;charset=utf-8' });
    if (downloadBlob(blob, 'qr-code.svg')) announce('SVG downloaded.');
    else showActionError('Unable to download the SVG.');
  };
  const onDownloadPng = async () => {
    if (!currentQr || disposed) return;
    actionStatus.replaceChildren();
    const actionRevision = revision;
    const qr = currentQr;
    try {
      const blob = await drawPng(qr, canvasFactory, decodeBase64);
      if (disposed || revision !== actionRevision) return;
      if (downloadBlob(blob, 'qr-code.png')) announce('PNG downloaded.');
      else showActionError('Unable to download the PNG.');
    } catch {
      if (!disposed && revision === actionRevision) showActionError('Unable to create the PNG.');
    }
  };
  const onCopyPng = async () => {
    if (!currentQr || disposed) return;
    actionStatus.replaceChildren();
    const actionRevision = revision;
    const qr = currentQr;
    try {
      const blob = await drawPng(qr, canvasFactory, decodeBase64);
      if (disposed || revision !== actionRevision) return;
      if (ClipboardItemClass && typeof clipboard?.write === 'function') {
        try {
          await clipboard.write([new ClipboardItemClass({ 'image/png': blob })]);
          if (disposed || revision !== actionRevision) return;
          announce('PNG copied.');
          return;
        } catch {
          if (disposed || revision !== actionRevision) return;
        }
      }
      if (downloadBlob(blob, 'qr-code.png')) {
        announce('Image clipboard unavailable. PNG downloaded instead.');
      } else {
        showActionError('Unable to copy or download the PNG.');
      }
    } catch {
      if (!disposed && revision === actionRevision) showActionError('Unable to create the PNG.');
    }
  };

  input.addEventListener('input', onInput);
  levelSelect.addEventListener('change', onLevelChange);
  form.addEventListener('submit', onSubmit);
  downloadSvg.addEventListener('click', onDownloadSvg);
  downloadPng.addEventListener('click', onDownloadPng);
  copyPng.addEventListener('click', onCopyPng);

  form.append(
    element('div', { class: 'tool-field', ownerDocument: doc },
      element('label', { for: 'qr-text', text: 'Text or URL', ownerDocument: doc }), input),
    element('div', { class: 'tool-field', ownerDocument: doc },
      element('label', { for: 'qr-level', text: 'Error correction', ownerDocument: doc }), levelSelect),
    stage,
    status,
    actions,
    actionStatus,
  );
  body.append(form);
  regenerate();

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    revision += 1;
    input.removeEventListener('input', onInput);
    levelSelect.removeEventListener('change', onLevelChange);
    form.removeEventListener('submit', onSubmit);
    downloadSvg.removeEventListener('click', onDownloadSvg);
    downloadPng.removeEventListener('click', onDownloadPng);
    copyPng.removeEventListener('click', onCopyPng);
    if (mountedControllers.get(root) === dispose) mountedControllers.delete(root);
  };
  mountedControllers.set(root, dispose);
  return dispose;
}

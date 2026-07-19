import {
  createAnnouncer,
  element,
  openToolPrefs,
  safeLocalStorage,
  setToolPrefs,
  toolPrefs,
  toolShell,
} from './core.js';
import {
  parseContainer,
  parsePackage,
  parseToc,
  resolveZipPath,
} from './epub-package.js';
import { sanitizeChapter } from './epub-sanitize.js';
import {
  addBook,
  deleteBook,
  getBook,
  getPosition,
  listBooks,
  openLibrary,
  savePosition,
} from './epub-store.js';
import { parseZip, readEntry, supportsInflate } from './epub-zip.js';

const UTF8 = new TextDecoder('utf-8', { fatal: true });
const FONT_SIZES = Object.freeze({ minimum: 80, maximum: 180, step: 10 });
const FONT_OPTIONS = Object.freeze([
  Object.freeze({ id: 'serif', label: 'Serif', css: 'ui-serif, Georgia, serif' }),
  Object.freeze({ id: 'sans-serif', label: 'Sans serif', css: 'ui-sans-serif, system-ui, sans-serif' }),
  Object.freeze({ id: 'OpenDyslexic', label: 'OpenDyslexic', css: 'OpenDyslexic, sans-serif' }),
]);
const LINE_HEIGHTS = Object.freeze(['1.4', '1.6', '1.8']);
const mountedControllers = new WeakMap();
const persistenceRequests = new WeakSet();

const READER_ERRORS = Object.freeze({
  corrupt: "We couldn't read that EPUB. It may be corrupt or incomplete.",
  drm: 'This EPUB appears to use DRM or encryption, which this local reader cannot open.',
  inflate: 'This EPUB reader needs a newer browser with built-in ZIP decompression.',
  unsupported: 'This EPUB uses unsupported compression and cannot be opened here.',
  storage: "We couldn't save that EPUB to this browser's local library.",
});

function codedError(code) {
  return Object.assign(new Error(code), { code });
}

function defaultUrlFactory() {
  return {
    create(blob) { return globalThis.URL.createObjectURL(blob); },
    revoke(url) { globalThis.URL.revokeObjectURL(url); },
  };
}

function option(doc, value, label = value) {
  const node = element('option', { value, text: label, ownerDocument: doc });
  node.value = value;
  return node;
}

function bounded(value, fallback, minimum, maximum) {
  return Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.round(value)))
    : fallback;
}

function messageFor(error) {
  if (error?.code === 'encrypted' || error?.code === 'drm') return READER_ERRORS.drm;
  if (error?.code === 'unsupported-method' || error?.code === 'zip64-unsupported') {
    return READER_ERRORS.unsupported;
  }
  if (error?.code === 'storage') return READER_ERRORS.storage;
  return READER_ERRORS.corrupt;
}

function mimeFor(pkg, href) {
  for (const item of pkg.manifest.values()) {
    if (item.href === href && item.mediaType) return item.mediaType;
  }
  if (/\.png$/iu.test(href)) return 'image/png';
  if (/\.jpe?g$/iu.test(href)) return 'image/jpeg';
  if (/\.gif$/iu.test(href)) return 'image/gif';
  if (/\.webp$/iu.test(href)) return 'image/webp';
  return 'application/octet-stream';
}

function parserError(documentNode) {
  try {
    if (documentNode?.querySelector?.('parsererror')) return true;
  } catch {
    return true;
  }
  return String(documentNode?.documentElement?.localName ?? '').toLowerCase() === 'parsererror';
}

function parsedBody(parser, text) {
  if (!parser?.parseFromString) throw codedError('bad-chapter');
  let parsed = parser.parseFromString(text, 'application/xhtml+xml');
  if (parserError(parsed)) parsed = parser.parseFromString(text, 'text/html');
  if (parserError(parsed)) throw codedError('bad-chapter');
  const body = parsed?.body ?? parsed?.querySelector?.('body');
  if (!body) throw codedError('bad-chapter');
  return body;
}

function imageReferences(root) {
  const references = new Set();
  const stack = [...(root?.childNodes ?? [])];
  let visited = 0;
  while (stack.length > 0 && visited < 10_000) {
    const node = stack.pop();
    visited += 1;
    if (node?.nodeType !== 1) continue;
    if (String(node.tagName).toLowerCase() === 'img') {
      const src = node.getAttribute?.('src');
      if (typeof src === 'string' && src) references.add(src);
    }
    for (const child of node.childNodes ?? []) stack.push(child);
  }
  return references;
}

function scrollFraction(root) {
  const maximum = Number(root.scrollHeight) - Number(root.clientHeight);
  if (!Number.isFinite(maximum) || maximum <= 0) return 0;
  const fraction = Number(root.scrollTop) / maximum;
  return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
}

function progressFor(book, position) {
  if (!position || !Number.isInteger(book.spineCount) || book.spineCount < 1) return 0;
  const index = Math.min(book.spineCount - 1, Math.max(0, Number(position.spineIndex) || 0));
  const fraction = Math.min(1, Math.max(0, Number(position.scrollFraction) || 0));
  return Math.min(100, Math.max(0, Math.round(((index + fraction) / book.spineCount) * 100)));
}

export function renderEpubTool(root, deps = {}) {
  mountedControllers.get(root)?.();

  const doc = root.ownerDocument ?? document;
  const storage = deps.storage ?? safeLocalStorage();
  const announce = deps.announce ?? createAnnouncer(doc.querySelector('.tools-live-region'));
  const indexedDb = deps.idb ?? globalThis.indexedDB;
  const parser = deps.domParser ?? (
    typeof globalThis.DOMParser === 'function' ? new globalThis.DOMParser() : null
  );
  const urlFactory = deps.urlFactory ?? defaultUrlFactory();
  const navigatorObject = deps.navigator ?? globalThis.navigator;
  const hasInjectedInflate = Object.hasOwn(deps, 'inflate');
  const inflate = hasInjectedInflate ? deps.inflate : undefined;
  const canInflate = typeof inflate === 'function' || (!hasInjectedInflate && supportsInflate());
  const setIntervalFn = deps.setInterval ?? globalThis.setInterval?.bind(globalThis);
  const clearIntervalFn = deps.clearInterval ?? globalThis.clearInterval?.bind(globalThis);

  let prefs = deps.prefs ?? openToolPrefs(storage);
  let readerPrefs = toolPrefs(prefs, 'epub-reader');
  let fontSize = bounded(readerPrefs.fontSize, 100, FONT_SIZES.minimum, FONT_SIZES.maximum);
  let fontFamily = FONT_OPTIONS.some(({ id }) => id === readerPrefs.fontFamily)
    ? readerPrefs.fontFamily
    : 'serif';
  let lineHeight = LINE_HEIGHTS.includes(String(readerPrefs.lineHeight))
    ? String(readerPrefs.lineHeight)
    : '1.6';
  let disposed = false;
  let revision = 0;
  let dbPromise;
  let db;
  let session = null;
  let intervalHandle = null;
  let dirtyScroll = false;
  const viewCleanups = new Set();
  const libraryUrls = new Map();
  const chapterUrls = new Set();

  const body = toolShell(root, {
    title: 'EPUB Reader',
    lede: 'Keep a private, on-device library and read without an account or upload.',
  });

  const current = (token) => !disposed && token === revision;

  const listen = (target, type, handler) => {
    target.addEventListener(type, handler);
    const cleanup = () => target.removeEventListener(type, handler);
    viewCleanups.add(cleanup);
    return cleanup;
  };

  const clearView = () => {
    for (const cleanup of viewCleanups) cleanup();
    viewCleanups.clear();
    if (intervalHandle !== null) {
      clearIntervalFn?.(intervalHandle);
      intervalHandle = null;
    }
    dirtyScroll = false;
  };

  const revoke = (url) => {
    try { urlFactory.revoke(url); } catch { /* The URL is already unusable. */ }
  };

  const revokeLibraryUrl = (bookId) => {
    const url = libraryUrls.get(bookId);
    if (url) revoke(url);
    libraryUrls.delete(bookId);
  };

  const revokeLibraryUrls = () => {
    for (const url of libraryUrls.values()) revoke(url);
    libraryUrls.clear();
  };

  const revokeChapterUrls = () => {
    for (const url of chapterUrls) revoke(url);
    chapterUrls.clear();
  };

  const libraryDb = async () => {
    dbPromise ??= openLibrary(indexedDb);
    db ??= await dbPromise;
    return db;
  };

  const archiveEntry = async (buffer, zip, href) => {
    const entry = zip.entries.get(href);
    if (!entry) throw codedError('bad-entry');
    return readEntry(buffer, entry, inflate);
  };

  const archiveText = async (buffer, zip, href) => {
    try {
      return UTF8.decode(await archiveEntry(buffer, zip, href));
    } catch (error) {
      if (error?.code) throw error;
      throw codedError('bad-entry');
    }
  };

  const parseArchive = async (buffer, includeToc = false) => {
    const zip = parseZip(buffer);
    if ([...zip.entries.values()].some((entry) => entry.encrypted)
      || zip.entries.has('META-INF/encryption.xml')) {
      throw codedError('drm');
    }
    if ([...zip.entries.values()].some((entry) => entry.method !== 0 && entry.method !== 8)) {
      throw codedError('unsupported-method');
    }
    const container = await archiveText(buffer, zip, 'META-INF/container.xml');
    const opfPath = parseContainer(container);
    const packageText = await archiveText(buffer, zip, opfPath);
    const pkg = parsePackage(packageText, opfPath);
    let toc = [];
    if (includeToc) {
      const tocPath = pkg.navHref ?? pkg.ncxHref;
      if (tocPath && zip.entries.has(tocPath)) {
        try {
          const tocText = await archiveText(buffer, zip, tocPath);
          toc = parseToc(tocText, tocPath, pkg.navHref ? 'nav' : 'ncx');
        } catch {
          toc = [];
        }
      }
    }
    return { buffer, zip, pkg, toc };
  };

  const saveReaderPrefs = (patch) => {
    readerPrefs = { ...readerPrefs, ...patch };
    prefs = setToolPrefs(storage, prefs, 'epub-reader', readerPrefs);
  };

  const showLibraryError = (container, message) => {
    container.replaceChildren(element('p', {
      class: 'tool-error', role: 'alert', text: message, ownerDocument: doc,
    }));
    announce(message);
  };

  const estimateStorage = async (container, token) => {
    if (typeof navigatorObject?.storage?.estimate !== 'function') return;
    try {
      const { usage } = await navigatorObject.storage.estimate();
      if (!current(token) || !Number.isFinite(usage)) return;
      const megabytes = (usage / (1024 * 1024)).toFixed(1).replace(/\.0$/u, '');
      container.textContent = `Using about ${megabytes} MB on this device.`;
    } catch {
      // Storage accounting is supplementary and silently omitted when unavailable.
    }
  };

  const importFile = async (file, status, input) => {
    const token = ++revision;
    status.replaceChildren();
    if (!canInflate) {
      showLibraryError(status, READER_ERRORS.inflate);
      return;
    }
    input.disabled = true;
    try {
      if (!file || typeof file.arrayBuffer !== 'function') throw codedError('bad-entry');
      const buffer = await file.arrayBuffer();
      if (!current(token)) return;
      const archive = await parseArchive(buffer, false);
      if (!current(token)) return;
      let coverBlob = null;
      if (archive.pkg.coverHref && archive.zip.entries.has(archive.pkg.coverHref)) {
        const coverBytes = await archiveEntry(
          archive.buffer,
          archive.zip,
          archive.pkg.coverHref,
        );
        if (!current(token)) return;
        coverBlob = new Blob([coverBytes], { type: mimeFor(archive.pkg, archive.pkg.coverHref) });
      }
      const library = await libraryDb();
      if (!current(token)) return;
      const randomId = globalThis.crypto?.randomUUID?.()
        ?? `epub-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      try {
        await addBook(library, {
          id: randomId,
          title: archive.pkg.title,
          author: archive.pkg.author,
          addedAt: Date.now(),
          coverBlob,
          file,
          spineCount: archive.pkg.spine.length,
        });
      } catch {
        throw codedError('storage');
      }
      if (!current(token)) return;
      const storageManager = navigatorObject?.storage;
      if (storageManager && typeof storageManager.persist === 'function'
        && !persistenceRequests.has(storageManager)) {
        persistenceRequests.add(storageManager);
        try {
          Promise.resolve(storageManager.persist()).catch(() => {});
        } catch {
          // Import succeeded; persistence is only a best-effort durability request.
        }
      }
      announce(`${archive.pkg.title} added to your library.`);
      await renderLibrary();
    } catch (error) {
      if (current(token)) showLibraryError(status, messageFor(error));
    } finally {
      if (current(token)) input.disabled = false;
    }
  };

  const addDeleteConfirmation = (card, book, status) => {
    card.querySelector('.epub-delete-confirm')?.remove();
    const confirmation = element('div', {
      class: 'epub-delete-confirm', role: 'group', 'aria-label': `Delete ${book.title}?`, ownerDocument: doc,
    });
    const cancel = element('button', { type: 'button', text: 'Cancel', ownerDocument: doc });
    const confirm = element('button', {
      type: 'button', class: 'tool-danger', text: 'Delete book', ownerDocument: doc,
    });
    confirmation.append(
      element('p', { text: 'Remove this book and its saved position?', ownerDocument: doc }),
      cancel,
      confirm,
    );
    listen(cancel, 'click', () => confirmation.remove());
    listen(confirm, 'click', async () => {
      const token = ++revision;
      confirm.disabled = true;
      revokeLibraryUrl(book.id);
      try {
        await deleteBook(await libraryDb(), book.id);
        if (!current(token)) return;
        announce(`${book.title} removed from your library.`);
        await renderLibrary();
      } catch {
        if (current(token)) showLibraryError(status, READER_ERRORS.storage);
      }
    });
    card.append(confirmation);
  };

  const renderBookCard = (book, position, status) => {
    const card = element('article', { class: 'epub-book-card', ownerDocument: doc });
    if (book.coverBlob instanceof Blob) {
      try {
        const url = urlFactory.create(book.coverBlob);
        libraryUrls.set(book.id, url);
        card.append(element('img', {
          src: url,
          alt: `Cover of ${book.title}`,
          ownerDocument: doc,
        }));
      } catch {
        // Metadata remains usable if the browser cannot make a cover URL.
      }
    }
    const open = element('button', { type: 'button', text: 'Open', ownerDocument: doc });
    const remove = element('button', { type: 'button', text: 'Delete', ownerDocument: doc });
    listen(open, 'click', () => { void openBook(book.id); });
    listen(remove, 'click', () => addDeleteConfirmation(card, book, status));
    card.append(
      element('h2', { text: book.title, ownerDocument: doc }),
      element('p', { class: 'epub-book-author', text: book.author, ownerDocument: doc }),
      element('p', {
        class: 'epub-book-progress',
        text: `Progress ${progressFor(book, position)}%`,
        ownerDocument: doc,
      }),
      element('div', { class: 'tool-actions', ownerDocument: doc }, open, remove),
    );
    return card;
  };

  async function renderLibrary() {
    const token = ++revision;
    clearView();
    revokeChapterUrls();
    revokeLibraryUrls();
    session = null;
    body.replaceChildren(element('p', { text: 'Loading your library…', ownerDocument: doc }));
    try {
      const library = await libraryDb();
      const books = await listBooks(library);
      const positions = await Promise.all(books.map(async (book) => {
        try { return await getPosition(library, book.id); } catch { return undefined; }
      }));
      if (!current(token)) return;

      const form = element('form', { class: 'epub-import tool-form', ownerDocument: doc });
      const input = element('input', {
        id: 'epub-file', type: 'file', accept: '.epub', ownerDocument: doc,
      });
      input.disabled = !canInflate;
      const drop = element('div', {
        class: 'epub-drop',
        role: 'button',
        tabindex: '0',
        'aria-controls': 'epub-file',
        text: 'Drop an EPUB here, or choose a file.',
        ownerDocument: doc,
      });
      if (!canInflate) drop.setAttribute('aria-disabled', 'true');
      const status = element('div', { class: 'epub-library-status', ownerDocument: doc });
      const storageLine = element('p', { class: 'epub-storage', ownerDocument: doc });
      const grid = element('div', { class: 'epub-library-grid', ownerDocument: doc });
      if (books.length === 0) {
        grid.append(element('p', {
          class: 'epub-empty', text: 'No books yet. Import an EPUB to begin.', ownerDocument: doc,
        }));
      } else {
        grid.append(...books.map((book, index) => renderBookCard(book, positions[index], status)));
      }

      const onSubmit = (event) => event.preventDefault();
      const onChange = (event) => {
        const file = event.currentTarget.files?.[0];
        if (file) void importFile(file, status, input);
      };
      const preventDropNavigation = (event) => event.preventDefault();
      const onDragOver = (event) => {
        event.preventDefault();
        if (canInflate) drop.classList.add('is-dragover');
      };
      const onDragLeave = (event) => {
        event.preventDefault();
        drop.classList.remove('is-dragover');
      };
      const onDrop = (event) => {
        event.preventDefault();
        drop.classList.remove('is-dragover');
        const file = event.dataTransfer?.files?.[0];
        if (file && canInflate) void importFile(file, status, input);
      };
      const onDropKey = (event) => {
        if (!canInflate || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        input.click();
      };
      listen(form, 'submit', onSubmit);
      listen(input, 'change', onChange);
      listen(drop, 'dragenter', preventDropNavigation);
      listen(drop, 'dragover', onDragOver);
      listen(drop, 'dragleave', onDragLeave);
      listen(drop, 'drop', onDrop);
      listen(drop, 'keydown', onDropKey);
      listen(drop, 'click', () => { if (canInflate) input.click(); });

      form.append(
        element('label', { for: 'epub-file', text: 'Choose an EPUB', ownerDocument: doc }),
        input,
        drop,
        status,
      );
      body.replaceChildren(form, storageLine, grid);
      if (!canInflate) showLibraryError(status, READER_ERRORS.inflate);
      void estimateStorage(storageLine, token);
    } catch {
      if (!current(token)) return;
      body.replaceChildren(element('p', {
        class: 'tool-error', role: 'alert', text: READER_ERRORS.storage, ownerDocument: doc,
      }));
      announce(READER_ERRORS.storage);
    }
  }

  const restoreScroll = (fraction) => {
    if (!(fraction > 0) || typeof root.scrollTo !== 'function') return;
    const maximum = Number(root.scrollHeight) - Number(root.clientHeight);
    if (!Number.isFinite(maximum) || maximum <= 0) return;
    root.scrollTo({ top: maximum * fraction, behavior: 'auto' });
  };

  const checkpoint = async (spineIndex = session?.spineIndex, fraction = scrollFraction(root)) => {
    if (!session || !Number.isInteger(spineIndex)) return;
    await savePosition(await libraryDb(), {
      bookId: session.book.id,
      spineIndex,
      scrollFraction: Math.min(1, Math.max(0, Number(fraction) || 0)),
      updatedAt: Date.now(),
    });
  };

  const prepareImages = async (sourceRoot, chapterHref, token) => {
    const imageUrls = new Map();
    const created = new Set();
    for (const reference of imageReferences(sourceRoot)) {
      if (!current(token)) break;
      let href;
      try {
        href = resolveZipPath(chapterHref, reference);
      } catch {
        continue;
      }
      if (!session.zip.entries.has(href)) continue;
      try {
        const data = await archiveEntry(session.buffer, session.zip, href);
        if (!current(token)) break;
        const url = urlFactory.create(new Blob([data], { type: mimeFor(session.pkg, href) }));
        if (!current(token)) {
          revoke(url);
          break;
        }
        imageUrls.set(reference, url);
        created.add(url);
      } catch {
        // A broken image is omitted without making the readable text unavailable.
      }
    }
    if (!current(token)) {
      for (const url of created) revoke(url);
      return null;
    }
    return { imageUrls, created };
  };

  const applyTypography = (chapter) => {
    const family = FONT_OPTIONS.find(({ id }) => id === fontFamily) ?? FONT_OPTIONS[0];
    chapter.style.setProperty('font-size', `${fontSize}%`);
    chapter.style.setProperty('font-family', family.css);
    chapter.style.setProperty('line-height', lineHeight);
  };

  const readerError = (container, error) => {
    const message = messageFor(error);
    container.replaceChildren(element('p', {
      class: 'tool-error', role: 'alert', text: message, ownerDocument: doc,
    }));
    announce(message);
  };

  async function showChapter(index, {
    restoreFraction = 0,
    saveCurrent = false,
  } = {}) {
    if (!session || index < 0 || index >= session.pkg.spine.length) return;
    const token = ++revision;
    const oldIndex = session.spineIndex;
    const oldFraction = scrollFraction(root);
    revokeChapterUrls();
    session.chapter.replaceChildren(element('p', { text: 'Loading chapter…', ownerDocument: doc }));
    if (saveCurrent && Number.isInteger(oldIndex)) {
      try {
        await checkpoint(oldIndex, oldFraction);
      } catch {
        // The requested chapter remains readable even if a checkpoint fails.
      }
      if (!current(token)) return;
    }

    const spine = session.pkg.spine[index];
    try {
      const markup = await archiveText(session.buffer, session.zip, spine.href);
      if (!current(token)) return;
      const sourceRoot = parsedBody(parser, markup);
      const prepared = await prepareImages(sourceRoot, spine.href, token);
      if (!prepared || !current(token)) return;
      const sanitized = sanitizeChapter(sourceRoot, {
        createElement: (tag) => element(tag, { ownerDocument: doc }),
        createTextNode: (text) => (
          typeof doc.createTextNode === 'function' ? doc.createTextNode(text) : String(text)
        ),
        resolveImage: (src) => prepared.imageUrls.get(src) ?? null,
        resolveLink: (href) => {
          if (/^https?:\/\//iu.test(href)) return { external: true, href };
          let resolved;
          try { resolved = resolveZipPath(spine.href, href); } catch { return null; }
          return session.pkg.spine.some((item) => item.href === resolved)
            ? { spineHref: resolved }
            : null;
        },
      });
      if (!current(token)) {
        for (const url of prepared.created) revoke(url);
        return;
      }
      session.spineIndex = index;
      dirtyScroll = false;
      try {
        await checkpoint(index, restoreFraction);
      } catch {
        // Position saving is best effort; chapter rendering is still useful.
      }
      if (!current(token)) {
        for (const url of prepared.created) revoke(url);
        return;
      }
      for (const url of prepared.created) chapterUrls.add(url);
      session.chapter.replaceChildren(sanitized);
      applyTypography(session.chapter);
      session.previous.disabled = index === 0;
      session.next.disabled = index === session.pkg.spine.length - 1;
      restoreScroll(restoreFraction);
      announce(`Opened chapter ${index + 1} of ${session.pkg.spine.length}.`);
    } catch (error) {
      if (current(token)) readerError(session.chapter, error);
    }
  }

  const targetSpineHref = (target, boundary) => {
    for (let node = target; node && node !== boundary; node = node.parentNode) {
      const href = node.getAttribute?.('data-spine-href');
      if (href) return href;
    }
    return null;
  };

  const renderReader = async (book, archive, position, token) => {
    if (!current(token)) return;
    const reader = element('section', { class: 'epub-reader', ownerDocument: doc });
    const controls = element('div', { class: 'epub-reader-controls', ownerDocument: doc });
    const back = element('button', { type: 'button', text: 'Back to library', ownerDocument: doc });
    const tocButton = element('button', {
      type: 'button', text: 'Table of contents', 'aria-expanded': 'false', ownerDocument: doc,
    });
    const previous = element('button', { type: 'button', text: 'Previous', ownerDocument: doc });
    const next = element('button', { type: 'button', text: 'Next', ownerDocument: doc });
    const smaller = element('button', {
      type: 'button', 'aria-label': 'Decrease font size', text: 'Decrease font size', ownerDocument: doc,
    });
    const larger = element('button', {
      type: 'button', 'aria-label': 'Increase font size', text: 'Increase font size', ownerDocument: doc,
    });
    const fontSelect = element('select', {
      id: 'epub-font', name: 'fontFamily', ownerDocument: doc,
    }, ...FONT_OPTIONS.map(({ id, label }) => option(doc, id, label)));
    fontSelect.value = fontFamily;
    const lineSelect = element('select', {
      id: 'epub-line-height', name: 'lineHeight', ownerDocument: doc,
    }, ...LINE_HEIGHTS.map((value) => option(doc, value, value)));
    lineSelect.value = lineHeight;
    controls.append(
      back,
      tocButton,
      previous,
      next,
      smaller,
      larger,
      element('label', { for: 'epub-font', text: 'Reader font', ownerDocument: doc }),
      fontSelect,
      element('label', { for: 'epub-line-height', text: 'Line height', ownerDocument: doc }),
      lineSelect,
    );

    const toc = element('nav', {
      class: 'epub-toc', 'aria-label': 'Table of contents', ownerDocument: doc,
    });
    const tocEntries = archive.toc.filter(({ href }) => (
      archive.pkg.spine.some((item) => item.href === href)
    ));
    if (tocEntries.length === 0) {
      toc.append(element('p', { text: 'No table of contents provided.', ownerDocument: doc }));
    } else {
      const list = element('ol', { ownerDocument: doc });
      for (const entry of tocEntries) {
        const button = element('button', { type: 'button', text: entry.label, ownerDocument: doc });
        listen(button, 'click', () => {
          const index = archive.pkg.spine.findIndex((item) => item.href === entry.href);
          if (index >= 0) void showChapter(index, { saveCurrent: true });
        });
        list.append(element('li', { ownerDocument: doc }, button));
      }
      toc.append(list);
    }
    const chapter = element('article', {
      class: 'epub-chapter', tabindex: '0', ownerDocument: doc,
    });
    applyTypography(chapter);
    reader.append(controls, toc, chapter);
    body.replaceChildren(reader);

    session = {
      book,
      ...archive,
      spineIndex: null,
      reader,
      chapter,
      previous,
      next,
    };

    listen(back, 'click', () => {
      void checkpoint().catch(() => {});
      void renderLibrary();
    });
    listen(tocButton, 'click', () => {
      const open = toc.classList.toggle('is-open');
      tocButton.setAttribute('aria-expanded', String(open));
    });
    listen(previous, 'click', () => {
      if (session && session.spineIndex > 0) {
        void showChapter(session.spineIndex - 1, { saveCurrent: true });
      }
    });
    listen(next, 'click', () => {
      if (session && session.spineIndex < session.pkg.spine.length - 1) {
        void showChapter(session.spineIndex + 1, { saveCurrent: true });
      }
    });
    listen(smaller, 'click', () => {
      fontSize = Math.max(FONT_SIZES.minimum, fontSize - FONT_SIZES.step);
      saveReaderPrefs({ fontSize });
      applyTypography(chapter);
    });
    listen(larger, 'click', () => {
      fontSize = Math.min(FONT_SIZES.maximum, fontSize + FONT_SIZES.step);
      saveReaderPrefs({ fontSize });
      applyTypography(chapter);
    });
    listen(fontSelect, 'change', (event) => {
      fontFamily = FONT_OPTIONS.some(({ id }) => id === event.currentTarget.value)
        ? event.currentTarget.value
        : 'serif';
      fontSelect.value = fontFamily;
      saveReaderPrefs({ fontFamily });
      applyTypography(chapter);
    });
    listen(lineSelect, 'change', (event) => {
      lineHeight = LINE_HEIGHTS.includes(event.currentTarget.value)
        ? event.currentTarget.value
        : '1.6';
      lineSelect.value = lineHeight;
      saveReaderPrefs({ lineHeight });
      applyTypography(chapter);
    });
    listen(chapter, 'click', (event) => {
      const href = targetSpineHref(event.target, chapter);
      if (!href || !session) return;
      event.preventDefault();
      const index = session.pkg.spine.findIndex((item) => item.href === href);
      if (index >= 0) void showChapter(index, { saveCurrent: true });
    });
    listen(root, 'scroll', () => { dirtyScroll = true; });
    if (typeof setIntervalFn === 'function') {
      intervalHandle = setIntervalFn(() => {
        if (!dirtyScroll || !session || disposed) return;
        dirtyScroll = false;
        void checkpoint().catch(() => {});
      }, 1_000);
    }

    const restoredIndex = Number.isInteger(position?.spineIndex)
      ? Math.min(archive.pkg.spine.length - 1, Math.max(0, position.spineIndex))
      : 0;
    const restoredFraction = Number.isFinite(position?.scrollFraction)
      ? Math.min(1, Math.max(0, position.scrollFraction))
      : 0;
    await showChapter(restoredIndex, { restoreFraction: restoredFraction });
  };

  async function openBook(bookId) {
    const token = ++revision;
    clearView();
    revokeLibraryUrls();
    revokeChapterUrls();
    session = null;
    body.replaceChildren(element('p', { text: 'Opening book…', ownerDocument: doc }));
    try {
      const library = await libraryDb();
      const book = await getBook(library, bookId);
      if (!book?.file?.arrayBuffer) throw codedError('bad-entry');
      const buffer = await book.file.arrayBuffer();
      if (!current(token)) return;
      const archive = await parseArchive(buffer, true);
      if (!current(token)) return;
      const position = await getPosition(library, bookId);
      if (!current(token)) return;
      await renderReader(book, archive, position, token);
    } catch (error) {
      if (!current(token)) return;
      const message = messageFor(error);
      const back = element('button', { type: 'button', text: 'Back to library', ownerDocument: doc });
      listen(back, 'click', () => { void renderLibrary(); });
      body.replaceChildren(
        element('p', { class: 'tool-error', role: 'alert', text: message, ownerDocument: doc }),
        back,
      );
      announce(message);
    }
  }

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    revision += 1;
    clearView();
    revokeLibraryUrls();
    revokeChapterUrls();
    session = null;
    if (mountedControllers.get(root) === dispose) mountedControllers.delete(root);
  };
  mountedControllers.set(root, dispose);
  void renderLibrary();
  return dispose;
}

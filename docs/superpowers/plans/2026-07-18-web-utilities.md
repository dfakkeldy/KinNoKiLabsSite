# Web Utilities ("Tools") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/tools` — a hub plus seven privacy-first, offline-capable, mobile-friendly utilities (QR generator, EPUB reader with on-device library, dilution calculator, contrast checker, word counter, unit converter, passphrase generator) built on the Arcade Hall pattern.

**Architecture:** Theme-routed pages (`Content/tools*.md` + `toolsMain(page:)` in the theme) with a single `/tools/ui.js` module loader that dynamic-imports one DOM-free engine + one `*-ui.js` controller per page — the games pattern, mirrored exactly. A `/tools/`-scoped service worker (network-first, cache fallback) plus a web manifest supplies offline use and Add-to-Home-Screen install.

**Tech Stack:** Browser-native JavaScript ES modules, `DecompressionStream('deflate-raw')`, IndexedDB, `crypto.getRandomValues`, Swift Publish (Plot) for routes, Node's built-in test runner with the repo's `Tests/games/dom-fixture.mjs`.

**Design Spec:** [Web Utilities Design](../specs/2026-07-18-web-utilities-design.md)

## Global Constraints

- **Zero third-party runtime dependencies.** The QR encoder, ZIP reader, and XML mini-parser are written in-repo. The only checked-in external *data* is the EFF large wordlist (CC-BY 3.0, attributed in the file header and on the passphrase page).
- **Everything on-device.** No accounts, backend, analytics, or uploads. Prefs live under the single localStorage key `kinnoki-tools:v1`; the EPUB library lives in IndexedDB database `kinnoki-tools-epub`. No other storage keys.
- Never edit `Output/` by hand; run `make generate` only in Task 19 before route tests.
- Controllers follow the dom-fixture rules (import `FixtureElement` from `Tests/games/dom-fixture.mjs`): build DOM only with `element()`/`createElement`/`append` (the fixture throws on non-empty `innerHTML`), no `setTimeout`-driven logic (use ticked `setInterval` or events), no layout reads (`getBoundingClientRect` etc.).
- Engines are DOM-free pure modules — importable and testable in plain Node with no browser globals. Anything needing a browser API takes it as an injectable parameter with a browser-native default.
- Copy casing: studio is **KinNoKi Labs**; the section is **Tools** in nav, "**Web tools**" as the hub h1 eyebrow style may follow the hub design in Task 1. Every tool page states: "Runs entirely in your browser. Nothing you enter leaves this device."
- Accessibility: every result update goes through the `.tools-live-region` announcer; all controls keyboard-operable with visible labels; new animation/transition classes get reduced-motion overrides in `Resources/styles.css`.
- All tools CSS lands in ONE new clearly-marked block appended at the end of `Resources/styles.css` (below the existing "Project additions" divider content), never interleaved with the handoff bundle above it.
- Conventional Commits; stage only task-owned files; run `make test-tools` after every task (`Tests/tools/routes.test.mjs` reads `Output/` and only exists from Task 19 — earlier tasks run focused test files).
- QR module rendering is always dark-modules-on-light-background regardless of site theme (scanners require it).
- Class names and exported function names in this plan are a public contract between tasks — do not rename without updating every consumer named in the Interfaces blocks.

## Execution Boundary

Implement on the current worktree branch `claude/web-utilities-page-plan-89b64f` (cut from `main`; this repo has no nightly/weekly ladder — the final PR targets `main`). The design spec and this plan are committed on it. Do not touch unrelated in-flight worktrees.

## Planned File Structure

### Create — content & theme

- `Content/tools.md` — hub page meta (frontmatter only).
- `Content/tools/qr-code.md`, `epub-reader.md`, `dilution.md`, `contrast.md`, `word-count.md`, `unit-converter.md`, `passphrase.md` — per-tool page meta (frontmatter only).

### Create — `Resources/tools/`

- `ui.js` — page loader: reads `data-tool-page`, dynamic-imports the controller.
- `core.js` — shared: `element()`, safe localStorage + `kinnoki-tools:v1` prefs, live-region announcer, `toolShell()`, locale-tolerant number parsing/formatting, clipboard helper, connectivity watcher, SW registration.
- `hub-ui.js` — `TOOLS` catalog + hub card grid + offline chip.
- `dilution.js` / `dilution-ui.js` — dilution engine / controller.
- `contrast.js` / `contrast-ui.js` — WCAG contrast engine / controller.
- `word-count.js` / `word-count-ui.js` — text analysis engine / controller.
- `unit-convert.js` / `unit-convert-ui.js` — unit conversion engine / controller.
- `wordlist.js` — EFF large wordlist as a frozen exported array (generated once, checked in).
- `passphrase.js` / `passphrase-ui.js` — passphrase engine / controller.
- `qr.js` / `qr-matrix.js` / `qr-ui.js` — QR codeword layer / matrix+mask layer / controller.
- `epub-zip.js` — minimal ZIP central-directory reader + on-demand inflate.
- `epub-xml.js` — tolerant mini XML parser (metadata files only).
- `epub-package.js` — container/OPF/nav/NCX parsing + zip-path resolution.
- `epub-store.js` — promisified IndexedDB wrapper for the library.
- `epub-sanitize.js` — chapter XHTML allowlist sanitizer over an injected node interface.
- `epub-reader-ui.js` — library grid + reader view controller.
- `sw.js` — section service worker.
- `manifest.webmanifest` — PWA manifest.
- `icons/icon-192.png`, `icons/icon-512.png` — install icons derived from `Resources/logo.png`.

### Create — `Tests/tools/`

One `<module>.test.mjs` per module above (engines and controllers), plus `routes.test.mjs` (reads `Output/`, Task 19). Controller tests import `FixtureElement` from `../games/dom-fixture.mjs`.

### Modify

- `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift` — `toolsMain(page:)`, eight `makePageHTML` cases, Tools nav link (desktop + mobile), tools-only manifest/theme-color head nodes.
- `Resources/styles.css` — one appended `/* ===== Tools ===== */` block.
- `Makefile` — `test-tools` target; `test: test-listen test-games test-tools`; `.PHONY` update.
- `CLAUDE.md` (and `AGENTS.md` if present) — Tools section docs (Task 19).

## Shared Interface Contracts (all tasks refer here)

```js
// core.js (Task 2)
export function element(tag, attrs = {}, ...children)      // -> Element; attrs.text sets textContent; other keys setAttribute
export function safeLocalStorage(scope)                     // -> Storage-like or null (try/catch guarded)
export function openToolPrefs(storage)                      // -> { version: 1, tools: {} } (validated; reset on corrupt)
export function saveToolPrefs(storage, prefs)               // -> boolean success
export function toolPrefs(prefs, toolId)                    // -> prefs.tools[toolId] ?? {} (never null)
export function setToolPrefs(storage, prefs, toolId, bag)   // merges + saves; returns new prefs object
export function parseDecimal(raw)                           // '1,5'|'1.5'|' 12 ' -> finite Number, else null
export function formatNumber(value, maxDecimals = 2)        // trims trailing zeros: 33.30 -> '33.3'
export function createAnnouncer(liveRegion)                 // -> (text) => void (replaces textContent)
export function toolShell(root, { title, lede })            // clears root, mounts h1+lede+privacy line, returns section.tool-body
export async function copyText(text, clipboard = navigator.clipboard) // -> boolean
export function watchConnectivity(target, onChange)         // online/offline events -> onChange(isOnline); returns dispose()
export function registerToolsServiceWorker(container = navigator.serviceWorker) // no-op when unsupported

// hub-ui.js (Task 1)
export const TOOLS // frozen array of 7: { id, title, tagline, href } in hub display order:
// qr-code, epub-reader, dilution, contrast, word-count, unit-converter, passphrase
export function renderToolsHub(root)                        // mounts hub cards; Task 18 adds offline chip

// dilution.js (Task 3)
export const VOLUME_UNITS // frozen [{ id:'ml', label:'ml', ml:1 }, l:1000, tsp:4.92892, tbsp:14.7868, floz:29.5735, cup:236.588, gal:3785.41]
export function convertVolume(value, fromId, toId)          // -> Number
export function roundMl(v)  // v<1 -> 2dp, v<100 -> 1dp, else 0dp (Number, not string)
export function computeGeneral({ stockPercent, targetPercent, totalMl })
//   -> { concentrateMl, waterMl } | { error: 'invalid' | 'target-exceeds-stock' }
export function computeRatio({ parts, totalMl })            // '1:parts' concentrate:water, total = c*(1+parts)
//   -> { concentrateMl, waterMl } | { error: 'invalid' }
export function computeDose({ dosePerL, totalL, multiplier = 1 }) // -> { doseMl } | { error: 'invalid' }
export function percentToParts(percent)                     // 3.03% -> ~32 (parts water per 1 concentrate); null when % invalid/100
export function partsToPercent(parts)                       // 32 -> 3.0303...

// contrast.js (Task 5)
export function hexToRgb(hex)                               // '#abc' | '#aabbcc' -> {r,g,b} | null
export function rgbToHex({ r, g, b })                       // -> '#rrggbb'
export function relativeLuminance({ r, g, b })              // WCAG 2.x sRGB
export function contrastRatio(hexA, hexB)                   // -> Number (>=1) | null on bad hex
export function verdicts(ratio) // -> { aaNormal>=4.5, aaLarge>=3, aaaNormal>=7, aaaLarge>=4.5, uiComponent>=3 } booleans
export function suggestPassing(fgHex, bgHex, target)        // adjusts fg lightness (HSL) -> '#rrggbb' | null when impossible

// word-count.js (Task 7)
export function analyzeText(text) // -> { characters, charactersNoSpaces, words, sentences, paragraphs, silentMinutes, aloudMinutes }
export function formatDuration(minutes)                     // -> 'under a minute' | '≈ 4 min' | '≈ 1 hr 12 min'
export const SILENT_WPM // 240
export const ALOUD_WPM  // 155

// unit-convert.js (Task 8)
export const CATEGORIES // frozen: length, mass, temperature, volume, area, speed, data
// each: { id, label, units: [{ id, label, factor }] } — factor = multiplier to the category base unit;
// temperature units instead: { id, label, toBase(v), fromBase(v) } (base kelvin)
export function convert(value, categoryId, fromId, toId)    // -> Number | null on unknown ids / non-finite

// passphrase.js (Task 9)
export function randomInt(maxExclusive, randomSource)       // rejection sampling; randomSource fills a Uint32Array
export function generatePassphrase({ words = 5, separator = '-', capitalize = false, includeNumber = false }, randomSource, wordlist)
//   -> { phrase, entropyBits }
export function generateString({ length = 20, lower = true, upper = true, digits = true, symbols = false }, randomSource)
//   -> { value, entropyBits } | { error: 'empty-charset' }
// wordlist.js: export const EFF_LARGE_WORDLIST // frozen array of exactly 7776 lowercase words

// qr.js (Task 11) — codeword layer
export function gfMul(a, b)                                 // GF(256), poly 0x11d
export function rsEncode(dataBytes, ecCount)                // -> Uint8Array of ecCount EC bytes
export function totalCodewords(version)                     // geometric derivation, versions 1..40
export const EC_TABLE // EC_TABLE[version][level] -> { ecPerBlock, groups: [[blockCount, dataPerBlock], ...] }; levels 'L'|'M'|'Q'|'H'
export function dataCapacity(version, level)                // byte-mode payload capacity in bytes
export function chooseVersion(byteLength, level)            // smallest fitting version | null
export function encodeToCodewords(bytes, version, level)    // -> Uint8Array (data+EC interleaved, spec order)
export function alignmentPositions(version)                 // -> number[] centers (algorithm, not a table)

// qr-matrix.js (Task 12) — matrix layer
export function buildMatrix(codewords, version, level)      // -> { size, modules: Uint8Array } best-mask matrix
export function generateQr(text, { level = 'M' } = {})      // TextEncoder UTF-8 -> { size, modules, version, level } | { error: 'too-long' | 'empty' }

// qr-ui.js (Task 13)
export function matrixToSvg(qr, { quietZone = 4 } = {})     // -> SVG string, viewBox = size+2*quietZone, one <path> of module rects

// epub-zip.js (Task 14)
export function parseZip(arrayBuffer)
//   -> { entries: Map<name, { method: 0|8, encrypted: bool, compressedSize, uncompressedSize, headerOffset }> }
//   throws { code: 'not-a-zip' | 'zip64-unsupported' }
export async function readEntry(arrayBuffer, entry, inflate = inflateWithDecompressionStream)
//   -> Uint8Array; throws { code: 'encrypted' | 'bad-entry' | 'unsupported-method' }
export async function inflateWithDecompressionStream(bytes) // DecompressionStream('deflate-raw')
export function supportsInflate()                            // feature-detect DecompressionStream

// epub-xml.js (Task 15)
export function parseXml(text)  // -> { name, attrs: {}, children: [], text: '' } tree (prefixes kept in name)
export function localName(name) // 'opf:item' -> 'item'
export function findAll(node, local)                        // depth-first descendants matching localName
export function findFirst(node, local)

// epub-package.js (Task 15)
export function resolveZipPath(baseFile, relative)          // OPF-relative href -> zip entry name ('..' handled, no leading '/')
export function parseContainer(xmlText)                     // -> opfPath | throws { code: 'bad-container' }
export function parsePackage(opfText, opfPath)
//   -> { title, author, coverHref, spine: [{ idref, href, mediaType }], manifest: Map<id, { href, mediaType, properties }>, navHref, ncxHref }
export function parseToc(xmlText, tocPath, kind)            // kind 'nav'|'ncx' -> [{ label, href }]

// epub-store.js (Task 16)
export function openLibrary(indexedDbFactory = indexedDB)   // -> Promise<db> name 'kinnoki-tools-epub' v1
// object stores: books { keyPath: 'id' }, positions { keyPath: 'bookId' }
export async function addBook(db, book)     // { id, title, author, addedAt, coverBlob|null, file: Blob }
export async function listBooks(db)         // -> book[] sorted addedAt desc
export async function getBook(db, id)
export async function deleteBook(db, id)    // also deletes its position
export async function savePosition(db, pos) // { bookId, spineIndex, scrollFraction, updatedAt }
export async function getPosition(db, bookId)

// epub-sanitize.js (Task 16)
export function sanitizeChapter(sourceRoot, { createElement, createTextNode, resolveImage, resolveLink })
// walks a DOM-like tree (nodeType/tagName/childNodes/attributes-as-getAttribute), returns a NEW tree of allowed
// nodes built with the injected factories. resolveImage(src) -> blobUrl|null (null drops the img);
// resolveLink(href) -> { external: true, href } | { spineHref } | null (null unwraps the <a> to its children).

// epub-reader-ui.js (Task 17)
export function renderEpubTool(root, deps)
// deps (all injectable for tests): { storage, prefs, announce, idb, inflate, domParser, urlFactory: { create, revoke } }

// ui.js (Task 1) — loader contract: dynamic-imports by data-tool-page:
// hub -> hub-ui.renderToolsHub, qr-code -> qr-ui.renderQrTool, epub-reader -> epub-reader-ui.renderEpubTool,
// dilution -> dilution-ui.renderDilutionTool, contrast -> contrast-ui.renderContrastTool,
// word-count -> word-count-ui.renderWordCountTool, unit-converter -> unit-convert-ui.renderUnitTool,
// passphrase -> passphrase-ui.renderPassphraseTool
// Every controller signature: render<Name>Tool(root, deps = {}) — deps default to browser globals inside the controller.
```

CSS class contract (all in the new Tools block of `Resources/styles.css`; animated classes mirrored in the reduced-motion overrides):

| Class | Purpose |
| --- | --- |
| `.tools-main`, `.tools-live-region`, `#tools-app` | page scaffold (live region visually hidden) |
| `.tool-hub-grid`, `.tool-card` | hub card grid (1-col mobile, 2-col ≥640px) |
| `.tool-shell`, `.tool-lede`, `.tool-privacy` | per-tool header block |
| `.tool-body`, `.tool-form`, `.tool-field`, `.tool-actions` | form scaffold (labels above inputs, 44px min touch targets) |
| `.tool-result`, `.tool-result-strong`, `.tool-error` | results + inline errors |
| `.tool-tabs`, `.tool-tab.is-active` | dilution mode tabs (buttons, `aria-pressed`) |
| `.tool-offline-chip` | "Offline — everything here still works" |
| `.qr-stage` | white-backed QR container (always light) |
| `.contrast-preview`, `.contrast-swatch` | contrast preview panels |
| `.epub-library-grid`, `.epub-book-card`, `.epub-drop.is-dragover` | library |
| `.epub-reader`, `.epub-chapter`, `.epub-toc.is-open`, `.epub-reader-controls` | reader |

---

### Task 1: Routes, nav, content stubs, hub, loader, Makefile

**Files:**
- Create: `Content/tools.md`, `Content/tools/{qr-code,epub-reader,dilution,contrast,word-count,unit-converter,passphrase}.md`
- Create: `Resources/tools/ui.js`, `Resources/tools/hub-ui.js`
- Modify: `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift`, `Resources/styles.css`, `Makefile`
- Test: `Tests/tools/hub.test.mjs`

**Interfaces:**
- Consumes: existing `siteHeader`/`siteFooter`/`siteHead`, `navLink`, `mobileLink`, games' `gamesMain` as template.
- Produces: `TOOLS`, `renderToolsHub(root)`, the `data-tool-page` + `#tools-app` page scaffold, `make test-tools`.

- [ ] **Step 1: Makefile.** Add `test-tools` to `.PHONY` and:

```make
test: test-listen test-games test-tools

test-tools:
	node --test Tests/tools/*.test.mjs
```

- [ ] **Step 2: Write failing test** `Tests/tools/hub.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { FixtureElement } from '../games/dom-fixture.mjs';
import { TOOLS, renderToolsHub } from '../../Resources/tools/hub-ui.js';

test('catalogue is frozen, seven tools, approved order and hrefs', () => {
  assert.equal(Object.isFrozen(TOOLS), true);
  assert.deepEqual(TOOLS.map(({ id, href }) => ({ id, href })), [
    { id: 'qr-code', href: '/tools/qr-code' },
    { id: 'epub-reader', href: '/tools/epub-reader' },
    { id: 'dilution', href: '/tools/dilution' },
    { id: 'contrast', href: '/tools/contrast' },
    { id: 'word-count', href: '/tools/word-count' },
    { id: 'unit-converter', href: '/tools/unit-converter' },
    { id: 'passphrase', href: '/tools/passphrase' },
  ]);
  for (const tool of TOOLS) {
    assert.equal(typeof tool.title, 'string');
    assert.ok(tool.tagline.length > 0);
  }
});

test('hub mounts one card per tool with title link', () => {
  const document = { activeElement: null };
  const root = new FixtureElement('div', document);
  renderToolsHub(root);
  const cards = root.children.filter((c) => (c.getAttribute('class') ?? '').includes('tool-hub-grid'))
    .flatMap((grid) => grid.children);
  assert.equal(cards.length, 7);
  assert.equal(cards[0].getAttribute('class'), 'tool-card');
});
```

(If `FixtureElement`'s API differs — check `Tests/games/dom-fixture.mjs` first — adapt traversal, not the contract.)

- [ ] **Step 3: Run** `node --test Tests/tools/hub.test.mjs` — FAIL (module not found).
- [ ] **Step 4: Implement `Resources/tools/hub-ui.js`.** No document.createElement at module scope. A local `element()` helper is fine here until Task 2 lands core.js — then hub-ui switches to importing it (Task 2 does that swap).

```js
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
  root.append(
    el(doc, 'header', { class: 'tool-shell' },
      el(doc, 'h1', { text: 'Web tools' }),
      el(doc, 'p', { class: 'tool-lede', text: 'Small, fast utilities. They load once, work offline, and keep everything on your device.' })),
    el(doc, 'div', { class: 'tool-hub-grid' },
      ...TOOLS.map((tool) => el(doc, 'article', { class: 'tool-card' },
        el(doc, 'h2', {}, el(doc, 'a', { href: tool.href, text: tool.title })),
        el(doc, 'p', { text: tool.tagline })))));
}
```

(`FixtureElement` must expose `ownerDocument`/`firstChild`/`remove` — verify in `dom-fixture.mjs`; if `ownerDocument` is absent, accept the document as `renderToolsHub(root, doc = root.ownerDocument ?? globalThis.document)`.)

- [ ] **Step 5: Implement `Resources/tools/ui.js`** (mirrors `Resources/games/ui.js` textual shape):

```js
const root = document.getElementById('tools-app');
const page = document.querySelector('[data-tool-page]')?.dataset.toolPage;

const controllers = {
  hub: () => import('./hub-ui.js').then(({ renderToolsHub }) => renderToolsHub(root)),
  'qr-code': () => import('./qr-ui.js').then(({ renderQrTool }) => renderQrTool(root)),
  'epub-reader': () => import('./epub-reader-ui.js').then(({ renderEpubTool }) => renderEpubTool(root)),
  dilution: () => import('./dilution-ui.js').then(({ renderDilutionTool }) => renderDilutionTool(root)),
  contrast: () => import('./contrast-ui.js').then(({ renderContrastTool }) => renderContrastTool(root)),
  'word-count': () => import('./word-count-ui.js').then(({ renderWordCountTool }) => renderWordCountTool(root)),
  'unit-converter': () => import('./unit-convert-ui.js').then(({ renderUnitTool }) => renderUnitTool(root)),
  passphrase: () => import('./passphrase-ui.js').then(({ renderPassphraseTool }) => renderPassphraseTool(root)),
};

(controllers[page] ?? controllers.hub)().catch((error) => {
  console.error('tools: failed to start', error);
  const notice = document.createElement('p');
  notice.className = 'tool-error';
  notice.textContent = 'This tool failed to load. Please refresh.';
  root.append(notice);
});
```

Until later tasks land the imported files, the missing-module rejection path is exercised — acceptable, the loader is only reachable per page.

- [ ] **Step 6: Theme.** In `KinNoKiTheme.swift`, below `gamesMain`, add:

```swift
private func toolsMain(page: String) -> Node<HTML.BodyContext> {
    .main(
        .class("site-main tools-main"),
        .attribute(named: "data-tool-page", value: page),
        .div(
            .class("tools-live-region"),
            .attribute(named: "aria-live", value: "polite")
        ),
        .div(
            .class("tools-app"),
            .attribute(named: "id", value: "tools-app")
        ),
        .element(named: "noscript", nodes: [
            .p(
                .class("tool-privacy"),
                .text("These tools need JavaScript. Everything runs and stays on your device.")
            )
        ]),
        .element(named: "script", nodes: [
            .attribute(named: "type", value: "module"),
            .attribute(named: "src", value: "/tools/ui.js")
        ])
    )
}
```

In `makePageHTML`, after the games cases add (explicit-case house style):

```swift
case "tools":                main = toolsMain(page: "hub");            active = "/tools"
case "tools/qr-code":        main = toolsMain(page: "qr-code");        active = "/tools"
case "tools/epub-reader":    main = toolsMain(page: "epub-reader");    active = "/tools"
case "tools/dilution":       main = toolsMain(page: "dilution");       active = "/tools"
case "tools/contrast":       main = toolsMain(page: "contrast");       active = "/tools"
case "tools/word-count":     main = toolsMain(page: "word-count");     active = "/tools"
case "tools/unit-converter": main = toolsMain(page: "unit-converter"); active = "/tools"
case "tools/passphrase":     main = toolsMain(page: "passphrase");     active = "/tools"
```

Nav: in `siteHeader`'s `.nav-links` add `navLink("/tools", "Tools", active)` directly after the Games link; in the mobile menu add `mobileLink("/tools", "Tools", active)` after Games likewise.

- [ ] **Step 7: Content stubs.** `Content/tools.md`:

```markdown
---
title: Tools
description: Seven small web utilities from KinNoKi Labs — QR codes, EPUB reading, dilution math, contrast checks and more. Offline-capable; everything stays on your device.
---
```

Per-tool stubs follow the same frontmatter-only shape (title + one-sentence description naming the tool; e.g. `Content/tools/qr-code.md` title `QR Code Generator`, description `Generate crisp QR codes as SVG or PNG, entirely in your browser.`). Write all seven.

- [ ] **Step 8: CSS.** Append to `Resources/styles.css` a new terminal block `/* ===== Tools (project addition) ===== */` defining the scaffold classes from the contract table: `.tools-main` (max-width 960px, centered, clamp padding like `.games-main`), visually-hidden `.tools-live-region` (absolute, 1px, clip), `.tool-hub-grid` (grid, gap 16px, `repeat(auto-fill, minmax(260px, 1fr))`), `.tool-card` (uses the existing card token treatment — copy the `.game-card` background/border/radius declarations), `.tool-shell`, `.tool-lede`, `.tool-privacy` (muted small), `.tool-form`/`.tool-field` (labels block, inputs full-width, `min-height:44px`), `.tool-actions`, `.tool-result`, `.tool-result-strong`, `.tool-error` (uses the existing error color token), `.tool-tabs`/`.tool-tab`/`.is-active`, `.qr-stage` (`background:#fff; padding:16px; border-radius:12px; max-width:320px`), `.contrast-preview`/`.contrast-swatch`, `.tool-offline-chip`. Follow the token variables used by the Arcade Hall block; no new animations in this task.

- [ ] **Step 9: Run** `node --test Tests/tools/hub.test.mjs` — PASS. Run `make test-games` (nav markup change must not break games route tests — those read `Output/`, unchanged until Task 19; if any source-string assertion in `Tests/games/` covers the header, update it in this commit).
- [ ] **Step 10: Build check** `swift build` — compiles.
- [ ] **Step 11: Commit** `feat(tools): add /tools routes, nav, hub catalog, loader, test target`

### Task 2: `core.js` shared helpers

**Files:**
- Create: `Resources/tools/core.js`
- Modify: `Resources/tools/hub-ui.js` (swap local `el` for core `element`)
- Test: `Tests/tools/core.test.mjs`

**Interfaces:**
- Produces: everything in the core.js contract block. Every later controller consumes `element`, `toolShell`, `createAnnouncer`, prefs, `parseDecimal`, `formatNumber`, `copyText`.

- [ ] **Step 1: Write failing tests** covering: `element` sets text/attrs/children; `openToolPrefs` returns fresh `{ version: 1, tools: {} }` on null storage, corrupt JSON, wrong version; `setToolPrefs` round-trips a bag under `kinnoki-tools:v1`; `parseDecimal('1,5') === 1.5`, `parseDecimal('1.5') === 1.5`, `parseDecimal(' 12 ') === 12`, `parseDecimal('') === null`, `parseDecimal('1.2.3') === null`, `parseDecimal('-3,5') === -3.5`; `formatNumber(33.3000) === '33.3'`, `formatNumber(50) === '50'`, `formatNumber(0.125, 2) === '0.13'`; `createAnnouncer` writes textContent; `toolShell` mounts h1/lede/`.tool-privacy` and returns `.tool-body`; `copyText` resolves true with a stub clipboard and false when it throws; `watchConnectivity` registers and disposes both listeners on a stub target. Storage stub: plain object with `getItem`/`setItem` capturing values; a throwing variant for the guard test.
- [ ] **Step 2: Run** `node --test Tests/tools/core.test.mjs` — FAIL.
- [ ] **Step 3: Implement `Resources/tools/core.js`:**

```js
export function element(tag, attrs = {}, ...children) {
  const doc = attrs.ownerDocument ?? document;
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'ownerDocument') continue;
    if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

export function safeLocalStorage(scope = globalThis) {
  try {
    const storage = scope.localStorage;
    const probe = '__kinnoki_tools_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch { return null; }
}

const PREFS_KEY = 'kinnoki-tools:v1';
const emptyPrefs = () => ({ version: 1, tools: {} });

export function openToolPrefs(storage) {
  if (!storage) return emptyPrefs();
  try {
    const parsed = JSON.parse(storage.getItem(PREFS_KEY) ?? '');
    if (parsed?.version === 1 && typeof parsed.tools === 'object' && parsed.tools !== null) return parsed;
  } catch { /* fall through */ }
  return emptyPrefs();
}

export function saveToolPrefs(storage, prefs) {
  if (!storage) return false;
  try { storage.setItem(PREFS_KEY, JSON.stringify(prefs)); return true; } catch { return false; }
}

export function toolPrefs(prefs, toolId) { return prefs.tools[toolId] ?? {}; }

export function setToolPrefs(storage, prefs, toolId, bag) {
  const next = { ...prefs, tools: { ...prefs.tools, [toolId]: { ...toolPrefs(prefs, toolId), ...bag } } };
  saveToolPrefs(storage, next);
  return next;
}

export function parseDecimal(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const text = String(raw).trim().replace(/\s+/g, '');
  if (!text) return null;
  const normalized = text.includes(',') && !text.includes('.') ? text.replace(',', '.') : text;
  if (!/^-?\d*\.?\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function formatNumber(value, maxDecimals = 2) {
  if (!Number.isFinite(value)) return '—';
  return String(Number(value.toFixed(maxDecimals)));
}

export function createAnnouncer(liveRegion) {
  return (text) => { if (liveRegion) liveRegion.textContent = text; };
}

export function toolShell(root, { title, lede }) {
  const doc = root.ownerDocument ?? document;
  while (root.firstChild) root.firstChild.remove();
  const body = element('section', { class: 'tool-body', ownerDocument: doc });
  root.append(
    element('header', { class: 'tool-shell', ownerDocument: doc },
      element('h1', { text: title, ownerDocument: doc }),
      element('p', { class: 'tool-lede', text: lede, ownerDocument: doc }),
      element('p', { class: 'tool-privacy', text: 'Runs entirely in your browser. Nothing you enter leaves this device.', ownerDocument: doc })),
    body);
  return body;
}

export async function copyText(text, clipboard = globalThis.navigator?.clipboard) {
  try { await clipboard.writeText(text); return true; } catch { return false; }
}

export function watchConnectivity(target, onChange) {
  const notify = () => onChange(target.navigator ? target.navigator.onLine !== false : true);
  target.addEventListener('online', notify);
  target.addEventListener('offline', notify);
  notify();
  return () => { target.removeEventListener('online', notify); target.removeEventListener('offline', notify); };
}

export function registerToolsServiceWorker(container = globalThis.navigator?.serviceWorker) {
  if (!container?.register) return;
  container.register('/tools/sw.js').catch(() => {});
}
```

(If the fixture's `element().append` API objects to any of this, adjust to the fixture, keeping exports stable. The `ownerDocument` attr passthrough exists solely so controllers can run on the fixture document.)

- [ ] **Step 4:** Swap `hub-ui.js`'s local `el` for `import { element } from './core.js';` adapting call sites (pass `ownerDocument: doc`).
- [ ] **Step 5: Run** `node --test Tests/tools/core.test.mjs Tests/tools/hub.test.mjs` — PASS.
- [ ] **Step 6: Commit** `feat(tools): shared core helpers (prefs, shell, announcer, parsing, clipboard)`

### Task 3: Dilution engine

**Files:** Create `Resources/tools/dilution.js`; Test `Tests/tools/dilution.test.mjs`

**Interfaces:** Produces the dilution.js contract block; consumed by Task 4.

- [ ] **Step 1: Write failing tests:**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VOLUME_UNITS, computeDose, computeGeneral, computeRatio,
  convertVolume, partsToPercent, percentToParts, roundMl,
} from '../../Resources/tools/dilution.js';

test('general: 3% target from 30% stock into 500 ml', () => {
  assert.deepEqual(computeGeneral({ stockPercent: 30, targetPercent: 3, totalMl: 500 }),
    { concentrateMl: 50, waterMl: 450 });
});
test('general: target stronger than stock is an error, not a clamp', () => {
  assert.deepEqual(computeGeneral({ stockPercent: 3, targetPercent: 30, totalMl: 500 }),
    { error: 'target-exceeds-stock' });
});
test('general: zero/negative/non-finite inputs are invalid', () => {
  for (const bad of [{ stockPercent: 0, targetPercent: 3, totalMl: 500 },
    { stockPercent: 30, targetPercent: -1, totalMl: 500 },
    { stockPercent: 30, targetPercent: 3, totalMl: 0 }]) {
    assert.deepEqual(computeGeneral(bad), { error: 'invalid' });
  }
});
test('ratio: 1:32 into a 1 L bottle', () => {
  const { concentrateMl, waterMl } = computeRatio({ parts: 32, totalMl: 1000 });
  assert.equal(roundMl(concentrateMl), 30.3);
  assert.equal(roundMl(waterMl), 969.7);
  assert.equal(roundMl(concentrateMl + waterMl), 1000);
});
test('dose: 2 ml/L at strong (1.5x) for a 9 L can', () => {
  assert.deepEqual(computeDose({ dosePerL: 2, totalL: 9, multiplier: 1.5 }), { doseMl: 27 });
});
test('percent/parts round-trip', () => {
  assert.equal(roundMl(percentToParts(partsToPercent(32))), 32);
  assert.equal(percentToParts(0), null);
  assert.equal(percentToParts(100), null);
});
test('volume conversion: tsp to ml and back', () => {
  const ml = convertVolume(3, 'tsp', 'ml');
  assert.ok(Math.abs(ml - 14.78676) < 0.001);
  assert.ok(Math.abs(convertVolume(ml, 'ml', 'tsp') - 3) < 1e-9);
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement:**

```js
export const VOLUME_UNITS = Object.freeze([
  Object.freeze({ id: 'ml', label: 'ml', ml: 1 }),
  Object.freeze({ id: 'l', label: 'L', ml: 1000 }),
  Object.freeze({ id: 'tsp', label: 'tsp (US)', ml: 4.92892 }),
  Object.freeze({ id: 'tbsp', label: 'tbsp (US)', ml: 14.7868 }),
  Object.freeze({ id: 'floz', label: 'fl oz (US)', ml: 29.5735 }),
  Object.freeze({ id: 'cup', label: 'cup (US)', ml: 236.588 }),
  Object.freeze({ id: 'gal', label: 'gal (US)', ml: 3785.41 }),
]);

const unitMl = (id) => VOLUME_UNITS.find((u) => u.id === id)?.ml ?? null;
const positive = (v) => Number.isFinite(v) && v > 0;

export function convertVolume(value, fromId, toId) {
  const from = unitMl(fromId); const to = unitMl(toId);
  if (from === null || to === null || !Number.isFinite(value)) return null;
  return (value * from) / to;
}

export function roundMl(v) {
  const dp = v < 1 ? 2 : v < 100 ? 1 : 0;
  return Number(v.toFixed(dp));
}

export function computeGeneral({ stockPercent, targetPercent, totalMl }) {
  if (![stockPercent, targetPercent, totalMl].every(positive) || stockPercent > 100) return { error: 'invalid' };
  if (targetPercent > stockPercent) return { error: 'target-exceeds-stock' };
  const concentrateMl = (targetPercent / stockPercent) * totalMl;
  return { concentrateMl, waterMl: totalMl - concentrateMl };
}

export function computeRatio({ parts, totalMl }) {
  if (![parts, totalMl].every(positive)) return { error: 'invalid' };
  const concentrateMl = totalMl / (1 + parts);
  return { concentrateMl, waterMl: totalMl - concentrateMl };
}

export function computeDose({ dosePerL, totalL, multiplier = 1 }) {
  if (![dosePerL, totalL, multiplier].every(positive)) return { error: 'invalid' };
  return { doseMl: dosePerL * totalL * multiplier };
}

export function partsToPercent(parts) {
  return positive(parts) ? 100 / (1 + parts) : null;
}

export function percentToParts(percent) {
  if (!positive(percent) || percent >= 100) return null;
  return 100 / percent - 1;
}
```

- [ ] **Step 4: Run** `node --test Tests/tools/dilution.test.mjs` — PASS. **Step 5: Commit** `feat(tools): dilution engine (general, ratio, dose modes)`

### Task 4: Dilution controller

**Files:** Create `Resources/tools/dilution-ui.js`; Test `Tests/tools/dilution-ui.test.mjs`

**Interfaces:**
- Consumes: core.js (`element`, `toolShell`, `createAnnouncer`, prefs, `parseDecimal`, `formatNumber`), dilution.js.
- Produces: `renderDilutionTool(root, deps = {})`.

- [ ] **Step 1: Write failing tests** (fixture document; `deps = { storage: stubStorage, announce: spy }`): mounts three `.tool-tab` buttons (General / Cleaning ratio / Plant feed) with `aria-pressed`, General active by default; General mode: setting stock 30, target 3, volume 500 + dispatching `input` renders `.tool-result-strong` containing `50 ml` and `450 ml`; target 30 / stock 3 renders `.tool-error` with the phrase `stronger than the stock`; Cleaning mode: clicking the `1:32` quick-pick button and 1 L bottle preset renders `30.3 ml`; Plant feed: dose 2, volume 9, strong renders `27 ml`; switching modes persists to prefs (`storage` captured JSON contains `"mode":"ratio"`); announcer called with the result text.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement `renderDilutionTool(root, deps = {})`:** resolve `{ storage = safeLocalStorage(), announce }` (build announcer from `document.querySelector('.tools-live-region')` when not injected). Structure: `toolShell(root, { title: 'Dilution Calculator', lede: 'Concentrate + water, without the algebra.' })`; `.tool-tabs` with three buttons switching a `mode` variable and re-rendering the form area (build-once per mode is fine — each mode rebuilds its `.tool-form` subtree); numeric inputs use `element('input', { type: 'text', inputmode: 'decimal', ... })` and `parseDecimal`; every input `input` event recomputes via the engine and patches the result paragraph: General → "Mix **{c} ml concentrate** + **{w} ml water**"; Ratio → same shape with the quick-pick row (`1:10 1:32 1:64 1:128` buttons + parts input) and bottle preset row (500 ml / 750 ml / 1 L / 5 L / custom input); Dose → dose-per-litre input, volume input with unit select (`L`/`gal` via `convertVolume`), weak(0.5)/normal(1)/strong(1.5) buttons → "Add **{d} ml** of feed". Errors render `.tool-error` text: `'target-exceeds-stock'` → "That target is stronger than the stock — dilution can only weaken it."; `'invalid'` → "Enter positive numbers to get a mix." All amounts through `roundMl` + `formatNumber`. Persist `{ mode }` (and last bottle/ratio) via `setToolPrefs(storage, prefs, 'dilution', bag)`; restore on mount. Announce result strings.
- [ ] **Step 4: Run** `node --test Tests/tools/dilution-ui.test.mjs` — PASS. **Step 5: Commit** `feat(tools): dilution calculator page (three modes)`

### Task 5: Contrast engine

**Files:** Create `Resources/tools/contrast.js`; Test `Tests/tools/contrast.test.mjs`

- [ ] **Step 1: Failing tests:** `hexToRgb('#fff')` → `{r:255,g:255,b:255}`; `hexToRgb('#1a2b3c')` exact; invalid (`'red'`, `'#12'`) → null; black/white ratio 21 (±0.01); same color → 1; the repo's own tokens: `contrastRatio('#d4af37', '#0b0b0c')` computed and asserted ≥ 7 (gold on near-black — compute the exact value while writing the test and pin it to 2 decimals); `verdicts(4.6)` → aaNormal true / aaaNormal false / aaLarge true / aaaLarge true / uiComponent true; `verdicts(2.9)` all false except none; `suggestPassing('#777777', '#888888', 4.5)` returns a hex whose `contrastRatio` vs `#888888` is ≥ 4.5; impossible case `suggestPassing('#808080', '#808080', 21)` → null; `rgbToHex(hexToRgb('#1a2b3c'))` round-trips.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement:**

```js
export function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  const raw = hex.trim().replace(/^#/, '');
  const six = /^[0-9a-f]{6}$/i.test(raw) ? raw
    : /^[0-9a-f]{3}$/i.test(raw) ? [...raw].map((c) => c + c).join('') : null;
  if (!six) return null;
  return {
    r: parseInt(six.slice(0, 2), 16),
    g: parseInt(six.slice(2, 4), 16),
    b: parseInt(six.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  const part = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

const channel = (v) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance({ r, g, b }) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(hexA, hexB) {
  const a = hexToRgb(hexA); const b = hexToRgb(hexB);
  if (!a || !b) return null;
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function verdicts(ratio) {
  return {
    aaNormal: ratio >= 4.5, aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7, aaaLarge: ratio >= 4.5,
    uiComponent: ratio >= 3,
  };
}

// HSL helpers only serve suggestPassing; not exported. l/s in 0-100, h in 0-360.
function rgbToHsl({ r, g, b }) {
  const rn = r / 255; const gn = g / 255; const bn = b / 255;
  const max = Math.max(rn, gn, bn); const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? ((gn - bn) / d + (gn < bn ? 6 : 0))
    : max === gn ? (bn - rn) / d + 2
    : (rn - gn) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }) {
  const sn = s / 100; const ln = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n) => ln - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}

export function suggestPassing(fgHex, bgHex, target) {
  const fg = hexToRgb(fgHex);
  if (!fg || !hexToRgb(bgHex)) return null;
  const base = rgbToHsl(fg);
  let best = null;
  for (let delta = 1; delta <= 100; delta += 1) {
    for (const sign of [1, -1]) {
      const l = base.l + sign * delta;
      if (l < 0 || l > 100) continue;
      const candidate = rgbToHex(hslToRgb({ ...base, l }));
      if (contrastRatio(candidate, bgHex) >= target) { best = candidate; break; }
    }
    if (best) break;
  }
  return best;
}
```

Write `rgbToHsl`/`hslToRgb` in full with the standard formulas (l in 0–100). The nearest-first delta scan guarantees the minimal-change suggestion.

- [ ] **Step 4: Run** — PASS. **Step 5: Commit** `feat(tools): WCAG contrast engine with pass-nudging suggestions`

### Task 6: Contrast controller

**Files:** Create `Resources/tools/contrast-ui.js`; Test `Tests/tools/contrast-ui.test.mjs`

- [ ] **Step 1: Failing tests:** mounts two `.tool-field` groups each holding a text input (`value` defaults `#d4af37` foreground, `#0b0b0c` background) and an `input[type=color]` kept in sync; typing a pair updates a `.tool-result-strong` ratio text (e.g. `Contrast 8.2 : 1` — compute expected from the engine, don't hard-code blind) and five verdict rows with pass/fail text (`AA normal text — pass`); an invalid hex shows `.tool-error` and no verdicts; when the pair fails the chosen target a `Suggest a fix` button appears and clicking it replaces the foreground input value with `suggestPassing(...)`'s output and re-renders as passing; two `.contrast-swatch` previews get inline `style` background/color pairs both polarities.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** `renderContrastTool(root, deps = {})`: shell → form with fg/bg fields (text input + color input; `input` on either syncs the other when the hex is valid), verdict list rendered as a `ul` of five rows each "label — pass/fail" plus the ratio headline via `formatNumber(ratio, 2)`, preview block: `.contrast-preview` with two `.contrast-swatch` paragraphs (sample sentence, fg-on-bg and bg-on-fg), suggestion row targeting AA normal (4.5) by default with a select for 3 / 4.5 / 7. Persist last pair in prefs bag `contrast`. Announce "Contrast {ratio} to 1 — {AA normal pass|fail}".
- [ ] **Step 4: Run** — PASS. **Step 5: Commit** `feat(tools): contrast checker page`

### Task 7: Word counter (engine + controller)

**Files:** Create `Resources/tools/word-count.js`, `word-count-ui.js`; Test `Tests/tools/word-count.test.mjs`, `word-count-ui.test.mjs`

- [ ] **Step 1: Failing engine tests:** empty text → all zero counts, `silentMinutes === 0`; a known 100-word English paragraph → `words === 100`, sentences counted by terminal punctuation via `Intl.Segmenter('en', { granularity: 'sentence' })`, paragraphs = blank-line-separated blocks; CJK: `analyzeText('日本語のテキストです。')` counts words > 1 (Segmenter word granularity, `isWordLike` only) and characters exactly; `charactersNoSpaces` excludes all whitespace; `silentMinutes === words / 240`, `aloudMinutes === words / 155`; `formatDuration(0.3) === 'under a minute'`, `formatDuration(3.6) === '≈ 4 min'`, `formatDuration(72) === '≈ 1 hr 12 min'`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement engine:**

```js
export const SILENT_WPM = 240;
export const ALOUD_WPM = 155;

export function analyzeText(text) {
  const value = typeof text === 'string' ? text : '';
  const characters = [...value].length;
  const charactersNoSpaces = [...value.replace(/\s/gu, '')].length;
  const words = value.trim()
    ? [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(value)]
      .filter((s) => s.isWordLike).length
    : 0;
  const sentences = value.trim()
    ? [...new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(value)]
      .filter((s) => s.segment.trim().length > 0).length
    : 0;
  const paragraphs = value.trim() ? value.split(/\n\s*\n/).filter((p) => p.trim()).length : 0;
  return {
    characters, charactersNoSpaces, words, sentences, paragraphs,
    silentMinutes: words / SILENT_WPM, aloudMinutes: words / ALOUD_WPM,
  };
}

export function formatDuration(minutes) {
  if (minutes < 1) return 'under a minute';
  const whole = Math.round(minutes);
  if (whole < 60) return `≈ ${whole} min`;
  return `≈ ${Math.floor(whole / 60)} hr ${whole % 60} min`;
}
```

- [ ] **Step 4:** Engine tests PASS. **Step 5: Failing controller tests:** mounts a labeled `textarea.tool-field`; `input` event renders a stats list (`Words 100`, `Characters …`, `Sentences …`, `Paragraphs …`, `Silent reading ≈ …`, `Read aloud ≈ …`); a `Clear` button empties it; nothing is written to storage (assert stub storage never touched). **Step 6:** Implement `renderWordCountTool` (shell, textarea, `dl` stats patched in place, announce "{words} words"). **Step 7:** All PASS. **Step 8: Commit** `feat(tools): word counter with reading and narration time`

### Task 8: Unit converter (engine + controller)

**Files:** Create `Resources/tools/unit-convert.js`, `unit-convert-ui.js`; Test `Tests/tools/unit-convert.test.mjs`, `unit-convert-ui.test.mjs`

- [ ] **Step 1: Failing engine tests:** every category id present in order `length, mass, temperature, volume, area, speed, data`; `convert(1, 'length', 'km', 'm') === 1000`; `convert(1, 'length', 'mi', 'km')` ≈ 1.609344; `convert(100, 'temperature', 'c', 'f') === 212`; `convert(0, 'temperature', 'k', 'c') === -273.15`; `convert(1, 'data', 'gib', 'mb')` ≈ 1073.741824; round-trip property for every unit pair in every category (`convert(convert(x, c, a, b), c, b, a)` ≈ x); unknown ids → null.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement:** `CATEGORIES` with: length m-base (mm 0.001, cm 0.01, m 1, km 1000, in 0.0254, ft 0.3048, yd 0.9144, mi 1609.344); mass kg-base (g 0.001, kg 1, t 1000, oz 0.0283495231, lb 0.45359237, st 6.35029318); temperature kelvin-base with `toBase`/`fromBase` for c/f/k; volume L-base (ml 0.001, l 1, tsp 0.00492892, tbsp 0.0147868, floz 0.0295735, cup 0.236588, pt 0.473176, gal 3.78541); area m²-base (cm2 0.0001, m2 1, ha 10000, km2 1e6, ft2 0.09290304, ac 4046.8564224); speed m/s-base (kmh 1/3.6, mph 0.44704, ms 1, kn 0.514444); data byte-base (b 1, kb 1e3, mb 1e6, gb 1e9, tb 1e12, kib 1024, mib 1048576, gib 1073741824). `convert` resolves the category, handles temperature via toBase/fromBase, else factor math; null on any unknown/non-finite.
- [ ] **Step 4:** PASS. **Step 5: Failing controller tests:** category select re-populates the two unit selects; two linked number inputs — editing either converts into the other (`input` events); switching category restores last-used units from prefs; result formatted with `formatNumber(v, 6)`. **Step 6:** Implement `renderUnitTool` (shell, category select, two field groups each input+unit-select, conversion on any input/select change, prefs bag `unit-converter` `{ category, from, to }`, announce "1 km = 1000 m" style). **Step 7:** PASS. **Step 8: Commit** `feat(tools): unit converter (seven categories)`

### Task 9: Wordlist + passphrase engine

**Files:** Create `Resources/tools/wordlist.js` (generated), `Resources/tools/passphrase.js`; Test `Tests/tools/passphrase.test.mjs`

- [ ] **Step 1: Generate the wordlist module** (one-time; network fetch of public data, checked in):

```bash
curl -fsSL https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt -o /tmp/eff_large_wordlist.txt
node -e "
const fs = require('fs');
const words = fs.readFileSync('/tmp/eff_large_wordlist.txt', 'utf8')
  .trim().split('\n').map((line) => line.split('\t')[1]);
if (words.length !== 7776 || words.some((w) => !/^[a-z]+$/.test(w))) throw new Error('bad list: ' + words.length);
fs.writeFileSync('Resources/tools/wordlist.js',
  '// EFF Large Wordlist — https://www.eff.org/dice — CC BY 3.0 (Electronic Frontier Foundation).\n'
  + 'export const EFF_LARGE_WORDLIST = Object.freeze(' + JSON.stringify(words) + ');\n');
"
```

(Some list entries contain hyphens; if the regex rejects the authentic list, relax it to `/^[a-z-]+$/` — the count check is the real gate.)

- [ ] **Step 2: Failing tests:** `EFF_LARGE_WORDLIST.length === 7776`, frozen, all lowercase; `randomInt(10, source)` with a stub source returning fixed Uint32 values → deterministic result; rejection sampling: a source first yielding a value in the biased tail (e.g. for max 7776: `4294945296`) then `0` calls the source twice and returns 0; `generatePassphrase({ words: 5, separator: '-' }, seqSource, list)` → 5 words joined by `-`, `entropyBits` ≈ `5 * Math.log2(7776)` (2 dp); `capitalize: true` capitalizes each word; `includeNumber: true` appends one digit 0-9 to exactly one word; `generateString({ length: 20, symbols: false }, source)` → length 20 drawn only from lower+upper+digits, `entropyBits === 20 * Math.log2(62)`; all-toggles-off → `{ error: 'empty-charset' }`.
- [ ] **Step 3: Run** — FAIL. **Step 4: Implement:**

```js
export function randomInt(maxExclusive, randomSource) {
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  for (;;) {
    randomSource(buffer);
    if (buffer[0] < limit) return buffer[0] % maxExclusive;
  }
}

const defaultSource = (buffer) => crypto.getRandomValues(buffer);

export function generatePassphrase(options, randomSource = defaultSource, wordlist) {
  const { words = 5, separator = '-', capitalize = false, includeNumber = false } = options ?? {};
  const picked = Array.from({ length: words },
    () => wordlist[randomInt(wordlist.length, randomSource)]);
  const cased = capitalize ? picked.map((w) => w[0].toUpperCase() + w.slice(1)) : [...picked];
  let entropyBits = words * Math.log2(wordlist.length);
  if (includeNumber) {
    const slot = randomInt(words, randomSource);
    cased[slot] += String(randomInt(10, randomSource));
    entropyBits += Math.log2(words * 10);
  }
  return { phrase: cased.join(separator), entropyBits };
}

const CHARSETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?',
};

export function generateString(options, randomSource = defaultSource) {
  const { length = 20, lower = true, upper = true, digits = true, symbols = false } = options ?? {};
  const alphabet = Object.entries({ lower, upper, digits, symbols })
    .filter(([, on]) => on).map(([key]) => CHARSETS[key]).join('');
  if (!alphabet) return { error: 'empty-charset' };
  const value = Array.from({ length },
    () => alphabet[randomInt(alphabet.length, randomSource)]).join('');
  return { value, entropyBits: length * Math.log2(alphabet.length) };
}
```

- [ ] **Step 5:** PASS. **Step 6: Commit** `feat(tools): passphrase engine + EFF wordlist (CC BY 3.0, attributed)`

### Task 10: Passphrase controller

**Files:** Create `Resources/tools/passphrase-ui.js`; Test `Tests/tools/passphrase-ui.test.mjs`

- [ ] **Step 1: Failing tests** (inject `randomSource` stub through deps): two `.tool-tab` mode buttons (Passphrase / Random string); passphrase form: word-count select 3–8 (default 5), separator select, capitalize + number checkboxes, Generate button → `.tool-result-strong` shows the deterministic phrase, entropy line shows `~64 bits` style text and a plain-language tier (`< 45 weak`, `45–70 good`, `> 70 strong` — label thresholds asserted); string mode: length input + four checkboxes → deterministic value; Copy button calls the injected clipboard and announces `Copied`; nothing persisted to storage except the mode + options bag (assert prefs JSON contains no generated value).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** `renderPassphraseTool(root, deps = {})` (shell; tabs; forms per contract; result only rendered after Generate click; entropy line via `formatNumber(entropyBits, 0)` + tier text; wordlist attribution line `Wordlist: EFF large wordlist (CC BY 3.0)` as a muted paragraph; prefs bag `passphrase` `{ mode, words, separator, capitalize, includeNumber, length, lower, upper, digits, symbols }`).
- [ ] **Step 4:** PASS. **Step 5: Commit** `feat(tools): passphrase generator page`

### Task 11: QR codeword layer

**Files:** Create `Resources/tools/qr.js`; Test `Tests/tools/qr.test.mjs`

**Interfaces:** Produces gf/rs/tables/encode contract; consumed by Task 12.

> **Data integrity note.** `EC_TABLE` below is transcribed from the published QR block tables. The consistency test in Step 1 checks EVERY version×level row against the geometrically derived `totalCodewords(version)` — a mistranscribed row fails by name. If a row fails, correct that row (the expected total in the failure message pins the sum `Σ blocks×(data+ec)`); end-to-end scanning in Task 19 is the final backstop.

- [ ] **Step 1: Failing tests:**

```js
test('gfMul agrees with peasant multiplication for 200 random pairs', () => {
  const peasant = (a, b) => { // independent reference implementation
    let result = 0;
    while (b) {
      if (b & 1) result ^= a;
      b >>= 1;
      a <<= 1;
      if (a & 0x100) a ^= 0x11d;
    }
    return result;
  };
  for (let i = 0; i < 200; i += 1) {
    const a = (i * 37 + 11) % 256; const b = (i * 91 + 5) % 256;
    assert.equal(gfMul(a, b), peasant(a, b), `${a}*${b}`);
  }
});

test('rsEncode: message+ecc divides cleanly by the generator (remainder 0)', () => {
  const data = Uint8Array.from({ length: 19 }, (_, i) => (i * 17 + 3) & 0xff);
  const ecc = rsEncode(data, 7);
  assert.equal(ecc.length, 7);
  // re-dividing [data, ecc] by the generator must leave an all-zero remainder
  assert.deepEqual([...rsEncode(Uint8Array.from([...data, ...ecc]), 7)], new Array(7).fill(0));
});

test('totalCodewords matches known anchors', () => {
  assert.equal(totalCodewords(1), 26);
  assert.equal(totalCodewords(2), 44);
  assert.equal(totalCodewords(3), 70);
  assert.equal(totalCodewords(40), 3706);
});

test('EC_TABLE is internally consistent for all 40 versions x 4 levels', () => {
  for (let v = 1; v <= 40; v += 1) {
    for (const level of ['L', 'M', 'Q', 'H']) {
      const { ecPerBlock, groups } = EC_TABLE[v][level];
      const sum = groups.reduce((acc, [blocks, data]) => acc + blocks * (data + ecPerBlock), 0);
      assert.equal(sum, totalCodewords(v), `v${v}${level}`);
    }
  }
});

test('v1 anchors match the published table', () => {
  assert.deepEqual(EC_TABLE[1], {
    L: { ecPerBlock: 7, groups: [[1, 19]] },
    M: { ecPerBlock: 10, groups: [[1, 16]] },
    Q: { ecPerBlock: 13, groups: [[1, 13]] },
    H: { ecPerBlock: 17, groups: [[1, 9]] },
  });
});

test('chooseVersion and capacity boundaries', () => {
  assert.equal(dataCapacity(1, 'L'), 17); // 19 data codewords - 2 header bytes
  assert.equal(chooseVersion(17, 'L'), 1);
  assert.equal(chooseVersion(18, 'L'), 2);
  assert.equal(chooseVersion(999999, 'L'), null);
});

test('encodeToCodewords: v1-M layout (mode nibble, count, terminator, padding)', () => {
  const bytes = new TextEncoder().encode('AB');
  const cw = encodeToCodewords(bytes, 1, 'M');
  assert.equal(cw.length, 26);
  assert.equal(cw[0], 0b01000000); // 0100 mode + high nibble of count(2)=0000
  assert.equal(cw[1], 0b00100100); // low nibble of count (0010) + high nibble of 'A'(0x41)
  // pad bytes alternate 0xec/0x11 after data+terminator
  assert.equal(cw[15], 0xec);
  assert.equal(cw[14], 0x11);
});
```

Also assert byte-mode uses 16-bit counts for versions ≥ 10 (`encodeToCodewords(new Uint8Array(300), 10, 'L')` header layout) — write the exact expected first two bytes when implementing. And alignment-position anchors + structure:

```js
test('alignmentPositions: anchors and structure', () => {
  assert.deepEqual(alignmentPositions(1), []);
  assert.deepEqual(alignmentPositions(2), [6, 18]);
  assert.deepEqual(alignmentPositions(7), [6, 22, 38]);
  for (let v = 2; v <= 40; v += 1) {
    const positions = alignmentPositions(v);
    const size = 17 + 4 * v;
    assert.equal(positions.length, Math.floor(v / 7) + 2, `v${v} count`);
    assert.equal(positions[0], 6, `v${v} first`);
    assert.equal(positions.at(-1), size - 7, `v${v} last`);
    for (let i = 2; i < positions.length; i += 1) {
      assert.equal(positions[i] - positions[i - 1], positions[2] - positions[1], `v${v} even spacing`);
    }
  }
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** GF exp/log tables built at module load (generator 2, poly 0x11d); `gfMul` via log tables with zero guards. `rsGeneratorPoly(n)` = product of `(x - 2^i)` for i in 0..n-1, cached per degree. `rsEncode` = polynomial long division remainder.

`alignmentPositions` lives HERE (qr.js), computed with the exact spec-reproducing algorithm — no 39-row table to transcribe:

```js
export function alignmentPositions(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const size = 17 + 4 * version;
  const step = version === 32 ? 26
    : Math.ceil((version * 4 + 4) / (count * 2 - 2) / 2) * 2;
  const positions = [6];
  for (let i = count - 1, pos = size - 7; i >= 1; i -= 1, pos -= step) positions[i] = pos;
  return positions;
}
```

`totalCodewords(version)` is derived correct-by-construction: mark every function-pattern module on a scratch grid exactly as the matrix builder will, then count what's left. Overlaps (alignment-on-timing) cost nothing because marking is idempotent:

```js
export function totalCodewords(version) {
  const size = 17 + 4 * version;
  const reserved = new Uint8Array(size * size);
  const mark = (x, y) => { reserved[y * size + x] = 1; };
  for (let d = 0; d < 9; d += 1) {
    for (let e = 0; e < 9; e += 1) {
      mark(d, e);                                       // TL finder+separator+format (9x9)
      if (d < 8) mark(size - 1 - d, e);                 // TR (8 wide x 9 tall incl. format row)
      if (e < 8) mark(d, size - 1 - e);                 // BL (9 wide x 8 tall incl. format col + dark module)
    }
  }
  for (let i = 0; i < size; i += 1) { mark(i, 6); mark(6, i); } // timing
  const centers = alignmentPositions(version);
  const last = centers.length - 1;
  centers.forEach((cx, ix) => centers.forEach((cy, iy) => {
    const cornered = (ix === 0 && iy === 0) || (ix === 0 && iy === last) || (ix === last && iy === 0);
    if (cornered) return;                               // would collide with a finder
    for (let dx = -2; dx <= 2; dx += 1) for (let dy = -2; dy <= 2; dy += 1) mark(cx + dx, cy + dy);
  }));
  if (version >= 7) {
    for (let a = 0; a < 6; a += 1) {
      for (let b = 0; b < 3; b += 1) { mark(size - 11 + b, a); mark(a, size - 11 + b); } // version info x2
    }
  }
  let free = 0;
  for (const cell of reserved) if (!cell) free += 1;
  return Math.floor(free / 8);
}
```

Extend the anchors test with `totalCodewords(7) === 196` to pin the version-info branch. Then `EC_TABLE`: full literal for versions 1–40 × L/M/Q/H in `{ ecPerBlock, groups }` form. Versions 1–5 verbatim (extend the anchor test to cover all five):

```js
1: { L: { ecPerBlock: 7,  groups: [[1, 19]] },  M: { ecPerBlock: 10, groups: [[1, 16]] },
     Q: { ecPerBlock: 13, groups: [[1, 13]] },  H: { ecPerBlock: 17, groups: [[1, 9]] } },
2: { L: { ecPerBlock: 10, groups: [[1, 34]] },  M: { ecPerBlock: 16, groups: [[1, 28]] },
     Q: { ecPerBlock: 22, groups: [[1, 22]] },  H: { ecPerBlock: 28, groups: [[1, 16]] } },
3: { L: { ecPerBlock: 15, groups: [[1, 55]] },  M: { ecPerBlock: 26, groups: [[1, 44]] },
     Q: { ecPerBlock: 18, groups: [[2, 17]] },  H: { ecPerBlock: 22, groups: [[2, 13]] } },
4: { L: { ecPerBlock: 20, groups: [[1, 80]] },  M: { ecPerBlock: 18, groups: [[2, 32]] },
     Q: { ecPerBlock: 26, groups: [[2, 24]] },  H: { ecPerBlock: 16, groups: [[4, 9]] } },
5: { L: { ecPerBlock: 26, groups: [[1, 108]] }, M: { ecPerBlock: 24, groups: [[2, 43]] },
     Q: { ecPerBlock: 18, groups: [[2, 15], [2, 16]] }, H: { ecPerBlock: 22, groups: [[2, 11], [2, 12]] } },
```

Complete 6–40 from the published QR block table; the 160-row consistency test names any row whose sums don't match `totalCodewords`, and Task 19's real-scanner check is the end-to-end gate. `dataCapacity(v, level)` = Σ blocks×data − (v < 10 ? 2 : 3) for byte mode (mode nibble + count bits + terminator rounding — verify against the v1-L anchor of 17 and v10 boundary in tests; count is 8 bits for v1–9, 16 bits for v10+). `chooseVersion` scans 1–40. `encodeToCodewords`: bit-writer → mode `0100`, count (8/16 bits), data bytes, ≤4 terminator zeros, pad to byte, alternate `0xec`/`0x11` to fill data capacity; split into blocks per `groups` (group order: smaller-data blocks first, exactly as the table rows are ordered); `rsEncode` per block; interleave data codewords column-wise then EC codewords column-wise.
- [ ] **Step 4: Run** `node --test Tests/tools/qr.test.mjs` — ALL PASS, including all 160 consistency rows. Fix any named row before proceeding.
- [ ] **Step 5: Commit** `feat(tools): QR codeword layer (GF/RS, block tables, byte-mode encoding)`

### Task 12: QR matrix layer

**Files:** Create `Resources/tools/qr-matrix.js`; Test `Tests/tools/qr-matrix.test.mjs`

- [ ] **Step 1: Failing tests:** `buildMatrix` for v1: size 21; the three finder rings exact (assert the 7×7 pattern at (0,0), (14,0), (0,14) plus white separators); timing row/col 6 alternates; dark module at (8, size−8) === 1; every module is 0 or 1 (no unset cells); format info: build with forced mask 0 level M (expose internal `formatBits(level, mask)` for the test) === `0b101010000010010`; placement round-trip: expose `dataRegionIterator(size, version)`; re-reading placed bits in iterator order and de-masking with the chosen mask reproduces `encodeToCodewords`'s bit stream; `generateQr('')` → `{ error: 'empty' }`; `generateQr('a'.repeat(5000), { level: 'H' })` → `{ error: 'too-long' }`; `generateQr('https://kinnokilabs.com')` → version ≥ 1, size === 17+4×version.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** Import `alignmentPositions` from `./qr.js` (Task 11). Matrix build: Uint8Array size², parallel `reserved` mask; draw finders+separators, timing, alignment (skip any overlapping a finder), dark module, reserve format/version areas; `dataRegionIterator` yields (col,row) pairs in the two-column zigzag (right-to-left pairs, skipping col 6, alternating up/down); place bits; for mask 0–7 apply mask condition to non-reserved cells, compute penalty N1 (runs ≥5: 3+overflow), N2 (2×2 blocks: 3 each), N3 (1011101 with 4-light flank patterns: 40 each), N4 (dark-ratio deviation: 10 per 5%); pick lowest; write format bits (BCH(15,5), generator 0x537, mask 0x5412) into both locations, version info (BCH(18,6), generator 0x1f25) for v≥7. `formatBits(level, mask)`: level bits L=01, M=00, Q=11, H=10. `generateQr`: TextEncoder → bytes; `chooseVersion`; `encodeToCodewords`; `buildMatrix`.
- [ ] **Step 4: Run** — PASS. **Step 5: Commit** `feat(tools): QR matrix layer (placement, masking, format/version info)`

### Task 13: QR controller

**Files:** Create `Resources/tools/qr-ui.js`; Test `Tests/tools/qr-ui.test.mjs`

- [ ] **Step 1: Failing tests:** `matrixToSvg({ size: 21, modules })` returns a string starting `<svg` with `viewBox="0 0 29 29"` (21 + 2×4 quiet zone), `fill="#000"` path data containing one `M` per dark run start, white `rect` background, `shape-rendering="crispEdges"`, `role="img"` and an `aria-label`; controller: mounts text input + EC select (L/M/Q/H default M) + `.qr-stage`; typing `https://kinnokilabs.com` renders an `svg` child inside `.qr-stage` and a capacity hint (`Version N · M error correction`); clearing the input empties the stage and shows the lede hint; too-long input shows `.tool-error`; Download SVG button triggers the injected `urlFactory.create` with a Blob and an anchor click (assert via stub deps `{ urlFactory, announce }`); PNG button draws to an injected canvas factory (stub returns a recording 2d context; assert `fillRect` count equals dark module count and `toBlob`/`toDataURL` called).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** `matrixToSvg`: background rect + single `<path>` accumulating `M{x} {y}h1v1h-1z` per dark module (runs optional), `fill:#000` on `#fff`, quiet zone via viewBox offset. Controller `renderQrTool(root, deps = {})`: shell; input (`input` event, no debounce needed — generation is fast for typical strings; regenerate on every event); EC select persisted in prefs bag `qr-code`; stage renders via `element('div')` + `insertAdjacentHTML`? — NO: fixture forbids innerHTML; build the SVG as a real node: `matrixToSvg` stays a string for download, and the live preview uses a namespaced factory `svgFromMatrix(qr, doc)` building `<svg>`/`<path>` with `doc.createElementNS` fallback to `createElement` (fixture lacks NS) — same path data string. Downloads: SVG → `new Blob([svgString])`; PNG → canvas (deps.canvasFactory default `document.createElement('canvas')`), scale 8px/module + quiet zone, `fillRect` per dark module, `toBlob` → anchor download `qr-code.png`. Copy button copies the input's generated SVG string? No — copies the PNG blob via `ClipboardItem` when available, else falls back to downloading; announce outcomes.
- [ ] **Step 4: Run** — PASS. **Step 5: Commit** `feat(tools): QR generator page (SVG/PNG/download/copy)`

### Task 14: EPUB ZIP layer

**Files:** Create `Resources/tools/epub-zip.js`; Test `Tests/tools/epub-zip.test.mjs`

- [ ] **Step 1: Failing tests.** Build fixtures in-test with a `buildZip(entries)` helper (provide in the test file: writes local headers `0x04034b50`, central records `0x02014b50`, EOCD `0x06054b50`; uses `node:zlib.deflateRawSync` for method 8, CRC via `node:zlib.crc32` if available else a small crc32 table in the helper). Cases: two stored + one deflated entry parse (names, sizes, methods); `readEntry` returns exact bytes for stored and deflated (inflate default — Node ≥ 18 has global `DecompressionStream`; if absent in CI, inject `zlib`-based inflate); encrypted flag (bit 0 of general purpose flags) → `readEntry` throws `{ code: 'encrypted' }`; garbage buffer → `parseZip` throws `{ code: 'not-a-zip' }`; EOCD located even with a trailing comment; entry with `0xffffffff` sizes → `{ code: 'zip64-unsupported' }`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** `parseZip`: scan backwards from the end for EOCD signature (within last 65557 bytes); read central directory offset/count; walk central records collecting name (UTF-8 decode), method, flags bit 0 → `encrypted`, sizes, local header offset. `readEntry`: seek `headerOffset`, verify `0x04034b50`, skip the LOCAL header's own name/extra lengths (read them from the local header — they can differ from central), slice `compressedSize` bytes; method 0 → copy; method 8 → `await inflate(bytes)`; else `unsupported-method`; encrypted → throw before slicing. `inflateWithDecompressionStream`: pipe a `Blob` stream through `new DecompressionStream('deflate-raw')` → `new Response(...).arrayBuffer()`. `supportsInflate()` = `typeof DecompressionStream === 'function'`.
- [ ] **Step 4: Run** — PASS. **Step 5: Commit** `feat(tools): dependency-free zip reader with native inflate`

### Task 15: EPUB XML + package layer

**Files:** Create `Resources/tools/epub-xml.js`, `Resources/tools/epub-package.js`; Test `Tests/tools/epub-xml.test.mjs`, `Tests/tools/epub-package.test.mjs`

> Spec refinement (documented deviation): the spec says metadata XML goes through `DOMParser`; this plan uses an in-repo mini XML parser for `container.xml`/OPF/nav/NCX instead so the engines run identically in Node tests and the browser. Chapter XHTML still uses `DOMParser` (Task 17). Note this in the PR description.

- [ ] **Step 1: Failing xml tests:** parses nested elements/attributes (single+double quotes), self-closing tags, skips XML declaration/comments/CDATA (CDATA text preserved as text), preserves `dc:title` prefixed names, `localName('dc:title') === 'title'`, `findAll`/`findFirst` match ignoring prefixes, text content concatenated with entities `&amp; &lt; &gt; &quot; &apos;` and numeric `&#..;`/`&#x..;` decoded, malformed (unclosed tag) throws `{ code: 'bad-xml' }`.
- [ ] **Step 2:** FAIL. **Step 3: Implement `epub-xml.js`:** single-pass tokenizer over `<`-delimited chunks; stack-based tree build; ~120 lines; attributes regex `([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')`; entity decoder for the five named + numeric forms.
- [ ] **Step 4:** xml tests PASS. **Step 5: Failing package tests** (inline fixture strings): `parseContainer` extracts `full-path`; `parsePackage` on an EPUB3 OPF fixture → title, creator, spine hrefs resolved via manifest, `coverHref` from `properties="cover-image"` item, `navHref` from `properties="nav"`; EPUB2 fixture → `coverHref` via `<meta name="cover" content="id">`, `ncxHref` via spine `toc=` attr; `resolveZipPath('OEBPS/content.opf', '../images/a.png') === 'images/a.png'`, `resolveZipPath('content.opf', 'ch1.xhtml') === 'ch1.xhtml'`; `parseToc` nav fixture (ol/li/a) and NCX fixture (navPoint/navLabel/text + content src) both → ordered `[{ label, href }]` with hrefs zip-resolved and fragment kept separately? — keep it simple: strip `#fragments` into `href` (entry file) and ignore the fragment for v1 (TOC jumps land at chapter top; note in code comment).
- [ ] **Step 6:** Implement `epub-package.js` per contract (author = first `dc:creator` text, title = first `dc:title`, fallbacks `'Untitled'` / `'Unknown author'`).
- [ ] **Step 7:** All PASS. **Step 8: Commit** `feat(tools): epub metadata layer (mini-xml, container/opf/toc parsing)`

### Task 16: EPUB store + sanitizer

**Files:** Create `Resources/tools/epub-store.js`, `Resources/tools/epub-sanitize.js`, `Tests/tools/fake-idb.mjs` (shared helper, also consumed by Task 17); Test `Tests/tools/epub-store.test.mjs`, `Tests/tools/epub-sanitize.test.mjs`

- [ ] **Step 1: Failing store tests.** Write `Tests/tools/fake-idb.mjs` exporting a ~100-line `fakeIndexedDb()` implementing only what the wrapper uses: `open(name, version)` request with `onupgradeneeded`/`onsuccess`, db `createObjectStore(name, { keyPath })`, `transaction([names], mode)`, store `put/get/getAll/delete`, requests with `onsuccess`/`onerror` and `result`, delivered via queueMicrotask. Cases: `openLibrary(fake)` creates both stores; `addBook` + `listBooks` round-trip sorted by `addedAt` desc; `getBook` returns the blob field intact; `deleteBook` removes book AND its position; `savePosition`/`getPosition` round-trip; `getPosition` for unknown id → undefined.
- [ ] **Step 2:** FAIL. **Step 3: Implement `epub-store.js`:** small `requestToPromise(request)` helper; `openLibrary` handles `onupgradeneeded` creating `books` (keyPath `id`) and `positions` (keyPath `bookId`); the six async functions wrap single transactions (`deleteBook` uses one readwrite transaction across both stores).
- [ ] **Step 4:** store tests PASS. **Step 5: Failing sanitizer tests.** Stub source nodes as plain objects `{ nodeType: 1, tagName: 'P', childNodes: [...], getAttribute(name) }` / text `{ nodeType: 3, textContent }`; factories record created output. Cases: keeps p/h2/em text; drops `<script>` entirely (children NOT recursed); strips `onclick`/`style` attributes; keeps `id`; `<img src="../images/x.png">` → factory called with resolved blob URL, `alt` preserved, `resolveImage` returning null drops the img; `<a href="https://x">` → kept with `target="_blank" rel="noopener"`; `<a href="ch2.xhtml">` (resolveLink returns `{ spineHref }`) → kept with `data-spine-href="ch2.xhtml"` and no href; unknown-but-harmless tag (`<foo>`) unwraps to its children; deeply nested structure preserved in order.
- [ ] **Step 6:** Implement `epub-sanitize.js`: `ALLOWED_TAGS` set (p, div, span, h1–h6, em, strong, i, b, u, small, sub, sup, br, hr, img, figure, figcaption, blockquote, ul, ol, li, dl, dt, dd, table, thead, tbody, tfoot, tr, td, th, a, section, article, aside, header, footer, pre, code, cite, q, abbr, time); `DROPPED_TAGS` set (script, style, iframe, object, embed, form, input, button, link, meta, video, audio, svg, math) — dropped entirely; anything else unwraps; per-tag allowed attributes (`img`: alt; `a`: resolved per resolveLink; `td/th`: colspan/rowspan; global: id); recursive walk building the new tree.
- [ ] **Step 7:** All PASS. **Step 8: Commit** `feat(tools): epub library store and chapter sanitizer`

### Task 17: EPUB reader controller

**Files:** Create `Resources/tools/epub-reader-ui.js`; Test `Tests/tools/epub-reader-ui.test.mjs`

**Interfaces:**
- Consumes: epub-zip, epub-package, epub-store, epub-sanitize, core.js.
- Produces: `renderEpubTool(root, deps)`; deps per contract (tests inject the `fakeIndexedDb()` from `Tests/tools/fake-idb.mjs` (Task 16), plus stub `inflate`, a `domParser` stub whose `parseFromString` returns a prebuilt stub tree, and a `urlFactory` recorder).

- [ ] **Step 1: Failing tests, library view:** with an empty fake library → empty-state copy (`No books yet`) + a labeled file input accepting `.epub` + `.epub-drop` zone; importing (call the controller's exported-for-test `importFile(file)` path by dispatching a `change` event with a stubbed `files` list whose `arrayBuffer()` resolves to a fixture EPUB built with Task 14's `buildZip` — minimal book: mimetype, container.xml, content.opf, ch1.xhtml, cover.png stored) → `addBook` called; card appears with title from OPF and `progress 0%`; missing `DecompressionStream` AND no injected inflate → `.tool-error` "needs a newer browser" and the input disabled; corrupt file → `.tool-error` mentioning `couldn't read`; DRM/encrypted → message mentioning `DRM`; delete button removes the card after an inline confirm (no `window.confirm` — reuse the two-button inline pattern).
- [ ] **Step 2: Failing tests, reader view:** opening a book card renders `.epub-reader` with chapter 1's sanitized content mounted, TOC button toggling `.epub-toc.is-open` listing entries, Next/Previous buttons switching spine index (Previous disabled at 0), font-size +/− buttons writing `style` font-size on `.epub-chapter` and persisting to prefs bag `epub-reader`, font select including `OpenDyslexic`, Back to library returns to the grid, position saved via `savePosition` on chapter change (spineIndex) — scroll-fraction persistence uses a ticked `setInterval` (fixture-tickable) checking a dirty flag, not scroll-event-to-setTimeout.
- [ ] **Step 3: Run** — FAIL. **Step 4: Implement `renderEpubTool(root, deps = {})`.** State machine `view: 'library' | 'reader'`. Library: `listBooks` → cards (`.epub-book-card` with cover `img` from `urlFactory.create(coverBlob)` when present, title/author/progress/Open/Delete); import flow: file → `arrayBuffer` → `parseZip` → read container/OPF via `readEntry` + `parsePackage` → extract cover bytes (blob) when `coverHref` resolves → `addBook({ id: crypto.randomUUID(), ... file: original File })`; every failure mapped to the specific messages tested. Reader: on open, `getBook` → parse zip once, hold `{ zip, buffer, pkg, toc }` in memory for the session; chapter render: `readEntry(spine[i].href)` → decode UTF-8 → `deps.domParser.parseFromString(text, 'application/xhtml+xml')` (fallback `'text/html'` on parsererror) → `sanitizeChapter(body, { createElement: via element(), resolveImage: (src) => blob-url from zip entry (cache per chapter, revoke on chapter change/back), resolveLink: spine-match else external })` → mount into `.epub-chapter`; clicking a `data-spine-href` element or TOC entry jumps to that spine index; restore `getPosition` on open (spine index; scroll fraction applied only in real browsers — guard `typeof root.scrollTo === 'function'`); controls row per tests; storage line: `navigator.storage?.estimate` when available renders "Using about X MB" (skip silently otherwise) and `navigator.storage?.persist?.()` requested once after first import.
- [ ] **Step 5: Run** `node --test Tests/tools/epub-reader-ui.test.mjs` — PASS. Also re-run zip/package/store/sanitize suites.
- [ ] **Step 6: Commit** `feat(tools): epub reader page (import, library, reading view)`

### Task 18: PWA — service worker, manifest, icons, wiring

**Files:**
- Create: `Resources/tools/sw.js`, `Resources/tools/manifest.webmanifest`, `Resources/tools/icons/icon-192.png`, `Resources/tools/icons/icon-512.png`
- Modify: `Resources/tools/core.js` (already has `registerToolsServiceWorker` — call site), `Resources/tools/ui.js` (register + offline chip), `Resources/tools/hub-ui.js` (chip mount point), `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift` (head links), `Resources/styles.css` (`.tool-offline-chip`)
- Test: `Tests/tools/sw.test.mjs`

- [ ] **Step 1: Icons.**

```bash
sips -g pixelWidth -g pixelHeight Resources/logo.png
mkdir -p Resources/tools/icons
sips -z 512 512 Resources/logo.png --out Resources/tools/icons/icon-512.png
sips -z 192 192 Resources/logo.png --out Resources/tools/icons/icon-192.png
```

If `logo.png` is non-square, first `sips --resampleHeightWidthMax 512` then `sips -c 512 512` (center crop) so the icon isn't distorted; eyeball the result.

- [ ] **Step 2: Failing tests** (`sw.test.mjs` imports `sw.js` source as TEXT via `fs.readFile` — the worker uses `self`, so assert on source strings, mirroring `Tests/games/routes.test.mjs` house style): precache list includes `'/tools/'` and all seven `'/tools/<slug>/'` page URLs, `'/tools/ui.js'`, `'/tools/core.js'`, every engine/controller file created in Tasks 1–17, `'/styles.css'`, `'/site.js'`, `'/OpenDyslexic-Regular.otf'`, `'/tools/manifest.webmanifest'`, both icons; cache name constant `kinnoki-tools-v1`; `addEventListener('install'`, `'activate'`, `'fetch'` all present; `skipWaiting`/`clients.claim` present; manifest file parses as JSON with `start_url === '/tools/'`, `display === 'standalone'`, both icons listed with correct sizes/types, `scope === '/tools/'`.
- [ ] **Step 3: Implement `sw.js`:**

```js
const CACHE = 'kinnoki-tools-v1';
const PRECACHE = [
  '/tools/', '/tools/qr-code/', '/tools/epub-reader/', '/tools/dilution/',
  '/tools/contrast/', '/tools/word-count/', '/tools/unit-converter/', '/tools/passphrase/',
  '/tools/ui.js', '/tools/core.js', '/tools/hub-ui.js',
  '/tools/dilution.js', '/tools/dilution-ui.js',
  '/tools/contrast.js', '/tools/contrast-ui.js',
  '/tools/word-count.js', '/tools/word-count-ui.js',
  '/tools/unit-convert.js', '/tools/unit-convert-ui.js',
  '/tools/wordlist.js', '/tools/passphrase.js', '/tools/passphrase-ui.js',
  '/tools/qr.js', '/tools/qr-matrix.js', '/tools/qr-ui.js',
  '/tools/epub-zip.js', '/tools/epub-xml.js', '/tools/epub-package.js',
  '/tools/epub-store.js', '/tools/epub-sanitize.js', '/tools/epub-reader-ui.js',
  '/tools/manifest.webmanifest', '/tools/icons/icon-192.png', '/tools/icons/icon-512.png',
  '/styles.css', '/site.js', '/OpenDyslexic-Regular.otf',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

const normalize = (request) => {
  const url = new URL(request.url);
  if (request.mode === 'navigate' && !url.pathname.endsWith('/')) url.pathname += '/';
  return url.pathname;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      if (fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(normalize(request), fresh.clone());
      }
      return fresh;
    } catch {
      const cached = await caches.match(normalize(request));
      return cached ?? caches.match('/tools/');
    }
  })());
});
```

Check the font filename: the precache entry must match how `styles.css` actually references `OpenDyslexic-Regular.otf` (root-relative) — verify with grep and correct the URL if it differs.

- [ ] **Step 4: `manifest.webmanifest`:**

```json
{
  "name": "KinNoKi Tools",
  "short_name": "Tools",
  "start_url": "/tools/",
  "scope": "/tools/",
  "display": "standalone",
  "background_color": "#0b0b0c",
  "theme_color": "#0b0b0c",
  "icons": [
    { "src": "/tools/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/tools/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Use the site's actual near-black token value from `styles.css` for the two colors (grep the background token; replace `#0b0b0c` if it differs).

- [ ] **Step 5: Wiring.** `ui.js`: call `registerToolsServiceWorker()` at startup; after mounting the controller, `watchConnectivity(window, (online) => ...)` toggles a `.tool-offline-chip` ("Offline — everything here still works") appended to the shell header on all tools pages. Theme: `siteHead` gains a `toolsHead: Bool = false` parameter appending `<link rel="manifest" href="/tools/manifest.webmanifest">` and `<meta name="theme-color" ...>` nodes; the eight tools cases pass `toolsHead: true` (thread it through `makePageHTML`'s tools branch — a small overload or default arg keeps every other call site untouched). CSS: `.tool-offline-chip` pill styles, no animation.
- [ ] **Step 6: Run** `node --test Tests/tools/sw.test.mjs` and the full `make test-tools`; `swift build`. All PASS.
- [ ] **Step 7: Commit** `feat(tools): section service worker, manifest, icons — offline + installable`

### Task 19: Integration — generate, route tests, live verification, docs, PR

**Files:**
- Create: `Tests/tools/routes.test.mjs`
- Modify: `CLAUDE.md` (and `AGENTS.md` if present)

- [ ] **Step 1: Write failing route tests** (reads `Output/`, mirroring `Tests/games/routes.test.mjs`): `Output/tools/index.html` exists, contains `data-tool-page="hub"`, the module script `/tools/ui.js`, the manifest link, and NO game markup; each of the seven `Output/tools/<slug>/index.html` exists with its `data-tool-page`; nav in `Output/index.html` contains `href="/tools"` labeled Tools; `Output/tools/sw.js`, `manifest.webmanifest`, both icons, `wordlist.js`, and every module file copied verbatim; `sw.js` precache list entries all exist as files in `Output/` (parse the array from source and stat each path — this catches a renamed module breaking offline silently).
- [ ] **Step 2:** `make generate` then `node --test Tests/tools/routes.test.mjs` — PASS (iterate on misses).
- [ ] **Step 3:** Full suites: `make test` (listen + games + tools) — ALL PASS.
- [ ] **Step 4: Live verification** (browser preview, `make preview` server via the launch config): visit `/tools` — seven cards, nav highlight; run each calculator once; QR: render `https://kinnokilabs.com`, verify with `BarcodeDetector` in the preview console when available (`new BarcodeDetector({ formats: ['qr_code'] }).detect(canvas)` round-trips the text) AND scan the on-screen code with a phone camera — **required check for at least versions 1-ish (short URL) and a long input (≥ 200 chars)**; EPUB: import a real `.epub` (any DRM-free book), read two chapters, reload the page → book persists, position restored; toggle OpenDyslexic; simulate offline (DevTools) → hub and a calculator still load; Lighthouse-style check that the manifest is detected (Application panel shows installable).
- [ ] **Step 5: Docs.** CLAUDE.md Architecture section: add a **Web Tools** bullet after Arcade Hall (routes, the engine/UI split, `make test-tools`, the PWA note, storage keys `kinnoki-tools:v1` + IndexedDB `kinnoki-tools-epub`, the EFF wordlist attribution, and the "generated `Output/` untouched by hand" reminder is already global). Mirror in `AGENTS.md` if that file exists. Update the `make test` line in CLAUDE.md's Build & Run to mention all three suites.
- [ ] **Step 6:** `git status --short` — nothing unstaged that isn't task-owned; commit `docs: document the Web Tools section` then push the branch and open the PR to `main` titled `feat: Web Tools — seven offline-capable utilities at /tools`, body summarizing the spec, the DOMParser→mini-xml deviation note, test evidence (`make test` output), and the live verification results (including the QR phone-scan confirmation).

## Self-Review Notes

- **Spec coverage:** hub + seven tools (Tasks 1, 3–17), Arcade Hall pattern + nav (Task 1), dependency-free constraint (global + Tasks 11–15), PWA offline + install + offline chip (Task 18), per-page meta stubs (Task 1), testing pyramid incl. route tests (per-task + Task 19), error handling (Tasks 4, 13, 17), a11y live regions + labels (core.js + controllers), docs (Task 19). Deviations from spec, both deliberate and PR-noted: single `ui.js` loader realizes "only that tool's JS loads" via dynamic import (matches the games house pattern the spec's architecture line invokes); metadata XML via in-repo mini parser instead of DOMParser (Node-testability).
- **Known-risk register:** QR `EC_TABLE`/`alignmentPositions` transcription (guarded by 160-row consistency test + structural tests + mandatory real-scanner verification in Task 19); `dom-fixture.mjs` API assumptions in Tasks 1–2 (verified at first use, contracts stay stable); `DecompressionStream` availability in Node CI (inject zlib inflate in tests if absent).

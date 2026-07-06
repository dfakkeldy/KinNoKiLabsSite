# KinNoKi Labs Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the site's theme and CSS into the approved "refined Apple + gold" design — split hero with featured Echo card, frontmatter-driven app cards, hybrid Lexend/system type — without changing any copy.

**Architecture:** All layout moves from markdown into the Publish theme (`KinNoKiHTMLFactory`). App data (accent, tagline, platforms, featured) moves into typed frontmatter via `ItemMetadata`. `styles.css` is rewritten as a token-based design system. Spec: `docs/superpowers/specs/2026-07-05-site-redesign-design.md`.

**Tech Stack:** Swift Publish (static site generator), Plot (HTML DSL), plain CSS. No JS beyond the existing OpenDyslexic toggle. No new dependencies.

## Global Constraints

- **Copy lock:** existing sentences may MOVE (into frontmatter) or be DELETED as duplicates; they may NEVER be rewritten. New visible strings are limited to navigation chrome: `← All apps` and platform badge labels (`iPhone`, `Apple Watch`, `Mac`, `CarPlay`).
- **Branch:** work on the existing `claude/site-redesign` branch. Never push to `main`; this repo has no nightly/weekly ladder — the PR targets `main`.
- **`Output/` is generated.** Never hand-edit it. Run `make generate` freely for verification, but do NOT `git add` anything under `Output/` until Task 9 (one clean regeneration commit at the end). Never use `git add -A`.
- **Every commit must build:** `swift build` succeeds and `make generate` succeeds at every commit.
- **Commits:** Conventional Commits, each ending with the line `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Working directory:** `/Users/dfakkeldy/Developer/KinNoKiLabsSite` (all commands relative to it).
- **Accessibility invariants:** the OpenDyslexic toggle keeps working; gold used as text on light backgrounds is only `#8a7439`; interactive elements get `:focus-visible` styles; transitions live inside `@media (prefers-reduced-motion: no-preference)`.
- `make generate` runs the installed `publish` CLI (`/usr/local/bin/publish`). If it's ever missing, `swift run KinNoKiLabsSite` generates identically.

---

### Task 1: Copy-integrity baseline

Capture the visible text of the current site so Task 9 can prove no words changed. Produces scratch artifacts only — **no commit in this task.**

**Files:**
- Create: `/private/tmp/claude-501/-Users-dfakkeldy-Developer-KinNoKiLabsSite/af163708-e20a-489a-bc5f-bad73a168552/scratchpad/extract_text.py`
- Create: `/private/tmp/claude-501/-Users-dfakkeldy-Developer-KinNoKiLabsSite/af163708-e20a-489a-bc5f-bad73a168552/scratchpad/baseline.txt`

**Interfaces:**
- Produces: `extract_text.py <dir>` — prints one line per text node of every `.html` under `<dir>`, with `### <relative-path>` separators. Task 9 consumes both files.

- [ ] **Step 1: Write the extraction script**

```python
#!/usr/bin/env python3
"""Extract visible text from every .html file under a directory, for copy diffing."""
import sys
from pathlib import Path
from html.parser import HTMLParser


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip_depth += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip_depth = max(0, self.skip_depth - 1)

    def handle_data(self, data):
        if self.skip_depth == 0:
            text = " ".join(data.split())
            if text:
                self.parts.append(text)


root = Path(sys.argv[1])
lines = []
for f in sorted(root.rglob("*.html")):
    parser = TextExtractor()
    parser.feed(f.read_text(encoding="utf-8"))
    lines.append(f"### {f.relative_to(root)}")
    lines.extend(parser.parts)
print("\n".join(lines))
```

- [ ] **Step 2: Regenerate current site and capture the baseline**

```bash
git -C /Users/dfakkeldy/Developer/KinNoKiLabsSite status --short   # confirm clean before starting
make generate
python3 /private/tmp/claude-501/-Users-dfakkeldy-Developer-KinNoKiLabsSite/af163708-e20a-489a-bc5f-bad73a168552/scratchpad/extract_text.py Output \
  > /private/tmp/claude-501/-Users-dfakkeldy-Developer-KinNoKiLabsSite/af163708-e20a-489a-bc5f-bad73a168552/scratchpad/baseline.txt
wc -l /private/tmp/claude-501/-Users-dfakkeldy-Developer-KinNoKiLabsSite/af163708-e20a-489a-bc5f-bad73a168552/scratchpad/baseline.txt
```

Expected: `make generate` prints `Publishing…`/`Successfully published` output; `wc -l` reports several hundred lines. If `git status` shows Output/ churn afterward, that's expected — leave it uncommitted.

---

### Task 2: ItemMetadata fields + app frontmatter (additive, zero visual change)

Add the typed metadata and give every app file its frontmatter. Nothing is removed from the markdown bodies yet, so the rendered site is unchanged except invisible metadata.

**Files:**
- Modify: `Sources/KinNoKiLabsSite/main.swift:13-15` (ItemMetadata struct)
- Modify: `Content/apps/echo.md`, `Content/apps/macromark.md`, `Content/apps/nsmarksthespot.md`, `Content/apps/routey.md`, `Content/apps/visualtimer.md` (prepend frontmatter)

**Interfaces:**
- Produces: `ItemMetadata` with `accent: String?`, `tagline: String?`, `platforms: String?` (comma-separated), `featured: Bool?`, `iconAlt: String?`. Standard frontmatter `image:` populates `item.imagePath: Path?`; `title:` overrides the h1-derived title; `description:` populates `item.description`. Tasks 3, 6, 7 consume these.

- [ ] **Step 1: Replace the empty ItemMetadata in `Sources/KinNoKiLabsSite/main.swift`**

```swift
    struct ItemMetadata: WebsiteItemMetadata {
        // App-page fields (posts omit all of these).
        var accent: String?     // hex color, e.g. "#d4af37"
        var tagline: String?
        var platforms: String?  // comma-separated, e.g. "iPhone, Apple Watch, Mac"
        var featured: Bool?     // homepage flagship slot
        var iconAlt: String?    // only when the generic "<title> app icon" alt isn't enough
    }
```

- [ ] **Step 2: Prepend frontmatter to each app file (values are the existing sentences, moved not rewritten)**

`Content/apps/echo.md` — insert before line 1 (`# Echo: Audiobook Study Player`):

```yaml
---
title: Echo: Audiobook Study Player
description: An audiobook player built for studying, not just listening.
image: /images/apps/echo.png
accent: #d4af37
tagline: For Every Mind — Turn listening into learning.
platforms: iPhone, Apple Watch, Mac, CarPlay
featured: true
iconAlt: Echo app icon — an infinity symbol in silver and gold
---
```

`Content/apps/macromark.md` — insert before line 1:

```yaml
---
title: MacroMark
description: Apple Watch voice capture for people whose notes live in Markdown.
image: /images/apps/macromark.png
accent: #2f8cff
tagline: Apple Watch to Markdown.
platforms: Apple Watch, iPhone
---
```

`Content/apps/nsmarksthespot.md` — insert before line 1:

```yaml
---
title: NS Marks The Spot
description: Historical Nova Scotia maps, lined up with the map in your hand.
image: /images/apps/nsmarksthespot.svg
accent: #12343b
tagline: Historical maps, live in your pocket.
platforms: iPhone
---
```

`Content/apps/routey.md` — insert before line 1 (no `image:` — Routey has no icon; the monogram fallback renders):

```yaml
---
title: Routey
description: Offline-first route support for rural delivery workflows.
accent: #ef4444
tagline: Your route. Your rules.
platforms: iPhone
---
```

`Content/apps/visualtimer.md` — insert before line 1 (no `image:`):

```yaml
---
title: Turn Timer
description: Visual rounds for real-world countdowns, turns, routines, and reusable sequences.
accent: #74c0fc
tagline: Make time visible for turns, routines, and reusable sequences.
platforms: iPhone
---
```

Notes for the implementer: Ink (Publish's markdown parser) splits metadata lines on the FIRST colon, so `title: Echo: Audiobook Study Player` and `accent: #d4af37` parse correctly **unquoted** — do not add quotes, they would become part of the string. The `description` values are the exact bullet one-liners currently in `index.md`; the `tagline` values are the exact bolded lines already in each app file; `platforms` for Echo is from its own copy ("an app for iPhone, Apple Watch, Mac, and CarPlay"), for the others from their body text (MacroMark: Watch+iPhone companion; Routey: "offline-first iPhone companion"; Turn Timer and NS Marks The Spot: iPhone).

- [ ] **Step 3: Verify build + generation decode the metadata**

```bash
swift build && make generate
grep -c "app-hero" Output/apps/echo/index.html
```

Expected: `Build complete!`, successful generation (a bad Bool/YAML value would throw `decoding error` here), and grep prints `1` (page unchanged — old markup still renders). If `featured: true` fails to decode as `Bool?`, change the field to `var featured: String?` and compare `== "true"` at the use sites in Task 6 — but try `Bool?` first; Publish's metadata decoder supports it.

- [ ] **Step 4: Commit**

```bash
git add Sources/KinNoKiLabsSite/main.swift Content/apps/
git commit -m "feat: add typed app metadata via frontmatter

Additive only — bodies unchanged, rendering unchanged.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Shared `<head>` builder — description, canonical, Open Graph, favicon, lang

**Files:**
- Modify: `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift` (all six factory methods + new helper)

**Interfaces:**
- Consumes: `item.imagePath` from Task 2.
- Produces: `siteHead(for:context:titleOverride:)` — exact signature below. All later tasks keep calling it; they never build `.head` nodes themselves.

```swift
private func siteHead<L: Location>(
    for location: L,
    context: PublishingContext<KinNoKiLabsSite>,
    titleOverride: String? = nil
) -> Node<HTML.DocumentContext>
```

- [ ] **Step 1: Verify the gap (red)**

```bash
grep -c 'og:title' Output/index.html; grep -c 'rel="canonical"' Output/index.html
```

Expected: `0` and `0`.

- [ ] **Step 2: Add the helper to `KinNoKiTheme.swift` (below the factory struct, above `siteHeader`)**

```swift
// MARK: - Shared <head>

private func siteHead<L: Location>(
    for location: L,
    context: PublishingContext<KinNoKiLabsSite>,
    titleOverride: String? = nil
) -> Node<HTML.DocumentContext> {
    let site = context.site
    let isIndex = location.path.string.isEmpty
    let baseTitle = titleOverride ?? location.title
    let pageTitle = isIndex ? site.name : "\(baseTitle) — \(site.name)"
    let description = location.description.isEmpty ? site.description : location.description
    let url = site.url(for: location.path)
    let imageURL = site.url(for: location.imagePath ?? Path("/logo.png"))

    return .head(
        .meta(.charset(.utf8)),
        .meta(.name("viewport"), .content("width=device-width, initial-scale=1")),
        .title(pageTitle),
        .meta(.name("description"), .content(description)),
        .link(.attribute(named: "rel", value: "canonical"), .attribute(named: "href", value: url.absoluteString)),
        .link(.attribute(named: "rel", value: "icon"), .attribute(named: "href", value: "/logo.png")),
        .stylesheet("/styles.css"),
        .meta(.attribute(named: "property", value: "og:site_name"), .attribute(named: "content", value: site.name)),
        .meta(.attribute(named: "property", value: "og:title"), .attribute(named: "content", value: pageTitle)),
        .meta(.attribute(named: "property", value: "og:description"), .attribute(named: "content", value: description)),
        .meta(.attribute(named: "property", value: "og:type"), .attribute(named: "content", value: "website")),
        .meta(.attribute(named: "property", value: "og:url"), .attribute(named: "content", value: url.absoluteString)),
        .meta(.attribute(named: "property", value: "og:image"), .attribute(named: "content", value: imageURL.absoluteString)),
        .meta(.name("twitter:card"), .content("summary"))
    )
}
```

If `location.imagePath` doesn't compile (Location-extension availability differs by Publish version), use `location.content.imagePath` — same value.

- [ ] **Step 3: Wire it into all six factory methods**

In each of `makeIndexHTML`, `makeSectionHTML`, `makeItemHTML`, `makePageHTML`, `makeTagListHTML`, `makeTagDetailsHTML`, replace the entire existing `.head(...)` node with a call, and add the `lang` attribute as the first argument of `HTML(...)`. Examples — index:

```swift
        HTML(
            .lang(context.site.language),
            siteHead(for: index, context: context),
            .body(
```

Tag list (title override keeps the current "Tags — KinNoKi Labs"):

```swift
        HTML(
            .lang(context.site.language),
            siteHead(for: page, context: context, titleOverride: "Tags"),
            .body(
```

Tag details keeps its current pattern via override too:

```swift
            siteHead(for: page, context: context, titleOverride: page.tag.string),
```

The other three methods pass `section`, `item`, and `page` respectively with no override.

- [ ] **Step 4: Verify (green)**

```bash
swift build && make generate
grep -c 'og:title' Output/index.html
grep -o '<html lang="en">' Output/index.html
grep -o 'rel="canonical" href="[^"]*"' Output/apps/echo/index.html
grep -o 'property="og:image" content="[^"]*"' Output/apps/echo/index.html
```

Expected: `1`; `<html lang="en">`; canonical `https://kinnokilabs.com/apps/echo`; og:image ending `/images/apps/echo.png` (Echo's icon flows from `image:` frontmatter).

- [ ] **Step 5: Commit**

```bash
git add Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift
git commit -m "feat: shared head builder with description, canonical, OG tags, favicon, lang

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: CSS design system rewrite

Full rewrite of `Resources/styles.css`. Legacy classes still emitted by the theme (`.bento-box`, `.app-hero`, `.post-item`, `.post-date`, `.post-description`, `.tag`) are kept in a marked LEGACY block so the site stays styled until Tasks 6–8 land; dead `.btn-metallic` (referenced nowhere) is dropped now.

**Files:**
- Modify: `Resources/styles.css` (complete replacement)

**Interfaces:**
- Produces: every class used by Tasks 5–8: `.site-main`, `.hero`, `.hero-copy`, `.hero-sub`, `.eyebrow`, `.btn-gold`, `.card-grid`, `.app-card`, `.app-card-featured`, `.app-card-body`, `.app-card-tagline`, `.app-card-desc`, `.app-icon`, `.app-monogram`, `.badges`, `.badge`, `.services-band`, `.breadcrumb`, `.app-hero-band`, `.app-tagline`, `.article`, `.post-rows`, `.post-row`, `.post-desc`, `.tag-row`, `.tag-chip`, `.footer-links`. Accent theming contract: components read `--app-accent` (set inline by the theme) falling back to `--gold`.

- [ ] **Step 1: Replace `Resources/styles.css` with the design system**

```css
/* ═══════════════════════════════════════════════════════
   KinNoKi Labs — design system ("refined Apple + gold")
   Spec: docs/superpowers/specs/2026-07-05-site-redesign-design.md
   ═══════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Lexend:wght@500;600&display=swap');

@font-face {
  font-family: 'OpenDyslexic';
  src: url('https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/woff/OpenDyslexic-Regular.woff') format('woff'),
       url('OpenDyslexic-Regular.otf') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

/* ── Reset ─────────────────────────────────────── */

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ── Tokens ────────────────────────────────────── */

:root {
  --color-bg: #f5f5f7;
  --color-surface: #ffffff;
  --color-text: #1d1d1f;
  --color-text-muted: #6e6e73;
  --color-border: rgba(0, 0, 0, 0.1);
  --color-nav-bg: rgba(245, 245, 247, 0.72);

  --gold: #c9a959;      /* decorative: borders, glows — never body text */
  --gold-text: #8a7439; /* AA-compliant gold for text on light surfaces */
  --gold-cta-a: #c9a959;
  --gold-cta-b: #eed9a0;
  --gold-cta-c: #b08d4a;
  --gold-cta-text: #2e2508;

  --font-display: 'Lexend', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;

  --max-width: 1080px;
  --article-width: 760px;
  --radius-card: 16px;
  --radius-band: 20px;
  --radius-pill: 999px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #000000;
    --color-surface: #1c1c1e;
    --color-text: #f5f5f7;
    --color-text-muted: #86868b;
    --color-border: rgba(255, 255, 255, 0.1);
    --color-nav-bg: rgba(0, 0, 0, 0.72);

    --gold-text: #d9bc72;
    --gold-cta-a: #a68b5c;
    --gold-cta-b: #f1d596;
    --gold-cta-c: #997843;
    --gold-cta-text: #000000;
  }
}

/* ── Base ──────────────────────────────────────── */

html {
  font-size: 17px;
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-body);
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body.font-opendyslexic,
body.font-opendyslexic * {
  font-family: "OpenDyslexic", -apple-system, BlinkMacSystemFont, sans-serif !important;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--color-text);
}

h1 { font-size: 2.25rem; margin-bottom: 1rem; }
h2 { font-size: 1.5rem; margin: 2rem 0 0.75rem; }
h3 { font-size: 1.15rem; margin: 1.5rem 0 0.5rem; }

p { margin-bottom: 1rem; }

a {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--gold);
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}

a:hover { text-decoration-color: var(--color-text); }

:focus-visible {
  outline: 2px solid var(--gold-text);
  outline-offset: 2px;
}

.eyebrow {
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--gold-text);
  margin-bottom: 0.5rem;
}

/* ── Sticky navigation ─────────────────────────── */

.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-nav-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--color-border);
}

.site-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0.85rem 1.5rem;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: -0.01em;
}

.nav-brand img {
  height: 36px;
  width: auto;
  object-fit: contain;
}

.nav-links {
  display: flex;
  gap: 1.75rem;
  list-style: none;
  align-items: center;
}

.nav-links a {
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
}

.nav-links a:hover { color: var(--color-text); }

.font-toggle {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
  font-family: inherit;
  color: var(--color-text);
  cursor: pointer;
}

.font-toggle:hover { background: var(--color-border); }

/* ── Page container ────────────────────────────── */

.site-main {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 2.5rem 1.5rem 5rem;
}

/* ── Gold CTA ──────────────────────────────────── */

.btn-gold {
  display: inline-block;
  background: linear-gradient(135deg, var(--gold-cta-a), var(--gold-cta-b), var(--gold-cta-c));
  color: var(--gold-cta-text);
  font-family: var(--font-display);
  font-weight: 600;
  padding: 0.7rem 1.5rem;
  border-radius: var(--radius-pill);
  text-decoration: none;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}

.btn-gold:hover {
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  text-decoration: none;
}

/* ── Homepage hero ─────────────────────────────── */

.hero {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 3rem;
  align-items: center;
  padding: 3.5rem 0 3rem;
}

.hero-copy h1 {
  font-size: clamp(2.5rem, 5vw, 3.5rem);
  line-height: 1.08;
  margin-bottom: 1rem;
}

.hero-sub {
  font-size: 1.25rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  margin-bottom: 1.75rem;
}

/* ── App cards ─────────────────────────────────── */

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 1rem;
  margin: 1rem 0 2.5rem;
}

.app-card {
  display: block;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: 1.5rem;
  text-decoration: none;
  color: var(--color-text);
}

.app-card:hover {
  border-color: var(--gold);
  box-shadow: 0 6px 24px rgba(176, 141, 74, 0.16);
  text-decoration: none;
}

.app-card h3 {
  margin: 0.75rem 0 0.25rem;
  font-size: 1.05rem;
}

.app-card-desc {
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  margin: 0;
}

.app-card-featured {
  border: 1.5px solid var(--gold);
  box-shadow: 0 8px 30px rgba(176, 141, 74, 0.18);
  padding: 2rem;
}

.app-card-featured h3 { font-size: 1.25rem; }

.app-card-tagline {
  color: var(--gold-text);
  font-size: 0.95rem;
  font-weight: 500;
  margin: 0 0 0.5rem;
}

.app-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: block;
  object-fit: contain;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
}

.app-card-featured .app-icon,
.app-hero-band .app-icon {
  width: 72px;
  height: 72px;
  border-radius: 16px;
}

.app-monogram {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.5rem;
  background: color-mix(in srgb, var(--app-accent, var(--gold)) 15%, var(--color-surface));
  color: color-mix(in srgb, var(--app-accent, var(--gold)) 70%, var(--color-text));
  border: 1px solid color-mix(in srgb, var(--app-accent, var(--gold)) 30%, transparent);
  box-shadow: none;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.75rem;
}

.badge {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--gold-text);
  border: 1px solid color-mix(in srgb, var(--gold) 55%, transparent);
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.6rem;
}

/* ── Services band ─────────────────────────────── */

.services-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  background: color-mix(in srgb, var(--gold) 10%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--gold) 30%, transparent);
  border-radius: var(--radius-band);
  padding: 2rem 2.5rem;
  margin-top: 1rem;
}

.services-band h2 { margin: 0 0 0.5rem; }

.services-band p {
  color: var(--color-text-muted);
  max-width: 55ch;
  margin: 0;
}

.services-band .btn-gold { flex-shrink: 0; }

/* ── App detail pages ──────────────────────────── */

.breadcrumb {
  font-size: 0.9rem;
  margin-bottom: 1.25rem;
}

.breadcrumb a {
  color: var(--color-text-muted);
  text-decoration: none;
}

.breadcrumb a:hover { color: var(--color-text); }

.app-hero-band {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--app-accent, var(--gold)) 13%, transparent),
    color-mix(in srgb, var(--app-accent, var(--gold)) 3%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--app-accent, var(--gold)) 25%, transparent);
  border-radius: var(--radius-band);
  padding: 2rem 2.5rem;
  margin-bottom: 1.5rem;
}

.app-hero-band h1 { margin-bottom: 0.25rem; }

.app-tagline {
  color: var(--color-text-muted);
  font-size: 1.05rem;
  margin: 0;
}

/* ── Article column (prose pages, posts, app bodies) ── */

.article {
  max-width: var(--article-width);
  margin: 0 auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: 2.5rem;
}

.article ul,
.article ol {
  margin: 0 0 1rem 1.4rem;
}

.article li { margin-bottom: 0.4rem; }

.article blockquote {
  border-left: 3px solid var(--gold);
  padding: 0.25rem 0 0.25rem 1rem;
  color: var(--color-text-muted);
  margin: 0 0 1rem;
}

.article blockquote p:last-child { margin-bottom: 0; }

.article code {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 0.88em;
  background: var(--color-bg);
  border-radius: 4px;
  padding: 0.1em 0.35em;
}

.article img {
  max-width: 100%;
  border-radius: 8px;
}

.article hr {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 2rem 0;
}

/* ── Post rows ─────────────────────────────────── */

.post-rows {
  list-style: none;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.post-row {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: 1.25rem 1.5rem;
}

.post-row:hover { border-color: var(--gold); }

.post-row .eyebrow { margin-bottom: 0.25rem; }

.post-row h2 {
  font-size: 1.15rem;
  margin: 0 0 0.25rem;
}

.post-row h2 a { text-decoration: none; }
.post-row h2 a:hover { text-decoration: underline; }

.post-desc {
  font-size: 0.92rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* ── Tags ──────────────────────────────────────── */

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.tag-chip {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--gold-text);
  border: 1px solid color-mix(in srgb, var(--gold) 55%, transparent);
  border-radius: var(--radius-pill);
  padding: 0.15rem 0.7rem;
  text-decoration: none;
}

.tag-chip:hover {
  background: color-mix(in srgb, var(--gold) 12%, transparent);
  text-decoration: none;
}

/* ── Footer ────────────────────────────────────── */

.site-footer {
  text-align: center;
  padding: 2rem 1.5rem 3rem;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.footer-links {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 0.75rem;
}

.footer-links a {
  color: var(--color-text-muted);
  text-decoration: none;
}

.footer-links a:hover { color: var(--color-text); }

/* ── Motion (opt-in only) ──────────────────────── */

@media (prefers-reduced-motion: no-preference) {
  .nav-links a,
  .font-toggle { transition: color 0.15s ease, background 0.2s ease; }

  .btn-gold { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .btn-gold:hover { transform: translateY(-1px); }

  .app-card,
  .post-row { transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease; }
  .app-card:hover { transform: translateY(-2px); }
}

/* ── Responsive ────────────────────────────────── */

@media (max-width: 800px) {
  .hero {
    grid-template-columns: 1fr;
    gap: 2rem;
    padding: 2.5rem 0 2rem;
  }

  .services-band {
    flex-direction: column;
    align-items: flex-start;
    padding: 1.5rem;
  }
}

@media (max-width: 600px) {
  html { font-size: 16px; }

  .site-nav {
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    padding: 0.7rem 1rem;
  }

  .nav-links { gap: 1rem; flex-wrap: wrap; }

  .article { padding: 1.5rem; }
  .app-hero-band { padding: 1.5rem; flex-direction: column; align-items: flex-start; }
}

/* ═══════════════════════════════════════════════
   LEGACY — classes still emitted by the old theme
   markup. Tasks 6–8 stop emitting them; Task 9
   deletes this whole block.
   ═══════════════════════════════════════════════ */

.bento-box {
  background: var(--color-surface);
  border-radius: 24px;
  padding: 2rem;
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
  max-width: 800px;
  margin: 0 auto;
}

.post-list {
  list-style: none;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.post-item { display: block; }

.post-date {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  display: block;
  margin-bottom: 0.5rem;
}

.post-description {
  color: var(--color-text-muted);
  font-size: 0.95rem;
  line-height: 1.5;
}

.app-hero {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 0.25rem 0 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 3px solid var(--app-accent, var(--color-border));
}

.app-hero img {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  display: block;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
}

.tag {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-right: 0.5rem;
}
```

- [ ] **Step 2: Verify generation copies it and legacy pages still render**

```bash
make generate
grep -c -- "--gold-text" Output/styles.css
grep -c "bento-box" Output/styles.css
grep -c "btn-metallic" Output/styles.css
```

Expected: `>= 2`, `1`, `0` (dead class gone — it was referenced nowhere in Content/ or Sources/).

- [ ] **Step 3: Commit**

```bash
git add Resources/styles.css
git commit -m "feat: rewrite styles.css as token-based design system

Gold brand thread in light and dark, hybrid Lexend/system type,
focus-visible + reduced-motion support. Legacy classes kept in a
marked block until the theme stops emitting them.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Footer restructure

Smallest theme change first — proves the shared-component pattern end-to-end before the big layouts.

**Files:**
- Modify: `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift:219-234` (siteFooter)

**Interfaces:**
- Produces: `siteFooter(context:)` unchanged in signature; markup now uses `.footer-links`. Same words as before.

- [ ] **Step 1: Replace `siteFooter` with**

```swift
private func siteFooter<Site: Website>(context: PublishingContext<Site>) -> Node<HTML.BodyContext> {
    .footer(
        .class("site-footer"),
        .div(
            .class("footer-links"),
            .a(.href("/privacy"), .text("Privacy Policy")),
            .a(.href("/support"), .text("Support"))
        ),
        .p(
            .text("© \(currentYear) \(context.site.name). Generated with "),
            .a(.href("https://github.com/johnsundell/publish"), .text("Publish")),
            .text(".")
        )
    )
}
```

- [ ] **Step 2: Verify**

```bash
swift build && make generate
grep -c 'footer-links' Output/index.html
grep -c 'style="margin-top: 0.5rem;"' Output/index.html
```

Expected: `1` then `0` (inline style gone).

- [ ] **Step 3: Commit**

```bash
git add Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift
git commit -m "feat: restructure footer with links row (same words)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Homepage — split hero, featured Echo card, app row, services band

**Files:**
- Modify: `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift` (makeIndexHTML + new component functions)
- Modify: `Content/index.md` (slim to title + description frontmatter)
- Modify: `Content/services.md` (add description frontmatter)

**Interfaces:**
- Consumes: `ItemMetadata` fields (Task 2), `siteHead` (Task 3), CSS classes (Task 4).
- Produces — Task 7 reuses these exact signatures:

```swift
private func appIcon(_ item: Item<KinNoKiLabsSite>) -> Node<HTML.BodyContext>
private func appCard(_ item: Item<KinNoKiLabsSite>) -> Node<HTML.BodyContext>
private func featuredAppCard(_ item: Item<KinNoKiLabsSite>) -> Node<HTML.BodyContext>
private func platformBadges(_ item: Item<KinNoKiLabsSite>) -> Node<HTML.BodyContext>
private func accentStyle(_ item: Item<KinNoKiLabsSite>) -> Node<HTML.BodyContext>
```

- [ ] **Step 1: Add description frontmatter to `Content/services.md`** (existing first sentence, verbatim; body unchanged):

```yaml
---
description: KinNoKi Labs helps small businesses turn repeated operational work into practical software, checklists, knowledge systems, and automation.
---
```

- [ ] **Step 2: Replace the entire content of `Content/index.md` with**

```markdown
---
description: KinNoKi Labs is an independent software studio building focused Apple-platform apps and practical software systems for messy real-world work.
---
# Building Tools That Make Sense
```

The h1 stays because Publish derives `index.title` from it. Every deleted line is a duplicate: the intro sentence moved to `description:`, the services paragraph is a variant of `services.md`'s opener (band pulls from there), the app bullets moved to app `description:` frontmatter in Task 2, and the About/Privacy links exist in nav/footer.

- [ ] **Step 3: Add component functions to `KinNoKiTheme.swift`** (new `// MARK: - App Components` section above `siteHeader`):

```swift
// MARK: - App Components

private func accentStyle(_ item: Item<KinNoKiLabsSite>) -> Node<HTML.BodyContext> {
    .unwrap(item.metadata.accent) { .style("--app-accent: \($0);") }
}

private func appIcon(_ item: Item<KinNoKiLabsSite>) -> Node<HTML.BodyContext> {
    if let imagePath = item.imagePath {
        return .img(
            .class("app-icon"),
            .src(imagePath.absoluteString),
            .alt(item.metadata.iconAlt ?? "\(item.title) app icon")
        )
    }
    return .span(
        .class("app-icon app-monogram"),
        .attribute(named: "aria-hidden", value: "true"),
        .text(String(item.title.prefix(1)))
    )
}

private func platformBadges(_ item: Item<KinNoKiLabsSite>) -> Node<HTML.BodyContext> {
    guard let platforms = item.metadata.platforms else { return .empty }
    let names = platforms.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
    return .div(.class("badges"), .forEach(names) { .span(.class("badge"), .text($0)) })
}

private func appCard(_ item: Item<KinNoKiLabsSite>) -> Node<HTML.BodyContext> {
    .a(
        .class("app-card"),
        .href(item.path),
        accentStyle(item),
        appIcon(item),
        .div(
            .class("app-card-body"),
            .h3(.text(item.title)),
            .p(.class("app-card-desc"), .text(item.description))
        )
    )
}

private func featuredAppCard(_ item: Item<KinNoKiLabsSite>) -> Node<HTML.BodyContext> {
    .a(
        .class("app-card app-card-featured"),
        .href(item.path),
        accentStyle(item),
        appIcon(item),
        .div(
            .class("app-card-body"),
            .h3(.text(item.title)),
            .unwrap(item.metadata.tagline) { .p(.class("app-card-tagline"), .text($0)) },
            .p(.class("app-card-desc"), .text(item.description)),
            platformBadges(item)
        )
    )
}

private func servicesBand(context: PublishingContext<KinNoKiLabsSite>) -> Node<HTML.BodyContext> {
    .section(
        .class("services-band"),
        .div(
            .h2(.text("Services")),
            .unwrap(context.pages["services"]) { .p(.text($0.description)) }
        ),
        .a(.class("btn-gold"), .href("/services"), .text("See Services"))
    )
}
```

- [ ] **Step 4: Replace `makeIndexHTML` with**

```swift
    func makeIndexHTML(for index: Index, context: PublishingContext<Site>) throws -> HTML {
        let apps = context.sections[.apps].items
            .sorted { $0.title.lowercased() < $1.title.lowercased() }
        let featured = apps.first { $0.metadata.featured == true }
        let others = apps.filter { $0.path != featured?.path }

        return HTML(
            .lang(context.site.language),
            siteHead(for: index, context: context),
            .body(
                .class("page-home"),
                siteHeader(context: context),
                .main(
                    .class("site-main"),
                    .section(
                        .class("hero"),
                        .div(
                            .class("hero-copy"),
                            .h1(.text(index.title)),
                            .unwrap(index.description.isEmpty ? nil : index.description) {
                                .p(.class("hero-sub"), .text($0))
                            },
                            .a(.class("btn-gold"), .href("/services"), .text("See Services"))
                        ),
                        .unwrap(featured) { featuredAppCard($0) }
                    ),
                    .p(.class("eyebrow"), .text("Apps")),
                    .div(.class("card-grid"), .forEach(others) { appCard($0) }),
                    servicesBand(context: context)
                ),
                siteFooter(context: context)
            )
        )
    }
```

Note: with no `featured` item, `.unwrap` renders nothing and all five apps land in `others` — the spec's plain-grid fallback comes free.

- [ ] **Step 5: Verify**

```bash
swift build && make generate
grep -c 'app-card-featured' Output/index.html   # expect 1 (Echo)
grep -c 'class="app-card"' Output/index.html    # expect 4 (the rest)
grep -c 'app-monogram' Output/index.html        # expect 2 (Routey + Turn Timer)
grep -c 'services-band' Output/index.html       # expect 1
grep -c 'bento-box' Output/index.html           # expect 0
grep -o 'helps small businesses turn repeated operational work' Output/index.html | head -1
```

Expected: counts as annotated; the services sentence appears (pulled from services.md frontmatter).

- [ ] **Step 6: Commit**

```bash
git add Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift Content/index.md Content/services.md
git commit -m "feat: theme-driven homepage — split hero, featured Echo card, app row, services band

Homepage copy now flows from index.md/services.md frontmatter and app
item metadata; duplicate bullets and links removed from index.md.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: /apps grid, app detail hero band, strip layout HTML from app markdown

**Files:**
- Modify: `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift` (makeSectionHTML, makeItemHTML)
- Modify: all five `Content/apps/*.md` (remove h1 line, `<div class="app-hero">` line, bold tagline line)

**Interfaces:**
- Consumes: `appCard`, `appIcon`, `platformBadges`, `accentStyle` from Task 6; `siteHead` from Task 3.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Replace `makeSectionHTML` with**

```swift
    func makeSectionHTML(for section: Section<Site>, context: PublishingContext<Site>) throws -> HTML {
        HTML(
            .lang(context.site.language),
            siteHead(for: section, context: context),
            .body(
                .class("page-section"),
                siteHeader(context: context),
                .main(
                    .class("site-main"),
                    .p(.class("eyebrow"), .text(section.title)),
                    sectionBody(for: section, context: context)
                ),
                siteFooter(context: context)
            )
        )
    }
```

And add below the factory struct:

```swift
private func sectionBody(
    for section: Section<KinNoKiLabsSite>,
    context: PublishingContext<KinNoKiLabsSite>
) -> Node<HTML.BodyContext> {
    switch section.id {
    case .apps:
        let apps = section.items.sorted { $0.title.lowercased() < $1.title.lowercased() }
        return .div(.class("card-grid"), .forEach(apps) { appCard($0) })
    case .posts:
        // Restyled to .post-rows in Task 8; legacy markup keeps posts rendering until then.
        return .element(named: "ul", nodes: [
            .class("post-list"),
            .forEach(section.items) { item in
                .element(named: "li", nodes: [
                    .class("post-item"),
                    .span(.class("post-date"), .text(formattedDate(item.date))),
                    .a(.href(item.path), .text(item.title)),
                    .unwrap(item.description.isEmpty ? nil : item.description) {
                        .p(.class("post-description"), .text($0))
                    }
                ])
            }
        ])
    }
}
```

- [ ] **Step 2: Replace `makeItemHTML` with**

```swift
    func makeItemHTML(for item: Item<Site>, context: PublishingContext<Site>) throws -> HTML {
        HTML(
            .lang(context.site.language),
            siteHead(for: item, context: context),
            .body(
                .class("page-item"),
                siteHeader(context: context),
                .main(
                    .class("site-main"),
                    .if(item.sectionID == .apps, appItemBody(for: item), else: postItemBody(for: item, context: context))
                ),
                siteFooter(context: context)
            )
        )
    }
```

And add below `sectionBody`:

```swift
private func appItemBody(for item: Item<KinNoKiLabsSite>) -> Node<HTML.BodyContext> {
    .group(
        .div(.class("breadcrumb"), .a(.href("/apps"), .text("← All apps"))),
        .section(
            .class("app-hero-band"),
            accentStyle(item),
            appIcon(item),
            .div(
                .h1(.text(item.title)),
                .unwrap(item.metadata.tagline) { .p(.class("app-tagline"), .text($0)) },
                platformBadges(item)
            )
        ),
        .article(.class("article"), item.body.node)
    )
}

private func postItemBody(
    for item: Item<KinNoKiLabsSite>,
    context: PublishingContext<KinNoKiLabsSite>
) -> Node<HTML.BodyContext> {
    .article(
        .class("article"),
        .p(.class("eyebrow"), .text(formattedDate(item.date))),
        .unwrap(item.tags.nonEmpty) { tags in
            .div(.class("tag-row"), .forEach(tags) { tag in
                .a(.class("tag-chip"), .href(context.site.path(for: tag)), .text(tag.string))
            })
        },
        item.body.node
    )
}
```

(Posts keep their leading `# heading` inside `body.node` — current behavior, per spec. Tags upgrade from inert spans to linked chips.)

- [ ] **Step 3: Strip the moved lines from all five app files**

In each of `Content/apps/echo.md`, `macromark.md`, `nsmarksthespot.md`, `routey.md`, `visualtimer.md`, delete exactly these three body elements (they now render from frontmatter): the `# <Title>` line, the `<div class="app-hero" …></div>` line, and the bold one-line tagline (e.g. `**For Every Mind — Turn listening into learning.**`). Collapse the leftover blank lines so each body starts directly with its first real paragraph (Echo: "Echo is the audiobook player…"; MacroMark: "MacroMark is voice capture…"; etc.). Do not touch any other line.

- [ ] **Step 4: Verify**

```bash
swift build && make generate
grep -c 'app-hero-band' Output/apps/echo/index.html   # expect 1
grep -c 'class="app-hero"' Output/apps/echo/index.html # expect 0 (old div gone)
grep -c '<h1>' Output/apps/echo/index.html             # expect 1 (hero only, no duplicate)
grep -c 'card-grid' Output/apps/index.html             # expect 1
grep -c '← All apps' Output/apps/routey/index.html     # expect 1
grep -c 'app-monogram' Output/apps/routey/index.html   # expect 1 (no icon → monogram)
```

- [ ] **Step 5: Commit**

```bash
git add Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift Content/apps/
git commit -m "feat: apps section grid and accent hero bands; layout HTML out of app markdown

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Posts rows, prose-page article column, tag pages

**Files:**
- Modify: `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift` (sectionBody posts branch, makePageHTML, makeTagListHTML, makeTagDetailsHTML; delete old `siteMain` helpers)

**Interfaces:**
- Consumes: `siteHead` (Task 3), `.post-rows`/`.article`/`.tag-chip` CSS (Task 4).
- Produces: nothing new.

- [ ] **Step 1: Replace the `case .posts:` branch of `sectionBody` with**

```swift
    case .posts:
        return .element(named: "ul", nodes: [
            .class("post-rows"),
            .forEach(section.items) { item in
                .element(named: "li", nodes: [
                    .class("post-row"),
                    .p(.class("eyebrow"), .text(formattedDate(item.date))),
                    .h2(.a(.href(item.path), .text(item.title))),
                    .unwrap(item.description.isEmpty ? nil : item.description) {
                        .p(.class("post-desc"), .text($0))
                    }
                ])
            }
        ])
```

- [ ] **Step 2: Replace `makePageHTML` with**

```swift
    func makePageHTML(for page: Page, context: PublishingContext<Site>) throws -> HTML {
        HTML(
            .lang(context.site.language),
            siteHead(for: page, context: context),
            .body(
                .class("page-page"),
                siteHeader(context: context),
                .main(.class("site-main"), .article(.class("article"), page.body.node)),
                siteFooter(context: context)
            )
        )
    }
```

- [ ] **Step 3: Replace `makeTagListHTML` and `makeTagDetailsHTML` with**

```swift
    func makeTagListHTML(for page: TagListPage, context: PublishingContext<Site>) throws -> HTML? {
        HTML(
            .lang(context.site.language),
            siteHead(for: page, context: context, titleOverride: "Tags"),
            .body(
                .class("page-tags"),
                siteHeader(context: context),
                .main(
                    .class("site-main"),
                    .p(.class("eyebrow"), .text("Tags")),
                    .div(.class("tag-row"), .forEach(page.tags.sorted()) { tag in
                        .a(.class("tag-chip"), .href(context.site.path(for: tag)), .text(tag.string))
                    })
                ),
                siteFooter(context: context)
            )
        )
    }

    func makeTagDetailsHTML(for page: TagDetailsPage, context: PublishingContext<Site>) throws -> HTML? {
        let taggedItems = context.items(
            taggedWith: page.tag,
            sortedBy: \.date,
            order: .descending
        )
        return HTML(
            .lang(context.site.language),
            siteHead(for: page, context: context, titleOverride: page.tag.string),
            .body(
                .class("page-tag-detail"),
                siteHeader(context: context),
                .main(
                    .class("site-main"),
                    .p(.class("eyebrow"), .text("Tagged: \(page.tag.string)")),
                    .element(named: "ul", nodes: [
                        .class("post-rows"),
                        .forEach(taggedItems) { item in
                            .element(named: "li", nodes: [
                                .class("post-row"),
                                .h2(.a(.href(item.path), .text(item.title)))
                            ])
                        }
                    ])
                ),
                siteFooter(context: context)
            )
        )
    }
```

- [ ] **Step 4: Delete the two now-unused `siteMain` helper functions** (`KinNoKiTheme.swift:211-217` in the original file). If the build reports any remaining caller, that caller was missed in Tasks 6–8 — fix it, don't restore the helper.

- [ ] **Step 5: Verify**

```bash
swift build && make generate
grep -c 'post-rows' Output/posts/index.html            # expect 1
grep -c 'tag-chip' Output/posts/five-apps-and-a-services-page/index.html  # expect 1 (studio tag)
grep -c 'class="article"' Output/about/index.html      # expect 1
grep -rc 'bento-box' Output/index.html Output/about/index.html  # expect 0 for each
grep -rn 'siteMain' Sources/                           # expect no matches
```

- [ ] **Step 6: Commit**

```bash
git add Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift
git commit -m "feat: post rows, article column for prose pages, linked tag chips

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Legacy cleanup, copy-integrity diff, visual verification, regenerate, PR

**Files:**
- Modify: `Resources/styles.css` (delete LEGACY block)
- Modify: `Output/**` (regenerated, committed once)

**Interfaces:**
- Consumes: `extract_text.py` + `baseline.txt` from Task 1.

- [ ] **Step 1: Confirm no legacy classes are emitted, then delete the LEGACY block**

```bash
make generate
grep -rEc 'bento-box|class="app-hero"|post-item|post-date|post-description|class="tag"' Output/ | grep -v ':0' || echo "CLEAN"
```

Expected: `CLEAN`. Then delete everything in `Resources/styles.css` from the `LEGACY` banner comment to end of file. Re-run `make generate`.

- [ ] **Step 2: Copy-integrity diff**

```bash
python3 /private/tmp/claude-501/-Users-dfakkeldy-Developer-KinNoKiLabsSite/af163708-e20a-489a-bc5f-bad73a168552/scratchpad/extract_text.py Output \
  > /private/tmp/claude-501/-Users-dfakkeldy-Developer-KinNoKiLabsSite/af163708-e20a-489a-bc5f-bad73a168552/scratchpad/new.txt
diff -u /private/tmp/claude-501/-Users-dfakkeldy-Developer-KinNoKiLabsSite/af163708-e20a-489a-bc5f-bad73a168552/scratchpad/baseline.txt \
        /private/tmp/claude-501/-Users-dfakkeldy-Developer-KinNoKiLabsSite/af163708-e20a-489a-bc5f-bad73a168552/scratchpad/new.txt | head -200
```

Review every hunk. **Allowed diffs only:** (a) deleted duplicates from index.md (app bullets, services paragraph variant, About/Privacy footer links); (b) moved sentences (taglines/titles now rendered from frontmatter, one-liners on cards); (c) new chrome: `← All apps`, platform badge labels, `Apps`/`Tags` eyebrows, second `See Services`; (d) reordered text from layout reordering. **Any changed sentence wording = STOP and fix before proceeding.**

- [ ] **Step 3: Visual verification with the preview server**

Start the `site-preview` server from `.claude/launch.json` (serves `Output/` on port 8080) using the preview tools, then:

1. Snapshot `/` — hero headline, featured Echo card with badges, 4 app cards (Routey + Turn Timer as monograms), services band, footer links.
2. Snapshot `/apps/echo/` — breadcrumb, gold-tinted hero band, article body starting at "Echo is the audiobook player…".
3. Snapshot `/apps/routey/` — red-tinted band with `R` monogram.
4. Snapshot `/posts/` and the post page — rows, eyebrow dates, tag chip.
5. Snapshot `/about/` and `/services/` — article column.
6. Resize to 375px width — nav wraps, hero stacks, grid single-column.
7. Dark mode (`preview_resize` colorScheme dark) — black bg, dark-gold CTA.
8. Click `.font-toggle`, then `preview_inspect` body font-family — expect OpenDyslexic.
9. `preview_console_logs` — no errors.

Capture screenshots of 1, 2, 7 as evidence for the PR.

- [ ] **Step 4: Regenerate and commit everything**

```bash
make generate
git add Resources/styles.css Output
git commit -m "chore: drop legacy CSS and regenerate site for redesign

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git status --short   # expect clean
```

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin claude/site-redesign
gh pr create --base main --title "feat: site redesign — refined Apple + gold" --body "$(cat <<'EOF'
## Summary
- Theme-level redesign per docs/superpowers/specs/2026-07-05-site-redesign-design.md
- Split hero with featured Echo card; frontmatter-driven app cards; services band
- Accent hero bands on app pages; card grid on /apps; post rows; article column
- Design-system CSS (gold thread, hybrid Lexend/system type, dark mode, reduced-motion, focus-visible)
- Shared head builder: meta description, canonical, Open Graph, favicon, lang
- Copy unchanged — verified by text-extraction diff (moved/deduplicated only)

## Verification
- swift build + make generate pass at every commit
- Visual pass on all page types, light/dark, 375px; OpenDyslexic toggle works
- Copy-integrity diff reviewed hunk-by-hunk

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Report it.

---

## Self-review notes (done at authoring time)

- **Spec coverage:** decision table → Tasks 6 (hero/featured/band), 7 (interior), 4 (type/gold/tokens); metadata section → Task 3; fallbacks → `appIcon` monogram + `accentStyle` gold default + featured-absent fallback (Task 6 note); verification section → Tasks 1 + 9. Out-of-scope items appear in no task. ✓
- **Type consistency:** `appCard`/`featuredAppCard`/`appIcon`/`platformBadges`/`accentStyle` defined once (Task 6), consumed by name in Task 7; `siteHead` signature identical at definition (Task 3) and all call sites (3, 6, 7, 8). `sectionBody` defined Task 7, posts branch replaced Task 8. ✓
- **Known API risk:** `Bool?` metadata decoding and `Location.imagePath` each carry an explicit fallback in their task. ✓

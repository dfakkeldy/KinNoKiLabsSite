# KinNoKi Labs Site Redesign — Design Spec

**Date:** 2026-07-05
**Status:** Approved by Dan (brainstorm session with visual companion)
**Goal:** Redesign the site toward a modern, professional tech-company look — "refined Apple + gold" — without changing any copy.

## Decisions (locked during brainstorm)

| Question | Decision |
|---|---|
| Homepage priority | Studio story first, apps as proof of craft, services strong second |
| Visual direction | Refined Apple aesthetic with the gold (金) accent as a deliberate brand thread |
| Copy | **No wording changes.** Restructure presentation only; sentences may move (e.g., into frontmatter) but never be rewritten |
| Approach | Structured theme redesign (theme-level HTML restructure + design-system CSS), not a CSS-only reskin, not a full brand system |
| Homepage layout | Split hero: headline left, featured Echo card right; remaining apps in a card row; services band; footer |
| Type system | Hybrid — Lexend (500/600) for display: headlines, eyebrows, card titles; system stack (SF Pro on Apple devices) for body text |
| Interior pages | Accent-tinted hero band on app pages, 2-up card grid on /apps, date-eyebrow rows on /posts, shared article column for prose pages |

## Design system (CSS)

Rewrite `Resources/styles.css` as a token-based design system.

**Color tokens** (light / dark):

- Background: `#F5F5F7` / `#000000`; surface: `#ffffff` / `#1c1c1e`
- Text: `#1d1d1f` / `#f5f5f7`; muted: `#6e6e73` / `#86868b`
- Border: `rgba(0,0,0,0.1)` / `rgba(255,255,255,0.1)`; nav blur backgrounds as today
- Gold ramp: decorative gold `#c9a959`; CTA gradient light `#c9a959 → #eed9a0 → #b08d4a` (dark text), dark mode keeps the existing `#a68b5c → #f1d596 → #997843`; **gold used as text on light backgrounds must be the darkened `#8a7439`–`#a3863f` range to meet WCAG 4.5:1** — bright gold is decorative only
- The gold CTA replaces the silver "metallic" button in light mode, making gold the brand thread in both modes

**Typography:**

- Lexend loaded as a 500/600 subset with `font-display: swap`; body uses `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif`
- Scale: hero headline `clamp(2.5rem, 5vw, 3.5rem)`; h1 2.25rem; h2 1.5rem; body 17px; small text 0.95rem; eyebrow labels 0.75rem uppercase, letter-spacing 0.1em, gold
- The OpenDyslexic toggle and `@font-face` remain exactly as today

**Layout tokens:** site max-width 1080px (up from 800px, needed for the grid); article column ~68ch; card radius 16px; hero-band radius 20px; pill radius 999px; 4px-base spacing scale.

**Interaction:** cards lift with a gold border + soft shadow on hover; `:focus-visible` rings on all interactive elements; all transitions wrapped in `@media (prefers-reduced-motion: no-preference)`.

## Homepage (theme-driven, words from content)

Structure rendered by `makeIndexHTML`; **no copy lives in Swift**:

1. **Hero (split):** left — headline from `index.md` title ("Building Tools That Make Sense"), subtitle from a new `description:` frontmatter field on `index.md` holding the existing intro sentence, gold CTA "See Services" → `/services`. Right — featured app card.
2. **Featured card:** the `apps` item with `featured: true` (Echo): icon, title, tagline, platform badges, gold-trimmed border. Links to the app page.
3. **App row:** remaining `apps` items as cards (icon/monogram, title, one-line description), generated from section items sorted by title.
4. **Services band:** "Services" heading, blurb from a new `description:` frontmatter field on `services.md` (existing first sentence), gold CTA "See Services".
5. **Footer (site-wide):** existing words — © line with Publish credit, Privacy Policy | Support links.

The one-line app descriptions currently in `index.md`'s bullet list move to each app file's `description:` frontmatter (single source of truth; same sentences). `index.md`'s body shrinks to the hero words; the bullets and duplicate links are deleted because the theme now renders that layout.

## Interior pages

- **/apps section:** eyebrow label "Apps", 2-up card grid (1-up below 600px), same card component as homepage.
- **App detail pages:** breadcrumb "← All apps"; hero band tinted with the app's accent (`linear-gradient` at low alpha + accent border) containing icon (72–96px), title, tagline, platform badges; markdown body in the article column. The hand-written `<div class="app-hero">` HTML in app files is deleted — theme owns the hero. Each app file's leading `# Title` line and bolded tagline line move into frontmatter (`title`, `tagline`) so the hero doesn't duplicate them.
- **/posts section:** full-width rows — date as gold eyebrow, Lexend title, muted description.
- **Post pages:** date eyebrow, tags as gold-outline chips, article column. Posts keep their leading `# heading` in the body (current behavior, unchanged).
- **Prose pages** (about, services, privacy, support, echo-* help pages, etc.): article column treatment automatically via `makePageHTML`.
- **Tag list/detail pages:** tags rendered as gold-outline chips; item lists reuse the post-row component.

## Metadata (`<head>`)

One shared head builder used by every page factory method:

- `<title>` (current pattern), `meta description` (item/page description, else site description), canonical URL
- Open Graph: `og:title`, `og:description`, `og:type`, `og:url`, `og:image` (app icon for app pages, `/logo.png` otherwise); `twitter:card summary`
- `<link rel="icon" href="/logo.png">` (a proper favicon set is out of scope)

## Theme architecture (Swift)

- **`ItemMetadata`** gains optional fields: `icon: String?`, `accent: String?`, `tagline: String?`, `platforms: String?` (comma-separated, split by theme), `featured: Bool?`. Only app items use them; posts omit them.
- **App frontmatter example (echo.md):** existing sentences moved, not rewritten:
  ```yaml
  ---
  description: An audiobook player built for studying, not just listening.
  icon: /images/apps/echo.png
  accent: "#d4af37"
  tagline: For Every Mind — Turn listening into learning.
  platforms: iPhone, Apple Watch, Mac, CarPlay
  featured: true
  ---
  ```
- **`KinNoKiHTMLFactory`** is reorganized into small node-builder functions (head, hero, appCard, servicesBand, articleColumn, breadcrumb, footer) shared across the six factory methods.
- **Fallbacks (error handling):**
  - Missing `icon` (Turn Timer, Routey today): render a monogram tile — first letter of the app name on an accent-tinted rounded square. No broken `<img>` ever.
  - Missing `accent`: default to the gold ramp.
  - Missing `tagline`/`platforms`: element simply omitted.
  - No item marked `featured`: homepage falls back to a plain 5-card grid (no flagship slot).

## Out of scope (deliberately)

Per-app screenshot banners, full favicon set, styled RSS, scroll animations, any copy rewrites, new app icons (monogram fallback covers the gap until real icons exist).

## Verification

1. `swift build` and `make generate` succeed.
2. Preview the generated `Output/` locally; verify every page type (home, /apps, app detail, /posts, post, prose page, tags) in light **and** dark mode, and at 375px mobile width; capture screenshots.
3. Copy integrity check: extract visible text from old vs. new generated HTML and diff — the only acceptable differences are moved/deduplicated sentences, never rewritten ones.
4. Confirm the OpenDyslexic toggle still switches fonts on the new components.

## Repository notes

- `Output/` is generated — never hand-edited; regenerate with `make generate` as the final implementation step so the PR ships the deployable site (Cloudflare Pages serves the committed `Output/`).
- This repo has no nightly/weekly promotion ladder; convention is feature branch → PR to `main`.

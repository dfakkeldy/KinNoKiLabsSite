# KinNoKi Labs site

Static site built with Swift [Publish](https://github.com/johnsundell/publish).
Markdown in `Content/` plus the theme in `Sources/KinNoKiLabsSite/` generate
`Output/`, which is committed and served by Cloudflare Pages.

## Commands

```bash
make generate        # regenerate Output/ (deterministic)
make preview         # generate and serve at http://localhost:8000
make test            # every JavaScript suite
make test-games      # Arcade Hall   (/games)
make test-tools      # Web Tools     (/tools)
make test-listen     # Echo Listening Room (/listen)
make test-fiction    # Fiction Listening Room (/fiction); needs a generated Output/
```

`make publish` runs `git add -A`, commits, and pushes the current branch. Use
a task branch and a PR instead.

## Generation rules

- Never edit `Output/` by hand.
- Always generate through `make`. It refuses to run while `Content/` has
  uncommitted changes, so commit content first. Build dates come from Git in
  `America/Halifax` time, so output is identical across machines.
- The marketing pages (home, `/apps`, `/apps/echo`, `/services`, `/about`,
  `/support`) and the app cards have their copy in `Theme/KinNoKiTheme.swift`,
  not in their Markdown. Their Markdown supplies only title and meta. Posts,
  `/privacy`, and the guides render their Markdown bodies.
- App item frontmatter values are unquoted (Ink splits on the first colon).

## Sitemap, feed, and 404 (`main.swift`)

- `KinNoKiLabsSite.unlistedItemPaths` lists item pages that stay reachable for
  old links but get `noindex` and stay out of `sitemap.xml` and the RSS feed.
  `apps/routey` is on it (Routey is discontinued). Add a page here instead of
  deleting it when something still links to it.
- `KinNoKiLabsSite.staticSitemapPaths` adds hand-authored static pages under
  `Resources/` that Publish can't see (`/listen/`, the NS Marks map). Add new
  static apps here. Generation fails if a listed page's `index.html` is
  missing from `Output/`.
- A publish step writes `Output/404.html` from the theme (`noindex`, no
  canonical). Keep it: without a top-level `404.html`, Cloudflare Pages serves
  the homepage with HTTP 200 for every unknown path.

## Generated or pinned content (don't hand-edit)

- `Resources/listen/books.json` and `Resources/listen/books/`: rebuilt by
  `make listen-catalog` from a local explainer-audiobooks checkout. The
  builder's `ALLOW_LIST` and `AUDIO_EXPECTED` lists are the publication gates.
  Books marked private (The Long Route, The Living Knowledge Base) stay out
  unless Dan decides otherwise.
- Paired cover art: `make paired-covers`, pinned by
  `Resources/learn/paired-cover-source-manifest.json`.
- `Resources/tools/turn-timer/`: `make sync-turn-timer-web`, pinned by
  `Tools/turn-timer-web-source.json`.
- NS Marks map at `/apps/nsmarksthespot/map/`: pinned by
  `Tools/ns-marks-web-source.json` and promoted by
  `.github/workflows/promote-ns-marks-web.yml`, which opens a PR but never
  merges it.
- Fiction books: `Resources/fiction/books.json` is hand-curated, but add a
  narrated book only with `node Tools/stage-fiction-book.mjs <slug>`;
  `blocks.json` can't be written by hand. A book's audio is either fully
  pending (no stream URL, duration, text, alignment, or chapter starts) or
  fully available (release-asset `.m4b` URL, duration, text blocks, alignment
  sidecar, contiguous chapters).

## Browser apps

- `/listen` and `/fiction` share `listen.css` and `listen-core.js`. Don't
  fork them. `listen-core.js` ports Echo's word timing and cue logic, so keep
  it matching Echo.
- Games, tools, and listening rooms keep all state in the browser
  (localStorage or IndexedDB). Nothing is uploaded.

## Tender showcase (`Content/tenders/`)

Hand-curated proof-of-work examples, not a live directory. Frontmatter holds
verified source facts, and the H2 sections hold KinNoKi's analysis; keep the
two separate. Links go only to the official procurement source; never
redistribute tender documents. A current entry needs at least ten days before
closing when first added. Recheck dates and addenda against the official
notice, and update `checkedAt`, before each refresh. `make tender-pack`
rebuilds the demo pack. Tenders stay out of the RSS feed.

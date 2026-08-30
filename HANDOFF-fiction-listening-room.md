# Handoff — Fiction Listening Room (`/fiction`)

## 2026-08-09 — Room built, tested, and generated

Done:
- `/fiction` shipped from `Resources/fiction/` (index.html, fiction.css,
  fiction.js, curated books.json, five 600×600 covers). Reuses
  `/listen/listen.css` + `/listen/listen-core.js` — no fork.
- No fiction narration exists anywhere yet, so the player renders an
  honest awaiting-narration state (real opening lines, dead transport,
  production label per book) instead of faking playback.
- Catalog is audio-gated: a book is inert or fully streamable, nothing
  between. Adding a narrated edition turns the player on with no code
  change; `Tests/fiction/player-dom.test.mjs` drives both states.
- 59 fiction tests + full suite (1012) pass. Verified in-browser: both
  themes, 375px and 1280px, all requests 200, light-theme badge contrast
  raised 4.13→7.85 by moving off `--gold-text`.

Next:
- Push the five manuscripts to `dfakkeldy/explainer-audiobooks`, then add
  each book's `links` (`read`/`epub`/`folder`) — one line per book. Until
  then the format nav stays hidden by design.
- When narration lands: add `durationSeconds`, `audio`, `chapters` with
  times, `text.blocks`, `alignment.sidecar`. No JS changes needed.

Resume:
```
Worktree /Users/dfakkeldy/Developer/KinNoKiLabsSite/.claude/worktrees/fiction-listening-room-b6bf60
Branch claude/fiction-listening-room-b6bf60 — PR open.
Next: add format links to Resources/fiction/books.json once the manuscripts
are public in dfakkeldy/explainer-audiobooks, then `make generate && make test-fiction`.
```

## 2026-08-09 — The Human Exception is live

Done:
- `Tools/stage-fiction-book.mjs` stages one narrated book from the public
  explainer-audiobooks package: verifies receipt hashes and public gates,
  derives blocks.json from the EPUB spine, and proves all 3,523 sidecar
  anchors resolve and match their block text before writing.
- The Human Exception now streams — 24 chapters, 7:53:23, from the GitHub
  **release asset** (the M4B is 123 MB, too big for the repo). `fiction.js`
  was not touched; the catalog contract turned the player on by itself.
- Contract widened for release-tag-pinned URLs; production states gained
  `first-listen`/`published`; the inert player tests now run against a
  synthetic all-pending catalog and new tests drive the real one.
- 68 fiction tests + full `make test` pass. Verified live in-browser:
  real range-streamed playback, word-level karaoke off the real sidecar,
  chapter seeking, speed ladder, position memory, both themes, 375/1280.

Next:
- Close the human reading/listening review, then re-run the stager so
  `production.state` flips to `published` and the first-listen note drops.
- Stage the other four books the same way as narration lands.

## 2026-08-30 — Reversible Containment is live

Done:
- Staged from explainer-audiobooks merge `c03c1d0c760e64790cdae5fa60984662682aaacb`
  (PR #100) via `Tools/stage-fiction-book.mjs reversible-containment`. Receipt
  hashes, public gates, and chapter windows from the release M4B all verified.
  Human reading and listening reviews are still pending, so the entry stays
  `first-listen` with the existing disclosure copy.
- 30 chapters, 9:56:19, from the GitHub release asset
  `fiction-reversible-containment-20260812T103225Z/reversible-containment.m4b`.
  `fiction.js` was not touched; the catalog contract turned the player on.
- The sidecar omits `words` on 75 blocks Echo did not speak (mostly fenced
  policy dumps). The stager now skips those for the spoken-text proof the
  same way `catalog.test.mjs` already did; they still have to resolve to a
  block. `hasWordTimings` is therefore false even though 4,987 anchors carry
  word timings and the player interpolates the rest.

Next:
- Close the human reading/listening review on both live titles, then re-run
  the stager so `production.state` flips to `published`.
- Stage the remaining three books the same way as narration lands.

Resume:
```
node Tools/stage-fiction-book.mjs <slug> && make generate && make test
```

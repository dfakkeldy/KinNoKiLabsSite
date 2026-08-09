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

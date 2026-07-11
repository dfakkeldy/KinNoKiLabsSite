# Playable Learning Library — design

**Date:** 2026-07-11  
**Status:** approved by Dan  
**Site branch:** `codex/learn-playable-library`

## Goal

Restore real playback at `kinnokilabs.com/listen/` and publish three completed,
public-safe learning audiobooks in the browser library:

- *Chicken Predators*
- *Rodents in the Walls*
- *The New Deal — Canada Post, CUPW, and What It Means for Rural Mail*

Dan explicitly approved public publication of *The New Deal* on 2026-07-11.
The other two books were already classified public-safe and already appear on
the `/learn` page.

## Verified starting state

- The production `listen/books.json` catalog contains eight entries and zero
  entries with `audio.status == "available"`. The existing player therefore
  follows its designed empty-state path and hides the playback shell.
- The player implementation is intact and its 15 pure-logic tests pass.
- Finished Echo/Kokoro M4Bs and alignment sidecars exist locally for all three
  requested books. Each M4B contains named chapters and is smaller than
  GitHub's per-file limit: approximately 45 MB, 30 MB, and 29 MB.
- *Chicken Predators* and *Rodents in the Walls* already have public book
  folders in `dfakkeldy/explainer-audiobooks`, but those folders do not contain
  their M4Bs or alignment sidecars.
- *The New Deal* exists as a completed local custom-learning package, and
  Explainer Audiobooks PR #15 published its approved Markdown, EPUB, selected
  cover, and README under `books/the-new-deal/`. The Markdown, EPUB, and cover
  payloads are byte-identical to the approved local source; its M4B and
  alignment sidecar were not included in that PR.

## Chosen approach

The public `explainer-audiobooks` repository remains the canonical book source,
and the KinNoKi site continues to stream SHA-pinned audio from that repository.
The site repository stores only its generated catalog, downscaled covers,
read-along block exports, and alignment copies.

This preserves the existing Listening Room architecture and avoids duplicating
roughly 104 MB of audio inside every website deployment. Moving audio to
GitHub Releases or object storage remains a later scaling option because the
catalog already abstracts audio URLs.

### Live-base reconciliation

While the audio-package work was being staged, Explainer Audiobooks PR #15
merged the approved *The New Deal* text package under the canonical public slug
`the-new-deal`. Dan approved consolidating on that live path instead of creating
the originally planned duplicate `cupw-collective-agreement` public folder. The
local custom-learning build keeps its historical source slug; only public
package, catalog, site, and production references use `the-new-deal`.

## Public package boundary

The Explainer Audiobooks change will:

1. Add the final M4B and alignment sidecar to the existing public folders for
   *Chicken Predators* and the corrected v2 edition of *Rodents in the Walls*.
2. Reuse `books/the-new-deal/` for *The New Deal*. Preserve PR #15's README and
   byte-compare only its Markdown, EPUB, and selected bright cover payloads with
   the approved local source; add the renamed approved audio and sidecar as
   `the-new-deal.m4b` and `the-new-deal.alignment.json`, then update the README's
   public-file and verification details.
3. Update the collection README/index metadata so all three packages are
   discoverable and honestly describe their narration and review status.

Raw research, chapter workspaces, narration scratch, alternate covers, private
delivery metadata, and local QA scratch remain outside the public repository.
The public README for *The New Deal* will describe it as an educational overview
of public labour documents, not workplace, legal, or financial advice.

## Site catalog and data flow

`Tools/build-listen-catalog.sh` will add all three slugs to its public allow-list
and to `AUDIO_EXPECTED`. A catalog build must fail if any expected M4B,
alignment sidecar, cover, EPUB, or book directory is missing.

For each playable book, the builder will continue to:

1. read duration and named chapters from the M4B with `ffprobe`;
2. export EPUB blocks through Echo's `echo-cli export-blocks` command;
3. prove every alignment anchor resolves to an exported block;
4. copy the alignment JSON and a downscaled cover into site resources; and
5. generate an `audio.status: "available"` entry whose raw audio URL is pinned
   to the exact public Explainer Audiobooks commit used for the build.

The generated catalog will make *Chicken Predators* the default book because it
is the first requested title. A valid `?book=<slug>` query continues to select a
specific playable title.

## Listening Room behavior

The player remains a single-book stage rather than becoming a second full
audiobook application.

- The library list adds a **Listen** action for every entry whose audio status
  is available. The action reloads the stage with `?book=<slug>`.
- The currently selected book is omitted from the secondary list, matching the
  existing behavior.
- EPUB and **Read** links remain visible for every title.
- Playback never starts automatically. The existing play/pause, seeking,
  chapter navigation, speed, captions, MediaSession, and saved-position
  behavior remain unchanged.
- Library copy will no longer claim that the rest of the collection only ships
  as EPUB and Markdown now that multiple books are streamable.

The `/learn` sample grid will add one card for *The New Deal*. Its existing
*Chicken Predators* and *Rodents in the Walls* cards remain unchanged except for
any mechanically updated runtime derived from the final M4B metadata.

## Error handling

- A failed catalog request keeps the existing explicit retry message.
- A failed audio stream disables playback and leaves the EPUB and reading links
  available.
- A read-along export or sidecar failure blocks catalog generation instead of
  publishing silent caption drift.
- If a requested `?book=` slug is absent or not playable, the player falls back
  to the first available book.
- If no books are playable, the current honest empty state remains as the final
  fallback.

## Verification

Implementation will use a red-green regression test that initially fails
against the zero-playable catalog, then proves that exactly the three requested
slugs are playable and each has duration, chapters, cover, block data,
alignment data, links, and a SHA-pinned audio URL.

The acceptance gate is:

1. validate all three EPUB archives;
2. parse all alignment JSON and prove timestamp monotonicity;
3. run Echo's sidecar verifier for each EPUB/M4B/alignment trio;
4. export blocks and prove 100% anchor resolution for every book;
5. inspect M4B duration, codec, tags, and named chapters with `ffprobe`;
6. run the Listening Room Node test suite;
7. run `swift build`, `make generate`, and `git diff --check`;
8. verify locally that each **Listen** action selects the correct book and that
   play, pause, scrub, chapter seek, speed, resume, captions, EPUB, and reading
   links work;
9. check a narrow mobile viewport, keyboard controls, accessible labels,
   light/dark themes, and OpenDyslexic; and
10. after publication, verify the production catalog, all three raw audio URLs,
    HTTP range support, and real playback from `kinnokilabs.com/listen/`.

## Publishing sequence

1. Create a clean Explainer Audiobooks worktree from current `origin/main`,
   publish the three coherent book packages, run package checks, then push a
   ready PR to `main`.
2. Build the site catalog from the pushed public commit, implement the library
   **Listen** links and `/learn` card, regenerate `Output/`, verify, then push a
   ready KinNoKi site PR to `main`.
3. Treat production as pending until both PRs merge and Cloudflare serves the
   new committed `Output/` tree. Record the final public state in the business
   knowledge base with links to both PRs and production verification.

## Out of scope

- Narrating additional books
- A scrolling reader, uploads, accounts, or library management
- Migrating audio to Cloudflare R2 or another object store
- Publishing private research or delivery artifacts
- Reclassifying *The Long Route* or *The Living Knowledge Base* as public

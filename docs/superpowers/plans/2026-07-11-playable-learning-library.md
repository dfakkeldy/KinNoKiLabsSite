# Playable Learning Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish three approved learning-audiobook packages and make all three selectable, streamable, and captioned at `kinnokilabs.com/listen/`, with *The New Deal* also added to `/learn`.

**Architecture:** `dfakkeldy/explainer-audiobooks` remains the canonical public package and audio host. The KinNoKi site builds a catalog pinned to the exact pushed book commit, stores only small read-along assets locally, and selects a playable book through the existing `?book=<slug>` contract. The book PR must be pushed before the site catalog is generated, and production verification waits for both PRs to merge.

**Tech Stack:** Git worktrees, EPUB 3, M4B/AAC, Echo `echo-cli`, Bash, `jq`, `ffprobe`, Swift Publish, vanilla JavaScript, CSS, Node's built-in test runner, Cloudflare Pages.

## Global Constraints

- Approved public titles are exactly `chicken-predators`, `rodents-in-the-walls`, and `the-new-deal`.
- *The Long Route* and *The Living Knowledge Base* remain private and must not reappear in source, catalog, generated output, or links.
- Use the corrected `rodents-in-the-walls-v2` package, not the older public edition or the first local render.
- Publish final Markdown, EPUB, selected cover, M4B, alignment sidecar, and public README only; never publish research folders, chapter workspaces, narration scratch, alternate covers, QA scratch, or private delivery metadata.
- Keep audio in `explainer-audiobooks`; do not copy M4Bs into KinNoKi `Resources/` or `Output/`.
- Audio URLs in `Resources/listen/books.json` must be pinned to the exact pushed Explainer Audiobooks commit SHA, never `main`.
- Do not manually edit `Output/`; regenerate it with `make generate`.
- No new third-party dependencies.
- Preserve unrelated edits in the existing dirty Explainer Audiobooks and Echo checkouts by using clean worktrees.
- Build Echo through `"$HOME/.claude/bin/xcode-build-gate.sh" --wait` and never run concurrent Xcode builds.
- Create normal ready-for-review PRs against `main` in both public repositories; do not push directly to `main`.
- Treat production as not fixed until both PRs are merged and the live player is verified.

### Live-base reconciliation

While Task 1 was being staged, Explainer Audiobooks PR #15 merged the approved
*The New Deal* manuscript, EPUB, selected cover, and README under the canonical
public slug `the-new-deal`. The manuscript, EPUB, and cover payloads are
byte-identical to the approved local source. Dan approved consolidating on that
live path rather than creating the originally planned duplicate
`cupw-collective-agreement` public folder. The local custom-learning build keeps
its historical `cupw-collective-agreement` source name; every public package,
catalog, site, knowledge-base, and production reference uses `the-new-deal`.

## File map

### Explainer Audiobooks repository

- Modify `README.md` — add Chicken and Rodents, update the existing New Deal row, record actual narrated runtimes, and add audio-package wording.
- Modify `books/chicken-predators/README.md`; add its final `.m4b` and `.alignment.json`.
- Replace the public `books/rodents-in-the-walls/` text package with the corrected v2 files; add its final `.m4b` and `.alignment.json`.
- Preserve the existing PR #15 Markdown, EPUB, and cover in `books/the-new-deal/` after byte comparison; modify its existing README and add `the-new-deal.m4b` plus `the-new-deal.alignment.json`.

### KinNoKi site repository

- Create `Tests/listen/catalog.test.mjs` — catalog completeness, pinning, and anchor-parity regression test.
- Modify `Tools/build-listen-catalog.sh` — allow-list and require all three playable packages.
- Regenerate `Resources/listen/books.json` and `Resources/listen/books/<slug>/` — catalog, covers, blocks, and alignment.
- Modify `Resources/listen/listen-core.js`, `Tests/listen/listen-core.test.mjs`, `Resources/listen/listen.js`, `Resources/listen/listen.css`, and `Resources/listen/index.html` — tested **Listen** actions and accurate library copy.
- Create `Tests/site/learn-library.test.mjs`; modify `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift`; regenerate `Output/` — *The New Deal* card and privacy regression.

### Business knowledge base

- Create `bundle/status/2026-07-11-kinnoki-playable-learning-library.md`.
- Modify `bundle/status/index.md`, `bundle/projects/kinnoki-labs-site.md`, `bundle/projects/explainer-audiobooks.md`, and `bundle/log.md`.

---

### Task 1: Publish the three canonical public book packages

**Files:**
- Modify: `/Users/dfakkeldy/.codex/worktrees/explainer-playable-library/README.md`
- Modify: `/Users/dfakkeldy/.codex/worktrees/explainer-playable-library/books/chicken-predators/README.md`
- Add: `/Users/dfakkeldy/.codex/worktrees/explainer-playable-library/books/chicken-predators/{chicken-predators.m4b,chicken-predators.alignment.json}`
- Replace: `/Users/dfakkeldy/.codex/worktrees/explainer-playable-library/books/rodents-in-the-walls/{README.md,rodents-in-the-walls.md,rodents-in-the-walls.epub,cover.png}`
- Add: `/Users/dfakkeldy/.codex/worktrees/explainer-playable-library/books/rodents-in-the-walls/{rodents-in-the-walls.m4b,rodents-in-the-walls.alignment.json}`
- Preserve after byte comparison: `/Users/dfakkeldy/.codex/worktrees/explainer-playable-library/books/the-new-deal/{the-new-deal.md,the-new-deal.epub,cover.png}`
- Modify: `/Users/dfakkeldy/.codex/worktrees/explainer-playable-library/books/the-new-deal/README.md`
- Add: `/Users/dfakkeldy/.codex/worktrees/explainer-playable-library/books/the-new-deal/{the-new-deal.m4b,the-new-deal.alignment.json}`

**Interfaces:**
- Consumes: final local packages under `/Users/dfakkeldy/Developer/explainer-audiobooks/.build/custom-learning-audiobooks/`.
- Produces: a pushed public commit whose three `books/<slug>/` folders satisfy the site's catalog-builder contract.

- [ ] **Step 1: Create clean book and Echo CLI worktrees**

Invoke `superpowers:using-git-worktrees`, then run:

```bash
set -euo pipefail

git -C /Users/dfakkeldy/Developer/explainer-audiobooks fetch origin
git -C /Users/dfakkeldy/Developer/explainer-audiobooks worktree add \
  -b codex/publish-playable-books \
  /Users/dfakkeldy/.codex/worktrees/explainer-playable-library \
  origin/main

git -C /Users/dfakkeldy/Developer/Echo fetch origin
git -C /Users/dfakkeldy/Developer/Echo worktree add --detach \
  /Users/dfakkeldy/.codex/worktrees/echo-listen-cli \
  origin/nightly
```

Expected: both worktrees are clean; the original dirty checkouts are unchanged.

- [ ] **Step 2: Build the clean Echo CLI**

```bash
set -euo pipefail

"$HOME/.claude/bin/xcode-build-gate.sh" --wait && \
  make -C /Users/dfakkeldy/.codex/worktrees/echo-listen-cli echo-cli
/Users/dfakkeldy/.codex/worktrees/echo-listen-cli/.build/cli/Build/Products/Release/echo-cli export-blocks --help
/Users/dfakkeldy/.codex/worktrees/echo-listen-cli/.build/cli/Build/Products/Release/echo-cli verify-sidecar --help
```

Expected: `BUILD SUCCEEDED`; both subcommands print their option help.

- [ ] **Step 3: Capture the red package state**

```bash
set -euo pipefail

BOOKS_WT=/Users/dfakkeldy/.codex/worktrees/explainer-playable-library
missing=0
for path in \
  "$BOOKS_WT/books/chicken-predators/chicken-predators.m4b" \
  "$BOOKS_WT/books/chicken-predators/chicken-predators.alignment.json" \
  "$BOOKS_WT/books/rodents-in-the-walls/rodents-in-the-walls.m4b" \
  "$BOOKS_WT/books/rodents-in-the-walls/rodents-in-the-walls.alignment.json" \
  "$BOOKS_WT/books/the-new-deal/the-new-deal.m4b" \
  "$BOOKS_WT/books/the-new-deal/the-new-deal.alignment.json"; do
  if [ ! -f "$path" ]; then echo "MISSING $path"; missing=1; fi
done
exit "$missing"
```

Expected: exit 1 and all six listed audio/sidecar files report `MISSING` on the
PR #15 base.

- [ ] **Step 4: Copy only the approved canonical artifacts**

```bash
set -euo pipefail

SOURCE=/Users/dfakkeldy/Developer/explainer-audiobooks/.build/custom-learning-audiobooks
BOOKS_WT=/Users/dfakkeldy/.codex/worktrees/explainer-playable-library

# PR #15 already published the approved text package at books/the-new-deal.
# Prove all three immutable payloads are approved before copying any artifact.
cmp -s "$SOURCE/cupw-collective-agreement/dist/cupw-collective-agreement.md" \
  "$BOOKS_WT/books/the-new-deal/the-new-deal.md"
cmp -s "$SOURCE/cupw-collective-agreement/dist/cupw-collective-agreement.epub" \
  "$BOOKS_WT/books/the-new-deal/the-new-deal.epub"
cmp -s "$SOURCE/cupw-collective-agreement/dist/cover-1.png" \
  "$BOOKS_WT/books/the-new-deal/cover.png"

cp "$SOURCE/chicken-predators/dist/chicken-predators.m4b" "$BOOKS_WT/books/chicken-predators/"
cp "$SOURCE/chicken-predators/dist/chicken-predators.alignment.json" "$BOOKS_WT/books/chicken-predators/"

cp "$SOURCE/rodents-in-the-walls-v2/dist/rodents-in-the-walls.md" "$BOOKS_WT/books/rodents-in-the-walls/"
cp "$SOURCE/rodents-in-the-walls-v2/dist/rodents-in-the-walls.epub" "$BOOKS_WT/books/rodents-in-the-walls/"
cp "$SOURCE/rodents-in-the-walls-v2/dist/cover.png" "$BOOKS_WT/books/rodents-in-the-walls/cover.png"
cp "$SOURCE/rodents-in-the-walls-v2/dist/rodents-in-the-walls.m4b" "$BOOKS_WT/books/rodents-in-the-walls/"
cp "$SOURCE/rodents-in-the-walls-v2/dist/rodents-in-the-walls.alignment.json" "$BOOKS_WT/books/rodents-in-the-walls/"
cp "$SOURCE/rodents-in-the-walls-v2/dist/README.md" "$BOOKS_WT/books/rodents-in-the-walls/README.md"

# Keep the local source-build names, but explicitly rename public destinations.
cp "$SOURCE/cupw-collective-agreement/dist/cupw-collective-agreement.m4b" \
  "$BOOKS_WT/books/the-new-deal/the-new-deal.m4b"
cp "$SOURCE/cupw-collective-agreement/dist/cupw-collective-agreement.alignment.json" \
  "$BOOKS_WT/books/the-new-deal/the-new-deal.alignment.json"
```

- [ ] **Step 5: Correct the Chicken Predators public README**

Use `apply_patch` in the book worktree:

```diff
*** Begin Patch
*** Update File: books/chicken-predators/README.md
@@
-Deep (~4 hours target). **Actual: ~3.4 hours at 1.0x, ~2.7 hours at 1.25x.**
+Deep (~4 hours target). **Actual: 3:05:40 at 1.0x, about 2.5 hours at 1.25x.**
@@
-~3.4 hours at 1.0x / ~2.7 hours at 1.25x (estimated at 150 wpm)
+3:05:40 at 1.0x (verified with `ffprobe`)
@@
-`am_michael` (Echo/Kokoro). Fallback `am_puck` if am_michael unavailable.
+`am_michael` (native Echo/Kokoro render)
@@
-## Output files
+## Public files
@@
-- `cover-1.png`, `cover-2.png`, `cover-3.png` — all three rendered candidates
-- `cover-concept-1.svg`, `cover-concept-2.svg`, `cover-concept-3.svg` — source SVG art
-- `chicken-predators.m4b` — Echo/Kokoro audio (render in progress at manifest time)
-- `chicken-predators.alignment.json` — Echo alignment sidecar (render in progress)
+- `chicken-predators.m4b` — chaptered Echo/Kokoro audiobook
+- `chicken-predators.alignment.json` — 231-anchor Echo read-along sidecar
@@
-## QC gates in progress / pending
-- ⏳ M4B duration (`ffprobe`) — awaiting narration render completion
-- ⏳ Alignment JSON parse — awaiting narration render completion
-- ⏳ Optional Echo QA report — schema-dependent, may skip
+## Audio verification
+- M4B duration: 11,140.181 seconds (3:05:40), AAC, 16 named chapters.
+- Alignment JSON: 231 monotonic anchors.
+- Echo sidecar verification: `SIDECAR_OK`, 231 anchors, 16 chapters.
@@
-`books/chicken-predators/` — public-safe EPUB, Markdown, cover, README.
+`books/chicken-predators/` — public-safe EPUB, Markdown, cover, M4B, alignment sidecar, and README.
*** End Patch
```

- [ ] **Step 6: Correct the Rodents in the Walls v2 public README**

Use `apply_patch` after copying the v2 README:

```diff
*** Begin Patch
*** Update File: books/rodents-in-the-walls/README.md
@@
-The public repository package contains the Markdown, EPUB, cover, and this README. The full M4B, alignment sidecar, and QA report are delivered in the iCloud Books package.
+The public repository package contains the Markdown, EPUB, selected cover, chaptered M4B, alignment sidecar, and this README. The narration-QA report and delivery checksums remain in the private delivery package.
*** End Patch
```

- [ ] **Step 7: Update the existing PR #15 public README for The New Deal**

Retain the existing title, manifest, chapter list, cover disclosure, and safety
language in `books/the-new-deal/README.md`. Use `apply_patch` only for the new
public audio facts:

```diff
*** Begin Patch
*** Update File: books/the-new-deal/README.md
@@
-- **Runtime:** ~1.8 hours at 1.0x, ~1.5 hours at 1.25x
+- **Runtime:** 1:55:42 at 1.0x (6,942.336 seconds), about 1.5 hours at 1.25x
@@
 - `the-new-deal.epub` — EPUB 3 with nav + NCX
 - `the-new-deal.md` — combined Markdown
 - `cover.png` — selected initial release cover
+- `the-new-deal.m4b` — chaptered native Echo/Kokoro audiobook
+- `the-new-deal.alignment.json` — Echo read-along sidecar
 - `README.md` — this manifest
@@
-The complete Echo listening package, including native M4B audio and alignment
-sidecar, remains in the iCloud Books delivery folder. The public repository
-follows the collection convention of publishing EPUB, combined Markdown, and
-the selected cover.
+The public repository package includes the EPUB, combined Markdown, selected
+cover, chaptered native M4B audio, alignment sidecar, and this README. Private
+research, production scratch, and optional narration-QA artifacts remain out of
+the public package.
@@
 ### Passed after delivery
-- ✅ M4B duration: 6,942.336 seconds (1:55:42)
-- ✅ Alignment JSON parses successfully
+- ✅ M4B: AAC, 9 named chapters, 6,942.336 seconds (1:55:42)
+- ✅ Alignment JSON: 151 monotonic anchors
+- ✅ Echo sidecar verification: `SIDECAR_OK`, 151 anchors, 9 chapters
@@
-- Optional Echo QA (`echo-cli qa`) — will attempt after render completes
+- Optional Echo QA (`echo-cli qa`) — not included in the public package
*** End Patch
```

- [ ] **Step 8: Update the public collection index**

First capture the PR #15 baseline invariant:

```bash
set -euo pipefail

BOOKS_WT=/Users/dfakkeldy/.codex/worktrees/explainer-playable-library
test "$(rg -c '^\| \[The New Deal\]\(books/the-new-deal/\) \|' "$BOOKS_WT/README.md")" -eq 1
```

Expected: exactly one existing New Deal row. Then use `apply_patch` in
`README.md`; add only the two missing rows and replace the existing New Deal
row rather than inserting a duplicate:

```diff
*** Begin Patch
*** Update File: README.md
@@
-- **If you want to learn** — there are ~35 hours of narration-ready beginner guides below, free, mostly grounded in real code and public technical sources. Drop an `.epub` into any audiobook or reader app and listen.
+- **If you want to learn** — there are more than 42 hours of beginner guides below, free, mostly grounded in real code and public technical sources. Every book has an EPUB, and selected books also include a chaptered M4B with Echo read-along data.
@@
 | [The Voice in the Machine](books/the-voice-in-the-machine/) | How on‑device AI narration works (Kokoro on ONNX Runtime) | 11 chapters · ~3.6 h | Opus 4.8 |
-| [The New Deal](books/the-new-deal/) | Canada Post, CUPW, and the future of rural mail | 9 chapters · ~1.8 h | GLM-5.2 |
+| [Chicken Predators](books/chicken-predators/) | Identify and prevent poultry predation in Cape Breton | 16 chapters · ~3.1 h | GLM-5.2 |
+| [Rodents in the Walls](books/rodents-in-the-walls/) | Identify, exclude, and clean up after house-invading rodents | 9 chapters · ~2.0 h | GPT-5.6 Sol |
+| [The New Deal](books/the-new-deal/) | Canada Post, CUPW, and the rural-mail implications of the 2026 agreements | 9 chapters · ~1.9 h | GLM-5.2 |
@@
-Each folder holds the **`.epub`** (for any audiobook/reader app, including on‑device text‑to‑speech), a combined **`.md`** (readable right here on GitHub), and the cover.
+Each folder holds the **`.epub`**, a combined **`.md`** readable on GitHub, and the cover. Narrated public packages also include a chaptered **`.m4b`** and Echo **`.alignment.json`** read-along sidecar.
*** End Patch
```

Run the duplicate-row regression guard:

```bash
set -euo pipefail

BOOKS_WT=/Users/dfakkeldy/.codex/worktrees/explainer-playable-library
test "$(rg -c '^\| \[The New Deal\]\(books/the-new-deal/\) \|' "$BOOKS_WT/README.md")" -eq 1
rg -F '| [The New Deal](books/the-new-deal/) | Canada Post, CUPW, and the rural-mail implications of the 2026 agreements | 9 chapters · ~1.9 h | GLM-5.2 |' "$BOOKS_WT/README.md"
```

Expected: one matching row. The superseded insertion-only patch would produce
two rows and fail this guard; the replacement patch remains at one.

- [ ] **Step 9: Run the complete package acceptance gate**

```bash
set -euo pipefail

BOOKS_WT=/Users/dfakkeldy/.codex/worktrees/explainer-playable-library
ECHO_CLI=/Users/dfakkeldy/.codex/worktrees/echo-listen-cli/.build/cli/Build/Products/Release/echo-cli

for slug in chicken-predators rodents-in-the-walls the-new-deal; do
  dir="$BOOKS_WT/books/$slug"
  unzip -t "$dir/$slug.epub" >/dev/null
  jq empty "$dir/$slug.alignment.json"
  jq -e 'reduce .[] as $a ({ok:true,last:-1}; if ($a.timestamp|type) != "number" or $a.timestamp < .last then .ok=false else .last=$a.timestamp end) | .ok' "$dir/$slug.alignment.json"
  ffprobe -v error -show_entries format=duration:stream=codec_name,codec_type \
    -show_entries chapter=start_time,end_time:chapter_tags=title -of json \
    "$dir/$slug.m4b" | jq -e '.format.duration|tonumber > 0'
  "$ECHO_CLI" verify-sidecar --epub "$dir/$slug.epub" --audio "$dir/$slug.m4b" --sidecar "$dir/$slug.alignment.json"
done

git -C "$BOOKS_WT" diff --check
git -C "$BOOKS_WT" status --short
```

Expected: `SIDECAR_OK` with 231/16, 245/9, and 151/9 anchors/chapters.

- [ ] **Step 10: Commit, push, and open the book PR**

```bash
set -euo pipefail

BOOKS_WT=/Users/dfakkeldy/.codex/worktrees/explainer-playable-library
git -C "$BOOKS_WT" add README.md books/chicken-predators books/rodents-in-the-walls books/the-new-deal
git -C "$BOOKS_WT" commit -m "feat: publish three playable learning audiobooks"
git -C "$BOOKS_WT" push -u origin codex/publish-playable-books
gh pr create --repo dfakkeldy/explainer-audiobooks \
  --base main --head codex/publish-playable-books \
  --title "Publish three playable learning audiobooks" \
  --body "Publishes the approved final packages for Chicken Predators, the corrected Rodents in the Walls v2, and The New Deal. Includes chaptered Echo/Kokoro M4Bs and verified alignment sidecars. Private build scratch, research, QA artifacts, The Long Route, and The Living Knowledge Base remain unpublished. Verification: EPUB integrity, ffprobe metadata, monotonic JSON, Echo SIDECAR_OK for 231/245/151 anchors."
gh pr view codex/publish-playable-books --repo dfakkeldy/explainer-audiobooks \
  --json url,state,statusCheckRollup
```

Expected: a ready PR to `main`; record its URL as `BOOKS_PR_URL`. Do not merge it from the agent session.

---

### Task 2: Generate a three-book playable site catalog with a regression test

**Files:**
- Create: `Tests/listen/catalog.test.mjs`
- Modify: `Tools/build-listen-catalog.sh:58-76`
- Regenerate: `Resources/listen/books.json`
- Create: `Resources/listen/books/{chicken-predators,rodents-in-the-walls,the-new-deal}/{blocks.json,alignment.json,cover.jpg}`

**Interfaces:**
- Consumes: pushed commit from Task 1 and Echo CLI `export-blocks`.
- Produces: exactly three `audio.status == "available"` entries with complete local read-along assets and SHA-pinned audio URLs.

- [ ] **Step 1: Write the failing catalog regression test**

Create `Tests/listen/catalog.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const listenRoot = new URL('../../Resources/listen/', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('books.json', listenRoot), 'utf8'));
const expectedPlayable = ['chicken-predators', 'rodents-in-the-walls', 'the-new-deal'];

test('catalog publishes exactly the three approved playable books with complete read-along assets', () => {
  const playable = catalog.books.filter((book) => book.audio.status === 'available');
  assert.deepEqual(playable.map((book) => book.slug), expectedPlayable);
  assert.match(catalog.source.commit, /^[0-9a-f]{40}$/);

  for (const book of playable) {
    assert.ok(book.durationSeconds > 0, `${book.slug} duration`);
    assert.ok(book.chapters.length > 0, `${book.slug} chapters`);
    assert.ok(book.cover && book.text?.blocks && book.alignment?.sidecar, `${book.slug} local assets`);
    assert.ok(book.links?.folder && book.links?.epub && book.links?.read, `${book.slug} links`);
    assert.equal(book.audio.mimeType, 'audio/mp4');
    assert.ok(book.audio.url.includes(`/${catalog.source.commit}/books/${book.slug}/${book.slug}.m4b`));

    const blocks = JSON.parse(readFileSync(new URL(book.text.blocks, listenRoot), 'utf8')).blocks;
    const anchors = JSON.parse(readFileSync(new URL(book.alignment.sidecar, listenRoot), 'utf8'));
    const blockIDs = new Set(blocks.map((block) => block.id));
    assert.ok(anchors.every((anchor) => blockIDs.has(anchor.blockId)), `${book.slug} anchor parity`);
    assert.ok(anchors.every((anchor, index) => index === 0 || anchor.timestamp >= anchors[index - 1].timestamp));
  }
});

test('private books remain absent', () => {
  const slugs = catalog.books.map((book) => book.slug);
  assert.ok(!slugs.includes('the-long-route'));
  assert.ok(!slugs.includes('the-living-knowledge-base'));
});
```

- [ ] **Step 2: Run the test to verify the red state**

```bash
node --test Tests/listen/catalog.test.mjs
```

Expected: FAIL because the actual playable slug list is `[]`.

- [ ] **Step 3: Update the catalog builder's explicit publication gates**

Use `apply_patch`:

```diff
*** Begin Patch
*** Update File: Tools/build-listen-catalog.sh
@@
 the-voice-in-the-machine|The Voice in the Machine||Opus 4.8
+chicken-predators|Chicken Predators||GLM-5.2
+rodents-in-the-walls|Rodents in the Walls|Squirrels and Other Houseguests in Western Cape Breton|GPT-5.6 Sol
+the-new-deal|The New Deal|Canada Post, CUPW, and What It Means for Rural Mail|GLM-5.2
 EOF
 )"
@@
-# Empty until a public book gets narration.
-AUDIO_EXPECTED=""
+AUDIO_EXPECTED="chicken-predators
+rodents-in-the-walls
+the-new-deal"
@@
   [ -d "$book_dir" ] || { echo "error: allow-listed book missing from repo: $slug" >&2; exit 1; }
+  [ -f "$book_dir/$slug.epub" ] || { echo "error: allow-listed EPUB missing: $slug" >&2; exit 1; }
+  [ -f "$book_dir/$slug.md" ] || { echo "error: allow-listed Markdown missing: $slug" >&2; exit 1; }
*** End Patch
```

- [ ] **Step 4: Generate the real catalog from the pushed book commit**

```bash
set -euo pipefail

BOOKS_WT=/Users/dfakkeldy/.codex/worktrees/explainer-playable-library
ECHO_CLI=/Users/dfakkeldy/.codex/worktrees/echo-listen-cli/.build/cli/Build/Products/Release/echo-cli
BOOKS_REPO="$BOOKS_WT" ECHO_CLI="$ECHO_CLI" make listen-catalog
```

Expected: 231/231, 245/245, and 151/151 anchors resolved; 11 books written.

- [ ] **Step 5: Run the catalog and existing core tests**

```bash
set -euo pipefail

BOOKS_WT=/Users/dfakkeldy/.codex/worktrees/explainer-playable-library
node --test Tests/listen/catalog.test.mjs Tests/listen/listen-core.test.mjs
test "$(jq -r .source.commit Resources/listen/books.json)" = "$(git -C "$BOOKS_WT" rev-parse HEAD)"
```

Expected: all tests pass and the catalog commit matches the pushed book commit.

- [ ] **Step 6: Commit the catalog contract and generated assets**

```bash
set -euo pipefail

git diff --check
git add Tests/listen/catalog.test.mjs Tools/build-listen-catalog.sh Resources/listen/books.json Resources/listen/books
git commit -m "feat(listen): publish three playable books"
```

---

### Task 3: Add tested Listen actions to the library selector

**Files:**
- Modify: `Resources/listen/listen-core.js`
- Modify: `Tests/listen/listen-core.test.mjs`
- Modify: `Resources/listen/listen.js:100-120`
- Modify: `Resources/listen/listen.css:289-306`
- Modify: `Resources/listen/index.html:120-123`

**Interfaces:**
- Produces: `EchoListenCore.libraryActions(book) -> [{label, href, external, className}]`.
- Consumes: catalog entries with `audio.status`, `slug`, and `links.epub/read`.

- [ ] **Step 1: Write the failing pure mapping test**

Append to `Tests/listen/listen-core.test.mjs`:

```js
test('library actions expose Listen first only for playable books', () => {
  const links = { epub: 'book.epub', read: 'book.md' };
  assert.deepEqual(core.libraryActions({ slug: 'playable', audio: { status: 'available' }, links }), [
    { label: 'Listen', href: '?book=playable', external: false, className: 'room-lib-listen' },
    { label: 'EPUB', href: 'book.epub', external: false, className: '' },
    { label: 'Read', href: 'book.md', external: true, className: '' },
  ]);
  assert.deepEqual(core.libraryActions({ slug: 'text-only', audio: { status: 'none' }, links }), [
    { label: 'EPUB', href: 'book.epub', external: false, className: '' },
    { label: 'Read', href: 'book.md', external: true, className: '' },
  ]);
});
```

- [ ] **Step 2: Run the focused test to verify failure**

```bash
node --test --test-name-pattern='library actions' Tests/listen/listen-core.test.mjs
```

Expected: FAIL with `core.libraryActions is not a function`.

- [ ] **Step 3: Implement the minimal pure action mapping**

Add before `resolveSnapshot` in `Resources/listen/listen-core.js` and export it in the returned API:

```js
function libraryActions(book) {
  const actions = [];
  if (book.audio && book.audio.status === 'available') {
    actions.push({
      label: 'Listen',
      href: '?book=' + encodeURIComponent(book.slug),
      external: false,
      className: 'room-lib-listen',
    });
  }
  actions.push({ label: 'EPUB', href: book.links.epub, external: false, className: '' });
  actions.push({ label: 'Read', href: book.links.read, external: true, className: '' });
  return actions;
}
```

The returned API must contain `libraryActions: libraryActions` immediately before `resolveSnapshot`.

- [ ] **Step 4: Render the mapped actions**

Replace the hard-coded action array in `renderLibrary()` with:

```js
core.libraryActions(b).forEach(function (action) {
  var a = document.createElement('a');
  a.href = action.href;
  a.textContent = action.label;
  if (action.className) a.className = action.className;
  if (action.external) { a.target = '_blank'; a.rel = 'noopener'; }
  links.appendChild(a);
});
```

- [ ] **Step 5: Update multi-book copy and Listen styling**

Replace the library subtitle in `Resources/listen/index.html` with:

```html
<p class="room-library-sub">Choose another narrated book, or open any title as an EPUB or readable Markdown.</p>
```

Add after the existing library link rule in `listen.css`:

```css
.room-library li a.room-lib-listen {
  color: var(--gold-text);
  font-weight: 650;
  text-decoration-thickness: 1.5px;
}
```

- [ ] **Step 6: Run tests and commit**

```bash
set -euo pipefail

node --test Tests/listen/listen-core.test.mjs Tests/listen/catalog.test.mjs
git diff --check
git add Resources/listen/listen-core.js Resources/listen/listen.js Resources/listen/listen.css Resources/listen/index.html Tests/listen/listen-core.test.mjs
git commit -m "feat(listen): switch between narrated books"
```

---

### Task 4: Add The New Deal to `/learn` and preserve privacy regressions

**Files:**
- Create: `Tests/site/learn-library.test.mjs`
- Modify: `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift:898-923`
- Regenerate: `Output/`

**Interfaces:**
- Produces: one generated sample card each for *Chicken Predators*, corrected *Rodents in the Walls*, and *The New Deal*.

- [ ] **Step 1: Write the failing generated-page regression test**

Create `Tests/site/learn-library.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../Output/learn/index.html', import.meta.url), 'utf8');
const count = (text) => html.split(text).length - 1;

test('learn page lists each approved new public book exactly once', () => {
  assert.equal(count('<h3>Chicken Predators</h3>'), 1);
  assert.equal(count('<h3>Rodents in the Walls</h3>'), 1);
  assert.equal(count('<h3>The New Deal</h3>'), 1);
  assert.match(html, /books\/the-new-deal\/the-new-deal\.epub/);
  assert.match(html, /books\/the-new-deal\/the-new-deal\.md/);
});

test('private books remain absent from learn', () => {
  assert.doesNotMatch(html, /The Long Route/);
  assert.doesNotMatch(html, /The Living Knowledge Base/);
});
```

- [ ] **Step 2: Run it to verify the red state**

```bash
node --test Tests/site/learn-library.test.mjs
```

Expected: FAIL because `<h3>The New Deal</h3>` occurs zero times.

- [ ] **Step 3: Correct final runtime/copy and add the Canada Post card**

Replace the old Rodents and Chicken card blocks, then append this card after them:

```html
<article class="learn-book-card">
  <div>
    <p class="learn-book-runtime">9 chapters · about 1.9 hours</p>
    <h3>The New Deal</h3>
    <p>A plain-language guide to the 2026 Canada Post and CUPW agreements, their restructuring context, and what the changes could mean for rural mail.</p>
  </div>
  <div class="learn-book-links">
    <a href="https://github.com/dfakkeldy/explainer-audiobooks/tree/main/books/the-new-deal" target="_blank" rel="noopener">Book folder</a>
    <a href="https://github.com/dfakkeldy/explainer-audiobooks/raw/main/books/the-new-deal/the-new-deal.epub">EPUB</a>
    <a href="https://github.com/dfakkeldy/explainer-audiobooks/blob/main/books/the-new-deal/the-new-deal.md" target="_blank" rel="noopener">Read</a>
  </div>
</article>
```

Set the existing Rodents runtime to `9 chapters · about 2.0 hours` and description to `A Western Cape Breton guide to identifying, excluding, repairing after, and safely cleaning up around squirrels and other rodents.` Set Chicken to `16 chapters · about 3.1 hours`. Keep their existing links unchanged.

- [ ] **Step 4: Regenerate and run the test**

```bash
set -euo pipefail

make generate
node --test Tests/site/learn-library.test.mjs
```

Expected: both tests pass; one card per approved title and neither private title.

- [ ] **Step 5: Build and commit source plus generated output**

```bash
set -euo pipefail

"$HOME/.claude/bin/xcode-build-gate.sh" --wait && swift build
git diff --check
git add Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift Tests/site/learn-library.test.mjs Output
git commit -m "feat(learn): add The New Deal to the library"
```

---

### Task 5: Run full static, stream, browser, and accessibility verification

**Files:**
- Verify all files changed in Tasks 2-4; modify only if a concrete defect is reproduced.

**Interfaces:**
- Consumes: generated `Output/`, pushed SHA-pinned raw audio URLs, and all three query-string selections.
- Produces: fresh evidence that the original no-playable-books symptom and every required interaction work.

- [ ] **Step 1: Run the complete deterministic suite**

```bash
set -euo pipefail

node --test Tests/listen/*.test.mjs Tests/site/*.test.mjs
"$HOME/.claude/bin/xcode-build-gate.sh" --wait && swift build
make generate
git diff --check
git status --short --branch
```

- [ ] **Step 2: Verify every pinned audio URL supports byte ranges**

```bash
set -euo pipefail

tmpdir="$(mktemp -d)"
trap 'status=$?; rm -rf "$tmpdir" || true; exit "$status"' EXIT
urls="$tmpdir/audio-urls.txt"

jq -er '.books[] | select(.audio.status == "available") | .audio.url' \
  Resources/listen/books.json > "$urls"
test "$(wc -l < "$urls" | tr -d ' ')" -eq 3

index=0
while IFS= read -r url; do
  index=$((index + 1))
  curl --fail --silent --show-error -H 'Range: bytes=0-1023' \
    -D "$tmpdir/headers-$index" -o "$tmpdir/audio-$index.bin" "$url"
  rg -i '^HTTP/(1\.1|2) 206|^content-range: bytes 0-1023/' "$tmpdir/headers-$index"
  test "$(wc -c < "$tmpdir/audio-$index.bin" | tr -d ' ')" -eq 1024
done < "$urls"
```

Expected: three ranged responses and three 1,024-byte payloads.

- [ ] **Step 3: Start the generated site locally**

```bash
python3 -m http.server 8000 --directory Output
```

Keep the server in a managed execution session.

- [ ] **Step 4: Verify all three book selections in a browser**

Use the Browser skill on:

```text
http://localhost:8000/listen/?book=chicken-predators
http://localhost:8000/listen/?book=rodents-in-the-walls
http://localhost:8000/listen/?book=the-new-deal
```

For each selection verify: visible player; correct title/cover/chapter count/duration; enabled play after metadata; advancing then pausing elapsed time; scrub and ±30 seconds; chapter seek; 1×/1.25×/1.5× speed; non-empty captions; **Listen** links to the other two narrated books; correct EPUB and **Read** targets. Expected: no empty-state message or console error.

Also open `http://localhost:8000/listen/?book=not-a-real-book` and verify it
falls back to *Chicken Predators*. Intercept one selected book's audio request
with a 404 and verify the player shows its explicit stream error while the
library's EPUB and **Read** links remain usable. Intercept `books.json` with a
fixture whose entries all have `audio.status: "none"`; verify the player shell
is hidden and the honest no-streaming state remains visible.

- [ ] **Step 5: Verify responsive and accessible behavior**

Check a 375×812 viewport, light/dark themes, OpenDyslexic on/off, keyboard focus and Space/Left/Right behavior, reduced motion, and accessible names for Play/Pause, Back 30 seconds, Forward 30 seconds, Playback speed, Seek, chapters, theme, and font toggles.

- [ ] **Step 6: Request focused code review and resolve findings**

Invoke `superpowers:requesting-code-review` with the approved spec, this plan, base SHA `f5cdc5c5855d64150cd22aa406d7adbbdfd063fb`, and current site HEAD. Fix Critical and Important findings, rerun Steps 1-5, and commit real fixes with `fix(listen): ...`.

- [ ] **Step 7: Remove only the clean build-only Echo worktree**

```bash
set -euo pipefail

git -C /Users/dfakkeldy/Developer/Echo worktree remove /Users/dfakkeldy/.codex/worktrees/echo-listen-cli
git -C /Users/dfakkeldy/Developer/Echo worktree prune
```

Keep the Explainer Audiobooks worktree alive for PR feedback.

---

### Task 6: Push the site PR and verify hosted checks

**Files:**
- No new files unless rebase or hosted verification reveals a concrete issue.

**Interfaces:**
- Consumes: book PR URL from Task 1 and fully verified site branch.
- Produces: a ready site PR whose description names the book-PR dependency and merge order.

- [ ] **Step 1: Rebase safely and rerun the fast gate**

```bash
git fetch origin
git rebase origin/main
node --test Tests/listen/*.test.mjs Tests/site/*.test.mjs
make generate
git diff --check
git status --short --branch
```

- [ ] **Step 2: Push and open the ready site PR**

```bash
git push -u origin codex/learn-playable-library
BOOKS_PR_URL="$(gh pr view codex/publish-playable-books --repo dfakkeldy/explainer-audiobooks --json url -q .url)"
gh pr create --repo dfakkeldy/KinNoKiLabsSite \
  --base main --head codex/learn-playable-library \
  --title "Make the learning audiobook library playable" \
  --body "Adds three selectable, captioned books to the Echo Listening Room and publishes The New Deal on /learn. Audio stays in Explainer Audiobooks and every URL is pinned to the exact source commit. Dependency: merge $BOOKS_PR_URL first, then this PR. Verification: catalog/anchor tests, 100% block parity (231/245/151), Node tests, Swift build, generated Output, byte-range streams, three-book browser playback, mobile, themes, OpenDyslexic, keyboard, and accessibility labels. The Long Route and The Living Knowledge Base remain absent."
```

Record the returned URL as `SITE_PR_URL`.

- [ ] **Step 3: Inspect hosted checks**

```bash
gh pr checks codex/learn-playable-library --repo dfakkeldy/KinNoKiLabsSite --watch --interval 15
gh pr view codex/learn-playable-library --repo dfakkeldy/KinNoKiLabsSite --json url,state,statusCheckRollup,comments
```

Expected: Cloudflare Pages succeeds. Inspect concrete check details before repairing any failure.

- [ ] **Step 4: Report the merge order without merging**

Merge the Explainer Audiobooks PR first, then the KinNoKi site PR. Production playback remains pending until both merge and Task 8 passes.

---

### Task 7: File the durable business-KB receipt

**Files:**
- Create: `/Users/dfakkeldy/.codex/worktrees/kb-playable-library/bundle/status/2026-07-11-kinnoki-playable-learning-library.md`
- Modify: `/Users/dfakkeldy/.codex/worktrees/kb-playable-library/bundle/{status/index.md,projects/kinnoki-labs-site.md,projects/explainer-audiobooks.md,log.md}`

**Interfaces:**
- Consumes: exact PR URLs and live check states from Tasks 1 and 6.
- Produces: a cited receipt that explicitly distinguishes ready PRs from production.

- [ ] **Step 1: Create a clean KB worktree and capture live PR state**

```bash
set -euo pipefail

git -C /Users/dfakkeldy/Developer/knowledge-base fetch origin
git -C /Users/dfakkeldy/Developer/knowledge-base worktree add \
  -b codex/kinnoki-playable-library \
  /Users/dfakkeldy/.codex/worktrees/kb-playable-library origin/main
BOOKS_PR_URL="$(gh pr view codex/publish-playable-books --repo dfakkeldy/explainer-audiobooks --json url -q .url)"
BOOKS_PR_STATE="$(gh pr view codex/publish-playable-books --repo dfakkeldy/explainer-audiobooks --json state -q .state)"
SITE_PR_URL="$(gh pr view codex/learn-playable-library --repo dfakkeldy/KinNoKiLabsSite --json url -q .url)"
SITE_PR_STATE="$(gh pr view codex/learn-playable-library --repo dfakkeldy/KinNoKiLabsSite --json state -q .state)"
SITE_WT=/Users/dfakkeldy/.codex/worktrees/kinnoki-playable-library
SITE_HEAD_SHA="$(git -C "$SITE_WT" rev-parse HEAD)"
SITE_DESIGN_URL="https://github.com/dfakkeldy/KinNoKiLabsSite/blob/$SITE_HEAD_SHA/docs/superpowers/specs/2026-07-11-learn-playable-library-design.md"
printf '%s\n%s\n%s\n%s\n%s\n' "$BOOKS_PR_URL" "$BOOKS_PR_STATE" "$SITE_PR_URL" "$SITE_PR_STATE" "$SITE_DESIGN_URL"
```

- [ ] **Step 2: Write the narrow pending-production receipt**

Use `apply_patch`, substituting the exact values printed in Step 1 for the five
uppercase runtime names in this complete status-page body:

```markdown
---
type: Status
title: 2026-07-11 KinNoKi Playable Learning Library
description: Three approved public learning audiobooks have package and site PRs with real Echo/Kokoro playback; production remains pending until both PRs merge and live verification passes.
tags:
  - kinnoki
  - explainer-audiobooks
  - echo
  - learn
  - playback
timestamp: 2026-07-11T09:00:00-03:00
---

# Summary

Re-checked: 2026-07-11.

Dan explicitly approved public publication of *The New Deal — Canada Post,
CUPW, and What It Means for Rural Mail*. The approved playable set is
`chicken-predators`, corrected-v2 `rodents-in-the-walls`, and
`the-new-deal`. *The Long Route* and *The Living Knowledge Base*
remain private and absent.

# Current Verified State

- Explainer Audiobooks package PR: [BOOKS_PR_URL](BOOKS_PR_URL) —
  `BOOKS_PR_STATE`.
- KinNoKi site PR: [SITE_PR_URL](SITE_PR_URL) — `SITE_PR_STATE`.
- The site catalog pins audio to the pushed package commit and resolves all
  231, 245, and 151 alignment anchors against Echo-exported EPUB blocks.
- Local verification covers EPUB/M4B integrity, Echo sidecar verification,
  Node tests, Swift build, generated output, byte-range streams, all three
  browser playback paths, mobile layout, themes, OpenDyslexic, keyboard
  controls, and accessible labels.
- Merge order: package PR first, site PR second.
- Production: pending both merges and live verification.

# Master Plan Impact Check

This unblocks an already-promoted Echo launch-funnel asset. It does not change
the portfolio launch order, pricing, positioning, or automation cadence;
MacroMark remains Most Important Now.

# Citations

1. [Explainer Audiobooks package PR](BOOKS_PR_URL)
2. [KinNoKi Labs site PR](SITE_PR_URL)
3. [Approved playable-library design](SITE_DESIGN_URL)
4. Dan Fakkeldy conversation with Codex, 2026-07-11, approving publication of *The New Deal*.
```

Add this exact line under `## Active / recent` in `bundle/status/index.md`:

```markdown
- [2026-07-11 KinNoKi Playable Learning Library](2026-07-11-kinnoki-playable-learning-library.md) - Three approved narrated books have package and site PRs; production verification follows the two-PR merge order.
```

Add this exact paragraph to the current-status section of
`bundle/projects/kinnoki-labs-site.md`:

```markdown
The zero-playable Listening Room blocker now has a two-PR fix in review: three
approved Echo/Kokoro books are catalogued with SHA-pinned audio and selectable
Listen actions. Production remains pending the package-first/site-second merge
order and live verification; see [2026-07-11 KinNoKi Playable Learning
Library](/status/2026-07-11-kinnoki-playable-learning-library.md).
```

Add this exact paragraph to the current-library section of
`bundle/projects/explainer-audiobooks.md`:

```markdown
Dan approved public publication of *The New Deal* on 2026-07-11. A package PR
adds final public M4B and alignment files for *Chicken Predators*, corrected-v2
*Rodents in the Walls*, and *The New Deal*. *The Long Route* and *The Living
Knowledge Base* remain private; see [2026-07-11 KinNoKi Playable Learning
Library](/status/2026-07-11-kinnoki-playable-learning-library.md).
```

Under the newest `## 2026-07-11` heading in `bundle/log.md`, add one bullet that
condenses the status-page Summary, Current Verified State, and exact Master Plan
Impact Check above; include both captured PR URLs and label production pending.

- [ ] **Step 3: Lint, commit, push, and open the KB PR**

```bash
KB_WT=/Users/dfakkeldy/.codex/worktrees/kb-playable-library
python3 "$KB_WT/tools/kb_lint.py"
git -C "$KB_WT" diff --check
git -C "$KB_WT" add bundle/status/2026-07-11-kinnoki-playable-learning-library.md bundle/status/index.md bundle/projects/kinnoki-labs-site.md bundle/projects/explainer-audiobooks.md bundle/log.md
git -C "$KB_WT" commit -m "docs: track playable KinNoKi learning library"
git -C "$KB_WT" push -u origin codex/kinnoki-playable-library
gh pr create --repo dfakkeldy/knowledge-base \
  --base main --head codex/kinnoki-playable-library \
  --title "Track the playable KinNoKi learning library" \
  --body "Records Dan's publication approval, the three-book playable set, exact package/site PRs, verification evidence, merge order, privacy boundary, and pending production check. Master Plan impact: existing Echo funnel asset unblocked; no portfolio ordering or pricing change."
```

---

### Task 8: Verify production after both public PRs merge

**Files:**
- Modify the KB status page from Task 7 only after live verification passes.

**Interfaces:**
- Consumes: merged book and site PRs plus the Cloudflare production deployment.
- Produces: live evidence that the user's website request is genuinely complete.

- [ ] **Step 1: Require merged dependency state**

```bash
gh pr view codex/publish-playable-books --repo dfakkeldy/explainer-audiobooks --json state,mergedAt,mergeCommit,url
gh pr view codex/learn-playable-library --repo dfakkeldy/KinNoKiLabsSite --json state,mergedAt,mergeCommit,url
```

Expected: both states are `MERGED`. If either is open, report production as pending and stop without marking the KB receipt landed.

- [ ] **Step 2: Verify the live catalog**

```bash
curl --fail --silent --show-error --location https://kinnokilabs.com/listen/books.json -o /tmp/kinnoki-live-books.json
jq -e '[.books[] | select(.audio.status == "available") | .slug] == ["chicken-predators", "rodents-in-the-walls", "the-new-deal"]' /tmp/kinnoki-live-books.json
jq -e '.source.commit | test("^[0-9a-f]{40}$")' /tmp/kinnoki-live-books.json
```

- [ ] **Step 3: Verify real production playback for each title**

Use the Browser skill on:

```text
https://kinnokilabs.com/listen/?book=chicken-predators
https://kinnokilabs.com/listen/?book=rodents-in-the-walls
https://kinnokilabs.com/listen/?book=the-new-deal
```

For each: confirm the title, play until elapsed time advances, pause, seek, select a chapter, observe a non-empty caption, and follow one **Listen** action to another title. Verify `/learn/` contains the three approved cards and neither private title.

- [ ] **Step 4: Mark the KB receipt landed with exact evidence**

Add exact merge SHAs/times, Cloudflare result, production verification time, and `LANDED`. Run KB lint, commit `docs: mark playable learning library live`, and push the existing KB branch; if its PR already merged, open a small follow-up PR.

## Plan self-review

- **Spec coverage:** Task 1 covers the public package boundary; Task 2 covers the pinned catalog and red-green regression; Task 3 covers selection; Task 4 covers `/learn`; Task 5 covers static, stream, browser, responsive, and accessibility gates; Task 6 covers public PRs; Task 7 records durable context; Task 8 gates true production completion.
- **Placeholder scan:** No `TBD`, `TODO`, or unnamed code path remains. PR URLs, states, merge SHAs, and times are captured from live commands before KB writes.
- **Type consistency:** `libraryActions(book)` returns the exact fields consumed by `renderLibrary`; playable slug order matches the builder, tests, catalog, and production assertion; site asset paths remain relative to `Resources/listen/`.

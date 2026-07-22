#!/usr/bin/env bash
# Echo Listening Room — catalog builder (make listen-catalog).
#
# Regenerates Resources/listen/books.json plus per-book assets
# (blocks.json, alignment.json, cover.jpg, figures/) from LOCAL checkouts,
# so the committed catalog is always internally consistent: audio URL,
# sidecar, block text, and staged artwork are all pinned to the same
# explainer-audiobooks commit.
#
# Every allow-listed book stages books/<slug>/cover.jpg (sips jpeg,
# quality 80, max 768px) and publishes cover + coverAlt. Playable books
# additionally rewrite image-block imagePaths in blocks.json to
# CATALOG-RELATIVE paths — the cover block (chapterIndex == null) points
# at books/<slug>/cover.jpg; interior figures (chapterIndex != null)
# point at books/<slug>/figures/<basename>, with bytes extracted from the
# book's EPUB by basename (fail on missing/ambiguous basenames; fail over
# 20 MB per file — Cloudflare Pages caps assets at 25 MiB; warn over
# 2 MB) — and publish visuals: { figures: N } (N = interior image blocks)
# for the slideshow.
#
# Inputs (env-overridable):
#   BOOKS_REPO  path to a clean dfakkeldy/explainer-audiobooks checkout
#               (default: ~/Developer/explainer-audiobooks)
#   ECHO_CLI    command that runs echo-cli (needed for blocks.json;
#               see the export-blocks PR in the Echo repo for the
#               canonical build/run invocation)
#
# Flags:
#   --no-blocks   skip echo-cli export-blocks (dev mode: captions will
#                 NOT render — the sidecar has ids+timestamps, no text)
#
# Publication uses two independent, hand-maintained gates. ALLOW_LIST controls
# which public text packages appear at all. AUDIO_EXPECTED is the exact subset
# approved for playable audio. Approved audio must be complete, while playable
# media found for any other public book fails rather than publishing by accident.

set -euo pipefail

BOOKS_REPO="${BOOKS_REPO:-$HOME/Developer/explainer-audiobooks}"
ECHO_CLI="${ECHO_CLI:-}"
NO_BLOCKS=0
for arg in "$@"; do
  case "$arg" in
    --no-blocks) NO_BLOCKS=1 ;;
    *) echo "error: unknown argument: $arg" >&2; exit 2 ;;
  esac
done

for tool in jq ffprobe sips git unzip python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "error: missing tool: $tool" >&2; exit 1; }
done
[ -d "$BOOKS_REPO/books" ] || { echo "error: BOOKS_REPO not found: $BOOKS_REPO" >&2; exit 1; }

SITE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$SITE_ROOT/Resources/listen"
SERIES_SOURCE="$SITE_ROOT/Tools/listen-series.json"
# shellcheck source=Tools/lib/listen-catalog-transaction.sh
source "$SITE_ROOT/Tools/lib/listen-catalog-transaction.sh"
listen_catalog_install_cleanup_traps
SHA="$(git -C "$BOOKS_REPO" rev-parse HEAD)"

# The audio URL is pinned to $SHA, so that commit must be public and the
# tree must match it — otherwise the catalog references content nobody
# can fetch. Warn (don't fail) so intentional pre-push builds stay possible.
if [ -n "$(git -C "$BOOKS_REPO" status --porcelain)" ]; then
  echo "warning: BOOKS_REPO has uncommitted changes — pinned URLs may not match disk" >&2
fi
if ! git -C "$BOOKS_REPO" merge-base --is-ancestor "$SHA" origin/main 2>/dev/null; then
  echo "warning: BOOKS_REPO HEAD ($SHA) is not on origin/main — pinned raw URLs may 404" >&2
fi
RAW_BASE="https://raw.githubusercontent.com/dfakkeldy/explainer-audiobooks/$SHA"
GH_BASE="https://github.com/dfakkeldy/explainer-audiobooks"

# Public text/package allow-list: slug|title|subtitle|writtenBy
# (The Long Route and The Living Knowledge Base were reclassified private
# on 2026-07-09 — explainer-audiobooks PR #11 — and must NOT return here
# without an explicit decision.)
ALLOW_LIST="$(cat <<'EOF'
an-unsettling-conversation|An Unsettling Conversation|J-Space, Working Memory, and the Question of Machine Experience|Codex (GPT-5)
jspace-inside-the-machine|J-Space: Inside the Machine|Parameters, Working Memory, and the Question of Consciousness|Codex (GPT-5)
echo-from-the-inside|Echo, From the Inside||Opus 4.8
why-it-feels-right|Why It Feels Right||Fable 5
you-are-the-architect|You Are the Architect||Fable 5
the-bug-is-a-clue|The Bug Is a Clue||Opus 4.8
tests-first|Tests First||Opus 4.8
git-happens|Git Happens||Opus 4.8
findable|Findable||Opus 4.8
the-voice-in-the-machine|The Voice in the Machine||Opus 4.8
chicken-predators|Chicken Predators||GLM-5.2
rodents-in-the-walls|Rodents in the Walls|Squirrels and Other Houseguests in Western Cape Breton|GPT-5.6 Sol
the-new-deal|The New Deal|Canada Post, CUPW, and What It Means for Rural Mail|GLM-5.2
is-there-anyone-in-here|Is There Anyone in Here?|One Language Model Examines the Case for Its Own Consciousness|Claude Fable 5
claude-platform-01-the-message|The Message|Conversations, Content Blocks, and the Messages API|Codex (GPT-5)
claude-platform-02-thinking-and-reliable-responses|Making Claude Think and Respond Reliably|Reasoning, Multimodal Inputs, Structured Output, and Streaming|Codex (GPT-5)
claude-platform-03-giving-claude-tools|Giving Claude Tools|Contracts, Agent Loops, and Controlled Action|Codex (GPT-5)
beyond-the-tax-sale-packet|Beyond the Tax-Sale Packet|How Nova Scotia Municipal Auctions Really Work|Dan Fakkeldy
EOF
)"

# Exact playable-audio publication allow-list. Each listed slug must have both
# an M4B and alignment sidecar; either file on any other public slug is rejected.
AUDIO_EXPECTED="an-unsettling-conversation
jspace-inside-the-machine
echo-from-the-inside
why-it-feels-right
you-are-the-architect
the-bug-is-a-clue
tests-first
git-happens
findable
the-voice-in-the-machine
chicken-predators
rodents-in-the-walls
the-new-deal
is-there-anyone-in-here
claude-platform-01-the-message
claude-platform-02-thinking-and-reliable-responses
claude-platform-03-giving-claude-tools
beyond-the-tax-sale-packet"

# These editions were authorized under the public-first-listen contract. Their
# publication receipts are mandatory and must pass the verifier shipped in the
# exact BOOKS_REPO checkout before any of their assets enter the staging tree.
PUBLICATION_REQUIRED="claude-platform-01-the-message
claude-platform-02-thinking-and-reliable-responses
claude-platform-03-giving-claude-tools
beyond-the-tax-sale-packet"

EXPECTED_BOOK_COUNT=18
listen_catalog_transaction_init "$OUT_DIR"

# BEGIN VALIDATE_SERIES
json_contains_absolute_path() {
  jq -e '.. | strings | select(startswith("/") or (ascii_downcase | startswith("file://")) or test("^[A-Za-z]:[\\\\/]"))' "$1" >/dev/null
}

validate_series() {
  local series_file="$1"
  local catalog_file="$2"

  jq -e . "$series_file" >/dev/null || {
    echo "error: series source is not valid JSON" >&2
    return 1
  }
  if json_contains_absolute_path "$series_file"; then
    echo "error: series source contains an absolute filesystem path" >&2
    return 1
  fi
  if json_contains_absolute_path "$catalog_file"; then
    echo "error: staged catalog contains an absolute filesystem path" >&2
    return 1
  fi

  jq -e --slurpfile catalog "$catalog_file" '
    def nonblank:
      type == "string" and (gsub("\\s"; "") | length) > 0;
    def kebab:
      type == "string" and test("^[a-z0-9]+(?:-[a-z0-9]+)*$");

    (.series | type == "array" and length > 0) and
    ($catalog | length == 1) and
    ($catalog[0].version == 2) and
    ($catalog[0].series == .series) and
    ([.series[].id] as $ids | ($ids | length) == ($ids | unique | length)) and
    (all(.series[];
      .plannedVolumeCount as $planned |
      (.id | kebab) and
      (.title | nonblank) and
      (.description | nonblank) and
      (.featured | type == "boolean") and
      (.plannedVolumeCount | type == "number" and . > 0 and . == floor) and
      (.volumes | type == "array" and length > 0) and
      (all(.volumes[];
        (.number | type == "number" and . > 0 and . == floor) and
        (.number <= $planned) and
        (.book | kebab)
      )) and
      ([.volumes[].number] as $numbers |
        $numbers == ($numbers | sort) and
        ($numbers | length) == ($numbers | unique | length))
    )) and
    ([.series[] | select(.featured == true)] | length == 1) and
    ([.series[].volumes[].book] as $memberships |
      ($memberships | length) == ($memberships | unique | length)) and
    (all(.series[].volumes[].book;
      . as $book |
      ([$catalog[0].books[] | select(.slug == $book)] | length) == 1
    )) and
    ([.series[] | select(.featured == true)][0].volumes[0].book as $first |
      any($catalog[0].books[];
        .slug == $first and .audio.status == "available"
      ))
  ' "$series_file" >/dev/null || {
    echo "error: series source or staged catalog violates the version 2 series contract" >&2
    return 1
  }
}
# END VALIDATE_SERIES

# Real pixel dimensions of a staged cover. The player sizes library thumbnails
# from the published coverWidth/coverHeight rather than assuming one aspect
# ratio, so these must describe the bytes actually on disk — covers are not all
# the same shape (Tools/sync-paired-cover-assets.sh re-derives the paired-art
# slugs as squares AFTER this builder runs and patches the catalog to match).
cover_dimensions() {
  local file="$1" width height
  width="$(sips -g pixelWidth "$file" | awk '/pixelWidth/ {print $2}')"
  height="$(sips -g pixelHeight "$file" | awk '/pixelHeight/ {print $2}')"
  # Check each value on its own: concatenating them would let an empty width
  # hide behind a valid height.
  case "$width" in ''|*[!0-9]*) width="" ;; esac
  case "$height" in ''|*[!0-9]*) height="" ;; esac
  [ -n "$width" ] && [ -n "$height" ] || {
    echo "error: could not read cover dimensions: $file" >&2
    return 1
  }
  printf '%s %s' "$width" "$height"
}

validate_staged_bundle() {
  local book_count source_sha current_source_sha expected_catalog_slugs actual_catalog_slugs
  local playable_slugs expected_asset_dirs actual_asset_dirs
  local slug asset_dir asset_entries anchors_total anchors_resolved
  local cover_path blocks_path sidecar_path declared_dims actual_dims
  local expected_asset_entries figures_declared interior_blocks image_path
  local referenced_figures staged_figures

  jq -e . "$STAGED_CATALOG" >/dev/null || { echo "error: staged catalog is not valid JSON" >&2; return 1; }
  book_count="$(jq '.books | length' "$STAGED_CATALOG")"
  [ "$book_count" = "$EXPECTED_BOOK_COUNT" ] || {
    echo "error: staged catalog has $book_count books; expected $EXPECTED_BOOK_COUNT" >&2
    return 1
  }

  expected_catalog_slugs="$(while IFS='|' read -r expected_slug _; do
    [ -n "$expected_slug" ] && printf '%s\n' "$expected_slug"
  done <<<"$ALLOW_LIST")"
  actual_catalog_slugs="$(jq -r '.books[].slug' "$STAGED_CATALOG")"
  [ "$actual_catalog_slugs" = "$expected_catalog_slugs" ] || {
    echo "error: staged catalog slugs/order do not match ALLOW_LIST" >&2
    return 1
  }

  source_sha="$(jq -r '.source.commit' "$STAGED_CATALOG")"
  current_source_sha="$(git -C "$BOOKS_REPO" rev-parse HEAD)"
  [ "$source_sha" = "$SHA" ] && [ "$source_sha" = "$current_source_sha" ] || {
    echo "error: staged catalog source $source_sha does not match current books HEAD $current_source_sha" >&2
    return 1
  }

  playable_slugs="$(jq -r '.books[] | select(.audio.status == "available") | .slug' "$STAGED_CATALOG")"
  [ "$playable_slugs" = "$AUDIO_EXPECTED" ] || {
    echo "error: staged playable order does not match AUDIO_EXPECTED" >&2
    return 1
  }

  expected_asset_dirs="$(printf '%s\n' "$expected_catalog_slugs" | LC_ALL=C sort)"
  actual_asset_dirs="$(find "$STAGED_BOOKS" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | LC_ALL=C sort)"
  [ "$actual_asset_dirs" = "$expected_asset_dirs" ] || {
    echo "error: staged asset directories do not match the public allow-list" >&2
    return 1
  }
  if find "$STAGED_BOOKS" -mindepth 1 -maxdepth 1 ! -type d -print -quit | grep -q .; then
    echo "error: staged books root contains a non-directory entry" >&2
    return 1
  fi

  if json_contains_absolute_path "$STAGED_CATALOG"; then
    echo "error: staged catalog contains an absolute filesystem path" >&2
    return 1
  fi

  while IFS= read -r slug; do
    [ -n "$slug" ] || continue
    asset_dir="$STAGED_BOOKS/$slug"

    cover_path="$(jq -r --arg slug "$slug" '.books[] | select(.slug == $slug) | .cover' "$STAGED_CATALOG")"
    [ "$cover_path" = "books/$slug/cover.jpg" ] || { echo "error: invalid staged cover path for $slug" >&2; return 1; }
    jq -e --arg slug "$slug" \
      '[.books[] | select(.slug == $slug)] | length == 1 and (.[0].coverAlt | type == "string" and length > 0)' \
      "$STAGED_CATALOG" >/dev/null || {
      echo "error: missing coverAlt for $slug" >&2
      return 1
    }

    # coverWidth/coverHeight drive the player's thumbnail aspect ratio, so they
    # must describe the staged bytes exactly — a stale pair silently crops art.
    jq -e --arg slug "$slug" \
      '[.books[] | select(.slug == $slug)] | length == 1 and
       (.[0].coverWidth | type == "number" and . > 0 and . == floor) and
       (.[0].coverHeight | type == "number" and . > 0 and . == floor)' \
      "$STAGED_CATALOG" >/dev/null || {
      echo "error: coverWidth/coverHeight must be positive integers for $slug" >&2
      return 1
    }
    declared_dims="$(jq -r --arg slug "$slug" \
      '.books[] | select(.slug == $slug) | "\(.coverWidth) \(.coverHeight)"' "$STAGED_CATALOG")"
    actual_dims="$(cover_dimensions "$asset_dir/cover.jpg")"
    [ "$declared_dims" = "$actual_dims" ] || {
      echo "error: staged coverWidth/coverHeight ($declared_dims) do not match cover.jpg ($actual_dims) for $slug" >&2
      return 1
    }

    if grep -Fxq "$slug" <<<"$AUDIO_EXPECTED"; then
      sidecar_path="$(jq -r --arg slug "$slug" '.books[] | select(.slug == $slug) | .alignment.sidecar' "$STAGED_CATALOG")"
      [ "$sidecar_path" = "books/$slug/alignment.json" ] || { echo "error: invalid staged sidecar path for $slug" >&2; return 1; }

      jq -e '
        type == "array" and length > 0 and
        ([.[].timestamp] as $timestamps |
          all($timestamps[]; type == "number") and
          all(range(1; $timestamps | length); $timestamps[.] >= $timestamps[. - 1]))
      ' "$asset_dir/alignment.json" >/dev/null || {
        echo "error: staged alignment is invalid, empty, or non-monotonic for $slug" >&2
        return 1
      }

      if json_contains_absolute_path "$asset_dir/alignment.json"; then
        echo "error: staged asset contains an absolute filesystem path: $asset_dir/alignment.json" >&2
        return 1
      fi

      if [ "$NO_BLOCKS" -eq 1 ]; then
        expected_asset_entries="alignment.json
cover.jpg"
        jq -e --arg slug "$slug" \
          '[.books[] | select(.slug == $slug and .text == null)] | length == 1' \
          "$STAGED_CATALOG" >/dev/null || {
          echo "error: staged no-blocks catalog text must be null for $slug" >&2
          return 1
        }
        jq -e --arg slug "$slug" \
          '[.books[] | select(.slug == $slug and .visuals == null)] | length == 1' \
          "$STAGED_CATALOG" >/dev/null || {
          echo "error: staged no-blocks catalog visuals must be null for $slug" >&2
          return 1
        }
      else
        blocks_path="$(jq -r --arg slug "$slug" '.books[] | select(.slug == $slug) | .text.blocks' "$STAGED_CATALOG")"
        [ "$blocks_path" = "books/$slug/blocks.json" ] || { echo "error: invalid staged blocks path for $slug" >&2; return 1; }
        jq -e '.blocks | type == "array" and length > 0' "$asset_dir/blocks.json" >/dev/null || {
          echo "error: staged blocks are invalid or empty for $slug" >&2
          return 1
        }

        anchors_total="$(jq 'length' "$asset_dir/alignment.json")"
        anchors_resolved="$(jq --slurpfile blocks "$asset_dir/blocks.json" \
          '[.[] | select(.blockId as $id | $blocks[0].blocks | any(.id == $id))] | length' \
          "$asset_dir/alignment.json")"
        [ "$anchors_resolved" = "$anchors_total" ] || {
          echo "error: staged $slug has unresolved sidecar anchors" >&2
          return 1
        }

        if json_contains_absolute_path "$asset_dir/blocks.json"; then
          echo "error: staged asset contains an absolute filesystem path: $asset_dir/blocks.json" >&2
          return 1
        fi

        # Slideshow contract: visuals.figures mirrors the interior image
        # blocks, the cover block points at the staged cover, and every
        # image path resolves inside the staged bundle.
        figures_declared="$(jq -r --arg slug "$slug" '.books[] | select(.slug == $slug) | .visuals.figures' "$STAGED_CATALOG")"
        case "$figures_declared" in
          ''|*[!0-9]*)
            echo "error: staged visuals.figures is not a non-negative integer for $slug" >&2
            return 1
            ;;
        esac
        interior_blocks="$(jq '[.blocks[] | select(.kind == "image" and .chapterIndex != null)] | length' "$asset_dir/blocks.json")"
        [ "$interior_blocks" = "$figures_declared" ] || {
          echo "error: staged visuals.figures does not match interior image blocks for $slug" >&2
          return 1
        }
        jq -e --arg cover "books/$slug/cover.jpg" \
          '[.blocks[] | select(.kind == "image" and .chapterIndex == null) | .imagePath] | all(. == $cover)' \
          "$asset_dir/blocks.json" >/dev/null || {
          echo "error: staged cover image block does not point at the staged cover for $slug" >&2
          return 1
        }
        while IFS= read -r image_path; do
          [ -n "$image_path" ] || continue
          case "$image_path" in
            "books/$slug/"*) ;;
            *) echo "error: staged image path is not catalog-relative for $slug: $image_path" >&2; return 1 ;;
          esac
          case "/$image_path/" in
            */../*) echo "error: staged image path traverses directories for $slug: $image_path" >&2; return 1 ;;
          esac
          [ -f "$STAGE_ROOT/$image_path" ] || {
            echo "error: staged image path does not resolve to a staged file for $slug: $image_path" >&2
            return 1
          }
        done <<<"$(jq -r '.blocks[] | select(.kind == "image") | .imagePath' "$asset_dir/blocks.json")"

        if [ "$figures_declared" -gt 0 ]; then
          expected_asset_entries="alignment.json
blocks.json
cover.jpg
figures"
          if find "$asset_dir/figures" -mindepth 1 ! -type f -print -quit | grep -q .; then
            echo "error: staged figures directory contains a non-file entry for $slug" >&2
            return 1
          fi
          referenced_figures="$(jq -r '.blocks[] | select(.kind == "image" and .chapterIndex != null) | .imagePath | split("/") | last' "$asset_dir/blocks.json" | LC_ALL=C sort -u)"
          staged_figures="$(find "$asset_dir/figures" -mindepth 1 -maxdepth 1 -type f -exec basename {} \; | LC_ALL=C sort)"
          [ "$staged_figures" = "$referenced_figures" ] || {
            echo "error: staged figures do not match referenced interior figures for $slug" >&2
            return 1
          }
        else
          expected_asset_entries="alignment.json
blocks.json
cover.jpg"
        fi
      fi
    else
      expected_asset_entries="cover.jpg"
    fi

    asset_entries="$(find "$asset_dir" -mindepth 1 -maxdepth 1 -exec basename {} \; | LC_ALL=C sort)"
    [ "$asset_entries" = "$expected_asset_entries" ] || {
      echo "error: staged assets for $slug are incomplete or contain extras" >&2
      return 1
    }
  done <<<"$expected_catalog_slugs"
}

BOOK_JSONS=()
while IFS='|' read -r slug title subtitle written_by; do
  [ -n "$slug" ] || continue
  book_dir="$BOOKS_REPO/books/$slug"
  [ -d "$book_dir" ] || { echo "error: allow-listed book missing from repo: $slug" >&2; exit 1; }
  [ -f "$book_dir/$slug.epub" ] || { echo "error: allow-listed EPUB missing: $slug" >&2; exit 1; }
  [ -f "$book_dir/$slug.md" ] || { echo "error: allow-listed Markdown missing: $slug" >&2; exit 1; }

  m4b="$book_dir/$slug.m4b"
  sidecar="$book_dir/$slug.alignment.json"
  publication="$book_dir/publication.json"
  edition_json='null'
  if grep -Fxq "$slug" <<<"$PUBLICATION_REQUIRED"; then
    [ -f "$publication" ] || { echo "error: required publication.json missing: $slug" >&2; exit 1; }
  fi
  if [ -f "$publication" ]; then
    publication_verifier="$BOOKS_REPO/skill/scripts/verify_public_first_listen.py"
    [ -f "$publication_verifier" ] || { echo "error: public first-listen verifier missing from BOOKS_REPO" >&2; exit 1; }
    python3 "$publication_verifier" "$book_dir"
    edition_json="$(jq '{
      status: .publicationStatus,
      humanListeningStatus: .humanListeningStatus,
      disclosure: .disclosure
    }' "$publication")"
  fi
  links="$(jq -n \
    --arg folder "$GH_BASE/tree/main/books/$slug" \
    --arg epub "$GH_BASE/raw/main/books/$slug/$slug.epub" \
    --arg read "$GH_BASE/blob/main/books/$slug/$slug.md" \
    '{folder: $folder, epub: $epub, read: $read}')"

  if grep -Fxq "$slug" <<<"$AUDIO_EXPECTED"; then
    [ -f "$m4b" ] || { echo "error: approved playable book missing M4B: $slug" >&2; exit 1; }
    [ -f "$sidecar" ] || { echo "error: approved playable book missing alignment sidecar: $slug" >&2; exit 1; }
    echo "· $slug — audio available, building assets"
    asset_dir="$STAGED_BOOKS/$slug"
    mkdir -p "$asset_dir"

    probe="$WORK_ROOT/$slug.probe.json"
    ffprobe -v quiet -print_format json -show_chapters -show_format "$m4b" > "$probe"
    duration="$(jq -r '.format.duration | tonumber' "$probe")"
    chapters="$(jq '[.chapters[] | {
      title: (.tags.title // ("Chapter " + ((.id + 1) | tostring))),
      start: (.start_time | tonumber),
      end: (.end_time | tonumber)
    }]' "$probe")"
    [ "$(jq 'length' <<<"$chapters")" -gt 0 ] || { echo "error: $slug m4b has no chapters" >&2; exit 1; }

    cp "$sidecar" "$asset_dir/alignment.json"
    has_words="$(jq 'any(.[]; has("words"))' "$asset_dir/alignment.json")"

    [ -f "$book_dir/cover.png" ] || { echo "error: $slug missing cover.png" >&2; exit 1; }
    sips -s format jpeg -s formatOptions 80 -Z 768 "$book_dir/cover.png" \
      --out "$asset_dir/cover.jpg" >/dev/null
    cover_dims="$(cover_dimensions "$asset_dir/cover.jpg")"
    read -r cover_width cover_height <<<"$cover_dims"

    if [ "$NO_BLOCKS" -eq 1 ]; then
      echo "  (skipping blocks.json — --no-blocks; captions will not render)"
      text_json='null'
      visuals_json='null'
    else
      [ -n "$ECHO_CLI" ] || { echo "error: ECHO_CLI is not set (or pass --no-blocks). See Tools/build-listen-catalog.sh header." >&2; exit 1; }
      $ECHO_CLI export-blocks --epub "$book_dir/$slug.epub" --out "$asset_dir/blocks.json"
      # echo-cli emits imagePath as an absolute path into its transient
      # per-run asset cache (leaks $HOME + a fresh UUID every rebuild);
      # only the asset name is meaningful downstream, so keep just that.
      jq '(.blocks[] | select(.kind == "image") | .imagePath) |= (split("/") | last)' \
        "$asset_dir/blocks.json" > "$WORK_ROOT/$slug.blocks.json"
      mv "$WORK_ROOT/$slug.blocks.json" "$asset_dir/blocks.json"
      anchors_total="$(jq 'length' "$asset_dir/alignment.json")"
      anchors_resolved="$(jq --slurpfile blocks "$asset_dir/blocks.json" \
        '[.[] | select(.blockId as $id | $blocks[0].blocks | any(.id == $id))] | length' \
        "$asset_dir/alignment.json")"
      echo "  anchors resolved against exported blocks: $anchors_resolved/$anchors_total"
      [ "$anchors_resolved" = "$anchors_total" ] || { echo "error: $slug has unresolved sidecar anchors — blockId drift" >&2; exit 1; }

      # Slideshow contract: stage interior-figure bytes from the EPUB, then
      # rewrite image-block paths to catalog-relative paths. The cover block
      # (chapterIndex == null) reuses the already-staged cover.jpg.
      figures_count="$(jq '[.blocks[] | select(.kind == "image" and .chapterIndex != null)] | length' "$asset_dir/blocks.json")"
      if [ "$figures_count" -gt 0 ]; then
        echo "  staging $figures_count interior figure block(s) from the EPUB"
        # zipinfo (-Z1) renders entry names for DISPLAY: under a non-UTF-8
        # locale it substitutes literal '?' bytes for every character it deems
        # unprintable, so a non-ASCII figure name could never match the raw
        # UTF-8 basename jq emits. This builder's own runtime locale IS
        # non-UTF-8 (make/cron/CI leave LANG unset — LC_CTYPE resolves to "C"),
        # so pin UTF-8 on the LISTING only. (-UU is not accepted in -Z mode;
        # it prints usage.) unzip -p extraction is byte-exact regardless.
        epub_entries="$(LC_ALL=en_US.UTF-8 unzip -Z1 "$book_dir/$slug.epub")"
        mkdir -p "$asset_dir/figures"
        while IFS= read -r figure_name; do
          [ -n "$figure_name" ] || continue
          case "$figure_name" in
            .|..|*/*) echo "error: $slug figure basename is unsafe: $figure_name" >&2; exit 1 ;;
          esac
          # awk -v processes escape sequences in the assigned value, so a
          # basename containing a literal backslash would be transformed
          # before comparison ('fig\tone.png' -> a real tab). ENVIRON is
          # passed through verbatim.
          epub_entry="$(FIGURE_NAME="$figure_name" awk -F/ '$NF == ENVIRON["FIGURE_NAME"]' <<<"$epub_entries")"
          [ -n "$epub_entry" ] || { echo "error: $slug figure not found in EPUB: $figure_name" >&2; exit 1; }
          [ "$(wc -l <<<"$epub_entry")" -eq 1 ] || { echo "error: $slug figure basename is ambiguous in EPUB: $figure_name" >&2; exit 1; }
          unzip -p "$book_dir/$slug.epub" "$(printf '%s' "$epub_entry" | sed 's/[][*?\\]/\\&/g')" \
            > "$asset_dir/figures/$figure_name"
          figure_bytes="$(stat -f %z "$asset_dir/figures/$figure_name")"
          [ "$figure_bytes" -le 20971520 ] || {
            echo "error: $slug figure exceeds the 20 MB Cloudflare Pages guardrail: $figure_name ($figure_bytes bytes)" >&2
            exit 1
          }
          if [ "$figure_bytes" -gt 2097152 ]; then
            echo "warning: $slug figure is larger than 2 MB: $figure_name ($figure_bytes bytes)" >&2
          fi
        done <<<"$(jq -r '.blocks[] | select(.kind == "image" and .chapterIndex != null) | .imagePath' "$asset_dir/blocks.json" | LC_ALL=C sort -u)"
      fi
      jq --arg cover "books/$slug/cover.jpg" --arg figuresPrefix "books/$slug/figures/" '
        (.blocks[] | select(.kind == "image" and .chapterIndex == null) | .imagePath) |= $cover
        | (.blocks[] | select(.kind == "image" and .chapterIndex != null) | .imagePath) |= ($figuresPrefix + .)
      ' "$asset_dir/blocks.json" > "$WORK_ROOT/$slug.blocks.json"
      mv "$WORK_ROOT/$slug.blocks.json" "$asset_dir/blocks.json"

      text_json="$(jq -n --arg p "books/$slug/blocks.json" '{blocks: $p}')"
      visuals_json="$(jq -n --argjson figures "$figures_count" '{figures: $figures}')"
    fi

    jq -n \
      --arg slug "$slug" --arg title "$title" --arg subtitle "$subtitle" \
      --arg writtenBy "$written_by" --arg curator "Dan Fakkeldy" \
      --arg cover "books/$slug/cover.jpg" --arg coverAlt "Cover of $title" \
      --argjson coverWidth "$cover_width" --argjson coverHeight "$cover_height" \
      --argjson duration "$duration" \
      --arg audioUrl "$RAW_BASE/books/$slug/$slug.m4b" \
      --argjson chapters "$chapters" \
      --argjson text "$text_json" \
      --arg sidecarPath "books/$slug/alignment.json" \
      --argjson hasWords "$has_words" \
      --argjson visuals "$visuals_json" \
      --argjson edition "$edition_json" \
      --argjson links "$links" \
      '{
        slug: $slug, title: $title,
        subtitle: (if $subtitle == "" then null else $subtitle end),
        curator: $curator, writtenBy: $writtenBy,
        cover: $cover, coverAlt: $coverAlt,
        coverWidth: $coverWidth, coverHeight: $coverHeight,
        durationSeconds: $duration,
        audio: { status: "available", url: $audioUrl, mimeType: "audio/mp4" },
        chapters: $chapters,
        text: $text,
        visuals: $visuals,
        alignment: { sidecar: $sidecarPath, hasWordTimings: $hasWords },
        edition: $edition,
        links: $links
      }' > "$WORK_ROOT/$slug.book.json"
  else
    if [ -f "$m4b" ] || [ -f "$sidecar" ]; then
      echo "error: unexpected playable media for non-audio-approved book: $slug" >&2
      exit 1
    fi
    echo "· $slug — no approved audio, links-only entry (staging cover)"
    [ -f "$book_dir/cover.png" ] || { echo "error: $slug missing cover.png" >&2; exit 1; }
    asset_dir="$STAGED_BOOKS/$slug"
    mkdir -p "$asset_dir"
    sips -s format jpeg -s formatOptions 80 -Z 768 "$book_dir/cover.png" \
      --out "$asset_dir/cover.jpg" >/dev/null
    cover_dims="$(cover_dimensions "$asset_dir/cover.jpg")"
    read -r cover_width cover_height <<<"$cover_dims"
    jq -n \
      --arg slug "$slug" --arg title "$title" --arg subtitle "$subtitle" \
      --arg writtenBy "$written_by" --arg curator "Dan Fakkeldy" \
      --arg cover "books/$slug/cover.jpg" --arg coverAlt "Cover of $title" \
      --argjson coverWidth "$cover_width" --argjson coverHeight "$cover_height" \
      --argjson edition "$edition_json" \
      --argjson links "$links" \
      '{
        slug: $slug, title: $title,
        subtitle: (if $subtitle == "" then null else $subtitle end),
        curator: $curator, writtenBy: $writtenBy,
        cover: $cover, coverAlt: $coverAlt,
        coverWidth: $coverWidth, coverHeight: $coverHeight,
        audio: { status: "none" },
        edition: $edition,
        links: $links
      }' > "$WORK_ROOT/$slug.book.json"
  fi
  BOOK_JSONS+=("$WORK_ROOT/$slug.book.json")
done <<<"$ALLOW_LIST"

jq -s \
  --arg generated "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg commit "$SHA" \
  --slurpfile series "$SERIES_SOURCE" \
  '. as $books | {
    version: 2,
    generated: $generated,
    source: { repo: "dfakkeldy/explainer-audiobooks", commit: $commit },
    series: $series[0].series,
    books: $books
  }' "${BOOK_JSONS[@]}" > "$STAGED_CATALOG"

validate_staged_bundle
validate_series "$SERIES_SOURCE" "$STAGED_CATALOG"
listen_catalog_publish_staged_bundle

# The catalog builder owns audio/text synchronization; the paired-cover helper
# then replaces only verified artwork fields and player derivatives. It fails
# closed if the selected Explainer receipts or canonical cover bytes drift.
BOOKS_REPO="$BOOKS_REPO" "$SITE_ROOT/Tools/sync-paired-cover-assets.sh"

echo "WROTE $FINAL_CATALOG ($(jq '.books | length' "$FINAL_CATALOG") books, source $SHA)"

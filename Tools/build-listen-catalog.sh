#!/usr/bin/env bash
# Echo Listening Room — catalog builder (make listen-catalog).
#
# Regenerates Resources/listen/books.json plus per-book assets
# (blocks.json, alignment.json, cover.jpg) from LOCAL checkouts, so the
# committed catalog is always internally consistent: audio URL, sidecar,
# and block text are all pinned to the same explainer-audiobooks commit.
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

for tool in jq ffprobe sips git; do
  command -v "$tool" >/dev/null 2>&1 || { echo "error: missing tool: $tool" >&2; exit 1; }
done
[ -d "$BOOKS_REPO/books" ] || { echo "error: BOOKS_REPO not found: $BOOKS_REPO" >&2; exit 1; }

SITE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$SITE_ROOT/Resources/listen"
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
EOF
)"

# Exact playable-audio publication allow-list. Each listed slug must have both
# an M4B and alignment sidecar; either file on any other public slug is rejected.
AUDIO_EXPECTED="chicken-predators
rodents-in-the-walls
the-new-deal"

EXPECTED_BOOK_COUNT=11
listen_catalog_transaction_init "$OUT_DIR"

json_contains_absolute_path() {
  jq -e '.. | strings | select(startswith("/") or startswith("file://") or test("^[A-Za-z]:[\\\\/]"))' "$1" >/dev/null
}

validate_staged_bundle() {
  local book_count source_sha current_source_sha expected_catalog_slugs actual_catalog_slugs
  local playable_slugs expected_asset_dirs actual_asset_dirs
  local slug asset_dir asset_entries anchors_total anchors_resolved
  local cover_path blocks_path sidecar_path
  local expected_asset_entries

  if [ "$NO_BLOCKS" -eq 1 ]; then
    expected_asset_entries="alignment.json
cover.jpg"
  else
    expected_asset_entries="alignment.json
blocks.json
cover.jpg"
  fi

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

  expected_asset_dirs="$(printf '%s\n' "$AUDIO_EXPECTED" | LC_ALL=C sort)"
  actual_asset_dirs="$(find "$STAGED_BOOKS" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | LC_ALL=C sort)"
  [ "$actual_asset_dirs" = "$expected_asset_dirs" ] || {
    echo "error: staged asset directories do not match AUDIO_EXPECTED" >&2
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
    asset_entries="$(find "$asset_dir" -mindepth 1 -maxdepth 1 -exec basename {} \; | LC_ALL=C sort)"
    [ "$asset_entries" = "$expected_asset_entries" ] || {
      echo "error: staged assets for $slug are incomplete or contain extras" >&2
      return 1
    }

    cover_path="$(jq -r --arg slug "$slug" '.books[] | select(.slug == $slug) | .cover' "$STAGED_CATALOG")"
    sidecar_path="$(jq -r --arg slug "$slug" '.books[] | select(.slug == $slug) | .alignment.sidecar' "$STAGED_CATALOG")"
    [ "$cover_path" = "books/$slug/cover.jpg" ] || { echo "error: invalid staged cover path for $slug" >&2; return 1; }
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
      jq -e --arg slug "$slug" \
        '[.books[] | select(.slug == $slug and .text == null)] | length == 1' \
        "$STAGED_CATALOG" >/dev/null || {
        echo "error: staged no-blocks catalog text must be null for $slug" >&2
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
    fi
  done <<<"$AUDIO_EXPECTED"
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

    if [ "$NO_BLOCKS" -eq 1 ]; then
      echo "  (skipping blocks.json — --no-blocks; captions will not render)"
      text_json='null'
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
      text_json="$(jq -n --arg p "books/$slug/blocks.json" '{blocks: $p}')"
    fi

    jq -n \
      --arg slug "$slug" --arg title "$title" --arg subtitle "$subtitle" \
      --arg writtenBy "$written_by" --arg curator "Dan Fakkeldy" \
      --arg cover "books/$slug/cover.jpg" --arg coverAlt "Cover of $title" \
      --argjson duration "$duration" \
      --arg audioUrl "$RAW_BASE/books/$slug/$slug.m4b" \
      --argjson chapters "$chapters" \
      --argjson text "$text_json" \
      --arg sidecarPath "books/$slug/alignment.json" \
      --argjson hasWords "$has_words" \
      --argjson links "$links" \
      '{
        slug: $slug, title: $title,
        subtitle: (if $subtitle == "" then null else $subtitle end),
        curator: $curator, writtenBy: $writtenBy,
        cover: $cover, coverAlt: $coverAlt,
        durationSeconds: $duration,
        audio: { status: "available", url: $audioUrl, mimeType: "audio/mp4" },
        chapters: $chapters,
        text: $text,
        alignment: { sidecar: $sidecarPath, hasWordTimings: $hasWords },
        links: $links
      }' > "$WORK_ROOT/$slug.book.json"
  else
    if [ -f "$m4b" ] || [ -f "$sidecar" ]; then
      echo "error: unexpected playable media for non-audio-approved book: $slug" >&2
      exit 1
    fi
    echo "· $slug — no approved audio, links-only entry"
    jq -n \
      --arg slug "$slug" --arg title "$title" --arg subtitle "$subtitle" \
      --arg writtenBy "$written_by" --arg curator "Dan Fakkeldy" \
      --argjson links "$links" \
      '{
        slug: $slug, title: $title,
        subtitle: (if $subtitle == "" then null else $subtitle end),
        curator: $curator, writtenBy: $writtenBy,
        audio: { status: "none" },
        links: $links
      }' > "$WORK_ROOT/$slug.book.json"
  fi
  BOOK_JSONS+=("$WORK_ROOT/$slug.book.json")
done <<<"$ALLOW_LIST"

jq -s \
  --arg generated "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg commit "$SHA" \
  '{
    version: 1,
    generated: $generated,
    source: { repo: "dfakkeldy/explainer-audiobooks", commit: $commit },
    books: .
  }' "${BOOK_JSONS[@]}" > "$STAGED_CATALOG"

validate_staged_bundle
listen_catalog_publish_staged_bundle

echo "WROTE $FINAL_CATALOG ($(jq '.books | length' "$FINAL_CATALOG") books, source $SHA)"

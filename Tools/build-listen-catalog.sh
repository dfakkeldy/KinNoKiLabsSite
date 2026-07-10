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
# The allow-list below is the ONLY publishing gate: tier-1 public books,
# hand-maintained. audio.status comes from what exists on disk — a book
# listed in AUDIO_EXPECTED that is missing its m4b or sidecar fails the
# build loudly rather than shipping a broken entry.

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

# Tier-1 public allow-list: slug|title|subtitle|writtenBy
ALLOW_LIST="$(cat <<'EOF'
the-living-knowledge-base|The Living Knowledge Base|LLM Wikis, Research Notebooks, and Company Memory|GPT-5 Codex
echo-from-the-inside|Echo, From the Inside||Opus 4.8
why-it-feels-right|Why It Feels Right||Fable 5
you-are-the-architect|You Are the Architect||Fable 5
the-bug-is-a-clue|The Bug Is a Clue||Opus 4.8
tests-first|Tests First||Opus 4.8
git-happens|Git Happens||Opus 4.8
findable|Findable||Opus 4.8
the-voice-in-the-machine|The Voice in the Machine||Opus 4.8
the-long-route|The Long Route||Fable 5 + Opus 4.8
EOF
)"

# Books that MUST have audio on disk (build fails otherwise).
AUDIO_EXPECTED="the-living-knowledge-base"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

BOOK_JSONS=()
while IFS='|' read -r slug title subtitle written_by; do
  [ -n "$slug" ] || continue
  book_dir="$BOOKS_REPO/books/$slug"
  [ -d "$book_dir" ] || { echo "error: allow-listed book missing from repo: $slug" >&2; exit 1; }

  m4b="$book_dir/$slug.m4b"
  sidecar="$book_dir/$slug.alignment.json"
  links="$(jq -n \
    --arg folder "$GH_BASE/tree/main/books/$slug" \
    --arg epub "$GH_BASE/raw/main/books/$slug/$slug.epub" \
    --arg read "$GH_BASE/blob/main/books/$slug/$slug.md" \
    '{folder: $folder, epub: $epub, read: $read}')"

  if [ -f "$m4b" ]; then
    [ -f "$sidecar" ] || { echo "error: $slug has audio but no alignment sidecar" >&2; exit 1; }
    echo "· $slug — audio available, building assets"
    asset_dir="$OUT_DIR/books/$slug"
    mkdir -p "$asset_dir"

    probe="$TMP_DIR/$slug.probe.json"
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
        "$asset_dir/blocks.json" > "$TMP_DIR/$slug.blocks.json"
      mv "$TMP_DIR/$slug.blocks.json" "$asset_dir/blocks.json"
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
      }' > "$TMP_DIR/$slug.book.json"
  else
    echo "· $slug — no audio on disk, links-only entry"
    if grep -qw "$slug" <<<"$AUDIO_EXPECTED"; then
      echo "error: $slug is expected to have audio but $m4b is missing" >&2; exit 1
    fi
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
      }' > "$TMP_DIR/$slug.book.json"
  fi
  BOOK_JSONS+=("$TMP_DIR/$slug.book.json")
done <<<"$ALLOW_LIST"

jq -s \
  --arg generated "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg commit "$SHA" \
  '{
    version: 1,
    generated: $generated,
    source: { repo: "dfakkeldy/explainer-audiobooks", commit: $commit },
    books: .
  }' "${BOOK_JSONS[@]}" > "$OUT_DIR/books.json"

echo "WROTE $OUT_DIR/books.json ($(jq '.books | length' "$OUT_DIR/books.json") books, source $SHA)"

#!/usr/bin/env bash
# Copy only receipt-verified public cover assets from Explainer Audiobooks.

set -euo pipefail

BOOKS_REPO="${BOOKS_REPO:-$HOME/Developer/explainer-audiobooks}"
SITE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LEARN_ROOT="${LEARN_ROOT:-$SITE_ROOT/Resources/learn}"
CATALOG_PATH="${CATALOG_PATH:-$SITE_ROOT/Resources/listen/books.json}"
LISTEN_BOOKS_ROOT="${LISTEN_BOOKS_ROOT:-$SITE_ROOT/Resources/listen/books}"

[ "$#" -eq 0 ] || { echo "error: unknown argument: $1" >&2; exit 2; }
for tool in jq shasum sips git; do
  command -v "$tool" >/dev/null 2>&1 || { echo "error: missing tool: $tool" >&2; exit 1; }
done
[ -d "$BOOKS_REPO/books" ] || { echo "error: BOOKS_REPO not found: $BOOKS_REPO" >&2; exit 1; }
[ -f "$CATALOG_PATH" ] || { echo "error: listening catalog not found: $CATALOG_PATH" >&2; exit 1; }

MIGRATED_SLUGS="echo-from-the-inside
why-it-feels-right
findable
chicken-predators
the-new-deal"
PORTRAIT_SLUGS="echo-from-the-inside
why-it-feels-right
findable
rodents-in-the-walls
chicken-predators
the-new-deal"
PLAYER_SLUGS="chicken-predators
the-new-deal"

sha256() { shasum -a 256 "$1" | awk '{print $1}'; }
dimensions() {
  local file="$1" width height
  width="$(sips -g pixelWidth "$file" | awk '/pixelWidth/ {print $2}')"
  height="$(sips -g pixelHeight "$file" | awk '/pixelHeight/ {print $2}')"
  printf '%s %s' "$width" "$height"
}
verify_hash() {
  local file="$1" expected="$2" actual
  actual="$(sha256 "$file")"
  [ "$actual" = "$expected" ] || {
    echo "error: hash mismatch for $file: expected $expected, got $actual" >&2
    return 1
  }
}

work="$(mktemp -d "${TMPDIR:-/tmp}/paired-site-covers.XXXXXX")"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/learn/covers" "$work/listen"
provenance_entries="$work/provenance.ndjson"
: > "$provenance_entries"

while IFS= read -r slug; do
  [ -n "$slug" ] || continue
  book_dir="$BOOKS_REPO/books/$slug"
  receipt="$book_dir/cover-selection.json"
  portrait="$book_dir/cover.png"
  [ -f "$receipt" ] || { echo "error: missing selection receipt for $slug" >&2; exit 1; }
  [ -f "$portrait" ] || { echo "error: missing portrait cover for $slug" >&2; exit 1; }

  schema="$(jq -r '.schema_version' "$receipt")"
  [ "$(jq -r '.book_slug' "$receipt")" = "$slug" ] || { echo "error: receipt slug mismatch for $slug" >&2; exit 1; }
  selection_hash="$(sha256 "$receipt")"

  if [ "$slug" = "rodents-in-the-walls" ]; then
    [ "$schema" = "1" ] || { echo "error: Rodents must retain its legacy approved receipt" >&2; exit 1; }
    portrait_hash="$(jq -r '.rendered_cover_sha256' "$receipt")"
    [ "$(jq -r '.selected_candidate' "$receipt")" = "c2a-compact-ribbon-editorial-footer" ] || {
      echo "error: Rodents approved candidate changed" >&2; exit 1;
    }
  else
    [ "$schema" = "2" ] || { echo "error: paired receipt required for $slug" >&2; exit 1; }
    jq -e '.privacy.classification == "public-safe" and .privacy.permission_to_publish == true' "$receipt" >/dev/null || {
      echo "error: $slug is not approved for public publication" >&2; exit 1;
    }
    portrait_hash="$(jq -r '.variants.portrait.cover_sha256' "$receipt")"
  fi

  verify_hash "$portrait" "$portrait_hash"
  [ "$(dimensions "$portrait")" = "1600 2560" ] || { echo "error: wrong portrait dimensions for $slug" >&2; exit 1; }
  cp "$portrait" "$work/learn/covers/$slug.png"

  square_json='null'
  if grep -Fxq "$slug" <<<"$PLAYER_SLUGS"; then
    square="$book_dir/m4b-cover.png"
    [ -f "$square" ] || { echo "error: missing square cover for playable $slug" >&2; exit 1; }
    square_hash="$(jq -r '.variants.square.cover_sha256' "$receipt")"
    verify_hash "$square" "$square_hash"
    [ "$(dimensions "$square")" = "2400 2400" ] || { echo "error: wrong square dimensions for $slug" >&2; exit 1; }
    sips -s format jpeg -s formatOptions 86 -z 768 768 "$square" --out "$work/listen/$slug.jpg" >/dev/null
    derivative_hash="$(sha256 "$work/listen/$slug.jpg")"
    square_json="$(jq -n --arg source "$square_hash" --arg derivative "$derivative_hash" \
      '{sourceSha256:$source, derivativeSha256:$derivative, sourceDimensions:[2400,2400], derivativeDimensions:[768,768]}')"
  fi

  jq -cn --arg slug "$slug" --argjson schema "$schema" --arg selection "$selection_hash" \
    --arg portrait "$portrait_hash" --argjson square "$square_json" \
    '{key:$slug,value:{receiptSchemaVersion:$schema,selectionReceiptSha256:$selection,portrait:{sourceSha256:$portrait,dimensions:[1600,2560]},square:$square}}' \
    >> "$provenance_entries"
done <<<"$PORTRAIT_SLUGS"

source_commit="$(git -C "$BOOKS_REPO" rev-parse HEAD)"
jq -s --arg commit "$source_commit" \
  '{schemaVersion:1,source:{repository:"dfakkeldy/explainer-audiobooks",commit:$commit},books:from_entries}' \
  "$provenance_entries" > "$work/paired-cover-provenance.json"

catalog_tmp="$work/books.json"
jq --slurpfile provenance "$work/paired-cover-provenance.json" '
  .books |= map(
    if (.slug == "chicken-predators" or .slug == "the-new-deal") then
      .coverSourceSha256 = $provenance[0].books[.slug].square.sourceSha256 |
      .coverDerivativeSha256 = $provenance[0].books[.slug].square.derivativeSha256
    else . end
  )
' "$CATALOG_PATH" > "$catalog_tmp"

mkdir -p "$LEARN_ROOT/covers"
for slug in $PORTRAIT_SLUGS; do cp "$work/learn/covers/$slug.png" "$LEARN_ROOT/covers/$slug.png"; done
cp "$work/paired-cover-provenance.json" "$LEARN_ROOT/paired-cover-provenance.json"
for slug in $PLAYER_SLUGS; do cp "$work/listen/$slug.jpg" "$LISTEN_BOOKS_ROOT/$slug/cover.jpg"; done
cp "$catalog_tmp" "$CATALOG_PATH"

echo "Verified and installed six portrait covers and two square player derivatives."

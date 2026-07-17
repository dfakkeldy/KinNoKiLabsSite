#!/usr/bin/env bash
# Copy only manifest-pinned, receipt-verified public cover assets.

set -Eeuo pipefail

BOOKS_REPO="${BOOKS_REPO:-$HOME/Developer/explainer-audiobooks}"
SITE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_MANIFEST_PATH="${SOURCE_MANIFEST_PATH:-$SITE_ROOT/Resources/learn/paired-cover-source-manifest.json}"
LEARN_ROOT="${LEARN_ROOT:-$SITE_ROOT/Resources/learn}"
CATALOG_PATH="${CATALOG_PATH:-$SITE_ROOT/Resources/listen/books.json}"
LISTEN_BOOKS_ROOT="${LISTEN_BOOKS_ROOT:-$SITE_ROOT/Resources/listen/books}"

[ "$#" -eq 0 ] || { echo "error: unknown argument: $1" >&2; exit 2; }
for tool in jq shasum sips git; do
  command -v "$tool" >/dev/null 2>&1 || { echo "error: missing tool: $tool" >&2; exit 1; }
done
[ -d "$BOOKS_REPO/books" ] || { echo "error: BOOKS_REPO not found: $BOOKS_REPO" >&2; exit 1; }
[ -f "$SOURCE_MANIFEST_PATH" ] || { echo "error: source manifest not found: $SOURCE_MANIFEST_PATH" >&2; exit 1; }
[ -f "$CATALOG_PATH" ] || { echo "error: listening catalog not found: $CATALOG_PATH" >&2; exit 1; }

PORTRAIT_SLUGS="an-unsettling-conversation
jspace-inside-the-machine
echo-from-the-inside
why-it-feels-right
findable
rodents-in-the-walls
chicken-predators
the-new-deal"
PLAYER_SLUGS="an-unsettling-conversation
jspace-inside-the-machine
chicken-predators
the-new-deal"

sha256() { shasum -a 256 "$1" | awk '{print $1}'; }
dimensions() {
  local file="$1" width height
  width="$(sips -g pixelWidth "$file" | awk '/pixelWidth/ {print $2}')"
  height="$(sips -g pixelHeight "$file" | awk '/pixelHeight/ {print $2}')"
  printf '%s %s' "$width" "$height"
}
verify_hash() {
  local label="$1" file="$2" expected="$3" actual
  actual="$(sha256 "$file")"
  [ "$actual" = "$expected" ] || {
    echo "error: $label hash mismatch for $file: expected $expected, got $actual" >&2
    return 1
  }
}

jq -e '.schemaVersion == 1 and (.books | type == "object")' "$SOURCE_MANIFEST_PATH" >/dev/null || {
  echo "error: unsupported source manifest" >&2; exit 1;
}
expected_slugs="$(printf '%s\n' "$PORTRAIT_SLUGS" | LC_ALL=C sort)"
manifest_slugs="$(jq -r '.books | keys[]' "$SOURCE_MANIFEST_PATH" | LC_ALL=C sort)"
[ "$manifest_slugs" = "$expected_slugs" ] || { echo "error: source manifest slug set mismatch" >&2; exit 1; }

expected_commit="$(jq -r '.sourceCommit' "$SOURCE_MANIFEST_PATH")"
actual_commit="$(git -C "$BOOKS_REPO" rev-parse HEAD)"
[ "$actual_commit" = "$expected_commit" ] || {
  echo "error: Explainer source commit mismatch: expected $expected_commit, got $actual_commit" >&2; exit 1;
}

relevant_paths=()
while IFS= read -r slug; do
  [ -n "$slug" ] || continue
  relevant_paths+=("books/$slug/cover-selection.json" "books/$slug/cover.png" "books/$slug/cover-spec.json")
  if [ "$slug" != "rodents-in-the-walls" ]; then
    relevant_paths+=("books/$slug/m4b-cover.png" "books/$slug/m4b-cover-spec.json")
  fi
done <<<"$PORTRAIT_SLUGS"
for relative in "${relevant_paths[@]}"; do
  git -C "$BOOKS_REPO" ls-files --error-unmatch "$relative" >/dev/null 2>&1 || {
    echo "error: source asset is not tracked: $relative" >&2; exit 1;
  }
done
if [ -n "$(git -C "$BOOKS_REPO" status --porcelain -- "${relevant_paths[@]}")" ]; then
  echo "error: relevant Explainer source assets are locally modified" >&2
  exit 1
fi

work="$(mktemp -d "${TMPDIR:-/tmp}/paired-site-covers.XXXXXX")"
installing=0
learn_backed_up=0
listen_backed_up=0
catalog_backed_up=0
learn_installed=0
listen_installed=0
catalog_installed=0

rollback() {
  local exit_code=$?
  trap - ERR INT TERM
  set +e
  if [ "$installing" -eq 1 ]; then
    [ "$learn_installed" -eq 1 ] && rm -rf "$LEARN_ROOT"
    [ "$listen_installed" -eq 1 ] && rm -rf "$LISTEN_BOOKS_ROOT"
    [ "$catalog_installed" -eq 1 ] && rm -f "$CATALOG_PATH"
    [ "$learn_backed_up" -eq 1 ] && mv "$work/backup-learn" "$LEARN_ROOT"
    [ "$listen_backed_up" -eq 1 ] && mv "$work/backup-listen" "$LISTEN_BOOKS_ROOT"
    [ "$catalog_backed_up" -eq 1 ] && mv "$work/backup-catalog.json" "$CATALOG_PATH"
  fi
  rm -rf "$work"
  exit "$exit_code"
}
trap rollback ERR INT TERM

mkdir -p "$work/covers" "$work/player"
entries="$work/provenance.ndjson"
: > "$entries"

while IFS= read -r slug; do
  [ -n "$slug" ] || continue
  book_dir="$BOOKS_REPO/books/$slug"
  receipt="$book_dir/cover-selection.json"
  portrait="$book_dir/cover.png"
  portrait_spec="$book_dir/cover-spec.json"
  manifest_query=".books[\"$slug\"]"
  schema="$(jq -r '.schema_version' "$receipt")"

  verify_hash "receipt" "$receipt" "$(jq -r "$manifest_query.receiptSha256" "$SOURCE_MANIFEST_PATH")"
  [ "$(jq -r '.book_slug' "$receipt")" = "$slug" ] || { echo "error: receipt slug mismatch for $slug" >&2; exit 1; }
  verify_hash "portrait" "$portrait" "$(jq -r "$manifest_query.portrait.sha256" "$SOURCE_MANIFEST_PATH")"
  verify_hash "portrait spec" "$portrait_spec" "$(jq -r "$manifest_query.portrait.specSha256" "$SOURCE_MANIFEST_PATH")"
  [ "$(dimensions "$portrait")" = "1600 2560" ] || { echo "error: wrong portrait dimensions for $slug" >&2; exit 1; }

  if [ "$slug" = "rodents-in-the-walls" ]; then
    [ "$schema" = "1" ] || { echo "error: Rodents must retain its legacy approved receipt" >&2; exit 1; }
    jq -e '.privacy.classification == "public-safe" and .privacy.permission_to_publish == "granted"' "$receipt" >/dev/null || {
      echo "error: Rodents legacy privacy does not grant public publication" >&2; exit 1;
    }
    candidate="$(jq -r '.selected_candidate' "$receipt")"
    [ "$(jq -r '.rendered_cover_sha256' "$receipt")" = "$(jq -r "$manifest_query.portrait.sha256" "$SOURCE_MANIFEST_PATH")" ] || {
      echo "error: Rodents receipt portrait hash mismatch" >&2; exit 1;
    }
    [ "$(jq -r '.spec_sha256' "$receipt")" = "$(jq -r "$manifest_query.portrait.specSha256" "$SOURCE_MANIFEST_PATH")" ] || {
      echo "error: Rodents receipt spec hash mismatch" >&2; exit 1;
    }
    square_json='null'
  else
    [ "$schema" = "2" ] || { echo "error: paired receipt required for $slug" >&2; exit 1; }
    jq -e '.privacy.classification == "public-safe" and .privacy.permission_to_publish == true' "$receipt" >/dev/null || {
      echo "error: $slug is not approved for public publication" >&2; exit 1;
    }
    candidate="$(jq -r '.candidate.id' "$receipt")"
    square="$book_dir/m4b-cover.png"
    square_spec="$book_dir/m4b-cover-spec.json"
    square_hash="$(jq -r "$manifest_query.square.sha256" "$SOURCE_MANIFEST_PATH")"
    portrait_receipt_spec_hash="$(jq -r "($manifest_query.portrait.receiptSpecSha256 // $manifest_query.portrait.specSha256)" "$SOURCE_MANIFEST_PATH")"
    square_receipt_spec_hash="$(jq -r "($manifest_query.square.receiptSpecSha256 // $manifest_query.square.specSha256)" "$SOURCE_MANIFEST_PATH")"
    verify_hash "square" "$square" "$square_hash"
    verify_hash "square spec" "$square_spec" "$(jq -r "$manifest_query.square.specSha256" "$SOURCE_MANIFEST_PATH")"
    [ "$(dimensions "$square")" = "2400 2400" ] || { echo "error: wrong square dimensions for $slug" >&2; exit 1; }
    jq -e --arg portrait "$(jq -r "$manifest_query.portrait.sha256" "$SOURCE_MANIFEST_PATH")" \
      --arg portraitSpec "$portrait_receipt_spec_hash" \
      --arg square "$square_hash" --arg squareSpec "$square_receipt_spec_hash" \
      '.variants.portrait.cover_sha256 == $portrait and .variants.portrait.specification_sha256 == $portraitSpec and
       .variants.square.cover_sha256 == $square and .variants.square.specification_sha256 == $squareSpec' "$receipt" >/dev/null || {
      echo "error: receipt variant hashes mismatch for $slug" >&2; exit 1;
    }
    square_json='null'
    if grep -Fxq "$slug" <<<"$PLAYER_SLUGS"; then
      sips -s format jpeg -s formatOptions 86 -z 768 768 "$square" --out "$work/player/$slug.jpg" >/dev/null
      # Measure the derivative rather than restating the requested size: the
      # recorded dimensions also become the catalog's coverWidth/coverHeight,
      # which the player trusts for each thumbnail's aspect ratio.
      derivative_dims="$(dimensions "$work/player/$slug.jpg")"
      [ "$derivative_dims" = "768 768" ] || {
        echo "error: wrong player derivative dimensions for $slug: $derivative_dims" >&2; exit 1;
      }
      read -r derivative_width derivative_height <<<"$derivative_dims"
      derivative_hash="$(sha256 "$work/player/$slug.jpg")"
      square_json="$(jq -n --arg source "$square_hash" --arg derivative "$derivative_hash" \
        --argjson width "$derivative_width" --argjson height "$derivative_height" \
        '{sourceSha256:$source,derivativeSha256:$derivative,sourceDimensions:[2400,2400],derivativeDimensions:[$width,$height]}')"
    fi
  fi

  expected_candidate="$(jq -r "$manifest_query.candidateId" "$SOURCE_MANIFEST_PATH")"
  [ "$candidate" = "$expected_candidate" ] || {
    echo "error: candidate ID mismatch for $slug: expected $expected_candidate, got $candidate" >&2; exit 1;
  }
  cp "$portrait" "$work/covers/$slug.png"
  jq -cn --arg slug "$slug" --argjson schema "$schema" \
    --arg selection "$(sha256 "$receipt")" --arg portrait "$(sha256 "$portrait")" --argjson square "$square_json" \
    '{key:$slug,value:{receiptSchemaVersion:$schema,selectionReceiptSha256:$selection,portrait:{sourceSha256:$portrait,dimensions:[1600,2560]},square:$square}}' >> "$entries"
done <<<"$PORTRAIT_SLUGS"

jq -s --arg commit "$expected_commit" \
  '{schemaVersion:1,source:{repository:"dfakkeldy/explainer-audiobooks",commit:$commit},books:from_entries}' \
  "$entries" > "$work/paired-cover-provenance.json"

if [ -d "$LEARN_ROOT" ]; then cp -R "$LEARN_ROOT" "$work/install-learn"; else mkdir -p "$work/install-learn"; fi
mkdir -p "$work/install-learn/covers"
for slug in $PORTRAIT_SLUGS; do cp "$work/covers/$slug.png" "$work/install-learn/covers/$slug.png"; done
cp "$work/paired-cover-provenance.json" "$work/install-learn/paired-cover-provenance.json"

if [ -d "$LISTEN_BOOKS_ROOT" ]; then cp -R "$LISTEN_BOOKS_ROOT" "$work/install-listen"; else mkdir -p "$work/install-listen"; fi
for slug in $PLAYER_SLUGS; do mkdir -p "$work/install-listen/$slug"; cp "$work/player/$slug.jpg" "$work/install-listen/$slug/cover.jpg"; done

jq --argjson playerSlugs "$(printf '%s\n' "$PLAYER_SLUGS" | jq -R -s 'split("\n") | map(select(length > 0))')" \
  --slurpfile provenance "$work/paired-cover-provenance.json" '
  .books |= map(.slug as $slug | if ($playerSlugs | index($slug)) != null then
    .coverSourceSha256 = $provenance[0].books[.slug].square.sourceSha256 |
    .coverDerivativeSha256 = $provenance[0].books[.slug].square.derivativeSha256 |
    .coverWidth = $provenance[0].books[.slug].square.derivativeDimensions[0] |
    .coverHeight = $provenance[0].books[.slug].square.derivativeDimensions[1]
  else . end)
' "$CATALOG_PATH" > "$work/install-catalog.json"

# The builder validates coverWidth/coverHeight against ITS staged covers, but
# this script replaces those two covers afterwards — so it must re-verify the
# fields it just rewrote against the square bytes actually being installed.
while IFS= read -r slug; do
  [ -n "$slug" ] || continue
  patched_dims="$(jq -r --arg slug "$slug" \
    '.books[] | select(.slug == $slug) | "\(.coverWidth) \(.coverHeight)"' "$work/install-catalog.json")"
  installed_dims="$(dimensions "$work/install-listen/$slug/cover.jpg")"
  [ "$patched_dims" = "$installed_dims" ] || {
    echo "error: patched catalog dimensions ($patched_dims) do not match the installed cover ($installed_dims) for $slug" >&2
    exit 1
  }
done <<<"$PLAYER_SLUGS"

mkdir -p "$(dirname "$LEARN_ROOT")" "$(dirname "$LISTEN_BOOKS_ROOT")" "$(dirname "$CATALOG_PATH")"
installing=1
rename_count=0
if [ -e "$LEARN_ROOT" ]; then mv "$LEARN_ROOT" "$work/backup-learn"; learn_backed_up=1; fi
mv "$work/install-learn" "$LEARN_ROOT"; learn_installed=1; rename_count=$((rename_count + 1))
[ "${PAIRED_COVER_FAIL_AFTER_RENAME:-0}" != "$rename_count" ] || { echo "error: forced install failure after rename $rename_count" >&2; false; }
if [ -e "$LISTEN_BOOKS_ROOT" ]; then mv "$LISTEN_BOOKS_ROOT" "$work/backup-listen"; listen_backed_up=1; fi
mv "$work/install-listen" "$LISTEN_BOOKS_ROOT"; listen_installed=1; rename_count=$((rename_count + 1))
[ "${PAIRED_COVER_FAIL_AFTER_RENAME:-0}" != "$rename_count" ] || { echo "error: forced install failure after rename $rename_count" >&2; false; }
if [ -e "$CATALOG_PATH" ]; then mv "$CATALOG_PATH" "$work/backup-catalog.json"; catalog_backed_up=1; fi
mv "$work/install-catalog.json" "$CATALOG_PATH"; catalog_installed=1; rename_count=$((rename_count + 1))
[ "${PAIRED_COVER_FAIL_AFTER_RENAME:-0}" != "$rename_count" ] || { echo "error: forced install failure after rename $rename_count" >&2; false; }
installing=0
trap - ERR INT TERM
rm -rf "$work"

echo "Verified and installed eight portrait covers and four square player derivatives from $expected_commit."

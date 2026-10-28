#!/usr/bin/env bash
# Make the 640x1024 WebP cover thumbnails shown on /learn and /taxsale.
#
# The 1600x2560 PNG covers stay pinned where they are (make paired-covers);
# this only writes small display copies beside them and records which source
# bytes each copy came from, so Tests/site/cover-thumbnails.test.mjs fails if
# a cover changes and its thumbnail is not remade.

set -Eeuo pipefail

SITE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$SITE_ROOT/Resources/images/covers"
MANIFEST="$OUT_DIR/thumbnails.json"

for tool in magick jq shasum; do
  command -v "$tool" >/dev/null 2>&1 || { echo "error: missing tool: $tool" >&2; exit 1; }
done

# public path of the thumbnail <TAB> source file, relative to Resources/
ENTRIES="echo-from-the-inside-640.webp	learn/covers/echo-from-the-inside.png
why-it-feels-right-640.webp	learn/covers/why-it-feels-right.png
findable-640.webp	learn/covers/findable.png
rodents-in-the-walls-640.webp	learn/covers/rodents-in-the-walls.png
chicken-predators-640.webp	learn/covers/chicken-predators.png
beyond-the-tax-sale-packet-640.webp	taxsale/cover.png"

sha256() { shasum -a 256 "$1" | awk '{print $1}'; }

mkdir -p "$OUT_DIR"
records=()
while IFS=$'\t' read -r name source; do
  [ -n "$name" ] || continue
  src="$SITE_ROOT/Resources/$source"
  [ -f "$src" ] || { echo "error: missing source cover: $source" >&2; exit 1; }
  magick "$src" -strip -filter Lanczos -resize 640x1024! -quality 84 -define webp:method=6 "$OUT_DIR/$name"
  records+=("$(jq -cn --arg name "$name" --arg source "$source" \
    --arg sourceSha "$(sha256 "$src")" --arg thumbSha "$(sha256 "$OUT_DIR/$name")" \
    '{key:$name,value:{source:$source,sourceSha256:$sourceSha,sha256:$thumbSha,dimensions:[640,1024]}}')")
done <<<"$ENTRIES"

printf '%s\n' "${records[@]}" | jq -s '{schemaVersion:1,thumbnails:from_entries}' > "$MANIFEST"
echo "Wrote ${#records[@]} cover thumbnails to Resources/images/covers/."

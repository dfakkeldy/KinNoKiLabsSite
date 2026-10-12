/* Publication gates shared by the staging command and shipped-catalog checks.
   Classic support is deliberately limited to the two approved Merchant editions. */
const merchantSlugs = new Set(['merchant-of-venice-play', 'merchant-of-venice-novel']);

export function normalizePublication(receipt, slug) {
  if (receipt.slug !== slug) throw new Error(`receipt slug ${receipt.slug} does not match ${slug}`);
  if (receipt.permissionToPublish !== true) throw new Error('receipt does not grant permission to publish');
  for (const [gate, value] of Object.entries(receipt.publicGate || {})) {
    if (value !== true) throw new Error(`public gate ${gate} is not satisfied`);
  }
  if (receipt.packageKind !== 'classic-adaptation') {
    if (receipt.classification !== 'public-safe') throw new Error(`classification is ${receipt.classification}`);
    return receipt;
  }
  if (!merchantSlugs.has(slug) || receipt.schemaVersion !== 1 ||
      receipt.editionId !== '20261004T050000Z' || receipt.publicationStatus !== 'public-first-listen' ||
      receipt.originalAuthor !== 'William Shakespeare' || receipt.source?.status !== 'public-domain' ||
      receipt.licenses?.recordingNotice !== 'AUDIO-LICENSE.md') {
    throw new Error('not an approved public Merchant edition');
  }
  const names = {
    [`${slug}.epub`]: 'epub', [`${slug}.md`]: 'manuscript',
    [`${slug}.alignment.json`]: 'alignment', 'cover.png': 'cover',
  };
  for (const file of [...Object.keys(names), 'LICENSE-CONTENT.md', 'AUDIO-LICENSE.md', 'CREDITS.md']) {
    if (!receipt.files?.[file]) throw new Error(`classic receipt is missing ${file}`);
  }
  return {
    ...receipt,
    artifacts: Object.fromEntries(Object.entries(receipt.files).map(([file, entry]) =>
      [names[file] || file, { ...entry, file }])),
  };
}

export function matchesNarration(slug, block, spoken) {
  if (spoken === block.text) return true;
  // These accepted recordings speak the act number in Arabic numerals and
  // replace the dash with a comma. Both substitutions retain one display
  // token per timed word: neither the EPUB nor the sidecar needs changing.
  if (slug !== 'merchant-of-venice-play' || block.kind !== 'heading' ||
      !Number.isInteger(block.chapterIndex) || !/^s\d+-b0$/.test(block.id)) return false;
  const acts = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
  const match = block.text.match(/^Act (I|II|III|IV|V) — (Scene .+)$/);
  return !!match && spoken === `Act ${acts[match[1]]} , ${match[2]}`;
}

/* Echo Listening Room — pure logic ports and presentation policy (no DOM, no fetch).
   JS ports of Echo's Shared/WordTokenizer.swift,
   Shared/WordTimingInterpolator.swift and
   Shared/VisualListeningCueResolver.swift (Echo PR #417), so the web
   player tracks the shipped native semantics. Tested by
   Tests/listen/listen-core.test.mjs (`make test-listen`).

   Dual export: `window.EchoListenCore` in the browser (loaded with a
   plain <script defer> before listen.js), `module.exports` under node. */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EchoListenCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── Tokenizer (WordTokenizer port) ─────────────────────
     Unicode-whitespace-delimited, runs collapse, punctuation stays
     attached to its token. Word index == array position everywhere. */
  function words(text) {
    if (!text) return [];
    return text.split(/\s+/u).filter(function (w) { return w.length > 0; });
  }

  /* ── Word timing (WordTimingInterpolator port) ──────────
     Distributes a block's words across [blockStart, blockEnd) by
     character weight: word length plus its following space, except the
     final word (no trailing space) — so the last word ends exactly at
     blockEnd. */
  function interpolateWords(text, blockStart, blockEnd) {
    const tokens = words(text);
    if (tokens.length === 0) return [];

    const span = Math.max(0, blockEnd - blockStart);
    const lastIndex = tokens.length - 1;
    const weights = tokens.map(function (w, i) {
      return w.length + (i === lastIndex ? 0 : 1);
    });
    const total = Math.max(1, weights.reduce(function (a, b) { return a + b; }, 0));

    const result = [];
    let cursor = 0;
    for (let i = 0; i < tokens.length; i++) {
      const start = blockStart + (cursor / total) * span;
      cursor += weights[i];
      const end = blockStart + (cursor / total) * span;
      result.push({ index: i, word: tokens[i], start: start, end: end });
    }
    return result;
  }

  /* ── Timeline (sidecar anchors → block rows) ────────────
     Anchors carry only a start timestamp; each block's window ends where
     the next anchored block begins (Echo's WordTimingMaterializer uses
     the same next-block rule), and the last block ends at the audio
     duration. Anchors whose blockId isn't in blocks.json are dropped and
     counted so the player can surface drift diagnostics. */
  function buildTimeline(anchors, blocks, durationSeconds) {
    const blockById = new Map();
    blocks.forEach(function (b) { blockById.set(b.id, b); });

    const kept = anchors
      .filter(function (a) { return blockById.has(a.blockId); })
      .slice()
      .sort(function (a, b) { return a.timestamp - b.timestamp; });

    const rows = kept.map(function (anchor, i) {
      const block = blockById.get(anchor.blockId);
      const end = i + 1 < kept.length ? kept[i + 1].timestamp : durationSeconds;
      return {
        start: anchor.timestamp,
        end: Math.max(anchor.timestamp, end),
        blockId: anchor.blockId,
        chapterIndex: block.chapterIndex,
        sequenceIndex: block.sequenceIndex,
      };
    });

    return { rows: rows, droppedAnchorCount: anchors.length - kept.length };
  }

  /* Binary search over sorted rows for the one containing `time` in
     [start, end). Returns -1 when no row contains it. */
  function activeRowIndex(rows, time) {
    let lo = 0;
    let hi = rows.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const row = rows[mid];
      if (time < row.start) hi = mid - 1;
      else if (time >= row.end) lo = mid + 1;
      else return mid;
    }
    return -1;
  }

  /* Word progress within one block's word rows. Indices are DISPLAY
     ordinals (array positions), never the persisted sparse `index` —
     mirrors Echo's display-ordinal remap in VisualListeningCueResolver. */
  function wordProgress(wordRows, time) {
    let activeWordIndex = null;
    let alreadyHeardWordCount = 0;
    for (let i = 0; i < wordRows.length; i++) {
      const w = wordRows[i];
      if (w.end <= time) alreadyHeardWordCount = i + 1;
      if (activeWordIndex === null && time >= w.start && time < w.end) {
        activeWordIndex = i;
      }
    }
    return { activeWordIndex: activeWordIndex, alreadyHeardWordCount: alreadyHeardWordCount };
  }

  /* The web Listening Room intentionally presents karaoke one display word
     ahead of the timing cursor for every book. The word under the cursor joins
     the heard wash so the visual progress remains contiguous. At the end of a
     block the active cue stays on its final word instead of disappearing. */
  const KARAOKE_WORD_LEAD = 1;
  function presentedWordProgress(wordRows, time) {
    const progress = wordProgress(wordRows, time);
    if (progress.activeWordIndex === null) return progress;

    const activeWordIndex = Math.min(
      progress.activeWordIndex + KARAOKE_WORD_LEAD,
      wordRows.length - 1
    );
    return {
      activeWordIndex: activeWordIndex,
      alreadyHeardWordCount: Math.max(progress.alreadyHeardWordCount, activeWordIndex),
    };
  }

  /* ── Visual cue resolution (VisualListeningCueResolver port) ── */

  function isImageBlock(block) {
    return block.kind === 'image' && typeof block.imagePath === 'string' && block.imagePath.length > 0;
  }

  /* begin: the reference paragraph's own window.
     midpoint: centered on the paragraph midpoint, widened to ± its
     duration (lookahead before the paragraph starts, hold after). */
  function displayWindow(row, syncPoint) {
    if (syncPoint === 'midpoint') {
      const duration = row.end - row.start;
      const midpoint = row.start + duration / 2;
      return { start: midpoint - duration, end: midpoint + duration };
    }
    return { start: row.start, end: row.end };
  }

  /* Nearest same-chapter text row to anchor a derived figure window:
     first text row at/after the image's sequenceIndex, else the last
     one before it. */
  function referenceRow(imageBlock, rows, blockById) {
    const textRows = rows.filter(function (row) {
      const block = blockById.get(row.blockId);
      if (!block || block.kind === 'image') return false;
      return (block.chapterIndex === undefined ? null : block.chapterIndex) ===
             (imageBlock.chapterIndex === undefined ? null : imageBlock.chapterIndex);
    });
    let after = null;
    let before = null;
    textRows.forEach(function (row) {
      if (row.sequenceIndex >= imageBlock.sequenceIndex) {
        if (after === null || row.sequenceIndex < after.sequenceIndex) after = row;
      } else if (before === null || row.sequenceIndex > before.sequenceIndex) {
        before = row;
      }
    });
    return after || before;
  }

  function makeImageCue(imageBlock, rows, blockById, syncPoint) {
    const reference = referenceRow(imageBlock, rows, blockById);
    const ownRow = rows.find(function (r) { return r.blockId === imageBlock.id; });

    if (ownRow && ownRow.end > ownRow.start) {
      return {
        blockId: imageBlock.id,
        imagePath: imageBlock.imagePath,
        caption: imageBlock.text || null,
        subtitleBlockId: reference ? reference.blockId : null,
        sequenceIndex: imageBlock.sequenceIndex,
        displayStartTime: ownRow.start,
        displayEndTime: ownRow.end,
        source: 'explicitTimeline',
      };
    }
    if (!reference) return null;
    const window = displayWindow(reference, syncPoint);
    return {
      blockId: imageBlock.id,
      imagePath: imageBlock.imagePath,
      caption: imageBlock.text || null,
      subtitleBlockId: reference.blockId,
      sequenceIndex: imageBlock.sequenceIndex,
      displayStartTime: window.start,
      displayEndTime: window.end,
      source: 'derivedFromNearbyText',
    };
  }

  /* Full per-frame snapshot: which figure (if any), which subtitle, and
     the active block. Cover-only books have no image blocks, so
     imageCue is null and captions still run — the renderer owns the
     cover, exactly as Echo's stage does. */
  function normalizedCatalogBooks(catalog) {
    const rawBooks = catalog && Array.isArray(catalog.books) ? catalog.books : [];
    const seen = new Set();
    return rawBooks.filter(function (book) {
      if (!book || typeof book.slug !== 'string' || book.slug.length === 0) return false;
      if (seen.has(book.slug)) return false;
      seen.add(book.slug);
      return true;
    });
  }

  /* Normalize only relationships that the published catalog actually names.
     `plannedVolumeCount` is progress metadata; it never creates placeholder
     volumes. First valid ownership wins when malformed input repeats a series
     ID or assigns one book to multiple series. */
  function normalizedSeriesShelves(catalog, books) {
    const rawSeries = catalog && Array.isArray(catalog.series) ? catalog.series : [];
    const publishedBooks = new Set(books.map(function (book) { return book.slug; }));
    const seenSeriesIds = new Set();
    const claimedBooks = new Set();
    const shelves = [];

    rawSeries.forEach(function (series) {
      if (!series || typeof series.id !== 'string' || series.id.length === 0) return;
      if (seenSeriesIds.has(series.id) || !Array.isArray(series.volumes)) return;

      const volumes = [];
      series.volumes.forEach(function (volume) {
        if (!volume || typeof volume.book !== 'string' || volume.book.length === 0) return;
        if (!publishedBooks.has(volume.book) || claimedBooks.has(volume.book)) return;
        volumes.push(volume);
        claimedBooks.add(volume.book);
      });
      if (volumes.length === 0) return;

      seenSeriesIds.add(series.id);
      shelves.push({ source: series, volumes: volumes });
    });

    return shelves;
  }

  function seriesContext(catalog, slug) {
    if (typeof slug !== 'string' || slug.length === 0) return null;
    const books = normalizedCatalogBooks(catalog);
    const shelves = normalizedSeriesShelves(catalog, books);

    for (let i = 0; i < shelves.length; i++) {
      const shelf = shelves[i];
      const volumeIndex = shelf.volumes.findIndex(function (volume) {
        return volume.book === slug;
      });
      if (volumeIndex < 0) continue;

      const planned = shelf.source.plannedVolumeCount;
      return {
        series: Object.assign({}, shelf.source, { volumes: shelf.volumes.slice() }),
        volume: shelf.volumes[volumeIndex],
        availableCount: shelf.volumes.length,
        plannedCount: Number.isInteger(planned) && planned > 0 ? planned : shelf.volumes.length,
        previous: volumeIndex > 0 ? shelf.volumes[volumeIndex - 1] : null,
        next: volumeIndex + 1 < shelf.volumes.length ? shelf.volumes[volumeIndex + 1] : null,
      };
    }
    return null;
  }

  function defaultBookSlug(catalog) {
    const books = normalizedCatalogBooks(catalog);
    const bookBySlug = new Map();
    books.forEach(function (book) { bookBySlug.set(book.slug, book); });

    const featured = normalizedSeriesShelves(catalog, books).find(function (shelf) {
      return shelf.source.featured === true;
    });
    if (featured) {
      const volume = featured.volumes.find(function (candidate) {
        const book = bookBySlug.get(candidate.book);
        return book && book.audio && book.audio.status === 'available';
      });
      if (volume) return volume.book;
    }

    const playable = books.find(function (book) {
      return book.audio && book.audio.status === 'available';
    });
    return playable ? playable.slug : null;
  }

  function librarySections(catalog, selectedSlug) {
    const books = normalizedCatalogBooks(catalog);
    const shelves = normalizedSeriesShelves(catalog, books);
    const seriesBooks = new Set();
    const series = shelves.map(function (shelf) {
      const slugs = shelf.volumes.map(function (volume) {
        seriesBooks.add(volume.book);
        return volume.book;
      });
      return { id: shelf.source.id, books: slugs };
    });

    /* Selection affects rendering, not structural library membership. */
    void selectedSlug;
    return {
      series: series,
      moreBooks: books
        .filter(function (book) { return !seriesBooks.has(book.slug); })
        .map(function (book) { return book.slug; }),
    };
  }

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

  function resolveSnapshot(input) {
    const blocks = input.blocks.slice().sort(function (a, b) {
      if (a.sequenceIndex !== b.sequenceIndex) return a.sequenceIndex - b.sequenceIndex;
      return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
    });
    const blockById = new Map();
    blocks.forEach(function (b) { blockById.set(b.id, b); });

    const rowIndex = activeRowIndex(input.rows, input.time);
    const activeBlockId = rowIndex >= 0 ? input.rows[rowIndex].blockId : null;

    /* Latest applicable figure wins (highest sequenceIndex, then later
       display start). */
    let imageCue = null;
    blocks.filter(isImageBlock).forEach(function (block) {
      const cue = makeImageCue(block, input.rows, blockById, input.syncPoint || 'midpoint');
      if (!cue) return;
      if (input.time < cue.displayStartTime || input.time >= cue.displayEndTime) return;
      if (imageCue === null ||
          cue.sequenceIndex > imageCue.sequenceIndex ||
          (cue.sequenceIndex === imageCue.sequenceIndex &&
           cue.displayStartTime > imageCue.displayStartTime)) {
        imageCue = cue;
      }
    });

    /* Subtitle prefers the active text block; falls back to the figure's
       reference block when the active block can't carry words (image) or
       nothing is active yet (midpoint lookahead). */
    let subtitleBlock = null;
    const activeBlock = activeBlockId ? blockById.get(activeBlockId) : null;
    if (activeBlock && activeBlock.kind !== 'image') {
      subtitleBlock = activeBlock;
    } else if (imageCue && imageCue.subtitleBlockId) {
      subtitleBlock = blockById.get(imageCue.subtitleBlockId) || null;
    }

    let subtitleCue = null;
    if (subtitleBlock) {
      const wordRows = input.wordsByBlockId.get(subtitleBlock.id);
      if (wordRows && wordRows.length > 0) {
        const progress = presentedWordProgress(wordRows, input.time);
        subtitleCue = {
          blockId: subtitleBlock.id,
          text: subtitleBlock.text,
          activeWordIndex: progress.activeWordIndex,
          alreadyHeardWordCount: progress.alreadyHeardWordCount,
        };
      } else {
        subtitleCue = {
          blockId: subtitleBlock.id,
          text: subtitleBlock.text,
          activeWordIndex: null,
          alreadyHeardWordCount: 0,
        };
      }
    }

    if (imageCue) delete imageCue.sequenceIndex;
    return { imageCue: imageCue, subtitleCue: subtitleCue, activeBlockId: activeBlockId };
  }

  return {
    words: words,
    interpolateWords: interpolateWords,
    buildTimeline: buildTimeline,
    activeRowIndex: activeRowIndex,
    wordProgress: wordProgress,
    seriesContext: seriesContext,
    defaultBookSlug: defaultBookSlug,
    librarySections: librarySections,
    libraryActions: libraryActions,
    resolveSnapshot: resolveSnapshot,
  };
});

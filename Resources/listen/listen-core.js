/* Echo Listening Room — pure logic ports (no DOM, no fetch).
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
        const progress = wordProgress(wordRows, input.time);
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
    resolveSnapshot: resolveSnapshot,
  };
});

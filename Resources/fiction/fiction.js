/* Fiction Listening Room — player glue (DOM, audio, MediaSession).
   Pure logic (tokenizing, word timing, cue resolution) is shared with the
   Echo Listening Room and lives in /listen/listen-core.js; this file only
   wires it to the page. Loaded with <script defer> after /site.js (theme
   + font toggles) and listen-core.js.

   Data contract: ./books.json. Every book renders; a book only becomes
   playable when its catalog entry carries audio.status === "available"
   plus a duration, chapter times, blocks and an alignment sidecar. Until
   then the room shows the book in its awaiting-narration state — real
   opening lines, dead transport — instead of implying playback that
   cannot happen. Tests/fiction/catalog.test.mjs fails the build if a
   half-finished entry ever claims to be available.

   All fetches are same-origin; the only cross-origin request is the
   <audio> stream itself, which needs no CORS. */

(function () {
  'use strict';

  var core = window.EchoListenCore;
  if (!core) return;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    cover: $('cover'), bookForm: $('bookForm'), bookTitle: $('bookTitle'),
    bookSubtitle: $('bookSubtitle'), bookByline: $('bookByline'), editionNote: $('editionNote'),
    chapterCount: $('chapterCount'), chapterList: $('chapterList'), chapterNow: $('chapterNow'),
    captionPanel: $('captionPanel'), captionWords: $('captionWords'), captionText: $('captionText'),
    figurePanel: $('figurePanel'), figureImg: $('figureImg'), figureCaption: $('figureCaption'),
    status: $('status'), playPause: $('playPause'), iconPlay: $('iconPlay'),
    iconPause: $('iconPause'), back30: $('back30'), fwd30: $('fwd30'), speed: $('speed'),
    scrubber: $('scrubber'), timeNow: $('timeNow'), timeTotal: $('timeTotal'),
    selectedFormats: $('selectedFormats'), emptyState: $('emptyState'),
    shelf: $('shelf'), shelfSub: $('shelfSub'),
  };
  var main = document.querySelector('.room-main');
  var room = document.querySelector('.room');

  var audio = new Audio();
  audio.preload = 'metadata';

  var SPEEDS = [1, 1.25, 1.5, 2];
  var SPEED_KEY = 'kinnoki-fiction-rate';
  var FORMATS = [
    { key: 'read', label: 'Read as Markdown' },
    { key: 'epub', label: 'EPUB' },
    { key: 'folder', label: 'Book folder' },
  ];
  var book = null;
  var playable = false;
  var rows = [];
  var blocks = [];
  var wordsByBlockId = new Map();
  var currentBlockId = null;
  var currentFigureBlockId = null;
  var figurePaths = [];        // interior figures as {blockId, imagePath}, document order
  var failedFigureSrcs = {};   // per-src error latch; a different figure still tries
  var lastFigureSrc = null;
  var currentChapterIndex = -1;
  var captionSpans = [];
  var scrubbing = false;
  var lastSavedAt = 0;
  // Read once at boot and gate saves until the resume seek has been
  // applied: Chrome can fire a timeupdate at currentTime 0 before
  // loadedmetadata, which would otherwise overwrite the stored position.
  var pendingResumeT = null;
  var canSave = false;

  /* ── Small utilities ────────────────────────────────── */
  function fmtTime(s) {
    s = Math.max(0, Math.floor(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var mm = h > 0 && m < 10 ? '0' + m : String(m);
    var ss = sec < 10 ? '0' + sec : String(sec);
    return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
  }
  function fmtSpoken(s) {
    s = Math.max(0, Math.floor(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var parts = [];
    if (h) parts.push(h + (h === 1 ? ' hour' : ' hours'));
    if (m) parts.push(m + (m === 1 ? ' minute' : ' minutes'));
    if (sec || parts.length === 0) parts.push(sec + (sec === 1 ? ' second' : ' seconds'));
    return parts.join(' ');
  }
  function fmtWords(count) {
    return '~' + Math.round(count / 100) * 100 / 1000 + 'k words';
  }
  function setStatus(text, isError) {
    els.status.textContent = text || '';
    els.status.classList.toggle('error', !!isError);
  }
  function setEmptyState(text) {
    els.emptyState.textContent = text || '';
    els.emptyState.hidden = !text;
  }
  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function duration() {
    return isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : (book && book.durationSeconds ? book.durationSeconds : 0);
  }
  // Catalog cover dimensions are optional and only usable in pairs, so
  // every reader gates on this rather than trusting a lone field.
  function positiveInt(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value > 0;
  }
  function hasCoverSize(b) {
    return !!b && positiveInt(b.coverWidth) && positiveInt(b.coverHeight);
  }

  /* A book is playable only when the whole streaming contract is present.
     Anything short of that — a status flipped early, an M4B with no
     sidecar — keeps the room in its awaiting-narration state rather than
     handing the transport a source it cannot caption. */
  function isPlayable(b) {
    return !!b && !!b.audio && b.audio.status === 'available' &&
      typeof b.audio.url === 'string' && b.audio.url.length > 0 &&
      typeof b.durationSeconds === 'number' && b.durationSeconds > 0 &&
      Array.isArray(b.chapters) && b.chapters.length > 0 &&
      b.chapters.every(function (chapter) { return typeof chapter.start === 'number'; });
  }

  /* ── Rendering: book metadata ───────────────────────── */
  function bylineParts(b) {
    var parts = ['by ' + b.author, b.chapters.length + ' chapters'];
    if (typeof b.wordCount === 'number') parts.push(fmtWords(b.wordCount));
    if (playable) parts.push(fmtTime(b.durationSeconds));
    else if (typeof b.estimatedHours === 'number') parts.push('≈' + b.estimatedHours + ' h once narrated');
    return parts.join(' · ');
  }

  function renderBook() {
    document.title = book.title + ' — Fiction Listening Room — KinNoKi Labs';
    els.bookForm.textContent = 'Original fiction · ' + book.form + ' · ' + book.genre;
    els.bookTitle.textContent = book.title;
    if (book.subtitle) { els.bookSubtitle.textContent = book.subtitle; els.bookSubtitle.hidden = false; }
    els.bookByline.textContent = bylineParts(book);
    els.cover.src = book.cover;
    els.cover.alt = book.coverAlt || ('Cover of ' + book.title);
    if (hasCoverSize(book)) {
      els.cover.setAttribute('width', String(book.coverWidth));
      els.cover.setAttribute('height', String(book.coverHeight));
    }
    if (book.editionNote) {
      els.editionNote.textContent = book.editionNote;
      els.editionNote.hidden = false;
    }
  }

  function formatLinks(b) {
    var links = b.links || {};
    return FORMATS.filter(function (format) {
      return typeof links[format.key] === 'string' && links[format.key].length > 0;
    }).map(function (format) {
      return { label: format.label, href: links[format.key] };
    });
  }

  function formatLink(entry) {
    var a = document.createElement('a');
    a.href = entry.href;
    a.textContent = entry.label;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  function renderSelectedFormats() {
    var entries = formatLinks(book);
    entries.forEach(function (entry) { els.selectedFormats.appendChild(formatLink(entry)); });
    els.selectedFormats.hidden = entries.length === 0;
  }

  /* ── Rendering: the shelf ───────────────────────────── */
  function renderShelfCard(b) {
    var li = document.createElement('li');
    var selected = book && b.slug === book.slug;
    var bookPlayable = isPlayable(b);
    if (bookPlayable) li.className = 'is-playable';
    if (selected) li.setAttribute('aria-current', 'page');

    if (b.cover) {
      var thumb = document.createElement('img');
      thumb.className = 'fic-cover';
      thumb.src = b.cover;
      thumb.alt = b.coverAlt || ('Cover of ' + b.title);
      thumb.loading = 'lazy';
      thumb.decoding = 'async';
      // Both hints or neither: with the true intrinsic size the lazy grid
      // reserves the right box, and with a guess it would reflow.
      if (hasCoverSize(b)) {
        thumb.setAttribute('width', String(b.coverWidth));
        thumb.setAttribute('height', String(b.coverHeight));
      }
      li.appendChild(thumb);
    }

    var genre = document.createElement('span');
    genre.className = 'fic-genre';
    genre.textContent = b.form + ' · ' + b.genre;
    li.appendChild(genre);

    var title = document.createElement('span');
    title.className = 'fic-title';
    title.textContent = b.title;
    li.appendChild(title);

    var hook = document.createElement('span');
    hook.className = 'fic-hook';
    hook.textContent = b.hook;
    li.appendChild(hook);

    var meta = document.createElement('span');
    meta.className = 'fic-meta';
    meta.textContent = 'by ' + b.author + ' · ' + b.chapters.length + ' chapters · ' + fmtWords(b.wordCount);
    li.appendChild(meta);

    var actions = document.createElement('span');
    actions.className = 'fic-actions';
    if (bookPlayable && !selected) {
      var listen = document.createElement('a');
      listen.className = 'fic-listen';
      listen.href = '?book=' + encodeURIComponent(b.slug);
      listen.textContent = 'Listen now';
      actions.appendChild(listen);
    }
    if (!bookPlayable) {
      var badge = document.createElement('span');
      badge.className = 'fic-badge';
      badge.textContent = 'Coming soon';
      actions.appendChild(badge);
      if (b.production && b.production.label) {
        var status = document.createElement('span');
        status.className = 'fic-status';
        status.textContent = b.production.label;
        actions.appendChild(status);
      }
    }
    formatLinks(b).forEach(function (entry) { actions.appendChild(formatLink(entry)); });
    li.appendChild(actions);
    return li;
  }

  function renderShelf(books) {
    var streaming = books.filter(isPlayable).length;
    els.shelfSub.textContent = streaming > 0
      ? (streaming === 1 ? 'One novel is streaming now; the rest are in the works.' :
         streaming + ' novels are streaming now; the rest are in the works.') +
        ' Every finished title lands here first, free.'
      : 'Nothing is narrated yet — every finished title lands here first, free.';
    books.forEach(function (candidate) {
      els.shelf.appendChild(renderShelfCard(candidate));
    });
  }

  /* ── Rendering: chapters ────────────────────────────── */
  /* With audio the rows are seek buttons; without it they are plain rows
     carrying the same metrics, so the list neither lies about being
     interactive nor reflows once narration arrives. */
  function renderChapters() {
    els.chapterCount.textContent = '(' + book.chapters.length + ')';
    book.chapters.forEach(function (chapter, i) {
      var li = document.createElement('li');
      var name = document.createElement('span');
      name.textContent = chapter.title;

      if (playable) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'room-chapter-btn';
        var time = document.createElement('span');
        time.className = 't';
        time.textContent = fmtTime(chapter.start);
        btn.appendChild(name);
        btn.appendChild(time);
        btn.addEventListener('click', function () { seekTo(chapter.start + 0.01); });
        li.appendChild(btn);
      } else {
        var row = document.createElement('span');
        row.className = 'fic-chapter-row';
        var number = document.createElement('span');
        number.className = 'n';
        number.textContent = String(chapter.number);
        row.appendChild(name);
        row.appendChild(number);
        li.appendChild(row);
      }
      els.chapterList.appendChild(li);
    });
  }

  function chapterIndexAt(t) {
    for (var i = book.chapters.length - 1; i >= 0; i--) {
      if (t >= book.chapters[i].start) return i;
    }
    return 0;
  }

  function updateChapter(t) {
    var i = chapterIndexAt(t);
    if (i === currentChapterIndex) return;
    currentChapterIndex = i;
    var chapter = book.chapters[i];
    els.chapterNow.textContent = 'ch. ' + chapter.number + ' — ' + chapter.title;
    Array.prototype.forEach.call(els.chapterList.children, function (li, j) {
      if (j === i) li.setAttribute('aria-current', 'true');
      else li.removeAttribute('aria-current');
    });
    if ('mediaSession' in navigator) {
      // Only claim a `sizes` the catalog actually vouches for: an
      // asserted-but-wrong size is worse for the OS artwork picker than none.
      var artwork = { src: new URL(book.cover, location.href).href, type: 'image/jpeg' };
      if (hasCoverSize(book)) artwork.sizes = book.coverWidth + 'x' + book.coverHeight;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: chapter.title,
        artist: book.title,
        album: 'Fiction Listening Room — KinNoKi Labs',
        artwork: [artwork],
      });
    }
  }

  /* ── Captions ───────────────────────────────────────── */
  function showQuiet(text) {
    currentBlockId = null;
    captionSpans = [];
    els.captionWords.textContent = '';
    var span = document.createElement('span');
    span.className = 'quiet';
    span.textContent = text;
    els.captionWords.appendChild(span);
    els.captionText.textContent = text; // keep the SR node in step with the visual state
  }

  /* The awaiting-narration panel: the book's real opening lines, in the
     un-heard caption colour, under a label that says what they are. */
  function showExcerpt(text) {
    currentBlockId = null;
    captionSpans = [];
    els.captionWords.textContent = '';
    var wrapper = document.createElement('span');
    wrapper.className = 'excerpt';
    var label = document.createElement('span');
    label.className = 'excerpt-label';
    label.textContent = 'Opening lines';
    wrapper.appendChild(label);
    wrapper.appendChild(document.createTextNode(text));
    els.captionWords.appendChild(wrapper);
    els.captionText.textContent = 'Opening lines. ' + text;
  }

  function rebuildCaption(cue) {
    currentBlockId = cue.blockId;
    captionSpans = [];
    els.captionWords.classList.add('swap');
    els.captionWords.textContent = '';
    var tokens = core.words(cue.text);
    tokens.forEach(function (token, i) {
      var span = document.createElement('span');
      span.className = 'w';
      span.textContent = token;
      els.captionWords.appendChild(span);
      if (i < tokens.length - 1) els.captionWords.appendChild(document.createTextNode(' '));
      captionSpans.push(span);
    });
    els.captionText.textContent = cue.text;
    requestAnimationFrame(function () { els.captionWords.classList.remove('swap'); });
  }

  /* ── Figure stage (slideshow) ───────────────────────── */
  function hasFigureStage() {
    return !!(els.figurePanel && els.figureImg && els.figureCaption);
  }

  function hideFigure() {
    if (currentFigureBlockId === null && els.figurePanel.hidden) return;
    currentFigureBlockId = null;
    els.figurePanel.hidden = true;
  }

  // Warm the next interior figure so the swap is instant. The lookup keys
  // off the block id, not the image path: two figure blocks may reuse the
  // same file, and matching on the path would preload the wrong successor.
  function preloadNextFigure(cue) {
    if (typeof Image === 'undefined') return;
    var k = -1;
    for (var i = 0; i < figurePaths.length; i++) {
      if (figurePaths[i].blockId === cue.blockId) { k = i; break; }
    }
    if (k === -1 || k + 1 >= figurePaths.length) return;
    var next = figurePaths[k + 1].imagePath;
    if (failedFigureSrcs[next]) return;
    new Image().src = next;
  }

  function renderFigure(cue) {
    if (!hasFigureStage()) return;
    if (!cue) { hideFigure(); return; }
    if (cue.blockId === currentFigureBlockId) return;
    currentFigureBlockId = cue.blockId;
    if (failedFigureSrcs[cue.imagePath]) {
      // This src already failed once; keep the stage quiet instead of
      // re-fetching it on every tick inside the same display window.
      els.figurePanel.hidden = true;
      return;
    }
    els.figurePanel.classList.add('swap');
    lastFigureSrc = cue.imagePath; // catalog-relative, same base as book.cover
    els.figureImg.src = cue.imagePath;
    els.figureImg.alt = cue.caption || 'Illustration from this chapter';
    els.figureCaption.textContent = cue.caption || '';
    els.figureCaption.hidden = !cue.caption;
    els.figurePanel.hidden = false;
    requestAnimationFrame(function () { els.figurePanel.classList.remove('swap'); });
    preloadNextFigure(cue);
  }

  function tick(t) {
    updateChapter(t);
    if (!rows.length) return;
    var snapshot = core.resolveSnapshot({
      blocks: blocks, rows: rows, wordsByBlockId: wordsByBlockId,
      time: t, syncPoint: 'midpoint',
    });
    renderFigure(snapshot.imageCue);
    var cue = snapshot.subtitleCue;
    if (!cue) {
      if (currentBlockId !== null || !els.captionWords.firstChild) showQuiet('· · ·');
      return;
    }
    if (cue.blockId !== currentBlockId) rebuildCaption(cue);
    for (var i = 0; i < captionSpans.length; i++) {
      var cls = 'w';
      if (i < cue.alreadyHeardWordCount) cls += ' heard';
      if (i === cue.activeWordIndex) cls += ' active';
      if (captionSpans[i].className !== cls) captionSpans[i].className = cls;
    }
  }

  /* ── Transport ──────────────────────────────────────── */
  function setPlayingUI(playing) {
    els.iconPlay.style.display = playing ? 'none' : 'block';
    els.iconPause.style.display = playing ? 'block' : 'none';
    els.playPause.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    main.classList.toggle('playing', playing);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
  }

  function play() {
    if (els.playPause.disabled) return;
    var p = audio.play();
    if (p && p.catch) {
      p.catch(function () {
        setStatus('Playback couldn’t start. Tap play to try again.', true);
      });
    }
  }
  function toggle() {
    if (els.playPause.disabled) return;
    if (audio.paused) play(); else audio.pause();
  }

  function seekTo(t) {
    audio.currentTime = Math.min(Math.max(0, t), duration() || t);
    updateScrubber();
    tick(audio.currentTime);
  }
  function seekBy(delta) { seekTo(audio.currentTime + delta); }

  function applySpeed(rate, persist) {
    audio.playbackRate = rate;
    els.speed.textContent = (rate === 1 ? '1' : String(rate)) + '×';
    els.speed.setAttribute('aria-label', 'Playback speed, currently ' + rate + '×');
    if (persist) store(SPEED_KEY, String(rate));
  }
  function preferredSpeed() {
    var raw = read(SPEED_KEY);
    var rate = Number(raw);
    if (SPEEDS.indexOf(rate) !== -1 && raw === String(rate)) return rate;
    store(SPEED_KEY, String(SPEEDS[0]));
    return SPEEDS[0];
  }
  function cycleSpeed() {
    var i = SPEEDS.indexOf(audio.playbackRate);
    applySpeed(SPEEDS[(i + 1) % SPEEDS.length], true);
  }

  function updateScrubber() {
    var d = duration();
    var t = audio.currentTime;
    if (!scrubbing) {
      els.scrubber.value = String(t);
      els.scrubber.setAttribute('aria-valuetext', fmtSpoken(t) + ' of ' + fmtSpoken(d));
      els.scrubber.style.setProperty('--played', d > 0 ? (t / d) * 100 + '%' : '0%');
      els.timeNow.textContent = fmtTime(t); // while scrubbing, the input handler owns this label
    }
    els.timeTotal.textContent = fmtTime(d);
  }

  function showAudioError() {
    els.playPause.disabled = true;
    setStatus('The audio stream couldn’t load. It streams from the public library on GitHub — reload to retry.', true);
  }

  function savePosition(force) {
    if (!book || !canSave) return;
    var now = Date.now();
    if (!force && now - lastSavedAt < 5000) return;
    lastSavedAt = now;
    store('kinnoki-fiction-' + book.slug, JSON.stringify({ t: audio.currentTime }));
  }

  /* ── Wiring ─────────────────────────────────────────── */
  function wireControls() {
    els.playPause.addEventListener('click', toggle);
    els.back30.addEventListener('click', function () { seekBy(-30); });
    els.fwd30.addEventListener('click', function () { seekBy(30); });
    els.speed.addEventListener('click', cycleSpeed);

    els.scrubber.addEventListener('input', function () {
      scrubbing = true;
      var t = parseFloat(els.scrubber.value);
      els.timeNow.textContent = fmtTime(t);
      els.scrubber.setAttribute('aria-valuetext', fmtSpoken(t) + ' of ' + fmtSpoken(duration()));
      var d = duration();
      els.scrubber.style.setProperty('--played', d > 0 ? (t / d) * 100 + '%' : '0%');
    });
    els.scrubber.addEventListener('change', function () {
      scrubbing = false;
      seekTo(parseFloat(els.scrubber.value));
    });

    audio.addEventListener('timeupdate', function () {
      updateScrubber();
      tick(audio.currentTime);
      savePosition(false);
      if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && duration() > 0) {
        navigator.mediaSession.setPositionState({
          duration: duration(), playbackRate: audio.playbackRate, position: audio.currentTime,
        });
      }
    });
    audio.addEventListener('seeked', function () { updateScrubber(); tick(audio.currentTime); });
    audio.addEventListener('play', function () { setPlayingUI(true); setStatus(''); });
    audio.addEventListener('pause', function () { setPlayingUI(false); savePosition(true); });
    audio.addEventListener('ended', function () {
      setPlayingUI(false);
      store('kinnoki-fiction-' + book.slug, JSON.stringify({ t: 0 }));
      setStatus('That’s the whole book. It re-plays from the top whenever you like.');
    });
    audio.addEventListener('error', showAudioError);
    if (hasFigureStage()) {
      els.figureImg.addEventListener('error', function () {
        // A broken figure never interrupts listening: hide the stage and
        // latch the src so this window doesn't retry it every tick.
        if (lastFigureSrc) failedFigureSrcs[lastFigureSrc] = true;
        els.figurePanel.hidden = true;
        console.debug('[fiction] figure image failed: ' + lastFigureSrc);
      });
    }
    audio.addEventListener('loadedmetadata', function () {
      // Loading a source can reset the media element to 1×. Restore the
      // preference here so the effective rate stays in step with the UI.
      applySpeed(preferredSpeed(), false);
      els.scrubber.max = String(duration());
      els.scrubber.disabled = false;
      els.playPause.disabled = false;
      els.back30.disabled = false;
      els.fwd30.disabled = false;
      els.speed.disabled = false;
      updateScrubber();
      if (pendingResumeT !== null && pendingResumeT > 10 && pendingResumeT < duration() - 10) {
        seekTo(pendingResumeT);
        setStatus('Resumed from ' + fmtTime(pendingResumeT) + '.');
      } else {
        setStatus('Streams free from the public library — audio may take a moment to start.');
      }
      pendingResumeT = null;
      canSave = true;
    });

    document.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      var target = e.target;
      if (target && target.closest && target.closest('input, textarea, select, button, a, summary, [contenteditable]')) return;
      if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seekBy(-30); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seekBy(30); }
    });

    window.addEventListener('pagehide', function () { savePosition(true); });

    if ('mediaSession' in navigator) {
      var ms = navigator.mediaSession;
      ms.setActionHandler('play', play);
      ms.setActionHandler('pause', function () { audio.pause(); });
      ms.setActionHandler('seekbackward', function (d) { seekBy(-(d.seekOffset || 30)); });
      ms.setActionHandler('seekforward', function (d) { seekBy(d.seekOffset || 30); });
      ms.setActionHandler('seekto', function (d) {
        if (typeof d.seekTime === 'number') seekTo(d.seekTime);
      });
      // Like Echo: previous restarts the chapter first, then steps back.
      ms.setActionHandler('previoustrack', function () {
        var chapter = book.chapters[currentChapterIndex];
        if (audio.currentTime - chapter.start > 3 || currentChapterIndex === 0) seekTo(chapter.start + 0.01);
        else seekTo(book.chapters[currentChapterIndex - 1].start + 0.01);
      });
      ms.setActionHandler('nexttrack', function () {
        if (currentChapterIndex + 1 < book.chapters.length) {
          seekTo(book.chapters[currentChapterIndex + 1].start + 0.01);
        }
      });
    }
  }

  /* ── Read-along data ────────────────────────────────── */
  function loadReadAlong() {
    if (!book.text || !book.alignment) {
      showQuiet('Read-along captions aren’t available for this book yet.');
      return;
    }
    Promise.all([
      fetch(book.text.blocks).then(function (r) {
        if (!r.ok) throw new Error('blocks ' + r.status);
        return r.json();
      }),
      fetch(book.alignment.sidecar).then(function (r) {
        if (!r.ok) throw new Error('sidecar ' + r.status);
        return r.json();
      }),
    ]).then(function (results) {
      blocks = results[0].blocks;
      // Interior figures only (the cover block has chapterIndex null), in
      // document order, for next-figure preloading.
      figurePaths = blocks.filter(function (b) {
        return b.kind === 'image' && typeof b.imagePath === 'string' && b.imagePath.length > 0 &&
               b.chapterIndex !== null && b.chapterIndex !== undefined;
      }).sort(function (a, b) { return a.sequenceIndex - b.sequenceIndex; })
        .map(function (b) { return { blockId: b.id, imagePath: b.imagePath }; });
      var anchors = results[1];
      var timeline = core.buildTimeline(anchors, blocks, book.durationSeconds);
      rows = timeline.rows;
      if (timeline.droppedAnchorCount > 0) {
        console.debug('[fiction] dropped ' + timeline.droppedAnchorCount + ' sidecar anchors (blockId drift)');
      }
      var blockText = new Map();
      blocks.forEach(function (b) { blockText.set(b.id, b.text || ''); });
      var sidecarWords = new Map();
      anchors.forEach(function (anchor) {
        if (anchor.words && anchor.words.length) sidecarWords.set(anchor.blockId, anchor.words);
      });
      rows.forEach(function (row) {
        var provided = sidecarWords.get(row.blockId);
        if (provided) {
          wordsByBlockId.set(row.blockId, provided.map(function (w, i) {
            return { index: i, word: w.word, start: w.start, end: w.end };
          }));
        } else {
          wordsByBlockId.set(row.blockId, core.interpolateWords(blockText.get(row.blockId), row.start, row.end));
        }
      });
      tick(audio.currentTime);
    }).catch(function (err) {
      console.debug('[fiction] read-along unavailable:', err);
      showQuiet('Read-along captions couldn’t load — audio still works.');
    });
  }

  /* ── Book selection ─────────────────────────────────── */
  /* An explicit ?book= wins when it names a real book. Otherwise the first
     narrated book wins, and only when none exists does the catalog's
     featured title hold the stage. So the day narration lands, the room
     opens on the streaming book with no code change here. */
  function chooseBook(books, wanted) {
    var requested = books.find(function (b) { return b.slug === wanted; });
    if (requested) return requested;
    return books.find(isPlayable) ||
      books.find(function (b) { return b.featured === true; }) ||
      books[0] || null;
  }

  /* ── Boot ───────────────────────────────────────────── */
  fetch('books.json')
    .then(function (r) {
      if (!r.ok) throw new Error('catalog ' + r.status);
      return r.json();
    })
    .then(function (catalog) {
      var books = Array.isArray(catalog.books) ? catalog.books : [];
      var wanted = new URLSearchParams(location.search).get('book');
      book = chooseBook(books, wanted);
      if (!book) {
        // Nothing on the shelf at all: hide the player rather than render
        // an empty instrument.
        room.hidden = true;
        setStatus('', false);
        setEmptyState('The fiction shelf is empty right now — check back soon.');
        return;
      }
      playable = isPlayable(book);
      room.hidden = false;
      setEmptyState('');

      renderBook();
      renderSelectedFormats();
      renderChapters();
      renderShelf(books);

      var invalidRequestedBook = wanted && !books.some(function (b) { return b.slug === wanted; });

      if (!playable) {
        // Awaiting narration. The transport stays disabled exactly as the
        // markup ships it, and the panel carries the book's opening lines.
        els.chapterNow.textContent = 'ch. 1 — ' + book.chapters[0].title;
        els.timeNow.textContent = '--:--';
        els.timeTotal.textContent = '--:--';
        if (book.excerpt) showExcerpt(book.excerpt);
        else showQuiet('This book is written but not yet narrated.');
        var label = book.production && book.production.label
          ? book.production.label
          : 'Not yet narrated';
        setStatus(label + ' — there’s no audio to stream yet. These are the opening lines of chapter one.');
        if (invalidRequestedBook) {
          setStatus('That book isn’t on the fiction shelf — showing ' + book.title + ' instead.', true);
        }
        return;
      }

      try {
        var saved = JSON.parse(read('kinnoki-fiction-' + book.slug) || 'null');
        if (saved && typeof saved.t === 'number') pendingResumeT = saved.t;
      } catch (e) {}
      wireControls();
      applySpeed(preferredSpeed(), false);
      updateChapter(0);
      showQuiet('Press play to start listening.');
      // <source type=…> instead of audio.src: GitHub serves the m4b as
      // application/octet-stream, so give the browser the real MIME type.
      var source = document.createElement('source');
      source.src = book.audio.url;
      source.type = book.audio.mimeType || 'audio/mp4';
      // Failures of a <source> child fire on the source element, not the
      // media element itself.
      source.addEventListener('error', showAudioError);
      audio.appendChild(source);
      audio.load();
      loadReadAlong();
      setStatus(invalidRequestedBook
        ? 'That book isn’t on the fiction shelf — playing ' + book.title + ' instead.'
        : '', !!invalidRequestedBook);
    })
    .catch(function (err) {
      console.debug('[fiction] catalog failed:', err);
      room.hidden = false;
      setEmptyState('');
      setStatus('The book catalog couldn’t load. Reload to retry.', true);
    });
})();

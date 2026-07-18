/* Echo Listening Room — player glue (DOM, audio, MediaSession).
   Pure logic (tokenizing, word timing, cue resolution) lives in
   listen-core.js; this file only wires it to the page. Loaded with
   <script defer> after /site.js (theme + font toggles) and listen-core.js.

   Data contract: ./books.json (see Tools/build-listen-catalog.sh). All
   fetches are same-origin; the only cross-origin request is the <audio>
   stream itself, which needs no CORS. */

(function () {
  'use strict';

  var core = window.EchoListenCore;
  if (!core) return;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    cover: $('cover'), bookTitle: $('bookTitle'), bookSubtitle: $('bookSubtitle'),
    bookByline: $('bookByline'), chapterCount: $('chapterCount'), chapterList: $('chapterList'),
    chapterNow: $('chapterNow'), captionPanel: $('captionPanel'), captionWords: $('captionWords'),
    captionText: $('captionText'), figurePanel: $('figurePanel'), figureImg: $('figureImg'),
    figureCaption: $('figureCaption'), status: $('status'), playPause: $('playPause'),
    iconPlay: $('iconPlay'), iconPause: $('iconPause'), back30: $('back30'), fwd30: $('fwd30'),
    speed: $('speed'), scrubber: $('scrubber'), timeNow: $('timeNow'), timeTotal: $('timeTotal'),
    selectedFormats: $('selectedFormats'), emptyState: $('emptyState'),
    bookSeries: $('bookSeries'), seriesProgress: $('seriesProgress'),
    seriesPrevious: $('seriesPrevious'), seriesNext: $('seriesNext'),
    editionStatus: $('editionStatus'), seriesShelves: $('seriesShelves'),
    seriesLibrary: $('seriesLibrary'), moreBooksShelf: $('moreBooksShelf'),
    library: $('library'), honesty: $('honesty'),
  };
  var main = document.querySelector('.room-main');
  var room = document.querySelector('.room');

  var audio = new Audio();
  audio.preload = 'metadata';

  var SPEEDS = [1, 1.25, 1.5];
  var SPEED_KEY = 'kinnoki-listen-rate';
  var book = null;
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
      : (book ? book.durationSeconds : 0);
  }
  // Catalog cover dimensions are optional and only usable in pairs, so
  // every reader gates on this rather than trusting a lone field.
  function positiveInt(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value > 0;
  }
  function hasCoverSize(b) {
    return !!b && positiveInt(b.coverWidth) && positiveInt(b.coverHeight);
  }

  /* ── Rendering: book metadata + library strip ───────── */
  function renderBook() {
    document.title = book.title + ' — Echo Listening Room — KinNoKi Labs';
    els.bookTitle.textContent = book.title;
    if (book.subtitle) { els.bookSubtitle.textContent = book.subtitle; els.bookSubtitle.hidden = false; }
    els.bookByline.textContent = 'Curated by ' + book.curator + ' · Written by ' + book.writtenBy;
    els.cover.src = book.cover;
    els.cover.alt = book.coverAlt || ('Cover of ' + book.title);

    els.honesty.textContent = 'Written by ' + book.writtenBy +
      ', grounded in real sources — spot-checked, not expert-reviewed. ';
    var link = document.createElement('a');
    link.href = 'https://github.com/dfakkeldy/explainer-audiobooks#honest-disclosure';
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Read the collection’s honest disclosure';
    els.honesty.appendChild(link);
    els.honesty.appendChild(document.createTextNode('.'));
  }

  function actionLink(action) {
    var a = document.createElement('a');
    a.href = action.href;
    a.textContent = action.label;
    if (action.className) a.className = action.className;
    if (action.external) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }

  function renderSelectedFormats() {
    var actions = core.libraryActions(book).filter(function (action) {
      return action.label !== 'Listen';
    });
    actions.forEach(function (action) {
      els.selectedFormats.appendChild(actionLink(action));
    });
    els.selectedFormats.hidden = actions.length === 0;
  }

  function renderSeriesContext(catalog) {
    if (!els.bookSeries || !els.seriesProgress || !els.seriesPrevious || !els.seriesNext ||
        !els.editionStatus || typeof core.seriesContext !== 'function') return;
    var context = core.seriesContext(catalog, book.slug);
    var navigation = els.seriesPrevious.parentNode;

    if (context) {
      els.bookSeries.textContent = context.series.title + ' · Volume ' + context.volume.number;
      els.bookSeries.hidden = false;
      els.seriesProgress.textContent = context.availableCount + ' of ' + context.plannedCount +
        ' planned volumes available';
      els.seriesProgress.hidden = false;
    }

    [
      { element: els.seriesPrevious, volume: context && context.previous, label: 'Previous' },
      { element: els.seriesNext, volume: context && context.next, label: 'Next' },
    ].forEach(function (item) {
      if (!item.volume) {
        item.element.hidden = true;
        return;
      }
      item.element.href = '?book=' + encodeURIComponent(item.volume.book);
      item.element.textContent = item.label + ': Volume ' + item.volume.number;
      item.element.hidden = false;
    });
    navigation.hidden = !context || (els.seriesPrevious.hidden && els.seriesNext.hidden);

    var disclosure = book.edition && book.edition.disclosure;
    if (typeof disclosure === 'string' && disclosure.length > 0) {
      els.editionStatus.textContent = disclosure;
      els.editionStatus.hidden = false;
    }
  }

  function renderLibraryCard(b, volumeNumber) {
    var li = document.createElement('li');
    var selected = book && b.slug === book.slug;
    if (selected) li.setAttribute('aria-current', 'page');
    if (b.cover) {
      var thumb = document.createElement('img');
      thumb.className = 'room-lib-cover';
      thumb.src = b.cover;
      thumb.alt = b.coverAlt || ('Cover of ' + b.title);
      thumb.loading = 'lazy';
      thumb.decoding = 'async';
      // Covers keep their natural shape — most are portrait, but the
      // paired-m4b books ship square art — so the intrinsic ratio comes
      // from the catalog's own pixel dimensions instead of a hard-coded
      // one. With both hints the lazy grid reserves the true box and
      // doesn't reflow as covers arrive; with neither, the browser
      // measures on load rather than being told a wrong shape.
      if (hasCoverSize(b)) {
        thumb.setAttribute('width', String(b.coverWidth));
        thumb.setAttribute('height', String(b.coverHeight));
      }
      li.appendChild(thumb);
    }
    if (typeof volumeNumber === 'number') {
      var volume = document.createElement('span');
      volume.className = 'room-lib-volume';
      volume.textContent = 'Volume ' + volumeNumber;
      li.appendChild(volume);
    }
    var title = document.createElement('span');
    title.className = 'room-lib-title';
    title.textContent = b.title;
    li.appendChild(title);
    if (b.subtitle) {
      var subtitle = document.createElement('span');
      subtitle.className = 'room-lib-subtitle';
      subtitle.textContent = b.subtitle;
      li.appendChild(subtitle);
    }
    var by = document.createElement('span');
    by.className = 'room-lib-by';
    by.textContent = 'Written by ' + b.writtenBy;
    li.appendChild(by);
    var links = document.createElement('span');
    links.className = 'room-lib-links';
    core.libraryActions(b).filter(function (action) {
      return !selected || action.label !== 'Listen';
    }).forEach(function (action) {
      links.appendChild(actionLink(action));
    });
    li.appendChild(links);
    return li;
  }

  function renderLibrary(catalog) {
    if (typeof core.librarySections !== 'function' || !els.seriesLibrary || !els.seriesShelves ||
        !els.moreBooksShelf) {
      catalog.books.forEach(function (candidate) {
        els.library.appendChild(renderLibraryCard(candidate));
      });
      return;
    }
    var books = new Map();
    catalog.books.forEach(function (candidate) { books.set(candidate.slug, candidate); });
    var seriesById = new Map();
    (catalog.series || []).forEach(function (series) { seriesById.set(series.id, series); });
    var sections = core.librarySections(catalog, book && book.slug);

    sections.series.forEach(function (section, index) {
      var series = seriesById.get(section.id);
      if (!series) return;
      var shelf = document.createElement('section');
      shelf.className = 'series-shelf';
      var heading = document.createElement('h3');
      heading.id = 'seriesShelfTitle-' + (index + 1);
      heading.textContent = series.title;
      shelf.setAttribute('aria-labelledby', heading.id);
      shelf.appendChild(heading);

      if (series.description) {
        var description = document.createElement('p');
        description.className = 'series-shelf-description';
        description.textContent = series.description;
        shelf.appendChild(description);
      }
      var availability = document.createElement('p');
      availability.className = 'series-shelf-availability';
      availability.textContent = section.books.length + ' of ' +
        (series.plannedVolumeCount || section.books.length) + ' planned volumes available';
      shelf.appendChild(availability);

      var list = document.createElement('ol');
      list.className = 'series-volume-list';
      section.books.forEach(function (slug) {
        var candidate = books.get(slug);
        var volume = series.volumes.find(function (entry) { return entry.book === slug; });
        if (candidate) list.appendChild(renderLibraryCard(candidate, volume && volume.number));
      });
      shelf.appendChild(list);
      els.seriesLibrary.appendChild(shelf);
    });
    els.seriesShelves.hidden = els.seriesLibrary.children.length === 0;

    sections.moreBooks.forEach(function (slug) {
      var candidate = books.get(slug);
      if (candidate) els.library.appendChild(renderLibraryCard(candidate));
    });
    els.moreBooksShelf.hidden = els.library.children.length === 0;
  }

  /* ── Rendering: chapters ────────────────────────────── */
  function renderChapters() {
    els.chapterCount.textContent = '(' + book.chapters.length + ')';
    book.chapters.forEach(function (chapter, i) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'room-chapter-btn';
      var name = document.createElement('span');
      name.textContent = chapter.title;
      var time = document.createElement('span');
      time.className = 't';
      time.textContent = fmtTime(chapter.start);
      btn.appendChild(name);
      btn.appendChild(time);
      btn.addEventListener('click', function () { seekTo(chapter.start + 0.01); });
      li.appendChild(btn);
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
    els.chapterNow.textContent = chapter.title;
    Array.prototype.forEach.call(els.chapterList.children, function (li, j) {
      if (j === i) li.setAttribute('aria-current', 'true');
      else li.removeAttribute('aria-current');
    });
    if ('mediaSession' in navigator) {
      // Only claim a `sizes` the catalog actually vouches for: covers are
      // not all one shape, and an asserted-but-wrong size is worse for the
      // OS artwork picker than none at all.
      var artwork = { src: new URL(book.cover, location.href).href, type: 'image/jpeg' };
      if (hasCoverSize(book)) artwork.sizes = book.coverWidth + 'x' + book.coverHeight;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: chapter.title,
        artist: book.title,
        album: 'Echo Listening Room — KinNoKi Labs',
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
  /* The stage elements are feature-checked so a cached pre-slideshow
     index.html served alongside this script degrades to captions-only
     instead of killing the whole player boot. */
  function hasFigureStage() {
    return !!(els.figurePanel && els.figureImg && els.figureCaption);
  }

  function hideFigure() {
    if (currentFigureBlockId === null && els.figurePanel.hidden) return;
    currentFigureBlockId = null;
    els.figurePanel.hidden = true;
  }

  // Warm the next interior figure so the swap is instant. The lookup keys
  // off the block id, not the image path: two figure blocks may legitimately
  // reuse the same file (a recurring diagram), and matching on the path
  // would find the first block using it and preload the wrong successor.
  // `Image` is feature-checked because the node test harness runs without
  // a DOM.
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
    els.figureImg.alt = cue.caption || 'Figure from this chapter';
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
    // Cover-only books resolve imageCue to null on every tick, so the
    // stage stays hidden and behaves exactly as before the slideshow.
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
    setStatus('The audio stream couldn’t load. It streams from the public library on GitHub — reload to retry, or grab the EPUB below.', true);
  }

  function savePosition(force) {
    if (!book || !canSave) return;
    var now = Date.now();
    if (!force && now - lastSavedAt < 5000) return;
    lastSavedAt = now;
    store('kinnoki-listen-' + book.slug, JSON.stringify({ t: audio.currentTime }));
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
      store('kinnoki-listen-' + book.slug, JSON.stringify({ t: 0 }));
      setStatus('That’s the whole book. It re-plays from the top whenever you like.');
    });
    audio.addEventListener('error', showAudioError);
    if (hasFigureStage()) {
      els.figureImg.addEventListener('error', function () {
        // A broken figure never interrupts listening: hide the stage and
        // latch the src so this window doesn't retry it every tick. A
        // different figure cue still gets its own load attempt.
        if (lastFigureSrc) failedFigureSrcs[lastFigureSrc] = true;
        els.figurePanel.hidden = true;
        console.debug('[listen] figure image failed: ' + lastFigureSrc);
      });
    }
    audio.addEventListener('loadedmetadata', function () {
      // Loading a source can reset the media element to 1×. Restore the
      // preference here so the effective rate stays in step with the UI.
      applySpeed(preferredSpeed(), false);
      els.scrubber.max = String(duration());
      els.scrubber.disabled = false;
      els.playPause.disabled = false;
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
      showQuiet('Read-along captions aren’t available for this build.');
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
        console.debug('[listen] dropped ' + timeline.droppedAnchorCount + ' sidecar anchors (blockId drift)');
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
      console.debug('[listen] read-along unavailable:', err);
      showQuiet('Read-along captions couldn’t load — audio still works.');
    });
  }

  /* ── Boot ───────────────────────────────────────────── */
  fetch('books.json')
    .then(function (r) {
      if (!r.ok) throw new Error('catalog ' + r.status);
      return r.json();
    })
    .then(function (catalog) {
      var wanted = new URLSearchParams(location.search).get('book');
      var available = catalog.books.filter(function (b) { return b.audio.status === 'available'; });
      var defaultSlug = typeof core.defaultBookSlug === 'function'
        ? core.defaultBookSlug(catalog)
        : (available[0] && available[0].slug);
      var invalidRequestedBook = wanted && !available.some(function (b) { return b.slug === wanted; });
      book = available.find(function (b) { return b.slug === wanted; }) ||
        available.find(function (b) { return b.slug === defaultSlug; });
      if (!book) {
        // Nothing streamable: hide the player shell, keep the library +
        // Echo CTA so the page still earns its visit.
        room.hidden = true;
        setStatus('', false);
        setEmptyState('No book is streaming right now — the library below has the EPUBs, free.');
        renderLibrary(catalog);
        return;
      }
      room.hidden = false;
      setEmptyState('');
      try {
        var saved = JSON.parse(read('kinnoki-listen-' + book.slug) || 'null');
        if (saved && typeof saved.t === 'number') pendingResumeT = saved.t;
      } catch (e) {}
      renderBook();
      renderSeriesContext(catalog);
      renderSelectedFormats();
      renderChapters();
      renderLibrary(catalog);
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
      if (invalidRequestedBook) {
        setStatus('The requested book isn’t available in the Listening Room.', true);
      } else {
        setStatus('');
      }
    })
    .catch(function (err) {
      console.debug('[listen] catalog failed:', err);
      room.hidden = false;
      setEmptyState('');
      setStatus('The book catalog couldn’t load. Reload to retry.', true);
    });
})();

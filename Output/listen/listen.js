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
    captionText: $('captionText'), status: $('status'), playPause: $('playPause'),
    iconPlay: $('iconPlay'), iconPause: $('iconPause'), back30: $('back30'), fwd30: $('fwd30'),
    speed: $('speed'), scrubber: $('scrubber'), timeNow: $('timeNow'), timeTotal: $('timeTotal'),
    library: $('library'), honesty: $('honesty'),
  };
  var main = document.querySelector('.room-main');

  var audio = new Audio();
  audio.preload = 'metadata';

  var SPEEDS = [1, 1.25, 1.5];
  var book = null;
  var rows = [];
  var blocks = [];
  var wordsByBlockId = new Map();
  var currentBlockId = null;
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

  function renderLibrary(catalog) {
    catalog.books.forEach(function (b) {
      if (book && b.slug === book.slug) return;
      var li = document.createElement('li');
      var title = document.createElement('span');
      title.className = 'room-lib-title';
      title.textContent = b.title;
      var links = document.createElement('span');
      links.className = 'room-lib-links';
      [['EPUB', b.links.epub], ['Read', b.links.read]].forEach(function (pair) {
        var a = document.createElement('a');
        a.href = pair[1];
        a.textContent = pair[0];
        if (pair[0] === 'Read') { a.target = '_blank'; a.rel = 'noopener'; }
        links.appendChild(a);
      });
      li.appendChild(title);
      li.appendChild(links);
      els.library.appendChild(li);
    });
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
      navigator.mediaSession.metadata = new MediaMetadata({
        title: chapter.title,
        artist: book.title,
        album: 'Echo Listening Room — KinNoKi Labs',
        artwork: [{ src: new URL(book.cover, location.href).href, sizes: '480x768', type: 'image/jpeg' }],
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

  function tick(t) {
    updateChapter(t);
    if (!rows.length) return;
    var snapshot = core.resolveSnapshot({
      blocks: blocks, rows: rows, wordsByBlockId: wordsByBlockId,
      time: t, syncPoint: 'midpoint',
    });
    // v1 books are cover-only, so snapshot.imageCue stays null; figure
    // rendering lands with the first figure-bearing catalog entry.
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
    var p = audio.play();
    if (p && p.catch) {
      p.catch(function () {
        setStatus('Playback couldn’t start. Tap play to try again.', true);
      });
    }
  }
  function toggle() { if (audio.paused) play(); else audio.pause(); }

  function seekTo(t) {
    audio.currentTime = Math.min(Math.max(0, t), duration() || t);
    updateScrubber();
    tick(audio.currentTime);
  }
  function seekBy(delta) { seekTo(audio.currentTime + delta); }

  function applySpeed(rate) {
    audio.playbackRate = rate;
    els.speed.textContent = (rate === 1 ? '1' : String(rate)) + '×';
    els.speed.setAttribute('aria-label', 'Playback speed, currently ' + rate + '×');
    store('kinnoki-listen-rate', String(rate));
  }
  function cycleSpeed() {
    var i = SPEEDS.indexOf(audio.playbackRate);
    applySpeed(SPEEDS[(i + 1) % SPEEDS.length]);
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
    audio.addEventListener('loadedmetadata', function () {
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
      book = available.find(function (b) { return b.slug === wanted; }) || available[0];
      if (!book) {
        // Nothing streamable: hide the player shell, keep the library +
        // Echo CTA so the page still earns its visit.
        document.querySelector('.room').hidden = true;
        setStatus('No book is streaming right now — the library below has the EPUBs, free.', false);
        renderLibrary(catalog);
        return;
      }
      try {
        var saved = JSON.parse(read('kinnoki-listen-' + book.slug) || 'null');
        if (saved && typeof saved.t === 'number') pendingResumeT = saved.t;
      } catch (e) {}
      renderBook();
      renderChapters();
      renderLibrary(catalog);
      wireControls();
      applySpeed(parseFloat(read('kinnoki-listen-rate')) || 1);
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
      setStatus('');
    })
    .catch(function (err) {
      console.debug('[listen] catalog failed:', err);
      setStatus('The book catalog couldn’t load. Reload to retry.', true);
    });
})();

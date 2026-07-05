# Echo User Manual

The complete reference for **Echo: Audiobook Study Player** on iPhone, iPad, Apple Watch, Mac, CarPlay, and widgets.

New to Echo? Read [Getting the Most Out of Echo](/echo-learn) first — it explains *why* these features help you learn. This manual explains *how* everything works.

> **Status tags:** 🚧 **Coming in 1.0** = in active development right now. 🔭 **Roadmap** = planned after 1.0. Everything unmarked ships in the current beta.

**Contents:** 1. Getting Started · 2. Organizing Your Library · 3. The Three Tabs · 4. Playback · 5. Smart Rewind · 6. Loop Modes · 7. Sleep Timer · 8. Bookmarks · 9. The Study System · 10. Brain Dump & Book Notes · 11. The Reader: EPUB · 12. Audio–Text Alignment · 13. PDF Companions · 14. Insights · 15. Context Memory · 16. Exports & Your Data · 17. Playlist & Timeline · 18. Apple Watch · 19. Widgets & Control Center · 20. CarPlay · 21. Echo for Mac · 22. Sync & iCloud · 23. Settings · 24. Transcription Tools · 25. Privacy · 26. Troubleshooting & FAQ

## 1. Getting Started

### What Echo plays

Echo is a player for **DRM-free** audiobooks — files you own and can see in the Files app:

- **MP3 / M4A** — including folders of one-file-per-chapter rips
- **M4B** — with full embedded chapter parsing, including books split across multiple M4B files (chapters are aggregated automatically)
- **FLAC, AAC, AIFF, OGG, OPUS, WMA** — on Mac
- **EPUB** — as a synced companion text (see The Reader, section 11)
- **PDF** — as a synced companion document (see PDF Companions, section 13)

Echo does not bypass DRM and cannot play protected Audible/Apple Books titles. Tools like Libation or OpenAudible can export books you own to open formats — see the FAQ (section 26).

### Loading your first book

1. Put the audiobook in a folder — one folder per book is the happy path (section 2 has the full convention). iCloud Drive, "On My iPhone," third-party file providers: all work.
2. In Echo, choose **Load Folder** and select the book's folder.
3. Echo scans the folder, builds the chapter list, finds the cover art (embedded, or a `cover.*` image in the folder), and picks up any EPUB or PDF sitting alongside the audio for automatic import.
4. Press play.

Echo remembers everything per book: position, speed, loop mode, and settings overrides. Reopen the app days later and it resumes exactly where you left off — with Smart Rewind backing up just enough to restore your context.

First launch walks you through this — including a step on setting up your library folder. 🚧 **Coming in 1.0**

### Cover art

Echo looks for artwork in this order: image embedded in the audio file → an image file in the book folder (prefers `cover.*`) → the Echo app icon as fallback. Artwork drives the player background, the watch complication thumbnail, and the dynamic accent color.

## 2. Organizing Your Library

Echo reads your files in place — there's no import-everything step and no hidden copy of your library. A little folder discipline up front pays off every single day.

### The golden rule: one folder per book

```
iCloud Drive/
└── Audiobooks/
    ├── Thinking, Fast and Slow/
    │   ├── Thinking Fast and Slow.m4b
    │   ├── Thinking Fast and Slow.epub   ← auto-imported
    │   └── cover.jpg                     ← optional if art is embedded
    ├── Project Hail Mary/
    │   ├── 01 - Chapter 1.mp3
    │   ├── 02 - Chapter 2.mp3
    │   └── cover.png
    └── Archive/
        └── (finished books)
```

- **One parent folder** ("Audiobooks") holds everything: one place to look, one place to back up, one place to point Echo at.
- **One folder per book**, named by the book title — human-readable ("Project Hail Mary", not "PHM_64kbps_final2").
- **Companion text goes in the same folder.** Drop the `.epub` or `.pdf` next to the audio and Echo's auto-import scanner picks it up. One EPUB per book folder.
- **An Archive subfolder** keeps finished books out of your active view without deleting anything. Export your study notes first (section 16).

### File naming that sorts correctly

- **Zero-pad track numbers:** `01, 02 … 10, 11` — not `1, 2 … 10`. Plain alphabetical sorting puts "10" before "2"; zero-padding fixes it forever.
- **Rename *before* the first load, not after.** Echo tracks progress per file; renaming files mid-book can orphan your position in them.
- **Prefer M4B when you have the choice.** One tidy file with embedded chapters and art. Books split across several M4Bs are fine — Echo aggregates the chapters. Folders of MP3s work well; their "chapters" are the files, named by you.
- **Libation-style fine-grained chapters are handled.** Files named like "Chapter 11. A" / "Chapter 11. B" are automatically grouped into logical chapters with sections.

### iCloud Drive: the rules of the road

> **The single most important setting:** long-press your **Audiobooks** folder in the Files app and choose **Keep Downloaded**. Without it, iOS silently *evicts* audio files to reclaim space — the file looks present with a little cloud icon, but the bytes are gone until re-downloaded. That's the #1 cause of "my book stopped playing mid-commute."

- **Check the cloud icons before you leave Wi-Fi.** A cloud-with-arrow icon means the file isn't on the device.
- **iCloud Drive is the cross-device choice** — the same folder reaches iPhone, iPad, and Mac. "On My iPhone" is the fully-offline choice: always local, never evicted, invisible to other devices.
- **On the Mac,** "Optimize Mac Storage" does the same eviction trick — right-click the folder in Finder and choose **Keep Downloaded** there too.
- **Third-party providers** (Dropbox, Drive, NAS apps) work through the Files app, but many don't background-download smoothly — for daily listening, iCloud Drive or on-device storage is less fussy.
- **Don't move or rename the book's folder casually.** Echo holds a secure reference to the folder you picked; moving it may require re-selecting it. (Your bookmarks and cards survive — they live in Echo's database, not the folder.)

### What lives where

- **Audio, EPUB, PDF files:** your folder, wherever you put it. Echo reads in place and never modifies your files.
- **Bookmarks, flashcards, notes, alignment, progress:** Echo's local database on the device (synced via your personal iCloud — section 22).
- **Playlist order edits:** Echo's database *plus* a small portable manifest file in the book's folder, so ordering travels with the folder.
- **Voice memos & bookmark photos:** Echo's app storage on the device.

## 3. The Three Tabs

- **Now Playing** — the player: artwork, scrubber, transport controls, speed, sleep timer, bookmarks, quick capture.
- **Read** — the synced EPUB/PDF reader: read along, search, align, highlight, bookmark from text.
- **Timeline** — your study feed: chapters, bookmarks, flashcards, notes, and aligned text in one scrollable history, plus the review queue and dashboard modules.

A mini-player bar stays visible on the Timeline tab so transport controls are never more than one tap away.

## 4. Playback

### Transport controls

Five configurable transport buttons. Defaults: skip back, previous chapter, play/pause, next chapter, skip forward.

- **Skip durations** configurable 5–60 s, independently forward/backward, synced to the watch.
- **Long-press secondary actions:** each button can carry a second action on long-press (Settings → Player Controls).
- **Sections:** fine-grained chapter files are grouped into logical chapters; Next/Previous Section jumps the sub-sections; the scrubber shows tick marks and snaps to them with a haptic tap.
- **Mark for a flashcard** (🚧 **Coming in 1.0**) — a one-tap Mark action drops the passage into your Card Inbox without pausing playback.

### Speed control — pitch-corrected

0.5× to 2×+ with true pitch correction. Set a global default; each book remembers its own speed; all displayed times adjust to the current speed, so "20 minutes left" means real minutes.

### Volume boost

Up to +9 dB of clean gain (configurable), independent of system volume.

### Audio behavior

- Playback pauses automatically when headphones disconnect — no broadcasting to the room.
- Calls, alarms, and Siri interruptions pause and resume correctly (no auto-resume if *you* paused first).
- Audio is configured as spoken-word audio system-wide.

## 5. Smart Rewind

Every time you press play after a pause, Echo rewinds first — proportionally to how long you were gone: seconds away → a few seconds back; minutes → more; hours or days → the most. All three tiers are configurable (Settings → Smart Rewind). This is Echo's signature feature. You never scrub backward hunting for the last sentence you remember.

## 6. Loop Modes

- **Loop chapter** — repeat the current chapter until you turn it off. *The feature Echo was built for.*
- **Loop playlist** — repeat the whole book.
- **Loop between bookmarks** — repeat the passage between consecutive bookmarks: fence a key argument and drill it.
- **Off** — straight through.

Loop mode is remembered per book; available on the watch and as a long-press action.

## 7. Sleep Timer

Set a countdown (with fade-out) or stop at chapter end. Echo notes the pause time, so tomorrow's Smart Rewind backs you up over whatever you drifted through. Start, stop, and toggle from the phone or the watch.

## 8. Bookmarks

### Creating bookmarks

- **Phone:** the bookmark button in the player (or a transport long-press).
- **Reader:** long-press any paragraph → **Save Bookmark** (binds to that text *and* its audio moment).
- **Watch:** one (configurable) button; a quick-bookmark timeout confirms or auto-saves.
- **Siri:** dictate a bookmark hands-free — the note arrives transcribed.
- **PDF:** long-press a page → bookmark with a screenshot of that page.

### What a bookmark can hold

- **Title & note** — editable text; titles default to "Bookmark N".
- **Voice memo** — recorded in the moment; volume-normalized to match the narration.
- **Photo** — from your library or camera; drives dynamic artwork (below).
- **Place** (🚧 **Coming in 1.0**) — with Context Memory enabled, an approximate place name shown as a chip.
- **PDF view state** — exact page, zoom, and scroll restore on tap.
- **Enabled/disabled** — disabled bookmarks stay visible but won't trigger inline playback.

### Voice memos that play inline

With *Inline Voice Memos* enabled, playback reaching a bookmark with a memo ducks the narration and plays **your** voice — past-you annotating the book for present-you — then resumes. Toggle globally or per book.

### Photo bookmarks & dynamic artwork

As playback passes a photo bookmark, the player artwork switches to your photo (phone, watch, lock screen) and back to the cover afterward. Why bother? Your brain involuntarily memorizes *where you were* alongside *what you heard* — the photo re-triggers the passage. Full story in [the learning guide](/echo-learn).

> **Safety first:** never take photos while driving. Pick from your library later — or let Context Memory capture the place automatically, hands-free (🚧 **Coming in 1.0**).

### Managing bookmarks

- Bookmarks group under their book, sortable and editable (rename, retime, re-record, swap photo).
- **Loop between bookmarks** uses them as loop fences (section 6).
- **Export to Markdown:** timestamps, notes, and deep links that reopen Echo at the exact second (section 16).
- Every bookmark can be promoted to a **flashcard** in one tap.

## 9. The Study System (Flashcards & Review)

A complete spaced-repetition system — think Anki, built into your audiobook player, with audio on the cards. *(New to spaced repetition? [The learning guide](/echo-learn) explains it from zero.)*

### Creating cards

- **From the reader:** long-press a passage → **Create Flashcard**.
- **From a bookmark:** any bookmark — note, memo, photo and all — becomes a card.
- **From a mark** (🚧) — via the Card Inbox, below.
- **From a note** (🚧) — promote a Brain Dump entry (section 10).
- **From scratch:** in the Timeline tab.
- **Import a deck:** Anki-style JSON today; real .apkg with 1.0 (below).

Every card has a **front** (write it as a question) and a **back**, and can carry an **audio snippet** (the actual narrated clip), a **photo**, a **deck and tags** (🚧), and a **trigger timing** (or manual-review-only).

### The Card Inbox — mark now, card later 🚧 Coming in 1.0

1. **Mark:** one tap on the transport bar (or a watch button) captures the passage you just heard — a few seconds of context either side, with the transcript snippet when the book is aligned. Playback never stops.
2. **Inbox:** marks collect grouped by book, with a badge on the dashboard and Timeline toolbar.
3. **Convert:** tap a mark → a pre-filled card editor (adjust the clip, write the front as a question, pick a deck) — or swipe to dismiss.

When the Card Inbox arrives, the old inline flashcard popups retire — capture stops competing with listening.

### Inline recall during playback

Cards with a trigger timing surface as you listen — a micro-review in context. Cards set to *manual only* never interrupt playback. (With 1.0, new cards default to manual-only and the popup mechanism is retired.)

### Editing cards 🚧 Coming in 1.0

Every card opens in a full editor: front/back, audio snippet range (with "use current position"), deck, tags, enabled toggle, delete-with-confirmation. Reachable from the Timeline, review sessions, and the deck browser.

### Decks & tags 🚧 Coming in 1.0

- **Deck list:** every deck with card count and due count; deckless cards live in an implicit "Unfiled" group.
- **Deck detail:** searchable card list, per-deck mini-stats, rename, delete (cascade cards or orphan them).
- **Review by deck:** run a session over one deck's due cards — exam-week mode.
- **Tags:** space-separated, Anki convention, for cross-deck filtering.

### Importing real Anki decks (.apkg) 🚧 Coming in 1.0

Pick a `.apkg` file from the deck list's import button and Echo maps it card-by-card, **scheduling history included** — mature cards stay mature; nothing restarts from zero.

- First field → front; remaining fields → back (HTML cleaned to text); tags kept; suspended cards arrive disabled; referenced images and audio are copied in.
- **Cloze cards** are flattened to plain question/answer in v1 (the import summary counts how many).
- **Newest Anki format:** Echo will ask you to re-export from Anki with *"Support older Anki versions"* checked — one checkbox, same cards.
- Imported decks aren't tied to any audiobook and review like any other cards.

### Daily Review

- **SM-2 scheduling** (the same family Anki uses): grade a card **Again / Hard / Good / Easy** and its next appearance is computed from your history.
- Cards with audio play their snippet — review with your ears.
- Due count, reviewed-today, and totals show on the Timeline review module; the full picture lives in Insights (section 14, 🚧).
- An optional **daily local notification** reminds you when cards are due. (Local = generated on your device; Echo has no servers.)

### Review on Apple Watch

The full review session runs hands-free on the watch: hear the card, think your answer, tap a grade. Perfect for the walk between mailboxes.

> 🔭 **Roadmap — Chapter Study Mode:** treat each chapter as a flashcard, with due chapters lining up as a ready-made listening queue. Until then: loop the chapter, grade yourself honestly at its end, and card anything you couldn't explain.

## 10. Brain Dump & Book Notes 🚧 Coming in 1.0

Bookmarks pin thoughts to a *moment*; flashcards pin them to a *question*. Book Notes are for everything else — thoughts about the book as a whole, tangents worth keeping, and the "buy stamps" intrusions that would otherwise cost you a chapter.

### Capturing

- **Phone:** the Note button in the Now Playing overflow — a text field, or hold to record a voice memo. Playback continues underneath.
- **Watch:** a *Dictate Note* action on the remote — speak, done; it lands on the current book without the phone leaving your pocket.
- Notes are **untethered** — they belong to the book, not a timestamp (capture position is recorded as silent context).

### The Notes inbox

- Each book has a **Book Notes** view — newest first, text and voice entries together, inline playback for memos, swipe to delete.
- **Promote** any note: → *bookmark* (pinned at its capture position) or → *flashcard* (opens the card editor pre-filled).
- Entry points: a note icon with a count on the book's Timeline toolbar, and a dashboard module when anything's waiting.
- Notes appear in the Timeline feed and join the study-notes export (section 16).

## 11. The Reader: EPUB

Drop the `.epub` in the book's folder (auto-import) or use **Import Document**. Imports are copy-only and validated; paragraphs, headings, images, inline formatting, block quotes, and links are preserved.

- The book renders as a clean feed of cards: chapter headers, paragraphs, images.
- **Follow the narration:** the active paragraph is highlighted and the feed auto-scrolls; scroll away to browse freely, tap to return to the live position.
- **Tap to seek:** tap any paragraph to jump the audio there. Tap images to view full-screen.
- **Search:** full-text search with highlighted matches; tap a result to jump there in text *and* audio.
- **Table of contents** plus a sticky header showing your position as Part → Chapter → Section.
- **Highlights:** long-press → **Change Color** to tint passages.
- **Typography:** font size, line spacing, and card background are adjustable; **Lexend** and **OpenDyslexic** are built in.
- **Reader speed controls** (🚧 **Coming in 1.0**) — adjust playback speed without leaving the Read tab.

While the Read tab is active, the bottom toolbar switches to reader-optimized controls.

## 12. Audio–Text Alignment

### Auto-Align (recommended)

Tap **Auto-Align Chapters** and Echo's on-device speech recognition (WhisperKit on the Neural Engine — *no audio ever leaves your device*) aligns the book in tiers:

- **Tier 0 — Title match:** chapter titles matched to audio file/chapter names for instant coarse anchors.
- **Tier 1 — Chapter snap:** transcribes a short clip at each chapter boundary and fuzzy-matches it, anchoring every chapter start/end.
- **Tier 2 — Drift detection:** spot-checks inside chapters for passages drifting out of sync.
- **Tier 3 — Drift repair:** bisects flagged regions and inserts word-level correction anchors via token-based dynamic time warping.

Between anchors, Echo interpolates positions weighted by paragraph word counts. When alignment completes, Echo shows your **% aligned** (🚧 **Coming in 1.0**).

**Continuous Alignment** (optional, in Settings) keeps refining in the background while you listen.

### Manual anchors

- Long-press a paragraph → **Align to Now** (or **Align to 5s Ago**) to lock it to the playhead.
- Heading cards offer **Align to Chapter Start/End** for bulk anchoring.
- Locked anchors show a green badge; **Erase Anchor** removes one; **Reset Alignment** starts fresh. Recalculation is instant.

## 13. PDF Companion Documents

Import like an EPUB — the Import button accepts both and routes automatically.

- The Read tab renders the PDF with continuous scroll and zoom.
- **Page-level alignment:** long-press a page → the Manual Alignment sheet, with play/pause, ±5 s skips, and a **scrubber joystick** — pull a little for slow precise scrubbing, more for fast travel, with live audio preview.
- **Page bookmarks:** a screenshot thumbnail plus your exact page, zoom, and scroll position — tapping restores the view precisely.

## 14. Insights 🚧 Coming in 1.0

Echo's honest mirror: everything it shows is computed on your device from your own listening and review history. No server ever sees a number. Open it from the dashboard modules or the Timeline toolbar.

- **Overview:** range picker (day / week / month / year / all-time), total listening time, current streak, daily average.
- **Listening:** time per day or week, speed trend, share per book, a time-of-day histogram (find your golden hours), session lengths.
- **Per-book:** a chapter-coverage heatmap — tap a chapter for "Chapter 7 — 86% covered, listened 3×" — plus totals and pace.
- **Study:** reviews per day, a retention curve against a 90% target, grade distribution, and a 30-day due forecast.
- **Planner:** planned-versus-actual session pairs, when you schedule listening.
- **Places:** if Context Memory is on, a simple list of where you listen most. (A map view is on the roadmap.)

The dashboard gets live teaser modules — real listened-today, streak, upcoming reviews. The Mac gets a Stats pane with the Overview, Listening, and Study sections.

## 15. Context Memory (Location) 🚧 Coming in 1.0

Your brain files *where* alongside *what* — Echo can capture the "where" for you. Off by default; opt in via **Settings → Privacy & Location → Context Memory**.

- **Approximate places only:** reduced-accuracy location, neighborhood level — never your doorstep. Stored as a coarse place name like "Maple Ridge, Halifax".
- **Three capture points:** session start, bookmark creation, chapter start. Powers bookmark place chips, "Chapter 3 started at Oak Street" in per-book Insights, and the Places list.
- **Never blocking:** capture is fire-and-forget with a timeout — bookmarks save instantly even in airplane mode, just without a place.
- **Deletable in one tap:** *Delete Location History* permanently erases every captured place.
- **Sync policy:** bookmark places travel with bookmarks through your personal iCloud while the feature is on; your session location history **never** leaves the device. Details in the [privacy policy](/privacy).

## 16. Exports & Your Data

Echo's position on your data: it's yours, in formats you can read, forever. The database schema is open source; nothing is hostage.

- **Bookmarks → Markdown** (available today): a book's bookmarks with timestamps, notes, and deep links that reopen Echo at the exact second.
- **Study Notes bundle** (🚧 **Coming in 1.0**): the whole second brain, per book — one Markdown file (bookmarks, Book Notes, flashcard fronts/backs, chapter headings, place names) plus an assets folder with your voice memos and photos. Obsidian/Logseq/Notion-ready: plain files, relative links, no account. Per book, or bulk-export in Settings.
- **Deck → JSON** (🚧 **Coming in 1.0**): any deck (or all cards) as a portable file with every field including scheduling state; Echo re-imports its own exports losslessly — backup and device-migration in one.
- **Anki .apkg import** (🚧 **Coming in 1.0**): inbound — see section 9. (.apkg *export* is on the roadmap; JSON export covers backup until then.)

## 17. The Playlist & Timeline

### Playlist

- Chapters list in playback order with duration and progress; logical chapters expand to show their sections.
- **Drag to reorder** when filenames sort badly.
- **Tap to dim** a chapter to skip it ("this is the LibriVox disclaimer track") — dimmed chapters are skipped by playback and loops.
- Hierarchical titles render nested structure with indentation.
- Edits persist per book, and a portable manifest file keeps your ordering if you move the folder between devices.

### Timeline

Your study history as a feed: chapters, bookmarks (with photos and memo indicators), flashcards, notes, and aligned text excerpts, in book order. The dashboard modules (due cards, streak, listened today, inbox badges) live here. **Freeze** the timeline while browsing so it stops following playback, then sync-and-resume when ready.

## 18. Apple Watch

### The remote

- **Up to 25 buttons:** five pages of five slots, every slot user-assignable — play/pause, skips (5–60 s), chapters, sections, loop, speed, sleep timer, bookmark, Pomodoro, or empty (empty pages hide).
- **Mark passage** (🚧 **Coming in 1.0**) — one tap into the Card Inbox.
- **Dictate note** (🚧 **Coming in 1.0**) — speak a Brain Dump note; playback never pauses.
- **Design it from the phone:** drag-and-drop the layout in Settings → Watch App; it syncs instantly.
- **Digital Crown:** assign to volume or scrubbing (with a deadzone so a brushed crown doesn't jump your position).
- **Big targets:** buttons sized to hit without looking — gloves, rain, walking.

### On-wrist features

- Now-playing screen with full-screen artwork (or the compact layout), including photo-bookmark artwork switching.
- Bookmarks with voice memos, recorded on the wrist, delivered reliably to the phone.
- Hands-free flashcard review — full Daily Review sessions.
- Pomodoro timer with a fat progress ring and persistent alarm.
- Sleep timer start/stop, speed cycling, loop control.
- A complication with the current book's thumbnail and progress ring.

### Reliability

State syncs via durable application context — the watch picks up the truth the moment it wakes, and stale commands are never replayed. If watch and phone disagree, the watch asks the phone for the authoritative position and converges.

## 19. Widgets & Control Center

- Lock Screen / Home Screen widget: current book thumbnail with a progress ring.
- Play/pause from the widget without opening the app.
- A Control Center toggle-playback control.

## 20. CarPlay

Echo appears in CarPlay with a browse list and transport commands — play, pause, skip. Intentionally minimal for now; richer templates and capture buttons are on the roadmap. No CarPlay in your car? That's what the watch remote and aux cable are for — Echo's whole design assumes the phone stays in your pocket.

## 21. Echo for Mac

- **Three-pane layout:** bookmarks sidebar, player with transport and speed controls, document pane.
- Plays the same folders, with the broadest format support (FLAC/OGG/OPUS).
- **EPUB alignment** with streaming on-device transcription — watch alignment build in real time.
- **Transcript pane** with live highlighting and search; word-cloud visualization of any book's vocabulary.
- Bookmarks share the same format as iOS via the shared app-group store.
- **Insights pane** (🚧 **Coming in 1.0**) — listening and study charts on the big screen.
- **Review pane** (🚧 **Coming in 1.0**) — clear your due cards at the desk, with menu-bar and keyboard-shortcut basics.

Mac 1.0 is the *functional core* — play, read, review, see your stats. Full reader/alignment parity with iOS continues after 1.0.

## 22. Sync & iCloud

Echo has no servers and no accounts — sync rides on *your* iCloud, end to end.

- **Today:** your audio files sync wherever you keep them (e.g., iCloud Drive), and alignment anchors sync through iCloud so a book aligned once stays aligned.
- **Study sync** (🚧 **Coming in 1.0**): flashcards, decks, bookmarks, and playback position sync across iPhone, Mac, and Watch through your personal iCloud (private database). Edit a card on the Mac, review it on the phone, resume the book on either.
- **Sensible conflicts:** scheduling follows your most recent review; content follows your most recent edit.
- **What never syncs:** your session location history (section 15), and anything you haven't opted into.
- Voice memos, brain-dump notes, and planned sessions stay device-local in 1.0; their sync is on the roadmap.

## 23. Settings Reference

- **Playback:** default speed · per-book speed memory · volume boost gain · seek durations (5–60 s)
- **Smart Rewind:** three tiers with per-tier rewind amounts
- **Bookmarks:** inline voice memo playback (global + per book) · quick-bookmark timeout
- **Study:** daily review notification · inline flashcard triggers · deck defaults (🚧)
- **Privacy & Location** (🚧): Context Memory toggle (off by default) · Delete Location History
- **Reader:** font (incl. Lexend, OpenDyslexic) · text size · line spacing · card tint · per-card colors
- **Appearance:** accent color or Artwork mode (accent derived from the cover) · dark mode · app icon · player layout · button sizes
- **Player Controls:** five tap actions + five long-press actions
- **Watch App:** button layout designer (5 pages × 5 slots) · Digital Crown mode · artwork layout · haptics · date overlay · title scroll speed
- **Per-book overrides:** any global setting, pinned per book
- **Data:** study-notes bulk export (🚧) · deck export (🚧)
- **Help:** the full in-app help library
- **Language:** English and Dutch

## 24. Transcription Tools (Power Users)

The Echo repository ships companion CLI tools for generating full transcripts on your Mac:

- **Swift CLI** (WhisperKit): transcribe a file or batch a folder; align an EPUB to produce an enhanced, timestamped transcript.
- **Python CLI** (OpenAI Whisper): same job, GPU-accelerated where available.
- Output includes timestamped segments and word-frequency data (the Mac app renders these as word clouds).

Optional — the iOS app's built-in alignment needs none of this.

## 25. Privacy

- **No accounts. No analytics. No tracking. No ads. No servers.**
- Your books, bookmarks, photos, voice memos, notes, flashcards, and listening history stay on your devices (and your personal iCloud, where you enable sync).
- Speech recognition for alignment runs **entirely on-device**. Audio never leaves your hardware.
- Location (Context Memory, 🚧) is **opt-in, approximate, and deletable** — and session location history never leaves the device. See the [privacy policy](/privacy).
- The app is **open source (GPL-3.0)**: [github.com/dfakkeldy/Echo](https://github.com/dfakkeldy/Echo).

## 26. Troubleshooting & FAQ

**My book won't play / chapters are missing.**
Nine times out of ten this is iCloud eviction: the files show a cloud icon and aren't on the device. Long-press the folder in Files → **Keep Downloaded** (section 2). For multi-file books, confirm the files sort correctly by name — or drag-reorder in the playlist.

**How should I organize my audiobook and EPUB files?**
One parent "Audiobooks" folder; one folder per book; the EPUB or PDF in the same folder as the audio; zero-padded track numbers. iCloud Drive for cross-device, "On My iPhone" for always-local. Section 2 has the full guide.

**Can Echo play my Audible or Apple Books audiobooks?**
Not while they're DRM-locked — Echo plays open formats only and does not bypass DRM. If you want to listen to audiobooks **you've purchased** in Echo, tools exist that export your own library to open formats: [Libation](https://getlibation.com) (free, open source, for Audible libraries) and [OpenAudible](https://openaudible.org) (paid) are the well-known ones. Libation's M4B exports work beautifully with Echo — chapters, art, and all. One honest caveat: the legality of removing DRM from media you own varies by country, even for personal use — check the rules where you live. Echo has no affiliation with these tools, and the best long-term fix is buying DRM-free where possible (Libro.fm and Downpour offer DRM-free titles; LibriVox is free and public-domain).

**Does Echo work fully offline?**
Yes — playback, reading, alignment, flashcards, notes, insights: everything. The only network use is your own iCloud file syncing (and, if you enable Context Memory, Apple's place-name lookup).

**The reader text doesn't match the narration.**
Different editions drift. Run **Auto-Align Chapters**; for stubborn spots, long-press the paragraph you're *hearing* → **Align to Now**. Two or three manual anchors usually tame even a messy book.

**Auto-alignment is slow or my phone runs warm.**
The first run downloads the on-device speech model (~40 MB) and transcription is real Neural Engine work. Plug in for the first full-book alignment of a long book; afterward, repairs are quick.

**Can I import my Anki decks?**
JSON decks import today. Real `.apkg` files — scheduling history included — arrive with 1.0 (🚧). Newest-format decks: re-export from Anki with *"Support older Anki versions"* checked. Cloze cards flatten to plain Q&A in v1.

**Can I get my flashcards and notes back out?**
Yes — that's policy. Bookmarks export to Markdown today; with 1.0, decks export to portable JSON and every book exports a full study-notes bundle for Obsidian/Logseq/Notion (🚧). The schema is open source; your data is never hostage. See section 16.

**Inline flashcards interrupt me too much.**
Set those cards to *manual only*, or disable inline triggers in Settings → Study. This gets better in 1.0: the Card Inbox replaces mid-playback popups entirely (🚧).

**What's the difference between a bookmark, a note, and a flashcard?**
A **bookmark** is a *moment* (timestamp, optionally with memo/photo/place). A **note** (🚧) is an *untethered thought* — the brain-dump. A **flashcard** is a *question* you want to keep answering. Notes and bookmarks both promote into flashcards — capture cheap first, decide later.

**Will my flashcards and bookmarks sync between my devices?**
Alignment anchors sync today; full study sync — cards, decks, bookmarks, playback position — ships in 1.0 through your personal iCloud (🚧). See section 22.

**The watch shows a stale book or position.**
Raise the watch and give it a beat — it requests authoritative state from the phone on wake. Both devices on, nearby, helps.

**Is the location feature tracking me?**
Only if you turn it on — and even then: approximate places, a few capture moments, stored on your device, deletable in one tap, session history never synced. Echo has no servers to send it to. See section 15 and the [privacy policy](/privacy).

**Does Echo use AI? Does anything leave my device?**
On-device machine learning (WhisperKit) for alignment — no cloud APIs, no uploads, ever. No chatbots, no generative features today; if AI-assisted card drafting arrives post-1.0, it will run on-device under the same rules (🔭).

**What's coming after 1.0?**
The honest shortlist: Chapter Study Mode, on-device AI card drafting, focus soundscapes, gentle hyperfocus/transition reminders, a Context Memory map view, FSRS as an alternative scheduler, .apkg export, richer CarPlay, full Mac reader parity. The [roadmap](https://github.com/dfakkeldy/Echo/blob/main/ROADMAP.md) is public, like everything else.

**Where are my files? Can I get my data out?**
Your audio stays where you put it (Echo reads in place and never modifies your files). Echo's own data lives in a local database with an open-source schema; everything exports (section 16). Deleting the app deletes Echo's database — your audio folder is untouched.

---
[Echo](/apps/echo) | [Learning Guide](/echo-learn) | [Focus Field Guide](/echo-focus) | [Join the Beta](/echo-beta) | [Help & Support](/echo-help)

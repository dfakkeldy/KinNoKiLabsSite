# Support & Help for Echo

Thank you for using Echo. The fastest routes to an answer:

- **[User Manual](/echo-manual)** — the complete reference: every feature on iPhone, Apple Watch, Mac, CarPlay, and widgets, plus a library-organization guide.
- **[Getting the Most Out of Echo](/echo-learn)** — how to use the study features, and the memory science behind them.
- **[The Focus Field Guide](/echo-focus)** — ADHD & AuDHD strategies for getting started, staying organized, and staying motivated.
- **[Beta Guide](/echo-beta)** — TestFlight setup, feedback how-to, and structured test plans.
- **[Devlog](/echo-devlog)** — what's being built, week by week.

> Echo is in open development toward 1.0. Features marked 🚧 **Coming in 1.0** below are in active development and described in full in the [manual](/echo-manual).

## Frequently Asked Questions

### My book won't play / chapters are missing.
Check the files exist locally: in the Files app, long-press your audiobook folder and choose **Keep Downloaded** so iCloud can't evict the audio. For multi-file books, confirm the files sort correctly by name — you can also drag-reorder in the playlist.

### How should I organize my audiobook and EPUB files?
One parent "Audiobooks" folder; inside it, one folder per book named by title; the EPUB or PDF dropped in the same folder as the audio (it auto-imports); zero-padded track numbers (01, 02…). The [manual](/echo-manual) has the full convention, including the iCloud pitfalls.

### The reader text doesn't match the narration.
Different editions drift. Run **Auto-Align Chapters** first; for stubborn spots, long-press the paragraph you're *hearing* and tap **Align to Now**. Two or three manual anchors usually tame even a messy book.

### Auto-alignment is slow or my phone runs warm.
The first run downloads the on-device speech model (~40 MB) and transcription is real work for the Neural Engine. Plug in for the first full-book alignment of a long book; afterwards, incremental repairs are quick.

### The watch shows a stale book or position.
Raise the watch and give it a beat — it requests authoritative state from the phone on wake. Keeping both devices on and nearby (Bluetooth/Wi-Fi) helps.

### Inline flashcards interrupt me too much.
Set those cards to *manual only*, or disable inline triggers in Settings → Study. Your reviews then live only in Daily Review. (This gets better in 1.0: a one-tap Card Inbox replaces mid-playback popups entirely. 🚧)

### Can I import my Anki decks?
Anki-style JSON decks import today. Real .apkg files — scheduling history included — arrive with Echo 1.0 (🚧). Details and format notes are in the [manual](/echo-manual).

### Can it play my Audible books?
Not while they're DRM-locked. Echo plays open formats only (MP3, M4A, M4B and friends) and does not bypass DRM. Tools like Libation or OpenAudible can export books you own to open formats — see the [manual's FAQ](/echo-manual) for details, including a note on checking the legality in your country.

### Does Echo track my location?
Context Memory is optional and off by default. With permission, the device can provide a precise fix; Echo rounds coordinates before asking Apple's geocoder for a place name and stores the resulting context locally. Delete Context Memory removes the app's local context records, not providers' records or backups. See the [Echo Privacy Policy](/echo-privacy/).

### Will my flashcards and bookmarks sync between devices?
This release does not promise complete private synchronization of flashcards, decks, bookmarks or playback position. Files in an iCloud folder follow Apple's file services, and Watch features transfer selected state and voice memos with the paired iPhone. Importing a book may look up matching public alignment anchors when network access is permitted, with local fallback for an ordinary lookup failure. This release does not expose public-alignment uploads. See the [Echo Privacy Policy](/echo-privacy/).

### Does Echo work offline?
Local playback, reading, narration and alignment can work with the required files and models already present. Model downloads, optional community-alignment lookup, website capture, external AI and Audiobookshelf use a network connection. External AI sends book text to the configured provider. This release does not expose public-alignment uploads. See the [Echo Privacy Policy](/echo-privacy/).

### Where is my data? Can I get it out?
Your audio stays where you put it (Echo reads in place). Echo's own data lives in a local database on your device with an open-source schema. Bookmarks export to Markdown today; with 1.0, decks export to portable JSON and whole books export as Markdown study bundles for Obsidian, Logseq, or Notion (🚧). Your data is never hostage.

### What's coming after 1.0?
Chapter Study Mode, on-device AI card drafting, focus soundscapes, gentle hyperfocus reminders, a Context Memory map view, FSRS scheduling, .apkg export, richer CarPlay, and full Mac reader parity. The [roadmap](https://github.com/dfakkeldy/Echo/blob/main/ROADMAP.md) is public.

## Contact

Stuck, found a bug, or want a feature? Email or open an issue.

- **Email Support:** [hello@kinnokilabs.com](mailto:hello@kinnokilabs.com)
- **Issue Tracker:** [GitHub Issues](https://github.com/dfakkeldy/Echo/issues)

I try to answer within 24–48 hours.

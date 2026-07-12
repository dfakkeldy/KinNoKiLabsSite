# KinNoKi Games Home Design

**Date:** 2026-07-12  
**Status:** Approved in conversation; awaiting written-spec review  
**Public destination:** `https://kinnokilabs.com/games`

## Objective

Create a polished, replayable KinNoKi Labs games home with three fully playable
puzzle games: Sudoku, Crossword, and Word Search. Each game offers Easy,
Medium, and Hard difficulty, generates unlimited new puzzles, works without an
account, and keeps progress and statistics on the player's device.

The feature must feel native to the existing KinNoKi Labs site. It will use the
site's established dark metal-and-gold visual system, shared navigation,
OpenDyslexic option, responsive behavior, and accessibility standards.

## Scope

The first release includes:

- An Arcade Hall landing page at `/games`.
- A dedicated game page at each of:
  - `/games/sudoku`
  - `/games/crossword`
  - `/games/word-search`
- Unlimited seeded puzzle generation for all three games.
- Easy, Medium, and Hard difficulty for every game.
- Automatic save and resume for unfinished games.
- Device-local completion counts, best times, and streaks.
- Optional hints and mistake checking.
- Keyboard, touch, pointer, and screen-reader support.
- Automated tests for puzzle engines and local game state.

The first release does not include accounts, cloud sync, global leaderboards,
advertising, analytics, social sharing, multiplayer, or a backend service.

## Information Architecture

### Arcade Hall

`/games` uses the selected **Arcade Hall** direction. The first viewport gives
Sudoku, Crossword, and Word Search equal visual weight. Each card provides:

- A recognizable, text-supported game motif.
- A one-sentence description.
- Easy, Medium, and Hard entry points.
- A Continue action when that game has an unfinished puzzle.
- A compact local summary such as completed games or best time.

A small stats area shows the player's current completion streak, total games
completed, and per-game best times. The page also includes an accessible reset
control for all locally stored game data.

### Game pages

Each game page contains:

- The shared KinNoKi site header and footer.
- A breadcrumb or clear return action to Games.
- Game title, selected difficulty, timer, and assisted-run state.
- The playable board and controls.
- New Game, Restart, Undo where applicable, Hint, and Check controls.
- A completion panel with elapsed time, assistance status, and Play Another.
- A compact explanation of the game's controls and difficulty rules.

Changing difficulty starts a new puzzle only after confirmation when the
current puzzle has progress.

## Visual Design

The games surface extends the existing KinNoKi design rather than introducing
a separate sub-brand:

- Black and deep graphite backgrounds.
- Metallic gold for primary actions, selected cells, and progress accents.
- Lexend as the default typeface and the existing OpenDyslexic preference as an
  alternative.
- Rounded, high-contrast panels with restrained glow and motion.
- CSS shapes, typography, and board patterns instead of decorative stock art.
- Motion that respects `prefers-reduced-motion`.

Game boards prioritize legibility over decoration. Selected cells, related
cells, errors, clues, and found words must remain distinguishable without
depending on colour alone.

## Puzzle Engines

All puzzle engines run in the browser. Each puzzle has a deterministic seed.
The saved seed and player state reconstruct the exact board after refresh or
return. New Game selects a different seed and will not immediately repeat the
previous puzzle.

### Sudoku

Sudoku uses standard 9-by-9 boards. The generator creates a valid solved grid,
removes cells while preserving a unique solution, and evaluates the resulting
puzzle using a logical solver. Difficulty is based on solver techniques as well
as clue count.

- **Easy:** generous clues and singles-based solving.
- **Medium:** fewer clues and intermediate candidate elimination.
- **Hard:** fewer clues and at least one advanced logical step; no guessing is
  required by the generated puzzle contract.

Controls include number entry, erase, pencil marks, undo, selected-number
highlighting, optional live mistake checking, and a one-cell hint. Given cells
cannot be edited.

### Crossword

Crossword uses compact American-style interlocking grids populated from a
curated clue-and-answer bank. The bank combines family-friendly general
knowledge with Canadian and Cape Breton places, culture, nature, and language.
Every public clue must be factually supportable and avoid private or sensitive
business knowledge.

The seeded generator uses bounded backtracking to create a connected grid in
which every answer crosses another answer. It rejects duplicate answers,
unkeyed cells, disconnected groups, and invalid clue numbering.

- **Easy:** smaller grids, shorter common answers, and direct clues.
- **Medium:** medium grids, broader vocabulary, and moderately indirect clues.
- **Hard:** larger or denser grids, longer answers, and more indirect clues.

Players can select a cell or clue, move between Across and Down, type answers,
erase, check the current entry or full puzzle, and reveal one letter. Generator
attempts are time-bounded. If a seed cannot produce a valid grid, generation
continues with a derived seed and ultimately uses a bundled known-valid puzzle.

### Word Search

Word Search builds each puzzle from a themed list drawn from the same
family-friendly general, Canadian, and Cape Breton mix.

- **Easy:** small grid; horizontal and vertical words; shorter list.
- **Medium:** medium grid; diagonals and overlap; longer list.
- **Hard:** large grid; reverse directions, dense overlap, and longer words.

Players select words by pointer drag, touch drag, or keyboard endpoints. Found
words remain visibly marked in both the grid and word list. The filler pass must
not create untracked occurrences of listed words where practical; any remaining
duplicate occurrence is accepted as a valid selection for that word.

## Assistance and Records

Hints, reveals, and mistake checking are optional. The first use of an assist
marks the current run as assisted. Assisted games still count as completions
and streak activity, but they do not set or replace best-time records. The UI
shows this rule before the player invokes an assist and keeps the assisted state
visible afterward.

## Local State and Privacy

State is stored in a versioned, KinNoKi-namespaced browser-storage record. It
contains only:

- Current puzzle seed, difficulty, board state, elapsed time, and assistance
  state for each game.
- Completion counts and most recent completion date.
- Current streak and per-game best unassisted times by difficulty.
- The immediately previous seed for repeat avoidance.

No game data is sent to KinNoKi Labs or another service. A Reset Game Data
control explains what will be deleted and requires confirmation. Invalid or
outdated stored data is migrated when safe or discarded without preventing the
games from loading.

The timer uses monotonic elapsed play time. It pauses while the document is
hidden and resumes on return, so background time is not counted.

## Accessibility and Input

- All interactive controls use semantic buttons, inputs, and landmarks.
- Every control has a visible label or accessible name.
- Keyboard focus is always visible.
- Touch targets are at least 44 by 44 CSS pixels where controls permit.
- Status changes use a polite live region.
- Errors, selection, completion, and found words use text, shape, border, or
  icon differences in addition to colour.
- Boards have concise screen-reader instructions and expose meaningful cell,
  clue, row, column, and state labels.
- Sudoku supports number keys, erase keys, arrows, and pencil-mode shortcuts.
- Crossword supports character entry, arrows, clue selection, and switching
  between Across and Down.
- Word Search supports keyboard selection of a start and end cell.
- Layout supports phone and desktop widths, zoom, and large text without
  clipped controls or horizontal page scrolling.

## Technical Integration

The games are part of the existing Swift Publish site and deploy with its
normal Cloudflare Pages flow. Source content and theme routing create the four
public paths. Game-specific CSS and JavaScript live under `Resources/` and are
copied by Publish; generated `Output/` files are never edited by hand.

Puzzle logic is separated from DOM rendering so the generators, validators,
state migrations, statistics, and timing rules can be tested with Node's test
runner. The view layer selects the appropriate game from page metadata and
wires semantic controls to the pure game engine.

The global navigation gains a Games entry in desktop and mobile menus. The
Games item is marked current on all four games routes.

## Error Handling

- Generation uses bounded attempts and never blocks the page indefinitely.
- Crossword generation derives new seeds before falling back to a bundled
  known-valid puzzle.
- Sudoku generation rejects puzzles without exactly one solution or outside
  the selected difficulty contract.
- Word Search generation retries placement before deriving a new seed.
- Corrupt saved state is isolated to the affected game and replaced with a new
  puzzle; other game statistics remain intact.
- Storage write failures leave the current session playable and show one quiet,
  non-blocking notice that progress may not persist.

## Verification

Automated tests cover:

- Seeded repeatability and new-seed variation.
- Sudoku solution validity, uniqueness, and difficulty classification.
- Crossword connectivity, crossing consistency, answer/clue integrity, and
  fallback behavior.
- Word Search placement, selection in every allowed direction, and difficulty
  constraints.
- Save, restore, migration, reset, and corrupt-state recovery.
- Timer pause and resume behavior.
- Completion statistics, streaks, and assisted-run best-time exclusion.

Release verification includes:

- The repository's normal Swift build and site-generation checks.
- Node tests for game logic.
- Guard checks confirming `Output/` was generated rather than hand-edited.
- Keyboard-only playthroughs for all three games.
- Screen-reader-oriented semantic inspection and live-region checks.
- Phone and desktop layout checks, including large text and reduced motion.
- Link and route checks for all four games pages and shared navigation.
- Live verification of `https://kinnokilabs.com/games` after deployment.

## Success Criteria

The feature is complete when a visitor can open `kinnokilabs.com/games`, choose
any game and difficulty, complete a valid fresh puzzle using touch or keyboard,
resume an interrupted puzzle, see accurate local statistics, understand when a
run is assisted, and start another non-repeating puzzle. All automated checks
pass, the generated site deploys successfully, and the four games routes work
on the live domain.

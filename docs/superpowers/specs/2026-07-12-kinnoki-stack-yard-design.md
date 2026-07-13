# Kinnoki Stack and Kinnoki Yard Design

**Date:** 2026-07-12  
**Status:** Approved in conversation; awaiting written-spec review  
**Public destinations:** `https://kinnokilabs.com/games/kinnoki-stack` and
`https://kinnokilabs.com/games/kinnoki-yard`

## Objective

Add two original cargo-themed block games to the existing KinNoKi Arcade Hall:

- **Kinnoki Stack**, a fast real-time game built around falling cargo, Cargo
  Manifests, and forecasted tide shifts.
- **Kinnoki Yard**, a calm turn-based game with guaranteed-solvable Puzzle
  Contracts and an Endless Yard score mode.

Both games must offer Easy, Medium, and Hard difficulty, unlimited replay,
device-local save and records, adaptive original music, keyboard and touch
controls, and accessible alternatives to precision dragging or fast automatic
play. They must extend the existing browser-native Arcade Hall without adding
accounts, a backend, analytics, advertising, or third-party runtime
dependencies.

## Product and Naming Boundaries

The user-approved game titles are **Kinnoki Stack** and **Kinnoki Yard**. This
game-title spelling does not ratify a site-wide change from the current public
studio casing, **KinNoKi Labs**.

These games are an original KinNoKi cargo-game family, not Tetris products or
Tetris clones. The public pages, metadata, code, controls, music, sound effects,
piece catalogue, board presentation, terminology, and marketing must not use:

- The `Tetris` name, logos, music, sound effects, or branded terminology.
- The standard seven four-cell pieces as the complete or defining piece set.
- A copied Tetris board presentation, colour mapping, scoring model, or trade
  dress.
- Language that implies endorsement, compatibility, or licensing by The Tetris
  Company.

The games instead use custom cargo clusters containing two through five cells,
manifest-zone dispatching, tide movement, packing contracts, original scoring,
and KinNoKi's established metal-and-gold visual system.

## Scope

The release includes:

- Arcade Hall cards and dedicated pages at:
  - `/games/kinnoki-stack`
  - `/games/kinnoki-yard`
- Easy, Medium, and Hard difficulty for both games.
- Seeded, deterministic cargo sequences and puzzle generation.
- Automatic save and resume.
- Device-local records and statistics.
- Kinnoki Stack real-time play and an assisted Step Mode.
- Kinnoki Yard Puzzle Contracts and Endless Yard modes.
- An adaptive original soundtrack plus sound effects.
- Separate locally saved music and effects controls.
- Keyboard, touch, pointer, reduced-motion, OpenDyslexic, and screen-reader
  support appropriate to each game.
- Automated engine, controller, accessibility, audio, migration, and generated
  route tests.

The release does not include:

- The Tetris name, assets, rules presentation, licence, or trade dress.
- Accounts, cloud sync, online leaderboards, multiplayer, anti-cheat, ads, or
  analytics.
- User-uploaded levels, a level editor, paid content, or downloadable music.
- New third-party JavaScript or audio dependencies.
- A global change to the KinNoKi Labs brand casing.

## Information Architecture

### Arcade Hall

The Arcade Hall expands from three to five game cards. Kinnoki Stack and
Kinnoki Yard use the existing card system for description, difficulty entry,
Continue state, and local records.

Kinnoki Stack's card emphasizes arcade score and tide pressure. Kinnoki Yard's
card first asks the player to choose Puzzle Contracts or Endless Yard, then a
difficulty. An unfinished Yard run retains its mode in the Continue label.

The shared totals and streak surface remains. A Stack or Endless Yard run counts
when its terminal summary is reached. A Puzzle Contract counts when the target
is completely packed. Abandoned and replaced runs do not increment totals or
streaks. Assisted completed runs still count but cannot replace unassisted
records.

The existing hub and public metadata must stop describing the surface as three
games or three classics. The Games page content, rendered hub copy, card count,
Open Graph description, and social artwork are updated to represent all five
games. The replacement social card is original KinNoKi artwork and becomes the
shared games image unless a new-game page later receives a more specific card.

### Kinnoki Stack Page

The page contains:

- Return navigation to Games.
- Difficulty, score, elapsed active time, high score, and assisted state.
- The dock grid with a visible crane line.
- Current Cargo Manifest, next-cargo preview, and tide forecast.
- Keyboard help and large touch controls.
- Start or Continue, Describe Dock, Pause or Resume, Restart, New Run, Music,
  Effects, and Step Mode controls.
- A terminal summary with score, dispatched manifests, best combo, elapsed
  active time, assistance state, and Play Again.

### Kinnoki Yard Page

The page contains:

- Return navigation to Games.
- A mode selector for Puzzle Contracts and Endless Yard.
- Difficulty, elapsed active time, moves or score, record, and assisted state.
- The yard grid, cargo tray, active manifest or contract outline, and rotation
  controls.
- Start or Continue, Undo, Restart, New Puzzle or New Yard, Music, and Effects
  controls. Hint appears only in Puzzle Contracts.
- A terminal summary appropriate to the selected mode.

Changing mode or difficulty while progress exists requires confirmation. A
declined replacement keeps the current run and its exact mode and difficulty.

Both routes begin in an explicit pre-play state. The controller may load or
generate the definition and render a non-interactive preview, but gravity,
active timing, input listeners, and audio scheduling do not start until the
player presses the in-page Start or Continue button. Pause returns to an inert
state with an explicit Resume button. Start, Continue, and Resume are the user
gestures that initialize or resume Web Audio.

## Shared Cargo Geometry

A shared pure geometry module owns:

- The original two-to-five-cell cargo-cluster catalogue.
- Normalized rotations and duplicate-rotation removal.
- Bounds, collision, placement, and active or tray-piece identity.
- Manifest-zone definitions and completion checks.
- Serialization and validation of cargo state.

The module contains no DOM, timer, storage, or audio behavior. Stack and Yard
consume its public geometry operations without reaching into each other's game
state.

Every visual cargo type also has a text label and stable pattern. Colour can
support recognition but cannot be the only distinguishing signal.

## Kinnoki Stack

### Core Loop

Kinnoki Stack is an endless real-time score game on a 12-column by 18-row
visible dock. A seeded cargo stream produces original clusters of two through
five cells. The player moves and rotates the active cluster as it descends.

One or more outlined Cargo Manifest zones appear inside the dock. Filling every
cell in a manifest dispatches only the occupied cells inside that zone, opens
space, adds score, and advances the manifest sequence. Cargo outside the zone
remains even when it arrived as part of the same falling cluster. The engine
recomputes settled connected components after every lock, dispatch, and tide.
Clearing manifests on consecutive placements builds a combo multiplier.
Ordinary full horizontal rows have no special meaning. Active manifest zones
never overlap and a newly selected zone is never already complete.

### Resolution, Scoring, and Top-Out

Each locked cluster resolves in this exact order:

1. Add placement score equal to `10 x newly locked cargo cells`.
2. Apply the scheduled tide, when one is due. The tide awards no points itself.
3. Find every active manifest complete on the post-tide board.
4. If at least one is complete, increment the combo once for this lock and add
   `100 x total dispatched manifest cells x combo`. Multiple completed,
   non-overlapping manifests dispatch simultaneously and share that multiplier.
   If none is complete, reset the combo to zero.
5. Remove only cells inside completed manifest zones, recompute connected
   components, and choose deterministic replacement manifests that are not
   already complete.
6. Apply the crane-line and spawn checks.

Scores are non-negative safe integers and saturate at
`Number.MAX_SAFE_INTEGER`. A tide can enable a scored dispatch through the
normal post-tide manifest check, but it has no separate bonus.

The crane line is the boundary below rows 0 and 1. Active falling cargo may
pass through those two spawn rows. After tide and dispatch resolution, the run
ends if any settled cell remains in row 0 or 1. This ordering permits a lock
that completes a manifest to clear dangerous cells before top-out.

When the board survives, the next cluster uses rotation zero, places its
topmost cell in row 0, and horizontally centres its normalized bounding box
with `floor((12 - width) / 2)` as the left column. An overlap at that spawn
position ends the run immediately. The terminal state is immutable: later
ticks, inputs, audio callbacks, or duplicate events cannot change the score or
record another completion.

### Tide Shifts

Medium and Hard introduce deterministic one-column tide shifts. The interface
announces the direction and remaining placements before the tide arrives.

At a tide event, the engine recomputes orthogonally connected components from
the settled cells. For a rightward tide, components are processed from the
rightmost occupied column to the leftmost; a leftward tide reverses that order.
Each component attempts to move one column as a rigid unit against the board as
already updated by earlier downstream components. It moves only when every
destination cell is inside the dock and empty or belongs to that component.
Blocked components remain in place. A tide can never delete cargo, overlap two
cells, move cargo vertically, or make the board invalid.

Tides do not affect the currently falling cluster. The previewed direction and
event count are part of the saved deterministic state.

### Difficulty

- **Easy:** slow fall interval, generous lock delay, three-cargo preview, one
  large rectangular manifest, no tides, and the simpler cargo subset.
- **Medium:** moderate fall interval, two-cargo preview, mixed rectangular and
  stepped manifests, the full cargo catalogue, and forecasted tides after a
  moderate number of locked clusters.
- **Hard:** faster fall interval, one-cargo preview, tighter and irregular
  manifests, the full cargo catalogue, more frequent tides, and shorter but
  always visible tide warnings.

Exact timing constants will be calibrated during browser testing, but their
ordering is contractual: Easy is always slower and more forgiving than Medium,
and Medium is always slower and more forgiving than Hard.

### Controls and Assistance

Keyboard controls provide move left, move right, rotate, soft drop, hard drop,
and pause. Touch controls use persistent buttons at least 44 by 44 CSS pixels;
swipes may be offered as a convenience but are never required.

Step Mode pauses automatic falling and advances the game only when the player
requests the next step. Enabling it permanently marks that run assisted. Step
Mode runs still count as completions and retain their score in the terminal
summary, but they cannot set or replace unassisted high scores or combo records.

In automatic play, the first blocked gravity step starts the difficulty's lock
delay. A successful horizontal move or rotation clears that grounded state only
when the cluster can descend afterward; a transformation that remains blocked
does not restart the delay. Lock-delay expiry locks exactly once. Pause freezes
the remaining delay, and Hard Drop locks immediately.

Step Mode disables automatic gravity and wall-clock lock delay. Advance moves
the cluster down one row when possible. The first blocked Advance marks it
grounded; the next blocked Advance with no intervening change that opens a
downward cell locks it. A successful move or rotation that opens a downward
cell clears grounded state. Hard Drop still locks immediately. Horizontal move
and rotation never advance gravity by themselves.

### Records

Kinnoki Stack stores, by difficulty:

- Highest unassisted score.
- Highest unassisted manifest combo.
- Completed run count.

It also retains the current run, seed, cargo sequence position, tide schedule,
board, falling cluster, score, combo, elapsed active time, and assisted state.

## Kinnoki Yard

### Puzzle Contracts

A Puzzle Contract presents a connected yard outline and a fixed tray of cargo
clusters that must pack the outline exactly without overlap or unused target
cells. Pieces can be selected and placed without dragging. Rotation availability
is stated per piece and included in the puzzle definition.

The generator constructs the target from a known valid packing, shuffles the
tray and allowed orientations, then validates that at least one complete
solution remains. Multiple valid packings are acceptable; the contract is
guaranteed solvable rather than guaranteed unique.

Difficulty controls target size, piece count, packing tightness, and rotation
freedom:

- **Easy:** compact targets, four to six simple pieces, generous open shapes,
  and rotation allowed for every rotatable piece.
- **Medium:** larger targets, seven to ten mixed pieces, concave boundaries,
  and selected orientation restrictions.
- **Hard:** large targets, ten to fourteen mixed pieces, tight internal spaces,
  and more fixed-orientation cargo while preserving at least one validated
  solution.

Contracts track elapsed active time and moves. Undo does not mark assistance.
A Hint identifies a piece and valid next placement, marks the run assisted, and
prevents it from replacing unassisted time or move records.

A move is one successful cargo manipulation: rotating a selected piece,
committing a new placement, repositioning a placed piece, or applying Undo.
Selection, panning, opening help, changing audio, and rejected invalid actions
do not count. Undo restores board state but increments rather than rewinds the
move counter, so a completed fewest-moves record represents the actual path the
player took.

Hint runs the solver from the player's current partial packing. When a
completion remains possible, it identifies one exact piece, orientation, and
placement that belongs to a solution from that state. When the current packing
has no completion, Hint does not invent a move; it announces that the player
must Undo to the most recent solver-completable snapshot or Restart. Requesting
Hint marks the run assisted in either case.

### Endless Yard

Endless Yard is untimed and turn-based. The player receives a deterministic
batch of three cargo clusters, places them in any order, and receives a new
batch after all three are placed. Active manifest zones dispatch when every
cell in a zone is occupied. Active zones never overlap and replacements are
never already complete. Ordinary complete rows or columns do not clear.

Each successful placement adds `10 x placed cargo cells`. The engine then
finds all completed manifests. When at least one completes, the combo increments
once for that placement and the engine adds
`100 x total dispatched manifest cells x combo`; multiple completed manifests
dispatch simultaneously with the same multiplier. A placement with no dispatch
resets the combo to zero. Selection, rotation, a rejected placement, receiving
a batch, and terminal detection award no points. Scores are non-negative safe
integers and saturate at `Number.MAX_SAFE_INTEGER`.

The run ends only when none of the remaining tray pieces has any valid
placement. The engine must test every allowed rotation before declaring the
terminal state.

Undo is available in Endless Yard but marks the run assisted on first use. It
restores the complete pre-placement snapshot, including board, tray, manifest,
score, combo, and seeded sequence position, so the same placement cannot be
replayed for duplicate points. Endless Yard has no Hint action. Puzzle Contract
Undo retains its separate unassisted, move-counting behavior.

Difficulty changes available space and pressure:

- **Easy:** 10-by-10 yard, simpler cargo subset, full rotation, and one large
  manifest zone.
- **Medium:** 9-by-9 yard, full cargo catalogue, selected rotation limits, and
  mixed manifest shapes.
- **Hard:** 8-by-8 yard, full cargo catalogue, tighter rotation limits, and
  smaller or irregular manifests that require more deliberate packing.

Endless Yard stores highest unassisted score and dispatch combo by difficulty,
plus completed run count. Puzzle Contracts store best unassisted time and fewest
unassisted moves by difficulty, plus completed contract count.

## Visual and Interaction Design

The two games share the existing Arcade Hall's black, graphite, metallic-gold,
Lexend, and OpenDyslexic system. They form a related cargo-game family without
becoming a separate site or imitating another game's trade dress.

Kinnoki Stack is visually energetic but readable: the crane line, manifest
outlines, tide forecast, falling cargo, settled cargo, and assisted state remain
distinct without relying on colour. Kinnoki Yard is calmer, with generous
spacing and a clear separation between target, tray, placed cargo, and active
selection.

Both boards use semantic DOM elements rather than a canvas-only interface. CSS
transforms may animate presentation, but the authoritative state remains in the
DOM. Their focus models differ intentionally:

- Stack's 216 dock cells are non-tabbable `gridcell` status elements. The
  labelled board is not a field of 216 buttons; movement happens through the
  dedicated keyboard and touch controls.
- Yard uses native cell buttons with one roving tab stop and arrow-key movement,
  preventing the board from adding every cell to the page's Tab order.

Kinnoki Yard supports click-select-place and keyboard-select-place as primary
interactions. Dragging is optional. Focus remains on a meaningful piece or cell
after rotation, placement, undo, rerender, completion, or error recovery.
Large Yard boards live inside a board-local scrolling surface with labelled pan
controls, so interactive cells retain 44-pixel targets without causing
page-level horizontal overflow on phones or at browser zoom.

## Accessibility

- Every action has a visible label or accessible name.
- Touch targets are at least 44 by 44 CSS pixels where controls permit.
- Keyboard focus is always visible and is never trapped inside a board.
- Live-region announcements are event-scoped and rate-limited. Automatic
  gravity ticks are silent. Stack announces dispatch, meaningful tide warnings,
  tide shift, pause or resume, explicit invalid input, error, and terminal state.
  Step Mode may announce one concise position update per explicit player action.
- Cargo types, manifests, selection, tide direction, errors, and completion use
  text, pattern, border, or shape differences in addition to colour.
- OpenDyslexic, dark/light appearance, large text, and reduced motion continue
  to work on both pages.
- Hidden documents pause automatic play, timing, animation, music, and effects.
- Kinnoki Stack exposes current cluster position, orientation, manifest state,
  stack height, score, and tide forecast through the on-demand Describe Dock
  control and a concise status summary. Describe Dock never changes play state.
- Step Mode provides a non-real-time alternative for players who cannot use a
  fast automatic loop. Its assisted-record rule is explained before activation.
- Kinnoki Yard never requires precision dragging or fast input.
- Completion moves focus to the terminal heading; returning to play puts focus
  on the first meaningful game control.

Reduced motion changes visual animation only. It does not silently mute audio;
music and effects have their own controls.

## Adaptive Music and Sound

Music is a required feature, not a decorative follow-up. A shared audio module
uses the Web Audio API to synthesize an original KinNoKi motif and sound effects
without downloading third-party music or adding runtime dependencies.

### Musical Direction

- **Kinnoki Yard:** a warm, spacious harbour-synth arrangement at an unhurried
  tempo. Contract completion and manifest dispatch add short resolved cadences.
- **Kinnoki Stack:** the same motif in a faster arcade arrangement. Percussion,
  bass, and harmony layers enter as stack height or tide pressure rises, then
  recede after a dispatch.

The music must not quote or imitate the Tetris theme or another recognizable
game soundtrack.

### Audio Behavior

- The initial preference is music enabled at normalized volume `0.35` and
  effects enabled at normalized volume `0.50`. Stored volume values are finite
  numbers clamped to the inclusive `0...1` range.
- Audio starts or resumes only after the player deliberately presses Start,
  Continue, or Resume, satisfying browser gesture requirements and avoiding
  page-load autoplay.
- Music and effects have separate mute controls and volume values.
- Preferences are saved locally and shared by all Arcade Hall games that adopt
  the audio module.
- Pausing, hiding the document, completing a run, replacing a game, or disposing
  a controller suspends or stops scheduled audio without leaks.
- Resuming never plays a backlog of notes or effects.
- If Web Audio is missing, denied, suspended, or throws, the game stays fully
  playable in silence and shows at most one quiet non-blocking notice.

Sound effects cover movement, rotation, placement, dispatch, tide warning,
tide shift, invalid placement, completion, and terminal failure. Repeated rapid
inputs are rate-limited so effects do not become painfully loud or overlap
without bounds.

## Local State, Migration, and Privacy

The current `kinnoki-games:v1` browser record migrates to
`kinnoki-games:v2`. On first load, the new code reads and sanitizes v1 only when
v2 is absent, writes the migrated v2 record, then removes v1 only after that
write succeeds. A failed v2 write leaves v1 intact for a later retry while the
current page continues with an in-memory migrated store. The migration must
preserve every valid existing Sudoku, Crossword, and Word Search run,
statistic, best time, streak, and completion total. The site-wide
`kinnoki-theme` and `kinnoki-dyslexic` preferences are separate from the game
record and remain untouched by migration and Reset Game Data.

The new state adds:

- Kinnoki Stack run state and difficulty-specific records.
- Kinnoki Yard mode-specific run state and records.
- Music enabled, music volume, effects enabled, and effects volume.
- Seeds and previous signatures needed to prevent immediate repeats.

Migration is idempotent: loading already-migrated data does not change it, and
running the migration twice cannot double statistics. Each new run validator
rejects impossible geometry, overlapping cargo, out-of-range scores, forged
terminal state, invalid audio values, and mismatched mode or difficulty.

All state remains on the player's device. No score, audio preference, board,
identifier, or interaction data is uploaded. Reset Game Data includes the two
new games and audio preferences in its explanation and confirmation.

## Technical Integration

The implementation extends the existing Swift Publish and browser-controller
architecture:

- `Content/games/kinnoki-stack.md` and `Content/games/kinnoki-yard.md` create the
  routes.
- `Resources/games/cargo-geometry.js` owns shared pure geometry.
- `Resources/games/kinnoki-stack.js` owns the pure Stack engine.
- `Resources/games/kinnoki-stack-ui.js` owns Stack rendering, input, and
  lifecycle.
- `Resources/games/kinnoki-yard.js` owns both pure Yard modes and validation.
- `Resources/games/kinnoki-yard-ui.js` owns Yard rendering and interaction.
- `Resources/games/game-audio.js` owns procedural music and sound effects.
- Existing `core.js`, `controller-common.js`, `hub-ui.js`, `ui.js`, shared CSS,
  and the Swift theme route switch gain only the extensions required for the
  two games.

The shared record API becomes explicit about record type: time, moves, score,
or combo. Existing Sudoku, Crossword, and Word Search time-record behavior is
unchanged; score-based games never pass a score through a time-record path.

Engines remain deterministic and DOM-free. Controllers own browser APIs and
must dispose timers, animation frames, listeners, and audio schedules on every
rerender and terminal path. Generated `Output/` is updated only through the
Publish generation command and is never edited by hand.

The real-time Stack loop uses a monotonic clock with a capped accumulated delta.
It cannot process an unbounded tick backlog after sleep, tab hiding, breakpoint,
or slow frame. Yard generation uses deterministic operation-count bounds and a
diverse bundled known-valid contract set per difficulty rather than an
unbounded search. A Web Worker is not required for the initial release; it may
be introduced only if measured browser performance shows the bounded main-thread
generator still causes visible input delay.

Puzzle Contract fallback uses at least four validated source packings per
difficulty plus deterministic rotation or reflection transforms that preserve
the allowed-orientation rules. The fallback selector compares the resulting
definition signature with the immediately previous contract and derives a new
seed or transform on collision. A single repeated bundled puzzle is not an
acceptable fallback.

## Error Handling and Resilience

- Invalid or corrupt saved state is isolated to the affected game and replaced
  without discarding unrelated runs or records.
- Storage write failure leaves the current session playable and displays one
  non-blocking persistence notice.
- Stack tick, tide, and dispatch reducers reject invalid actions rather than
  mutating into an impossible board.
- Yard generation derives a new seed within its operation bound, then uses the
  diverse validated fallback selector if necessary.
- Endless Yard terminal detection checks every remaining piece and allowed
  rotation before ending the run.
- Audio failure degrades to silence without stopping controls, timing, saving,
  or completion.
- Controller disposal prevents hidden timers, animation frames, document
  listeners, and audio nodes from surviving navigation, replacement, or
  completion.
- Visible fatal game errors preserve a return path to the Arcade Hall and a
  recoverable New Game action.

## Verification

### Automated Tests

Tests must cover:

- Cargo rotation normalization, collision, bounds, rigid identity, and pattern
  labels.
- Manifest completion and dispatch without ordinary row clearing.
- Partial-zone dispatch behavior and settled-component recomputation after a
  manifest splits cargo that arrived in one cluster.
- Seeded Stack sequence repeatability and variation.
- Tide determinism and invariants: no deletion, overlap, out-of-bounds movement,
  or invalid crane-line changes.
- Exact Stack placement and dispatch scores, multi-manifest resolution, combo
  increment and reset, tide-enabled dispatch, score saturation, spawn, crane-line
  rescue, top-out, and terminal immutability.
- Automatic and Step Mode grounded-state transitions, pause, capped tick
  backlog, Hard Drop, and assisted record exclusion.
- Contract generation across many seeds and all difficulties, with at least one
  solver-verified solution for every returned puzzle.
- Contract placement, rotation restrictions, undo, hint assistance, moves,
  completion, and terminal immutability.
- Solver-backed Hint behavior from both completable and dead-end partial
  packings, including Undo or Restart guidance for dead ends.
- Exact move counting for rotations, placements, repositioning, and Undo, with
  invalid or non-gameplay actions excluded.
- Endless batch generation, placement, dispatch, scoring, and exhaustive
  terminal detection across all allowed rotations.
- Exact Endless placement and dispatch scores, multi-manifest resolution,
  combo reset, saturation, and assisted snapshot-complete Undo without duplicate
  points.
- Completion accounting so zero-dispatch Stack and Endless terminal runs count,
  while abandoned and replaced runs do not.
- Version migration preserving valid v1 game runs, statistics, streaks, and
  totals; migration idempotence; hostile-state rejection; and no writes to
  `kinnoki-theme` or `kinnoki-dyslexic`.
- Audio sequencing with a fake audio context: gesture start, shared motif,
  intensity layers, pause, hidden-page suspension, resume without backlog,
  separate mute/volume, disposal, rate limiting, and silent fallback.
- Hub cards, Continue links, mode labels, records, Reset Game Data, and all five
  generated game routes.
- Pre-play Start or Continue and paused Resume states in which gravity, active
  timing, input listeners, and audio remain stopped until the explicit gesture.
- Updated Games content, hub copy, metadata, and social artwork with regression
  checks that reject stale three-game or three-classics language.
- Record-type separation so time, move, score, and combo records cannot corrupt
  one another.
- Contract fallback diversity, deterministic transforms, validation, and
  immediate-repeat rejection.
- Keyboard, touch-button, optional pointer, roving Yard focus, non-tabbable Stack
  gridcells, event-scoped live regions, Describe Dock, focus retention,
  non-colour state, 44-pixel targets, reduced motion, and OpenDyslexic behavior.

### Release Verification

Before publication:

- Run the repository's gated Swift build, `make generate`, `make test-games`,
  existing site and Listening Room tests, and branch-range `git diff --check`.
- Confirm generated `Output/` matches source resources and was not hand-edited.
- Complete Kinnoki Stack with keyboard controls on Easy and with touch controls
  on a phone-sized viewport.
- Complete one Kinnoki Yard Contract and one Endless Yard terminal run using
  keyboard-only controls, then repeat core placement with touch.
- Verify Step Mode, Hint assistance, record exclusion, save/resume, mode and
  difficulty replacement confirmation, and corrupt-state recovery.
- Verify music and effects start only after Start, adapt correctly, persist
  settings, pause when hidden, resume without backlog, and fail silently when
  Web Audio is unavailable.
- Listen to both arrangements to confirm the shared motif is original and does
  not quote a recognizable game soundtrack. Scan generated public output and
  assets for prohibited Tetris naming, logos, music, branded terminology, or
  copied trade-dress references before deployment.
- Inspect screen-reader semantics and announcements for both games.
- Check desktop, 390-by-844 mobile, true 200-percent browser zoom, large text,
  dark/light appearance, OpenDyslexic, reduced motion, and page-level overflow.
- Verify all six game destinations—the hub plus five games—on the Cloudflare
  preview with expected page markers and no console errors.
- After merge, verify the two new production routes on the custom domain before
  claiming them live.

## Success Criteria

The feature is complete when a visitor can:

- Open either new game from the live Arcade Hall.
- Choose Easy, Medium, or Hard and understand how difficulty changes play.
- Play Kinnoki Stack in real time or assisted Step Mode with deterministic cargo,
  manifest dispatches, forecasted tides where applicable, accurate scoring, and
  adaptive music.
- Complete a guaranteed-solvable Kinnoki Yard Contract or play Endless Yard
  until no valid placement remains.
- Use keyboard or touch without requiring precision dragging, colour perception,
  motion tolerance, or automatic audio on page load.
- Pause, leave, resume, restart, and replace a run without corrupting state or
  inflating records.
- Keep all data and audio preferences on the device while preserving existing
  Arcade Hall progress through migration.

All automated checks pass, generated output is reproducible, Cloudflare preview
verification succeeds, and both new custom-domain routes are verified after
deployment. No public surface uses Tetris branding, assets, music, trade dress,
or an implication of affiliation.

## Master Plan Impact

This is bounded follow-up work inside the existing KinNoKi Arcade Hall. It adds
two public engagement games and an audio capability but does not change the
portfolio launch order, dates, pricing, studio positioning, automation cadence,
or MacroMark's portfolio priority. Implementation should remain isolated from
the flagship product lanes and must not introduce a backend or live-service
maintenance obligation.

## Citations

1. Dan Fakkeldy conversation with Codex, 2026-07-12: approved both game names,
   both Kinnoki Yard modes, Cargo Manifests plus difficulty-gated tides, the
   interaction/accessibility direction, adaptive dual music, and the final
   technical design.
2. [KinNoKi Games Home Design](2026-07-12-kinnoki-games-home-design.md).
3. [Tetris Terms of Use](https://play.tetris.com/terms-conditions).
4. [Tetris branding notice](https://www.tetris.com/about).

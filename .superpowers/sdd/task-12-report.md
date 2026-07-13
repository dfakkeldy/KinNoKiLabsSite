# Task 12 report: Five-game Arcade Hall, typed records, Continue, and reset

## Status

Complete. The Arcade Hall now models and renders Sudoku, Crossword, Word Search,
Kinnoki Stack, and Kinnoki Yard from one exported declarative catalogue. Yard
actions are mode-first, saved Yard runs continue with their exact mode and
difficulty, Stack/Yard records retain type-specific presentation, and reset copy
names every locally removed category.

No Content pages, generated `Output/` files, deployment state, or publishing
configuration were changed. Stack/Yard route integration remains outside this
Task 12 slice.

## TDD evidence

### RED

Command:

```bash
node --test Tests/games/hub-five-games.test.mjs Tests/games/core.test.mjs
```

Result: 22 passed, 1 failed. The new hub suite failed at module instantiation
because `Resources/games/hub-ui.js` did not export `formatRecord`. The two new
core accounting tests already passed, proving the v2 lifecycle implementation
from earlier tasks already handled zero-valued terminal records, assisted record
protection, and abandonment without additional production changes.

### GREEN: focused hub, core, and storage

Command:

```bash
node --test Tests/games/hub-five-games.test.mjs Tests/games/core.test.mjs Tests/games/storage-v2.test.mjs
```

Result: 32 passed, 0 failed.

### GREEN: full Arcade Hall suite

Command:

```bash
make test-games
```

Result: 275 passed, 0 failed.

This includes generated-route assertions, controller and lifecycle suites,
dark/light WCAG AA token measurements, 44 by 44 CSS target checks, keyboard and
native-control semantics, and reduced-motion stylesheet assertions.

## Implementation

- Exported a frozen five-game `GAMES` catalogue with explicit modes and record
  types.
- Added `formatRecord(type, value)` with finite-value validation, flooring,
  safe-integer clamping, and distinct time/moves/score/combo output.
- Added mode-group action models and Yard mode-preserving Continue links/copy.
- Added v2 typed stats summaries: minimum Contract time/moves and maximum
  Stack/Endless score/combo, while preserving the legacy three-game shape.
- Rendered five semantic cards, labelled mode/difficulty groups, typed `dl`
  records, and complete local reset disclosure.
- Added focused hub tests plus completion/abandonment accounting regression
  tests.

## Accessibility and responsive review

- Difficulty links and reset controls retain tested 44 by 44 minimum targets.
- Mode choices are grouped with explicit accessible labels; decorative card
  symbols remain hidden from accessibility APIs.
- Records remain semantic description lists, and reset remains a labelled native
  dialog with native buttons.
- Existing one-column mobile behavior, flexible card content, light/dark tokens,
  and reduced-motion overrides remain applicable to the expanded markup.
- Live browser viewport screenshots were not captured because the in-app Browser
  runtime reported `No browser is available`. No unapproved external browser
  fallback was used.

## Commit

- `0ca8869 feat(games): expand Arcade Hall to five games`

## Concerns

- Route/bootstrap publication of the Stack and Yard pages is intentionally not
  part of Task 12 and remains for its dedicated integration slice.
- Live visual QA should be repeated when the in-app Browser runtime is available.

## Accessibility review follow-up

An Important review finding identified that `aria-label` alone did not establish
a grouping role for each repeated Yard difficulty set. The Contract and Endless
containers now use `role="group"` with their exact existing accessible labels,
so each repeated Easy, Medium, and Hard link is exposed within a mode-specific
group.

### Follow-up RED

The expanded DOM-level regression parsed the rendered hub into fixture elements
and queried `[role="group"]`. It failed with no Yard groups found while all other
new catalogue, URL, Continue, stats, normalization, and semantic-label cases
passed. This isolated the missing role rather than merely matching an HTML
string.

### Follow-up GREEN

```bash
node --test Tests/games/hub-five-games.test.mjs Tests/games/core.test.mjs Tests/games/storage-v2.test.mjs
# 39 passed, 0 failed

make test-games
# 282 passed, 0 failed
```

The expanded Task 12 suite now fixes the exact five-game order and approved
mode/record metadata; Contract-before-Endless action order and URLs; both Yard
Continue labels and URLs; typed record min/max/zero behavior; hostile finite
normalization and safe-integer clamping; typed `dl` labels; and the catalogue's
top-level freeze. The freeze is intentionally shallow because the approved
brief specifies `Object.freeze([...])` only; nested game, mode, and record values
are not represented as deeply immutable.

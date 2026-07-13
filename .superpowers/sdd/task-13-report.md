# Task 13 Report: Cargo-family styling and accessibility regressions

## Status

Complete.

## TDD evidence

- RED: `node --test Tests/games/accessibility.test.mjs Tests/games/kinnoki-stack-ui.test.mjs Tests/games/kinnoki-yard-ui.test.mjs` failed on the missing `.stack-controls button` and `.cargo-pattern-dots` rules (33 pass, 2 fail).
- RED: after adding the required motion regression, `node --test Tests/games/accessibility.test.mjs` failed because the cargo reduced-motion selectors were absent. The same run also exposed the plan's internal mismatch between its exact range CSS (`min-width: 132px`) and exact test (`min-width: 44px`).
- GREEN: the six-file accessibility/controller review command passed all 69 tests.
- GREEN: `make test-games` passed all 287 tests.

## Implementation

- Replaced the fixed three-column Arcade Hall grid with the five-card-capable auto-fit layout.
- Added shared wrapping controls and minimum 44 CSS-pixel targets.
- Added Stack dock geometry, crane line, cargo patterns, manifest/settled/active distinctions, and preview styling.
- Added Yard-local scrolling, fixed 44-pixel cells, tray and selection states, non-colour invalid/hint states, pan controls, visible focus, and OpenDyslexic focus reinforcement.
- Added narrow-layout behavior and exact cargo/board reduced-motion overrides.
- Added controller regressions for grid semantics, event-only live regions, terminal focus, and resource cleanup without changing the existing native-control regression.

## Specification note

The supplied test requires the audio range rule to contain `min-width: 44px`, while the supplied CSS block specifies `min-width: 132px`. The implementation preserves a 132-pixel preferred width with `width: 132px` and guarantees the tested 44-pixel minimum with `min-width: 44px`.

## Generated output

`Output/` was not regenerated or edited. Task 13 changes source CSS and source tests only, and the brief does not require generation.

## Verification

- `git diff --check` — pass
- Focused six-file suite — 69/69 pass
- `make test-games` — 287/287 pass

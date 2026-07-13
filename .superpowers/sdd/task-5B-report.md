# Task 5B Report: Contract Generation

## Outcome

Implemented the bounded deterministic Yard Contract generator, exact transform
catalogue, fallback selection, difficulty measurement, stable signatures, and
definition validation. The twelve prescribed source witnesses produce 96 valid
source/transform definitions, and procedural generation falls back deterministically
when its bounded solver budget cannot prove a candidate.

At the Task 5A boundary, hostile null and non-object placement entries now fail
closed, and both solver and generator operation limits reject negative,
fractional, unsafe, and non-finite values.

## TDD Evidence

### RED

Command:

```text
node --test Tests/games/kinnoki-yard-generator.test.mjs
```

Result: exit 1 because `kinnoki-yard.js` did not export
`CONTRACT_FALLBACK_PACKINGS`. Task 5A had already created the module, so the
missing-export error is the Task 5B equivalent of the brief's anticipated
missing-module failure.

### GREEN

Focused command:

```text
node --test Tests/games/kinnoki-yard-solver.test.mjs Tests/games/kinnoki-yard-generator.test.mjs Tests/games/cargo-geometry.test.mjs Tests/games/core.test.mjs
```

Result: exit 0, 50 tests passed, 0 failed, in 12.35 seconds. This covers all 90
generated contracts, all 96 source/transform fallback definitions, hostile
placement entries, and invalid operation limits.

Full command:

```text
make test-games
```

Result: exit 0, 181 tests passed, 0 failed, in 29.22 seconds.

The initial focused run exceeded five minutes because every seed re-solved the
same immutable fallback geometry. The final implementation validates and caches
each source/transform geometry once and verifies an empty-board bundled witness
as an exact cover before returning it. The bounded MRV search remains in use for
partial placements and definitions without a valid witness.

`git diff --check` completed without errors. Generated `Output/` content was not
edited.

## Files

- Updated `Resources/games/kinnoki-yard.js`.
- Added `Tests/games/kinnoki-yard-generator.test.mjs`.
- Added this report.

## Concerns

None. The complete game suite is green.

## Review Follow-up

Two focused regressions were added after review. RED reproduced both findings:
the hostile multi-entry placement map threw while the comparator dereferenced
`null`, and a duplicated witness piece ID was returned as solved while omitting
another definition piece. The solver now validates every fixed-placement value
before sorting, and the witness fast path requires unique IDs exactly equal to
the definition piece-ID set.

Focused command:

```text
node --test Tests/games/kinnoki-yard-solver.test.mjs Tests/games/kinnoki-yard-generator.test.mjs Tests/games/cargo-geometry.test.mjs Tests/games/core.test.mjs
```

Result: exit 0, 52 tests passed, 0 failed, in 13.13 seconds.

Full command:

```text
make test-games
```

Result: exit 0, 183 tests passed, 0 failed, in 28.70 seconds.

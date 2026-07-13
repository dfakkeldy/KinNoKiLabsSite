# Task 5A Report: Contract Solver

## Outcome

Implemented Task 5A only: a deterministic, bounded minimum-remaining-values
exact-cover solver for Yard Contract definitions. Existing placements are fixed
constraints, malformed placement-map identities fail closed, exact covers are
returned in numeric piece order, and operation exhaustion returns `limit`.

No Task 5B generator, fallback catalogue, definition validator, Yard state, or
controller behavior was added.

## TDD Evidence

### RED

Command:

```text
node --test Tests/games/kinnoki-yard-solver.test.mjs
```

Initial result: exit 1 with `ERR_MODULE_NOT_FOUND` for
`Resources/games/kinnoki-yard.js`. This demonstrated the missing Task 5A module
before production code was added.

### GREEN

Focused command:

```text
node --test Tests/games/kinnoki-yard-solver.test.mjs Tests/games/cargo-geometry.test.mjs
```

Result: exit 0, 16 tests passed, 0 failed.

Full command:

```text
make test-games
```

Result: exit 2, 166 tests passed and 1 failed. All five Task 5A solver tests
passed. The unrelated existing Crossword wall-clock test failed because hard
seed 39 took 259.1 ms against its 250 ms threshold.

The failure was reproduced without the Yard suite by running:

```text
node --test Tests/games/crossword.test.mjs
```

That isolated run reported 22 passes and the same single performance assertion
failure, this time because hard seed 0 took 286.2 ms. `kinnoki-yard.js` is not
imported by the Crossword suite, so no out-of-scope Crossword change was made.

Additional verification: `git diff --check` and `git diff --cached --check`
completed without errors before the implementation commit.

## Files

- Added `Resources/games/kinnoki-yard.js`.
- Added `Tests/games/kinnoki-yard-solver.test.mjs`.
- Did not edit generated `Output/` content.

## Commit

`721aad6 feat(games): add bounded Yard contract solver`

## Concerns

The repository-wide gate remains red only on the pre-existing, wall-clock-based
Crossword performance assertion described above. Task 5A's focused solver and
shared geometry gate is green.

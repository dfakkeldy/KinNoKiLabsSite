# Task 6 Implementation Report

## Status

Implemented Puzzle Contract play for Kinnoki Yard with serializable state,
lifecycle actions, exact manipulation/Undo move counting, immutable position
history, placement and repositioning, solver-backed Hint behavior, terminal
completion, continue preparation, and hostile saved-state validation.

## TDD Evidence

### RED

Command:

```sh
node --test Tests/games/kinnoki-yard-solver.test.mjs Tests/games/kinnoki-yard-contracts.test.mjs Tests/games/kinnoki-yard-generator.test.mjs
```

Observed failure: `kinnoki-yard.js` did not provide the requested
`createContractState` export. The pre-existing solver and generator coverage
remained green (22 passing, 1 suite failure from the missing Task 6 API).

### GREEN

The same focused command passed 29/29 tests after the minimal implementation.

Focused Task 6 plus shared core/storage command passed 55/55 tests:

```sh
node --test Tests/games/core.test.mjs Tests/games/storage-v2.test.mjs Tests/games/kinnoki-yard-solver.test.mjs Tests/games/kinnoki-yard-contracts.test.mjs Tests/games/kinnoki-yard-generator.test.mjs
```

Full Arcade Hall regression passed 191/191 tests:

```sh
make test-games
```

## Scope And Hostile-State Review

- Changed only the Yard engine, its new Contract test suite, and this report.
- Did not edit or regenerate `Output/`.
- Rejected placements do not mutate the board, history, assistance, or move count.
- Undo restores only position fields, increments the current move count, and
  cannot restore record eligibility after assistance.
- Terminal/error/disposed state is immutable through the reducer.
- Saved-state validation reconstructs the board from authenticated piece
  definitions and placements, requires exact placement-map identities, validates
  selection/focus/hints, and validates the exact history snapshot shape.
- Hostile values that throw during structural traversal fail closed through the
  validator's guarded boundary.

## Concerns

None within Task 6 scope. Task 7 remains responsible for the mode facade and
storage/controller integration.

## Review Follow-up

An Important review finding identified that persisted non-null hints were
validated by shape rather than by solver provenance.

### RED

Added a regression with both a plausible solved placement at row/column `999`
and a forged dead-end message on a solvable state. The focused Contract run
failed because the solved forgery was accepted (`true !== false`); the other ten
Contract tests passed.

### GREEN

Non-null hints are now recomputed from the saved definition and placements via
`getContractHint`/`solveContract` and must exactly equal the canonical hint.
Additional tests cover continue validation and deep cloning, move saturation,
rejected-action reference identity, and history snapshot alias isolation.

- Contract suite: 11/11 passed.
- Focused Yard/core/storage suite: 59/59 passed.
- Full `make test-games`: 195/195 passed.

The follow-up remains limited to the Yard engine, Contract tests, and this
report; `Output/` was not touched. `getContractHint` remains guarded from
completed-state calls through terminal reducer immutability; no new public hint
status was introduced solely for an unreachable reducer path.

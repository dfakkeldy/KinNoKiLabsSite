# Task 4 Report: Stack Clock, Lock Delay, and Step Mode

## Outcome

Implemented Task 4 only: the capped Stack clock, automatic grounding and lock
delay, lifecycle transitions, Step Mode, conditional grounded-state clearing,
and authenticated lock-history recording for every lock path.

## TDD Evidence

### RED

Command:

```text
node --test Tests/games/kinnoki-stack-loop.test.mjs Tests/games/kinnoki-stack.test.mjs
```

Initial result: exit 1. The new loop suite failed to load because
`kinnoki-stack.js` did not export `advanceStackTime`; all 15 pre-existing Stack
tests passed in the same run. This demonstrated the missing Task 4 interface
before production code changed.

### GREEN

Focused command:

```text
node --test Tests/games/kinnoki-stack-loop.test.mjs Tests/games/kinnoki-stack.test.mjs
```

Result: exit 0, 22 tests passed, 0 failed.

Full command:

```text
make test-games
```

Result: exit 0, 162 tests passed, 0 failed.

Additional verification: `git diff --check` and `git diff --cached --check`
both completed without errors before the implementation commit.

## Files

- Modified `Resources/games/kinnoki-stack.js`.
- Added `Tests/games/kinnoki-stack-loop.test.mjs`.
- Did not edit generated `Output/` content.

## Task 3 Handoff

Task 3 authenticates persisted progress by replaying `lockHistory`. Task 4 uses
one `lockAndRecordActive` helper for Hard Drop, automatic lock-delay expiry, and
the second blocked Step Mode Advance. The new tests assert that automatic and
Step locks append one legal descriptor and that `validateStackState` accepts
the resulting progressed state.

## Commit

`3f8d601 feat(games): add Stack timing and Step Mode`

## Concerns

None within Task 4 scope. Later controller work must call `advanceStackTime`
with frame deltas and must not add a reducer `tick` action.

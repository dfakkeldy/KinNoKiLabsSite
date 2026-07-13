# Final Broad-Review Fix Report

## Outcome

Resolved the important Stack animation-frame persistence/rendering finding and
added a realistic long-run guard for the minor Endless growth concern without
weakening deterministic replay, hostile-state authentication, assistance, Undo,
or record eligibility.

## Stack controller scheduling

### Root cause

`advanceStackTime` intentionally returns a new state while accumulating gravity.
The controller treated every new object identity as a semantic transition, so a
normal active RAF loop wrote Store v2 and repainted all 216 dock cells on nearly
every frame.

### Fix

- Clock-only transitions are recognized only when there are no engine events and
  every state field except `gravityAccumulatorMs` retains exact identity.
- Clock-only frames update the elapsed `<time>` node without painting the board,
  previews, controls, or status surfaces.
- Clock-only state is durably checkpointed at a bounded one-second interval.
- Any engine event or any non-clock state change remains a semantic transition
  and is persisted and fully painted immediately.
- Pause, `visibilitychange`, `pagehide`, terminal settlement, error settlement,
  and explicit disposal continue through lifecycle snapshots. Disposal now takes
  an explicit final snapshot before releasing the lifecycle, so a legal active
  run is resumable even when its owner is replaced directly.
- The engine remains the sole authority for gravity, lock, tide, terminal, audio,
  announcement, and record events. No event inference or duplicate completion
  path was added.

The maximum clock-only persistence staleness during uninterrupted active play is
one second. Semantic changes and lifecycle boundaries have no throttle. Continue
restores the exact checkpointed engine state; the lifecycle elapsed value is
saved with the same checkpoint.

## TDD evidence

RED controller run:

```text
clock-only RAF ticks: 119 writes instead of at most 1
gravity transition: 2 writes before semantic scheduling separation
```

GREEN coverage proves:

- 120 fake 60 fps RAF ticks with accumulator-only changes produce at most one
  Store v2 write, zero full-board paints, and a live elapsed display update;
- a real gravity move immediately produces one persistence write and one
  full-board paint;
- pause saves exact paused status, gravity accumulator, and elapsed time;
- disposal snapshots the resumed run; and
- Continue reproduces the saved row, accumulator, and elapsed semantics.

## Endless growth assessment

No history compaction was applied. Exact unlimited Undo requires retaining every
pre-placement position, while hostile-state authentication and sticky assistance
require retaining the canonical command provenance that derives it. Discarding a
prefix, imposing a maximum, or replacing it with an unauthenticated checkpoint
would respectively limit Undo, change approved unlimited semantics, or reopen the
forgery defects fixed during Task 7.

The existing representation is already non-recursive and linear: fixed-size
position snapshots never embed history or commands, and validation replays one
canonical command stream. A deterministic guard now exercises 256 placement/Undo
cycles (over 500 authenticated commands), requires an empty restored Undo stack,
caps the serialized state below 30 KB, and validates the final state. This guards
realistic long-session size and replay behavior without adding a hostile-input
limit that would reject a legitimate unlimited run.

## Verification

See the final branch handoff for exact command results. Required gates include
the focused Stack/controller/lifecycle/storage/Yard matrix, full
`make test-games`, `make generate`, generated source/output parity, Swift build,
`git diff --check`, and final worktree status.

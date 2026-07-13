# Task 7 Implementation Report

## Status

Implemented Endless Yard and the unified Yard facade. Endless play now has
deterministic three-piece batches, difficulty-specific rotation and manifest
rules, placement scoring, manifest dispatch combos, exhaustive terminal
detection, snapshot-complete Undo, lifecycle handling, continue preparation,
completion serialization, and hostile saved-state validation.

## TDD Evidence

### RED

Added `Tests/games/kinnoki-yard-endless.test.mjs` before changing production
code, then ran:

```sh
node --test Tests/games/kinnoki-yard-endless.test.mjs Tests/games/kinnoki-yard-contracts.test.mjs
```

The new suite failed at module instantiation because `kinnoki-yard.js` did not
export `createEndlessDefinition`. The existing Contract suite remained green at
11/11.

### GREEN

After implementing the Task 7 interfaces, the same focused command passed
18/18 tests.

The complete Yard/core/storage command passed 66/66 tests:

```sh
node --test Tests/games/core.test.mjs Tests/games/storage-v2.test.mjs \
  Tests/games/kinnoki-yard-solver.test.mjs \
  Tests/games/kinnoki-yard-generator.test.mjs \
  Tests/games/kinnoki-yard-contracts.test.mjs \
  Tests/games/kinnoki-yard-endless.test.mjs
```

The full Arcade Hall regression passed 202/202 tests:

```sh
make test-games
```

## Boundary Review

- Determinism: definitions authenticate exact mode, difficulty, seed, and board
  dimensions; every cargo entry is derived from its seed and stream index.
- Mode dispatch: every facade entry point routes only explicit `contracts` or
  `endless` values and rejects unknown modes/kinds.
- Terminal behavior: placement availability checks every allowed rotation at
  every in-bounds origin; terminal, error, and disposed reducers are immutable.
- Assistance: Endless Hint is unavailable; Undo marks assistance once and can
  never restore eligibility from its position snapshot.
- Accounting: placement, dispatch, combo, best-combo, batch, sequence, and
  dispatched-manifest counters use exact rules and saturating safe-integer
  helpers. Undo restores all accounting and stream fields exactly.
- Hostile state: saved play requires an authenticated definition, deterministic
  tray identities, exact history keys, valid board/manifest geometry, valid
  selection/focus, non-overlapping manifests, safe counters, and consistent
  stream indices. Validators fail closed on traversal errors.
- Generated `Output/` was not edited or regenerated.

## Concerns

None within Task 7 scope. Controller integration remains outside this task.

---

## Integrity Review Follow-up

### Findings resolved

The original structural validator trusted coordinated saved fields. It accepted
an arbitrary initial manifest identity paired with a forged stream index, a
lone board cargo cell, forged accounting on an untouched state, and an
unrelated forged Undo snapshot. `ENDLESS_RULES` also froze only its outer map.

### RED

Added the four reviewer probes plus coverage for deep rule immutability,
placement and dispatch accounting, simultaneous manifests, combo reset,
saturation, reducer-produced terminals (including a zero-dispatch terminal),
terminal immutability, and positive facade routing.

Command:

```sh
node --test Tests/games/kinnoki-yard-endless.test.mjs
```

The integrity run failed on deep immutability, coordinated saved-state
provenance, and terminal-state validation. One simultaneous-dispatch fixture
initially had the wrong missing-cell geometry; it was corrected before
production work. Existing score/reset/saturation behavior remained green and
was retained as direct contract coverage.

### Implementation

- Added serialized `actionHistory` containing exact successful placements.
- Every validation replays those actions from the deterministic seeded initial
  state through the real reducer.
- Every Undo snapshot is bound to the corresponding replay prefix and exact
  board, manifest, stream, score, combo, best-combo, and dispatch state.
- Current board cargo, trays, manifests, manifest index, batches, sequence,
  scoring, combos, and dispatch totals must equal the independently replayed
  result. Selection and allowed rotations remain legal non-placement UI state.
- Active manifests must belong to the deterministic difficulty pool and cannot
  remain completed after a reducer transition.
- Reducer-produced `no-placement` terminal states now validate, while Continue
  still rejects terminal play and terminal reducers remain immutable.
- `ENDLESS_RULES`, each difficulty configuration, and every manifest-shape
  array are frozen.

### GREEN

Focused Endless and Contract suites passed 25/25. Yard/core/storage passed
73/73:

```sh
node --test Tests/games/core.test.mjs Tests/games/storage-v2.test.mjs \
  Tests/games/kinnoki-yard-solver.test.mjs \
  Tests/games/kinnoki-yard-generator.test.mjs \
  Tests/games/kinnoki-yard-contracts.test.mjs \
  Tests/games/kinnoki-yard-endless.test.mjs
```

The full Arcade Hall regression passed 209/209:

```sh
make test-games
```

A direct legal placement followed by Undo also validated with empty replay and
snapshot histories while preserving `assisted: true`.

### Concerns

Replay work is linear in the number of successful Endless placements and is
performed only when authenticating persisted state. No controller integration
or generated `Output/` files were changed.

---

## Second Integrity Review Follow-up

### Findings resolved

Placement-only provenance erased Undo evidence, so assistance could be forged
back to `false`. It also did not authenticate exact pre-placement selection or
rotation, and lifecycle status was not derived from provenance. Finally, each
snapshot recursively embedded the placement history, causing superlinear saved
state growth.

### RED

Added reviewer regressions for:

- legal placement plus Undo followed by an `assisted: false` forgery;
- a history snapshot changed to another legal tray selection or rotation;
- a progressed active state forged back to preview;
- a 12-placement saved run whose snapshots must contain no command/history
  provenance and whose serialized size must remain bounded linearly.

Command:

```sh
node --test Tests/games/kinnoki-yard-endless.test.mjs
```

All four new boundaries failed before production changes: the three forgeries
were accepted and `commandLog` did not exist.

### Implementation

- Replaced placement-only `actionHistory` with retained canonical `commandLog`.
- Successful state-changing start, pause, resume, selection, rotation,
  placement, Undo, and continue-preparation operations append exact commands.
  Invalid actions and idempotent lifecycle calls do not append evidence.
- Undo restores only the position snapshot, retains its command evidence, and
  derives sticky assistance during replay.
- Snapshots contain only position fields. They never contain `history`,
  `commandLog`, or command prefixes.
- Validation replays from the deterministic preview state and compares kind,
  lifecycle status, terminal reason, assistance, exact tray selection and
  rotations, focus, board, manifests, stream indices, accounting, and the exact
  current Undo snapshot stack.
- Continue preparation records an explicit `prepare-continue` command, so its
  paused status is replayable even when preparing a preview or active save.
- Renamed the saturation test to accurately state that it proves combo reset
  while preserving counters that are already saturated; it does not claim to
  create a real saturated dispatch increment.

### Complexity and storage shape

For `n` retained commands, serialized provenance is `O(n)`. Each position
snapshot has a fixed upper bound because Endless board dimensions, tray, and
manifest counts are bounded and no snapshot embeds another history.

Validation is `O(n)` in retained commands: it suppresses command recording and
history retention during reducer replay, maintains one validator-owned snapshot
stack, and performs one final linear comparison. Fixed board/manifest scans per
placement are constant with respect to `n`.

### GREEN

Focused Endless and Contract suites passed 29/29. Yard/core/storage passed
77/77. The full Arcade Hall regression passed 213/213:

```sh
node --test Tests/games/core.test.mjs Tests/games/storage-v2.test.mjs \
  Tests/games/kinnoki-yard-solver.test.mjs \
  Tests/games/kinnoki-yard-generator.test.mjs \
  Tests/games/kinnoki-yard-contracts.test.mjs \
  Tests/games/kinnoki-yard-endless.test.mjs
make test-games
```

### Concerns

None within Task 7 scope. Generated `Output/` remains untouched.

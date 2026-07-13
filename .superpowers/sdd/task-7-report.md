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

---

## Canonical Focus Follow-up

### Blocker resolved

Focus was validated and included in snapshots, but the reducer exposed no way
to change it. Task 11's planned controller therefore mutated `state.focus`
directly, which could not be distinguished from a forged save.

### RED

Added regressions proving that:

- an active Yard can change focus through `reduceYard`, validate, and prepare
  for Continue;
- the reducer-derived focus appears exactly in the next placement snapshot;
- changing that snapshot focus or directly changing live focus without a
  command fails validation;
- out-of-bounds, null, and same-cell requests preserve state and command-log
  identity.

Before production changes, legitimate `set-focus` calls were rejected as
unsupported and both accepted-focus assertions remained at `{ row: 0,
column: 0 }`.

### Implementation and interface handoff

- Added `{ type: 'set-focus', focus: { row, column } }` to both Contract and
  Endless reducers, so the unified `reduceYard` facade is the single focus
  mutation interface for either mode.
- Coordinates must be exact integer row/column records within the definition's
  board. Null and extra/malformed fields are rejected.
- Same-cell focus is an identity-preserving no-op with no event or command.
- Endless accepted changes emit `focus-changed`, append one canonical command,
  and replay into the exact live and pre-placement snapshot focus.
- Contract accepted changes use the same action/event contract and preserve
  existing Contract validation semantics.

Task 11 must replace the planned direct assignment in
`YardController.prototype.setFocus` with dispatch of this exact action. Direct
controller mutation is no longer a valid persisted Endless state and will be
rejected during Continue authentication. This is the remaining ledger-facing
handoff; no Task 11 controller file exists in Task 7 scope to update here.

The command is constant-size, snapshots remain non-recursive, and validation
remains `O(n)` in retained commands.

### GREEN

Focused Endless and Contract suites passed 32/32. Yard/core/storage passed
80/80. The full Arcade Hall regression passed 216/216.

### Concerns

Task 11 must dispatch `set-focus` rather than copying `focus` onto controller
state. No other Task 7 concern remains.

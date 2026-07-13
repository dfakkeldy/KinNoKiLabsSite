# Task 10 Report: Kinnoki Stack semantic controller

## Outcome

Implemented the `renderKinnokiStack(root, store, dependencies)` controller with an inert deterministic preview, explicit Start/Continue/Resume activation, semantic 12 x 18 dock, keyboard and native-button input, Step Mode assistance accounting, Store v2 persistence, adaptive audio events, lifecycle-safe pause/resume, terminal accounting, restart/replacement behavior, and idempotent disposal.

## TDD evidence

- RED: `node --test Tests/games/kinnoki-stack-ui.test.mjs Tests/games/game-lifecycle.test.mjs Tests/games/kinnoki-stack-loop.test.mjs`
  - 19 dependency tests passed.
  - All 7 prescribed controller tests failed with the expected `ERR_MODULE_NOT_FOUND` for `Resources/games/kinnoki-stack-ui.js`.
- GREEN: the same command passed 26/26 after the controller implementation.
- The new tests cover inert preview/audio, 216 non-tabbable semantic cells, difficulty previews/copy, keyboard help, audio ranges, pure Describe Dock behavior, Step Mode assistance persistence, pause, terminal cadence/accounting, restart, declined replacement, and assisted Continue normalization.

## Implementation notes

- The static shell and grid nodes remain stable during paint, preserving control focus.
- Audio is lazy and begins only from explicit Start, Continue, or Resume gestures.
- Active document listeners and animation frames are owned by the shared lifecycle and removed on pause, replacement, terminal transition, error, or disposal.
- Saved Stack state is signature-checked and engine-validated before Continue; inconsistent hostile state is abandoned and fails closed.
- Terminal completion is guarded once, records assistance consistently, calls `finish({ outcome: 'terminal' })`, and does not truncate the ending cadence with `stop()`.
- Restart abandons the saved run and remounts the same definition as an unsaved preview.
- Added the missing `FixtureElement.removeEventListener` DOM primitive so active native-button listener disposal can be asserted rather than leaking in the fixture.

## Verification

- Focused Stack/controller/lifecycle/audio/core/storage matrix: 79/79 passed.
- Full `make test-games`: 247/247 passed on the clean rerun.
- An initial full run had one unrelated Crossword wall-clock threshold miss (`hard seed 17 took 266.4ms`); `Tests/games/crossword.test.mjs` then passed 23/23 and the complete rerun passed.
- `git diff --check`: passed.

## Review notes

- Keyboard handling leaves Tab native, ignores editable/native controls, and supports Left/Right/Down/Up, Z, Space, Enter in Step Mode, P, and Escape.
- Gameplay controls are native buttons; the dock cells are non-tabbable gridcells with text labels and cargo pattern names.
- The controller introduces no motion effects; the shared page reduced-motion policy remains applicable.
- Stack-specific visual sizing and route wiring remain outside this controller-only task; no generated `Output/` files were edited.

## Important-defect follow-up

Refactored terminal completion so payload validation and durable Store v2 accounting happen while the lifecycle can still fail. `lifecycle.finish()` now runs only after completion persistence succeeds. Completion persistence is transactional in memory: a failed write restores the active-run store and throws into recoverable lifecycle error handling instead of showing a false successful completion.

The controller now also guards the in-progress terminal transaction against synchronous reentrancy. Normal zero-valued score/combo/manifests still completes once, stores one completion, and calls audio `finish({ outcome: 'terminal' })` without `stop()`.

### Follow-up TDD evidence

- RED: 11/14 controller tests passed; the null payload, completion inconsistency, and completion write-failure regressions failed because terminal settlement prevented recoverable alert rendering.
- GREEN: 16/16 controller tests passed after the ordering and transactional persistence fix.
- Focused Stack/controller/lifecycle/audio/core/storage matrix: 88/88 passed.
- Full `make test-games`: 256/256 passed.

### Added high-risk coverage

- Null and structurally invalid completion payloads.
- Completion assistance inconsistency and failed durable completion writes.
- Synchronous reentrant completion-write callbacks and exactly-once accounting.
- Keyboard map plus native-button dispatch and focus stability across paint.
- Hidden-page and `pagehide` pauses that require explicit Resume.
- Accepted New Run abandonment and hostile saved-state rejection.
- Audio effect, intensity, preference, and persisted-setting mapping.

Real-browser interaction and visual verification remain assigned to the later integration task; this follow-up validates the controller with the deterministic DOM fixture only.

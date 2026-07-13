# Task 11 Report: Kinnoki Yard semantic controller

## Outcome

Implemented `renderKinnokiYard(root, store, dependencies)` for Contract and
Endless modes. The controller provides an inert preview, explicit
Start/Continue/Resume activation, semantic native-button grid, roving focus,
keyboard and touch controls, board-local pan controls, mode-specific Hint and
Undo behavior, Store v2 persistence, Yard audio, replacement confirmation,
terminal summaries, and idempotent disposal.

## TDD evidence

- RED: the prescribed controller test failed with `ERR_MODULE_NOT_FOUND` for
  `Resources/games/kinnoki-yard-ui.js`; all 32 Contract/Endless engine tests
  remained green.
- GREEN: the focused Yard/controller/lifecycle/audio/core/storage matrix passed
  112/112 before the terminal hardening follow-up.
- Final controller suite passed 11/11, including invalid completion payload,
  failed durable completion write, and Endless zero-dispatch record coverage.
- Full `make test-games` passed 267/267.
- `git diff --check` passed.

## Integrity and lifecycle review

- `YardController.setFocus` dispatches the authenticated reducer command
  `{ type: 'set-focus', focus: { row, column } }`; persisted focus is never
  changed directly by the controller.
- Saved runs require exact mode, difficulty, seed, definition signature, play
  signature, assistance envelope, and engine validation before Continue.
- Contract Hint and both modes' Undo persist sticky assistance before records
  can be written.
- Completion validates the mode-specific payload and assistance state, applies
  accounting transactionally, rolls back on storage failure, and is guarded
  against reentrant or duplicate settlement.
- Endless zero-dispatch terminal runs preserve valid zero score/combo records.
- Active document listeners and animation frames are lifecycle-owned and are
  removed on pause, terminal failure, replacement, error, and disposal.
- Board cells are created once and repainted in place. Tray replacement restores
  meaningful piece focus; arrow navigation keeps exactly one board tab stop.
- Pan is board-local, native buttons cover touch input, and no drag-only path is
  required. The controller adds no animation, so the existing reduced-motion
  policy remains authoritative.
- Restart abandons the active run and remounts the exact definition as an
  unsaved preview. Declined replacement preserves lifecycle, selectors, focus,
  and serialized state.

## Scope and concerns

Only the Yard controller, its tests, and this report were added. Generated
`Output/` was not edited. Real-browser route wiring, visual CSS integration,
and responsive screenshot validation remain outside Task 11's controller-only
scope.

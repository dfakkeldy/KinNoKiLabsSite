# Task 6 Report: Contrast controller

## Outcome

Implemented `renderContrastTool(root, deps = {})` in
`Resources/tools/contrast-ui.js`, with focused controller coverage in
`Tests/tools/contrast-ui.test.mjs`.

- Two visible, labelled foreground/background fields each provide a text hex
  input and native colour picker. Valid changes synchronize the paired control.
- The controller renders the WCAG ratio, all five required pass/fail verdicts,
  and both foreground-on-background and background-on-foreground previews.
- Invalid hex input produces an announced `.tool-error` without a ratio,
  verdicts, or `NaN` output.
- The suggestion target selector supports 3:1, 4.5:1, and 7:1. A `Suggest a
  fix` button appears only when the current pair misses the selected target;
  applying a reachable fix updates the foreground and re-renders it passing.
- Valid foreground/background pairs restore from and persist to the versioned
  `kinnoki-tools:v1` `contrast` preferences bag. Every result and error is
  announced through the injected/default announcer.

## TDD evidence

### RED

Added `Tests/tools/contrast-ui.test.mjs` before creating the controller, then
ran:

```text
$ node --test Tests/tools/contrast-ui.test.mjs
ERR_MODULE_NOT_FOUND: Cannot find module Resources/tools/contrast-ui.js
not ok 1 - Tests/tools/contrast-ui.test.mjs
# pass 0
# fail 1
```

This was the expected failure: the tests imported the planned controller module
before it existed.

### GREEN

Implemented the small DOM controller and then ran:

```text
$ node --test Tests/tools/contrast-ui.test.mjs
# tests 4
# pass 4
# fail 0

$ make test-tools
# tests 44
# pass 44
# fail 0
```

### REFACTOR / self-review

- Kept rendering to standard DOM creation and `replaceChildren`; no `innerHTML`,
  timeout, or layout-read APIs are used.
- Kept the controller dependency-free and injected storage/announcement seams
  aligned with the existing dilution controller.
- Normalized only valid hex values, so invalid typed text remains visible for
  correction while suppressing all derived output.
- Verified suggestion application against the existing exact `suggestPassing`
  engine rather than duplicating contrast math.
- `git diff --check` passed. No generated `Output/` content was edited or
  generated, and the task ledger was not changed.

## Commands run

```text
node --test Tests/tools/contrast-ui.test.mjs   # RED: expected missing module
node --test Tests/tools/contrast-ui.test.mjs   # GREEN: 4 passing
make test-tools                                # 44 passing
git diff --check
```

## Files

- `Resources/tools/contrast-ui.js`
- `Tests/tools/contrast-ui.test.mjs`
- `.superpowers/sdd/task-6-report.md`

## Concerns

None.

## Unreachable suggestion follow-up (2026-07-18)

### RED

Added a controller regression for `#777777` on `#888888` at a 7:1 target,
where the existing pure engine correctly returns `null`. Before the fix, the
visible button silently returned without updating the result or announcement:

```text
$ node --test Tests/tools/contrast-ui.test.mjs
not ok 4 - announces a clear error when the selected contrast target has no reachable suggestion
error: The expression evaluated to a falsy value: assert.ok(error)
# tests 5
# pass 4
# fail 1
```

### GREEN

The suggestion button now appends a visible `.tool-error` reading `No
suggestion available for this pair and target.` and announces that exact text.
It leaves the foreground/background inputs and selected 7:1 target untouched;
the existing reachable-suggestion regression remains green.

```text
$ node --test Tests/tools/contrast-ui.test.mjs
# tests 5
# pass 5
# fail 0

$ make test-tools
# tests 45
# pass 45
# fail 0
```

### Self-review

- The error is created with the existing DOM helper and injected announcer; no
  silent path remains when `suggestPassing` returns `null`.
- The normal successful suggestion path is unchanged and still covered.
- The fix is scoped to the Task 6 controller, focused test, and this receipt.
- `git diff --check` passed; no generated output or task ledger changed.

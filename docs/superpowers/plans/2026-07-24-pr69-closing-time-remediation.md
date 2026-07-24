# PR #69 Closing-Time Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the three HRM closing timestamps and the shortened HRM source-index label found by the independent PR #69 audit, then update the existing PR with regression coverage and regenerated artifacts.

**Architecture:** Extend the existing literal tender-record contract so it protects authoritative closing timestamps and exact source-index labels. Apply the smallest source-data corrections, record the common live recheck instant, rebuild the deterministic tender pack, and regenerate `Output/` through the supported Make targets.

**Tech Stack:** Node.js built-in test runner, Markdown frontmatter, Python tender-pack builder, LibreOffice, Swift Publish, Git, GitHub CLI.

## Global Constraints

- Treat the live Halifax Bids and Tenders detail pages and Nova Scotia Procurement Portal as authoritative.
- Use `2026-07-24T17:38:13-03:00` as the common `checkedAt` value for the four records reverified in this remediation.
- Preserve the exact long HRM-2026-1026 Bid Name.
- Do not edit `Output/` manually.
- Keep the pack free of official tender documents and local filesystem paths.
- Update PR #69 only; do not merge or deploy it.

---

### Task 1: Lock authoritative deadlines and source-index labels

**Files:**

- Modify: `Tests/site/tender-showcase.test.mjs:151-180`
- Modify: `Tests/site/tender-showcase.test.mjs:335-353`

**Interfaces:**

- Consumes: `EXPECTED_TENDER_RECORDS`, `frontmatterValue`, and the ZIP reader already defined in the test.
- Produces: Literal `tenderID` and `closingAt` expectations for every record, plus an exact `${tenderID} — ${title}` source-index assertion.

- [ ] **Step 1: Add the failing record expectations**

Add `tenderID` and `closingAt` to all four `EXPECTED_TENDER_RECORDS` entries:

```js
'hrm-autobody-painting-service.md': {
  tenderID: 'HRM-2026-0311',
  closingAt: '2026-08-13T14:00:59-03:00',
},
'hrm-cds-dvds-goods.md': {
  tenderID: 'HRM-2026-0372',
  closingAt: '2026-08-12T14:00:59-03:00',
},
'hrm-street-recap-construction.md': {
  tenderID: 'HRM-2026-1026',
  closingAt: '2026-08-10T14:00:59-03:00',
},
'nslc-agency-store-service.md': {
  tenderID: 'NSLC27-09',
  closingAt: '2026-08-13T14:00:00-03:00',
},
```

Keep each entry's existing title, category, notice URL, and documents URL fields.

- [ ] **Step 2: Require exact source-index labels**

Inside `official-sources.txt names every notice and direct HRM document source`,
add this assertion before the URL assertions:

```js
assert.match(
  text,
  new RegExp(
    escapeRegex(`${expected.tenderID} — ${expected.title}`),
  ),
);
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
node --test --test-timeout=300000 Tests/site/tender-showcase.test.mjs
```

Expected: FAIL because the three HRM `closingAt` values still end in `:00` and
the HRM-2026-0311 source-index label still omits `(Halifax Location)`.

---

### Task 2: Correct the reviewed source facts

**Files:**

- Modify: `Content/tenders/hrm-autobody-painting-service.md:11-13`
- Modify: `Content/tenders/hrm-cds-dvds-goods.md:11-13`
- Modify: `Content/tenders/hrm-street-recap-construction.md:11-13`
- Modify: `Content/tenders/nslc-agency-store-service.md:13`
- Modify: `Tools/tender-pack/official-sources.txt:17`

**Interfaces:**

- Consumes: The live Bid Closing Date fields reverified on 2026-07-24 and the exact titles already locked in `EXPECTED_TENDER_RECORDS`.
- Produces: Correct second-level HRM timestamps and an exact public source-index label.

- [ ] **Step 1: Correct the HRM closing timestamps**

Set:

```yaml
HRM-2026-0311 closingAt: 2026-08-13T14:00:59-03:00
HRM-2026-0372 closingAt: 2026-08-12T14:00:59-03:00
HRM-2026-1026 closingAt: 2026-08-10T14:00:59-03:00
```

- [ ] **Step 2: Record the common live recheck**

Set all four records to:

```yaml
checkedAt: 2026-07-24T17:38:13-03:00
```

- [ ] **Step 3: Correct the source-index title**

Replace the HRM-2026-0311 source-index label with:

```text
HRM-2026-0311 — Autobody and Painting Services for HRM Light-Duty Vehicles (Halifax Location)
```

- [ ] **Step 4: Run the focused test and verify the source records are GREEN**

Run:

```bash
node --test --test-timeout=300000 Tests/site/tender-showcase.test.mjs
```

Expected: the exact-record test passes. The source-index test remains the only
failure because it reads the still-stale committed ZIP; Task 3 rebuilds that
artifact before the full green gate.

---

### Task 3: Rebuild deterministic public artifacts

**Files:**

- Modify through generator: `Resources/tenders/tender-starter-example.zip`
- Modify through generator: `Output/tenders/**`

**Interfaces:**

- Consumes: Corrected content and source-index text.
- Produces: Byte-reproducible ZIP and generated pages that match source.

- [ ] **Step 1: Commit clean Content before generation**

Stage the four content files, the test, source index, and this plan explicitly.
Commit:

```bash
git commit -m "fix(site): preserve authoritative tender deadlines"
```

- [ ] **Step 2: Rebuild the pack**

Run:

```bash
env -u PYTHONPATH \
  TENDER_PACK_PYTHON="/Users/dfakkeldy/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3" \
  TENDER_PACK_SOFFICE="/Users/dfakkeldy/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/soffice" \
  make tender-pack
```

Expected: two isolated internal builds are byte-identical.

- [ ] **Step 3: Run the focused test and verify full GREEN**

Run:

```bash
node --test --test-timeout=300000 Tests/site/tender-showcase.test.mjs
```

Expected: 32 tests pass with zero failures.

- [ ] **Step 4: Regenerate the site**

Run:

```bash
make generate
```

Expected: generated tender pages display the updated checked-on time and closing timestamps.

- [ ] **Step 5: Verify parity and idempotence**

Run:

```bash
cmp Resources/styles.css Output/styles.css
cmp Resources/tenders/tender-starter-example.zip Output/tenders/tender-starter-example.zip
make generate
git diff --check
```

Expected: both comparisons and whitespace check pass; the second generation creates no additional diff.

- [ ] **Step 6: Commit generated artifacts**

Stage only the generated ZIP and tender output files. Commit:

```bash
git commit -m "chore(site): regenerate corrected tender showcase"
```

---

### Task 4: Verify and update PR #69

**Files:**

- No additional source files.

**Interfaces:**

- Consumes: The two remediation commits and PR #69 remote head.
- Produces: Updated PR head, accurate PR verification summary, and hosted-CI status.

- [ ] **Step 1: Run complete local verification**

Run:

```bash
"$HOME/.claude/bin/xcode-build-gate.sh" --wait && make test
"$HOME/.claude/bin/xcode-build-gate.sh" --wait && swift build
git diff --check
git status --short --branch
```

Expected: 931 tests pass across four suites, Swift builds, whitespace is clean,
and the worktree has no uncommitted changes.

- [ ] **Step 2: Confirm fast-forward safety**

Run:

```bash
git fetch origin --prune
gh pr view 69 --json headRefOid,headRefName,state
git merge-base --is-ancestor 8f4bce92422222fac938b74c8ddc267ae5876003 HEAD
```

Expected: PR #69 is OPEN at the original head and the local remediation branch
is its descendant.

- [ ] **Step 3: Update the existing PR**

Push without force:

```bash
git push origin HEAD:codex/tender-showcase-plan
```

Update the PR body so its verification table says 931 tests, identifies the
exact `:59` HRM closing-time preservation, records the deterministic pack SHA,
and notes direct NSLC portal verification.

- [ ] **Step 4: Verify hosted CI**

Run:

```bash
gh pr checks 69 --watch
```

Expected: required checks pass. If a check fails, inspect the concrete job log,
fix the blocker, push, and wait for the replacement check.

## Self-Review

- The regression test fails on either a rounded HRM deadline or a shortened
  public source-index label.
- The implementation changes only reviewed source facts, verification
  timestamps, generated artifacts, tests, and this plan.
- The supported generators produce every public artifact change.
- Local verification, remote-head safety, PR update, and hosted CI each have an
  explicit gate.

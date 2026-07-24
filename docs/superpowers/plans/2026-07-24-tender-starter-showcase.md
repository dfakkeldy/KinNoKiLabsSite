# Tender Starter Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Use
> `superpowers:test-driven-development` for every behavior change and
> `superpowers:verification-before-completion` before claiming completion.

**Goal:** Publish a manually curated `/tenders/` proof-of-work showcase with
three to five current Nova Scotia opportunities, source-bounded detail pages,
one downloadable example pack, a no-upload free-preview request, and a clear
path to a paid Tender-to-Bid Diagnostic.

**Architecture:** Add `tenders` as a first-class Publish section. Tender source
facts live in item frontmatter under `Content/tenders/`; original KinNoKi
analysis lives in the Markdown body. A focused `TenderShowcase.swift` converts
the optional Publish metadata into a validated record and renders the hub/detail
pages with Plot so source text is escaped. A local authoring script builds the
reviewed ZIP from plain-text sources; the public site serves only committed
static artifacts and has no account, backend, scraper, database, upload, or
runtime dependency.

**Tech Stack:** Swift 5.5, Swift Publish 0.8, Plot, Markdown content, CSS, Node
built-in tests, Python 3 with `python-docx`/`openpyxl`/`pypdf` for the authoring
tool, LibreOffice Writer PDF export with PDF/UA tagging, Cloudflare Pages.

**Approved design authority:** Dan approved the complete Tender Starter
Showcase specification in conversation on 2026-07-24. The private operating copy
is:
`/Users/dfakkeldy/Developer/knowledge-base/.worktrees/codex-tender-showcase-design/docs/superpowers/specs/2026-07-24-tender-starter-showcase-design.md`.
Do not publish that private KB path or copy company-specific notes into the
public site.

## Global Constraints

- Keep the offer generic. Do not name AllSteel, Van Zutphen, or any prospective
  employer/customer in public copy or example data.
- This is a curated showcase, not a live tender directory. Every card and detail
  page exposes its lifecycle state and checked-on timestamp in text.
- Current entries must have had at least ten calendar days remaining when first
  added. Recheck this against the official notice immediately before the content
  commit.
- Treat the Nova Scotia Procurement Portal and each linked official procurement
  system as authoritative. Never infer an unpublished requirement, eligibility,
  company fit, price, deadline, document-access state, or addendum state.
- Link to official tender documents; do not copy or bundle official tender PDFs.
  The downloadable pack contains original KinNoKi summaries/templates only.
- The free preview asks for a public tender URL/ID, general company/work type,
  contact information, and a short fit explanation through a structured
  `mailto:` link. Add no form processor, file upload, database, account, or
  analytics event.
- The pack is illustrative, not a bid, complete compliance review, estimate,
  legal review, engineering review, or eligibility conclusion.
- Never edit `Output/` directly.
- `Tools/prepare-deterministic-publish.mjs` rejects dirty `Content/`. Commit the
  tender Markdown records before the first `make generate`.
- Add all showcase CSS in one appended
  `/* ===== Tender Starter Showcase ===== */` block.
- Preserve the existing desktop/mobile navigation. Discover the showcase from
  Services rather than adding another top-level navigation item.
- The repo has no `nightly`/`weekly` ladder. The eventual implementation PR
  targets `main`, but public content is Tier 2: open a ready PR and wait for Dan
  to authorize merge/publication.

## Version-One Content Seed

These are candidate seeds observed on the public Nova Scotia Procurement Portal
on 2026-07-24. They are not pre-approved facts for publication. Task 2 must open
each official detail page, inspect accessible documents/addenda, and replace any
candidate that no longer satisfies the selection contract.

| Candidate | Category signal | Posted | Closing shown | Seed state |
| --- | --- | --- | --- | --- |
| `HRM-2026-1026` — Street Recap., Intersection Reconfigurations, Traffic Calming and Sidewalk Renewals — Various | construction | 2026-07-24 | 2026-08-10 | current candidate; preferred featured pack |
| `HRM-2026-0311` — Autobody and Painting Services for HRM Light-Duty Vehicles (Halifax Location) | operational service | 2026-07-24 | 2026-08-13 | current candidate |
| `HRM-2026-0372` — Supply & Delivery of CDs & DVDs | goods | 2026-07-23 | 2026-08-12 | current candidate |
| `MODY-2026-PWT01` — One New Compact Utility Tractor | goods/equipment | 2026-07-23 | 2026-08-06 | current candidate; replace if the ten-day rule no longer holds |

Release with three to five verified entries. Prefer one construction, one
service/professional-work, and one goods/operations example. If the official
detail cannot be read without an account, the source link is unstable, or
critical information is inaccessible, do not use that candidate.

## Planned File Structure

### Create

- `Content/tenders/<verified-slug>.md` — one source record and original analysis
  per verified current/archive entry.
- `Sources/KinNoKiLabsSite/TenderShowcase.swift` — lifecycle model, validation,
  hub cards, detail rendering, request link.
- `Tools/tender-pack/guide.md` — source text for the example PDF.
- `Tools/tender-pack/workbook.json` — source rows/sheet definitions for the XLSX.
- `Tools/tender-pack/official-sources.txt` — plain-text source index bundled in
  the ZIP.
- `Tools/tender-pack/requirements.txt` — pinned authoring-only Python packages.
- `Tools/build-tender-demo-pack.py` — deterministic authoring script.
- `Resources/tenders/tender-starter-example.zip` — reviewed public artifact.
- `Tests/site/tender-showcase.test.mjs` — source, generated-route, state, CTA,
  accessibility-contract, pack, and parity tests.

### Modify

- `Sources/KinNoKiLabsSite/main.swift` — add `.tenders`, metadata fields,
  deterministic section date, and keep tenders out of RSS.
- `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift` — route tender section/items,
  body classes, and add one Services proof link.
- `Resources/styles.css` — appended showcase block with responsive, print, focus,
  and reduced-motion rules.
- `Tools/prepare-deterministic-publish.mjs` — emit the tender section epoch.
- `Tests/tools/generation-reproducibility.test.mjs` — cover the fourth epoch and
  `/tenders` section sitemap date.
- `Makefile` — pass `KINNOKI_TENDERS_SECTION_DATE_EPOCH`; add optional
  `tender-pack` target.
- `AGENTS.md` and `CLAUDE.md` — document editorial refresh and pack regeneration.
- `Output/**` — generated only by `make generate`, then committed.

## Shared Data Contract

Add these optional properties to `KinNoKiLabsSite.ItemMetadata`; existing app
and post content remains valid because all tender-only fields are optional:

```swift
var tenderID: String?
var issuer: String?
var procurementSystem: String?
var category: String?
var deliveryRegion: String?
var publishedAt: String?       // ISO 8601 with offset
var closingAt: String?         // ISO 8601 with offset
var firstAddedAt: String?      // ISO 8601 with offset
var checkedAt: String?         // ISO 8601 with offset
var documentAccess: String?
var addendaURL: String?
var addendaStatus: String?
var lifecycle: String?         // enum raw value below
var noticeURL: String?
var documentsURL: String?
var featuredPack: Bool?
```

`TenderLifecycle` raw values and public labels are fixed:

```swift
enum TenderLifecycle: String {
    case current
    case closingSoon = "closing-soon"
    case closedDemo = "closed-demo"
    case withdrawn
    case superseded
    case sourceUnavailable = "source-unavailable"
    case addendaUnchecked = "addenda-unchecked"

    var label: String {
        switch self {
        case .current: return "Current"
        case .closingSoon: return "Closing soon"
        case .closedDemo: return "Closed — retained as a demonstration"
        case .withdrawn: return "Withdrawn"
        case .superseded: return "Superseded"
        case .sourceUnavailable: return "Source unavailable"
        case .addendaUnchecked: return "Addenda not recently checked"
        }
    }

    var belongsInCurrentSelection: Bool {
        switch self {
        case .current, .closingSoon, .addendaUnchecked: return true
        case .closedDemo, .withdrawn, .superseded, .sourceUnavailable: return false
        }
    }
}
```

Each Markdown body uses these exact H2 sections:

1. `What the official source says`
2. `Who might examine this opportunity`
3. `Questions to verify`
4. `Suggested first review steps`
5. `KinNoKi analysis`

The renderer labels frontmatter as source facts and the Markdown body as
editorial analysis. The shared disclaimer is:

> Planning aid only. Verify all requirements, deadlines, documents, and addenda
> at the linked official procurement source before acting or bidding.

---

### Task 1: Add failing tests for the section and data contract

**Files:**

- Create: `Tests/site/tender-showcase.test.mjs`
- Modify: `Tests/tools/generation-reproducibility.test.mjs`

- [ ] Add a source-contract test that reads `main.swift`,
  `TenderShowcase.swift`, the theme, `Resources/styles.css`, and all
  `Content/tenders/*.md` files.
- [ ] Assert the `.tenders` section, every metadata key, all seven lifecycle raw
  values, the exact disclaimer, and the five required H2 headings.
- [ ] Assert three to five entries have a current-selection lifecycle.
- [ ] Parse `firstAddedAt` and `closingAt`; assert every first-published current
  entry had at least `10 * 24 * 60 * 60 * 1000` milliseconds remaining.
- [ ] Assert no source file contains `AllSteel` or `Van Zutphen`.
- [ ] Add generated-route expectations for `/tenders/` and each item, but mark
  them as the final red assertions until Task 7 generates Output.
- [ ] Update the deterministic-generation fixture to create
  `Content/tenders/example.md`; expect four epochs:

```js
assert.deepEqual(
  run(),
  [expectedFeedEpoch, expectedFeedEpoch, expectedFeedEpoch, expectedFeedEpoch],
  'preflight must provide RSS, apps, posts, and tenders dates',
);
```

- [ ] Add `/tenders` to `sectionRoutes` with source `Content/tenders`.
- [ ] Run:

```bash
node --test Tests/site/tender-showcase.test.mjs
```

Expected: FAIL because the tender section/model/content do not exist.

- [ ] Run:

```bash
node --test Tests/tools/generation-reproducibility.test.mjs
```

Expected: FAIL because the preflight still returns only three epochs.

- [ ] Commit:

```bash
git add Tests/site/tender-showcase.test.mjs Tests/tools/generation-reproducibility.test.mjs
git commit -m "test(site): define tender showcase contract"
```

---

### Task 2: Verify and commit the editorial source records

**Files:**

- Create: `Content/tenders/<three-to-five-verified-slugs>.md`

- [ ] Open the public Nova Scotia Procurement Portal without logging in.
- [ ] For each seed, record the tender ID, canonical notice URL, issuer,
  procurement system, category, published date, closing date/time/timezone,
  delivery region, document access, addenda location/status, and current state.
- [ ] Open every authoritative link. Replace a seed if the link is unstable,
  the candidate has fewer than ten days remaining when first added, the public
  detail is insufficient, or the summary would require specialist inference.
- [ ] Draft each source file with concrete verified frontmatter. Use this exact
  shape (values below must be replaced only with facts read from that tender's
  official source):

```markdown
---
title: Street Recap., Intersection Reconfigurations, Traffic Calming and Sidewalk Renewals — Various
description: A source-linked starting brief for a current Nova Scotia public tender.
date: 2026-07-24 12:00
tenderID: HRM-2026-1026
issuer: Halifax Regional Municipality
procurementSystem: Nova Scotia Procurement Portal
category: Construction
deliveryRegion: Halifax Regional Municipality
publishedAt: 2026-07-24T00:00:00-03:00
closingAt: 2026-08-10T00:00:00-03:00
firstAddedAt: 2026-07-24T12:00:00-03:00
checkedAt: 2026-07-24T12:00:00-03:00
documentAccess: Public notice visible; linked documents must be verified at the official source.
addendaURL: https://procurement-portal.novascotia.ca/tenders/HRM-2026-1026
addendaStatus: Checked at the official source on 2026-07-24; verify again before acting.
lifecycle: current
noticeURL: https://procurement-portal.novascotia.ca/tenders/HRM-2026-1026
documentsURL: https://procurement-portal.novascotia.ca/tenders/HRM-2026-1026
featuredPack: true
---

## What the official source says

Write only verified public facts, with minimal quotation.

## Who might examine this opportunity

Describe apparent work types, never eligibility.

## Questions to verify

- List questions raised by the public material.

## Suggested first review steps

1. Open the official notice and confirm the current closing time.
2. Read the current documents and addenda before deciding whether to proceed.

## KinNoKi analysis

Explain the reusable workflow demonstrated by this example.
```

- [ ] Correct the example's date/time/timezone and document/addenda statements
  from the official detail before saving. The seed table proves only the listing
  text; it does not prove midnight closing or document access.
- [ ] Include exactly one `featuredPack: true`.
- [ ] Include no official tender document, customer data, invented capability,
  eligibility conclusion, price, takeoff, or private information.
- [ ] Commit before generation:

```bash
git add Content/tenders
git commit -m "feat(site): add tender showcase source records"
```

Expected: commit succeeds and `git status --short -- Content` is empty.

---

### Task 3: Implement deterministic section dates and RSS boundaries

**Files:**

- Modify: `Sources/KinNoKiLabsSite/main.swift`
- Modify: `Tools/prepare-deterministic-publish.mjs`
- Modify: `Makefile`
- Test: `Tests/tools/generation-reproducibility.test.mjs`

- [ ] Add `case tenders` to `SectionID`.
- [ ] Add the tender metadata fields from Shared Data Contract.
- [ ] Keep the public RSS limited to apps and posts:

```swift
.generateRSSFeed(
    including: Set([KinNoKiLabsSite.SectionID.apps, .posts]),
    date: rssDate
),
```

- [ ] Make the preflight emit the tender section epoch after apps/posts:

```js
const tendersEpoch = latestEpoch(['Content/tenders'], 'tenders section');
process.stdout.write(`${feedEpoch} ${appsEpoch} ${postsEpoch} ${tendersEpoch}`);
```

- [ ] Pass the fourth value in both `generate` and `preview`:

```make
KINNOKI_TENDERS_SECTION_DATE_EPOCH="$$4" \
```

- [ ] Run:

```bash
node --test Tests/tools/generation-reproducibility.test.mjs
```

Expected: PASS.

- [ ] Run:

```bash
swift build
```

Expected: PASS.

- [ ] Commit:

```bash
git add Sources/KinNoKiLabsSite/main.swift Tools/prepare-deterministic-publish.mjs Makefile Tests/tools/generation-reproducibility.test.mjs
git commit -m "feat(site): add deterministic tender section"
```

---

### Task 4: Implement validated hub and detail rendering

**Files:**

- Create: `Sources/KinNoKiLabsSite/TenderShowcase.swift`
- Modify: `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift`
- Test: `Tests/site/tender-showcase.test.mjs`

- [ ] Implement `TenderLifecycle` exactly as specified.
- [ ] Implement a throwing `TenderRecord` initializer that requires every source
  field, validates all URLs as HTTPS, parses all ISO timestamps, and rejects a
  `closingAt` earlier than `firstAddedAt`.
- [ ] Keep `sourceFacts` (metadata) and `editorialAnalysis` (`item.body.node`)
  separate in the renderer.
- [ ] Add these internal interfaces:

```swift
struct TenderRecord {
    let item: Item<KinNoKiLabsSite>
    let tenderID: String
    let issuer: String
    let procurementSystem: String
    let category: String
    let deliveryRegion: String
    let publishedAt: Date
    let closingAt: Date
    let firstAddedAt: Date
    let checkedAt: Date
    let documentAccess: String
    let addendaURL: URL
    let addendaStatus: String
    let lifecycle: TenderLifecycle
    let noticeURL: URL
    let documentsURL: URL
    let featuredPack: Bool
}

func tenderShowcaseMain(
    records: [TenderRecord]
) -> Node<HTML.BodyContext>

func tenderDetailMain(
    record: TenderRecord
) -> Node<HTML.BodyContext>
```

- [ ] The hub renders, in this order:

  1. Hero with “Tender Starter Showcase”
  2. “Current examples” containing three to five current-selection cards
  3. Featured demonstration with `/tenders/tender-starter-example.zip`
  4. Free-preview invitation naming the paid Tender-to-Bid Diagnostic
  5. Archived demonstrations (or a truthful empty state)

- [ ] Use this structured, percent-encoded request contract:

```text
mailto:hello@kinnokilabs.com
?subject=Free%20Custom%20Tender%20Preview%20Request
&body=Public%20tender%20URL%20or%20ID%3A%0A
Company%20or%20work%20type%3A%0A
Contact%20name%20and%20preferred%20reply%3A%0A
Why%20this%20may%20fit%3A%0A
```

- [ ] Route the section in `makeSectionHTML`:

```swift
case .tenders:
    let records = try section.items.map(TenderRecord.init(item:))
    return HTML(
        .lang(context.site.language),
        siteHead(for: section, context: context, titleOverride: "Tender Starter Showcase"),
        .body(
            .class("page-section page-tenders"),
            siteHeader(active: "/services"),
            tenderShowcaseMain(records: records),
            siteFooter()
        )
    )
```

- [ ] Route tender items before the app/post branch in `makeItemHTML`, using
  `.class("page-item page-tender-detail")`, Services as the active nav item, and
  `tenderDetailMain(record:)`.
- [ ] Every card/detail exposes the lifecycle label, `Checked
  <time datetime="…">…</time>`, official notice link, and disclaimer as text.
- [ ] Detail pages expose issuer, ID, category, delivery region, published,
  closing, document access, addenda status, official notice/documents/addenda
  links, then the five Markdown analysis sections.
- [ ] Do not use `Node.raw` for tender source values.
- [ ] Run:

```bash
swift build
node --test Tests/site/tender-showcase.test.mjs
```

Expected: Swift build PASS; source tests PASS; generated-route assertions remain
red until Task 7.

- [ ] Commit:

```bash
git add Sources/KinNoKiLabsSite/TenderShowcase.swift Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift Tests/site/tender-showcase.test.mjs
git commit -m "feat(site): render tender showcase and briefs"
```

---

### Task 5: Add accessible responsive presentation

**Files:**

- Modify: `Resources/styles.css`
- Test: `Tests/site/tender-showcase.test.mjs`

- [ ] Add tests for the single named CSS block, text-visible state classes,
  `:focus-visible`, responsive rules, reduced-motion rules, and print rules.
- [ ] Append one `/* ===== Tender Starter Showcase ===== */` block.
- [ ] Use `.tender-*` classes only. Minimum contract:

```text
.tender-main
.tender-hero
.tender-actions
.tender-source-note
.tender-current-grid
.tender-card
.tender-state
.tender-meta
.tender-feature
.tender-pack-list
.tender-preview
.tender-archive
.tender-detail
.tender-fact-grid
.tender-disclaimer
```

- [ ] Make cards one column by default, two columns above 700 px, and avoid
  fixed heights.
- [ ] Keep status meaning in visible text; color is supplemental.
- [ ] Give interactive links at least a 44 px touch target where rendered as
  buttons.
- [ ] Add print rules that remove global navigation/footer and CTAs while
  preserving source URLs, status, checked date, and disclaimer.
- [ ] Add reduced-motion overrides for every new transition/transform.
- [ ] Run:

```bash
node --test Tests/site/tender-showcase.test.mjs
```

Expected: CSS/source assertions PASS.

- [ ] Commit:

```bash
git add Resources/styles.css Tests/site/tender-showcase.test.mjs
git commit -m "feat(site): style tender showcase accessibly"
```

---

### Task 6: Build and verify the demonstration pack

**Required sub-skills:** Use `spreadsheets:Spreadsheets` for the XLSX and
`pdf:pdf` for the PDF creation/inspection workflow.

**Files:**

- Create: `Tools/tender-pack/guide.md`
- Create: `Tools/tender-pack/workbook.json`
- Create: `Tools/tender-pack/official-sources.txt`
- Create: `Tools/tender-pack/requirements.txt`
- Create: `Tools/build-tender-demo-pack.py`
- Create: `Resources/tenders/tender-starter-example.zip`
- Modify: `Makefile`
- Test: `Tests/site/tender-showcase.test.mjs`

- [ ] Write `guide.md` with: opportunity overview, limitations, review method,
  compliance-matrix explanation, review calendar, document checklist, addenda
  log, clarification log, RFQ tracker, estimate scaffold, official sources, and
  next-step explanation.
- [ ] Put the exact shared disclaimer on the first page and final page.
- [ ] Define these workbook sheets in `workbook.json`:

```json
[
  "Read Me",
  "Compliance Matrix",
  "Review Calendar",
  "Document Checklist",
  "Addenda Log",
  "Questions Log",
  "RFQ Tracker",
  "Estimate Scaffold"
]
```

- [ ] Use descriptive column headers, freeze the header row, enable filters,
  set practical widths, wrap long cells, and never encode status by color alone.
- [ ] Pin authoring-only packages:

```text
openpyxl==3.1.5
python-docx==1.2.0
pypdf==6.10.0
```

- [ ] Implement the script to:

  1. Load the reviewed Markdown/JSON/source-index inputs.
  2. Generate a semantic DOCX using real Heading 1/2 styles, `en-CA` document
     language, a non-empty title, and marked table header rows.
  3. Generate the XLSX with the sheet/accessibility conventions above.
  4. Export DOCX through LibreOffice Writer with:

```text
pdf:writer_pdf_Export:{"PDFUACompliance":{"type":"boolean","value":"true"},"UseTaggedPDF":{"type":"boolean","value":"true"},"ExportBookmarks":{"type":"boolean","value":"true"}}
```

  5. Verify PDF title, `/Lang` equals `en-CA`, `/MarkInfo`,
     `/StructTreeRoot`, and the `pdfuaid:part` XMP marker with `pypdf`.
  6. Create a deterministic ZIP with fixed entry timestamps and exactly:

```text
tender-starter-guide.pdf
tender-review-workbook.xlsx
official-sources.txt
```

  7. Reject an official-source index that lacks HTTPS links or contains a local
     path.

- [ ] Add a Make target:

```make
TENDER_PACK_PYTHON ?= python3
TENDER_PACK_SOFFICE ?= soffice

tender-pack:
	TENDER_PACK_SOFFICE="$(TENDER_PACK_SOFFICE)" \
	$(TENDER_PACK_PYTHON) Tools/build-tender-demo-pack.py
```

- [ ] Run with the Codex workspace runtimes:

```bash
TENDER_PACK_PYTHON="/Users/dfakkeldy/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3" \
TENDER_PACK_SOFFICE="/Users/dfakkeldy/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/soffice" \
make tender-pack
```

Expected: `Resources/tenders/tender-starter-example.zip` is created and the
script reports PDF/UA structure, eight XLSX sheets, and three ZIP entries.

- [ ] Extend the Node test with a small ZIP central-directory reader using
  `node:zlib.inflateRawSync`. Assert the three outer entries, the eight workbook
  sheet names, the disclaimer in `official-sources.txt`, and PDF byte markers
  `%PDF`, `/StructTreeRoot`, `/MarkInfo`, `/Lang`, and `pdfuaid:part`.
- [ ] Assert no ZIP entry name ends in `.doc`, `.docx`, or an official tender
  document filename.
- [ ] Run:

```bash
node --test Tests/site/tender-showcase.test.mjs
```

Expected: pack assertions PASS.

- [ ] Open the PDF with the PDF skill and inspect headings, reading order,
  tables, URLs, page breaks, and disclaimer placement.
- [ ] Open the XLSX with the spreadsheet skill and inspect all eight sheets,
  table headers, widths, wrap, filters, freeze panes, and keyboard readability.
- [ ] Commit:

```bash
git add Tools/tender-pack Tools/build-tender-demo-pack.py Resources/tenders/tender-starter-example.zip Makefile Tests/site/tender-showcase.test.mjs
git commit -m "feat(site): add tender starter demonstration pack"
```

---

### Task 7: Connect the showcase from Services

**Files:**

- Modify: `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift`
- Modify: `Content/services.md`
- Test: `Tests/site/general-tech-positioning.test.mjs`
- Test: `Tests/site/tender-showcase.test.mjs`

- [ ] Add a failing test for a Services proof callout linking to `/tenders/`.
- [ ] Insert one callout between the offer grid and “Why it pays”:

```html
<section class="reveal tender-proof-callout">
  <div>
    <p class="eyebrow">Proof of work</p>
    <h2>See a public tender turned into a practical starting workflow.</h2>
    <p>The Tender Starter Showcase demonstrates source-linked review, visible
    questions, and reusable bid-preparation structure without pretending to
    replace the official notice.</p>
  </div>
  <a class="btn btn-outline" href="/tenders/">Explore the Tender Starter Showcase</a>
</section>
```

- [ ] Add a matching Markdown link under Services “Examples” so source copy and
  rendered marketing copy both preserve the offer.
- [ ] Run:

```bash
node --test Tests/site/general-tech-positioning.test.mjs Tests/site/tender-showcase.test.mjs
```

Expected: PASS except generated-route assertions pending Task 8.

- [ ] Commit:

```bash
git add Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift Content/services.md Tests/site/general-tech-positioning.test.mjs Tests/site/tender-showcase.test.mjs
git commit -m "feat(site): connect services to tender showcase"
```

---

### Task 8: Generate Output and close the automated test loop

**Files:**

- Modify generated: `Output/**`
- Test: all suites

- [ ] Confirm content is clean:

```bash
git status --short -- Content
```

Expected: no output.

- [ ] Queue through the Mac build gate and generate:

```bash
"$HOME/.claude/bin/xcode-build-gate.sh" --wait && make generate
```

Expected: generation succeeds; `/tenders/index.html`, tender detail routes,
styles, sitemap, and ZIP are present in `Output/`.

- [ ] Run:

```bash
make test
swift build
```

Expected: all Node suites PASS; Swift build PASS.

- [ ] Verify generated parity in the tender test:

  - `Output/styles.css` equals `Resources/styles.css`
  - public ZIP bytes equal the resource ZIP
  - canonical hub URL is `https://kinnokilabs.com/tenders`
  - tender items are absent from `Output/feed.rss`
  - sitemap includes hub and detail routes
  - hub has three to five current cards and one featured pack
  - every detail has official links, checked date, lifecycle, fact/analysis
    separation, and disclaimer
  - request link points only to `hello@kinnokilabs.com` and has no upload/form

- [ ] Commit generated output:

```bash
git add Output Tests/site/tender-showcase.test.mjs
git commit -m "chore(site): generate tender starter showcase"
```

---

### Task 9: Editorial, accessibility, and responsive acceptance

**Files:** No source changes unless a defect is found.

- [ ] Run `make preview`.
- [ ] Inspect `/tenders/`, every tender detail, `/services/`, and the ZIP link at
  desktop and narrow-mobile widths.
- [ ] Keyboard-test skip link, navigation, cards, source links, pack download,
  preview CTA, and back links.
- [ ] Check heading order, visible focus, browser zoom at 200%, no horizontal
  scrolling at 320 px, status text without color, and readable print preview.
- [ ] Confirm the request CTA opens a pre-addressed draft but do not send it.
- [ ] Reopen every official source and recheck lifecycle, closing date/time,
  timezone, documents link, and addenda state. Correct/archive any drift and
  update `checkedAt`.
- [ ] Confirm no official tender PDF or copied package appears in the ZIP.
- [ ] Confirm all tender content is generic and contains no prospective-customer
  assertions.
- [ ] If any source changes, commit source records first, regenerate, rerun all
  tests, and commit the corrected Output separately.

---

### Task 10: Documentation and ready PR

**Files:**

- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

- [ ] Document:

  - `Content/tenders/` is manually curated and source-bounded
  - the seven lifecycle values
  - ten-day first-add rule
  - official-link/addenda recheck requirement
  - `make tender-pack`
  - no official tender document redistribution
  - commit Content before `make generate`

- [ ] Run the final verification:

```bash
"$HOME/.claude/bin/xcode-build-gate.sh" --wait && make test && swift build
git status --short --branch
```

Expected: all tests/build PASS; only intentional committed work exists.

- [ ] Rebase onto current main:

```bash
git fetch origin
git rebase origin/main
```

- [ ] If rebase rewrites generated inputs, rerun `make generate`, `make test`,
  and `swift build`; commit only if generated bytes legitimately changed.
- [ ] Push and open a ready PR to `main` only when Dan authorizes the
  implementation/public-content handoff:

```bash
git push -u origin codex/tender-showcase-plan
gh pr create --base main --head codex/tender-showcase-plan \
  --title "feat(site): add Tender Starter Showcase" \
  --body-file /tmp/tender-showcase-pr.md
```

- [ ] Report the exact reviewed head and hosted CI state. Do not merge the
  public-content PR without Dan's explicit authorization.

---

### Task 11: Post-merge production verification

**Files:** No source changes unless production differs.

- [ ] After authorized merge and Cloudflare deployment, verify the exact merged
  SHA is the production source.
- [ ] Open the custom-domain routes directly:

```text
https://kinnokilabs.com/tenders/
https://kinnokilabs.com/services/
https://kinnokilabs.com/tenders/<each-published-slug>/
https://kinnokilabs.com/tenders/tender-starter-example.zip
```

- [ ] Recheck canonical URLs, responsive rendering, console errors, pack
  download, official links, request draft, lifecycle/checked dates, and
  disclaimers.
- [ ] Record production proof separately from local tests, PR checks, and merge.
  Version one is not complete until this custom-domain verification passes.

## Self-Review Checklist

- [ ] Every approved page-hierarchy section is represented.
- [ ] Public facts and KinNoKi analysis have separate storage and presentation.
- [ ] Current, closing, archive, withdrawal, superseded, unavailable, and
  addenda-uncertain states are representable without color.
- [ ] The plan never requires a customer account, portal account, backend,
  upload, scraper, or automated bid decision.
- [ ] Tender content stays out of RSS.
- [ ] Source text is Plot-escaped; no public source value is interpolated into
  `Node.raw`.
- [ ] The pack contains original work only and is structurally tested.
- [ ] PDF accessibility uses tagged PDF/UA export and inspection, not a claim
  based only on visual appearance.
- [ ] The deterministic Publish preflight and generated Output discipline are
  respected.
- [ ] PR/deployment/local verification boundaries remain explicit.

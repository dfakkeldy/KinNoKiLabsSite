# PR #69 Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct every merge-blocking and material audit finding in KinNoKiLabsSite PR #69 while preserving authoritative-source boundaries, accessible artifacts, deterministic generation, and the existing review gate.

**Architecture:** Repair the source records and their contract tests before regenerating any public output. Harden the tender-pack builder so it normalizes the LibreOffice PDF Info dictionary, XMP timestamps, trailer identifier, and XLSX container metadata; verifies exact PDF language and list numbering; and proves reproducibility with two isolated builds before replacing the committed ZIP. Regenerate `Output/` only after the source and artifact layers are independently green.

**Tech Stack:** Swift 5.5 / Publish / Plot, Node.js built-in test runner, Python 3, python-docx 1.2.0, openpyxl 3.1.5, pypdf 6.10.0, LibreOffice Writer PDF/UA export, deterministic ZIP archives.

## Global Constraints

- Work from exact audited PR head `8f4bce92422222fac938b74c8ddc267ae5876003`; recheck the live PR head before implementation and reconcile this plan if it changed.
- Treat the Nova Scotia Procurement Portal detail pages as the authority for tender title, official category, closing time, document destination, and visible addenda state.
- Keep source facts in frontmatter and KinNoKi editorial analysis in Markdown body text; do not introduce an unlabeled editorial taxonomy into the source-facts block.
- Keep all official URLs HTTPS and do not redistribute official tender documents.
- Preserve the ten-calendar-day first-add rule and exactly one `featuredPack: true` record.
- Never edit `Output/` manually. Commit `Content/` changes before `make generate`.
- Tender items remain excluded from RSS.
- The demonstration pack must contain exactly `tender-starter-guide.pdf`, `tender-review-workbook.xlsx`, and `official-sources.txt`.
- The PDF must be tagged, carry a non-empty title, declare catalog `/Lang` exactly `en-CA`, include the disclaimer on the first and final pages, and render independent numbered lists with the intended numbering.
- The workbook must retain exactly eight named sheets, frozen header rows, autofilters, wrapped text, and readable column widths.
- `make tender-pack` must fail closed unless two isolated builds produce byte-identical ZIPs.
- Use the Codex bundled Python and LibreOffice binaries when available:

```bash
export TENDER_PACK_PYTHON="/Users/dfakkeldy/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
export TENDER_PACK_SOFFICE="/Users/dfakkeldy/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/soffice"
```

- Queue final site generation and verification through:

```bash
"$HOME/.claude/bin/xcode-build-gate.sh" --wait
```

- Do not push the remediated branch, update the governed PR, merge, or publish until Dan explicitly authorizes the reviewed head as ready.

---

## File Map

- `Content/tenders/*.md` — authoritative tender titles, official categories, notice/document/addenda URLs, lifecycle, and checked-on facts.
- `Tools/tender-pack/official-sources.txt` — downloadable traceability index containing the portal hub plus all four canonical notices and the three direct HRM document pages.
- `Tests/site/tender-showcase.test.mjs` — source-contract, generated-route, pack-content, PDF marker, and parity regression tests.
- `Tools/build-tender-demo-pack.py` — semantic DOCX/XLSX construction, exact PDF validation, PDF/XLSX inner-container normalization, two-build reproducibility proof, and atomic ZIP replacement.
- `Tools/tender-pack/guide.md` — ordered-list source whose two independent lists must remain independently numbered after PDF export.
- `Resources/tenders/tender-starter-example.zip` — reviewed generated pack source copied by Publish.
- `Output/tenders/**`, `Output/services/index.html`, `Output/sitemap.xml`, `Output/styles.css` — generated public site output; regenerate only.
- `docs/superpowers/plans/2026-07-24-tender-starter-showcase.md` — original implementation plan; amend only the acceptance clauses that were proven insufficient.

---

### Task 1: Lock the authoritative tender-record contract

**Files:**
- Modify: `Tests/site/tender-showcase.test.mjs:36-53`
- Modify: `Tests/site/tender-showcase.test.mjs:148-224`
- Modify: `Content/tenders/hrm-autobody-painting-service.md:1-19`
- Modify: `Content/tenders/hrm-cds-dvds-goods.md:1-19`
- Modify: `Content/tenders/hrm-street-recap-construction.md:1-19`
- Modify: `Content/tenders/nslc-agency-store-service.md:1-19`

**Interfaces:**
- Consumes: Publish’s built-in `title` frontmatter field and the existing custom tender metadata.
- Produces: Four source records whose public title, source category, and documents URL are exact and regression-tested.

- [ ] **Step 1: Add a failing exact-record contract**

Add this map near the existing test constants:

```js
const EXPECTED_TENDER_RECORDS = {
  'hrm-autobody-painting-service.md': {
    title: 'Autobody and Painting Services for HRM Light-Duty Vehicles (Halifax Location)',
    category: 'Services',
    noticeURL: 'https://procurement-portal.novascotia.ca/tenders/HRM-2026-0311',
    documentsURL:
      'https://halifax.bidsandtenders.ca/Module/Tenders/en/Tender/Detail/45c893f6-58cd-4ae0-9ae9-20c997bac53e',
  },
  'hrm-cds-dvds-goods.md': {
    title: "Standing Offer for the Supply & Delivery of CD's & DVD's",
    category: 'Goods',
    noticeURL: 'https://procurement-portal.novascotia.ca/tenders/HRM-2026-0372',
    documentsURL:
      'https://halifax.bidsandtenders.ca/Module/Tenders/en/Tender/Detail/01b4409a-8391-4417-8e89-cd90af6948aa',
  },
  'hrm-street-recap-construction.md': {
    title:
      'Street Recap. Intersection Reconfigurations, Traffic Calming and Sidewalk Renewals- Various',
    category: 'Construction',
    noticeURL: 'https://procurement-portal.novascotia.ca/tenders/HRM-2026-1026',
    documentsURL:
      'https://halifax.bidsandtenders.ca/Module/Tenders/en/Tender/Detail/b9edd22c-c23c-4a47-aada-587159f9ca58',
  },
  'nslc-agency-store-service.md': {
    title: 'NSLC Agency Store - Cornwallis',
    category: 'Services',
    noticeURL: 'https://procurement-portal.novascotia.ca/tenders/NSLC27-09',
    documentsURL: 'https://procurement-portal.novascotia.ca/tenders/NSLC27-09',
  },
};

function frontmatterValue(content, key) {
  return content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
}
```

Add the exact-value test:

```js
test('locks every public tender title and authoritative source fact', () => {
  assert.deepEqual(tenderFiles, Object.keys(EXPECTED_TENDER_RECORDS).sort());
  for (const file of tenderFiles) {
    const content = readFileSync(
      new URL(`../../Content/tenders/${file}`, import.meta.url),
      'utf8',
    );
    const expected = EXPECTED_TENDER_RECORDS[file];
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(frontmatterValue(content, key), value, `${file}: ${key}`);
    }
  }
});
```

- [ ] **Step 2: Run the focused test and verify the audit defects fail**

Run:

```bash
node --test Tests/site/tender-showcase.test.mjs
```

Expected: FAIL for all missing `title` values, for the two `Services` category mismatches, and for the three HRM `documentsURL` mismatches.

- [ ] **Step 3: Correct the four source records**

Insert these exact `title` and `category` values in frontmatter:

```yaml
# hrm-autobody-painting-service.md
title: Autobody and Painting Services for HRM Light-Duty Vehicles (Halifax Location)
category: Services

# hrm-cds-dvds-goods.md
title: Standing Offer for the Supply & Delivery of CD's & DVD's
category: Goods

# hrm-street-recap-construction.md
title: Street Recap. Intersection Reconfigurations, Traffic Calming and Sidewalk Renewals- Various
category: Construction

# nslc-agency-store-service.md
title: NSLC Agency Store - Cornwallis
category: Services
```

Replace the three HRM `documentsURL` values with the exact Halifax Bids and Tenders URLs from `EXPECTED_TENDER_RECORDS`. Keep the NSLC documents URL on its canonical portal notice because its document control is client-rendered rather than a stable public document URL.

- [ ] **Step 4: Recheck the authoritative pages before committing**

Open these four official detail records and confirm title, category, closing time, document link, and visible addenda state:

```text
https://procurement-portal.novascotia.ca/tenders/HRM-2026-0311
https://procurement-portal.novascotia.ca/tenders/HRM-2026-0372
https://procurement-portal.novascotia.ca/tenders/HRM-2026-1026
https://procurement-portal.novascotia.ca/tenders/NSLC27-09
```

If a lifecycle, deadline, or addenda state changed, correct that record and update `checkedAt` in the same source commit. Do not infer “no addenda” from a missing attachment; preserve the existing bounded wording unless the official detail proves a stronger fact.

- [ ] **Step 5: Run the focused source tests**

Run:

```bash
node --test Tests/site/tender-showcase.test.mjs
git diff --check
```

Expected: the exact-record contract passes; existing source-contract tests pass; `git diff --check` reports no errors.

- [ ] **Step 6: Commit the authoritative source correction**

```bash
git add \
  Content/tenders/hrm-autobody-painting-service.md \
  Content/tenders/hrm-cds-dvds-goods.md \
  Content/tenders/hrm-street-recap-construction.md \
  Content/tenders/nslc-agency-store-service.md \
  Tests/site/tender-showcase.test.mjs
git commit -m "fix(site): correct tender source records"
```

Expected: `git status --short -- Content` is empty before any generation step.

---

### Task 2: Make the downloadable source index traceable

**Files:**
- Modify: `Tools/tender-pack/official-sources.txt:10-18`
- Modify: `Tests/site/tender-showcase.test.mjs:286-295`

**Interfaces:**
- Consumes: The exact canonical notice and document URLs locked in Task 1.
- Produces: A detached, downloadable source index that can trace every showcase record without returning first to the website.

- [ ] **Step 1: Add a failing source-index completeness assertion**

Replace the single generic HTTPS assertion with:

```js
test('official-sources.txt names every notice and direct HRM document source', () => {
  const entries = readZipEntries(packBytes);
  const txt = entries.find((entry) => entry.name === 'official-sources.txt');
  assert.ok(txt, 'official-sources.txt must be in the pack');
  const text = txt.data.toString('utf8');

  assert.match(text, new RegExp(DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const expected of Object.values(EXPECTED_TENDER_RECORDS)) {
    assert.match(text, new RegExp(expected.noticeURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    if (expected.documentsURL !== expected.noticeURL) {
      assert.match(
        text,
        new RegExp(expected.documentsURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
    }
  }
  assert.doesNotMatch(text, /file:\/\//);
  assert.doesNotMatch(text, /\/Users\//);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --test Tests/site/tender-showcase.test.mjs
```

Expected: FAIL because the committed ZIP’s `official-sources.txt` contains only the portal hub URL.

- [ ] **Step 3: Replace the generic notice prose with exact source entries**

Use this source-index structure:

```text
Official notices (checked on 2026-07-24)
----------------------------------------
HRM-2026-0311 — Autobody and Painting Services for HRM Light-Duty Vehicles
https://procurement-portal.novascotia.ca/tenders/HRM-2026-0311
Documents:
https://halifax.bidsandtenders.ca/Module/Tenders/en/Tender/Detail/45c893f6-58cd-4ae0-9ae9-20c997bac53e

HRM-2026-0372 — Standing Offer for the Supply & Delivery of CD's & DVD's
https://procurement-portal.novascotia.ca/tenders/HRM-2026-0372
Documents:
https://halifax.bidsandtenders.ca/Module/Tenders/en/Tender/Detail/01b4409a-8391-4417-8e89-cd90af6948aa

HRM-2026-1026 — Street Recapitalization and Related Construction
https://procurement-portal.novascotia.ca/tenders/HRM-2026-1026
Documents:
https://halifax.bidsandtenders.ca/Module/Tenders/en/Tender/Detail/b9edd22c-c23c-4a47-aada-587159f9ca58

NSLC27-09 — NSLC Agency Store - Cornwallis
https://procurement-portal.novascotia.ca/tenders/NSLC27-09
Documents are accessed from the official notice above.
```

Keep the disclaimer, verification discipline, and no-redistribution statement unchanged.

- [ ] **Step 4: Run the source-level checks**

The committed ZIP is intentionally still stale at this checkpoint, so first validate the reviewed source directly:

```bash
rg -n "HRM-2026-0311|HRM-2026-0372|HRM-2026-1026|NSLC27-09|halifax\\.bidsandtenders\\.ca" \
  Tools/tender-pack/official-sources.txt
git diff --check
```

Expected: four canonical notice URLs, three direct HRM document URLs, and no whitespace errors.

- [ ] **Step 5: Commit the source-index correction**

```bash
git add Tools/tender-pack/official-sources.txt Tests/site/tender-showcase.test.mjs
git commit -m "fix(site): complete tender pack source index"
```

The focused pack test remains red until Task 3 rebuilds the committed ZIP; this is an intentional source-before-generated checkpoint.

---

### Task 3: Make the pack builder reproducible and verify the PDF contract

**Files:**
- Modify: `Tools/build-tender-demo-pack.py:17-91`
- Modify: `Tools/build-tender-demo-pack.py:106-217`
- Modify: `Tools/build-tender-demo-pack.py:222-287`
- Modify: `Tests/site/tender-showcase.test.mjs:297-308`

**Interfaces:**
- Consumes: `guide.md`, `workbook.json`, `official-sources.txt`, and `TENDER_PACK_SOFFICE`.
- Produces: `build_pack_bytes(soffice: str) -> bytes`, exact PDF validation, normalized PDF/XLSX bytes, and a two-build reproducibility gate before `OUTPUT_ZIP` replacement.

- [ ] **Step 1: Tighten the committed PDF marker test**

Change the Node assertion from “some `/Lang` exists” to the required locale:

```js
assert.match(full, /\/Lang\s*\(en-CA\)/);
```

Keep the `%PDF`, `/StructTreeRoot`, `/MarkInfo`, and `pdfuaid:part` assertions.

- [ ] **Step 2: Run the focused test and verify the current PDF fails**

Run:

```bash
node --test Tests/site/tender-showcase.test.mjs
```

Expected: FAIL because the committed PDF contains `/Lang(en-US)`.

- [ ] **Step 3: Define one fixed document instant**

Add:

```python
from datetime import datetime, timezone

FIXED_INSTANT = datetime(2026, 7, 24, 12, 0, 0, tzinfo=timezone.utc)
FIXED_EPOCH = int(FIXED_INSTANT.timestamp())
FIXED_PDF_DATE = "D:20260724120000+00'00'"
FIXED_XMP_DATE = b"2026-07-24T12:00:00Z"
FIXED_TIMESTAMP = (2026, 7, 24, 12, 0, 0)
```

Remove the old duplicate `FIXED_TIMESTAMP` declaration.

- [ ] **Step 4: Set DOCX metadata and style language explicitly**

Add:

```python
def set_style_language(doc, language: str):
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    for style_name in (
        "Normal",
        "Title",
        "Heading 1",
        "Heading 2",
        "List Bullet",
        "List Number",
    ):
        style = doc.styles[style_name]
        run_properties = style.element.get_or_add_rPr()
        language_element = run_properties.find(qn("w:lang"))
        if language_element is None:
            language_element = OxmlElement("w:lang")
            run_properties.append(language_element)
        language_element.set(qn("w:val"), language)
        language_element.set(qn("w:eastAsia"), language)
        language_element.set(qn("w:bidi"), language)
```

In `build_docx`, set:

```python
doc.core_properties.language = "en-CA"
doc.core_properties.title = "Tender Starter Guide"
doc.core_properties.created = FIXED_INSTANT.replace(tzinfo=None)
doc.core_properties.modified = FIXED_INSTANT.replace(tzinfo=None)
set_style_language(doc, "en-CA")
```

- [ ] **Step 5: Restart independent numbered-list blocks**

Track whether the previous emitted line was numbered. When a numbered list begins after non-list content, allocate a fresh Word numbering instance with start override `1`; reuse that instance for the rest of the contiguous list.

Add these helpers:

```python
def list_number_abstract_id(doc) -> int:
    from docx.oxml.ns import qn

    style_id = doc.styles["List Number"].style_id
    numbering = doc.part.numbering_part.element
    for abstract in numbering.findall(qn("w:abstractNum")):
        for paragraph_style in abstract.findall(f".//{qn('w:pStyle')}"):
            if paragraph_style.get(qn("w:val")) == style_id:
                return int(abstract.get(qn("w:abstractNumId")))
    raise RuntimeError("List Number abstract numbering definition not found")


def fresh_numbering_id(doc, abstract_id: int) -> int:
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    numbering = doc.part.numbering_part.element
    existing = [
        int(element.get(qn("w:numId")))
        for element in numbering.findall(qn("w:num"))
    ]
    num_id = max(existing, default=0) + 1
    num = OxmlElement("w:num")
    num.set(qn("w:numId"), str(num_id))
    abstract = OxmlElement("w:abstractNumId")
    abstract.set(qn("w:val"), str(abstract_id))
    num.append(abstract)
    override = OxmlElement("w:lvlOverride")
    override.set(qn("w:ilvl"), "0")
    start = OxmlElement("w:startOverride")
    start.set(qn("w:val"), "1")
    override.append(start)
    num.append(override)
    numbering.append(num)
    return num_id


def apply_numbering(paragraph, num_id: int):
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    properties = paragraph._p.get_or_add_pPr()
    num_properties = properties.find(qn("w:numPr"))
    if num_properties is None:
        num_properties = OxmlElement("w:numPr")
        properties.append(num_properties)
    level = OxmlElement("w:ilvl")
    level.set(qn("w:val"), "0")
    number = OxmlElement("w:numId")
    number.set(qn("w:val"), str(num_id))
    num_properties.append(level)
    num_properties.append(number)
```

Initialize `numbering_id = None` before the Markdown loop. For a numbered line, allocate a fresh ID when `numbering_id is None`, create the `List Number` paragraph, and apply that ID. Set `numbering_id = None` whenever a nonblank, non-numbered source line is emitted.

- [ ] **Step 6: Pass the fixed epoch to LibreOffice**

Pass a copied environment to `subprocess.run`:

```python
export_environment = os.environ.copy()
export_environment["SOURCE_DATE_EPOCH"] = str(FIXED_EPOCH)
result = subprocess.run(
    cmd,
    capture_output=True,
    text=True,
    timeout=120,
    env=export_environment,
)
```

Do not treat that environment variable as the reproducibility mechanism. A local probe against the installed LibreOffice build showed that it still writes wall-clock XMP dates, an Info-dictionary creation date, and a derived trailer `/ID`; Step 7 must normalize those fields explicitly.

- [ ] **Step 7: Normalize PDF metadata, trailer ID, and unreachable objects**

Add `import re`, then add this post-export normalizer:

```python
def normalize_pdf(pdf_path: Path):
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(str(pdf_path))
    writer = PdfWriter(clone_from=reader)
    xmp = writer.xmp_metadata
    if xmp is None:
        raise RuntimeError("Cannot normalize PDF without XMP metadata")

    original_xmp = xmp.stream.get_data()
    normalized_xmp, replacement_count = re.subn(
        rb"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})",
        FIXED_XMP_DATE,
        original_xmp,
    )
    if replacement_count == 0:
        raise RuntimeError("Expected LibreOffice XMP timestamps were not found")
    writer.xmp_metadata = normalized_xmp

    writer.metadata = None
    writer.add_metadata(
        {
            "/Title": "Tender Starter Guide",
            "/Author": "KinNoKi Labs",
            "/Creator": "KinNoKi Labs deterministic tender-pack builder",
            "/Producer": "LibreOffice normalized by pypdf",
            "/CreationDate": FIXED_PDF_DATE,
            "/ModDate": FIXED_PDF_DATE,
        }
    )

    # The cloned LibreOffice file carries its old XMP object and trailer ID.
    # Remove unreachable objects, then derive one ID from the normalized structure.
    writer.compress_identical_objects(
        remove_duplicates=True,
        remove_unreferenced=True,
    )
    writer._ID = None  # pypdf 6.10 has no public API to clear a cloned trailer ID.
    writer.generate_file_identifiers()

    temporary = pdf_path.with_suffix(".normalized.pdf")
    writer.write(temporary)
    temporary.replace(pdf_path)
```

Call `normalize_pdf(pdf_path)` immediately after `export_pdfua` and before `verify_pdf`. The pinned `pypdf==6.10.0` dependency makes the deliberate `_ID` compatibility boundary explicit. Do not delete `/Metadata`: the XMP packet carries the PDF/UA declaration that verification must preserve.

Add a regression assertion inside `verify_pdf` after loading the XMP packet:

```python
xmp_bytes = reader.xmp_metadata.stream.get_data() if reader.xmp_metadata else b""
if b"pdfuaid:part" not in xmp_bytes:
    errors.append("missing pdfuaid:part (PDF/UA marker)")
if FIXED_XMP_DATE not in xmp_bytes:
    errors.append("XMP timestamps were not normalized")
```

- [ ] **Step 8: Normalize XLSX properties and member timestamps**

Before `wb.save`:

```python
wb.properties.created = FIXED_INSTANT.replace(tzinfo=None)
wb.properties.modified = FIXED_INSTANT.replace(tzinfo=None)
```

Add a general Office-container normalizer:

```python
def normalize_zip_container(path: Path):
    original = path.read_bytes()
    with tempfile.TemporaryDirectory(prefix="normalize-office-") as directory:
        source = Path(directory) / "source.zip"
        normalized = Path(directory) / "normalized.zip"
        source.write_bytes(original)
        with zipfile.ZipFile(source, "r") as reader:
            entries = [(info.filename, reader.read(info.filename)) for info in reader.infolist()]
        create_deterministic_zip(normalized, sorted(entries))
        path.write_bytes(normalized.read_bytes())
```

Call `normalize_zip_container(xlsx_path)` immediately after `build_xlsx`.

- [ ] **Step 9: Validate exact PDF language and independent list numbering**

In `verify_pdf`, replace the token-only language check with:

```python
catalog_language = str(reader.trailer["/Root"].get("/Lang", ""))
if catalog_language != "en-CA":
    errors.append(f"catalog /Lang must be en-CA, found {catalog_language or 'missing'}")
```

Extract the two list anchors:

```python
extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
if "1. Open the official notice" not in extracted:
    errors.append("review-method list must start at 1")
if "1. Recheck the official notice" not in extracted:
    errors.append("next-steps list must restart at 1")
if "6. Recheck the official notice" in extracted:
    errors.append("next-steps list incorrectly continues at 6")
```

Keep the title, marked, structure-tree, and PDF/UA XMP checks.

- [ ] **Step 10: Build twice before atomically replacing the committed ZIP**

Extract the existing temporary build into:

```python
def build_pack_bytes(soffice: str) -> bytes:
    guide_text = GUIDE_MD.read_text(encoding="utf-8")
    workbook_data = json.loads(WORKBOOK_JSON.read_text(encoding="utf-8"))
    sources_text = SOURCES_TXT.read_text(encoding="utf-8")
    validate_sources(sources_text)

    with tempfile.TemporaryDirectory(prefix="tender-pack-build-") as work_dir:
        work = Path(work_dir)
        docx_path = work / "tender-starter-guide.docx"
        pdf_path = work / "tender-starter-guide.pdf"
        xlsx_path = work / "tender-review-workbook.xlsx"
        zip_path = work / "tender-starter-example.zip"

        build_docx(guide_text, docx_path)
        export_pdfua(docx_path, pdf_path, soffice)
        normalize_pdf(pdf_path)
        verify_pdf(pdf_path)
        build_xlsx(workbook_data, xlsx_path)
        normalize_zip_container(xlsx_path)
        create_deterministic_zip(
            zip_path,
            [
                ("tender-starter-guide.pdf", pdf_path.read_bytes()),
                ("tender-review-workbook.xlsx", xlsx_path.read_bytes()),
                ("official-sources.txt", sources_text.encode("utf-8")),
            ],
        )
        return zip_path.read_bytes()
```

Make `main` compare two builds before replacement:

```python
first = build_pack_bytes(soffice)
second = build_pack_bytes(soffice)
if first != second:
    raise RuntimeError(
        "Tender pack is not reproducible: two isolated builds produced different bytes"
    )
OUTPUT_ZIP.parent.mkdir(parents=True, exist_ok=True)
temporary_output = OUTPUT_ZIP.with_suffix(".zip.tmp")
temporary_output.write_bytes(first)
temporary_output.replace(OUTPUT_ZIP)
print("Reproducibility: verified with two byte-identical isolated builds")
```

- [ ] **Step 11: Run the builder twice and prove stable bytes**

Run:

```bash
before="$(shasum -a 256 Resources/tenders/tender-starter-example.zip | awk '{print $1}')"
TENDER_PACK_PYTHON="$TENDER_PACK_PYTHON" \
TENDER_PACK_SOFFICE="$TENDER_PACK_SOFFICE" \
make tender-pack
first="$(shasum -a 256 Resources/tenders/tender-starter-example.zip | awk '{print $1}')"
TENDER_PACK_PYTHON="$TENDER_PACK_PYTHON" \
TENDER_PACK_SOFFICE="$TENDER_PACK_SOFFICE" \
make tender-pack
second="$(shasum -a 256 Resources/tenders/tender-starter-example.zip | awk '{print $1}')"
test "$first" = "$second"
printf 'old=%s\nnew=%s\nrepeat=%s\n' "$before" "$first" "$second"
```

Expected: both builder runs report exact-language and reproducibility success; `first` equals `second`. The new hash may differ from the pre-remediation committed pack.

- [ ] **Step 12: Run the focused pack tests**

```bash
node --test Tests/site/tender-showcase.test.mjs
git diff --check
```

Expected: exact `/Lang(en-CA)`, source-index completeness, pack inventory, and source contracts pass.

- [ ] **Step 13: Commit the deterministic artifact builder and reviewed pack**

```bash
git add \
  Tools/build-tender-demo-pack.py \
  Tests/site/tender-showcase.test.mjs \
  Resources/tenders/tender-starter-example.zip
git commit -m "fix(site): make tender pack reproducible"
```

---

### Task 4: Inspect the rebuilt PDF and workbook

**Required sub-skills:** Use `pdf:pdf` for PDF rendering/structure inspection and `spreadsheets:Spreadsheets` for workbook inspection/rendering.

**Files:**
- Verify: `Resources/tenders/tender-starter-example.zip`
- Modify only if a defect is found: `Tools/build-tender-demo-pack.py`
- Modify only if source copy is wrong: `Tools/tender-pack/guide.md`
- Modify only if workbook source is wrong: `Tools/tender-pack/workbook.json`

**Interfaces:**
- Consumes: The deterministic ZIP from Task 3.
- Produces: Human visual acceptance evidence for the exact bytes that will be copied into `Output/`.

- [ ] **Step 1: Extract the three reviewed artifacts to a temporary directory**

```bash
inspection_dir="$(mktemp -d /tmp/pr69-remediation-pack.XXXXXX)"
unzip -q Resources/tenders/tender-starter-example.zip -d "$inspection_dir"
unzip -l Resources/tenders/tender-starter-example.zip
```

Expected: exactly the three approved filenames and no DOC/DOCX or official tender package.

- [ ] **Step 2: Inspect PDF structure and extracted text**

Use the bundled Python:

```bash
"$TENDER_PACK_PYTHON" - "$inspection_dir/tender-starter-guide.pdf" <<'PY'
from pypdf import PdfReader
import sys

reader = PdfReader(sys.argv[1])
root = reader.trailer["/Root"]
text = "\n".join(page.extract_text() or "" for page in reader.pages)
assert str(root.get("/Lang")) == "en-CA"
assert root.get("/StructTreeRoot") is not None
assert bool(root.get("/MarkInfo", {}).get("/Marked"))
assert "1. Open the official notice" in text
assert "1. Recheck the official notice" in text
assert "6. Recheck the official notice" not in text
assert text.count(
    "Planning aid only. Verify all requirements, deadlines, documents, and addenda"
) == 2
print(f"pages={len(reader.pages)} lang={root.get('/Lang')}")
PY
```

Expected: two pages, exact `en-CA`, both lists begin at 1, and the disclaimer appears on the first and final page.

- [ ] **Step 3: Render and visually inspect every PDF page**

Use the PDF skill to render all pages. Confirm:

- no clipping, overlap, missing glyphs, or unexpected page break;
- headings have a clear hierarchy;
- both ordered lists visibly begin at 1;
- disclaimer is readable on page 1 and page 2;
- no official tender document content appears.

- [ ] **Step 4: Inspect and render every workbook sheet**

Use the spreadsheet skill to inspect and render:

```text
Read Me
Compliance Matrix
Review Calendar
Document Checklist
Addenda Log
Questions Log
RFQ Tracker
Estimate Scaffold
```

Confirm frozen header rows, filters, wrapped text, practical widths, readable headers, and no formula errors or clipped cells. Confirm status meaning is textual and not color-only.

- [ ] **Step 5: Repair and repeat if visual inspection finds a defect**

Change only the responsible source (`guide.md`, `workbook.json`, or builder), rerun:

```bash
TENDER_PACK_PYTHON="$TENDER_PACK_PYTHON" \
TENDER_PACK_SOFFICE="$TENDER_PACK_SOFFICE" \
make tender-pack
node --test Tests/site/tender-showcase.test.mjs
```

Repeat the complete PDF/workbook visual pass against the new exact ZIP bytes.

- [ ] **Step 6: Commit only if inspection required a correction**

```bash
git add \
  Tools/tender-pack/guide.md \
  Tools/tender-pack/workbook.json \
  Tools/build-tender-demo-pack.py \
  Resources/tenders/tender-starter-example.zip \
  Tests/site/tender-showcase.test.mjs
git diff --cached --quiet || git commit -m "fix(site): polish tender pack artifacts"
```

---

### Task 5: Regenerate public output and close the automated loop

**Files:**
- Modify generated: `Output/services/index.html`
- Modify generated: `Output/sitemap.xml`
- Modify generated: `Output/tenders/index.html`
- Modify generated: `Output/tenders/*/index.html`
- Modify generated: `Output/tenders/tender-starter-example.zip`
- Verify generated: `Output/styles.css`
- Modify: `docs/superpowers/plans/2026-07-24-tender-starter-showcase.md`

**Interfaces:**
- Consumes: Committed source records and deterministic resource ZIP.
- Produces: Generated output whose public titles, source facts, document links, and pack bytes match reviewed sources.

- [ ] **Step 1: Add generated-title and exact-link assertions before generation**

Extend the detail-page test:

```js
test('generated tender pages use human titles and exact official links', () => {
  const hub = readFileSync(outputHub, 'utf8');
  for (const [file, expected] of Object.entries(EXPECTED_TENDER_RECORDS)) {
    const slug = file.replace(/\.md$/, '');
    const detail = readFileSync(
      new URL(`../../Output/tenders/${slug}/index.html`, import.meta.url),
      'utf8',
    );
    assert.match(hub, new RegExp(escapeRegex(`<h3>${expected.title}</h3>`)));
    assert.match(detail, new RegExp(escapeRegex(`<h1>${expected.title}</h1>`)));
    assert.match(detail, new RegExp(escapeRegex(`<dd>${expected.category}</dd>`)));
    assert.match(detail, new RegExp(escapeRegex(`href="${expected.noticeURL}"`)));
    assert.match(detail, new RegExp(escapeRegex(`href="${expected.documentsURL}"`)));
    assert.doesNotMatch(detail, new RegExp(`<h1>${escapeRegex(slug)}</h1>`));
  }
});
```

Add once near the constants:

```js
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- [ ] **Step 2: Run the focused test and verify stale Output fails**

```bash
node --test Tests/site/tender-showcase.test.mjs
```

Expected: FAIL because committed generated pages still contain filename titles, stale categories/URLs, and the old pack.

- [ ] **Step 3: Confirm Content is committed and generate**

```bash
test -z "$(git status --porcelain=v1 --untracked-files=all -- Content)"
"$HOME/.claude/bin/xcode-build-gate.sh" --wait
make generate
```

Expected: Publish regenerates the tender hub, four detail pages, service page, sitemap, and public ZIP from reviewed sources.

- [ ] **Step 4: Amend the original plan’s acceptance contract**

In `docs/superpowers/plans/2026-07-24-tender-starter-showcase.md`, add these exact acceptance requirements:

- every tender record has a reviewed human-readable `title`;
- source categories match the authoritative portal exactly;
- `documentsURL` uses the direct official document destination when the portal exposes one;
- `official-sources.txt` includes each canonical notice and every stable direct documents URL;
- PDF catalog `/Lang` must equal `en-CA`, not merely exist;
- independent numbered lists must restart at 1;
- two isolated pack builds must be byte-identical, including PDF and XLSX payloads.

- [ ] **Step 5: Run focused and full verification**

```bash
node --test Tests/site/tender-showcase.test.mjs
make test
swift build
git diff --check
```

Expected:

- tender test: 0 failures;
- full Node suite: 0 failures;
- Swift build complete;
- no whitespace errors.

- [ ] **Step 6: Verify generated parity and repeat generation**

```bash
cmp Resources/styles.css Output/styles.css
cmp Resources/tenders/tender-starter-example.zip \
  Output/tenders/tender-starter-example.zip
make generate
git diff --exit-code
```

Expected: source/generated CSS and ZIP bytes match; a second generation leaves the worktree unchanged.

- [ ] **Step 7: Commit generated output and acceptance-contract updates**

```bash
git add \
  Output \
  Tests/site/tender-showcase.test.mjs \
  docs/superpowers/plans/2026-07-24-tender-starter-showcase.md
git commit -m "chore(site): regenerate remediated tender showcase"
```

---

### Task 6: Perform manual acceptance and prepare the governed PR handoff

**Files:** No source changes unless a defect is found.

**Interfaces:**
- Consumes: The final local remediation head and generated output from Task 5.
- Produces: An exact-head readiness report; it does not itself authorize push, merge, or deployment.

- [ ] **Step 1: Start the local preview**

```bash
"$HOME/.claude/bin/xcode-build-gate.sh" --wait
make preview
```

- [ ] **Step 2: Inspect all affected routes**

Check at desktop width and 320 CSS pixels:

```text
/services/
/tenders/
/tenders/hrm-autobody-painting-service/
/tenders/hrm-cds-dvds-goods/
/tenders/hrm-street-recap-construction/
/tenders/nslc-agency-store-service/
/tenders/tender-starter-example.zip
```

Confirm:

- human-readable titles appear in cards, H1s, browser titles, and social metadata;
- official categories are shown in source facts;
- each Official documents link reaches the intended official destination;
- checked dates, lifecycle labels, addenda wording, and disclaimer remain visible;
- keyboard focus order and focus indicators are usable;
- there is no horizontal overflow at 320 pixels;
- print preview retains source URLs, state, checked date, and disclaimer;
- the request CTA opens a pre-addressed draft without sending it.

- [ ] **Step 3: Recheck perishable official facts one final time**

Reopen the four portal records. Confirm closing times, lifecycle, document destinations, and visible addenda state. If anything changed:

1. update the relevant `Content/tenders/*.md` source;
2. update `checkedAt`;
3. commit Content before generation;
4. rebuild the pack if the source index changed;
5. rerun Tasks 4 and 5 completely.

- [ ] **Step 4: Record exact local readiness**

```bash
git status --short --branch
git log -1 --format='%H %s'
gh pr view 69 --repo dfakkeldy/KinNoKiLabsSite \
  --json headRefOid,baseRefOid,state,mergeable,statusCheckRollup,url
```

Report:

- repository and PR number;
- remediation purpose;
- exact local reviewed head;
- current remote PR head;
- whether the local head is ahead and unpushed;
- local generation/test/build results;
- manual PDF/XLSX/site acceptance results;
- hosted CI remains evidence for the old remote head until an authorized push triggers fresh checks.

- [ ] **Step 5: Stop at the governance gate**

Do not push or update PR #69 until Dan explicitly says the reviewed remediation head is ready.

After authorization:

```bash
git fetch origin
git rebase origin/main
```

If the rebase rewrites any content or generator input, rerun Tasks 3 through 6. Then update the existing PR branch with:

```bash
git push --force-with-lease origin HEAD:codex/tender-showcase-plan
```

Wait for fresh hosted checks on the new exact head. Do not treat the old green Cloudflare result for `8f4bce9` as current after the push, and do not merge without separate authorization.

---

## Self-Review Checklist

- [ ] Every audit finding has a failing regression or a builder fail-closed check before its fix.
- [ ] Human titles replace filename fallbacks in source and generated HTML.
- [ ] Official categories remain source facts; editorial groupings are not smuggled into that block.
- [ ] All stable HRM document destinations are direct and authoritative.
- [ ] The downloaded source index traces all four notices and three direct HRM document pages.
- [ ] PDF catalog language equals `en-CA`.
- [ ] Both numbered PDF lists visibly and extractably begin at 1.
- [ ] PDF and XLSX internal metadata/member timestamps are normalized.
- [ ] Two isolated pack builds are byte-identical before the committed ZIP is replaced.
- [ ] The rebuilt PDF and all eight workbook sheets pass visual inspection.
- [ ] `Resources/` and `Output/` ZIP bytes match.
- [ ] A second `make generate` produces no diff.
- [ ] Full tests and Swift build pass.
- [ ] Perishable tender facts are rechecked immediately before the readiness handoff.
- [ ] No push, merge, or production claim crosses the explicit governance gate.

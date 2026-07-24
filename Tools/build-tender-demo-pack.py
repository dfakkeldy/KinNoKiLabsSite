#!/usr/bin/env python3
"""Build the deterministic Tender Starter demonstration pack.

Reads reviewed plain-text sources from Tools/tender-pack/ and produces:
  1. A semantic DOCX from guide.md (en-CA, real heading styles, table headers).
  2. A PDF/UA-tagged PDF exported from the DOCX via LibreOffice Writer.
  3. An accessible XLSX from workbook.json (frozen headers, filters, wrap, widths).
  4. A deterministic ZIP with exactly three fixed-timestamp entries.

The script verifies the PDF for tagged-PDF / PDF/UA structure markers using
pypdf and rejects an official-sources index that lacks HTTPS links or contains
a local path.

Authoring-only dependencies: openpyxl, python-docx, pypdf (see requirements.txt).
"""

import hashlib
import json
import os
import struct
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

# --- Paths ------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
PACK_DIR = REPO_ROOT / "Tools" / "tender-pack"
GUIDE_MD = PACK_DIR / "guide.md"
WORKBOOK_JSON = PACK_DIR / "workbook.json"
SOURCES_TXT = PACK_DIR / "official-sources.txt"
OUTPUT_ZIP = REPO_ROOT / "Resources" / "tenders" / "tender-starter-example.zip"

DISCLAIMER = (
    "Planning aid only. Verify all requirements, deadlines, documents, and "
    "addenda at the linked official procurement source before acting or bidding."
)

# Fixed ZIP entry timestamps for determinism (2026-07-24 12:00:00 UTC).
FIXED_TIMESTAMP = (2026, 7, 24, 12, 0, 0)


def main():
    soffice = os.environ.get("TENDER_PACK_SOFFICE", "soffice")
    guide_text = GUIDE_MD.read_text(encoding="utf-8")
    workbook_data = json.loads(WORKBOOK_JSON.read_text(encoding="utf-8"))
    sources_text = SOURCES_TXT.read_text(encoding="utf-8")

    # Validate official-sources index.
    validate_sources(sources_text)

    with tempfile.TemporaryDirectory(prefix="tender-pack-") as work_dir:
        work = Path(work_dir)
        docx_path = work / "tender-starter-guide.docx"
        pdf_path = work / "tender-starter-guide.pdf"
        xlsx_path = work / "tender-review-workbook.xlsx"

        # 1. Generate DOCX.
        build_docx(guide_text, docx_path)

        # 2. Export PDF/UA via LibreOffice Writer.
        export_pdfua(docx_path, pdf_path, soffice)

        # 3. Verify PDF structure.
        verify_pdf(pdf_path)

        # 4. Generate XLSX.
        build_xlsx(workbook_data, xlsx_path)

        # 5. Create deterministic ZIP.
        OUTPUT_ZIP.parent.mkdir(parents=True, exist_ok=True)
        create_deterministic_zip(
            OUTPUT_ZIP,
            [
                ("tender-starter-guide.pdf", pdf_path.read_bytes()),
                ("tender-review-workbook.xlsx", xlsx_path.read_bytes()),
                ("official-sources.txt", sources_text.encode("utf-8")),
            ],
        )

    # Report.
    pdf_bytes = OUTPUT_ZIP.read_bytes()
    sha = hashlib.sha256(pdf_bytes).hexdigest()
    print(f"Created: {OUTPUT_ZIP.relative_to(REPO_ROOT)}")
    print(f"Size: {len(pdf_bytes)} bytes")
    print(f"SHA-256: {sha}")
    print("PDF/UA structure: verified (StructTreeRoot, MarkInfo, Lang, pdfuaid:part)")
    print(f"XLSX sheets: {len(workbook_data['sheets'])}")
    print("ZIP entries: tender-starter-guide.pdf, tender-review-workbook.xlsx, official-sources.txt")


# --- Source validation ------------------------------------------------------

def validate_sources(text: str):
    """Reject an official-sources index lacking HTTPS links or containing a local path."""
    if "https://" not in text:
        raise ValueError("official-sources.txt must contain at least one HTTPS link")
    if "file://" in text or "/Users/" in text:
        raise ValueError("official-sources.txt must not contain local file paths")


# --- DOCX -------------------------------------------------------------------

def build_docx(guide_md: str, output: Path):
    from docx import Document
    from docx.shared import Pt, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc = Document()
    # en-CA document language
    doc.core_properties.language = "en-CA"
    doc.core_properties.title = "Tender Starter Guide"

    lines = guide_md.split("\n")
    first_heading = True
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("> "):
            # Blockquote — render as indented italic paragraph.
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.3)
            run = p.add_run(stripped[2:].strip())
            run.italic = True
            run.font.size = Pt(11)
        elif stripped.startswith("## "):
            doc.add_heading(stripped[3:].strip(), level=2)
            if first_heading:
                first_heading = False
        elif stripped.startswith("# "):
            doc.add_heading(stripped[2:].strip(), level=1)
            if first_heading:
                first_heading = False
        elif stripped.startswith("---"):
            continue
        elif stripped.startswith("- ") or stripped.startswith("* "):
            doc.add_paragraph(stripped[2:].strip(), style="List Bullet")
        elif stripped[0:2].rstrip(".").isdigit() and "." in stripped[:4]:
            # Numbered list item.
            parts = stripped.split(". ", 1)
            if len(parts) == 2:
                doc.add_paragraph(parts[1].strip(), style="List Number")
            else:
                doc.add_paragraph(stripped)
        else:
            doc.add_paragraph(stripped)

    doc.save(str(output))


# --- PDF/UA export ----------------------------------------------------------

def export_pdfua(docx_path: Path, pdf_path: Path, soffice: str):
    """Export a tagged PDF/UA-compliant PDF via LibreOffice Writer."""
    filter_data = (
        '{"PDFUACompliance":{"type":"boolean","value":"true"},'
        '"UseTaggedPDF":{"type":"boolean","value":"true"},'
        '"ExportBookmarks":{"type":"boolean","value":"true"}}'
    )
    cmd = [
        soffice,
        "--headless",
        "--norestore",
        "--nolockcheck",
        "--convert-to",
        f'pdf:writer_pdf_Export:{filter_data}',
        "--outdir",
        str(pdf_path.parent),
        str(docx_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice PDF export failed:\n{result.stderr}")

    # LibreOffice names the output after the input; rename if needed.
    produced = pdf_path.parent / (docx_path.stem + ".pdf")
    if produced != pdf_path and produced.exists():
        produced.rename(pdf_path)

    if not pdf_path.exists():
        raise RuntimeError("PDF was not produced")


# --- PDF verification -------------------------------------------------------

def verify_pdf(pdf_path: Path):
    from pypdf import PdfReader

    reader = PdfReader(str(pdf_path))
    raw = pdf_path.read_bytes()
    head = raw[:4096].decode("latin1")
    full = raw.decode("latin1")

    errors = []
    if not head.startswith("%PDF"):
        errors.append("missing %PDF header")
    if "/StructTreeRoot" not in full:
        errors.append("missing /StructTreeRoot (tagged PDF)")
    if "/MarkInfo" not in full:
        errors.append("missing /MarkInfo")
    if "/Lang" not in full:
        errors.append("missing /Lang")
    if "pdfuaid:part" not in full:
        errors.append("missing pdfuaid:part (PDF/UA marker)")

    # Check title.
    meta = reader.metadata
    if not meta or not (meta.title or "").strip():
        errors.append("missing document title")

    if errors:
        raise RuntimeError(f"PDF structure verification failed: {'; '.join(errors)}")

    print(f"PDF verified: {len(reader.pages)} page(s), title='{meta.title}'")


# --- XLSX -------------------------------------------------------------------

def build_xlsx(data: dict, output: Path):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    # Remove default sheet.
    wb.remove(wb.active)

    header_font = Font(name="Arial", bold=True, size=11, color="FFFFFF")
    header_fill = PatternFill(start_color="2C2C2E", end_color="2C2C2E", fill_type="solid")
    header_align = Alignment(horizontal="left", vertical="center", wrap_text=True)
    cell_align = Alignment(horizontal="left", vertical="top", wrap_text=True)
    body_font = Font(name="Arial", size=11)

    for sheet_def in data["sheets"]:
        ws = wb.create_sheet(title=sheet_def["name"])
        headers = sheet_def["headers"]
        rows = sheet_def.get("rows", [])

        # Write headers.
        for col_idx, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_idx, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_align

        # Write data rows.
        for row_idx, row_data in enumerate(rows, 2):
            for col_idx, value in enumerate(row_data, 1):
                cell = ws.cell(row=row_idx, column=col_idx, value=value)
                cell.font = body_font
                cell.alignment = cell_align

        # Freeze header row.
        ws.freeze_panes = "A2"

        # Enable autofilter on header row.
        if rows:
            last_col = get_column_letter(len(headers))
            ws.auto_filter.ref = f"A1:{last_col}{len(rows) + 1}"

        # Set practical column widths.
        for col_idx, header in enumerate(headers, 1):
            max_len = len(header)
            for row_data in rows:
                if col_idx <= len(row_data) and row_data[col_idx - 1]:
                    max_len = max(max_len, min(len(str(row_data[col_idx - 1])), 50))
            ws.column_dimensions[get_column_letter(col_idx)].width = min(max(max_len + 4, 12), 55)

    wb.save(str(output))


# --- Deterministic ZIP ------------------------------------------------------

def create_deterministic_zip(output: Path, entries: list[tuple[str, bytes]]):
    """Create a ZIP with fixed entry timestamps and no compression-level variance."""
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(str(output), "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for name, data in entries:
            # Reset all entry metadata to fixed values for reproducibility.
            info = zipfile.ZipInfo(filename=name, date_time=FIXED_TIMESTAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16  # regular file permissions
            info.create_system = 3  # Unix
            zf.writestr(info, data)


if __name__ == "__main__":
    main()

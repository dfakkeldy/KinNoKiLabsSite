"""Parse public Halifax rack postings without changing or filling source data.

Prices are Canadian cents per litre. Source parsers round stored binary tails
to 0.01 cent; window means retain their full Decimal precision. These rack
prices are market inputs, not Nova Scotia's regulated commodity benchmark.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from html.parser import HTMLParser
from io import BytesIO
import posixpath
import re
import xml.etree.ElementTree as ET
from zipfile import BadZipFile, ZipFile


_NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
       "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
       "p": "http://schemas.openxmlformats.org/package/2006/relationships"}
_CENT_PRECISION = Decimal("0.01")
_NUMBER = re.compile(r"[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?\Z")
_MONTHS = {name: index for index, name in enumerate(
    ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), 1)}
_WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def _text(value: str) -> str:
    return " ".join(value.split())


def _price(value, *, normalize: bool = False) -> Decimal:
    raw = str(value).strip()
    if not _NUMBER.fullmatch(raw):
        raise ValueError(f"Invalid rack price: {raw!r}")
    try:
        result = Decimal(raw)
        if not result.is_finite() or result <= 0:
            raise ValueError(f"Rack price must be finite and positive: {raw!r}")
        if normalize:
            result = result.quantize(_CENT_PRECISION, rounding=ROUND_HALF_UP)
            if result <= 0:
                raise ValueError(f"Rack price rounds to zero: {raw!r}")
        return result
    except InvalidOperation as error:
        raise ValueError(f"Invalid rack price: {raw!r}") from error


def _kalibrate_date(value: str) -> date:
    match = re.fullmatch(r"([A-Za-z]{3})\s+([0-9]{2})-([A-Za-z]{3})-([0-9]{2})", value)
    if not match or match[3].lower() not in _MONTHS:
        raise ValueError(f"Invalid Kalibrate date: {value!r}")
    try:
        result = date(2000 + int(match[4]), _MONTHS[match[3].lower()], int(match[2]))
    except ValueError as error:
        raise ValueError(f"Invalid Kalibrate date: {value!r}") from error
    if match[1].lower() != _WEEKDAYS[result.weekday()]:
        raise ValueError(f"Kalibrate weekday disagrees with date: {value!r}")
    return result


def _xlsx_rows(content: bytes) -> dict[int, dict[str, tuple[str, bool]]]:
    """Read actual XML cells, deliberately ignoring worksheet dimensions."""
    try:
        with ZipFile(BytesIO(content)) as archive:
            workbook = ET.fromstring(archive.read("xl/workbook.xml"))
            sheets = [sheet for sheet in workbook.findall("s:sheets/s:sheet", _NS)
                      if sheet.get("name") == "Prices"]
            if len(sheets) != 1:
                raise ValueError("Kalibrate workbook must contain one Prices sheet")
            rel_id = sheets[0].get(f"{{{_NS['r']}}}id")
            relations = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
            targets = [relation.get("Target", "")
                       for relation in relations.findall("p:Relationship", _NS)
                       if relation.get("Id") == rel_id
                       and relation.get("Type", "").endswith("/worksheet")
                       and relation.get("TargetMode") != "External"]
            if len(targets) != 1:
                raise ValueError("Kalibrate Prices worksheet relationship is missing")
            target = posixpath.normpath(posixpath.join("xl", targets[0])).lstrip("/")
            if not target.startswith("xl/"):
                raise ValueError("Invalid Kalibrate worksheet path")
            shared = []
            if "xl/sharedStrings.xml" in archive.namelist():
                strings = ET.fromstring(archive.read("xl/sharedStrings.xml"))
                shared = ["".join(item.itertext()) for item in strings.findall("s:si", _NS)]
            worksheet = ET.fromstring(archive.read(target))
            rows = {}
            for row in worksheet.findall("s:sheetData/s:row", _NS):
                row_number = int(row.attrib["r"])
                if row_number <= 0 or row_number in rows:
                    raise ValueError("Invalid or duplicate Kalibrate row")
                cells = {}
                for cell in row.findall("s:c", _NS):
                    address = re.fullmatch(r"([A-Z]+)([1-9][0-9]*)", cell.get("r", ""))
                    if not address or int(address[2]) != row_number or address[1] in cells:
                        raise ValueError("Invalid or duplicate Kalibrate cell address")
                    value = cell.findtext("s:v", default="", namespaces=_NS)
                    kind = cell.get("t", "n")
                    if kind == "s":
                        index = int(value)
                        if index < 0 or index >= len(shared):
                            raise ValueError("Invalid Kalibrate shared-string reference")
                        value = shared[index]
                    elif kind == "inlineStr":
                        inline = cell.find("s:is", _NS)
                        value = "".join(inline.itertext()) if inline is not None else ""
                    numeric = kind == "n" and cell.find("s:f", _NS) is None
                    cells[address[1]] = (_text(value), numeric)
                rows[row_number] = cells
            return rows
    except (BadZipFile, KeyError, ET.ParseError, UnicodeError, OverflowError) as error:
        raise ValueError("Invalid Kalibrate XLSX response") from error


def parse_kalibrate_xlsx(content: bytes, as_of: date | None = None) -> dict[date, Decimal]:
    """Read Halifax E10 daily rack quotes through as_of, defaulting to today."""
    cutoff = as_of if as_of is not None else date.today()
    rows = _xlsx_rows(content)
    title = rows.get(1, {}).get("B", ("", False))[0]
    units = rows.get(2, {}).get("A", ("", False))[0]
    description = rows.get(2, {}).get("B", ("", False))[0].casefold()
    if title.casefold() not in {"e10", "e10 / e10"}:
        raise ValueError("Kalibrate source is not the E10 product")
    if units.casefold() != "c/litre" or not all(word in description for word in ("wholesale", "rack")):
        raise ValueError("Kalibrate source must report wholesale rack cents per litre")
    columns = [column for column, (value, _) in rows.get(3, {}).items()
               if value.rstrip("*").strip().casefold() == "halifax"]
    if len(columns) != 1:
        raise ValueError("Kalibrate source must have exactly one Halifax column")
    prices = {}
    for row_number, cells in sorted(rows.items()):
        if row_number <= 3:
            continue
        value, numeric = cells.get(columns[0], ("", False))
        if not value:
            continue
        day = _kalibrate_date(cells.get("A", ("", False))[0])
        if day > cutoff:
            continue
        if not numeric:
            raise ValueError(f"Kalibrate rack price is not a numeric cell on {day}")
        if day in prices:
            raise ValueError(f"Duplicate Kalibrate rack date: {day}")
        prices[day] = _price(value, normalize=True)
    return prices


class _NRCanTable(HTMLParser):
    """Capture only the named data table, including its own caption."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.count = 0
        self.active = False
        self.closed = False
        self.caption_active = False
        self.caption = []
        self.rows = []
        self.row = None
        self.cell = None
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            if self.active:
                raise ValueError("Nested NRCan price tables are unsupported")
            if dict(attrs).get("id") == "pricesTable":
                self.count += 1
                if self.count > 1:
                    raise ValueError("Duplicate NRCan pricesTable")
                self.active = True
        if not self.active:
            return
        if tag == "caption":
            self.caption_active = True
        elif tag == "tr":
            if self.row is not None:
                raise ValueError("Unclosed NRCan price row")
            self.row = []
        elif tag in {"td", "th"}:
            if self.row is None or self.cell is not None:
                raise ValueError("Malformed NRCan price cell")
            self.cell, self.parts = tag, []

    def handle_data(self, data):
        if self.active and self.caption_active:
            self.caption.append(data)
        if self.active and self.cell is not None:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if not self.active:
            return
        if tag in {"td", "th"}:
            if self.cell != tag:
                raise ValueError("Malformed NRCan price cell ending")
            self.row.append((tag, _text("".join(self.parts))))
            self.cell, self.parts = None, []
        elif tag == "tr":
            if self.row is None or self.cell is not None:
                raise ValueError("Malformed NRCan price row ending")
            self.rows.append(self.row)
            self.row = None
        elif tag == "caption":
            self.caption_active = False
        elif tag == "table":
            if self.row is not None or self.cell is not None or self.caption_active:
                raise ValueError("Truncated NRCan pricesTable")
            self.active, self.closed = False, True


def parse_nrcan_html(content: str, as_of: date | None = None) -> dict[date, Decimal]:
    """Read the daily regular-gasoline Halifax column in NRCan's pricesTable."""
    cutoff = as_of if as_of is not None else date.today()
    table = _NRCanTable()
    table.feed(content)
    table.close()
    if table.count != 1 or not table.closed:
        raise ValueError("NRCan pricesTable is missing or incomplete")
    caption = _text("".join(table.caption)).casefold()
    if (not caption.startswith("daily average wholesale") or "rack" not in caption
            or not re.search(r"\bregular\s+gasoline\b", caption)
            or not re.search(r"\bcents\s+per\s+litre\b", caption)):
        raise ValueError("NRCan source must report daily regular wholesale rack cents per litre")
    headings = [row for row in table.rows if row and all(kind == "th" for kind, _ in row)]
    if len(headings) != 1:
        raise ValueError("NRCan price column headings are missing or ambiguous")
    headers = [value.casefold() for _, value in headings[0]]
    if headers.count("halifax") != 1 or headers.count("day of") != 1:
        raise ValueError("NRCan source must contain one Day of and one Halifax column")
    date_column, price_column = headers.index("day of"), headers.index("halifax")
    prices = {}
    for row in table.rows:
        if not row or all(kind == "th" for kind, _ in row):
            continue
        if len(row) != len(headers) or any(kind != "td" for kind, _ in row):
            raise ValueError("NRCan data row does not match its column headings")
        value = row[price_column][1]
        if not value:
            continue
        raw_date = row[date_column][1]
        if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", raw_date):
            raise ValueError(f"Invalid NRCan rack date: {raw_date!r}")
        day = date.fromisoformat(raw_date)
        if day > cutoff:
            continue
        if day in prices:
            raise ValueError(f"Duplicate NRCan rack date: {day}")
        prices[day] = _price(value, normalize=True)
    return prices


def verify_overlap(primary: dict[date, Decimal], secondary: dict[date, Decimal],
                   as_of: date, minimum_matches: int = 10) -> dict:
    """Require enough matching independently retrieved quotes through as_of."""
    if isinstance(minimum_matches, bool) or not isinstance(minimum_matches, int) or minimum_matches < 1:
        raise ValueError("minimum_matches must be a positive integer")
    days = sorted(day for day in primary.keys() & secondary.keys() if day <= as_of)
    for day in days:
        first, second = _price(primary[day]), _price(secondary[day])
        if first != second:
            raise ValueError(f"Rack sources disagree on {day}: {first} versus {second} cents/L")
    if len(days) < minimum_matches:
        raise ValueError(f"Insufficient overlapping rack quotes: {len(days)}; need {minimum_matches}")
    return {"matched_count": len(days), "dates": days}


def rack_window(start: date, end: date, racks: dict[date, Decimal],
                available_through: date | None = None) -> dict:
    """Average an inclusive interval requiring every weekday's posted quote.

    Weekday holidays still require their actual posted row. No quote is
    carried, interpolated, or accepted after available_through.
    """
    cutoff = available_through if available_through is not None else date.today()
    if end < start:
        raise ValueError("Rack window ends before it starts")
    observations = []
    day = start
    while day <= end:
        if day.weekday() < 5:
            if day > cutoff:
                raise ValueError(f"Rack window requires an unavailable future quote on {day}")
            if day not in racks:
                raise ValueError(f"Missing posted weekday rack quote on {day}")
            observations.append({"date": day, "price": _price(racks[day])})
        day += timedelta(days=1)
    if not observations:
        raise ValueError("Rack window contains no weekdays")
    latest = observations[-1]
    return {"mean": sum((row["price"] for row in observations), Decimal("0")) / len(observations),
            "latest": latest["price"], "latest_date": latest["date"],
            "start": start, "end": end, "observations": observations}

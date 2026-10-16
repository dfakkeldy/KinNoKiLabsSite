import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "engine"))

"""Rack-source contracts using small synthetic XLSX and HTML fixtures."""

from datetime import date
from decimal import Decimal as D
from html import escape
from io import BytesIO
from pathlib import Path
import unittest
from zipfile import ZipFile

import rack_data


AS_OF = date(2026, 10, 15)


def xlsx_fixture(prices, *, title="E10 / E10", units="c/litre",
                 description="Wholesale (Rack) Price", city="HALIFAX*",
                 numeric_type="n"):
    """A small source workbook using inline text and a false used range."""
    namespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    relationship = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

    def text_cell(address, value):
        return (f'<c r="{address}" t="inlineStr"><is><t>'
                f'{escape(value)}</t></is></c>')

    rows = [f'<row r="1">{text_cell("A1", "2026")}'
            f'{text_cell("B1", title)}</row>',
            f'<row r="2">{text_cell("A2", units)}'
            f'{text_cell("B2", description)}</row>',
            f'<row r="3">{text_cell("B3", "SAINT JOHN")}'
            f'{text_cell("C3", city)}</row>']
    for index, (day, price) in enumerate(prices, 4):
        price_cell = (f'<c r="C{index}" t="{numeric_type}">'
                      f'<v>{escape(str(price))}</v></c>') if price is not None else ""
        rows.append(f'<row r="{index}">{text_cell(f"A{index}", day)}'
                    f'{price_cell}</row>')
    stream = BytesIO()
    with ZipFile(stream, "w") as archive:
        archive.writestr("xl/workbook.xml", f'<workbook xmlns="{namespace}" '
                         f'xmlns:r="{relationship}"><sheets>'
                         '<sheet name="Prices" sheetId="1" r:id="rId1"/>'
                         '</sheets></workbook>')
        archive.writestr("xl/_rels/workbook.xml.rels",
                         '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                         f'<Relationship Id="rId1" Type="{relationship}/worksheet" '
                         'Target="worksheets/sheet1.xml"/></Relationships>')
        archive.writestr("xl/worksheets/sheet1.xml",
                         f'<worksheet xmlns="{namespace}"><dimension ref="A1:A1"/>'
                         f'<sheetData>{"".join(rows)}</sheetData></worksheet>')
    return stream.getvalue()


def html_fixture(prices, *, product="Regular Gasoline", units="Cents per Litre",
                 city="Halifax", frequency="Daily", table_id="pricesTable"):
    rows = "".join(f'<tr><td>{escape(day)}</td><td>{escape(str(price))}</td></tr>'
                   for day, price in prices)
    return (f'<table id="{table_id}"><caption>{frequency} Average Wholesale (Rack) '
            f'Prices for {product} ({units})</caption><thead><tr><th>Day of</th>'
            f'<th>{city}</th></tr></thead><tbody>{rows}</tbody></table>')


class RackTests(unittest.TestCase):


    def test_kalibrate_as_of_excludes_later_numeric_quotes(self):
        content = xlsx_fixture([("Wed 14-Oct-26", "136.3"),
                                ("Thu 15-Oct-26", "137.2")])
        got = rack_data.parse_kalibrate_xlsx(content, date(2026, 10, 14))
        self.assertEqual(got, {date(2026, 10, 14): D("136.30")})

    def test_kalibrate_binary_price_tail_normalizes_to_one_hundredth_cent(self):
        content = xlsx_fixture([("Wed 14-Oct-26", "136.29999999999998")])
        got = rack_data.parse_kalibrate_xlsx(content, AS_OF)
        self.assertEqual(str(got[date(2026, 10, 14)]), "136.30")

    def test_kalibrate_rejects_a_different_product(self):
        content = xlsx_fixture([("Wed 14-Oct-26", "136.3")], title="Diesel")
        with self.assertRaises(ValueError):
            rack_data.parse_kalibrate_xlsx(content, AS_OF)

    def test_kalibrate_rejects_wrong_units_or_retail_context(self):
        for kwargs in ({"units": "dollars/gallon"}, {"description": "Retail Price"}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                rack_data.parse_kalibrate_xlsx(
                          xlsx_fixture([("Wed 14-Oct-26", "136.3")], **kwargs), AS_OF)

    def test_kalibrate_rejects_missing_halifax_column(self):
        with self.assertRaises(ValueError):
            rack_data.parse_kalibrate_xlsx(xlsx_fixture(
                [("Wed 14-Oct-26", "136.3")], city="DARTMOUTH"), AS_OF)

    def test_kalibrate_rejects_invalid_prices(self):
        for price in ("broken", "NaN", "Infinity", "-Infinity", "0", "-1"):
            with self.subTest(price=price), self.assertRaises(ValueError):
                rack_data.parse_kalibrate_xlsx(
                          xlsx_fixture([("Wed 14-Oct-26", price)]), AS_OF)

    def test_kalibrate_rejects_boolean_or_error_price_cells(self):
        for numeric_type in ("b", "e"):
            with self.subTest(numeric_type=numeric_type), self.assertRaises(ValueError):
                rack_data.parse_kalibrate_xlsx(xlsx_fixture(
                    [("Wed 14-Oct-26", "1")], numeric_type=numeric_type), AS_OF)

    def test_kalibrate_rejects_duplicate_or_invalid_dates(self):
        for rows in ([("Wed 14-Oct-26", "136.3"), ("Wed 14-Oct-26", "137.2")],
                     [("Wed 32-Oct-26", "136.3")]):
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                rack_data.parse_kalibrate_xlsx(xlsx_fixture(rows), AS_OF)

    def test_kalibrate_rejects_an_html_error_response(self):
        with self.assertRaises(ValueError):
            rack_data.parse_kalibrate_xlsx(b"<html>Not Found</html>", AS_OF)



    def test_nrcan_ignores_prices_outside_its_price_table(self):
        other = html_fixture([("2026-10-14", "999")], table_id="other")
        own = html_fixture([("2026-10-14", "136.3")])
        got = rack_data.parse_nrcan_html(other + own, AS_OF)
        self.assertEqual(got, {date(2026, 10, 14): D("136.30")})

    def test_nrcan_as_of_excludes_later_numeric_quotes(self):
        content = html_fixture([("2026-10-14", "136.3"), ("2026-10-15", "137.2")])
        got = rack_data.parse_nrcan_html(content, date(2026, 10, 14))
        self.assertEqual(got, {date(2026, 10, 14): D("136.30")})

    def test_nrcan_requires_regular_daily_wholesale_context_in_the_target_table(self):
        for kwargs in ({"product": "Diesel"}, {"frequency": "Weekly"},
                       {"units": "Dollars per Gallon"}, {"city": "Toronto"}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                content = html_fixture([("2026-10-14", "136.3")], **kwargs)
                rack_data.parse_nrcan_html(content, AS_OF)

    def test_nrcan_rejects_a_missing_duplicate_or_truncated_target_table(self):
        own = html_fixture([("2026-10-14", "136.3")])
        for content in ("<html>Unavailable</html>", own + own, own[:-8]):
            with self.subTest(content=content[:40]), self.assertRaises(ValueError):
                rack_data.parse_nrcan_html(content, AS_OF)

    def test_nrcan_rejects_duplicate_dates_and_invalid_prices(self):
        bad_rows = [[("2026-10-14", "136.3"), ("2026-10-14", "137.2")]]
        bad_rows += [[("2026-10-14", price)]
                     for price in ("broken", "NaN", "Infinity", "0", "-1")]
        for rows in bad_rows:
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                rack_data.parse_nrcan_html(html_fixture(rows), AS_OF)

    def test_nrcan_blank_prices_remain_missing(self):
        content = html_fixture([("2026-10-14", ""), ("2026-10-15", "137.2")])
        got = rack_data.parse_nrcan_html(content, AS_OF)
        self.assertNotIn(date(2026, 10, 14), got)
        self.assertEqual(got[AS_OF], D("137.20"))


    def test_overlap_rejects_a_one_hundredth_cent_disagreement(self):
        with self.assertRaises(ValueError):
            rack_data.verify_overlap({AS_OF: D("137.20")},
                      {AS_OF: D("137.21")}, AS_OF, minimum_matches=1)

    def test_overlap_requires_enough_observed_days(self):
        with self.assertRaises(ValueError):
            rack_data.verify_overlap({AS_OF: D("137.2")},
                      {AS_OF: D("137.2")}, AS_OF)

    def test_overlap_excludes_future_dates_and_orders_matches(self):
        primary = {date(2026, 10, 16): D("999"), AS_OF: D("137.20"),
                   date(2026, 10, 14): D("136.30")}
        secondary = {date(2026, 10, 16): D("1"), AS_OF: D("137.2"),
                     date(2026, 10, 14): D("136.3")}
        got = rack_data.verify_overlap(primary, secondary, AS_OF, minimum_matches=2)
        self.assertEqual(got, {"matched_count": 2,
                               "dates": [date(2026, 10, 14), AS_OF]})

    def test_overlap_rejects_nonfinite_prices_and_invalid_minimum(self):
        for price, minimum in ((D("NaN"), 1), (D("0"), 1), (D("137"), 0)):
            with self.subTest(price=price, minimum=minimum), self.assertRaises(ValueError):
                rack_data.verify_overlap({AS_OF: price}, {AS_OF: price},
                          AS_OF, minimum_matches=minimum)

    def test_window_uses_each_posted_weekday_including_a_holiday(self):
        racks = {date(2026, 10, 8): D("138.20"), date(2026, 10, 9): D("137.00"),
                 date(2026, 10, 12): D("137.00"), date(2026, 10, 13): D("138.50"),
                 date(2026, 10, 14): D("136.30"), date(2026, 10, 10): D("999")}
        got = rack_data.rack_window(date(2026, 10, 8), date(2026, 10, 14),
                        racks, available_through=AS_OF)
        self.assertEqual(got["mean"], D("137.40"))
        self.assertEqual(got["latest"], D("136.30"))
        self.assertEqual(got["latest_date"], date(2026, 10, 14))
        self.assertEqual(got["start"], date(2026, 10, 8))
        self.assertEqual(got["end"], date(2026, 10, 14))
        self.assertEqual(got["observations"], [
            {"date": date(2026, 10, 8), "price": D("138.20")},
            {"date": date(2026, 10, 9), "price": D("137.00")},
            {"date": date(2026, 10, 12), "price": D("137.00")},
            {"date": date(2026, 10, 13), "price": D("138.50")},
            {"date": date(2026, 10, 14), "price": D("136.30")},
        ])

    def test_window_does_not_round_the_mean_early(self):
        got = rack_data.rack_window(date(2026, 10, 14), AS_OF,
                        {date(2026, 10, 14): D("100.00"), AS_OF: D("100.01")},
                        available_through=AS_OF)
        self.assertEqual(got["mean"], D("100.005"))

    def test_window_rejects_a_missing_holiday_quote_instead_of_carrying(self):
        with self.assertRaises(ValueError):
            rack_data.rack_window(date(2026, 10, 9), date(2026, 10, 13),
                      {date(2026, 10, 9): D("137"), date(2026, 10, 13): D("138.5")},
                      available_through=AS_OF)

    def test_window_rejects_future_required_days_even_if_values_exist(self):
        with self.assertRaises(ValueError):
            rack_data.rack_window(AS_OF, date(2026, 10, 16),
                      {AS_OF: D("137.2"), date(2026, 10, 16): D("138")},
                      available_through=AS_OF)

    def test_window_can_end_on_a_future_weekend_without_future_weekday_data(self):
        got = rack_data.rack_window(date(2026, 10, 16), date(2026, 10, 18),
                        {date(2026, 10, 16): D("138")},
                        available_through=date(2026, 10, 16))
        self.assertEqual(got["latest_date"], date(2026, 10, 16))

    def test_window_rejects_invalid_intervals_and_prices(self):
        for start, end, racks in ((AS_OF, date(2026, 10, 14), {}),
                                  (date(2026, 10, 17), date(2026, 10, 18), {}),
                                  (AS_OF, AS_OF, {AS_OF: D("0")}),
                                  (AS_OF, AS_OF, {AS_OF: D("NaN")})):
            with self.subTest(start=start, end=end, racks=racks), self.assertRaises(ValueError):
                rack_data.rack_window(start, end, racks, available_through=AS_OF)


if __name__ == "__main__":
    unittest.main()

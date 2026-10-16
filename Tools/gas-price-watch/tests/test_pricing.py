import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "engine"))

from datetime import date
from decimal import Decimal as D
from pathlib import Path
import unittest

import pricing

SOURCES = Path(__file__).parent / "fixtures"


class PricingTests(unittest.TestCase):
    def test_current_order_all_six_zones(self):
        expected = [("192.9", "195.8"), ("193.4", "196.4"),
                    ("193.9", "196.9"), ("194.0", "197.0"),
                    ("194.0", "197.0"), ("194.8", "197.8")]
        for zone, want in enumerate(expected, 1):
            got = pricing.calculate(date(2026, 10, 9), zone, D("124.12"),
                                    D("0"), D("10.13"), D("0.9"))
            self.assertEqual((str(got["minimum"]), str(got["maximum"])), want)

    def test_older_policy_and_carbon_charge(self):
        got = pricing.calculate(date(2025, 1, 3), 1, D("73.48"),
                                D("0.3"), D("1.82"), D("0.3"))
        self.assertEqual(got["minimum"], D("159.7"))
        self.assertEqual(got["maximum"], D("162.0"))

    def test_april_2025_tax_and_credit_adjustments(self):
        got = pricing.calculate(date(2025, 4, 4), 1, D("79.05"),
                                D("0"), D("2.55"), D("4.0"))
        self.assertEqual(got["minimum"], D("149.3"))
        self.assertEqual(got["maximum"], D("151.6"))

    def test_excise_suspension_and_return_have_effective_dates(self):
        self.assertEqual(pricing.policy(date(2026, 4, 19))["excise"], D("10"))
        self.assertEqual(pricing.policy(date(2026, 4, 20))["excise"], D("0"))
        self.assertEqual(pricing.policy(date(2027, 2, 1))["excise"], D("5"))
        self.assertEqual(pricing.policy(date(2027, 4, 1))["excise"], D("10"))

    def test_blend_uses_daily_fx_before_averaging(self):
        rows = [dict(cbob_low="3", cbob_high="3", ethanol_low="2", ethanol_high="2", fx="1.25"),
                dict(cbob_low="4", cbob_high="4", ethanol_low="2", ethanol_high="2", fx="1.50")]
        self.assertEqual(pricing.blend_benchmark(rows), D("123.17"))

    def test_invalid_blend_rejected(self):
        with self.assertRaises(ValueError):
            pricing.blend_benchmark([])
        with self.assertRaises(ValueError):
            pricing.calculate(date(2026, 10, 9), 7, D("124"), D("0"), D("10"), D("1"))

    def test_current_pdf_text_parses(self):
        order = pricing.parse_order((SOURCES / "orders/2026-10-09.txt").read_text(),
                                    date(2026, 10, 9), "source")
        self.assertEqual(order["benchmark"], D("124.12"))
        self.assertEqual(order["credit_card"], D("0.90"))
        self.assertEqual(order["clean_fuel"], D("10.13"))
        self.assertEqual(order["zones"][5]["minimum"], D("194.8"))

    def test_spaced_signs_parse_and_diesel_only_carries_gas(self):
        order = pricing.parse_order((SOURCES / "orders/2026-02-06.txt").read_text(),
                                    date(2026, 2, 6), "source")
        self.assertEqual(order["forward"], D("0.70"))
        self.assertEqual(order["credit_card"], D("0.20"))
        prior = pricing.parse_order((SOURCES / "orders/2026-09-11.txt").read_text(),
                                    date(2026, 9, 11), "prior")
        partial = pricing.parse_order((SOURCES / "orders/2026-09-12.txt").read_text(),
                                      date(2026, 9, 12), "partial", prior)
        self.assertFalse(partial["gasoline_setting"])
        self.assertEqual(partial["benchmark"], prior["benchmark"])

    def test_archive_date_mismatch_rejected(self):
        with self.assertRaises(ValueError):
            pricing.parse_order((SOURCES / "orders/2026-10-09.txt").read_text(),
                                date(2026, 10, 8), "wrong")

    def test_supply_subtotal_uses_known_policy_without_inventing_components(self):
        got = pricing.calculate_supply(date(2026, 10, 16), 6, D("134.25"), D("0.90"))
        self.assertEqual(got["minimum"], D("194.8"))
        self.assertEqual(got["supply_component"], D("134.25"))
        self.assertNotIn("benchmark", got)

    def test_known_decision_body_typo_requires_explicit_resolution(self):
        text = (SOURCES / "orders/2026-05-23.txt").read_text()
        with self.assertRaises(ValueError):
            pricing.parse_order(text, date(2026, 5, 23), "source")
        order = pricing.parse_order(text, date(2026, 5, 23), "source",
                                    allow_decision_date_conflict=True)
        self.assertEqual(order["zones"][0]["minimum"], D("185.6"))
        self.assertEqual(pricing.audit_order(order), [])
        self.assertIn("2026-05-22", order["source_warnings"][0])
        with self.assertRaises(ValueError):
            pricing.parse_order(text, date(2026, 5, 22), "wrong",
                                allow_decision_date_conflict=True)

    def test_decimal_comma_in_archived_order_is_not_truncated(self):
        order = pricing.parse_order((SOURCES / "orders/2025-01-17.txt").read_text(),
                                    date(2025, 1, 17), "source")
        self.assertEqual(order["credit_card"], D("0.4"))
        self.assertEqual(pricing.audit_order(order), [])

    def test_eia_parser_retains_missing_days(self):
        rows = pricing.parse_eia("<tr><td>2026 Oct-12 to Oct-16</td>"
                                 "<td>3.020</td><td>2.988</td><td>2.987</td>"
                                 "<td></td><td></td></tr>")
        self.assertEqual(rows[date(2026, 10, 14)], D("2.987"))
        self.assertNotIn(date(2026, 10, 15), rows)

    def test_missing_market_day_does_not_become_a_forecast(self):
        market = {date(2026, 10, 8): D("3.091")}
        fx = {date(2026, 10, 8): D("1.42")}
        with self.assertRaises(ValueError):
            pricing.proxy_window(date(2026, 10, 16), market, fx)

    def test_canadian_holiday_carries_prior_fx_but_never_future_fx(self):
        market = {date(2026, 10, d): D("3") for d in (8, 9, 12, 13, 14)}
        fx = {date(2026, 10, d): D("1.4") for d in (8, 9, 13, 14)}
        got = pricing.proxy_window(date(2026, 10, 16), market, fx)
        self.assertEqual(got["carried_fx_days"], ["2026-10-12"])
        with self.assertRaises(ValueError):
            pricing.proxy_window(date(2026, 10, 16), market, {date(2026, 10, 15): D("1.4")})

    def test_us_market_holiday_calendar(self):
        self.assertNotIn(date(2026, 7, 3), pricing.market_days(date(2026, 7, 2), date(2026, 7, 6)))
        self.assertIn(date(2026, 10, 12), pricing.market_days(date(2026, 10, 8), date(2026, 10, 14)))

    def test_missing_normal_business_day_fx_is_rejected(self):
        market = {date(2026, 10, d): D("3") for d in (8, 9, 12, 13, 14)}
        fx = {date(2026, 10, d): D("1.4") for d in (8, 9, 13)}
        with self.assertRaises(ValueError):
            pricing.proxy_window(date(2026, 10, 16), market, fx)

    def test_holiday_does_not_hide_missing_previous_business_day_fx(self):
        market = {date(2026, 10, d): D("3") for d in (8, 9, 12, 13, 14)}
        fx = {date(2026, 10, d): D("1.4") for d in (8, 13, 14)}
        with self.assertRaises(ValueError):
            pricing.proxy_window(date(2026, 10, 16), market, fx)


if __name__ == "__main__":
    unittest.main()

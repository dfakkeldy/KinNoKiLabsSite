"""Frozen production model tests; no network or private ledger writes."""
from copy import deepcopy
from datetime import date, datetime, timezone
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))
import ns_gas
import pricing
from test_rack_data import xlsx_fixture, html_fixture


class FrozenEngineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.sources, self.data = self.root / "sources", self.root / "data"
        self.sources.mkdir()
        self.data.mkdir()
        self.frozen = json.loads((ROOT / "frozen-evaluation.json").read_text())
        self.orders = [pricing.parse_order((Path(__file__).parent / f"fixtures/orders/{d}.txt").read_text(),
                      date.fromisoformat(d), f"https://nserbt.ca/sites/default/files/{d}.pdf") for d in ("2026-10-02", "2026-10-09")]
        self.racks = {date(2026, 10, d): pricing.number("120") for d in (2, 5, 6, 7, 8)}
        self.racks.update({date(2026, 10, d): pricing.number("117.5") for d in (9, 12, 13, 14)})
        self.racks[date(2026, 10, 15)] = pricing.number("115")
        (self.sources / "historical-prices.html").write_text("<html></html>")
        (self.sources / "prices.html").write_text('<p>Friday, October 9, 2026</p><a href="/sites/default/files/documents/gas/gasprice.pdf">Prices</a>')
        self.now = datetime(2026, 10, 15, 21, tzinfo=timezone.utc)

    def build(self, frozen):
        with patch.object(ns_gas, "ROOT", self.root), patch.object(ns_gas, "DATA", self.data), patch.object(ns_gas, "SOURCES", self.sources), \
             patch.object(ns_gas, "load_orders", return_value=(self.orders, [], [])), \
             patch.object(ns_gas, "load_racks", return_value=(self.racks, {"dates": sorted(self.racks)})), \
             patch.object(ns_gas.rack_forecasting, "evaluate", side_effect=AssertionError("production model was refitted")), \
             patch.object(ns_gas.rolling, "evaluate", side_effect=AssertionError("production evaluation was recomputed")):
            try:
                return ns_gas.build_snapshot({}, [{"source": "eia-gasoline.html", "error": "offline"}],
                                             self.now.date(), now=self.now, frozen_evaluation=frozen)
            except TypeError as exc:
                if "frozen_evaluation" in str(exc):
                    self.fail("build_snapshot lacks the frozen production evaluation override")
                raise

    def test_frozen_model_runs_with_only_recent_orders_and_keeps_vetted_baselines(self):
        before = deepcopy(self.frozen)
        result = self.build(self.frozen)
        self.assertIsNotNone(result["forecast"])
        self.assertEqual(result["forecast"]["model_parameters"], before["parameters"])
        self.assertEqual(result["evaluation"]["legacy_common"], before["legacy_common"])
        self.assertEqual(result["evaluation"]["summary"]["count"], 18)
        self.assertEqual(self.frozen, before)

    def test_json_string_summaries_use_decimal_comparison(self):
        self.frozen["summary"]["mae"] = "10"
        self.frozen["persistence"]["summary"]["mae"] = "20"
        self.assertIsNotNone(self.build(self.frozen)["forecast"])
        self.frozen["summary"]["mae"] = "20"
        self.frozen["persistence"]["summary"]["mae"] = "9"
        self.assertIsNone(self.build(self.frozen)["forecast"])

    def test_default_research_evaluation_still_refits(self):
        with patch.object(ns_gas, "DATA", self.data), patch.object(ns_gas, "SOURCES", self.sources), \
             patch.object(ns_gas, "load_orders", return_value=(self.orders, [], [])), \
             patch.object(ns_gas, "load_racks", return_value=(self.racks, {"dates": sorted(self.racks)})), \
             patch.object(ns_gas.rack_forecasting, "evaluate", side_effect=ValueError("incomplete training history")):
            result = ns_gas.build_snapshot({}, [], self.now.date(), now=self.now)
        self.assertIsNone(result["forecast"])
        self.assertIn("incomplete training history", result["forecast_unavailable"])

    def test_frozen_production_does_not_require_a_missing_unused_archive_year(self):
        from datetime import timedelta
        days = [date(2026, 9, 1) + timedelta(days=i) for i in range(45)
                if (date(2026, 9, 1) + timedelta(days=i)).weekday() < 5]
        rack = self.sources / "rack"
        rack.mkdir()
        (rack / "e10-2026.xlsx").write_bytes(xlsx_fixture([(d.strftime("%a %d-%b-%y"), "120") for d in days]))
        (rack / "nrcan-halifax.html").write_text(html_fixture([(d.isoformat(), "120") for d in days]))
        with patch.object(ns_gas, "DATA", self.data), patch.object(ns_gas, "SOURCES", self.sources), \
             patch.object(ns_gas, "load_orders", return_value=(self.orders, [], [])):
            result = ns_gas.build_snapshot({}, [], self.now.date(), now=self.now, frozen_evaluation=self.frozen)
        self.assertIsNotNone(result["forecast"])

    def test_refresh_reads_issuance_clock_after_downloads_cross_midnight(self):
        from unittest.mock import Mock
        clock = iter([datetime(2026, 10, 16, 2, 59, 59, tzinfo=timezone.utc),
                      datetime(2026, 10, 16, 3, 1, 1, tzinfo=timezone.utc),
                      datetime(2026, 10, 16, 3, 1, 2, tzinfo=timezone.utc)])
        class Clock(datetime):
            @classmethod
            def now(cls, tz=None):
                return next(clock).astimezone(tz or timezone.utc)
        with patch.object(ns_gas, "ROOT", self.root), patch.object(ns_gas, "DATA", self.data), \
             patch.object(ns_gas, "SOURCES", self.sources), patch.object(ns_gas, "datetime", Clock), \
             patch.object(ns_gas, "download_batch", return_value=[]), \
             patch.object(ns_gas, "load_orders", return_value=(self.orders, [], [])), \
             patch.object(ns_gas, "load_racks", return_value=(self.racks, {"dates": sorted(self.racks)})), \
             patch.object(ns_gas, "summarize", Mock()):
            result = ns_gas.refresh(frozen_evaluation=self.frozen)
        self.assertEqual(result["generated_at"], "2026-10-16T03:01:02+00:00")
        self.assertEqual(result["next_friday"], date(2026, 10, 23))
        self.assertIsNone(result["forecast"])
        self.assertIsNone(result["rolling_estimate"])
        self.assertFalse(list((self.data / "issued-forecasts").glob("*/*.json")))


if __name__ == "__main__":
    unittest.main()

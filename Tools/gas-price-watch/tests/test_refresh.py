import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "engine"))

import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import ns_gas
from datetime import date, datetime, timezone
from decimal import Decimal as D
import pricing
import rack_forecasting
import rolling


class RefreshTests(unittest.TestCase):
    def test_partial_week_gets_an_issued_provisional_estimate_and_only_real_quotes_need_confirmation(self):
        orders = [pricing.parse_order((Path(__file__).parent / f"fixtures/orders/{d}.txt").read_text(),
                                      date.fromisoformat(d), "official") for d in ("2026-10-02", "2026-10-09")]
        racks = {date(2026, 10, d): D("120") for d in (2, 5, 6, 7, 8)}
        racks[date(2026, 10, 9)] = D("117")
        parameters = dict(model_version=rack_forecasting.MODEL_VERSION, coefficients=list(map(D, ("0", ".6", ".4"))),
                          training_fingerprint="c"*64, feature_bounds={})
        evaluation = dict(parameters=parameters, rolling={"horizons": {
            "7": {"earlier_summary": {"count": 40, "p90": D("7")}},
            "2": {"earlier_summary": {"count": 40, "p90": D("4.8")}},
            "1": {"earlier_summary": {"count": 40, "p90": D("2.8")}}}})
        snapshot = dict(next_friday=date(2026, 10, 16), forecast=None, rolling_estimate=None,
                        audit={"rejected_orders": [], "arithmetic_issues": []}, fetch_errors=[], sources={})
        now = datetime(2026, 10, 9, 20, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as directory, patch.object(ns_gas, "DATA", Path(directory)):
            ns_gas.publish_rolling_estimate(snapshot, orders, racks, evaluation, {"dates": sorted(racks)}, now)
            self.assertIsNone(snapshot["forecast"])
            self.assertTrue(snapshot["rolling_estimate"]["provisional"])
            self.assertEqual(snapshot["rolling_estimate"]["projection"]["observed_count"], 1)
            self.assertEqual(snapshot["rolling_estimate"]["range_half_width"], D("7"))
            self.assertEqual(snapshot["forecast_validation"]["status"], "provisional")
            self.assertTrue(snapshot["rolling_estimate"]["issued_at"])
            first_id = snapshot["rolling_estimate"]["record_id"]
            evaluation["rolling"]["horizons"]["7"]["earlier_summary"]["p90"] = D("8")
            ns_gas.publish_rolling_estimate(snapshot, orders, racks, evaluation, {"dates": sorted(racks)}, now)
            self.assertNotEqual(snapshot["rolling_estimate"]["record_id"], first_id)
            racks.update({date(2026, 10, d): D("117") for d in (12, 13, 14)})
            ns_gas.publish_rolling_estimate(snapshot, orders, racks, evaluation, {"dates": sorted(racks)},
                                            datetime(2026, 10, 15, 12, tzinfo=timezone.utc))
            self.assertEqual(snapshot["rolling_estimate"]["range_half_width"], D("4.8"))
            incomplete = {"dates": sorted(racks)[:-1]}
            with self.assertRaises(ValueError):
                ns_gas.publish_rolling_estimate(snapshot, orders, racks, evaluation, incomplete,
                                                datetime(2026, 10, 15, 12, tzinfo=timezone.utc))

    def test_repaired_forecast_uses_complete_e10_data_despite_failed_legacy_feed(self):
        orders = [pricing.parse_order((Path(__file__).parent / f"fixtures/orders/{d}.txt").read_text(),
                                      date.fromisoformat(d), "official") for d in ("2026-10-02", "2026-10-09")]
        racks = {date(2026, 10, d): D("120") for d in (2, 5, 6, 7, 8)}
        racks.update({date(2026, 10, d): D("117.5") for d in (9, 12, 13, 14)})
        racks[date(2026, 10, 15)] = D("115")
        evaluation = dict(coverage={"unavailable": 0}, summary={"count": 18, "mae": D("1")},
                          persistence={"summary": {"mae": D("5")}}, training_cv={"summary": {"p90": D("3")}},
                          parameters=dict(model_version=rack_forecasting.MODEL_VERSION,
                                          coefficients=list(map(D, ("0", "0.6", "0.4"))),
                                          training_fingerprint="a"*64, feature_bounds={}))
        snapshot = dict(next_friday=date(2026, 10, 16), audit={"rejected_orders": [], "arithmetic_issues": []},
                        fetch_errors=[{"source": "eia-gasoline.html", "error": "offline"}], sources={})
        now = datetime(2026, 10, 15, 21, tzinfo=timezone.utc)
        overlap = {"matched_count": len(racks), "dates": sorted(racks)}
        with tempfile.TemporaryDirectory() as directory, patch.object(ns_gas, "DATA", Path(directory)):
            incomplete = {"matched_count": len(racks)-1, "dates": sorted(racks)[:-1]}
            with self.assertRaises(ValueError):
                ns_gas.publish_rack_estimate(snapshot, orders, racks, evaluation, incomplete, now)
            ns_gas.publish_rack_estimate(snapshot, orders, racks, evaluation, overlap, now)
            first = snapshot["forecast"]["issued_at"]
            ns_gas.publish_rack_estimate(snapshot, orders, racks, evaluation, overlap, now)
            self.assertEqual(first, snapshot["forecast"]["issued_at"])
            self.assertEqual(snapshot["forecast"]["zones"][5]["minimum"], D("190.5"))
            self.assertEqual(snapshot["forecast_validation"]["status"], "retrospectively_tested_estimate")
            snapshot["audit"]["arithmetic_issues"] = [{"date": date(2026, 10, 9)}]
            with self.assertRaises(ValueError):
                ns_gas.publish_rack_estimate(snapshot, orders, racks, evaluation, overlap, now)
            snapshot["audit"]["arithmetic_issues"] = []
            snapshot["fetch_errors"].append({"source": "rack/nrcan-halifax.html", "error": "offline"})
            with self.assertRaises(ValueError):
                ns_gas.publish_rack_estimate(snapshot, orders, racks, evaluation, overlap, now)

    def test_unvalidated_proxy_cannot_be_published_as_live_forecast(self):
        candidate = {"benchmark": "112.52", "zones": [{"minimum": "181.6"}]}
        current = {"zones": [{"minimum": "194.8"}]}
        snapshot = {"forecast": candidate, "current": current, "next_friday": date(2026, 10, 16)}
        ns_gas.enforce_forecast_validation(snapshot, [])
        self.assertIsNone(snapshot["forecast"])
        self.assertEqual(snapshot["experimental_estimate"], candidate)
        self.assertEqual(snapshot["current"], current)
        self.assertEqual(snapshot["forecast_validation"]["status"], "research_only")

    def test_reference_forecasts_are_attributed_and_filtered_by_effective_date(self):
        references = [{"source": "The Hawk", "effective_date": "2026-10-16", "gasoline_change_cents": "-2.7"},
                      {"source": "Old report", "effective_date": "2026-10-09", "gasoline_change_cents": "1.2"}]
        snapshot = {"forecast": None, "current": {}, "next_friday": date(2026, 10, 16)}
        ns_gas.enforce_forecast_validation(snapshot, references)
        self.assertEqual(snapshot["reference_forecasts"], [references[0]])
        self.assertIsNone(snapshot["forecast"])

    def test_hard_failure_preserves_valid_data_and_withdraws_saved_forecast(self):
        fixture = {"next_friday": "2026-10-16", "current": {"date": "2026-10-09"}, "forecast": None}
        # Simulate a previously published snapshot, even after the live proxy is disabled.
        fixture["forecast"] = fixture.get("experimental_estimate") or {"date": fixture["next_friday"]}
        fixture["rolling_estimate"] = {"date": fixture["next_friday"], "provisional": True}
        saved = json.dumps(fixture).encode()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / "data"
            data.mkdir()
            (data / "latest.json").write_bytes(saved)
            with patch.object(ns_gas, "ROOT", root), patch.object(ns_gas, "DATA", data):
                ns_gas.record_refresh_failure(ValueError("Malformed current page"))
                result = ns_gas.load_saved_result()
            self.assertEqual((data / "latest.json").read_bytes(), saved)
            self.assertIsNone(result["forecast"])
            self.assertIsNone(result["rolling_estimate"])
            self.assertEqual(result["interrupter_watch"]["status"], "unavailable")
            self.assertIn("Malformed current page", result["forecast_unavailable"])
            self.assertTrue(result["last_failed_refresh_at"])
            self.assertTrue((root / "report.html").exists())


if __name__ == "__main__":
    unittest.main()

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "engine"))

"""Behavioral checks for immutable, time-safe forecast records."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal as D
import importlib
import json
from pathlib import Path
import tempfile
import unittest
from zoneinfo import ZoneInfo


class ForecastLedgerTests(unittest.TestCase):
    def setUp(self):
        try:
            self.ledger = importlib.import_module("forecast_ledger")
        except ModuleNotFoundError as exc:
            if exc.name != "forecast_ledger":
                raise
            self.fail("Forecast ledger API has not been implemented")
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "forecasts"
        self.issued = datetime(2026, 10, 15, 15, tzinfo=timezone.utc)
        self.target = date(2026, 10, 16)
        self.candidate = {
            "date": self.target,
            "model_version": "nb-market-v1",
            "input_fingerprint": "a" * 64,
            "input_window_end": date(2026, 10, 14),
            "latest_quote_date": date(2026, 10, 14),
            "benchmark": D("123.45"),
            "metadata": {"dates": [date(2026, 10, 9)], "weight": D("0.9")},
            "rack_window": {
                "start": date(2026, 10, 14), "end": date(2026, 10, 14),
                "mean": D("130.0"), "latest": D("130.0"),
                "latest_date": date(2026, 10, 14),
                "observations": [{"date": date(2026, 10, 14), "price": D("130.0")}],
            },
            "source_verification": {"matched_count": 1, "dates": [date(2026, 10, 14)]},
            "retrieved_sources": {
                "rack/source.csv": {
                    "url": "https://example.test/rack/source.csv",
                    "sha256": "b" * 64,
                    "bytes": 1234,
                    "retrieved_at": "2026-10-15T14:59:00+00:00",
                },
            },
            "zones": [
                {"zone": zone, "minimum": D("189") + zone,
                 "maximum": D("191.3") + zone}
                for zone in range(1, 7)
            ],
        }

    def record(self, candidate=None, issued_at=None):
        return self.ledger.record_forecast(
            self.root, self.candidate if candidate is None else candidate,
            self.issued if issued_at is None else issued_at)

    def record_path(self):
        return self.root / "2026-10-16" / ("nb-market-v1-" + "a" * 12 + ".json")

    def actual_order(self, effective_date=None):
        zones = deepcopy(self.candidate["zones"])
        zones[0].update(minimum="189.4", maximum="192.7")
        zones[5].update(minimum="196.0", maximum="197.3")
        return {"date": self.target if effective_date is None else effective_date,
                "source_url": "https://example.test/orders/2026-10-16.pdf",
                "gasoline_setting": True, "zones": zones}

    def test_persists_json_safe_candidate_and_supplied_issue_time(self):
        original = deepcopy(self.candidate)
        saved = self.record()
        self.assertEqual(saved["date"], "2026-10-16")
        self.assertEqual(saved["issued_at"], "2026-10-15T15:00:00+00:00")
        self.assertEqual(saved["effective_at"], "2026-10-16T03:01:00+00:00")
        self.assertEqual(saved["benchmark"], "123.45")
        self.assertEqual(saved["metadata"]["dates"], ["2026-10-09"])
        self.assertEqual(self.candidate, original)
        self.assertEqual(json.loads(self.record_path().read_text()), saved)

    def test_repeat_preserves_original_issue_time_and_file_bytes(self):
        first = self.record()
        original_bytes = self.record_path().read_bytes()
        repeated = self.record(issued_at=self.issued + timedelta(hours=3))
        self.assertEqual(repeated, first)
        self.assertEqual(self.record_path().read_bytes(), original_bytes)
        self.assertEqual(len(list(self.root.glob("*/*.json"))), 1)

    def test_repeat_with_new_retrieval_time_preserves_original_provenance(self):
        first = self.record()
        original_bytes = self.record_path().read_bytes()
        changed = deepcopy(self.candidate)
        source = changed["retrieved_sources"]["rack/source.csv"]
        source.update(retrieved_at="2026-10-15T17:59:00+00:00", reused=True)
        repeated = self.record(changed, self.issued + timedelta(hours=3))
        self.assertEqual(repeated, first)
        self.assertEqual(repeated["retrieved_sources"], self.candidate["retrieved_sources"])
        self.assertEqual(self.record_path().read_bytes(), original_bytes)
        source["reused"] = False
        self.assertEqual(self.record(changed), first)

    def test_raw_source_changes_preserve_first_evidence_for_same_semantic_forecast(self):
        first = self.record()
        original_bytes = self.record_path().read_bytes()
        changed = deepcopy(self.candidate)
        changed["retrieved_sources"]["rack/source.csv"].update(
            sha256="c" * 64, url="https://example.test/another.csv", bytes=1235,
            retrieved_at="2026-10-15T17:59:00+00:00", reused=True)
        repeated = self.record(changed, self.issued + timedelta(hours=3))
        self.assertEqual(repeated, first)
        self.assertEqual(repeated["retrieved_sources"], self.candidate["retrieved_sources"])
        self.assertEqual(self.record_path().read_bytes(), original_bytes)
        changed.pop("retrieved_sources")
        self.assertEqual(self.record(changed), first)

    def test_changed_rack_observation_for_same_identifier_is_rejected(self):
        self.record()
        original_bytes = self.record_path().read_bytes()
        changed = deepcopy(self.candidate)
        changed["rack_window"]["observations"][0]["price"] = D("130.01")
        with self.assertRaises(ValueError):
            self.record(changed)
        self.assertEqual(self.record_path().read_bytes(), original_bytes)

    def test_overlap_growth_preserves_first_verification_for_same_semantic_forecast(self):
        days = sorted([date(2026, 10, 14) - timedelta(days=offset) for offset in range(70)
                       if (date(2026, 10, 14) - timedelta(days=offset)).weekday() < 5])[-44:]
        candidate = deepcopy(self.candidate)
        candidate["source_verification"] = {"matched_count": 43, "dates": days[1:]}
        first = self.record(candidate)
        original_bytes = self.record_path().read_bytes()
        changed = deepcopy(candidate)
        changed["source_verification"] = {"matched_count": 44, "dates": days}
        repeated = self.record(changed, self.issued + timedelta(hours=3))
        self.assertEqual(repeated, first)
        self.assertEqual(repeated["source_verification"]["matched_count"], 43)
        self.assertEqual(self.record_path().read_bytes(), original_bytes)

    def test_changed_model_parameters_for_same_identifier_are_rejected(self):
        candidate = dict(self.candidate, model_parameters={"coefficients": ["0", "1", "0"]})
        self.record(candidate)
        original_bytes = self.record_path().read_bytes()
        changed = deepcopy(candidate)
        changed["model_parameters"]["coefficients"][1] = "0.9"
        with self.assertRaises(ValueError):
            self.record(changed)
        self.assertEqual(self.record_path().read_bytes(), original_bytes)

    def test_retrieval_named_fields_outside_source_metadata_still_conflict(self):
        self.record()
        changed = deepcopy(self.candidate)
        changed["metadata"]["retrieved_at"] = "2026-10-15T17:59:00+00:00"
        with self.assertRaises(ValueError):
            self.record(changed)

    def test_changed_price_for_same_identifier_is_rejected_without_overwrite(self):
        self.record()
        original_bytes = self.record_path().read_bytes()
        changed = deepcopy(self.candidate)
        changed["zones"][0]["minimum"] = D("170.0")
        with self.assertRaises(ValueError):
            self.record(changed)
        self.assertEqual(self.record_path().read_bytes(), original_bytes)

    def test_full_fingerprint_collision_is_not_silently_reused(self):
        self.record()
        changed = dict(self.candidate, input_fingerprint="a" * 12 + "b" * 52)
        with self.assertRaises(ValueError):
            self.record(changed)

    def test_rejects_issue_at_or_after_local_effective_time(self):
        cutoff = datetime(2026, 10, 16, 0, 1, tzinfo=ZoneInfo("America/Halifax"))
        for issued in [cutoff, cutoff + timedelta(seconds=1)]:
            with self.subTest(issued=issued), self.assertRaises(ValueError):
                self.record(issued_at=issued)
        self.assertFalse(self.root.exists())
        saved = self.record(issued_at=cutoff - timedelta(microseconds=1))
        self.assertEqual(saved["issued_at"], "2026-10-16T03:00:59.999999+00:00")

    def test_winter_cutoff_uses_halifax_standard_time(self):
        candidate = dict(self.candidate, date=date(2027, 1, 8))
        cutoff = datetime(2027, 1, 8, 4, 1, tzinfo=timezone.utc)
        with self.assertRaises(ValueError):
            self.record(candidate, cutoff)
        saved = self.record(candidate, cutoff - timedelta(seconds=1))
        self.assertEqual(saved["effective_at"], "2027-01-08T04:01:00+00:00")

    def test_rejects_naive_issue_and_observation_times(self):
        with self.assertRaises(ValueError):
            self.record(issued_at=datetime(2026, 10, 15, 15))
        self.record()
        with self.assertRaises(ValueError):
            self.ledger.score_forecasts(self.root, [], datetime(2026, 10, 17))

    def test_rejects_input_window_on_target_or_after_issue_day(self):
        for end in [self.target, date(2026, 10, 17)]:
            with self.subTest(end=end), self.assertRaises(ValueError):
                self.record(dict(self.candidate, input_window_end=end))
        with self.assertRaises(ValueError):
            self.record(dict(self.candidate, input_window_end=date(2026, 10, 15)),
                        datetime(2026, 10, 14, 15, tzinfo=timezone.utc))

    def test_quote_date_uses_issue_local_day_instead_of_utc_day(self):
        issued = datetime(2026, 10, 16, 2, tzinfo=timezone.utc)
        with self.assertRaises(ValueError):
            self.record(dict(self.candidate, latest_quote_date=self.target), issued)
        self.record(dict(self.candidate, latest_quote_date=date(2026, 10, 15)), issued)

    def test_rejects_unsafe_identifiers_before_creating_files(self):
        for model in ["../escape", "MixedCase", "bad_name", "-model", "a--b"]:
            with self.subTest(model=model), self.assertRaises(ValueError):
                self.record(dict(self.candidate, model_version=model))
        for fingerprint in ["a" * 63, "x" * 64, "../" + "a" * 61]:
            with self.subTest(fingerprint=fingerprint), self.assertRaises(ValueError):
                self.record(dict(self.candidate, input_fingerprint=fingerprint))
        self.assertFalse(self.root.exists())

    def test_normalizes_equivalent_date_and_price_representations(self):
        first = self.record()
        candidate = deepcopy(self.candidate)
        for key in ["date", "input_window_end", "latest_quote_date"]:
            candidate[key] = candidate[key].isoformat()
        for zone in candidate["zones"]:
            zone["minimum"] = str(zone["minimum"]) + ".00"
            zone["maximum"] = str(zone["maximum"]) + "0"
        self.assertEqual(self.record(candidate), first)

    def test_rejects_invalid_zone_prices(self):
        invalid = [
            [{"zone": 0, "minimum": "190", "maximum": "191"}],
            [{"zone": 7, "minimum": "190", "maximum": "191"}],
            [{"zone": 1, "minimum": "192", "maximum": "191"}],
            [{"zone": 1, "minimum": "NaN", "maximum": "191"}],
            [self.candidate["zones"][0], self.candidate["zones"][0]],
        ]
        for zones in invalid:
            with self.subTest(zones=zones), self.assertRaises(ValueError):
                self.record(dict(self.candidate, zones=zones))

    def test_rejects_candidate_supplied_issuance_metadata(self):
        with self.assertRaises(ValueError):
            self.record(dict(self.candidate, issued_at="2026-10-01T00:00:00+00:00"))

    def test_refuses_target_directory_symlink(self):
        outside = Path(self.temp.name) / "outside"
        outside.mkdir()
        self.root.mkdir()
        (self.root / "2026-10-16").symlink_to(outside, target_is_directory=True)
        with self.assertRaises(ValueError):
            self.record()
        self.assertEqual(list(outside.iterdir()), [])

    def test_concurrent_repeats_publish_one_complete_immutable_record(self):
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(
                lambda minutes: self.record(issued_at=self.issued + timedelta(minutes=minutes)),
                range(12)))
        self.assertTrue(all(result == results[0] for result in results))
        self.assertEqual(json.loads(self.record_path().read_text()), results[0])
        self.assertEqual(len(list(self.root.glob("*/*.json"))), 1)

    def test_pending_before_and_at_effective_time_ignores_available_actuals(self):
        self.record()
        for observed in [datetime(2026, 10, 16, 3, 0, tzinfo=timezone.utc),
                         datetime(2026, 10, 16, 3, 1, tzinfo=timezone.utc)]:
            with self.subTest(observed=observed):
                result = self.ledger.score_forecasts(self.root, [self.actual_order()], observed)
                self.assertEqual(len(result), 1)
                self.assertEqual(result[0]["status"], "pending")
                self.assertNotIn("zones", result[0])

    def test_later_week_actual_cannot_score_a_missing_target_order(self):
        self.record()
        result = self.ledger.score_forecasts(
            self.root, [self.actual_order(date(2026, 10, 23))],
            datetime(2026, 10, 24, 12, tzinfo=timezone.utc))
        self.assertEqual(result[0]["status"], "pending")
        self.assertNotIn("zones", result[0])

    def test_scores_exact_date_with_signed_errors_for_each_zone(self):
        self.record()
        actual = self.actual_order("2026-10-16")
        result = self.ledger.score_forecasts(
            self.root, [self.actual_order("2026-10-09"), actual,
                        self.actual_order("2026-10-23")],
            datetime(2026, 10, 16, 3, 2, tzinfo=timezone.utc))
        self.assertEqual(len(result), 1)
        scored = result[0]
        self.assertEqual(scored["status"], "scored")
        self.assertEqual(scored["date"], "2026-10-16")
        self.assertEqual(scored["source_url"], actual["source_url"])
        self.assertEqual(len(scored["zones"]), 6)
        first, last = scored["zones"][0], scored["zones"][5]
        self.assertEqual(D(first["minimum_error"]), D("0.6"))
        self.assertEqual(D(first["maximum_error"]), D("-0.4"))
        self.assertEqual(D(last["minimum_error"]), D("-1.0"))
        self.assertEqual(D(last["maximum_error"]), D("0.0"))

    def test_scoring_leaves_original_forecast_unchanged(self):
        self.record()
        original_bytes = self.record_path().read_bytes()
        self.ledger.score_forecasts(self.root, [self.actual_order()],
                                    datetime(2026, 10, 17, tzinfo=timezone.utc))
        self.assertEqual(self.record_path().read_bytes(), original_bytes)
        self.assertFalse((self.root / "scores.json").exists())

    def test_conflicting_actual_orders_fail_closed(self):
        self.record()
        conflicting = self.actual_order()
        conflicting["zones"][0]["minimum"] = "189.0"
        with self.assertRaises(ValueError):
            self.ledger.score_forecasts(
                self.root, [self.actual_order(), conflicting],
                datetime(2026, 10, 17, tzinfo=timezone.utc))


if __name__ == "__main__":
    unittest.main()

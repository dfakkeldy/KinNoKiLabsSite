"""Publication behavior with synthetic snapshots and temporary ledgers only."""
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal as D
import importlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT), str(ROOT / "engine")]


def snapshot(target="2026-10-16", current="2026-10-09", generated="2026-10-15T20:00:00+00:00"):
    zones = [{"zone": z, "minimum": D("190.1") + z, "maximum": D("193.1") + z,
              "private_note": "do not publish"} for z in range(1, 7)]
    forecast = dict(date=target, zones=zones, model_version="halifax-e10-change-v2",
                    issued_at=generated, latest_quote_date="2026-10-15", anchor_date=current,
                    outside_training_features=[], range_half_width=D("3.0"),
                    rack_window={"observations": [{"date": "2026-10-15", "price": D("140.0")}]},
                    assumptions=["/Users/private/secret research"], secret="excluded")
    return dict(generated_at=generated, current={"date": current, "zones": zones,
                  "source_url": "https://nserbt.ca/sites/default/files/gasprice_123.pdf",
                  "benchmark": D("124.12"), "forward": D("0"), "clean_fuel": D("10.13"),
                  "credit_card": D("0.90"), "private_note": "excluded"},
                next_friday=target, forecast=forecast, rolling_estimate=None,
                interrupter_watch={"status": "below_reference", "latest_gap": D("-1.2"),
                  "reference_cents": D("6"), "direction": None,
                  "observations": [{"date": "2026-10-15", "supply_gap": D("-1.2"),
                                    "private_note": "excluded"}],
                  "regular_setting_next": True, "source_url": "https://nserbt.ca/sites/default/files/Decision%20%28Interruption%29.pdf",
                  "limitations": "/Users/private/secret"},
                issued_forecast_results=[], sources={"secret": "excluded"},
                audit={"private_note": "excluded"}, fetch_errors=[], private_note="excluded")


class HostedRefreshTests(unittest.TestCase):
    def setUp(self):
        try:
            self.hosted = importlib.import_module("hosted_refresh")
        except ModuleNotFoundError as exc:
            if exc.name != "hosted_refresh":
                raise
            self.fail("The hosted publication wrapper is not implemented")
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.cache, self.data = self.root / "cache", self.root / "public"
        self.now = datetime(2026, 10, 15, 21, tzinfo=timezone.utc)

    def refresh(self, value=None, *, now=None, callback=None):
        value = snapshot() if value is None else value
        return self.hosted.refresh_public(self.cache, self.data, now=self.now if now is None else now,
                                           refresh_func=callback or (lambda **kwargs: deepcopy(value)))

    def test_public_schema_discards_private_fields_and_serializes_money(self):
        result = self.refresh()
        self.assertEqual(result["status"], "ok")
        self.assertEqual(set(result), {"schema_version", "checked_at", "status", "error", "current",
            "target_date", "estimate", "watch", "performance", "issued_forecasts", "live_validation", "sources"})
        self.assertEqual(result["current"]["benchmark"], "124.12")
        self.assertEqual(result["current"]["zones"][5], {"zone": 6, "minimum": "196.1", "maximum": "199.1"})
        self.assertEqual(result["estimate"]["mode"], "complete")
        self.assertEqual(result["estimate"]["error_reference"], "3.0")
        self.assertEqual(result["estimate"]["observed_quotes"], 1)
        serialized = (self.data / "latest.json").read_text()
        for text in ("private", "secret", "audit", "retrieved_sources", "rack_price"):
            self.assertNotIn(text, serialized)
        self.assertIn("false", result["watch"]["limitations"].lower())
        self.assertEqual(json.loads(serialized), result)
        self.assertFalse(list(self.data.glob("*.new")))

    def test_private_or_nonofficial_source_url_cannot_be_published(self):
        for url in ("file:///Users/private/order.pdf", "https://example.test/order.pdf",
                    "https://user:secret@nserbt.ca/sites/default/files/order.pdf",
                    "https://nserbt.ca/sites/default/files/order.pdf?token=secret"):
            value = snapshot()
            value["current"]["source_url"] = url
            result = self.refresh(value)
            self.assertEqual(result["status"], "error")
            self.assertNotIn("secret", json.dumps(result))
            self.assertIsNone(result["estimate"])

    def test_diesel_only_order_keeps_the_previous_gasoline_watch_anchor(self):
        value = snapshot("2026-09-18", "2026-09-12", "2026-09-12T15:00:00+00:00")
        value["last_gasoline_setting"] = "2026-09-11"
        value["current"]["gasoline_setting"] = False
        value["forecast"].update(anchor_date="2026-09-11", latest_quote_date="2026-09-11")
        value["interrupter_watch"].update(anchor_date="2026-09-11",
            observations=[{"date": "2026-09-11", "supply_gap": D("-1.2")}])
        result = self.refresh(value, now=datetime(2026, 9, 12, 15, 10, tzinfo=timezone.utc))
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["current"]["date"], "2026-09-12")
        self.assertEqual(result["current"]["gasoline_setting_date"], "2026-09-11")
        self.assertEqual(result["watch"]["anchor_date"], "2026-09-11")

    def test_provisional_coverage_and_extrapolation_do_not_invent_an_error_band(self):
        value = snapshot()
        rolling = value.pop("forecast")
        rolling.update(model_version="halifax-e10-rolling-v3", provisional=True,
                       projection={"observed_count": 1, "total_count": 5, "projected_count": 4})
        value["rolling_estimate"] = rolling
        result = self.refresh(value)
        self.assertEqual(result["estimate"]["mode"], "provisional")
        self.assertEqual(result["estimate"]["projected_quotes"], 4)
        rolling["outside_training_features"] = ["mean_change"]
        result = self.refresh(value)
        self.assertEqual(result["estimate"]["mode"], "extrapolation")
        self.assertIsNone(result["estimate"]["error_reference"])

    def test_expired_cached_estimate_withdraws_watch_at_halifax_0001(self):
        for target, cutoff in (("2026-10-16", datetime(2026, 10, 16, 3, 1, tzinfo=timezone.utc)),
                               ("2027-01-08", datetime(2027, 1, 8, 4, 1, tzinfo=timezone.utc))):
            value = snapshot(target, (date.fromisoformat(target) - timedelta(days=7)).isoformat(),
                             (cutoff - timedelta(hours=1)).isoformat())
            value["forecast"]["latest_quote_date"] = (date.fromisoformat(target) - timedelta(days=1)).isoformat()
            value["interrupter_watch"]["observations"][0]["date"] = value["forecast"]["latest_quote_date"]
            for checked in (cutoff, cutoff + timedelta(seconds=1)):
                with self.subTest(target=target, checked=checked):
                    result = self.refresh(value, now=checked)
                    self.assertEqual(result["status"], "error")
                    self.assertIsNone(result["estimate"])
                    self.assertIsNone(result["watch"])
            result = self.refresh(value, now=cutoff - timedelta(microseconds=1))
            self.assertEqual(result["status"], "ok")

    def test_new_friday_requires_its_official_order_before_the_next_week(self):
        value = snapshot("2026-10-23", "2026-10-09", "2026-10-16T04:00:00+00:00")
        result = self.refresh(value, now=datetime(2026, 10, 16, 4, 1, tzinfo=timezone.utc))
        self.assertEqual(result["status"], "error")
        self.assertIsNone(result["estimate"])
        self.assertIsNone(result["watch"])

    def test_old_snapshot_cannot_be_relabelled_as_a_fresh_check(self):
        result = self.refresh(snapshot(generated="2026-10-15T17:59:59+00:00"))
        self.assertEqual(result["status"], "error")
        self.assertIsNone(result["estimate"])
        self.assertIsNone(result["watch"])

    def test_stale_or_failed_sources_preserve_previous_verified_sections(self):
        previous = self.refresh()
        for stale in (True, False):
            value = snapshot(generated="2026-10-15T16:00:00+00:00" if stale else "2026-10-15T20:00:00+00:00")
            value["current"]["zones"][0]["minimum"] = "123"
            if not stale:
                value["fetch_errors"] = [{"source": "order-current.pdf", "error": "offline"}]
            result = self.refresh(value)
            self.assertEqual(result["status"], "error")
            self.assertEqual(result["current"], previous["current"])
            self.assertEqual(result["performance"], previous["performance"])

    def test_fresh_check_does_not_revalidate_an_old_quote(self):
        value = snapshot()
        value["forecast"]["latest_quote_date"] = "2026-10-13"
        result = self.refresh(value)
        self.assertEqual(result["status"], "error")
        self.assertIsNone(result["estimate"])

    def test_engine_exception_preserves_verified_values_and_public_history(self):
        previous = self.refresh()
        previous["issued_forecasts"] = [self.result("2026-10-09", "a", "scored")]
        (self.data / "latest.json").write_text(json.dumps(previous))
        def fail(**kwargs):
            raise OSError("failed /Users/private/token-secret")
        result = self.refresh(callback=fail)
        self.assertEqual(result["status"], "error")
        self.assertEqual(result["current"], previous["current"])
        self.assertEqual(result["performance"], previous["performance"])
        self.assertEqual(result["issued_forecasts"], previous["issued_forecasts"])
        self.assertEqual(result["live_validation"], {"observed_events": 1, "pending_events": 0})
        self.assertIsNone(result["estimate"])
        self.assertIsNone(result["watch"])
        self.assertNotIn("secret", json.dumps(result))

    def test_network_failure_without_previous_data_still_writes_a_safe_payload(self):
        def fail(**kwargs):
            raise TimeoutError("https://private.test/?token=secret")
        result = self.refresh(callback=fail)
        self.assertEqual(result["schema_version"], 1)
        self.assertEqual(result["status"], "error")
        self.assertIsNone(result["current"])
        self.assertIsNone(result["estimate"])
        self.assertNotIn("private.test", (self.data / "latest.json").read_text())

    def test_failed_legacy_feed_does_not_block_a_valid_e10_estimate(self):
        value = snapshot()
        value["fetch_errors"] = [{"source": "eia-gasoline.html", "error": "timeout"},
                                  {"source": "boc-fx.json", "error": "timeout"}]
        self.assertEqual(self.refresh(value)["status"], "ok")
        value["fetch_errors"].append({"source": "rack/nrcan-halifax.html", "error": "timeout"})
        self.assertEqual(self.refresh(value)["status"], "error")

    def test_market_outage_retains_fresh_official_prices_and_newly_scored_outcomes(self):
        self.refresh()
        value = snapshot("2026-10-23", "2026-10-16", "2026-10-16T04:00:00+00:00")
        value["current"]["zones"][0]["minimum"] = "189.5"
        value["issued_forecast_results"] = [self.result("2026-10-16", "a", "scored")]
        value["fetch_errors"] = [{"source": "rack/nrcan-halifax.html", "error": "timeout"}]
        result = self.refresh(value, now=datetime(2026, 10, 16, 4, 1, tzinfo=timezone.utc))
        self.assertEqual(result["status"], "error")
        self.assertEqual(result["current"]["date"], "2026-10-16")
        self.assertEqual(result["current"]["zones"][0]["minimum"], "189.5")
        self.assertEqual(result["live_validation"], {"observed_events": 1, "pending_events": 0})
        self.assertIsNone(result["estimate"])
        self.assertIsNone(result["watch"])

    @staticmethod
    def result(target, fingerprint, status="pending", *, hour=12):
        result = dict(date=target, issued_at=(date.fromisoformat(target) - timedelta(days=1)).isoformat() + f"T{hour:02}:00:00+00:00",
            record_id=f"{target}/halifax-e10-change-v2-{fingerprint * 12}.json", model_version="halifax-e10-change-v2",
            predicted_zones=[dict(zone=z, minimum="190", maximum="193") for z in range(1, 7)], status=status)
        if status == "scored":
            result["zones"] = [dict(zone=z, predicted_minimum="190", actual_minimum="191", minimum_error="-1",
                                   predicted_maximum="193", actual_maximum="194", maximum_error="-1") for z in range(1, 7)]
        return result

    def test_first_and_latest_records_are_grouped_without_duplicate_event_counts(self):
        value = snapshot()
        value["issued_forecast_results"] = [self.result("2026-10-09", c, "scored", hour=i+12) for i,c in enumerate("abc")]
        value["issued_forecast_results"] += [self.result("2026-10-16", c, hour=i+12) for i,c in enumerate("de")]
        result = self.refresh(value)
        self.assertEqual(len(result["issued_forecasts"]), 4)
        self.assertEqual(result["issued_forecasts"][0]["record_id"], self.result("2026-10-09", "a", "scored")["record_id"])
        self.assertEqual(result["issued_forecasts"][1]["record_id"], self.result("2026-10-09", "c", "scored")["record_id"])
        self.assertEqual(result["live_validation"], {"observed_events": 1, "pending_events": 1})

    def test_public_history_keeps_the_latest_26_dates(self):
        value = snapshot()
        value["issued_forecast_results"] = [self.result((date(2026, 3, 6) + timedelta(weeks=i)).isoformat(), "a", "scored") for i in range(30)]
        result = self.refresh(value)
        self.assertEqual(len(result["issued_forecasts"]), 26)
        self.assertEqual(result["issued_forecasts"][0]["date"], "2026-04-03")

    def test_engine_runs_in_temporary_data_with_persistent_public_cache(self):
        engine = importlib.import_module("ns_gas")
        original = (engine.ROOT, engine.DATA, engine.SOURCES)
        observed = {}
        def run(**kwargs):
            observed.update(root=engine.ROOT, data=engine.DATA, sources=engine.SOURCES, kwargs=kwargs)
            self.assertNotEqual(engine.ROOT, ROOT / "engine")
            self.assertEqual(engine.SOURCES, self.cache / "sources")
            self.assertEqual(kwargs["frozen_evaluation"]["parameters"]["training_count"], 86)
            return snapshot()
        self.refresh(callback=run)
        self.assertFalse(observed["root"].exists())
        self.assertEqual(observed["kwargs"]["now"], self.now)
        self.assertEqual((engine.ROOT, engine.DATA, engine.SOURCES), original)
        self.assertEqual(set(p.name for p in self.data.iterdir()), {"latest.json"})

    def test_default_clock_is_taken_after_callback_and_not_backdated(self):
        after = self.now + timedelta(minutes=2)
        complete = after + timedelta(seconds=1)
        def run(**kwargs):
            self.assertIsNone(kwargs["now"])
            return snapshot()
        with patch.object(self.hosted, "utc_now", side_effect=[self.now, after, complete]):
            result = self.hosted.refresh_public(self.cache, self.data, refresh_func=run)
        self.assertEqual(result["checked_at"], complete.isoformat())

    def test_expiry_is_rechecked_if_publication_crosses_the_effective_time(self):
        before = datetime(2026, 10, 16, 3, 0, 59, tzinfo=timezone.utc)
        effective = datetime(2026, 10, 16, 3, 1, tzinfo=timezone.utc)
        value = snapshot(generated="2026-10-16T02:59:00+00:00")
        with patch.object(self.hosted, "utc_now", side_effect=[before, before, effective]):
            result = self.hosted.refresh_public(self.cache, self.data, refresh_func=lambda **kwargs: value)
        self.assertEqual(result["checked_at"], effective.isoformat())
        self.assertEqual(result["status"], "error")
        self.assertIsNone(result["estimate"])
        self.assertIsNone(result["watch"])

    def test_existing_immutable_bytes_are_staged_and_new_records_append(self):
        engine = importlib.import_module("ns_gas")
        ledger = importlib.import_module("forecast_ledger")
        old = self.candidate("a")
        original = ledger.record_forecast(self.data / "issued-forecasts", old, self.now - timedelta(hours=2))
        old_path = self.data / "issued-forecasts" / original["record_id"]
        old_bytes = old_path.read_bytes()
        def run(**kwargs):
            staged = engine.DATA / "issued-forecasts" / original["record_id"]
            self.assertEqual(staged.read_bytes(), old_bytes)
            ledger.record_forecast(engine.DATA / "issued-forecasts", self.candidate("b"), self.now)
            value = snapshot()
            value["issued_forecast_results"] = ledger.score_forecasts(engine.DATA / "issued-forecasts", [], self.now)
            return value
        result = self.refresh(callback=run)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(old_path.read_bytes(), old_bytes)
        self.assertEqual(len(list((self.data / "issued-forecasts").glob("*/*.json"))), 2)
        self.assertEqual(result["live_validation"]["pending_events"], 1)

    def candidate(self, fingerprint):
        return dict(date="2026-10-16", model_version="halifax-e10-change-v2", input_fingerprint=fingerprint*64,
                    input_window_end="2026-10-15", latest_quote_date="2026-10-15",
                    zones=[dict(zone=z, minimum="190", maximum="193") for z in range(1, 7)])

    def test_mutated_staged_record_cannot_overwrite_immutable_public_bytes(self):
        engine = importlib.import_module("ns_gas")
        ledger = importlib.import_module("forecast_ledger")
        record = ledger.record_forecast(self.data / "issued-forecasts", self.candidate("a"), self.now)
        path = self.data / "issued-forecasts" / record["record_id"]
        before = path.read_bytes()
        def run(**kwargs):
            changed = deepcopy(record)
            changed["zones"][0]["minimum"] = "189"
            (engine.DATA / "issued-forecasts" / record["record_id"]).write_text(json.dumps(changed))
            return snapshot()
        result = self.refresh(callback=run)
        self.assertEqual(result["status"], "error")
        self.assertEqual(path.read_bytes(), before)

    def test_new_record_conflict_is_preflighted_before_any_append(self):
        engine = importlib.import_module("ns_gas")
        ledger = importlib.import_module("forecast_ledger")
        conflict = {}
        def run(**kwargs):
            for fingerprint in ("a", "b"):
                ledger.record_forecast(engine.DATA / "issued-forecasts", self.candidate(fingerprint), self.now)
            changed = self.candidate("b")
            changed["zones"][0]["minimum"] = "189"
            record = ledger.record_forecast(self.data / "issued-forecasts", changed, self.now)
            conflict["path"] = self.data / "issued-forecasts" / record["record_id"]
            conflict["bytes"] = conflict["path"].read_bytes()
            return snapshot()
        result = self.refresh(callback=run)
        self.assertEqual(result["status"], "error")
        self.assertEqual(conflict["path"].read_bytes(), conflict["bytes"])
        self.assertEqual(len(list((self.data / "issued-forecasts").glob("*/*.json"))), 1)

    def test_naive_clock_is_rejected_with_a_safe_error_payload(self):
        result = self.hosted.refresh_public(self.cache, self.data, now=datetime(2026, 10, 15, 21),
                                           refresh_func=lambda **kwargs: snapshot())
        self.assertEqual(result["status"], "error")
        self.assertIsNone(result["estimate"])

    def test_invalid_frozen_evaluation_cannot_prevent_safe_error_publication(self):
        with patch.object(self.hosted.json, "loads", return_value={"summary": {"count": "broken"}}):
            result = self.refresh()
        self.assertEqual(result["status"], "error")
        self.assertTrue((self.data / "latest.json").exists())

    def test_malformed_previous_sections_cannot_prevent_safe_error_publication(self):
        self.data.mkdir()
        (self.data / "latest.json").write_text(json.dumps({"schema_version": 1,
            "current": [], "performance": {"complete": []}, "issued_forecasts": []}))
        def fail(**kwargs):
            raise TimeoutError("offline")
        result = self.refresh(callback=fail)
        self.assertEqual(result["status"], "error")
        self.assertIsNone(result["current"])

    def test_partial_engine_evaluation_cannot_erase_vetted_performance(self):
        value = snapshot()
        value["forecast"] = None
        value["evaluation"] = {"summary": {"count": 0}}
        result = self.refresh(value)
        self.assertEqual(result["status"], "error")
        self.assertEqual(result["performance"]["complete"]["count"], 18)
        self.assertEqual(result["performance"]["complete"]["mae"], "1.64")

    def test_cli_exit_status_distinguishes_active_and_withheld_payloads(self):
        with patch.object(self.hosted, "refresh_public", return_value={"status": "ok"}):
            self.assertEqual(self.hosted.main(["--cache-dir", str(self.cache), "--data-dir", str(self.data)]), 0)
        with patch.object(self.hosted, "refresh_public", return_value={"status": "error"}):
            self.assertEqual(self.hosted.main(["--cache-dir", str(self.cache), "--data-dir", str(self.data)]), 1)


if __name__ == "__main__":
    unittest.main()

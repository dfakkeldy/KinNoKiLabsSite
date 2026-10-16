import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "engine"))

from copy import deepcopy
from datetime import date, timedelta
from decimal import Decimal as D
import unittest
from unittest.mock import patch

import pricing
import rolling


def order(day, supply="134.25"):
    return dict(date=day, gasoline_setting=True, credit_card=D("0.90"), source_url="synthetic",
                zones=[pricing.calculate_supply(day, z, D(supply), D("0.90")) for z in range(1, 7)])


class RollingTests(unittest.TestCase):
    def setUp(self):
        self.history = [order(date(2026, 10, 2)), order(date(2026, 10, 9))]
        self.racks = {date(2026, 10, d): D("120") for d in (2, 5, 6, 7, 8)}
        self.racks[date(2026, 10, 9)] = D("117")
        self.parameters = dict(model_version="halifax-e10-change-v2", coefficients=list(map(D, ("0", ".6", ".4"))),
                               training_fingerprint="b"*64, feature_bounds={})

    def test_friday_estimate_projects_only_unobserved_days_and_marks_them(self):
        f = rolling.estimate(self.history, date(2026, 10, 16), self.racks, self.parameters, date(2026, 10, 9))
        self.assertEqual(f["supply_component"], D("131.25"))
        self.assertEqual(f["projection"]["observed_count"], 1)
        self.assertEqual(f["projection"]["projected_count"], 4)
        self.assertEqual(f["input_window_end"], date(2026, 10, 9))
        self.assertEqual(f["latest_quote_date"], date(2026, 10, 9))
        self.assertEqual(len([o for o in f["rack_window"]["observations"] if o["projected"]]), 4)

    def test_zero_new_quotes_can_use_the_last_quote_but_not_a_stale_official_order(self):
        del self.racks[date(2026, 10, 9)]
        f = rolling.estimate(self.history, date(2026, 10, 16), self.racks, self.parameters, date(2026, 10, 9))
        self.assertEqual(f["projection"]["observed_count"], 0)
        with self.assertRaises(ValueError):
            rolling.estimate(self.history[:-1], date(2026, 10, 16), self.racks, self.parameters, date(2026, 10, 9))

    def test_future_quotes_and_order_outcomes_cannot_change_a_friday_call(self):
        f = rolling.estimate(self.history, date(2026, 10, 16), self.racks, self.parameters, date(2026, 10, 9))
        self.racks[date(2026, 10, 12)] = D("999")
        self.history.append(order(date(2026, 10, 14), "888"))
        self.assertEqual(f, rolling.estimate(self.history, date(2026, 10, 16), self.racks, self.parameters, date(2026, 10, 9)))

    def test_a_missing_observed_day_is_never_filled_as_a_projection(self):
        self.racks[date(2026, 10, 13)] = D("116")
        with self.assertRaises(ValueError):
            rolling.estimate(self.history, date(2026, 10, 16), self.racks, self.parameters, date(2026, 10, 13))

    def test_stale_feed_is_unavailable_but_weekends_accept_friday_quote(self):
        rolling.estimate(self.history, date(2026, 10, 16), self.racks, self.parameters, date(2026, 10, 11))
        with self.assertRaises(ValueError):
            rolling.estimate(self.history, date(2026, 10, 16), self.racks, self.parameters, date(2026, 10, 13))

    def test_intervening_gas_setting_resets_windows_and_projected_tail(self):
        self.racks.update({date(2026, 10, d): D("116") for d in (12, 13, 14)})
        self.history.append(order(date(2026, 10, 14), "132"))
        f = rolling.estimate(self.history, date(2026, 10, 16), self.racks, self.parameters, date(2026, 10, 14))
        self.assertEqual(f["anchor_date"], date(2026, 10, 14))
        self.assertEqual(f["projection"]["observed_count"], 1)
        self.assertEqual(f["projection"]["projected_count"], 1)

    def test_watch_uses_real_quotes_only_and_separates_one_from_two(self):
        self.racks[date(2026, 10, 9)] = D("127")
        w = rolling.interrupter_watch(self.history, self.racks, self.parameters, date(2026, 10, 9))
        self.assertEqual(w["status"], "single_quote_move")
        self.assertFalse(w["official_trigger_confirmed"])
        self.assertEqual(len(w["observations"]), 1)
        self.racks[date(2026, 10, 12)] = D("127")
        w = rolling.interrupter_watch(self.history, self.racks, self.parameters, date(2026, 10, 12))
        self.assertEqual(w["status"], "sustained_proxy_move")
        self.assertEqual(w["direction"], "up")

    def test_watch_resets_after_an_actual_order_and_has_no_future_confirmation(self):
        self.racks.update({date(2026, 10, d): D("127") for d in (9, 12, 13)})
        self.history.append(order(date(2026, 10, 14), "140"))
        w = rolling.interrupter_watch(self.history, self.racks, self.parameters, date(2026, 10, 14))
        self.assertEqual(w["status"], "waiting_for_quotes")

    def test_completed_window_agrees_with_existing_frozen_estimator(self):
        import rack_forecasting
        self.racks.update({date(2026, 10, d): D("117") for d in (12, 13, 14, 15)})
        f = rolling.estimate(self.history, date(2026, 10, 16), self.racks, self.parameters, date(2026, 10, 15))
        fixed = rack_forecasting.estimate(self.history, date(2026, 10, 16), self.racks, self.parameters,
                                          available_through=date(2026, 10, 15))
        self.assertEqual(f["zones"], fixed["zones"])
        self.assertEqual(f["projection"]["projected_count"], 0)

    def test_unresolved_interruption_outcome_is_not_scored_as_a_false_alarm(self):
        history = [order(date(2026, 7, 3)), order(date(2026, 7, 10))]
        quote_day, unresolved = date(2026, 7, 13), date(2026, 7, 14)
        watch = dict(status="single_quote_move", direction="up", latest_gap=D("7"),
                     anchor_date=date(2026, 7, 10), observations=[])
        with patch.object(rolling, "interrupter_watch", return_value=watch):
            e = rolling.evaluate(history, {quote_day: D("120")}, self.parameters,
                                 end=date(2026, 7, 17), rejected_dates=[unresolved])
        summary = e["watch"]["summary"]["early"]
        self.assertEqual(summary["false_alert_days"], 0)
        self.assertEqual(summary["unresolved_alert_days"], 1)
        self.assertEqual(summary["unresolved_target_dates"], 1)
        self.assertIsNone(e["watch"]["cases"][0]["actual_interruption"])


if __name__ == "__main__":
    unittest.main()

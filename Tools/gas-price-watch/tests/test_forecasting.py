import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "engine"))

from datetime import date, timedelta
from decimal import Decimal as D
from pathlib import Path
import unittest

import pricing
import forecasting


class ForecastTests(unittest.TestCase):
    def setUp(self):
        text = (Path(__file__).parent / "fixtures/orders/2026-10-09.txt").read_text()
        self.current = pricing.parse_order(text, date(2026, 10, 9), "source")
        text = (Path(__file__).parent / "fixtures/orders/2026-10-02.txt").read_text()
        self.previous = pricing.parse_order(text, date(2026, 10, 2), "prior")
        days = pricing.market_days(date(2026, 10, 1), date(2026, 10, 14))
        self.market = {d: D("3") for d in days}
        self.fx = {d: D("1.4") for d in days}

    def test_flat_market_keeps_existing_price_and_adjustments(self):
        result = forecasting.estimate(self.current, date(2026, 10, 16), self.market, self.fx,
                                      [self.previous, self.current])
        self.assertEqual(result["benchmark"], D("124.12"))
        self.assertEqual(result["zones"][0]["minimum"], D("192.9"))
        self.assertEqual(result["clean_fuel"], D("10.13"))

    def test_interrupted_window_is_not_treated_as_full_week(self):
        with self.assertRaises(ValueError):
            forecasting.estimate(dict(self.current, date=date(2026, 10, 10)),
                                 date(2026, 10, 16), self.market, self.fx, [self.previous, self.current])

    def test_backtest_does_not_use_target_adjustments(self):
        target = dict(self.current, date=date(2026, 10, 16), clean_fuel=D("50"))
        result = forecasting.evaluate([self.previous, self.current, target], self.market, self.fx, [], set())
        self.assertEqual(result["cases"][0]["predicted_minimum"], D("192.9"))

    def test_rejected_intervening_order_prevents_false_normal_window(self):
        target = dict(self.current, date=date(2026, 10, 16))
        result = forecasting.evaluate([self.previous, self.current, target], self.market, self.fx,
                                      [date(2026, 10, 12)], set())
        self.assertEqual(result["cases"], [])
        exclusion = next(x for x in result["excluded"] if x["date"] == date(2026, 10, 16))
        self.assertEqual(exclusion["reason"], "Unparsed or conflicting order in the pricing window")

    def test_future_market_observations_do_not_change_estimate(self):
        baseline = forecasting.estimate(self.current, date(2026, 10, 16), self.market, self.fx,
                                        [self.previous, self.current])
        changed = dict(self.market, **{})
        changed[date(2026, 10, 15)] = D("20")
        result = forecasting.estimate(self.current, date(2026, 10, 16), changed, self.fx,
                                      [self.previous, self.current])
        self.assertEqual(result["benchmark"], baseline["benchmark"])

    def test_interruption_in_anchor_window_is_excluded(self):
        interrupted = dict(self.previous, date=date(2026, 10, 7))
        target = dict(self.current, date=date(2026, 10, 16))
        history = [self.previous, interrupted, self.current, target]
        result = forecasting.evaluate(history, self.market, self.fx, [], set())
        self.assertFalse(any(x["date"] == target["date"] for x in result["cases"]))

    def test_live_estimate_rejects_interruption_in_anchor_window(self):
        interrupted = dict(self.previous, date=date(2026, 10, 7))
        with self.assertRaises(ValueError):
            forecasting.estimate(self.current, date(2026, 10, 16), self.market, self.fx,
                                 history=[self.previous, interrupted, self.current])


if __name__ == "__main__":
    unittest.main()

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "engine"))

from copy import deepcopy
from datetime import date, timedelta
from decimal import Decimal as D
import unittest

import pricing
import rack_forecasting as model


def order(day, supply="134.25", credit="0.90"):
    return dict(date=day, gasoline_setting=True, credit_card=D(credit), source_url="official",
                zones=[pricing.calculate_supply(day, z, D(supply), D(credit)) for z in range(1, 7)])


class RackForecastTests(unittest.TestCase):
    def setUp(self):
        self.history = [order(date(2026, 10, 2)), order(date(2026, 10, 9))]
        self.racks = {date(2026, 10, d): D("120") for d in (2, 5, 6, 7, 8)}
        self.racks.update({date(2026, 10, d): D("117.5") for d in (9, 12, 13, 14)})
        self.racks[date(2026, 10, 15)] = D("115")
        self.parameters = dict(model_version=model.MODEL_VERSION, coefficients=[D("0"), D("0.6"), D("0.4")],
                               training_fingerprint="a" * 64, feature_bounds={})

    def test_mean_and_latest_change_predict_supply_then_apply_known_policy(self):
        f = model.estimate(self.history, date(2026, 10, 16), self.racks, self.parameters,
                           available_through=date(2026, 10, 15))
        self.assertEqual(f["mean_change"], D("-3"))
        self.assertEqual(f["latest_change"], D("-5"))
        self.assertEqual(f["supply_component"], D("130.45"))
        self.assertEqual(f["zones"][5]["minimum"], D("190.5"))
        self.assertNotIn("benchmark", f)

    def test_missing_last_weekday_withholds_instead_of_using_partial_average(self):
        del self.racks[date(2026, 10, 15)]
        with self.assertRaises(ValueError):
            model.estimate(self.history, date(2026, 10, 16), self.racks, self.parameters,
                           available_through=date(2026, 10, 15))

    def test_actual_target_prices_and_future_rack_rows_cannot_leak(self):
        before = model.estimate(self.history, date(2026, 10, 16), self.racks, self.parameters,
                                available_through=date(2026, 10, 15))
        self.history += [order(date(2026, 10, 16), "999"), order(date(2026, 10, 23), "888")]
        self.racks[date(2026, 10, 16)] = D("999")
        after = model.estimate(self.history, date(2026, 10, 16), self.racks, self.parameters,
                               available_through=date(2026, 10, 15))
        self.assertEqual(before, after)

    def test_interrupter_changes_the_window_and_diesel_only_does_not(self):
        self.history.append(order(date(2026, 10, 14), "132"))
        diesel = deepcopy(self.history[-1])
        diesel.update(date=date(2026, 10, 15), gasoline_setting=False)
        self.history.append(diesel)
        f = model.estimate(self.history, date(2026, 10, 16), self.racks, self.parameters,
                           available_through=date(2026, 10, 15))
        self.assertEqual(f["anchor_date"], date(2026, 10, 14))
        self.assertEqual(f["rack_window"]["start"], date(2026, 10, 14))
        self.assertEqual(len(f["rack_window"]["observations"]), 2)

    def test_training_cutoff_and_fingerprint_ignore_later_outcomes(self):
        samples = []
        for i in range(30):
            x, z = D(i % 7 - 3), D((i * i) % 11 - 5)
            samples.append(dict(date=date(2026, 1, 1) + timedelta(days=i),
                                mean_change=x, latest_change=z, supply_change=D("0.2") + D("0.6")*x + D("0.4")*z))
        first = model.fit(samples, date(2026, 7, 1))
        samples.append(dict(date=date(2026, 7, 3), mean_change=D("1000"),
                            latest_change=D("2000"), supply_change=D("-1000")))
        second = model.fit(samples, date(2026, 7, 1))
        self.assertEqual(first, second)
        for actual, expected in zip(first["coefficients"], map(D, ("0.2", "0.6", "0.4"))):
            self.assertLess(abs(actual - expected), D("0.000000001"))

    def test_sample_universe_keeps_every_gasoline_event_and_reason(self):
        orders = self.history + [order(date(2026, 10, 16), "130")]
        samples, unavailable = model.build_samples(orders, self.racks)
        self.assertEqual(len(samples), 1)
        self.assertEqual([u["date"] for u in unavailable], [date(2026, 10, 2), date(2026, 10, 9)])
        self.assertEqual(samples[0]["date"], date(2026, 10, 16))

    def test_unparsed_target_is_an_unavailable_event_not_silently_omitted(self):
        samples, unavailable = model.build_samples(self.history, self.racks, [date(2026, 10, 16)])
        self.assertEqual(samples, [])
        self.assertIn(date(2026, 10, 16), [u["date"] for u in unavailable])

    def test_persistence_details_use_the_actual_unchanged_zone_prices(self):
        actual = order(date(2026, 10, 16), "130")
        sample = model.build_samples(self.history + [actual], self.racks)[0][0]
        result = model.comparison(sample, self.parameters, persistence=True)
        self.assertIsNone(result["predicted_supply"])
        self.assertEqual(result["all_zone_minimum_errors"][5],
                         self.history[-1]["zones"][5]["minimum"] - actual["zones"][5]["minimum"])


if __name__ == "__main__":
    unittest.main()

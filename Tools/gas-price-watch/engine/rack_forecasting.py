"""Retrospective public-E10 change model; not the Board's licensed benchmark.

CAD cents/litre throughout. Train only before the frozen cutoff. Forecast B+F+C
as a subtotal, leaving those unseen individual components unclaimed.
"""
from datetime import date, timedelta
from decimal import Decimal as D, localcontext
import hashlib
import json
from math import ceil
from statistics import median

from pricing import TRANSPORT, calculate_supply, number, policy, rounded
from rack_data import rack_window

MODEL_VERSION = "halifax-e10-change-v2"
FIT_CUTOFF = date(2026, 7, 1)
HOLDOUT_END = date(2026, 10, 9)
MIN_TRAINING = 20


def day(value):
    return value if isinstance(value, date) else date.fromisoformat(value)


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, default=str, sort_keys=True,
                                     separators=(",", ":")).encode()).hexdigest()


def supply(order):
    """Use the operative price schedule even if a component table disagrees."""
    p = policy(day(order["date"]))
    return (number(order["zones"][0]["base_wholesale"]) - p["wholesale_margin"]
            - TRANSPORT[0] - p["carbon"])


def inputs(orders, target, racks, available_through=None, rejected_dates=()):
    target = day(target)
    available = day(available_through) if available_through else target - timedelta(days=1)
    history = sorted((o for o in orders if o["gasoline_setting"]
                      and day(o["date"]) < target and day(o["date"]) <= available),
                     key=lambda o: day(o["date"]))
    if len(history) < 2:
        raise ValueError("Two earlier gasoline settings are required for the rack-change windows")
    prior, anchor = history[-2:]
    a, b = day(prior["date"]), day(anchor["date"])
    if any(a < day(d) < target for d in rejected_dates):
        raise ValueError("An unresolved price order crosses the input windows")
    if target - b > timedelta(days=14):
        raise ValueError("The latest gasoline setting is too old to anchor this forecast")
    previous = rack_window(a, b - timedelta(days=1), racks, available_through=available)
    current = rack_window(b, target - timedelta(days=1), racks, available_through=available)
    return dict(anchor=anchor, anchor_date=b, prior_date=a, previous_rack_window=previous,
                rack_window=current, mean_change=current["mean"] - previous["mean"],
                latest_change=current["latest"] - previous["latest"])


def build_samples(orders, racks, rejected_dates=()):
    samples, unavailable = [], []
    for actual in sorted((o for o in orders if o["gasoline_setting"]), key=lambda o: day(o["date"])):
        target = day(actual["date"])
        try:
            info = inputs(orders, target, racks, target - timedelta(days=1), rejected_dates)
        except ValueError as exc:
            unavailable.append(dict(date=target, reason=str(exc)))
            continue
        anchor = info["anchor"]
        samples.append(dict(info, date=target, actual=actual,
                            supply_change=supply(actual) - supply(anchor)))
    known = {day(o["date"]) for o in orders}
    unavailable.extend(dict(date=day(d), reason="The target order could not be parsed; gasoline status is unresolved")
                       for d in set(rejected_dates) if day(d) not in known)
    return samples, sorted(unavailable, key=lambda u: u["date"])


def fit(samples, cutoff=FIT_CUTOFF):
    selected = [s for s in samples if day(s["date"]) < cutoff]
    if len(selected) < MIN_TRAINING:
        raise ValueError(f"At least {MIN_TRAINING} pre-cutoff observations are required")
    rows = [[D(1), number(s["mean_change"]), number(s["latest_change"])] for s in selected]
    outcomes = [number(s["supply_change"]) for s in selected]
    with localcontext() as context:
        context.prec = 40
        matrix = [[sum(x[i]*x[j] for x in rows) for j in range(3)]
                  + [sum(x[i]*y for x, y in zip(rows, outcomes))] for i in range(3)]
        for column in range(3):
            pivot = max(range(column, 3), key=lambda i: abs(matrix[i][column]))
            matrix[column], matrix[pivot] = matrix[pivot], matrix[column]
            scale = matrix[column][column]
            if abs(scale) < D("0.000000000001"):
                raise ValueError("Training features are singular")
            matrix[column] = [v / scale for v in matrix[column]]
            for row in range(3):
                if row != column:
                    weight = matrix[row][column]
                    matrix[row] = [v - weight*w for v, w in zip(matrix[row], matrix[column])]
        coefficients = [matrix[i][-1].quantize(D("0.000000000001")) for i in range(3)]
    training = [dict(date=s["date"], mean_change=s["mean_change"], latest_change=s["latest_change"],
                     supply_change=s["supply_change"]) for s in selected]
    bounds = {field: [min(number(s[field]) for s in selected), max(number(s[field]) for s in selected)]
              for field in ("mean_change", "latest_change")}
    return dict(model_version=MODEL_VERSION, fit_before=cutoff, training_count=len(selected),
                training_first=min(day(s["date"]) for s in selected),
                training_last=max(day(s["date"]) for s in selected), coefficients=coefficients,
                training_fingerprint=fingerprint(training), feature_bounds=bounds,
                features=["intercept", "period mean rack change", "latest posted rack change"],
                units="CAD cents per litre")


def predict(info, target, parameters):
    a, b, c = map(number, parameters["coefficients"])
    component = rounded(supply(info["anchor"]) + a + b*info["mean_change"] + c*info["latest_change"])
    credit = number(info["anchor"]["credit_card"])
    return component, [calculate_supply(target, z, component, credit) for z in range(1, 7)]


def estimate(orders, target, racks, parameters, *, available_through=None, rejected_dates=()):
    target = day(target)
    info = inputs(orders, target, racks, available_through, rejected_dates)
    component, zones = predict(info, target, parameters)
    payload = dict(model_version=parameters["model_version"], date=target,
                   training_fingerprint=parameters["training_fingerprint"],
                   model_parameters=parameters,
                   anchor_date=info["anchor_date"], prior_date=info["prior_date"],
                   anchor_supply=supply(info["anchor"]), credit_card=number(info["anchor"]["credit_card"]),
                   previous_rack_window=info["previous_rack_window"], rack_window=info["rack_window"])
    outside = [field for field, bounds in parameters.get("feature_bounds", {}).items()
               if not number(bounds[0]) <= info[field] <= number(bounds[1])]
    return dict(payload, supply_component=component, zones=zones,
                forecast_basis="combined benchmark + forward correction + clean-fuel subtotal",
                mean_change=info["mean_change"], latest_change=info["latest_change"],
                input_window_end=info["rack_window"]["end"],
                latest_quote_date=info["rack_window"]["latest_date"],
                input_fingerprint=fingerprint(payload), outside_training_features=outside,
                assumptions=[
                    "Halifax E10 rack-price changes approximate changes in the combined regulated supply cost.",
                    "The retail adjustment carries the last published value; known taxes and margins use their effective dates.",
                    "An intervening gasoline order changes the windows and requires a new refresh.",
                    "Rack history is the current archived series; historical publication vintages were not reconstructed.",
                    "No separate unseen benchmark, forward correction or CFR value is claimed.",
                ])


def error_summary(cases):
    if not cases:
        return dict(count=0)
    errors = sorted(abs(number(c["error"])) for c in cases)
    changing = [c for c in cases if number(c["actual_change"]) != 0]
    return dict(count=len(cases), mae=rounded(sum(errors)/len(errors)), median=rounded(median(errors)),
                p90=errors[ceil(D("0.9")*len(errors))-1], max_error=errors[-1],
                within_one_cent=sum(e <= 1 for e in errors), over_five_cents=sum(e > 5 for e in errors),
                over_ten_cents=sum(e > 10 for e in errors),
                direction_correct=sum(number(c["predicted_change"])*number(c["actual_change"]) > 0 for c in changing),
                direction_cases=len(changing))


def comparison(sample, parameters, persistence=False):
    actual, anchor, target = sample["actual"], sample["anchor"], sample["date"]
    component, zones = predict(sample, target, parameters)
    observed = number(actual["zones"][0]["minimum"])
    previous = number(anchor["zones"][0]["minimum"])
    predicted = previous if persistence else zones[0]["minimum"]
    predicted_zones = anchor["zones"] if persistence else zones
    all_errors = [rounded(number(z["minimum"]) - number(a["minimum"]), "0.1")
                  for z, a in zip(predicted_zones, actual["zones"])]
    maximum_errors = [rounded(number(z["maximum"]) - number(a["maximum"]), "0.1")
                      for z, a in zip(predicted_zones, actual["zones"])]
    return dict(date=target, predicted_minimum=predicted, actual_minimum=observed,
                error=rounded(predicted-observed, "0.1"), predicted_change=predicted-previous,
                actual_change=observed-previous, kind="scheduled Friday" if target.weekday() == 4 else "other gasoline setting",
                predicted_supply=None if persistence else component, actual_supply=supply(actual),
                supply_error=None if persistence else rounded(component-supply(actual)),
                assumed_credit_card=None if persistence else anchor["credit_card"],
                actual_credit_card=actual["credit_card"], mean_change=sample["mean_change"],
                latest_change=sample["latest_change"], anchor_date=sample["anchor_date"],
                input_window_end=sample["rack_window"]["end"], all_zone_minimum_errors=all_errors,
                all_zone_maximum_errors=maximum_errors,
                source_url=actual["source_url"])


def evaluate(orders, racks, *, cutoff=FIT_CUTOFF, holdout_end=HOLDOUT_END, rejected_dates=()):
    samples, unavailable = build_samples(orders, racks, rejected_dates)
    parameters = fit(samples, cutoff)
    training = [s for s in samples if s["date"] < cutoff]
    cv = [comparison(s, fit(training[:i], s["date"]))
          for i, s in enumerate(training) if i >= MIN_TRAINING]
    held = [s for s in samples if cutoff <= s["date"] <= holdout_end]
    cases = [comparison(s, parameters) for s in held]
    persistence = [comparison(s, parameters, persistence=True) for s in held]
    excluded = [u for u in unavailable if cutoff <= u["date"] <= holdout_end]
    universe = [o for o in orders if o["gasoline_setting"] and cutoff <= day(o["date"]) <= holdout_end]
    unresolved = {day(d) for d in rejected_dates if cutoff <= day(d) <= holdout_end
                  and day(d) not in {day(o["date"]) for o in orders}}
    return dict(parameters=parameters, cases=cases, excluded=excluded,
                summary=error_summary(cases), recent_summary=error_summary(cases),
                training_cv=dict(cases=cv, summary=error_summary(cv)),
                persistence=dict(cases=persistence, summary=error_summary(persistence)),
                coverage=dict(holdout_start=cutoff, holdout_end=holdout_end, total=len(universe)+len(unresolved),
                              available=len(cases), unavailable=len(excluded),
                              unresolved_targets=len(unresolved),
                              scheduled=sum(day(o["date"]).weekday() == 4 for o in universe),
                              other_settings=sum(day(o["date"]).weekday() != 4 for o in universe)),
                historical_unavailable=unavailable,
                caveat="Retrospective model holdout, not blinded. Current archives do not prove historical release vintages.")

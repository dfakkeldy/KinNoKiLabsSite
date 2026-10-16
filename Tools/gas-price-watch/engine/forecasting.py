"""An unvalidated free-data research estimate, separate from the regulated formula."""
from datetime import date, timedelta
from decimal import Decimal as D
from math import ceil
from statistics import mean

from pricing import calculate, proxy_window, rounded, fx_rate, US_GALLON_LITRES

# These weeks changed the policy for the unknown adjustors. Report them separately.
REGIME_CHANGES = {date(2026, 1, 9), date(2026, 5, 29), date(2026, 7, 3)}


def estimate(current, target, market, fx, history, rejected_dates=()):
    if current["date"].weekday() != 4 or target - current["date"] != timedelta(days=7):
        raise ValueError("The last gasoline setting interrupted the normal weekly window")
    anchor_start = current["date"] - timedelta(days=7)
    if not any(o["date"] == anchor_start and o["gasoline_setting"] for o in history):
        raise ValueError("Insufficient order history to verify the anchor benchmark window")
    if any(anchor_start < o["date"] < current["date"] and o["gasoline_setting"] for o in history):
        raise ValueError("The anchor benchmark used an interrupted pricing window")
    if any(current["date"] < o["date"] < target and o["gasoline_setting"] for o in history):
        raise ValueError("An intervening gasoline setting changed the target window")
    if any(anchor_start < d <= target for d in rejected_dates):
        raise ValueError("Unparsed or conflicting order in the anchor or target window")
    previous_proxy = proxy_window(current["date"], market, fx)
    next_proxy = proxy_window(target, market, fx)
    change = next_proxy["value"] - previous_proxy["value"]
    benchmark = rounded(current["benchmark"] + change)
    zones = [calculate(target, zone, benchmark, current["forward"],
                       current["clean_fuel"], current["credit_card"]) for zone in range(1, 7)]
    return dict(date=target, benchmark=benchmark, proxy_change=change,
                forward=current["forward"], clean_fuel=current["clean_fuel"],
                credit_card=current["credit_card"], zones=zones,
                previous_proxy=previous_proxy, next_proxy=next_proxy)


def error_summary(cases):
    if not cases:
        return {"count": 0}
    errors = sorted(abs(x["error"]) for x in cases)
    changes = [x for x in cases if x["actual_change"] != 0]
    return dict(count=len(cases), mae=rounded(mean(errors)),
                p90=errors[ceil(D("0.9") * len(errors)) - 1], max_error=errors[-1],
                within_one_cent=sum(x <= 1 for x in errors),
                direction_correct=sum((x["predicted_change"] > 0) == (x["actual_change"] > 0)
                                      and x["predicted_change"] != 0 for x in changes),
                direction_cases=len(changes))


def evaluate(orders, market, fx, rejected_dates, inconsistent_dates):
    orders = sorted(orders, key=lambda o: o["date"])
    by_date = {o["date"]: o for o in orders if o["gasoline_setting"]}
    cases, excluded = [], []
    for actual in orders:
        target = actual["date"]
        if target.weekday() != 4 or not actual["gasoline_setting"]:
            continue
        previous_date = target - timedelta(days=7)
        current = by_date.get(previous_date)
        reason = None
        if current is None:
            reason = "No previous Friday gasoline setting"
        elif any(previous_date < d <= target for d in rejected_dates):
            reason = "Unparsed or conflicting order in the pricing window"
        elif target in inconsistent_dates or previous_date in inconsistent_dates:
            reason = "Source arithmetic discrepancy"
        elif any(previous_date < o["date"] < target and o["gasoline_setting"] for o in orders):
            reason = "Intervening gasoline price setting"
        elif target in REGIME_CHANGES:
            reason = "Adjustor policy transition"
        if reason:
            excluded.append(dict(date=target, reason=reason))
            continue
        try:
            forecast = estimate(current, target, market, fx, orders, rejected_dates)
        except ValueError as exc:
            excluded.append(dict(date=target, reason=str(exc)))
            continue
        predicted = forecast["zones"][0]["minimum"]
        observed = actual["zones"][0]["minimum"]
        previous_price = current["zones"][0]["minimum"]
        calibration = error_summary(cases[-24:])
        half_width = calibration.get("p90") if calibration["count"] >= 12 else None
        cases.append(dict(date=target, predicted_minimum=predicted, actual_minimum=observed,
                          error=rounded(predicted - observed, "0.1"),
                          predicted_change=predicted - previous_price,
                          actual_change=observed - previous_price,
                          predicted_benchmark=forecast["benchmark"], actual_benchmark=actual["benchmark"],
                          assumed_forward=current["forward"], actual_forward=actual["forward"],
                          assumed_clean_fuel=current["clean_fuel"], actual_clean_fuel=actual["clean_fuel"],
                          assumed_credit_card=current["credit_card"], actual_credit_card=actual["credit_card"],
                          prior_p90=half_width, source_url=actual["source_url"]))
    return dict(cases=cases, excluded=excluded, summary=error_summary(cases),
                recent_summary=error_summary(cases[-24:]),
                since_july_summary=error_summary([c for c in cases if c["date"] >= date(2026, 7, 3)]))


def interrupter_risk(current, forecast, market, fx):
    days = sorted(d for d in market if current["date"] <= d <= date.fromisoformat(forecast["next_proxy"]["end"]))
    if len(days) < 2:
        return None
    offset = current["benchmark"] - forecast["previous_proxy"]["value"]
    changes = []
    for day in days[-2:]:
        try:
            _, rate = fx_rate(day, fx)
        except ValueError:
            return None
        value = 100 * market[day] * rate / US_GALLON_LITRES + offset
        changes.append(value - current["benchmark"])
    if all(x >= 6 for x in changes) or all(x <= -6 for x in changes):
        return dict(direction="up" if changes[-1] > 0 else "down",
                    dates=[d.isoformat() for d in days[-2:]], differences=[rounded(x) for x in changes])
    return None

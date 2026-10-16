"""Daily conditional Friday estimates and an experimental supply-cost watch.

Hold the latest real rack quote across unobserved dates. Projections are explicit
and never used to claim an observed interrupter condition. CAD cents/litre.
"""
from datetime import date, timedelta
from decimal import Decimal as D

import rack_forecasting as model
from pricing import number, rounded
from rack_data import rack_window

MODEL_VERSION = "halifax-e10-rolling-v3"
REFERENCE = D("6")
DECISION_URL = "https://nserbt.ca/sites/default/files/Decision%20%28Interruption%29.pdf"
FAQ_URL = "https://nserbt.ca/nseb/mandates/gasoline-diesel-pricing/frequently-asked-questions-faqs"


def next_friday(as_of):
    return as_of + timedelta(days=(4 - as_of.weekday()) % 7 or 7)


def weekdays(start, end):
    return [start + timedelta(days=i) for i in range((end-start).days+1)
            if (start + timedelta(days=i)).weekday() < 5]


def context(orders, target, racks, as_of, rejected_dates=()):
    target, as_of = model.day(target), model.day(as_of)
    if target != next_friday(as_of):
        raise ValueError("A rolling estimate targets the next scheduled Friday")
    history = sorted((o for o in orders if o["gasoline_setting"] and model.day(o["date"]) <= as_of),
                     key=lambda o: model.day(o["date"]))
    if len(history) < 2:
        raise ValueError("Two known gasoline settings are required")
    prior, anchor = history[-2:]
    a, b = model.day(prior["date"]), model.day(anchor["date"])
    if b < target - timedelta(days=7):
        raise ValueError("Waiting for the current Friday gasoline order before estimating the following week")
    if any(a < model.day(d) <= as_of for d in rejected_dates):
        raise ValueError("An unresolved known order crosses the rolling input windows")
    previous = rack_window(a, b-timedelta(days=1), racks, available_through=as_of)
    candidates = [d for d in racks if d <= as_of]
    if not candidates:
        raise ValueError("No published rack quote is available")
    latest = max(candidates)
    oldest = as_of - timedelta(days=1) if as_of.weekday() < 5 else as_of
    while oldest.weekday() >= 5:
        oldest -= timedelta(days=1)
    if latest < oldest:
        raise ValueError("The latest rack quote is stale for this refresh date")
    observed = (rack_window(b, latest, racks, available_through=as_of)
                if latest >= b and weekdays(b, latest) else None)
    return dict(anchor=anchor, anchor_date=b, prior_date=a, previous_rack_window=previous,
                observed=observed, latest_quote_date=latest, latest_quote=number(racks[latest]))


def estimate(orders, target, racks, parameters, as_of, rejected_dates=()):
    target, as_of = model.day(target), model.day(as_of)
    info = context(orders, target, racks, as_of, rejected_dates)
    latest = info["latest_quote_date"]
    rows = [dict(date=d, price=number(racks[d]) if d <= latest else info["latest_quote"],
                 projected=d > latest) for d in weekdays(info["anchor_date"], target-timedelta(days=1))]
    current = dict(start=info["anchor_date"], end=target-timedelta(days=1),
                   mean=sum(r["price"] for r in rows)/len(rows), latest=info["latest_quote"],
                   latest_date=latest, observations=rows)
    info.update(rack_window=current, mean_change=current["mean"]-info["previous_rack_window"]["mean"],
                latest_change=current["latest"]-info["previous_rack_window"]["latest"])
    component, zones = model.predict(info, target, parameters)
    projected = [r["date"] for r in rows if r["projected"]]
    projection = dict(method="hold_last_real_quote", observed_count=len(rows)-len(projected),
                      projected_count=len(projected), total_count=len(rows), dates=projected,
                      quote_date=latest, quote_price=info["latest_quote"])
    payload = dict(model_version=MODEL_VERSION, model_parameters=parameters,
                   training_fingerprint=parameters["training_fingerprint"], date=target, as_of=as_of,
                   anchor_date=info["anchor_date"], prior_date=info["prior_date"],
                   anchor_supply=model.supply(info["anchor"]), credit_card=number(info["anchor"]["credit_card"]),
                   previous_rack_window=info["previous_rack_window"], rack_window=current, projection=projection)
    outside = [field for field, bounds in parameters.get("feature_bounds", {}).items()
               if not number(bounds[0]) <= info[field] <= number(bounds[1])]
    return dict(payload, input_fingerprint=model.fingerprint(payload), zones=zones,
                supply_component=component, mean_change=info["mean_change"], latest_change=info["latest_change"],
                input_window_end=latest, latest_quote_date=latest,
                outside_training_features=outside, provisional=bool(projected),
                forecast_basis="combined supply subtotal, conditional on unchanged unobserved rack quotes",
                assumptions=[
                    "Each unobserved weekday holds the latest real posted quote. Projected rows are explicitly marked.",
                    "Missing dates before the latest observed quote are errors, never projections.",
                    "New gasoline orders reset the anchor and the remaining averaging window.",
                    "Known taxes and margins apply on the target date; the latest retail adjustment is carried.",
                    "This is a conditional rolling estimate, not an exact unpublished Board calculation.",
                ])


def interrupter_watch(orders, racks, parameters, as_of, rejected_dates=()):
    """Compare observed-data supply estimates, never a projected weekly pump move."""
    as_of = model.day(as_of)
    info = context(orders, next_friday(as_of), racks, as_of, rejected_dates)
    observed = info["observed"]
    rows = []
    for quote in (observed["observations"][-2:] if observed else []):
        d = quote["date"]
        window = rack_window(info["anchor_date"], d, racks, available_through=d)
        daily = dict(info, rack_window=window,
                     mean_change=window["mean"]-info["previous_rack_window"]["mean"],
                     latest_change=window["latest"]-info["previous_rack_window"]["latest"])
        component, _ = model.predict(daily, d+timedelta(days=1), parameters)
        rows.append(dict(date=d, rack_price=quote["price"], supply_gap=rounded(component-model.supply(info["anchor"]))))
    gaps = [r["supply_gap"] for r in rows]
    sustained = len(gaps) == 2 and (min(gaps) >= REFERENCE or max(gaps) <= -REFERENCE)
    single = bool(gaps) and abs(gaps[-1]) >= REFERENCE
    status = ("sustained_proxy_move" if sustained else "single_quote_move" if single
              else "below_reference" if gaps else "waiting_for_quotes")
    return dict(status=status, as_of=as_of, anchor_date=info["anchor_date"], reference_cents=REFERENCE,
                direction=("up" if gaps[-1] > 0 else "down") if single else None,
                latest_gap=gaps[-1] if gaps else None, observations=rows,
                latest_quote_date=info["latest_quote_date"], official_trigger_confirmed=False,
                regular_setting_next=bool(rows) and (rows[-1]["date"]+timedelta(days=1)).weekday() == 4,
                basis="Estimated combined supply-cost gap before taxes, not the Board's daily NYH benchmark",
                limitations="Experimental stress indicator. The six-cent reference and usual two-day persistence "
                            "come from Board guidance; different public inputs and Board discretion prevent a certain trigger prediction.",
                source_url=DECISION_URL, faq_url=FAQ_URL)


def _case(actual, prediction, as_of):
    observed = number(actual["zones"][0]["minimum"])
    predicted = prediction["zones"][0]["minimum"]
    return dict(date=model.day(actual["date"]), as_of=as_of, predicted_minimum=predicted,
                actual_minimum=observed, error=rounded(predicted-observed, "0.1"),
                # Direction refers to the current official minimum, not supply units.
                predicted_change=predicted-number(prediction["anchor_minimum"]),
                actual_change=observed-number(prediction["anchor_minimum"]),
                observed_count=prediction["projection"]["observed_count"],
                projected_count=prediction["projection"]["projected_count"],
                outside_training_features=prediction["outside_training_features"], source_url=actual["source_url"])


def evaluate(orders, racks, parameters, *, cutoff=model.FIT_CUTOFF, end=model.HOLDOUT_END, rejected_dates=()):
    """Separate lead-time errors and exploratory next-day interruption signals."""
    samples, _ = model.build_samples(orders, racks, rejected_dates)
    gas = sorted((o for o in orders if o["gasoline_setting"]), key=lambda o: model.day(o["date"]))
    friday = [o for o in gas if model.day(o["date"]).weekday() == 4 and model.day(o["date"]) <= end]
    horizons = {}
    for lead in range(1, 8):
        cases, earlier, unavailable = [], [], []
        for actual in friday:
            target = model.day(actual["date"])
            as_of = target-timedelta(days=lead)
            try:
                params = parameters if target >= cutoff else model.fit(samples, as_of+timedelta(days=1))
                f = estimate(orders, target, racks, params, as_of, rejected_dates)
                anchor = next(o for o in gas if model.day(o["date"]) == f["anchor_date"])
                f["anchor_minimum"] = anchor["zones"][0]["minimum"]
                c = _case(actual, f, as_of)
                c["intervening_settings"] = sum(as_of < model.day(o["date"]) < target for o in gas)
                (cases if target >= cutoff else earlier).append(c)
            except ValueError as exc:
                if target >= cutoff:
                    unavailable.append(dict(date=target, as_of=as_of, reason=str(exc)))
        unresolved = {model.day(d) for d in rejected_dates if cutoff <= model.day(d) <= end
                      and model.day(d).weekday() == 4 and model.day(d) not in {model.day(o["date"]) for o in gas}}
        unavailable.extend(dict(date=d, as_of=d-timedelta(days=lead), reason="Actual target order is unresolved")
                           for d in sorted(unresolved))
        horizons[str(lead)] = dict(cases=cases, summary=model.error_summary(cases),
                                  earlier_summary=model.error_summary(earlier), unavailable=unavailable,
                                  total=len(cases)+len(unavailable))
    by_date = {model.day(o["date"]): o for o in gas}
    events = {d for d in by_date if cutoff <= d <= end and d.weekday() != 4}
    unresolved_targets = {model.day(d) for d in rejected_dates if cutoff <= model.day(d) <= end
                          and model.day(d).weekday() != 4
                          and model.day(d) not in {model.day(o["date"]) for o in orders}}
    watch_cases, watch_unavailable = [], []
    for d in sorted(x for x in racks if cutoff <= x < end):
        if (d+timedelta(days=1)).weekday() == 4:
            continue  # Tomorrow is the regular setting, not a separate interruption.
        try:
            w = interrupter_watch(orders, racks, parameters, d, rejected_dates)
            target = d+timedelta(days=1)
            actual = by_date.get(target) if target in events else None
            anchor = next(o for o in gas if model.day(o["date"]) == w["anchor_date"])
            change = number(actual["zones"][0]["minimum"])-number(anchor["zones"][0]["minimum"]) if actual else None
            direction = ("up" if change > 0 else "down") if change else None
            watch_cases.append(dict(date=d, target=target, status=w["status"], direction=w["direction"],
                                    latest_gap=w["latest_gap"],
                                    actual_interruption=None if target in unresolved_targets else bool(actual),
                                    outcome_status="unresolved" if target in unresolved_targets else "known",
                                    actual_direction=direction, observations=w["observations"]))
        except ValueError as exc:
            watch_unavailable.append(dict(date=d, reason=str(exc)))
    summaries = {}
    for name, statuses in (("early", {"single_quote_move", "sustained_proxy_move"}),
                           ("sustained", {"sustained_proxy_move"})):
        alerts = [c for c in watch_cases if c["status"] in statuses]
        labeled = [c for c in alerts if c["outcome_status"] == "known"]
        hits = [c for c in alerts if c["actual_interruption"] and c["direction"] == c["actual_direction"]]
        summaries[name] = dict(alert_days=len(alerts), true_alert_days=len(hits),
                               false_alert_days=len(labeled)-len(hits), actual_events=len(events),
                               unresolved_alert_days=len(alerts)-len(labeled),
                               unresolved_target_dates=len(unresolved_targets),
                               detected_events=len({c["target"] for c in hits}), missed_events=len(events)-len(hits))
    return dict(horizons=horizons, watch=dict(cases=watch_cases, unavailable=watch_unavailable,
                                            unresolved_targets=sorted(unresolved_targets), summary=summaries),
                caveat="Retrospective and exploratory, not blinded. Actual publication vintages are unverified. "
                       "Lead-time tests retain errors across intervening interruptions. Watch checks next-calendar-day "
                       "non-Friday gasoline settings, not a calibrated probability or the official trigger.")

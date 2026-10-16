#!/usr/bin/env python3
"""Refresh verified public inputs and publish the Gas Price Watch JSON contract."""
import argparse
from contextlib import contextmanager
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import unquote, urlsplit
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "engine"))
import forecast_ledger
import ns_gas
import rolling

HALIFAX = ZoneInfo("America/Halifax")
MODELS = {"halifax-e10-change-v2", "halifax-e10-rolling-v3"}
WATCH_STATUSES = {"below_reference", "single_quote_move", "sustained_proxy_move",
                  "waiting_for_quotes", "unavailable"}
WATCH_FIELDS = ("actual_events", "detected_events", "false_alert_days", "missed_events",
                "unresolved_target_dates", "unresolved_alert_days")
SAFE_ERROR = ("The latest update could not verify current inputs. "
              "The estimate and watch are temporarily unavailable.")
COMPLETE_ASSUMPTIONS = [
    "Halifax E10 rack-price changes approximate changes in the combined regulated supply cost.",
    "The retail adjustment carries the last published value; known taxes and margins use their effective dates.",
    "An intervening gasoline order changes the windows and requires a new refresh.",
    "Rack history is the current archived series; historical publication vintages were not reconstructed.",
    "No separate unseen benchmark, forward correction or CFR value is claimed.",
]
ROLLING_ASSUMPTIONS = [
    "Each unobserved weekday holds the latest real posted quote. Projected rows are explicitly marked.",
    "Missing dates before the latest observed quote are errors, never projections.",
    "New gasoline orders reset the anchor and the remaining averaging window.",
    "Known taxes and margins apply on the target date; the latest retail adjustment is carried.",
    "This is a conditional rolling estimate, not an exact unpublished Board calculation.",
]
WATCH_LIMITATIONS = (
    "Experimental combined supply-cost indicator, not the Board's daily NYH benchmark or a probability. "
    "The retrospective exploratory check caught 2 of 3 events with 5 false-alert days for early signals; "
    "sustained signals caught 0 of 3 with 2 false alerts. Historical publication vintages are unverified. "
    "The Board uses different inputs and may exercise discretion."
)


def utc_now():
    return datetime.now(timezone.utc)


def _aware(value):
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("An aware timestamp is required")
    return value.astimezone(timezone.utc)


def _day(value):
    if type(value) is date:
        return value
    if isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return date.fromisoformat(value)
    raise ValueError("An ISO date is required")


def _amount(value, *, optional=False):
    if value is None and optional:
        return None
    if isinstance(value, bool):
        raise ValueError("A finite decimal amount is required")
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError("A finite decimal amount is required") from exc
    if not number.is_finite():
        raise ValueError("A finite decimal amount is required")
    return format(number, "f")


def _count(value):
    if type(value) is not int or value < 0:
        raise ValueError("A nonnegative integer count is required")
    return value


def _official_url(value):
    if not isinstance(value, str) or any(ord(c) < 32 for c in value) or "\\" in value:
        raise ValueError("An official public order URL is required")
    parsed = urlsplit(value)
    path = unquote(parsed.path)
    if (parsed.scheme != "https" or parsed.hostname != "nserbt.ca" or parsed.port not in (None, 443)
            or parsed.username is not None or parsed.password is not None or parsed.fragment
            or not path.startswith("/sites/default/files/") or not path.lower().endswith(".pdf")
            or ".." in path.split("/") or any(ord(c) < 32 for c in path)
            or (parsed.query and not re.fullmatch(r"\d+", parsed.query))):
        raise ValueError("An official public order URL is required")
    return value


def _zones(value):
    if not isinstance(value, list) or len(value) != 6:
        raise ValueError("All six zones are required")
    result = []
    for row in value:
        zone = row["zone"]
        if type(zone) is not int or zone not in range(1, 7):
            raise ValueError("A valid integer zone is required")
        minimum, maximum = _amount(row["minimum"]), _amount(row["maximum"])
        if Decimal(minimum) < 0 or Decimal(maximum) < Decimal(minimum):
            raise ValueError("Invalid zone price bounds")
        result.append(dict(zone=zone, minimum=minimum, maximum=maximum))
    if {r["zone"] for r in result} != set(range(1, 7)):
        raise ValueError("All six distinct zones are required")
    return sorted(result, key=lambda row: row["zone"])


def _current(value, checked):
    effective = _day(value["date"])
    gasoline_date = _day(value.get("gasoline_setting_date", value["date"]))
    if effective > checked.astimezone(HALIFAX).date():
        raise ValueError("Official prices are not yet effective")
    if gasoline_date > effective:
        raise ValueError("Gasoline setting cannot follow the current order")
    result = dict(date=effective.isoformat(), source_url=_official_url(value["source_url"]),
                  gasoline_setting_date=gasoline_date.isoformat(), zones=_zones(value["zones"]))
    for field in ("benchmark", "forward", "clean_fuel", "credit_card"):
        if field in value:
            result[field] = _amount(value[field])
    return result


def _summary(value):
    return dict(count=_count(value.get("count", 0)), mae=_amount(value.get("mae"), optional=True),
                max_error=_amount(value.get("max_error"), optional=True))


def _watch_summary(value):
    return {field: _count(value.get(field, 0)) for field in WATCH_FIELDS}


def _performance(evaluation):
    evaluation = evaluation or {}
    history = evaluation.get("rolling", {})
    horizons = []
    for lead, value in sorted(history.get("horizons", {}).items(), key=lambda pair: int(pair[0])):
        if not re.fullmatch(r"[1-7]", str(lead)):
            raise ValueError("Invalid retrospective horizon")
        horizons.append(dict(lead_days=int(lead), **_summary(value.get("summary", {})),
                             total=_count(value.get("total", 0)),
                             earlier_p90=_amount(value.get("earlier_summary", {}).get("p90"), optional=True)))
    watch = history.get("watch", {})
    return dict(complete=_summary(evaluation.get("summary", {})), rolling=horizons,
                watch=dict(decision_days=len(watch.get("cases", [])),
                           **{name: _watch_summary(watch.get("summary", {}).get(name, {}))
                              for name in ("early", "sustained")}))


def _saved_performance(value):
    return dict(complete=_summary(value["complete"]),
                rolling=[dict(lead_days=_count(r["lead_days"]), **_summary(r), total=_count(r["total"]),
                              earlier_p90=_amount(r.get("earlier_p90"), optional=True)) for r in value["rolling"]],
                watch=dict(decision_days=_count(value["watch"]["decision_days"]),
                           **{name: _watch_summary(value["watch"][name]) for name in ("early", "sustained")}))


def _scored_zones(value):
    result = []
    for row in value:
        result.append(dict(zone=row["zone"], **{field: _amount(row[field]) for field in (
            "predicted_minimum", "actual_minimum", "minimum_error", "predicted_maximum",
            "actual_maximum", "maximum_error")}))
    for prefix in ("predicted", "actual"):
        _zones([dict(zone=r["zone"], minimum=r[prefix + "_minimum"], maximum=r[prefix + "_maximum"])
                for r in result])
    return sorted(result, key=lambda row: row["zone"])


def _issued_results(rows):
    grouped, observed, pending = {}, set(), set()
    for row in rows:
        target = _day(row["date"]).isoformat()
        model = row["model_version"]
        if model not in MODELS or not re.fullmatch(re.escape(target + "/" + model) + r"-[0-9a-f]{12}\.json", row["record_id"]):
            raise ValueError("Invalid public forecast identifier")
        status = row["status"]
        if status not in ("pending", "scored"):
            raise ValueError("Invalid public score status")
        issued = _aware(row["issued_at"])
        effective = datetime.combine(_day(target), time(0, 1), HALIFAX).astimezone(timezone.utc)
        if issued >= effective:
            raise ValueError("Forecast was not issued before its effective time")
        result = dict(date=target, issued_at=issued.isoformat(), record_id=row["record_id"],
                      model_version=model, predicted_zones=_zones(row["predicted_zones"]), status=status)
        for field in ("effective_at", "observed_at"):
            if field in row:
                result[field] = _aware(row[field]).isoformat()
        if "input_fingerprint" in row:
            if not re.fullmatch(r"[0-9a-f]{64}", row["input_fingerprint"]):
                raise ValueError("Invalid public forecast fingerprint")
            result["input_fingerprint"] = row["input_fingerprint"]
        if status == "scored":
            result["zones"] = _scored_zones(row["zones"])
            if "source_url" in row:
                result["source_url"] = _official_url(row["source_url"])
            observed.add(target)
        else:
            pending.add(target)
            if row.get("reason") in ("Target price is not yet effective", "No actual order for the forecast effective date"):
                result["reason"] = row["reason"]
        grouped.setdefault(target, []).append(result)
    results = []
    for target in sorted(grouped)[-26:]:
        ordered = sorted(grouped[target], key=lambda row: (row["issued_at"], row["record_id"]))
        results.append(ordered[0])
        if ordered[-1]["record_id"] != ordered[0]["record_id"]:
            results.append(ordered[-1])
    return results, dict(observed_events=len(observed), pending_events=len(pending - observed))


def _estimate(value, target, current, checked, *, provisional=False):
    effective = datetime.combine(target, time(0, 1), HALIFAX).astimezone(timezone.utc)
    if checked >= effective:
        raise ValueError("Estimate is expired")
    local_day = checked.astimezone(HALIFAX).date()
    allowed_target = rolling.next_friday(local_day)
    if local_day.weekday() == 4 and checked < datetime.combine(local_day, time(0, 1), HALIFAX):
        allowed_target = local_day
    if target != allowed_target or _day(value["date"]) != target:
        raise ValueError("Estimate does not target the current scheduled setting")
    if _day(current["date"]) < target - timedelta(days=7):
        raise ValueError("Waiting for the current Friday official order")
    if "anchor_date" in value and _day(value["anchor_date"]) < target - timedelta(days=7):
        raise ValueError("Waiting for the current Friday gasoline setting")
    quote = _day(value["latest_quote_date"])
    issued = _aware(value["issued_at"])
    if quote > local_day or quote >= target or issued >= effective or issued > checked:
        raise ValueError("Estimate uses unavailable future inputs")
    oldest = local_day - timedelta(days=1) if local_day.weekday() < 5 else local_day
    while oldest.weekday() >= 5:
        oldest -= timedelta(days=1)
    if quote < oldest:
        raise ValueError("The latest observed quote is stale")
    if value["model_version"] not in MODELS:
        raise ValueError("Unknown public estimate model")
    outside = value.get("outside_training_features", [])
    if not isinstance(outside, list) or any(field not in ("mean_change", "latest_change") for field in outside):
        raise ValueError("Unknown fitted feature")
    coverage = value.get("projection")
    if coverage is None:
        total = len(value["rack_window"]["observations"])
        observed, projected = total, 0
    else:
        observed, projected, total = (_count(coverage[field]) for field in
                                      ("observed_count", "projected_count", "total_count"))
    if total == 0 or observed + projected != total:
        raise ValueError("Invalid quote coverage")
    mode = "extrapolation" if outside else "provisional" if provisional or projected else "complete"
    assumptions = list(ROLLING_ASSUMPTIONS if provisional else COMPLETE_ASSUMPTIONS)
    if outside:
        assumptions.append("Current features are outside fitted ranges. This is an extrapolation and no error band is assigned.")
    return dict(date=target.isoformat(), mode=mode, zones=_zones(value["zones"]), issued_at=issued.isoformat(),
                model_version=value["model_version"], observed_quotes=observed, total_quotes=total,
                projected_quotes=projected, latest_quote_date=quote.isoformat(),
                error_reference=None if outside else _amount(value.get("range_half_width"), optional=True),
                outside_training_features=list(outside), assumptions=assumptions)


def _watch(value, checked, current):
    if not value:
        return None
    status = value["status"]
    if status not in WATCH_STATUSES or value.get("direction") not in (None, "up", "down"):
        raise ValueError("Invalid watch status")
    anchor = _day(value.get("anchor_date", current["gasoline_setting_date"]))
    if anchor != _day(current["gasoline_setting_date"]):
        raise ValueError("Watch must use the latest gasoline setting")
    observations = []
    for row in value.get("observations", []):
        quote = _day(row["date"])
        if quote > checked.astimezone(HALIFAX).date() or quote < anchor:
            raise ValueError("Watch uses a future observation")
        observations.append(dict(date=quote.isoformat(), supply_gap=_amount(row["supply_gap"])))
    if value.get("source_url", rolling.DECISION_URL) != rolling.DECISION_URL:
        raise ValueError("Unknown watch source")
    return dict(status=status, anchor_date=anchor.isoformat(), latest_gap=_amount(value.get("latest_gap"), optional=True),
                reference_cents=_amount(value.get("reference_cents", rolling.REFERENCE)),
                direction=value.get("direction"), observations=observations,
                regular_setting_next=bool(value.get("regular_setting_next", False)),
                limitations=WATCH_LIMITATIONS, source_url=rolling.DECISION_URL)


def _sources():
    return [dict(name="Nova Scotia Energy and Regulatory Boards Tribunal", url=ns_gas.PRICES),
            dict(name="Kalibrate Halifax E10 daily wholesale prices", url="https://charting.kalibrate.com/"),
            dict(name="Natural Resources Canada daily Halifax wholesale prices", url=ns_gas.NRCAN_URL)]


def _base(checked, performance):
    return dict(schema_version=1, checked_at=checked.isoformat(), status="error", error=SAFE_ERROR,
                current=None, target_date=rolling.next_friday(checked.astimezone(HALIFAX).date()).isoformat(),
                estimate=None, watch=None, performance=performance, issued_forecasts=[],
                live_validation=dict(observed_events=0, pending_events=0), sources=_sources())


def _fallback(previous, checked, frozen):
    try:
        performance = _performance(frozen)
    except (AttributeError, KeyError, TypeError, ValueError):
        performance = _performance({})
    result = _base(checked, performance)
    if not isinstance(previous, dict) or previous.get("schema_version") != 1:
        return result
    # Recover each independent verified section, without copying unknown fields.
    for field, sanitize in (("current", lambda x: _current(x, checked)),
                            ("performance", _saved_performance)):
        try:
            result[field] = sanitize(previous[field])
        except (AttributeError, KeyError, TypeError, ValueError):
            pass
    try:
        results, counts = _issued_results(previous.get("issued_forecasts", []))
        result.update(issued_forecasts=results, live_validation=counts)
        saved_counts = previous.get("live_validation", {})
        if all(_count(saved_counts[key]) >= counts[key] for key in counts):
            result["live_validation"] = {key: saved_counts[key] for key in counts}
    except (AttributeError, KeyError, TypeError, ValueError):
        pass
    return result


@contextmanager
def _engine_directory(run, sources):
    original = ns_gas.ROOT, ns_gas.DATA, ns_gas.SOURCES
    ns_gas.ROOT, ns_gas.DATA, ns_gas.SOURCES = run, run / "data", sources
    ns_gas.DATA.mkdir(parents=True)
    try:
        yield
    finally:
        ns_gas.ROOT, ns_gas.DATA, ns_gas.SOURCES = original


def _records(root):
    result = {}
    if not root.exists():
        return result
    if root.is_symlink():
        raise ValueError("Immutable ledger must not be a symbolic link")
    for directory in sorted(root.iterdir()):
        if directory.is_symlink():
            raise ValueError("Immutable target directory must not be a symbolic link")
        if not directory.is_dir() or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", directory.name):
            raise ValueError("Unexpected ledger entry")
        for path in sorted(directory.iterdir()):
            record = forecast_ledger._read_record(path)
            if record["model_version"] not in MODELS:
                raise ValueError("Unreviewed immutable model")
            result[record["record_id"]] = path.read_bytes()
    return result


def _stage_ledger(source, destination):
    baseline = _records(source)
    for record_id, content in baseline.items():
        path = destination / record_id
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    return baseline


def _append_ledger(staged, destination, baseline):
    records = _records(staged)
    existing = _records(destination)
    if any(records.get(key) != value or existing.get(key) != value for key, value in baseline.items()):
        raise ValueError("Existing immutable forecast bytes changed")
    if any(key in existing and existing[key] != value for key, value in records.items()):
        raise ValueError("Immutable forecast identifier conflict")
    for record_id, content in records.items():
        if record_id in existing:
            continue
        target = destination / record_id
        target.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(prefix=".append-", dir=target.parent)
        temporary = Path(temporary_name)
        try:
            with os.fdopen(descriptor, "wb") as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())
            try:
                os.link(temporary, target)
            except FileExistsError:
                if target.is_symlink() or target.read_bytes() != content:
                    raise ValueError("Concurrent immutable forecast conflict")
        finally:
            temporary.unlink(missing_ok=True)


def _write_latest(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=".latest-", suffix=".tmp", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump(payload, stream, indent=2, ensure_ascii=False, allow_nan=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def refresh_public(cache_dir: Path, data_dir: Path, *, now: datetime | None = None, refresh_func=None) -> dict:
    """Publish a safe payload, retaining verified sections if a refresh fails.

    The optional callback has the same keywords as ns_gas.refresh:
    ``refresh_func(now=None, frozen_evaluation=dict) -> engine snapshot``.
    It runs with temporary engine ROOT/DATA and cache_dir/sources as SOURCES.
    An explicit aware ``now`` freezes test time. Production uses real time after
    downloads for issuance and after callback completion for checked_at.
    """
    cache_dir, data_dir = Path(cache_dir), Path(data_dir)
    checked = utc_now() if now is None else now
    previous, frozen = None, {}
    try:
        previous = json.loads((data_dir / "latest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    try:
        checked = _aware(checked)
        frozen = json.loads((ROOT / "frozen-evaluation.json").read_text(encoding="utf-8"))
        cache_sources = cache_dir / "sources"
        cache_sources.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="gas-price-watch-") as directory:
            run = Path(directory)
            with _engine_directory(run, cache_sources):
                baseline = _stage_ledger(data_dir / "issued-forecasts", ns_gas.DATA / "issued-forecasts")
                snapshot = (refresh_func or ns_gas.refresh)(now=now, frozen_evaluation=frozen)
                checked = _aware(now) if now is not None else utc_now()
                payload = _base(checked, _performance(frozen))
                current = dict(snapshot["current"], gasoline_setting_date=snapshot.get(
                    "last_gasoline_setting", snapshot["current"]["date"]))
                payload["current"] = _current(current, checked)
                payload["target_date"] = _day(snapshot["next_friday"]).isoformat()
                payload["issued_forecasts"], payload["live_validation"] = _issued_results(snapshot.get("issued_forecast_results", []))
                generated = _aware(snapshot["generated_at"])
                critical = {"prices.html", "historical-prices.html", "order-current.pdf", "rack/nrcan-halifax.html",
                            f"rack/e10-{checked.astimezone(HALIFAX).year}.xlsx"}
                official_sources = {"prices.html", "historical-prices.html", "order-current.pdf"}
                fresh = timedelta(0) <= checked - generated <= timedelta(hours=3)
                verified = not any(row["source"] in critical for row in snapshot.get("fetch_errors", []))
                official_verified = not any(row["source"] in official_sources for row in snapshot.get("fetch_errors", []))
                if not fresh or not official_verified:
                    payload = _fallback(previous, checked, frozen)
                elif verified:
                    # Valid pre-effective records remain real issuances even if
                    # a long refresh finishes after their publication deadline.
                    _append_ledger(ns_gas.DATA / "issued-forecasts", data_dir / "issued-forecasts", baseline)
                    candidate = snapshot.get("forecast") or snapshot.get("rolling_estimate")
                    if candidate:
                        try:
                            payload["estimate"] = _estimate(candidate, _day(payload["target_date"]), payload["current"], checked,
                                                              provisional=bool(snapshot.get("rolling_estimate")))
                            payload["watch"] = _watch(snapshot.get("interrupter_watch"), checked, payload["current"])
                            payload.update(status="ok", error=None)
                        except (KeyError, TypeError, ValueError):
                            payload.update(estimate=None, watch=None)
    except Exception:
        checked = _aware(now) if isinstance(now, datetime) and now.tzinfo is not None and now.utcoffset() is not None else utc_now()
        payload = _fallback(previous, checked, frozen)
    if now is None:
        checked = _aware(utc_now())
        payload["checked_at"] = checked.isoformat()
        if payload["estimate"] is not None:
            effective = datetime.combine(_day(payload["estimate"]["date"]), time(0, 1), HALIFAX)
            if checked >= effective or checked - generated > timedelta(hours=3):
                payload.update(status="error", error=SAFE_ERROR, estimate=None, watch=None)
    if payload["status"] == "error":
        payload["target_date"] = rolling.next_friday(checked.astimezone(HALIFAX).date()).isoformat()
    _write_latest(data_dir / "latest.json", payload)
    return payload


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, required=True)
    parser.add_argument("--data-dir", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        payload = refresh_public(args.cache_dir, args.data_dir)
    except OSError:
        print("Unable to write the public update payload.", file=sys.stderr)
        return 1
    print("Gas Price Watch update: " + payload["status"])
    return 0 if payload["status"] == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())

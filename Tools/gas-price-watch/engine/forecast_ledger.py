"""Immutable preannouncement forecasts and read-only, effective-date scoring.

The caller supplies the issuance and observation times. Records are published
atomically without replacing an existing file. Repeated identical inputs return
the original record. Scoring returns JSON-safe results and writes no files.
Prices and errors are Canadian cents per litre, represented as decimal strings.
"""
from datetime import date, datetime, time, timezone
from decimal import Decimal, InvalidOperation
import json
import math
import os
from pathlib import Path
import re
import tempfile
from zoneinfo import ZoneInfo


HALIFAX = ZoneInfo("America/Halifax")
ISSUANCE_FIELDS = {"issued_at", "effective_at", "record_id"}
MODEL_PATTERN = r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*"


def _day(value, field):
    if type(value) is date:
        return value
    if isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        try:
            return date.fromisoformat(value)
        except ValueError:
            pass
    raise ValueError(f"{field} must be an ISO date or date object")


def _aware(value, field):
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field} must be a timezone-aware datetime")
    return value.astimezone(timezone.utc)


def _amount(value):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError("Prices must be finite decimal values") from exc
    if not result.is_finite():
        raise ValueError("Prices must be finite decimal values")
    return format(result.normalize(), "f") if result else "0"


def _json_value(value):
    if isinstance(value, Decimal):
        if not value.is_finite():
            raise ValueError("Metadata must not contain nonfinite numbers")
        return str(value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        if not all(isinstance(key, str) for key in value):
            raise ValueError("Metadata object keys must be strings")
        return {key: _json_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_value(item) for item in value]
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("Metadata must not contain nonfinite numbers")
    if value is None or isinstance(value, (str, bool, int, float)):
        return value
    raise ValueError(f"Unsupported metadata value: {type(value).__name__}")


def _zones(value):
    if not isinstance(value, list) or not value:
        raise ValueError("zones must be a nonempty list")
    result, seen = [], set()
    for zone in value:
        if not isinstance(zone, dict) or not {"zone", "minimum", "maximum"} <= zone.keys():
            raise ValueError("Each zone requires zone, minimum and maximum")
        number = zone["zone"]
        if type(number) is not int or number not in range(1, 7) or number in seen:
            raise ValueError("Zone numbers must be unique integers from 1 to 6")
        minimum, maximum = _amount(zone["minimum"]), _amount(zone["maximum"])
        if Decimal(minimum) < 0 or Decimal(minimum) > Decimal(maximum):
            raise ValueError("Zone prices require 0 <= minimum <= maximum")
        result.append(dict(_json_value(zone), minimum=minimum, maximum=maximum))
        seen.add(number)
    return sorted(result, key=lambda zone: zone["zone"])


def _prepare(candidate, issued_at):
    required = {"date", "model_version", "input_fingerprint", "input_window_end",
                "latest_quote_date", "zones"}
    if not isinstance(candidate, dict) or not required <= candidate.keys():
        raise ValueError("Candidate is missing required forecast fields")
    if ISSUANCE_FIELDS & candidate.keys():
        raise ValueError("Issuance fields are supplied by the ledger, not the candidate")
    model = candidate["model_version"]
    fingerprint = candidate["input_fingerprint"]
    if not isinstance(model, str) or len(model) > 200 or not re.fullmatch(MODEL_PATTERN, model):
        raise ValueError("model_version must be a safe lowercase-hyphen identifier")
    if not isinstance(fingerprint, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", fingerprint):
        raise ValueError("input_fingerprint must contain 64 hexadecimal characters")
    target = _day(candidate["date"], "date")
    window_end = _day(candidate["input_window_end"], "input_window_end")
    quote_date = _day(candidate["latest_quote_date"], "latest_quote_date")
    issued = _aware(issued_at, "issued_at")
    effective = datetime.combine(target, time(0, 1), HALIFAX).astimezone(timezone.utc)
    if issued >= effective:
        raise ValueError("Forecast issuance must precede the target's 00:01 Halifax effective time")
    local_issue_day = issued.astimezone(HALIFAX).date()
    if window_end >= target or window_end > local_issue_day:
        raise ValueError("Input window must end before the target and no later than issuance day")
    if quote_date > local_issue_day:
        raise ValueError("Latest quote date must not be later than the local issuance day")
    normalized = _json_value(candidate)
    normalized.update(date=target.isoformat(), input_window_end=window_end.isoformat(),
                      latest_quote_date=quote_date.isoformat(),
                      input_fingerprint=fingerprint.lower(), zones=_zones(candidate["zones"]))
    record_id = f"{target.isoformat()}/{model}-{fingerprint[:12].lower()}.json"
    return normalized, issued, effective, record_id


def _logical_candidate(candidate):
    """Compare semantic inputs/results while retaining first-issuance evidence."""
    return {key: value for key, value in candidate.items()
            if key not in {"retrieved_sources", "source_verification"}}


def _read_record(path):
    if path.is_symlink():
        raise ValueError("Forecast record must not be a symbolic link")
    record = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(record, dict) or not ISSUANCE_FIELDS <= record.keys():
        raise ValueError("Invalid forecast ledger record")
    try:
        issued = datetime.fromisoformat(record["issued_at"])
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid recorded issuance time") from exc
    candidate = {key: value for key, value in record.items() if key not in ISSUANCE_FIELDS}
    normalized, issued, effective, record_id = _prepare(candidate, issued)
    expected = dict(normalized, issued_at=issued.isoformat(), effective_at=effective.isoformat(),
                    record_id=record_id)
    if record != expected or record_id != f"{path.parent.name}/{path.name}":
        raise ValueError("Forecast record metadata does not match its immutable identifier")
    return record


def record_forecast(root: Path, candidate: dict, issued_at: datetime) -> dict:
    """Publish the first valid issuance; reject conflicting reuse of its ID.

    All calls require a valid pre-effective issuance time. A replay returns the
    existing issuance time, even when the new valid supplied time is later.
    retrieved_sources and source_verification evidence may differ on replay; the
    first stored evidence is retained unchanged. All other inputs/results match.
    A temporary file is fully flushed before an exclusive hard-link publication.
    """
    normalized, issued, effective, record_id = _prepare(candidate, issued_at)
    record = dict(normalized, issued_at=issued.isoformat(), effective_at=effective.isoformat(),
                  record_id=record_id)
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    root = root.resolve()
    directory = root / normalized["date"]
    if directory.is_symlink():
        raise ValueError("Forecast target directory must not be a symbolic link")
    directory.mkdir(exist_ok=True)
    path = root / record_id
    descriptor, temporary_name = tempfile.mkstemp(prefix=".forecast-", suffix=".tmp", dir=directory)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            json.dump(record, output, indent=2, sort_keys=True, allow_nan=False)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        try:
            os.link(temporary, path)
        except FileExistsError:
            pass
        saved = _read_record(path)
        saved_candidate = {key: value for key, value in saved.items() if key not in ISSUANCE_FIELDS}
        if _logical_candidate(saved_candidate) != _logical_candidate(normalized):
            raise ValueError("Conflicting candidate inputs or prices for an existing forecast ID")
        return saved
    finally:
        temporary.unlink(missing_ok=True)


def score_forecasts(root: Path, orders: list, observed_at: datetime) -> list:
    """Return scored or explicitly pending records without changing ledger files.

    Scoring requires an exact effective-date order and observation strictly after
    00:01 Halifax on that date. Errors are predicted minus actual, in cents/litre.
    Missing actuals and forecasts not yet effective remain pending without errors.
    Conflicting actual orders fail closed instead of choosing a ground truth.
    """
    observed = _aware(observed_at, "observed_at")
    root = Path(root)
    if not root.exists():
        return []
    results = []
    for directory in sorted(root.iterdir()):
        try:
            _day(directory.name, "ledger target directory")
        except ValueError:
            continue
        if directory.is_symlink():
            raise ValueError("Forecast target directory must not be a symbolic link")
        if not directory.is_dir():
            continue
        for path in sorted(directory.glob("*.json")):
            if not re.fullmatch(MODEL_PATTERN + r"-[0-9a-f]{12}\.json", path.name):
                continue
            record = _read_record(path)
            result = {key: record[key] for key in
                      ("record_id", "date", "model_version", "input_fingerprint", "issued_at",
                       "effective_at")}
            result.update(status="pending", observed_at=observed.isoformat())
            result["predicted_zones"] = [dict(zone=z["zone"], minimum=z["minimum"], maximum=z["maximum"])
                                         for z in record["zones"]]
            if observed <= datetime.fromisoformat(record["effective_at"]):
                result["reason"] = "Target price is not yet effective"
                results.append(result)
                continue
            matching = [order for order in orders
                        if _day(order["date"], "actual order date").isoformat() == record["date"]]
            if not matching:
                result["reason"] = "No actual order for the forecast effective date"
                results.append(result)
                continue
            actual = matching[0]
            actual_zones = _zones(actual["zones"])
            for other in matching[1:]:
                if (_zones(other["zones"]) != actual_zones
                        or other.get("source_url") != actual.get("source_url")):
                    raise ValueError("Conflicting actual orders for the forecast effective date")
            if not isinstance(actual.get("source_url"), str) or not actual["source_url"]:
                raise ValueError("Actual order requires its source_url")
            by_zone = {zone["zone"]: zone for zone in actual_zones}
            zones = []
            for predicted in record["zones"]:
                if predicted["zone"] not in by_zone:
                    raise ValueError("Actual order is missing a forecast zone")
                actual_zone = by_zone[predicted["zone"]]
                zone = {"zone": predicted["zone"]}
                for bound in ("minimum", "maximum"):
                    zone[f"predicted_{bound}"] = predicted[bound]
                    zone[f"actual_{bound}"] = actual_zone[bound]
                    zone[f"{bound}_error"] = _amount(
                        Decimal(predicted[bound]) - Decimal(actual_zone[bound]))
                zones.append(zone)
            result.update(status="scored", source_url=actual["source_url"],
                          error_units="cents_per_litre", zones=zones)
            results.append(result)
    return results

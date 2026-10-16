#!/usr/bin/env python3
"""Refresh public data, check regulated prices and estimate the next Friday."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import csv
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import fcntl
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.parse import urljoin
from urllib.request import Request, urlopen
import webbrowser
from zoneinfo import ZoneInfo

import forecasting
import pricing
import rack_data
import rack_forecasting
import forecast_ledger
import rolling

ROOT = Path(__file__).resolve().parent
SOURCES = ROOT / "sources"
DATA = ROOT / "data"
BASE = "https://nserbt.ca"
PRICES = BASE + "/nseb/mandates/gasoline-diesel-pricing/gasoline-diesel-prices-zone-map"
HISTORY = BASE + "/nseb/mandates/gasoline-diesel-pricing/historical-prices"
EIA = "https://www.eia.gov/dnav/pet/hist/EER_EPMRU_PF4_Y35NY_DPGD.htm"
BOC = "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?start_date=2024-12-20"
RACK_URL = "https://charting.kalibrate.com/WPPS/E10/Wholesale/DAILY/{year}/E10_Wholesale_DAILY_{year}.xlsx"
NRCAN_URL = "https://www2.nrcan-rncan.gc.ca/eneene/sources/pripri/wholesale_bycity_e.cfm?productID=9&locationID=39&frequency=D"
REFERENCE_SOURCES = {
    "faq.html": BASE + "/nseb/mandates/gasoline-diesel-pricing/frequently-asked-questions-faqs",
    "regulations.html": "https://novascotia.ca/just/regulations/regs/ppprice.htm",
    "breakdown-2025-04-04.pdf": BASE + "/sites/default/files/Weekly%20Petroleum%20Pricing%20Example%20Apr%2004-25.pdf",
    "breakdown-2026-10-09.pdf": BASE + "/sites/default/files/Weekly%20Petroleum%20Pricing%20Example%20Oct%209-26.pdf",
    "retail-2026-05-26.pdf": BASE + "/sites/default/files/M12800%20-%20Decision%20Letter.pdf",
    "retail-interim-2026.pdf": BASE + "/sites/default/files/NSEB%20Board%20Interim%20Order%20-%20Retail%20Gasoline%20Dealers%20Association%20M12800.pdf",
    "clean-fuel-interim-2026.pdf": BASE + "/sites/default/files/M12909%20-%20Interim%20Order.pdf",
    "wholesale-clean-fuel-2025.pdf": BASE + "/sites/default/files/NSEB%20Board%20Decision%20-%20Steve%20R%20Murphys%20Auto%20Services%20Ltd%20and%20WSK%20Investments%20Limited%20M11978.pdf",
    "credit-card-order-2022.pdf": BASE + "/sites/default/files/NSUARB-%23297940-v1-Order_Petroleum_Pricing_Monthly_Adjust_.pdf",
    "forward-averaging.pdf": BASE + "/sites/default/files/forward_averaging.pdf",
    "interrupter-decision.pdf": BASE + "/sites/default/files/Decision%20%28Interruption%29.pdf",
}


def encode(value):
    if isinstance(value, (date, datetime, Decimal)):
        return str(value)
    raise TypeError(type(value).__name__)


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".new")
    temporary.write_text(json.dumps(value, default=encode, indent=2) + "\n")
    temporary.replace(path)


def download(item):
    name, url, reuse = item
    path = SOURCES / name
    if reuse and path.exists():
        content = path.read_bytes()
        metadata = dict(url=url, retrieved_at=datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
                        sha256=hashlib.sha256(content).hexdigest(), bytes=len(content), reused=True)
        return name, metadata, None
    try:
        request = Request(url, headers={"User-Agent": "NS-Gas-Calculator/1.0 (public-data research)"})
        with urlopen(request, timeout=25) as response:
            content = response.read()
        if name.endswith(".pdf") and not content.startswith(b"%PDF"):
            raise ValueError("Expected a PDF response")
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + ".download")
        temporary.write_bytes(content)
        temporary.replace(path)
        metadata = dict(url=url, retrieved_at=datetime.now(timezone.utc).isoformat(),
                        sha256=hashlib.sha256(content).hexdigest(), bytes=len(content))
        return name, metadata, None
    except Exception as exc:
        return name, None, f"{type(exc).__name__}: {exc}"


def download_batch(items, manifest):
    errors = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for name, metadata, error in pool.map(download, items):
            if metadata:
                manifest[name] = metadata
            if error:
                errors.append(dict(source=name, error=error))
    return errors


def pdf_text(path, force=False):
    target = path.with_suffix(".txt")
    if force or not target.exists() or target.stat().st_mtime < path.stat().st_mtime:
        binary = shutil.which("pdftotext")
        if binary is None and Path("/opt/local/bin/pdftotext").exists():
            binary = "/opt/local/bin/pdftotext"
        if binary is None:
            raise RuntimeError("pdftotext is required to read the Board's PDFs")
        subprocess.run([binary, "-layout", str(path), str(target)], check=True, capture_output=True)
    return target.read_text()


def history_entries(html, today):
    parser = pricing.Anchors()
    parser.feed(html)
    result = []
    for link in parser.links:
        if ".pdf" not in link["url"].lower():
            continue
        label = link["text"].replace("July.", "July").split(" (")[0]
        try:
            day = datetime.strptime(label, "%B %d, %Y").date()
        except ValueError:
            continue
        if date(2025, 1, 3) <= day <= today:
            result.append(dict(date=day, source_url=urljoin(BASE, link["url"])))
    return sorted(result, key=lambda x: x["date"])


def current_entry(html):
    # The page's visible effective date, not its HTTP cache timestamp.
    parser = pricing.Anchors()
    parser.feed(html)
    match = re.search(r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*"
                      r"([A-Z][a-z]+\s+\d{1,2},\s*\d{4})", html)
    if not match:
        raise ValueError("Cannot find the Board page's effective date")
    day = datetime.strptime(match[1], "%B %d, %Y").date()
    candidates = [x for x in parser.links if "documents/gas/gasprice.pdf" in x["url"]]
    if len(candidates) != 1:
        raise ValueError("Cannot identify the Board's current price order")
    return dict(date=day, source_url=urljoin(BASE, candidates[0]["url"]))


def parse_fx(content):
    response = json.loads(content)
    rates = {date.fromisoformat(row["d"]): pricing.number(row["FXUSDCAD"]["v"])
             for row in response["observations"] if "FXUSDCAD" in row}
    if not rates:
        raise ValueError("Bank of Canada returned no USD/CAD observations")
    return rates


def enforce_forecast_validation(snapshot, references):
    """Keep the unvalidated market proxy out of the live forecast contract."""
    reason = ("Live forecast withheld. The EIA conventional-gasoline proxy has not been validated "
              "against the regulated CBOB/ethanol assessments. Its historical comparison does "
              "not establish a reliable price for the next setting.")
    candidate = snapshot.get("forecast")
    snapshot["forecast_validation"] = dict(status="research_only", reason=reason)
    snapshot["experimental_estimate"] = candidate
    snapshot["forecast"] = None
    snapshot["forecast_unavailable"] = snapshot.get("forecast_unavailable") or reason
    snapshot["reference_forecasts"] = [r for r in references
                                       if r["effective_date"] == str(snapshot["next_friday"])]


def load_orders(entries, current):
    orders, rejected, arithmetic = [], [], []
    entries = {x["date"]: x for x in entries}
    entries[current["date"]] = current
    for day, entry in sorted(entries.items()):
        path = SOURCES / ("order-current.pdf" if day == current["date"] else f"orders/{day}.pdf")
        try:
            order = pricing.parse_order(pdf_text(path), day, entry["source_url"], orders[-1] if orders else None,
                                        allow_decision_date_conflict=day == date(2026, 5, 23))
            orders.append(order)
            issues = pricing.audit_order(order)
            if issues:
                arithmetic.append(dict(date=day, source_url=entry["source_url"], mismatches=issues))
        except (ValueError, OSError, subprocess.CalledProcessError) as exc:
            rejected.append(dict(date=day, source_url=entry["source_url"], reason=str(exc)))
    return orders, rejected, arithmetic


def load_racks(today, *, require_history=True):
    racks = {}
    for year in range(2025, today.year + 1):
        try:
            content = (SOURCES / f"rack/e10-{year}.xlsx").read_bytes()
        except FileNotFoundError:
            if not require_history and year < today.year:
                continue
            raise
        parsed = rack_data.parse_kalibrate_xlsx(content, as_of=today)
        if not parsed or any(d.year != year for d in parsed):
            raise ValueError(f"Rack workbook year disagrees with requested year {year}")
        if any(d in racks for d in parsed):
            raise ValueError("Rack workbooks contain duplicate dates")
        racks.update(parsed)
    secondary = rack_data.parse_nrcan_html((SOURCES / "rack/nrcan-halifax.html").read_text(), as_of=today)
    overlap = rack_data.verify_overlap(racks, secondary, today)
    return racks, overlap


def publish_rack_estimate(snapshot, orders, racks, evaluation, overlap, now):
    """Publish only complete, freshly verified windows; retain the old proxy separately."""
    critical = {"prices.html", "historical-prices.html", "order-current.pdf",
                f"rack/e10-{now.astimezone(ZoneInfo('America/Halifax')).year}.xlsx", "rack/nrcan-halifax.html"}
    if any(x["source"] in critical for x in snapshot["fetch_errors"]):
        raise ValueError("Current official/rack sources could not all be refreshed")
    if evaluation["coverage"]["unavailable"] or evaluation["summary"].get("count", 0) < 12:
        raise ValueError("The fixed holdout lacks complete coverage of the gasoline settings")
    if pricing.number(evaluation["summary"]["mae"]) >= pricing.number(evaluation["persistence"]["summary"]["mae"]):
        raise ValueError("The repaired model did not improve on the persistence baseline")
    forecast = rack_forecasting.estimate(orders, snapshot["next_friday"], racks, evaluation["parameters"],
                                        available_through=now.astimezone(ZoneInfo("America/Halifax")).date(),
                                        rejected_dates=[x["date"] for x in snapshot["audit"]["rejected_orders"]])
    if any(str(x["date"]) == str(forecast["anchor_date"])
           for x in snapshot["audit"]["arithmetic_issues"]):
        raise ValueError("The current gasoline order has an unresolved arithmetic or policy discrepancy")
    verified_dates = {str(d) for d in overlap.get("dates", [])}
    needed = {str(o["date"]) for window in (forecast["previous_rack_window"], forecast["rack_window"])
              for o in window["observations"]}
    if not needed <= verified_dates:
        raise ValueError("NRCan has not yet confirmed all rack observations in both forecast windows")
    if forecast["outside_training_features"]:
        raise ValueError("Current rack changes are outside the fitted feature ranges: "
                         + ", ".join(forecast["outside_training_features"]))
    forecast["range_half_width"] = evaluation["training_cv"]["summary"].get("p90")
    forecast["range_description"] = "Pre-July expanding-origin 90th-percentile absolute error; not a confidence guarantee"
    forecast["source_verification"] = overlap
    forecast["retrieved_sources"] = {k: v for k, v in snapshot["sources"].items()
                                      if k.startswith("rack/") or k == "order-current.pdf"}
    issued = forecast_ledger.record_forecast(DATA / "issued-forecasts", forecast, now)
    forecast["issued_at"] = issued["issued_at"]
    forecast["record_id"] = issued["record_id"]
    snapshot["forecast"] = forecast
    snapshot["forecast_unavailable"] = None
    snapshot["forecast_validation"] = dict(status="retrospectively_tested_estimate",
                                            reason="Fixed pre-July fit, full July-October retrospective holdout; live outcome pending")


def publish_rolling_estimate(snapshot, orders, racks, evaluation, overlap, now):
    as_of = now.astimezone(ZoneInfo("America/Halifax")).date()
    critical = {"prices.html", "historical-prices.html", "order-current.pdf",
                f"rack/e10-{as_of.year}.xlsx", "rack/nrcan-halifax.html"}
    if any(x["source"] in critical for x in snapshot["fetch_errors"]):
        raise ValueError("Current official/rack sources could not all be refreshed")
    f = rolling.estimate(orders, snapshot["next_friday"], racks, evaluation["parameters"], as_of,
                         rejected_dates=[x["date"] for x in snapshot["audit"]["rejected_orders"]])
    if any(str(x["date"]) == str(f["anchor_date"]) for x in snapshot["audit"]["arithmetic_issues"]):
        raise ValueError("The current gasoline order has an unresolved arithmetic or policy discrepancy")
    needed = {str(o["date"]) for o in f["previous_rack_window"]["observations"]}
    needed.update(str(o["date"]) for o in f["rack_window"]["observations"] if not o["projected"])
    if not needed <= {str(d) for d in overlap.get("dates", [])}:
        raise ValueError("NRCan has not yet confirmed every real rolling-input quote")
    snapshot["interrupter_watch"] = rolling.interrupter_watch(orders, racks, evaluation["parameters"], as_of,
                                                             [x["date"] for x in snapshot["audit"]["rejected_orders"]])
    snapshot["rolling_coverage"] = f["projection"]
    if not f["provisional"] and not f["outside_training_features"]:
        publish_rack_estimate(snapshot, orders, racks, evaluation, overlap, now)
        snapshot["rolling_estimate"] = None
        return
    quote_lead = (snapshot["next_friday"] - f["latest_quote_date"]).days
    calibration = evaluation["rolling"]["horizons"].get(str(quote_lead), {}).get("earlier_summary", {})
    usable_band = (calibration.get("count", 0) >= 12 and f["projection"]["observed_count"] > 0
                   and not f["outside_training_features"])
    f["range_half_width"] = calibration.get("p90") if usable_band else None
    f["range_calibration_quote_date"] = f["latest_quote_date"]
    f["range_calibration_days_ahead"] = quote_lead
    f["range_calibration_summary"] = calibration
    f["range_description"] = "Earlier expanding-origin absolute-error reference at the actual quote lead time; not a confidence guarantee"
    f["market_input_fingerprint"] = f["input_fingerprint"]
    f["input_fingerprint"] = rack_forecasting.fingerprint(dict(
        market_input_fingerprint=f["market_input_fingerprint"], quote_lead=quote_lead,
        calibration=calibration, range_half_width=f["range_half_width"]))
    f["source_verification"] = overlap
    f["retrieved_sources"] = {k: v for k, v in snapshot["sources"].items()
                              if k.startswith("rack/") or k == "order-current.pdf"}
    if f["outside_training_features"]:
        f["assumptions"].append("Current features are outside fitted ranges. This is an extrapolation and no error band is assigned.")
    issued = forecast_ledger.record_forecast(DATA / "issued-forecasts", f, now)
    f.update(issued_at=issued["issued_at"], record_id=issued["record_id"])
    snapshot.update(forecast=None, rolling_estimate=f, forecast_unavailable=None,
                    forecast_validation=dict(status="provisional", reason="Unobserved quotes hold their latest real value; later outcomes pending"))


def build_snapshot(manifest, fetch_errors, today, now=None, *, frozen_evaluation=None):
    """Build a snapshot, optionally using the vetted, frozen production model.

    Research callers retain full chronological fitting/evaluation by default.
    Hosted callers supply the original evaluation so revised or incomplete
    public archives cannot silently change model parameters or error references.
    """
    now = now or datetime.now(timezone.utc)
    entries = history_entries((SOURCES / "historical-prices.html").read_text(), today)
    current = current_entry((SOURCES / "prices.html").read_text())
    if current["date"] > today:
        raise ValueError("The Board page contains a future-effective order")
    orders, rejected, arithmetic = load_orders(entries, current)
    if not orders or orders[-1]["date"] != current["date"]:
        raise ValueError("The current official order could not be verified")
    # Legacy feeds are diagnostics only and cannot block the E10 model.
    legacy_errors = []
    try:
        market = pricing.parse_eia((SOURCES / "eia-gasoline.html").read_text())
        fx = parse_fx((SOURCES / "boc-fx.json").read_text())
    except (ValueError, KeyError, OSError) as exc:
        market, fx = {}, {}
        legacy_errors.append(str(exc))
    # A future row cannot be used even if an upstream source unexpectedly supplies one.
    market, fx = ({d: v for d, v in rows.items() if d <= today} for rows in (market, fx))
    rejected_dates = [x["date"] for x in rejected]
    inconsistent_dates = {x["date"] for x in arithmetic}
    legacy_evaluation = forecasting.evaluate(orders, market, fx, rejected_dates, inconsistent_dates)
    target = today + timedelta(days=(4 - today.weekday()) % 7)
    if target <= today:
        target += timedelta(days=7)
    forecast, unavailable = None, None
    gas_setting = next(o for o in reversed(orders) if o["gasoline_setting"])
    try:
        critical = {"prices.html", "historical-prices.html", "order-current.pdf", "eia-gasoline.html", "boc-fx.json"}
        if any(x["source"] in critical for x in fetch_errors):
            raise ValueError("Refresh could not retrieve every current source; cached data is shown")
        if gas_setting["date"] in inconsistent_dates:
            raise ValueError("The current gasoline order has an arithmetic discrepancy")
        if any(gas_setting["date"] < d < target for d in rejected_dates):
            raise ValueError("An intervening order could not be parsed")
        forecast = forecasting.estimate(gas_setting, target, market, fx, orders, rejected_dates)
        summary = legacy_evaluation["recent_summary"]
        forecast["range_half_width"] = summary.get("p90") if summary["count"] >= 12 else None
        forecast["interrupter_risk"] = forecasting.interrupter_risk(gas_setting, forecast, market, fx)
        forecast["assumptions"] = [
            "EIA conventional gasoline changes approximate the regulated CBOB/ethanol blend changes.",
            "Forward correction, clean-fuel adjustor and credit-card adjustment stay at their last published values.",
            "No intervening gasoline price setting or new policy order changes the window.",
        ]
    except ValueError as exc:
        unavailable = str(exc)
    latest = orders[-1]
    matching_pumps = sum(12 - sum(x["field"] in ("minimum", "maximum") for x in pricing.audit_order(o)) for o in orders)
    snapshot = dict(generated_at=now.isoformat(), as_of=today,
                    current=latest, last_gasoline_setting=gas_setting["date"], forecast=forecast, rolling_estimate=None,
                    interrupter_watch=dict(status="unavailable", reason="Verified current inputs are not available"),
                    forecast_unavailable=unavailable, next_friday=target, legacy_evaluation=legacy_evaluation,
                    audit=dict(orders=len(orders), matching_orders=len(orders) - len(arithmetic),
                               pump_comparisons=12 * len(orders), matching_pump_prices=matching_pumps,
                               arithmetic_issues=arithmetic, rejected_orders=rejected,
                               source_warnings=[dict(date=o["date"], source_url=o["source_url"], warning=w)
                                                for o in orders for w in o.get("source_warnings", [])]),
                    market_latest=max(market) if market else None, fx_latest=max(fx) if fx else None,
                    sources=manifest, fetch_errors=fetch_errors, legacy_errors=legacy_errors)
    references_path = DATA / "reference-forecasts.json"
    references = json.loads(references_path.read_text()) if references_path.exists() else []
    enforce_forecast_validation(snapshot, references)
    evaluation = dict(cases=[], excluded=[], summary={"count": 0}, recent_summary={"count": 0})
    try:
        racks, overlap = (load_racks(today) if frozen_evaluation is None
                          else load_racks(today, require_history=False))
        if frozen_evaluation is None:
            evaluation = rack_forecasting.evaluate(orders, racks, rejected_dates=rejected_dates)
            evaluation["rolling"] = rolling.evaluate(orders, racks, evaluation["parameters"], rejected_dates=rejected_dates)
        else:
            evaluation = deepcopy(frozen_evaluation)
        snapshot["rack_latest"] = max(racks)
        snapshot["rack_source_verification"] = overlap
        if frozen_evaluation is None:
            legacy_by_date = {c["date"]: c for c in legacy_evaluation["cases"]}
            common = [c for c in evaluation["cases"] if c["date"] in legacy_by_date]
            evaluation["legacy_common"] = dict(count=len(common),
                                              repaired=rack_forecasting.error_summary(common),
                                              withdrawn_proxy=rack_forecasting.error_summary([legacy_by_date[c["date"]] for c in common]))
        publish_rolling_estimate(snapshot, orders, racks, evaluation, overlap, now)
    except (ValueError, OSError) as exc:
        snapshot["forecast"] = None
        snapshot["rolling_estimate"] = None
        snapshot["interrupter_watch"] = dict(status="unavailable", reason=str(exc))
        snapshot["forecast_unavailable"] = "E10 estimate unavailable: " + str(exc)
        snapshot["forecast_validation"] = dict(status="unavailable", reason=str(exc))
    snapshot["evaluation"] = evaluation
    snapshot["issued_forecast_results"] = forecast_ledger.score_forecasts(DATA / "issued-forecasts", orders, now)
    DATA.mkdir(exist_ok=True)
    save_json(DATA / "latest.json", snapshot)
    save_json(DATA / "orders.json", orders)
    save_json(DATA / "evaluation.json", evaluation)
    save_json(DATA / "legacy-evaluation.json", legacy_evaluation)
    if evaluation.get("parameters"):
        save_json(DATA / "rack-model.json", evaluation["parameters"])
    if evaluation.get("rolling"):
        save_json(DATA / "rolling-evaluation.json", evaluation["rolling"])
    save_json(DATA / "issued-forecast-results.json", snapshot["issued_forecast_results"])
    with (DATA / "history.csv").open("w", newline="") as stream:
        fields = ["date", "zone", "benchmark", "forward", "clean_fuel", "credit_card",
                  "minimum", "maximum", "source_url", "gasoline_setting"]
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for order in orders:
            for zone in order["zones"]:
                writer.writerow({**{k: order[k] for k in fields if k in order},
                                 "zone": zone["zone"], "minimum": zone["minimum"], "maximum": zone["maximum"]})
    with (DATA / "backtest.csv").open("w", newline="") as stream:
        if evaluation["cases"]:
            writer = csv.DictWriter(stream, fieldnames=evaluation["cases"][0].keys())
            writer.writeheader()
            writer.writerows(evaluation["cases"])
    return snapshot


def refresh(*, now=None, frozen_evaluation=None):
    today = (now or datetime.now(timezone.utc)).astimezone(ZoneInfo("America/Halifax")).date()
    SOURCES.mkdir(parents=True, exist_ok=True)
    path = SOURCES / "manifest.json"
    manifest = json.loads(path.read_text()) if path.exists() else {}
    print("Refreshing Board prices and Halifax E10 rack data...", flush=True)
    errors = download_batch([("prices.html", PRICES, False), ("historical-prices.html", HISTORY, False),
                             ("eia-gasoline.html", EIA, False), ("boc-fx.json", BOC, False),
                             ("rack/nrcan-halifax.html", NRCAN_URL, False)]
                            + [(f"rack/e10-{year}.xlsx", RACK_URL.format(year=year), year < today.year)
                               for year in range(2025, today.year + 1)], manifest)
    entries = history_entries((SOURCES / "historical-prices.html").read_text(), today)
    current = current_entry((SOURCES / "prices.html").read_text())
    tasks = [(f"orders/{x['date']}.pdf", x["source_url"], True) for x in entries]
    tasks.append(("order-current.pdf", current["source_url"], False))
    tasks.extend((name, url, True) for name, url in REFERENCE_SOURCES.items())
    errors += download_batch(tasks, manifest)
    save_json(path, manifest)
    # The real issuance time is read after downloads, including midnight runs.
    today = (now or datetime.now(timezone.utc)).astimezone(ZoneInfo("America/Halifax")).date()
    snapshot = build_snapshot(manifest, errors, today, now=now, frozen_evaluation=frozen_evaluation)
    from report import render
    render(snapshot, ROOT / "report.html")
    (DATA / "last-refresh-error.json").unlink(missing_ok=True)
    summarize(snapshot)
    return snapshot


def load_saved_result():
    snapshot = json.loads((DATA / "latest.json").read_text())
    failure_path = DATA / "last-refresh-error.json"
    if failure_path.exists():
        failure = json.loads(failure_path.read_text())
        snapshot["last_failed_refresh_at"] = failure["attempted_at"]
        snapshot["forecast"] = None
        snapshot["rolling_estimate"] = None
        snapshot["interrupter_watch"] = dict(status="unavailable", reason="Latest refresh failed: " + failure["error"])
        snapshot["forecast_unavailable"] = "Refresh failed; saved forecast withdrawn: " + failure["error"]
        snapshot["fetch_errors"] = [dict(source="Latest refresh", error=failure["error"])]
    return snapshot


def record_refresh_failure(error):
    save_json(DATA / "last-refresh-error.json", dict(attempted_at=datetime.now(timezone.utc).isoformat(),
                                                    error=str(error)))
    if (DATA / "latest.json").exists():
        from report import render
        render(load_saved_result(), ROOT / "report.html")


def summarize(snapshot):
    current = snapshot["current"]
    print(f"Official regular gasoline, effective {current['date']}:")
    for z in current["zones"]:
        print(f"  Zone {z['zone']}: {z['minimum']} to {z['maximum']} cents/litre")
    forecast = snapshot["forecast"] or snapshot.get("rolling_estimate")
    if forecast:
        label = "Provisional rolling" if snapshot.get("rolling_estimate") else "Complete-window"
        print(f"{label} E10 estimate for {forecast['date']} (actual outcome pending):")
        if snapshot.get("rolling_estimate"):
            p = forecast["projection"]
            print(f"  {p['observed_count']}/{p['total_count']} real quotes; {p['projected_count']} assumed unchanged")
        for z in forecast["zones"]:
            print(f"  Zone {z['zone']}: {z['minimum']} to {z['maximum']} cents/litre")
        print(f"Fixed holdout mean error: {snapshot['evaluation']['summary'].get('mae')} cents/litre")
        print(f"Pre-July historical error reference: +/- {forecast['range_half_width']} cents/litre (not a guarantee)")
    else:
        print("Forecast unavailable: " + snapshot["forecast_unavailable"])
    watch = snapshot.get("interrupter_watch", {})
    print(f"Experimental interrupter watch: {watch.get('status', 'unavailable')}; estimated supply gap {watch.get('latest_gap')} cents/litre")
    for reference in snapshot.get("reference_forecasts", []):
        print(f"Reported forecast, {reference['source']}, {reference['effective_date']}: "
              f"{reference['gasoline_change_cents']} cents/litre")
    audit = snapshot["audit"]
    print(f"Formula matched {audit['matching_orders']}/{audit['orders']} parsed orders; "
          f"{len(audit['rejected_orders'])} orders require source review.")
    print("Report: " + str(ROOT / "report.html"))


def imported_benchmark(args):
    with Path(args.csv).open(newline="") as stream:
        rows = list(csv.DictReader(stream))
    dates = [date.fromisoformat(r["date"]) for r in rows]
    required = pricing.market_days(args.effective - timedelta(days=8), args.effective - timedelta(days=2))
    if args.effective.weekday() != 4 or sorted(dates) != required:
        raise ValueError("Supply exactly the daily observations for a normal Thursday-Wednesday pricing window")
    benchmark = pricing.blend_benchmark(rows)
    result = dict(status="Formula calculation using supplied assessments and adjustments",
                  date=args.effective, benchmark=benchmark,
                  zones=[pricing.calculate(args.effective, z, benchmark, args.forward,
                                           args.clean_fuel, args.credit_card) for z in range(1, 7)])
    print(json.dumps(result, default=encode, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    update = commands.add_parser("refresh", help="Download current public data and rebuild the report")
    update.add_argument("--open", action="store_true")
    report = commands.add_parser("report", help="Show the last saved results without downloading")
    report.add_argument("--open", action="store_true")
    calc = commands.add_parser("calculate", help="Calculate an all-zone scenario in Canadian cents/litre")
    calc.add_argument("--date", type=date.fromisoformat, default=datetime.now(ZoneInfo("America/Halifax")).date())
    calc.add_argument("--benchmark", type=pricing.number, required=True)
    market = commands.add_parser("benchmark", help="Calculate from licensed daily CBOB/ethanol assessments")
    market.add_argument("csv")
    market.add_argument("--effective", type=date.fromisoformat, required=True)
    for command in (calc, market):
        command.add_argument("--forward", type=pricing.number, required=True)
        command.add_argument("--clean-fuel", type=pricing.number, required=True)
        command.add_argument("--credit-card", type=pricing.number, required=True)
    args = parser.parse_args()
    try:
        if args.command == "refresh":
            with (ROOT / ".refresh.lock").open("w") as lock:
                try:
                    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    parser.error("A refresh is already running")
                refresh()
        elif args.command == "report":
            summarize(load_saved_result())
        elif args.command == "calculate":
            result = [pricing.calculate(args.date, z, args.benchmark, args.forward,
                                        args.clean_fuel, args.credit_card) for z in range(1, 7)]
            print(json.dumps(result, default=encode, indent=2))
        else:
            imported_benchmark(args)
        if getattr(args, "open", False):
            webbrowser.open((ROOT / "report.html").as_uri())
    except (ValueError, OSError, RuntimeError, KeyError) as exc:
        if args.command == "refresh":
            record_refresh_failure(exc)
            if getattr(args, "open", False) and (ROOT / "report.html").exists():
                webbrowser.open((ROOT / "report.html").as_uri())
        print(f"Unable to complete {args.command}: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

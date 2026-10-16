# Gas Price Watch hosted updater

The updater uses the existing Nova Scotia regular self-service gasoline engine for all six zones, in CAD cents per litre. The public JSON format and expiry rules are in [PUBLIC_CONTRACT.md](PUBLIC_CONTRACT.md).

## Run

Use Python 3.10 or newer and `pdftotext` from Poppler. Python dependencies are all in the standard library. On Ubuntu, install `poppler-utils` for the official order PDFs.

```sh
python3 Tools/gas-price-watch/hosted_refresh.py \
  --cache-dir /tmp/gas-price-watch-cache \
  --data-dir /tmp/gas-price-watch-data
```

The data directory is the checked-out public data branch. The cache directory should persist between hosted runs and stay outside Git. It contains downloaded public Board PDFs, Kalibrate workbooks, NRCan HTML and retrieval metadata. The updater writes only `latest.json` and new immutable records beneath `issued-forecasts/` to the data directory.

Exit status is `0` when an active complete, provisional or extrapolated estimate passes verification. A withheld estimate or refresh failure returns `1` and writes a safe error payload. The publishing workflow must still publish that payload so readers see the withdrawal. Filesystem write failures also return `1`.

On failure, the payload retains verified official prices, retrospective performance and issued forecast results. A market-source outage still publishes independently verified new Board prices and newly scored outcomes; Board-source failures retain the previous verified sections. It clears both the estimate and watch. With no verified prior feed, `current` is `null`. Public JSON contains approved fields and public source URLs only; exception details and temporary paths stay out of it.

The engine downloads and parses the original public sources. Current Board pages, the current order, the current-year E10 workbook and NRCan confirmation must refresh successfully. Unused legacy EIA or FX diagnostics cannot block a valid E10 estimate. Missing observations within a required input window still fail verification. A missing unused past-year workbook does not require a production refit or block current windows.

The engine reads the real issuance clock after downloading. The public `checked_at` uses the completion clock, and publication rechecks expiry at 00:01 America/Halifax, including daylight saving time. The public feed preserves the last gasoline setting date separately from the latest official order, so a diesel-only order does not reset the watch. A new Friday requires its official gasoline setting before the following week's estimate is available. Explicit `now` arguments are for deterministic tests.

## Frozen model and retrospective evidence

`frozen-evaluation.json` is the vetted evaluation snapshot, preserved byte for byte with SHA-256 `b64be7630014e4d5755fa809573b7f09a0fa2d6e8664629e788481c2c967030a`. The hosted wrapper supplies it to `ns_gas.refresh(frozen_evaluation=...)`; hosted refreshes do not refit coefficients, recalculate historical error references or overwrite the original `legacy_common` comparison from incomplete or revised archives. Direct engine research calls without the override keep the original fitting and evaluation behavior.

The complete-window model has 86 pre-July training settings. Its later retrospective comparison covers 18 conditional settings, with mean absolute error 1.64 c/L. The rolling comparison includes 15 Friday outcomes at each horizon, with mean absolute error 4.89 c/L seven days ahead and 1.69 c/L one day ahead. The largest early held-out miss is 14.0 c/L. These are retrospective comparisons; historical publication vintages were not reconstructed.

The experimental watch has weak exploratory results across 57 quote-day decisions. Early signals detected 2 of 3 interruptions with 5 false-alert days. Sustained signals detected 0 of 3 with 2 false alerts. It uses real observed rack quotes to estimate a combined supply-cost gap. It does not calculate the Board's actual daily NYH benchmark, an interruption probability or an exact trigger prediction.

Provisional estimates explicitly hold each unobserved quote at the latest real value. Their error reference follows the actual latest quote's lead time. Extrapolations and estimates with insufficient calibration or no newly observed quotes have no error reference. Every error reference is historical absolute error, without a confidence guarantee.

## Immutable records

Each run receives a temporary engine `ROOT` and `DATA`, while `SOURCES` points to the persistent public cache. Only validated original ledger records from the data branch are copied into the temporary run. The engine issues or replays records there, and the exporter preflights all existing bytes before exclusively appending new valid records. A changed existing record or conflicting identifier fails closed. It never overwrites a record or copies research directories or vendor archives into the public branch.

The original complete-window v2 fields and identity calculation are unchanged. The provisional v3 uncertainty fingerprint is also unchanged. Repeated semantic inputs retain the original issuance time and evidence. Scoring requires an official order for the exact effective date and observation after its 00:01 Halifax effective time. Public history shows the first and latest result for each of the latest 26 target dates. Live validation counts distinct effective dates, so repeated issues do not become extra observed events.

The callable API is:

```python
refresh_public(cache_dir: Path, data_dir: Path, *, now=None, refresh_func=None) -> dict
```

An injected callback accepts `now` and `frozen_evaluation` keyword arguments and returns the engine snapshot. It runs inside the same isolated engine directory context. Production passes `now=None`; tests may supply an aware datetime. The wrapper restores the original engine paths after every run.

## Verification

```sh
python3 -m unittest discover -s Tools/gas-price-watch/tests
```

The suite contains 130 tests: 99 ported engine tests and 31 hosted-wrapper or frozen-model tests. Tests cover policy dates, holidays, leakage, missing quotes, projections, watch outcomes, time zones, frozen parameters, public field filtering, error fallback, unique event counts and immutable record conflicts. All mutations and issuance use temporary directories. Tests do not download sources or touch an existing private ledger.

Ten of the original 109 tests are intentionally omitted: five report-interface tests for the old local HTML report, and five integration tests requiring downloaded vendor XLSX or HTML archives. Synthetic XLSX and HTML fixtures retain parser and validation coverage. The public page has its separate frontend tests; live source integration is a separate verification step.

The seven government order-text fixtures are extracts from these public official PDFs:

| Effective date | Official source |
| --- | --- |
| 2025-01-17 | [NSUARB order 252](https://nsuarb.novascotia.ca/sites/default/files/gasprice_252.pdf) |
| 2026-02-06 | [Tribunal order 304](https://nserbt.ca/sites/default/files/gasprice_304.pdf) |
| 2026-05-23 | [Tribunal order 330](https://nserbt.ca/sites/default/files/gasprice_330.pdf) |
| 2026-09-11 | [Tribunal order 353](https://nserbt.ca/sites/default/files/gasprice_353.pdf) |
| 2026-09-12 | [Tribunal order 354](https://nserbt.ca/sites/default/files/gasprice_354.pdf) |
| 2026-10-02 | [Tribunal order 359](https://nserbt.ca/sites/default/files/gasprice_359.pdf) |
| 2026-10-09 | [Tribunal order 360](https://nserbt.ca/sites/default/files/gasprice_360.pdf) |

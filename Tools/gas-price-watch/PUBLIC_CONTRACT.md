# Gas Price Watch public contract

Gas Price Watch is published at https://kinnokilabs.com/gas/, with hosted automatic updates and a link from fakkeldy.ca. Regular self-service gasoline, all six Nova Scotia zones, CAD cents per litre. Forecasts are experimental and conditional. No accounts, visitor tracking, precise location, or submissions.

## Data

The public page fetches `https://raw.githubusercontent.com/dfakkeldy/KinNoKiLabsSite/gas-price-watch-data/latest.json` with a same-directory `bootstrap.json` fallback. The GitHub-hosted updater runs hourly and writes the separate data branch without rebuilding the static site. The data branch is excluded from Cloudflare preview builds. Main-branch code still follows PR checks and normal deployment.

Schema version 1, JSON strings for all monetary values. Required fields:

- `schema_version`:1; `checked_at`:UTC ISO datetime; `status`:ok/error; `error`:null or safe public message.
- `current`: null when no verified order is available, otherwise the latest verified official order, with ISO `date`, `gasoline_setting_date`, `source_url`, `zones` containing integer `zone` and decimal-string `minimum`/`maximum`. Published `benchmark`, `forward`, `clean_fuel`, `credit_card` remain identifiable.
- `target_date`: ISO next Friday.
- `estimate`:null or `{date, mode, zones, issued_at, model_version, observed_quotes, total_quotes, projected_quotes, latest_quote_date, error_reference, outside_training_features, assumptions}`. `mode` is complete/provisional/extrapolation. `error_reference` is null or a CAD c/L historical absolute-error halfwidth, never a confidence guarantee.
- `watch`:null or `{status,anchor_date,latest_gap,reference_cents,direction,observations,regular_setting_next,limitations,source_url}`. Observations have ISO `date` and decimal-string `supply_gap`. Status below_reference/single_quote_move/sustained_proxy_move/waiting_for_quotes/unavailable. The anchor matches the last gasoline setting, including when a later order changes diesel only. This uses real quotes only and estimates combined supply costs, not the actual NYH benchmark.
- `performance`: `{complete,rolling,watch}`. Complete has count/mae/max_error. Rolling is an array `{lead_days,count,total,mae,max_error,earlier_p90}`. Watch has `decision_days`, `early` and `sustained` summaries with actual_events/detected_events/false_alert_days/missed_events/unresolved_target_dates/unresolved_alert_days.
- `issued_forecasts`: first and latest ledger result for each of the most recent 26 target dates, with the existing immutable-ledger score schema: date, issued_at, record_id, model_version, predicted_zones, status pending/scored, and scored `zones` with predicted_minimum,actual_minimum,minimum_error etc. Multiple records for one date never count as multiple independent live events.
- `live_validation`: `{observed_events,pending_events}` counts distinct effective dates.
- `sources`: array `{name,url}` primary public sources. No private paths, board notes, emails or copied raw vendor archives.

## User experience and expiry

Lead with official current price and a clearly labelled estimate for the selected zone, default Zone 6. Show observation coverage and assumptions, early versus late retrospective errors, prior predictions/actuals, and an experimental watch with false alarms visible. Mobile first, reuse the site's visual system and source attribution.

`checked_at` older than 3 hours, status error, or an estimate whose date has reached 00:01 America/Halifax must withhold the estimate and watch. Show the last verified official values with their date and a stale/error message. Recheck expiry while the page remains open and after background tab resumes. A new Friday requires its official order before the following week's forecast is current. Do not silently show an expired bootstrap estimate when the live feed fails. No new user input leaves the browser; fetches use the same public URL for every zone.

The later complete test is 18 conditional price settings, MAE 1.64 c/L. The rolling test is 15 Friday outcomes per horizon, MAE 4.89 at 7 days and 1.69 at 1 day; largest early heldout miss 14.0. Watch is exploratory: 57 quote-day decisions, early 2/3 with 5 false-alert days; sustained 0/3 with 2 false alerts. Publication vintages unverified, no blinded or prospective accuracy claim. Actual outcomes update from the ledger.

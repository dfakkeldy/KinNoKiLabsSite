# Gas Price Watch public data

The live page is https://kinnokilabs.com/gas/. This branch holds the public JSON snapshot and immutable predictions issued before their target price settings. The hourly updater is maintained and reviewed on the repository main branch.

`latest.json` includes a verification timestamp, dated official prices, conditional estimates, experimental watch indicators, and results for previous predictions. Consumers must enforce the timestamp and target-date expiry; a stored estimate is not automatically current.

Each file in `issued-forecasts/` is append-only. Multiple issues for the same effective date count as one observed event. Original prediction files remain unchanged when actual prices arrive; outcomes are calculated into `latest.json`.

Only public derived data is committed here. Raw source archives stay in the updater cache. This branch is excluded from Cloudflare preview deployments because it does not contain the website.

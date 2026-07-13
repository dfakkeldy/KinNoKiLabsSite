# Task 14A Report: Public routes, bootstrap, artwork, and generated output

## Status

Complete.

## TDD evidence

- RED: `node --test Tests/games/routes.test.mjs` failed with 11 expected failures: both metadata-only content sources were absent, the bootstrap did not use validator-aware store opening or lazy cargo controllers, six new resources were absent from generated output, and both public cargo routes were absent.
- Boundary RED: after source implementation but before generation, the same suite passed its source/bootstrap assertions and retained 8 expected generated-output failures.
- Artwork-review RED: the durable raster hash check failed against the superseded social art while the corrected five-card hub regression passed.
- GREEN: after `make generate`, the focused suite passed all 18 tests.
- GREEN: `make test-games` passed all 298 tests.

## Implementation

- Added metadata-only `/games/kinnoki-stack` and `/games/kinnoki-yard` content pages and updated hub metadata for five games.
- Added Publish route markers that render both cargo games through the shared game shell with Games navigation active.
- Replaced the bootstrap with validator-aware v2 store opening, lazy imports for all five controllers, migration/write failure notices, and shared recoverable error rendering.
- Added source/bootstrap regression coverage alongside generated resource, route, navigation, and metadata assertions.
- Updated the Arcade Hall architecture notes in `AGENTS.md` and `CLAUDE.md`.
- Replaced the shared social raster with the approved built-in imagegen edit from `/Users/dfakkeldy/.codex/generated_images/019f57f7-7834-7ee3-ab54-c036f1712a0f/exec-31fc803c-5d4b-4d80-9713-a4295ae43a27.png`. The edit prompt retained the graphite-black and metallic-gold five-vignette composition and exact `KinNoKi Arcade Hall` / `Five ways to play.` text while replacing the two right-side game panels with irregular two-to-five-cell cargo parcels that avoid recognizable T/O/I/L/J/S/Z tetromino silhouettes and any seven-piece set. The reviewed result was one pixel wider than requested, so only its width was normalized to the required 1734-by-907 dimensions with `sips` before source generation.
- Updated the older core hub regression to name and count all five cards.

## Generated output

- `Output/` was created only through `make generate`; no generated file was hand-edited.
- Source and generated social rasters are byte-identical with SHA-256 `e6246c17edf3e48206a8ed1f49cc948fe578d1b0c9437f3edbf12534e8c1d3bb`.
- Required generated routes and controller resources exist.
- Three complete post-review generations produced identical full-tree SHA-256 values: `f154f769ee84b658d6868ac7eae3ae0b71073c023dedbcefbfb9b3adf87c4eac`.
- The generated integration includes source work accumulated by Tasks 1A through 13, as intended by Task 14A's source-plus-generated-output boundary.

## Verification

- Focused route/source/bootstrap suite — 18/18 pass
- Full `make test-games` suite — 298/298 pass
- Social raster dimensions — 1734 by 907
- Social raster reviewed text, five-panel composition, and irregular non-tetromino cargo parcels — pass
- Required generated file assertions — pass
- Reproducible full `Output/` tree hash — pass
- `git diff --check -- Output` — pass

## Concerns

- None remaining from the artwork review. The exact reviewed raster is pinned by dimensions and SHA-256 in the route suite, and generation is required to copy it byte-for-byte.

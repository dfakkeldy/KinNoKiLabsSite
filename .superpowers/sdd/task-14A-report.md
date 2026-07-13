# Task 14A Report: Public routes, bootstrap, artwork, and generated output

## Status

Complete.

## TDD evidence

- RED: `node --test Tests/games/routes.test.mjs` failed with 11 expected failures: both metadata-only content sources were absent, the bootstrap did not use validator-aware store opening or lazy cargo controllers, six new resources were absent from generated output, and both public cargo routes were absent.
- Boundary RED: after source implementation but before generation, the same suite passed its source/bootstrap assertions and retained 8 expected generated-output failures.
- GREEN: after `make generate`, the focused suite passed all 18 tests.
- GREEN: `make test-games` passed all 298 tests.

## Implementation

- Added metadata-only `/games/kinnoki-stack` and `/games/kinnoki-yard` content pages and updated hub metadata for five games.
- Added Publish route markers that render both cargo games through the shared game shell with Games navigation active.
- Replaced the bootstrap with validator-aware v2 store opening, lazy imports for all five controllers, migration/write failure notices, and shared recoverable error rendering.
- Added source/bootstrap regression coverage alongside generated resource, route, navigation, and metadata assertions.
- Updated the Arcade Hall architecture notes in `AGENTS.md` and `CLAUDE.md`.
- Replaced the shared social raster with original five-vignette graphite-black and metallic-gold artwork carrying the exact `KinNoKi Arcade Hall` and `Five ways to play.` text. The image-generation result was one pixel narrower than requested, so it was proportionally normalized to the required 1734-by-907 dimensions with `sips` before source generation.

## Generated output

- `Output/` was created only through `make generate`; no generated file was hand-edited.
- Required generated routes and controller resources exist.
- Two complete generations produced identical full-tree SHA-256 values: `a7b19850cdc16f441072ed8cc63f35a5e99902859a03baad00ec2994147b9a89`.
- The generated integration includes source work accumulated by Tasks 1A through 13, as intended by Task 14A's source-plus-generated-output boundary.

## Verification

- Focused route/source/bootstrap suite — 18/18 pass
- Full `make test-games` suite — 298/298 pass
- Social raster dimensions — 1734 by 907
- Required generated file assertions — pass
- Reproducible full `Output/` tree hash — pass
- `git diff --check -- Output` — pass

## Concerns

- The generated artwork is polished and meets the content, contrast, safe-margin, and prohibited-branding constraints. As with any AI-generated text-bearing raster, future visual review should retain the committed original-resolution asset rather than recompressing it.

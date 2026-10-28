---
title: NS Marks The Spot
description: A source-linked Nova Scotia parcel and tax-sale map, with Fletcher's 1880s sheets as an optional overlay.
image: /images/apps/nsmarksthespot.svg
accent: #12343b
tagline: See the parcel. Read the notice. Slide back to the 1880s.
platforms: Browser, iPhone
status: Live browser map
---

NS Marks The Spot is a Nova Scotia map for property research and local history. Search a parcel by PID, civic address, or postal community, read dated municipal tax-sale notices against live parcel geometry, switch on provincial reference layers, and slide Hugh Fletcher's 1880s geological sheets over today's landscape.

<p class="app-actions"><a class="btn btn-gold btn-md" href="/apps/nsmarksthespot/map/">Open the map</a></p>

## Where it stands

The current product focus is the **browser map**, live at [/apps/nsmarksthespot/map/](/apps/nsmarksthespot/map/). It runs on any phone, tablet, or desktop with nothing to install. Optional live location draws the position this device reports in the browser and keeps that reading on-device. The native iPhone app is a separate offline and field companion in internal TestFlight builds; it is not on the App Store.

## What the map does

- **Parcel search:** Enter an eight-digit PID or a Nova Scotia civic address, or tap a visible parcel, and open its provincial boundary in context. Search also recognizes postal communities; a postal candidate becomes selectable only when it resolves to one live provincial civic point. When matched, the parcel inspector can show a separately labelled mailing address from Statistics Canada's free National Address Register (June 2026), distinct from the provincial civic address. Boundaries are approximate context, never a legal survey.
- **Tax-sale notices:** Municipal tax-sale listings are catalogued as dated snapshots, each pinned to its notice and source document, and mapped against live parcel geometry. No owner names are shown. The [Nova Scotia Tax Sale Hub](/taxsale/) keeps the posted dates in one place.
- **Reference layers:** Provincial aerial imagery, property boundaries, Crown land, flood-risk areas, water, roads, contours, geology and mineral records, well-water screening zones, and municipal zoning where a municipality publishes it — each with its own source, licence gate, and attribution.
- **Historical sheets:** Twenty-four Fletcher sheets, independently georeferenced from David Rumsey Map Collection scans, sit as an optional overlay with an opacity control. A sheet can sit a few hundred metres off modern ground, and the layer says so; it is context, not evidence.
- **Live location:** Optional live location places you on the same map — the reading stays in that browser.
- **Your maps:** Import a GeoPDF, GeoTIFF, shapefile, or GeoJSON and keep it on your device. Nothing is uploaded.
- **Exports:** Print a PDF map or export a source-linked evidence note for a parcel.

## Rhodena Wind

The proposed turbine map has a focused page at [/rhodena](/rhodena). It is the research map with a Rhodena focus, titled **Rhodena Wind — proposed turbine map**. The full map stays at [/apps/nsmarksthespot/map/](/apps/nsmarksthespot/map/).

- **Sight lines:** From a chosen viewpoint on the viewshed, an eye-level (~1.7 m) line runs to each assessed 200 m tip in the viewshed colours. It stays solid until bare earth first obstructs it, then a ridge mark and a dotted remainder. Those breaks use the same terrain samples, curvature, and refraction as the viewshed. Trees, buildings, and the final design are not in the model; the line is drawn to tip height, not the hub. Near-threshold results stay amber. Unassessed or out-of-range turbines get no line. The layout is the provisional proposed layout.
- **Map | Aerial:** A switch under the 3D control. Aerial imagery still opens the Province licence gate before it turns on.

## Fishing

The fishing map has a focused page at [/fishmap](/fishmap). It is the research map with a fishing focus, titled **Fishing spots — Cape Breton and the Strait of Canso**. It is separate from the static [Strait and Bras d'Or Fishing Map](/fishing/) at /fishing/, and its footer links there.

- **Spots:** Numbered pins and spot cards for 27 hand-picked shore, wharf and lake spots, each with its sources and directions in Google Maps or Apple Maps.
- **When and what:** Month and species filters and a species calendar. A dated summary of the rules to check hides each rule once its date has passed; the page never says a season is open now. Check the current Anglers' Handbook and DFO notices before you go.
- **Open-data layers:** Province stocked-waters records and DFO small craft harbours, alongside the curated spots. A harbour point is not permission to fish from the wharf.

## Every slider pull is a little time travel

Fade between the old survey and the current map to trace where a road bent, where a shoreline shifted, or where a name survived. The old sheets mark what today's maps forgot — gold mines, foundries, schools — sitting close to where they used to be under the modern roads and woods.

## Built in the open

The code is public on GitHub under the MIT licence, structured around a map-engine boundary so the interface can stay steady while the renderer evolves. Map imagery keeps its own licences and attribution, layer by layer.

---
[Open Online Map](/apps/nsmarksthespot/map/) | [Rhodena Wind](/rhodena) | [Fishing](/fishmap) | [Nova Scotia Tax Sale Hub](/taxsale/) | [Project Site](https://dfakkeldy.github.io/ns-marks-the-spot/) | [View Source Code on GitHub](https://github.com/dfakkeldy/ns-marks-the-spot) | [Get Help & Support](/nsmarksthespot-help)

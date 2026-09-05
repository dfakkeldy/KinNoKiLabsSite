---
title: NS Marks The Spot
description: A source-linked Nova Scotia parcel and tax-sale map, with Fletcher's 1880s sheets as an optional overlay.
image: /images/apps/nsmarksthespot.svg
accent: #12343b
tagline: See the parcel. Read the notice. Slide back to the 1880s.
platforms: Browser, iPhone
status: Live browser map
---

NS Marks The Spot is a Nova Scotia map for property research and local history. Search a parcel by PID or civic address, read dated municipal tax-sale notices against live parcel geometry, switch on provincial reference layers, and slide Hugh Fletcher's 1880s geological sheets over today's landscape.

## Where it stands

The current product focus is the **browser map**, live at [/apps/nsmarksthespot/map/](/apps/nsmarksthespot/map/). It runs on any phone, tablet, or desktop with nothing to install. Optional live location draws the position this device reports in the browser and keeps that reading on-device. The native iPhone app is a separate offline and field companion with internal TestFlight builds; it is not on the App Store.

## What the map does

- **Parcel search:** Enter an eight-digit PID or a Nova Scotia civic address, or tap a visible parcel, and open its provincial boundary in context. Boundaries are approximate context, never a legal survey.
- **Tax-sale notices:** Municipal tax-sale listings are catalogued as dated snapshots, each pinned to its notice and source document, and mapped against live parcel geometry. No owner names are shown. The [Nova Scotia Tax Sale Hub](/taxsale/) keeps the posted dates in one place.
- **Reference layers:** Provincial aerial imagery, property boundaries, Crown land, flood-risk areas, water, roads, contours, geology and mineral records, well-water screening zones, and municipal zoning where a municipality publishes it — each with its own source, licence gate, and attribution.
- **Historical sheets:** Twenty-four Fletcher sheets, independently georeferenced from David Rumsey Map Collection scans, sit as an optional overlay with an opacity control. A sheet can sit a few hundred metres off modern ground, and the layer says so; it is context, not evidence.
- **Live location:** Optional live location places you on the same map — the reading stays in that browser.
- **Your maps:** Import a GeoPDF, GeoTIFF, shapefile, or GeoJSON and keep it on your device. Nothing is uploaded.
- **Exports:** Print a PDF map or export a source-linked evidence note for a parcel.

## Every slider pull is a little time travel

Fade between the old survey and the current map to trace where a road bent, where a shoreline shifted, or where a name survived. The old sheets mark what today's maps forgot — gold mines, foundries, schools — sitting close to where they used to be under the modern roads and woods.

## Built in the open

The code is public on GitHub under the MIT licence, structured around a map-engine boundary so the interface can stay steady while the renderer evolves. Map imagery keeps its own licences and attribution, layer by layer.

---
[Open Online Map](/apps/nsmarksthespot/map/) | [Nova Scotia Tax Sale Hub](/taxsale/) | [Project Site](https://dfakkeldy.github.io/ns-marks-the-spot/) | [View Source Code on GitHub](https://github.com/dfakkeldy/ns-marks-the-spot) | [Get Help & Support](/nsmarksthespot-help)

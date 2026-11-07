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

<p class="app-actions"><a class="btn btn-gold" href="/apps/nsmarksthespot/map/">Open Online Map</a></p>

<figure class="app-shot"><img src="/images/gis/ns-marks-product-2026.webp" width="1440" height="900" decoding="async" alt="The NS Marks The Spot browser map over Cape Breton, with its PID and address search and map layers panel, and the licence footer showing OpenStreetMap and Nova Scotia open data credits." /><figcaption>The browser map over Cape Breton: PID and address search, the map layers panel, and source and licence credits.</figcaption></figure>

<nav class="app-toc" aria-label="On this page"><span class="app-toc-label">On this page</span><a class="chip" href="#time-travel">Time travel</a><a class="chip" href="#map-tools">Features</a><a class="chip" href="#focused-maps">Focused maps</a><a class="chip" href="#status">Where it stands</a></nav>

<div class="app-anchor" id="time-travel"></div>

## Every slider pull is a little time travel

<figure class="app-shot-phone"><img src="/images/apps/nsmarksthespot-layers.webp" width="592" height="900" loading="lazy" decoding="async" alt="The Map Layers panel in the NS Marks The Spot iPhone companion: base map styles, the Fletcher layer switched on with its opacity slider, and switches for NS Aerial, property boundaries, Crown lands and flood-risk areas." /><figcaption>The Fletcher layer and its opacity slider in the iPhone companion, an internal TestFlight build.</figcaption></figure>

Fade between the old survey and the current map to trace where a road bent, where a shoreline shifted, or where a name survived. The old sheets mark what today's maps forgot — gold mines, foundries, schools — close to where they stood, under today's roads and woods.

Twenty-four Fletcher sheets, independently georeferenced from David Rumsey Map Collection scans, sit as an optional overlay with an opacity control. A sheet can sit a few hundred metres off modern ground, and the layer says so: it is context, not evidence.

<div class="app-anchor" id="map-tools"></div>

## What the map does

- **Parcel search** Enter an eight-digit PID, a civic address or a postal community, or tap a visible parcel, to open its provincial boundary.
- **Mailing addresses** A matched parcel can also show its mailing address.
- **Tax-sale notices** Dated municipal tax-sale snapshots, each pinned to its notice and source, with no owner names. The [Nova Scotia Tax Sale Hub](/taxsale/) keeps the posted dates in one place.
- **Reference layers** Aerial imagery, property boundaries, Crown land, flood risk, water, roads, contours, geology, well-water screening and, where published, municipal zoning.
- **Live location** Optional live location shows the position this device reports.
- **Your maps** Import a GeoPDF, GeoTIFF, shapefile, or GeoJSON and keep it on your device.
- **Exports** Print a PDF map or export a source-linked evidence note for a parcel.

<p class="app-spec-note">Boundaries are approximate context, never a legal survey. Mailing addresses come from Statistics Canada's free National Address Register and are labelled as distinct from the provincial civic address. Every layer carries its own source and licence. The location reading stays in that browser, and imported maps are never uploaded.</p>

<div class="app-anchor" id="focused-maps"></div>

## Two focused maps

Two short addresses open the same research map with one job in front.

<div class="app-pair"><section class="app-pair-card" id="rhodena" aria-labelledby="rhodena-title"><h3 id="rhodena-title">Rhodena Wind</h3><p class="app-pair-job">See whether a proposed turbine tip is in sight from your viewpoint.</p><p class="app-pair-note">A line runs from the viewpoint to each assessed 200 m tip and breaks where bare earth first obstructs it. Trees, buildings, and the final design are not in the model; the layout is the provisional proposed layout.</p><a class="btn btn-outline" href="/rhodena">Open Rhodena Wind</a></section><section class="app-pair-card" id="fishing" aria-labelledby="fishing-title"><h3 id="fishing-title">Fishing</h3><p class="app-pair-job">Find a shore, wharf or lake spot around Cape Breton and the Strait of Canso, and the rules to check first.</p><p class="app-pair-note">27 hand-picked spots with month and species filters. The map never says a season is open now: check the current Anglers' Handbook and DFO notices before you go.</p><a class="btn btn-outline" href="/fishmap">Open the fishing map</a></section></div>

The fishing map is separate from the static [Strait and Bras d'Or Fishing Map](/fishing/), and a harbour point on it is not permission to fish from the wharf.

<div class="app-anchor" id="status"></div>

## Where it stands

The current product focus is the **browser map**. It runs on any phone, tablet, or desktop with nothing to install. The native iPhone app is a separate offline and field companion in internal TestFlight builds; it is not on the App Store.

The code is public on GitHub under the MIT licence, built around a map-engine boundary so the interface can stay steady while the renderer evolves. Map imagery keeps its own licences and attribution, layer by layer.

NS Marks The Spot continues a mapping practice that began with forestry field maps, aerial mosaics, and spatial screening work. [Read the GIS case study](/gis/).

<p class="app-actions app-actions-end"><a class="btn btn-gold" href="/apps/nsmarksthespot/map/">Open Online Map</a></p>

---

<p class="app-more"><span class="app-more-label">More</span><a href="https://dfakkeldy.github.io/ns-marks-the-spot/">Project site</a><a href="https://github.com/dfakkeldy/ns-marks-the-spot">Source on GitHub</a><a href="/nsmarksthespot-help">Get help</a></p>

# Noble Skywave station map

A public, searchable map and table of registered Noble Skywave 2026 stations, prepared by NZ1 for participating teams. Independent community project; not an official exercise service.

The site presents **NS26_Station_Grids.xlsx** as a map with a station sidebar and sortable full table. Both show the workbook's callsign, prefix, challenge group, coordinates, 4-/6-character grids and distance/bearing fields. AU16 is the default distance reference, matching the spreadsheet; choose any registered station or your saved position to recalculate the path.

## Features

- Search callsign, country, prefix, group, place or grid; filter country, prefix and challenge group.
- Select a station on the map, in the sidebar or in the table to view its details. Copy its direct link to share the same station.
- Compare great-circle distance and initial true bearing from the selected reference, short/long path overlays and day/night shading.
- Enter a registered callsign to fill country, coordinates and local display time zone. Saved corrections remain editable.
- Add/edit callsigns, names, countries, groups and locations. Enter decimal degrees, use a Maidenhead grid centre, or pick on the map.
- Save corrections locally or submit a shared GitHub update request for maintainer review.
- Import a station roster and export the filtered set as CSV, GeoJSON or static KML placemarks for TAK/GIS.

The interface is limited to station information. It has no channel book, contact log, radio-check coordination, antenna tools or weather dashboard, and does not poll weather services.

## Data and privacy

`data/stations.json` is a dated registration snapshot with reviewed operator corrections, not live availability or surveyed positions. Publication of the registered roster was authorised. Prefixes and groups came from the 430-row `NS26_Station_Grids.xlsx` supplied on 20 October 2026. On 22 October 2026 the roster was refreshed from the live registration map: US186 added, RU1 removed, NZ3/NZ4 latitudes corrected and nine challenge groups updated. Current positions and reviewed corrections are retained, including NZ1's corrected Trentham position. Unknown country mappings remain “Unspecified”.

Grids, distance and bearing use current coordinates and the selected reference, rather than fixed AU16 measurements. Home settings and local roster edits stay in the visitor's browser. Older private channel/contact fields remain in storage but are not displayed, used for markers, or included in station exports or proposals. OpenStreetMap receives tile requests. There are no analytics, radio controls or automatic messages.

## Shared station updates

Choose **Add station**, or select a station and choose **Edit this station**. **Save on this device** changes the local map and exports. **Submit shared update** requires public-release consent and opens a GitHub issue draft with only public station fields and the previous shared record. The visitor completes submission on GitHub.

A repository maintainer reviews the request and applies **publish-station** to approve publication. The workflow verifies write/maintain/admin permission, validates the bounded proposal, checks the previous record, rejects duplicates and invalid coordinates, commits the roster, tests and deploys. The issue closes only after successful deployment. Issue text is never evaluated as code or interpolated into shell commands. Actions are pinned.

Review one request at a time. Stale proposals and conflicting pushes fail without overwriting newer data. An ordinary **station-update** label does not publish. **Restore shared roster** removes local roster changes while preserving home settings.

## Import and export

Station CSV/JSON fields:

```csv
callsign,prefix,challenge_group,name,country,place,lat,lon,location_source
```

GeoJSON accepts Point features with `[longitude, latitude]` coordinates. Duplicate callsigns, missing/out-of-range coordinates and malformed CSV reject the entire import. CSV exports neutralise spreadsheet formulas. Exports include calculated grids and distance/bearing with the reference callsign. KML is a static overlay, not a live TAK feed or native SitaWare package.

## Development and deployment

No npm dependencies or build step are needed for local use:

```sh
python3 -m http.server 8790 --bind 127.0.0.1
npm test
npm run check
```

Open `http://127.0.0.1:8790`. Relative assets work under the GitHub Pages repository path. Internet is needed for tiles; roster calculations and map controls run locally while the page is open.

GitHub Pages uses **Publish Fieldbook** (`.github/workflows/pages.yml`) on `main`. `scripts/build-site.mjs` packages only `index.html`, `.nojekyll`, `assets/` and public station JSON into `_site/`. Publish this repository only, never the parent radio-console workspace or credentials. The public URL is unchanged.

The optional `scripts/publish.sh` creates a new repository using an authenticated GitHub CLI and refuses an existing repository/origin. Credentials belong outside this directory.

## Sources and licences

- [Noble Skywave registration map](https://nobleskywave.ca/map-info), snapshot 20 October 2026, supplied workbook and reviewed updates.
- [OpenStreetMap](https://www.openstreetmap.org/copyright) map tiles.
- Vendored [Leaflet](https://leafletjs.com/) 1.9.4, BSD licence in `assets/vendor/LICENSE`.
- Pinned offline [PhotoStructure tz-lookup](https://github.com/photostructure/tz-lookup), CC0-1.0 in `assets/vendor/tz-lookup.LICENSE`. Approximate zone boundaries; operators can correct suggestions. The browser applies daylight saving.

Application code: MIT (`LICENSE`). This does not assert ownership of registration data or external map tiles.

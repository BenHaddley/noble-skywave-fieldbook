# Skywave Fieldbook

A public, static Noble Skywave 2026 station map and HF planning fieldbook, prepared by NZ1 for participating teams. Independent community tool; not an official exercise service.

## Included

- Search 430 registered stations by callsign, country and imported name. Filter unworked stations; sort by distance or longest path.
- Set your own station, signed decimal coordinates and Australian/NZ/UTC display time zone.
- Great-circle distance, initial true bearings, short and long path overlays, daylight/greyline preview, UTC solar and civil-twilight events.
- Local channel book: import your **issued Australian authority list**, explicit dial frequencies, mode, phase, power limits and authority reference. Unknown, wrong-country, wrong-station and expired approvals remain unapproved.
- Copy a useful Slack coordination message with explicit radio dial, mode, UTC date/time and receive-only status. Nothing is posted automatically.
- Local contact history with antenna, power, readability, strength, waveform, notes and actual outcomes. Receive-only checks never count as confirmed two-way contacts.
- Timestamped NOAA Kp, solar flux and R/S/G observations. Stale observations are labelled; they are not presented as circuit predictions.
- Manual links to VOACAP, Bureau GRAFEX and public SDR directories; circuit-coordinate copy tool.
- Half-wave inverted-V dimensions in feet or metres, scaled schematic, included angle and insulated-end assumption.
- Filtered station export to CSV, GeoJSON and static KML placemarks for TAK/GIS. No claim of a native SitaWare package or live TAK feed.
- Local backup/restore and contact/channel CSV exports.

## Data and privacy

`data/stations.json` is a **dated registration snapshot**, not live availability or surveyed positions. The user explicitly approved public release of the registered callsigns and positions. Only callsign, country inferred from callsign prefix, coordinates and position provenance are included. No Slack content, personal names, cookies, recordings, access keys, private radio addresses or station credentials are included. Unknown callsign-country mappings remain “Unspecified”.

Imported channel plans, home settings, notes and contact records stay in `localStorage` on the visitor's browser. Back them up before clearing browser data or switching devices. Downloads and backups are user-triggered; this site has no upload endpoint. OpenStreetMap receives tile requests and NOAA receives weather requests. No analytics are installed.

Only publish an updated shared roster when its release is authorised. Registration positions can be inaccurate; verify with the team. The public site intentionally ships **no Australian frequency approvals**: the restricted Australian spreadsheet was not supplied. The Canadian channel list does not establish Australian authority. CSV import is not CPA/RPA binary conversion.

## Run and check

No build step or npm dependencies are required. Leaflet 1.9.4 is vendored with its BSD licence.

```sh
python3 -m http.server 8790 --bind 127.0.0.1
node tests/core.test.mjs
node --check assets/app.js
```

Open `http://127.0.0.1:8790`. This also works under a GitHub Pages repository subpath; all local assets use relative URLs. Internet is needed for map tiles and fresh weather. Core calculations, search, logging, import/export and vendored map controls remain local while the page is open.

## GitHub Pages deployment

Publish **this directory only** in its own public repository. Do not push the parent radio-console workspace. Keep `.nojekyll` and serve the root of branch `main` from Settings → Pages → Deploy from a branch.

The optional `scripts/publish.sh` performs a new-repository deployment using an already authenticated GitHub CLI. It creates a public repository named `noble-skywave-fieldbook` in the signed-in account, pushes only this directory and enables Pages. It refuses an existing Git origin or existing repository name rather than replacing an unrelated site. Credentials belong in the CLI's external configuration, never in this directory.

## Import formats

Station CSV/JSON fields:

```csv
callsign,name,country,lat,lon,location_source
```

GeoJSON imports accept Point features with callsign/name/country properties. Coordinates use `[longitude, latitude]`. Duplicate callsigns, malformed CSV, missing coordinates and out-of-range positions reject the whole import.

Channel CSV/JSON fields (download an empty template from Channel book):

```csv
channel_id,dial_mhz,centre_mhz,mode,max_power_w,country,authorised,authority,local_callsign,phase,valid_from,valid_to
```

`dial_mhz` and `mode` are required. Do not derive the dial using a universal offset. Mark `authorised=yes` only for the issued authority covering that station/country, with its reference and applicable validity dates. Imported approvals are operator-supplied, not independently verified by this site. Phases are labels from your file; no phase schedule is invented. Exported CSV neutralises spreadsheet formula prefixes.

## Sources

- Roster: [Noble Skywave registration map](https://nobleskywave.ca/map-info), snapshot 20 October 2026.
- Feature brief: Australian “261011 Noble Skywave 2026 Tips and Tricks”, supplied locally. The presentation itself is not republished.
- [NOAA SWPC K-index](https://www.swpc.noaa.gov/products/planetary-k-index), [public JSON feeds](https://services.swpc.noaa.gov/).
- [VOACAP](https://www.voacap.com/) and [Bureau GRAFEX](https://www.sws.bom.gov.au/HF_Systems/7/1). Manual links only; no hosted-service scraping.
- [Leaflet](https://leafletjs.com/), [OpenStreetMap](https://www.openstreetmap.org/copyright).

## Licence

Application code: MIT; see `LICENSE`. Leaflet: see `assets/vendor/LICENSE`. Roster factual data is supplied separately; the MIT code licence does not assert ownership of registration data or Defence documents. Map tiles and external data retain their respective providers' terms.

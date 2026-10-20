# Skywave Fieldbook

A public, static Noble Skywave 2026 station map and HF planning fieldbook, prepared by NZ1 for participating teams. Independent community tool; not an official exercise service.

The main view presents **NS26_Station_Grids.xlsx** as a map with a station sidebar and a sortable full table. It carries the workbook's callsign, prefix, challenge group, coordinates, 4-/6-character grids and distance/bearing columns. AU16 is the default distance reference, matching the spreadsheet; choose another registered callsign or your saved station to recalculate the path. This reference does not change your on-air identity or radio settings.

## Included

- Search stations by callsign, prefix, challenge group, town or grid. Filter prefixes/groups/unworked stations; sort by distance or longest path. Marker colour identifies SSB, 2G or 3G challenge families.
- Add and edit callsigns, team names, countries and positions. Station rows show signed coordinates and Maidenhead locators; search also matches town/location names and grids. Enter decimal degrees, use a grid-square centre, or pick a point on the map.
- Save edits locally or open a shared update request on GitHub. A maintainer approves shared changes; the site republishes the reviewed roster automatically.
- Set your own station, signed decimal coordinates and Australian/NZ/UTC display time zone.
- Great-circle distance, initial true bearings, short and long path overlays, daylight/greyline preview, UTC solar and civil-twilight events.
- Local channel book: import your **issued Australian authority list**, explicit dial frequencies, mode, phase, power limits and authority reference. Unknown, wrong-country, wrong-station and expired approvals remain unapproved.
- Copy a useful Slack coordination message with explicit radio dial, mode, UTC date/time and receive-only status. Nothing is posted automatically.
- Local contact history with antenna, power, readability, strength, waveform, notes and actual outcomes. Receive-only checks never count as confirmed two-way contacts.
- Timestamped NOAA Kp, solar flux and R/S/G observations. Stale observations are labelled; they are not presented as circuit predictions.
- Manual links to VOACAP, Bureau GRAFEX and public SDR directories; circuit-coordinate copy tool.
- Half-wave inverted-V dimensions in feet or metres, scaled schematic, included angle and insulated-end assumption.
- Filtered station export to CSV, GeoJSON and static KML placemarks for TAK/GIS. No claim of a native SitaWare package or live TAK feed.
- Exports include the worksheet fields and selected distance reference; grids and path values are computed from current coordinates rather than stored as stale AU16 measurements.
- Local backup/restore and contact/channel CSV exports.

## Data and privacy

`data/stations.json` starts from a **dated registration snapshot**, not live availability or surveyed positions, and includes reviewed operator updates. The user explicitly approved public release of the roster. Prefixes and challenge groups came from the 430-row `NS26_Station_Grids.xlsx` workbook supplied on 20 October 2026. Current positions and reviewed corrections are retained, including NZ1's corrected Trentham position. The initial roster excludes Slack content, personal names, cookies, recordings, access keys, private radio addresses and station credentials. Unknown callsign-country mappings remain “Unspecified”.

Imported channel plans, home settings, notes, local station edits and contact records stay in `localStorage` on the visitor's browser. Back them up before clearing browser data or switching devices. Downloads and backups are user-triggered. Shared updates open a GitHub issue draft containing only the station's public map fields and previous map record; the visitor must finish submitting it on GitHub. Contact logs and frequency permissions are excluded. OpenStreetMap receives tile requests and NOAA receives weather requests. No analytics are installed.

Only publish an updated shared roster when its release is authorised. Registration positions can be inaccurate; verify with the team. The public site intentionally ships **no Australian frequency approvals**: the restricted Australian spreadsheet was not supplied. The Canadian channel list does not establish Australian authority. CSV import is not CPA/RPA binary conversion.

## Run and check

No build step or npm dependencies are required. Leaflet 1.9.4 is vendored with its BSD licence.

```sh
python3 -m http.server 8790 --bind 127.0.0.1
npm test
node --check assets/app.js
```

Open `http://127.0.0.1:8790`. This also works under a GitHub Pages repository subpath; all local assets use relative URLs. Internet is needed for map tiles and fresh weather. Core calculations, search, logging, import/export and vendored map controls remain local while the page is open.

## GitHub Pages deployment

Publish **this directory only** in its own public repository. Do not push the parent radio-console workspace. GitHub Pages uses the `Publish Fieldbook` workflow (`.github/workflows/pages.yml`) with source branch `main`. The workflow tests the project, packages only static assets and the public roster, then deploys to the same Pages URL.

The optional `scripts/publish.sh` performs a new-repository deployment using an already authenticated GitHub CLI. It creates a public repository named `noble-skywave-fieldbook` in the signed-in account, pushes only this directory and enables Pages. It refuses an existing Git origin or existing repository name rather than replacing an unrelated site. Credentials belong in the CLI's external configuration, never in this directory.

## Shared station updates

Visitors choose **Add station**, or select a station and choose **Edit station**. **Save on this device** changes their local roster and exports. **Submit shared update** requires explicit public-release consent and opens a GitHub request; visitors submit that request using their GitHub account.

The repository maintainer reviews the proposed callsign and location, then applies the **`publish-station`** label to approve. The workflow independently verifies that the labeller has write/maintain/admin permission, validates the bounded JSON proposal, checks that the original shared entry has not changed, and rejects duplicate callsigns or invalid coordinates. It commits the reviewed roster, runs tests, deploys, then closes the request only after success. Issue text is never evaluated as code or interpolated into shell commands. Action revisions are pinned.

Review one request at a time; GitHub serializes Pages deployments. A changed/stale request or conflicting push fails without overwriting newer data. Refresh and resubmit the request, or remove/reapply the approval label after reviewing it again. Ordinary `station-update` labels do not publish anything. Local edits remain a device roster until the visitor chooses **Restore shared roster**; this does not remove their contact log.

## Import formats

Station CSV/JSON fields:

```csv
callsign,prefix,challenge_group,name,country,place,lat,lon,location_source
```

GeoJSON imports accept Point features with callsign/name/country properties. Coordinates use `[longitude, latitude]`. Duplicate callsigns, malformed CSV, missing coordinates and out-of-range positions reject the whole import.

Challenge group is an editable registration field, not a claim about a live radio connection. The full table and map share the same filters; selecting a table callsign locates it on the map. Radio-check planning and weather remain available in the expandable section below the directory.

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

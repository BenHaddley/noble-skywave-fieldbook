# Release checks — 20 October 2026

15 calculation/import/export/permission tests pass (`npm test`). They cover signed NZ coordinates, great-circle and long paths, solar positions, equinox/polar greyline contours, UTC solar events, quoted CSV, invalid imports, longitude-first GeoJSON/KML, spreadsheet formula escaping, exact dial values, country/station/date authority filtering, RX vs two-way results, inverted-V geometry and the public roster field allowlist.

Chromium checks passed with no JavaScript page errors:

- Loaded all 430 stations from the public snapshot and selected NZ1 by search.
- Saved an Australian home station; displayed true bearing, path length and both endpoints' solar times.
- Prepared an explicit 13.953 MHz USB receive-only coordination message without posting it.
- Saved an RX-only check, confirmed it did not count as a two-way contact, then saved a two-way data result.
- Confirmed HTML-like notes render as text, not executable markup.
- Refreshed the page and recovered the saved log from browser storage.
- Imported a channel book; kept a Canadian-only approval out of the Australian approved filter, preserving explicit dial values.
- Exported the 20 AU-prefix stations as KML and parsed all 20 placemarks as valid XML.
- Previewed the greyline 12 hours ahead.
- Checked inverted-V leg dimensions in feet.
- Checked desktop and 390 px mobile map/tool layouts for page overflow.
- Verified observed application requests were GETs; no uploads, Slack writes or radio-control calls.

Real NOAA feeds returned current Kp, solar flux and R/S/G observations during the local preview. External links are manual handoffs; no claim is made that VOACAP, a remote SDR or a physical radio has been tested by this site.

GitHub Pages publication is verified separately by the returned Pages build state and an unauthenticated HTTP fetch after publishing.

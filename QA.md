# Release checks — 20 October 2026

28 calculation/import/export/permission/setup tests pass (`npm test`). They cover signed NZ coordinates, great-circle and long paths, solar positions, equinox/polar greyline contours, UTC solar events, quoted CSV, invalid imports, longitude-first GeoJSON/KML, spreadsheet formula escaping, exact dial values, country/station/date authority filtering, RX vs two-way results, inverted-V geometry and the public roster field allowlist. Station tests cover adds, edits, renames, collisions, locators, public proposal schema, stale-update rejection and maintainer permission checks. Setup tests cover exact callsign lookup, changed coordinates, NZ/Australian/Canadian/US/Chatham zone examples and supported zone suggestions for every roster entry.

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

Station-editor browser checks also passed: callsigns and coordinates visible in the list, added station recovered after refresh, duplicate rename blocked, Maidenhead centre and map-point selection, consent required for a public request, shared draft contains map fields only, a locally renamed station retains its original shared identity, mobile editor fits, and restoring the shared roster removes local edits. GitHub draft destinations were intercepted during these UI checks; no test proposals were submitted by the browser.

Workbook presentation checks: all 430 source spreadsheet rows reproduced exact grid locators and distance/bearing within rounding (1 km / 1 degree). Source-sample regression tests cover AU16 as reference and changed references, retained challenge groups, shared publication and CSV/GeoJSON/KML worksheet columns. Current NZ1 operator coordinates are retained rather than overwritten by the older spreadsheet position.

Workbook browser checks passed: 430 visible stations, AU16 default, group totals, combined prefix/group filters, shared map/table filtering, ascending and descending numeric sorting, CSV worksheet fields/reference, changing reference to NZ1, table selection on the map, grid search, editable/persistent challenge group, shared-roster restore, preserved contact tools and 320/390/768-pixel layouts. No JavaScript page errors occurred.

Station-setup browser checks passed: typing NZ1 fills New Zealand, the corrected Trentham coordinates and Pacific/Auckland without manual country entry; all 430 callsigns are suggested. Saved coordinate/time-zone corrections survive reopening and reload. Changing to an unknown callsign clears the previous auto-filled position. The sidebar shortcut uses the selected station's zone, local roster edits feed setup, and both clocks update immediately after saving. The distance reference stays independent. Checked 320/390 px dialogs and delayed roster loading, including preservation of fields typed while the roster loads. No JavaScript page errors occurred.

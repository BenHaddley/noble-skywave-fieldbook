# Station map checks — 20 October 2026

The public interface contains only station map/sidebar, table, reference controls, station setup/editor, import and exports. Extra navigation/pages/dialogs, planning/weather panels and their handlers and polling are removed. Existing saved home and roster settings remain compatible. Older private channel/contact fields are retained in browser storage and excluded from maps, exports and proposals.

`npm test` passes 28 utility/regression cases. Map coverage includes signed NZ coordinates, great-circle paths, greyline geometry, Maidenhead conversion, CSV validation, GeoJSON/KML coordinate order, worksheet exports, callsign lookup, zone suggestions and reviewed shared updates. Older pure helper compatibility tests remain; removed tools have no public interface.

The 430 source workbook rows were previously checked for exact grids and distance/bearing agreement within rounding (1 km / 1 degree). Current NZ1 coordinates are retained rather than replaced by the older workbook position.

Browser checks for this release:

- 430 stations load; removed tabs/pages/dialogs and panels are absent.
- Search and combined prefix/group filters work in map and table; numeric sorting works.
- Sidebar shows worksheet fields; table selection locates the map point.
- Distance reference changes independently of saved station identity.
- NZ1 setup fills New Zealand, corrected Trentham coordinates and Pacific/Auckland; settings survive reload.
- Local station adding/editing, grid lookup, map-point selection and shared-request consent work.
- CSV/GeoJSON/KML exports preserve map fields and reference, excluding old private data.
- Import and shared-roster restore work; old browser home/roster settings survive the upgrade.
- Desktop and 320/390/768 px layouts fit without page overflow.
- No JavaScript errors, weather requests, automatic messages or radio controls.

GitHub drafts are intercepted in browser checks; no test requests are submitted. Publication is verified separately by successful GitHub Actions deployment and live-site checks.

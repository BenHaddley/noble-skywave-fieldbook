# Coordinate time-zone lookup

Vendored `@photostructure/tz-lookup` 11.7.0 from [PhotoStructure](https://github.com/photostructure/tz-lookup/tree/6051e7e2fe8b754e23d40aff0120cf9b38bde608). Licensed CC0-1.0; see `tz-lookup.LICENSE`.

Original `tz.js` SHA-256: `548133c31996a29b35120248e3ac92e4b7f50db5193a1c4a4da227e786b55c3a`. The vendored file adds source comments and an ES module export.

This small offline lookup suggests an IANA zone from coordinates. Borders are approximate; the operator can correct the display zone before saving. Boundary data originates from [timezone-boundary-builder](https://github.com/evansiroky/timezone-boundary-builder). Daylight-saving offsets are applied by the browser's `Intl.DateTimeFormat`.

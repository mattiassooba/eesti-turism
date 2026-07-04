# maakond-topo.json

Estonian county (maakond) boundary geometry, used for the choropleth map
on the "Kaart" dashboard page. Statistikaamet's API provides statistics
only, not geographic boundaries, so this comes from a separate source.

**Source:** Estonian Land Board (Maa-amet), via the community-maintained
[buildig/EHAK](https://github.com/buildig/EHAK) repository, which derives
its files from Maa-amet's Administrative and Settlement Classification
(EHAK) data.

**Boundary validity date:** 01.09.2018 (per the repository's "Version
20180901" release). Estonia's 15 maakonds have not changed since, so
this remains current for county-level boundaries.

**Required attribution** (per the source's own license terms): "The use
of administrative and settlement units data is not restricted but the
reference to the data source (i.e. Estonian Land Board) and validity
date must be made."

**Format:** TopoJSON (483 KB) rather than the source's GeoJSON (2.28 MB)
— same data, ~4.6x smaller, decoded client-side with `topojson-client`.

**County code mapping:** each feature's `MKOOD` property (e.g. `"0037"`
for Harju) maps to Statistikaamet's Maakond dimension code by:
`"EE" + MKOOD + "0000000000"` (e.g. `"EE00370000000000"`).

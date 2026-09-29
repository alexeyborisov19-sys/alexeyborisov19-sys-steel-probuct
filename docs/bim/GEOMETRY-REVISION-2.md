# BIM geometry revision2 — 29 September2026

Owner reports overlaps in the website diagram, not in an IFC viewer. Reproduced in Chrome390px with10columns: CSS tracks64px, buttons129px due to min-height60px + aspect-ratio1170/545. Buttons overflow each other. Fix: definite grid aspect from dimensions; proportional row/column gap; explicit panel width/height100%, min-size0, clipped label. Scroll instead of squeezing large arrays. Face dimensions are not overall mounting-flange dimensions.

## Source geometry

Four STEP files supplied directly by owner in this conversation; only tessellated geometry is published, no original customer metadata. OCCT5.0.0 import, linearDeflection0.1mm, angularDeflection0.2rad; welded vertices rounded0.0001mm. These are tessellated coordination models, not native editable Revit families.

|Source|Face envelope W×H mm|Full depth mm|Local orientation|
|---|---|---|---|
|Кассета0.7мм ОТ|545×545|20|X, Z, −Y|
|Кассета1мм ОТ|1170×545|20|X, Z, −Y|
|Кассета0.7мм ЗТ|565×530|19.7|X, −Z, Y+0.7|
|Кассета1мм ЗТ|1190×530|20|X, −Z, Y+1|

W/H envelopes include rounded face edges; the central planar face is smaller. Native dimensions preserve the tessellated source. Parametric adaptations translate the first/last50mm edge zones and stretch only the central region independently in W/H. No scaling in depth, thickness or bends. Adapted geometry requires engineering approval and is not a production unfolding.

Minimum gap is conservative: complete geometry must fit without bounding-box overlap; no unverified lapped joint is invented. Source files do not define a facade mounting assembly. Open profiles:38/38.6mm minimum; closed profiles: measured top extension rounded upward. Smaller actual facade joints require a verified mounting detail, not blanket scaling of lips.

Corner90° uses inspected local drawing with wings290/330mm, height380mm, depth20mm and thickness1mm. It remains explicitly simplified: sharp bends, no holes/radii. One vertical column prevents treating several corners as a flat facade. It is not claimed to match the four supplied straight STEP models.

IFC4 uses IfcTriangulatedFaceSet with closed meshes, per-element placements, RAL and quantities. CSV includes profile and second wing. Front face area is a nominal envelope measure excluding joints, not an exact exposed-planar area or sheet usage.

Independent IfcOpenShell verification covers all four STEP variants plus corner, native/adapted sizes: EXPRESS rules, geometry construction, positive volume and nonintersecting world-coordinate element bounds. UI and IFC use the same geometry function. Browser regression must check dense arrays at390/1440, long/narrow panels, colour selection, export, invalid gap and profile reset.

## Recovered calculator comparison

The supplied latest HTML is identical to the preceding upload. Recovered baseline-v6.html from the production-calculator chat uses verified OT allowance 77.7681409 − 5.73805329 × thickness; uploaded HTML uses 68.0128 + 5.7388 × thickness. The earlier audit covers 48 reference DXFs and identifies unresolved closed/corner deviations. Neither source is treated as an approved folded assembly. Use STEP for straight folded profiles, reviewed drawing for explicitly simplified corner, and keep production unfolding separate.

# Fixed basket drawing inspection

This optional viewer is separate from the arbitrary-size basket configuration and commercial estimate. Opening, switching or closing it cannot change customer inputs, saved positions, prices or dimension/clearance status. Four named neutral identities are supported; arbitrary dimensions are never matched or interpolated into this family.

## Source scope

Owner-supplied dimensioned assembly and part drawings were inspected privately. Public data contains only neutral numerical geometry; source pages, title blocks, names, project identifiers and client quantities are not published. This is a preliminary visual reference, not installation or manufacturing documentation.

Nominal shrouds (width × height × depth):1430×880×500,1430×1280×500,2030×880×500,2030×1280×500 mm. Low variants have one full-width front sheet; tall variants have two715 or1015 mm front sheets, with the assembled decorative orientation reflected on the second sheet. Two side sheets and one bottom are shown; top and rear remain open.

The side detail's principal face is495 mm, while the model designation says500 mm. The extracted face is not stretched. The nominal envelope and simplified principal-sheet geometry remain distinct; small returns, radii and connection offsets are not manufacturing-accurate in this viewer. Surfaces have no invented thickness.

An optional off-by-default layer shows simplified source-based arms: three or four lower U-shaped arms and two upper L-shaped wind arms. Drawing-derived lower positions are137.5/715/1292.5 and137.5/762.5/1267.5/1892.5 mm; upper positions125 andW−125 are separate. Positions and vertical placement are explicitly schematic, not bolt coordinates within adjustable slots. Heels, extensions, equipment rails, stiffeners, fasteners and anchors are omitted and named as omissions. No mounting capability or load is inferred.

The source's841 mm base-to-outer-front projection is not the500 mm nominal shroud depth. The former is deliberately not displayed as a customer wall offset. No invented103 mm rear gap is derived from the distinct face datums.

## Perforation

Eight principal-face contour datasets were extracted from source vector lines, excluding dimensions, text, centre marks and fastener-bearing solid bands.477 closed decorative loops are retained. Principal scales, bounds, signed areas, self intersections and pairwise overlap were independently checked.

Four open contours on the715×1280 front and two on the2030×500 bottom remain omitted; no guessed closing segment is added. The public data marks these entries partial and prohibits manufacturing export. Expanded accuracy details state that perforation is partial and not for production. Tiny fastening holes and radii are not part of this slice.

A scanline trapezoid triangulation fills only metal between closed holes, with area-conservation regressions. These are actual empty regions in the depth-buffered surface, not painted stripes on an opaque rectangle. Per-assembly output remains below30,000 polygons (observed maximum16,200) and300,000 projected points. Lazy loading and static rendering keep this optional geometry off the first-screen path. Native WebGL uses the existing depth renderer; the labelled wireframe fallback includes support edges and holes.

## Verification contract

Tests cover exact fixed IDs/envelopes/panel splits, distinct upper/lower counts and positions, invalid IDs, hole area conservation, polygon bounds/budgets, correct top-camera depth and support-visible fallback. Browser CI covers four variants, all four views, mobile and desktop, context loss, accessibility/overflow, and byte-equivalent customer project JSON before/after inspection. No new download, API request, price rule, dependency or production publication is introduced.

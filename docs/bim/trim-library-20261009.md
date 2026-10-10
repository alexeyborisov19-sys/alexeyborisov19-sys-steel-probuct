# Local trim BIM slice, 9 October 2026

## Frozen scope

Local branch `feat/trim-bim-local-20261009`, based on `6acd8cd`. No push, merge, deployment, live submission or manufacturing approval. Existing cassette modules and commercial calculations are unchanged; the trim UI reuses only the generic native depth renderer and shared IFC string/identity primitives.

The usable slice is **one 90° L-profile**, corresponding to the fire-stop section on public catalogue sheet 09. It is a preliminary shape, not a validated fire-stop assembly or a fire-performance statement. Other catalogue entries remain visible as pending and are blocked in UI, model validation, JSON import and every export.

## Source and exact parameter convention

Public source: `https://www.steelprodukt.ru/images/products/catalog-sheets/page-09.png`, section “Пожарная отсечка”. The UI frames two parts of that unchanged public raster to show A/B/T/C and longitudinal H; the full-sheet link remains available. No private customer file or identifier is included.

Inputs are the source letters **A, B, H, T**, all explicitly entered in millimetres. There are no factory dimension defaults. C is the source's 90° angle; this slice does not expose a variable angle.

For this preliminary sharp-corner model, A/B are external leg lengths from the theoretical outer corner to the ends, H is extrusion length, and T is inset thickness. The section is `(0,0), (B,0), (B,T), (T,T), (T,A), (0,A)`. Thus bounds are exactly `[0,B] × [0,A] × [0,H]`; increasing thickness does not change A/B/H. Expected volume is `(A+B-T) × T × H`. `T < A` and `T < B` are necessary geometric constraints, not asserted factory limits. Radii, manufacturing unfolding, bend allowance and K-factors are not computed. The sheet's radius annotation is not silently reproduced by a sharp mesh.

All output formats carry this convention and exactly:

> Предварительный ориентировочный расчёт. Для уточнения спецификации и стоимости передайте проект специалисту

## Working workflow

- Explicit A/B/H/T alone → validation → filled section and depth-buffered native 3D view. Title/material/finish are optional under “Уточнить описание”; the generic editable title is “Элемент 1”.
- The preview and IFC use the same closed vertices/triangles. No painter sorting or separate display model.
- WebGL loss/unavailability has an explicitly labelled wireframe fallback.
- JSON save/restore preserves project ID, revision, element ID, source-letter dimensions and absolute public provenance URLs usable outside the website. Import has an exact property allowlist, finite positive numbers, 16 KiB UTF-8 budget and immutable source/scope checks. Pending templates cannot be enabled through JSON.
- CSV is an actual one-element specification with A/B/H/T/C and metadata; suspicious text prefixes are escaped against spreadsheet formulas.
- IFC4 uses an `IfcBuildingElementProxy`, millimetres, stable identifiers and source/scope/parameter properties. Full double precision avoids collapsed tiny extrusions from fixed-decimal rounding.
- “Передать специалисту” downloads an actual TXT brief and displays it for review. It does not send a live request. The contacts link retains existing attribution behavior.
- No prices, material defaults, fire ratings, load claims, fasteners, assemblies or implied compatibility.

## Pending catalogue models and precise gaps

- **Reveal, sheet 07:** the stepped A/B/C/D single-line section needs confirmed inside/outside dimension datums and thickness/bend placement. It must not silently grow entered dimensions by half a thickness.
- **Sill, sheet 09:** E/F/G are the section's interior wedges; the flat-pattern annotations 85/105/70 are different labels and must not be substituted blindly. A future reviewed model can derive signed turns as `+(180−E), −(180−F), +(180−G)`, but must first confirm reference faces, thickness side and the A/B/C/D datum convention. No sill model is enabled in this slice.
- **Open parapet, sheet 08:** B/B1/C/D/E relationships, F/G angle references and the dimensions of both sides require confirmation. Symmetry is not inferred from a sketch.
- Nested akvilon hems, hidden locks, support assemblies and fasteners remain outside scope.

## Verification

Fresh final local checks: `npm run typecheck`, `npm run lint`, all 1,670 tests (including 16 trim tests), and `npm run build` pass. These were run sequentially after a parallel build/typecheck attempt exposed a generated `.next/types` race; no source workaround was applied. The new route builds at 13.8 kB route code / 133 kB first-load JS with no added dependencies.

Focused tests cover exact outside dimensions, inset-thickness invariance, analytic volume, closed edge incidence, opposite winding, nonzero triangles, roundtrip/units, prohibited templates, missing values, finite-number boundaries, forged provenance, unknown keys, UTF-8 budgets, formula/STEP escaping and stable identities.

Fifteen synthetic IFC fixtures (including unnamed metadata, tiny accepted length, repeat exports and revisions) and an independent validator are provided:

```
node --import tsx scripts/generate-trim-ifc-fixtures.ts output/trim-ifc-validation
python scripts/validate-trim-ifc.py output/trim-ifc-validation
```

The validator requires the existing CI environment's pinned IfcOpenShell 0.8.5 and pytest 8.4.2. It checks IFC4 parser/EXPRESS rules, unit scale, source-letter metadata, outside bounds, closure/winding, positive analytic volume, CSV agreement and identity across repeat/revision exports. No local IfcOpenShell is installed: generating fixtures is not a parser/EXPRESS pass.

True browser/mobile keyboard, download, import-race and GPU/context-loss execution remain required before visual/production sign-off. Local denied Chromium/socket routes are not retried. Static source crops were inspected at mobile width; they are not browser screenshots. Revit and other consumer-application behavior is unverified.

The input-coordinate step is0.01 mm for this preliminary model. Finer values are rejected without silent rounding; this is a computational resolution, not a manufacturing tolerance. IFC contextprecision remains0.00001 mm, below the smallest supported distinct feature. No microscopic-feature or BIM-consumer interoperability claim is made.

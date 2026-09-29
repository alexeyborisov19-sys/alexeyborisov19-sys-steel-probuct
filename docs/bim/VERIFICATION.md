# Revision 2 verification — 29 September 2026

See GEOMETRY-REVISION-2.md for the four source STEP profiles, adaptation rules and explicitly simplified corner. Build/lint and 1461 tests pass. Chrome at 390/1440 verifies dense 20×20 arrays, extreme aspect ratios, all four profile downloads, painting and invalid input. Native/adapted IFCs are independently checked with IfcOpenShell. The old five-prism volume test below describes revision 1 only. Native RFA remains unavailable.

## Historical revision 1

# Verification — IFC coordination generator, 28 September 2026

- IFC4 parsed and EXPRESS rules checked with IfcOpenShell 0.8.4.post1: no errors in three cases (1, 6 and 400 panels).
- Independent OCCT geometry generated for every panel. Triangle volumes matched the analytical non-overlapping five-prism volume; overall world-coordinate bounds matched row/column pitch including joints. Property mark round-tripped, including Cyrillic/apostrophes; face quantities matched m².
- Node regression tests cover count/type/GUID uniqueness, face area versus facade bounds, invalid numbers/limits and STEP/CSV injection escaping.
- Local Chrome at 1440 and 390 px: changed dimensions, downloaded IFC/CSV, checked 12 IFC elements, disabled export with invalid input, no horizontal overflow or page errors.
- Full suite: 1448 passed. Initial local run used the macOS /var temporary-directory symlink and overlapped a Next build (which replaces the STEP worker); repeat after build with canonical TMPDIR=/private/tmp passed. No production calculation code changed.
- Final build (including type/lint gate), browser checks and SEO audit of 93 URLs passed with zero errors/warnings; exact-head CI and deployment are required before claiming publication.
- SEO scanner initially treated every /products/* URL as a physical Product. The BIM tool now explicitly requires WebApplication + FAQPage; physical product checks remain unchanged. FAQ text is visible and schema generated from the same data.
- No new runtime package. IFC/CSV generated locally in browser; no client-entered model data is submitted by this tool. Geometry allocation capped at 400 elements; object URLs revoked after download.
- Native RFA not created or verified. Target Revit 2022 requires an available licensed Windows/Revit environment and approved product geometry. IFC is explicitly not a replacement.

Evidence outside public repository: /Users/alex/.codex/reports/bim-20260928/ (screenshots, browser exports, independent validation).

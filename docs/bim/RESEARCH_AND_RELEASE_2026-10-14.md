# BIM library release checkpoint — 14 October 2026

Owner explicitly requested completion, rechecking, correction and publication of the free BIM library in PR278. This candidate is based on feature head `05ffaf760e1bd933d90501e1b6a7f7a8934782f3`; main was `d4b7e17b43825f23ae855e61b5021ba7070bec70` at the last read. Neither a successful source transfer nor a green historical SHA proves this candidate is published.

## Implemented candidate

- Catalog-first interface: 15 source-derived model thumbnails, search, cassette/trim filters and independent source downloads. The existing facade generator, RAL and CSV workflow are retained.
- Joint guide: 14 situations, each with separate open/closed-type considerations. These are 28 project-review scenarios, not 28 approved assemblies. Face joint, installation module and internal connection clearance are independent quantities.
- The source catalog and competitor references are recorded in `data/bim/cassette-joints.json`, including dates and access limitations. Manufacturer dimensions and third-party geometry are not adopted as Steel Produkt manufacturing data.
- Numerical mesh correction after size changes resolves tiny cut-plane edges on a 0.001 mm coordination grid, with closure, orientation, duplicate-face, Euler characteristic, dimensions and volume-drift checks. Original source assets are not modified.
- New source-grid version is `sp-cassette-sizing-2`. The viewer and exported IFC use the same normalized mesh. The numerical grid is not a manufacturing tolerance.

## Evidence and pending checks

The accompanying local candidate recorded 414 geometry/IFC/JSON scenarios, 77 schema and EXPRESS checks (32 source IFCs plus 45 generated exports), independent geometry reads of the generated exports, and unchanged hashes for all 55 source assets. Those finite fixtures do not prove all continuous input combinations, approved joints, authoring-application interoperability or production readiness.

The full exact-head lint/type/tests/build/SEO suite, new rendered page audit, existing configurator audits and IfcMCP gate must pass before merging. Browser evidence must be inspected at desktop and mobile sizes. The new page audit permits GET/HEAD only and does not submit enquiries or consent updates.

## Scope boundaries

No unrelated calculator, pricing, legal, retention, analytics, search-console, advertising, sitemap or employee-service changes. No on-site installation service is implied. The substructure is project-selected, not automatically included in the manufacturer's bill of materials. Competitor drawings, certified values and connection dimensions are not copied.

Source samples establish their own geometry only. Materials, face-dimension mappings, approved connection poses, fastening selections, movement allowances, assembly trajectories and structural/fire suitability remain project-specific. Native RFA/RVT/GSM files and direct Revit/Archicad import tests are not supplied by this release. No missing capability is labeled PASS.

## Next release actions

1. Record the candidate commit and inspect every exact-head check; fix actual failures without weakening assertions.
2. Inspect fresh browser artifacts, downloads and geometry evidence.
3. Only after the gates pass, mark PR278 ready, merge normally and use the existing Beget publication workflow.
4. Verify live library/configurator/source links and downloadable IFCs; distinguish merge, successful deploy and independent production confirmation. Never republish an old commit as a substitute for this candidate.

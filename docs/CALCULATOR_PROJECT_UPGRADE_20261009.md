## Detailed inspection follow-up

The owner-source open/closed parts can be viewed alone, as two preliminary face-pitch neighbours, or separated as whole panels for inspection. Neither neighbouring mode asserts an approved engagement node; the missing joint sections remain required. The corner profile remains a single, explicitly simplified drawing-based part. Existing geometry and IFC exports are unchanged. Native WebGL depth testing resolves opaque surface occlusion; source fold/outline edges are rendered without tessellation diagonals. A labelled SVG fallback is available if the graphics context is unavailable. Browser evidence must establish real rendered pixels, not only numerical geometry tests.

# Current visual follow-up

The current draft adds minimal stepwise cassette/basket interfaces and geometry-derived perspective views, two basket entry paths, source-qualified optional AC dimensions, explicit unknown clearances, and facade descriptors that do not double-count insulation. All customer outputs carry the requested preliminary notice. A cassette budget now follows the actual panel-face schedule; it is not complete manufacturing cost, and unpriced nonstandard work remains explicit. Customer screens and briefs show final results and textual assumptions, without rate arithmetic.

Current local integrated suite:1646 passed; independent data/export review:131 passed. Lint/typecheck passed. The retried local production build passed after an environment transport interruption. Exact updated-head CI and screenshot review remain outstanding after the final inspection-view change. Earlier candidate notes below are historical. Independent IFC4 parser/EXPRESS validation passed17 synthetic fixtures on earlier heads, but Revit import and approved cassette joint engagement remain unverified. Production release is not authorized.

---

# Calculator project upgrade: local candidate

Base: `ba873d70be57ad62b4f5e85b39a9d10f7df56062`. Scope is requested product calculation/BIM improvement; production publication is not authorized. The owner has approved a separate branch and draft PR for exact-head CI and browser review.

## Implemented verticals

- **Metal cassettes:** rectangular elevations, explicit face dimensions and horizontal/vertical joints, positioned rectangular openings, actual rows/columns, marked complete/edge/affected/removed positions, selectable dimensioned SVG, paginated schedule, undo, multi-elevation project. JSON save/restore recalculates results from validated inputs; CSV retains all positions, IDs and review status; TXT prepares an engineer brief. No subsystem, fastener, trim or installation costs are added.
- **Layout IFC:** closed rectangular face envelopes share project/panel IDs with CSV. Nonrectangular remainders stay in the schedule and explicitly appear in the pre-download omission list; they are not replaced by imaginary bounding panels. Removed opening positions do not become geometry. Export counts and coverage are explicit. Multiple elevations are displayed side by side, not as surveyed building coordinates. This is a coordination export, not folded manufacturing geometry or installation design.
- **Detailed profile BIM:** existing STEP-derived open/closed and simplified corner geometry remains unchanged. JSON saves profile inputs and per-panel colours, import requires explicit replacement, and panel IFC IDs remain stable within the saved project when colours/array dimensions change. CSV adds the same stable panel reference. Layout IFC and detailed-profile IFC are clearly distinct tools.
- **Air-conditioner baskets:** live dimensional visualization is the default; added front/top equipment-clearance diagram, customer equipment/model/zone and instruction reference, service side/access request, required versus available service space, actionable review checklist, named multi-item cards, duplication and selected-position export. Version2 extends the existing project format; version1 remains readable. Customer notes remain in explicit local files and are not added to contact URLs. Existing price logic, supported patterns, mounting rules and100-position capacity remain intact.
- **CAD/manual:** explicit schema-versioned project download/import, project title/revision, exact manual parameters, material/quantity/operations and CAD attachment manifest. No source CAD bytes, geometry approval, costs or server calculation IDs are serialized. Manual source is regenerated and analyzed again. CAD reattachment requires exact byte-content SHA-256 matching plus a fresh server analysis; metadata is not trusted as geometry. Imports require explicit replacement and do not restore old estimates. Unknown/future/oversized/malformed files are rejected before live state replacement.

## Preserved boundaries

Approved current cassette rate values and the server floor are unchanged; the UI now uses the canonical public rate helper. No private rate configuration or production capability is invented. Existing quick budget mode is clearly separate from the geometric project and is not presented as a price for its schedule. Existing privacy/consent, legal pages, lead sending and analytics behavior are unchanged. No production submissions, uploads, publication, merge or deployment were performed.

## Verification contract

- Pure geometry: exact boundaries, joints, edge sizes, touching/overlapping/outside openings, disconnected/nonrectangular remainder, face areas and cell limits.
- Import/export: versioning, byte limits, malformed values, unknown properties, price/authority stripping, SHA-256 mismatch, missing-source behavior, old basket versions and100-item bounds.
- BIM: counts/units/references, stable IDs across save/restore, closed outward meshes, escaping/formula injection and explicit partial-export coverage.
- UI/SSR: real React components render usable accessible SVG titles, dimensional labels, safe customer text and named controls. This does not prove keyboard, responsive layout or browser interaction.
- Repo gates: lint, TypeScript, full unit suite, production build and local HTTP SEO/legacy-redirect audit.
- Prepared `scripts/audit-product-configurators.mjs` covers eight desktop/mobile journeys across all four tools. It refuses nonlocal targets, blocks cross-origin requests, intercepts all writes except local synthetic CAD analysis, and stores screenshots/axe/runtime results. The added PR workflow uses no secrets and never deploys. **The browser audit is not yet verified:** local Chromium fails its process-singleton Unix socket with `Operation not permitted`; that restriction was not bypassed.
- Independent review found empty SVG titles from React19 multiple children. All three new SVG title sites were changed to one string, with real-render regressions. No remaining material defect was reported in the reviewed project/geometry/security boundaries. Full browser interaction and external IFC application/schema validation remain outstanding.

## Release gate

Before calling the candidate ready for publication: obtain publication-stage approval, run exact-patch CI including the intercepted browser journeys, review desktop/mobile screenshots, and resolve all failures. Independent IFC application import/schema validation remains a distinct check before offering these outputs as tested third-party BIM interoperability. No native RFA, automatic manufacturing drawings, guaranteed pricing, load/fire/airflow certification, or universal unit compatibility is claimed.

## Fresh local results

- `npm run lint`: passed, zero warnings.
- `npm run typecheck`: passed.
- `npm test`:1613 passed, zero failed/skipped (post-restart integrated run).
- Independent focused review after SVG corrections:59 passed; no remaining material finding reported.
- `node --check scripts/audit-product-configurators.mjs`: passed; workflow YAML parsed in independent review. Browser execution is still not run.
- Final `npm run build`: passed. Fresh local HTTP `npm run seo:audit`:99 sitemap URLs,18 redirects and8 retired routes; zero errors and zero warnings.

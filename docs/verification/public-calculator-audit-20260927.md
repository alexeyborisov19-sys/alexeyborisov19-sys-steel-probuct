# Public calculator audit — 27 September 2026

Base/deployed SHA: 675facac8ec6edcd457d4d9af56e563f8d63767f.

Live browser: 5 manual positions, 5 hole groups, editing without changing IDs or losing services, 200000 holes in one group, progressive mixed STEP upload, all seven operations, quantity 50, DXF preview and estimate, missing assembly input explicitly excluded, unreadable DXF beside a priced part, detected STEP bending, widths 390/768/1440 and no JavaScript errors. No lead or CRM message submitted.

Found and fixed: upload/drop while editing manual dimensions kept the form open against newly selected CAD. Close editor before CAD ingestion. Regression script scripts/qa-public-editor-transition.mjs reproduces the failure against the previous production release and passes against the built fix.

1437 tests passed; 768 isolated private-basis combinations (128 operation subsets × three materials × quantities 1/50) passed; build/type/lint passed. Initial unrestricted parallel tests exposed macOS temporary-directory canonical-path expectations and a short fake-worker startup timeout; rerun with TMPDIR=/private/tmp and concurrency 2 passed without source changes.

Pricing responses identify source date 2026-09-24; this audit does not assert that the server timer ran today. Synthetic fixtures only; no private tariffs included.

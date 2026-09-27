# Approved site improvements — 27 September 2026

Base: b4829bb / PR #180. Owner authorizes the audit improvements and publication, with two exclusions: the full Hero sentence beginning «От инженерно-конструкторской подготовки и КД до готовой промаркированной партии…» and «Решения для объектов».

## Changes

- Separate online calculation from an engineer request in homepage/header/menu/inner-page actions; industry inner-page action text remains unchanged.
- Preserve the complete Hero sentence and the homepage object section byte-for-byte. No industry page/data edits.
- Remove repeated production statistics from the lower homepage; preserve confirmed equipment in canonical data, Hero and FAQ. Shorten benefit descriptions and duplicate production copy.
- Replace unconditional CAD capability claims with instructions to check material, thickness and operations; keep uncertainty/engineer review explicit.
- Increase calculator label/help contrast, use larger help text, give the CAD workspace a lighter charcoal surface, retain brand/logo.
- Cookie notice renders in document flow on both calculator pages; the consent text, buttons, persistence and analytics opt-in behavior are preserved. Footer settings reopen/focus the notice. Other pages keep the floating notice.
- Remove the unavailable cassette market/AI-review button and its client state/request code. The normal pricing endpoint and existing tariffs/formulas remain unchanged.
- Add a 20-second request timeout, explicit validation/network errors and retry to cassette calculation; cancelled obsolete requests cannot replace current input results.
- Compact cassette page introduction. Contact form now precedes auxiliary links, with a clear “send request” submit action.
- Update sitemap modification dates only for changed main-content pages.

## Verification

- 1437 tests passed; production build/type and lint passed.
- Browser: 16 cassette combinations (2 types × 4 thicknesses × 2 modes), price arithmetic/UI agreement, invalid openings/recovery, network failure/retry, stalled request/timeout/retry, handoff to engineer form without submission.
- Browser: inline cookie notice does not overlap controls; opting out persists; settings reopen with focus.
- CAD browser suite: five positions/five hole groups, all seven services and quantity 50, edit preserving operations, progressive addition/deletion, 200000 holes, mixed manual/STEP and detected bending.
- Responsive widths 390/768/1280/1440; no horizontal overflow or JavaScript errors in checked flows. Screenshots inspected.
- Reduced-motion regression passes both preferences and CAD navigation.
- SEO: all 89 sitemap URLs; zero errors/warnings. 18 legacy redirects and 7 removed URLs verified.
- No lead or CRM message submitted; no pricing basis, secrets or customer files committed. No dependencies added. Publication must be verified for its exact SHA.

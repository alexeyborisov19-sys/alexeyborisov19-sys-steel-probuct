# Repeatable public-site quality gate

Implements Playwright + axe-core per https://playwright.dev/docs/accessibility-testing . Six routes (home, cassette product, CAD entry, contacts, BIM and journal) at mobile 390px and desktop 1440px. Each run checks HTTP 200, JavaScript exceptions, horizontal overflow and WCAG A/AA automated rules, recording exact failing DOM targets. Home additionally checks keyboard skip-to-content and actual navigation into manual quote mode. Compressed initial homepage script budget: 350 KB. Browser JSON is uploaded as a CI artifact. The existing SEO gate covers all 93 sitemap URLs, 18 legacy redirects and 7 retired URLs.

Found/fixed low contrast in footer, contacts, project photo credits and event directions; underlined/lightened consent links without changing wording or behavior; made cassette technical-table scroll region keyboard focusable. No protected hero/header/industry content changes. No review/rating/fact invention, hidden AI instructions or search-ranking guarantees.

Local result: 12 route/viewport combinations, zero automated accessibility violations, runtime errors or overflow; homepage script payload ~125 KB. Full 1452 unit tests and lint/type/build passed. SEO zero errors/warnings. Automated audits cover initial states and do not certify full WCAG compliance, all CAD files, field INP or search ranking.

Quality references: https://web.dev/articles/vitals and https://developers.google.com/search/docs/fundamentals/creating-helpful-content . Target field thresholds should be checked with real-user data, not inferred from one laboratory run. No new tracking enabled by this change.

Security pass: production audit identified patched advisories in Next.js/Sharp/Nodemailer. Updated Next.js and matching ESLint config to 15.5.24, Sharp to 0.35.5, Nodemailer to 9.1.1 and transitive js-yaml. Full npm audit now reports zero known advisories, including dev dependencies. CI checks high/critical advisories. This is dependency scanning, not a penetration-test claim.

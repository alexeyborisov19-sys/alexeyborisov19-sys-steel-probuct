# Yandex and service navigation — 2026-10-04

Base production commit: e6aefb590aa96dd3636127c2a1e471a5f545663a.

## Evidence

- Public crawl run 37191328456: 99 sitemap URLs, zero errors/warnings; 18 legacy redirects and 8 retired URLs passed.
- Webmaster run 37190867028: 93 searchable pages, 4 excluded in summary, no critical/fatal diagnostic problems. This is not a claim that every excluded URL is known.
- Complete event history run 37191255449: latest removal events per URL are old July/August HTTP errors. Event history is not the current excluded-page list.
- Query pagination reported 913 queries but returned 948 rows. Do not publish aggregate intent shares from that inconsistent result.
- Existing secondary hero links and article enquiry/service CTAs use plain Link, losing current campaign query parameters along those transitions.

## Changes

- Use existing AttributionLink for these specific transitions; retain consent and storage behavior.
- Link service pages to published articles that already point to that exact service. Use titles from canonical article data; add no technical claims.
- Send the bending-tolerances article to the Smolensk bending page rather than the generic production index.
- Update modification dates for changed service content and the bending article.

## Boundaries

No legal documents, consent wording, retention, personal-data records, advertising settings, prices or manufacturing facts changed. Bending/welding remain Smolensk-only. No real forms submitted.

## Verification

Local TypeScript, lint and all 1510 unit tests passed. CI must additionally build and run 12 browser scenarios across 390/768/1440 px, covering contextual links, article return links, enquiry attribution, overflow and accessibility. Publication and search-engine ranking are separate outcomes.

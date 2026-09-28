# Customer journey quality — 28 September 2026

Owner authorized fixes and publication. Base 54f2a9af0b2fc939f404d5d9e0bff3630f520405. Protected homepage sentence, logo and object solutions unchanged; no invented projects or production claims.

## Reproduced and corrected

- Failed durable quote storage left a duplicate reservation. A retry returned 429 instead of saving the request. Regression reproduced before the fix. Release only the reservation owned by the failed attempt, before durable storage; retain it for stored/deferred requests and reject concurrent duplicates.
- Quote upload surface did not support drag/drop. It now shares validation/deduplication with file selection, supports keyboard focus and has larger remove targets.
- Quote submission had no client timeout and could accept an invalid 2xx JSON message as success. Add a 60-second timeout, request-ID/ok validation, readable gateway/network errors and a synchronous duplicate-click guard. Lock fields during submission to avoid clearing edits made after submission. Preserve data/files on failure; unknown delivery status explicitly requires checking receipt, not automatic resubmission.
- Receipt displays the server's actual message and request ID. Deferred email is not relabelled as successful mail delivery. Confirmation receives focus; consent text/defaults remain unchanged.
- CAD handoff explains that original files must be attached separately; no additional customer data storage.
- Compact contacts introduction and spacing brings the form forward.
- Inline calculator cookies caused first-visit layout shift after hydration. Server-render the same notice. A read-only pre-paint script hides it for a valid saved choice; it does not grant consent, load analytics, write storage or change legal text. Both rendered instances synchronize on the existing choice event. Settings remain available.
- Article tables have a named, focusable scroll region and mobile guidance.

## Verification

- Production build/type/lint; full suite and browser logs recorded in `/private/tmp/journey-*`.
- `scripts/qa-customer-journey.mjs` intercepts every quote POST: validation/focus, handoff, drag/drop dedupe, malformed gateway and success responses, network interruption, 60-second timeout, duplicate click, blocked edits, normal/deferred receipt, retained inputs, first/returning cookie choice, cross-page choice persistence, article table keyboard access, mobile/tablet/desktop and JS errors.
- Existing public CAD suite: five positions/hole groups, seven operations, quantity 50, edit/delete/progressive additions, mixed STEP/bending/price.
- Cassette: 16 combinations plus validation, network and timeout recovery.
- SEO audit: 92 pages; zero errors/warnings, 18 redirects and 7 removed URLs passed.
- Actual production quote endpoint tested with an empty request only: HTTP 400 VALIDATION_ERROR. No lead, email or CRM message sent. Recipient mailbox delivery is not claimed.

## Mobile lab measurement

One cold-browser pass at 390 px, 150 ms latency, 1.6 Mbps download, CPU x4. This is a synthetic sample, not field Core Web Vitals or a score guarantee.

Before, live site: home LCP 3.756 s / CLS 0; CAD 2.376 s / 0.268; contacts 2.172 s / 0.
Local candidate: home 1.888 s / 0; CAD 0.964 s / 0; contacts 1.600 s / 0. Local/live timing differences are not evidence of a production speedup; repeat after release. Contact page transferred ~269 KB vs ~286 KB before in these samples. No dependency added.

## Release

Pending exact-head CI and live verification. A literal 10/10 usability rating requires user research and operational evidence, not only passing automated tests.

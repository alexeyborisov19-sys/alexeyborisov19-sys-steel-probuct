# SEO audit: indexing, structured data and rich-result eligibility

## Decision

Keep truthful `Product` markup on pages describing physical products, including
made-to-order products. Missing `offers`, `review` and `aggregateRating` means the
page does not meet Google's **product snippet eligibility** requirements. It is
not an ordinary indexing prohibition or invalid JSON-LD. Do not invent prices,
ratings or reviews, remove useful product semantics merely to make a report green,
or relabel physical products as `Service`.

Google requires `name` and at least one of the three commerce properties for product
snippets. Supplying one property is not a guarantee of eligibility: field-level
requirements and visible-content truth still apply. Existing no-fabrication tests
remain authoritative. Historical crawl findings must stay visible until fresh
Google/live evidence establishes their status.

## Current HTML audit

`npm run seo:audit` now reports separate counts for basic technical errors,
structured-data errors, warnings and product-snippet eligibility limitations.
Critical errors fail the command; eligibility limitations are printed individually
but do not claim the page is blocked from indexing.

The bounded JSON-LD check detects malformed JSON, absent Product names, empty
commerce objects, and missing/invalid required VideoObject name, thumbnail URL or
uploadDate. It traverses arrays and `@graph`. It does **not** replace Google's Rich
Results Test, validate all Google features, verify a video's historical publication
date, or prove the truth of a price/review. Unknown Search Console errors must not
be suppressed on the strength of a passing HTML check. HTML without a schema type
also does not exclude markup added by client JavaScript.

## Offline Google report interpretation

Run without credentials or network access:

    node scripts/analyze-gsc-report.mjs report.json > interpreted-report.json

Optional server-HTML evidence is a JSON object with a `pages` array. Each entry has
an absolute `url`, its own ISO timestamp `checkedAt`, and unmodified `html`:

    node scripts/analyze-gsc-report.mjs report.json live-evidence.json > interpreted-report.json

Use downloaded report/evidence files outside the repository; never commit account
reports or credentials. The tool reads only those explicit paths and writes JSON to
stdout. It preserves every raw `index` and `richResults` verdict and issue, separates
known Product commerce limitations from other schema errors, and retains unexplained
FAIL/PARTIAL verdicts. Count units are explicit: failures count pages; errors and
limitations count issue occurrences, including multiple video items per page.

Live evidence is shown separately, with whether its timestamp follows the recorded
Google crawl. No verdict is automatically called fixed/historical based on age or
missing server-side markup. A human must reconcile relevant current rendered/source
evidence with the last-crawl timestamp. No Google inspection data is overwritten.

Canonical comparison treats only an origin's empty path and `/` as equivalent.
Non-root path slashes, query strings, fragments, scheme and `www` differences remain
significant. This corrects the historical GSC workflow's root-slash false positive
without importing its authentication/deployment workflow or modifying immutable runs.

## Nginx warning boundary

The 10 October deployment logged `protocol options redefined for 0.0.0.0:443` while
`nginx -t` and the release succeeded. The tracked site config uses matching
`listen 443 ssl http2` options for both site server blocks. This alone does not reveal
which other loaded host config caused the warning. No hosting, TLS/security or live
settings were changed. Resolving the warning requires examining the effective full
nginx configuration on the authorized server before making a targeted change; do not
blindly remove HTTP/2 or TLS options from this repository to hide the warning.

## Primary references

- https://developers.google.com/search/docs/appearance/structured-data/product-snippet
- https://developers.google.com/search/docs/appearance/structured-data/video
- https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- Deployment evidence for the nginx warning and successful release: https://github.com/alexeyborisov19-sys/alexeyborisov19-sys-steel-probuct/actions/runs/38081526008/job/114299969711 (10 October 2026, 19:57 UTC).

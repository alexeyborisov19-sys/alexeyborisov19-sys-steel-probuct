# ChatGPT search readiness — 28 September 2026

Scope: public retrieval clarity, not a ranking or inclusion guarantee.

## Findings and changes

- OAI-SearchBot already allowed by robots.txt. Kept bot preferences and private-route exclusions unchanged.
- Added a single source of public tool descriptions for the server-rendered company facts page, llms.txt and llms-full.txt: CAD/manual quotation, cassette quantity planning, IFC/CSV generator.
- Added visible questions and matching FAQ schema. Explicit preliminary-price and current BIM/RFA limits prevent misleading capabilities.
- Synchronized the actual company-facts update date in visible text, AboutPage schema and sitemap.
- No new client JavaScript, dependency, analytics, consent, pricing or CAD changes. No hidden keyword text or invented claims.

## Verification

- Build, lint and typecheck passed; 1451 tests passed.
- Local SEO audit: 93 sitemap URLs, 0 errors, 0 warnings.
- Chromium 390/1440: three tool links resolve, one H1, FAQ JSON-LD parses and contains the visible answers, no horizontal overflow or JS errors. Both text endpoints contain tool capabilities and limitations.
- Production baseline: robots, sitemap, company facts, CAD and BIM return 200 for OAI-SearchBot/1.4 and ChatGPT-User/1.0 requests; no X-Robots-Tag exclusion. This does not prove access from actual OpenAI IP ranges or indexing.
- Exact-head CI and post-deploy checks are required before the release is reported published.

## Official reference and limits

https://developers.openai.com/api/docs/bots

OAI-SearchBot manages search retrieval; GPTBot relates to training; ChatGPT-User is user-initiated fetching. Permissions are independent. llms.txt is an optional summary, not a documented OpenAI indexing requirement. Search visibility and citations require independent observation after publication; no guaranteed ranking, timeline or "10/10" certification is claimed.

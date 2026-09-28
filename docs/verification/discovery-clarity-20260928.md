# Public discovery and calculator clarity — 28 September 2026

## Observation

Public web search queries: `"Сталь Продукт" бесплатный расчет металлоизделий`, `site:steelprodukt.ru расчет DXF STEP бесплатно`, `бесплатный онлайн расчет лазерной резки по габаритам отверстия`.

The search tool returned the official homepage, CAD page and production/article pages. Its CAD snapshot still displayed older title/body, while live HTML had the new free/manual calculation copy. This is evidence of discoverability plus snapshot lag, not a controlled ChatGPT/Alice citation benchmark or a rank report. Do not infer a crawler failure from the old snapshot.

## Concrete changes

- Direct calculator links from laser-cutting and sheet-bending service pages.
- Server-rendered DXF / STEP / manual-input comparison after the working calculator, including useful input preparation and geometry limits.
- FAQ automatic STEP claims qualified consistently; visible answers and JSON-LD share the same data.
- Manual dimensions added to the existing WebApplication feature list.
- No duplicated landing pages, fabricated capabilities, price promises or hidden keywords. Existing calculator logic, consent, logo, Hero and object-solution pages unchanged.

## Acceptance

Build/lint/type passed; 1451 tests passed. Chromium 390/1440 navigation and schema checks passed. Sitemap audit: 93 URLs, zero errors/warnings. Exact-head CI and live checks required before claiming publication. Actual citations depend on the search provider and should be measured separately over time with a fixed query set and recorded date/context; no guarantee follows from these edits.

# Steel Produkt — Codex Agent Team

For substantial website tasks, treat the installed skills and MCP tools as one coordinated team.

## Lead workflow
- Start with `.agents/skills/site-director/SKILL.md` for page creation, redesigns, conversion work, or site-wide changes.
- Use Ruflo MCP for orchestration when available.
- Use Superpowers / `website-development` as the implementation workflow.

## Specialists
- Product/manufacturing truth: `manufacturing-technical-writer`, supported by `docs-architect`.
- SEO/growth: installed marketing skills (`seo-audit`, `ai-seo`, programmatic SEO, schema, content/CRO skills as relevant).
- UI/UX: `ui-ux-pro-max`.
- Engineering: Superpowers skills plus `website-development`.

## Mandatory final gate for meaningful UI/site changes
Use `site-quality-gate` and, when available, Playwright MCP for real browser verification. Then apply `test-automator`, `performance-engineer`, `accessibility-expert`, `security-auditor` when relevant, and finish with `code-reviewer`.

## Non-negotiable factual rule
Never invent technical product data, standards, tolerances, dimensions, materials, ratings, certifications, or manufacturing capabilities. If source evidence is missing, mark the claim as needing confirmation instead of filling the gap.

## Approved Steel Produkt source of truth
These statements are explicitly confirmed by the company owner and must not be weakened, removed, reinterpreted, or “corrected” by an agent without new explicit confirmation.

### Confirmed production capabilities
The executable source of truth for equipment counts is `data/manufacturing-facts.ts`.

- 3 laser cutting complexes.
- 4 press-brake / sheet-bending complexes.
- 1 panel bender in addition to the four press-brake complexes.
- 4 welding stations.
- 3 powder-coating booths.
- 1 shot-blasting chamber.
- 1 laser-cleaning system.
- An in-house engineering and design function, publicly positioned as the **Engineering and Design Center / Инженерно-конструкторский центр**.
- Locksmith / finishing operations, publicly described as **Слесарно-доводочные операции** where appropriate.
- Dedicated assembly capability, publicly described as **Сборочное производство**.
- Quality control, order completion and packaging before dispatch, publicly described as **Контроль качества, комплектация и упаковка**.

Do not replace these confirmed counts with older values found in stale crawler snapshots, historical commits, cached pages, previous chat notes or generic industry assumptions.

### Approved production positioning
The following are approved brand/platform ideas and should be preserved and reused where they improve clarity and conversion:

- **Производство полного цикла**.
- **От КД до готовой партии**.
- **От опытного образца до серии**.
- **Инженерно-конструкторский центр + собственная производственная база**.
- A single production route from engineering preparation through fabrication, finishing, quality control, completion, packaging and dispatch.
- Emphasize proof-backed in-house operations rather than empty superlatives such as “best”, “number one”, or “market leader”.

### Approved production chain
When a page needs a high-level process description, use this as the conceptual order unless the specific product requires a shorter subset:

**Инженерно-конструкторский центр → лазерная обработка → гибочное производство → слесарно-доводочные операции → сварочно-сборочное направление → сборочное производство → подготовка поверхности → порошковая окраска → контроль качества → комплектация и упаковка → отгрузка.**

### Photography truth
Production/workshop photographs currently identified as Steel Produkt production photography are real photographs of the company's production. Do not relabel them as demo, illustrative, stock, conceptual or representative imagery unless the owner explicitly identifies a specific image as such.

This rule does not convert separate project/industry scenario illustrations into real completed customer cases. Keep the distinction between real production photography and demonstration project scenarios.

### Installation boundary
Steel Produkt manufactures, engineers and supplies products, assemblies, fastening/installation systems and project-specific components. **On-site installation is not offered as a service.**

Do not remove legitimate product terms such as “монтажная система”, “монтажный узел”, “крепёж”, or “подготовка к монтажу”; instead make sure the surrounding copy does not imply that Steel Produkt performs installation on the customer site.

### Pricing and commercial promises
- Do not publish invented product prices or revive the removed price estimate in the metal-cassette calculator.
- Do not invent response-time SLAs, stock availability, tolerances, guaranteed deadlines or universal performance claims.
- Confirmed commercial/production conditions may be used only with the qualifications already encoded in the canonical data and tests.

### Branded preloader
The branded site preloader is explicitly approved and should remain enabled. Performance work may optimize its implementation and preserve `prefers-reduced-motion`, but must not silently remove or disable the preloader.

### Legal pages and personal-data wording
Public legal pages, consent wording, retention periods and internal personal-data controls are governed separately from normal marketing/SEO/UI work.

Do not rewrite, remove, enable, disable or “simplify” legal/personal-data behavior as part of an unrelated site improvement. Any substantive legal-document change requires explicit owner approval and must remain synchronized with the legal regression tests.

## Conflict resolution order
When sources disagree, resolve them in this order:
1. The owner's latest explicit confirmation.
2. `data/manufacturing-facts.ts` and other current canonical data files.
3. Current regression tests that encode approved facts/constraints.
4. Current source code in `main`.
5. External search/crawler snapshots and historical repository content.

Never let a stale search index or historical page override a confirmed current company fact.

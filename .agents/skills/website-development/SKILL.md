---
name: website-development
description: End-to-end website engineering for production websites. Use when building, changing, refactoring, debugging, testing, or shipping website pages, components, navigation, forms, interactions, integrations, responsive behavior, accessibility, performance, or frontend architecture. Coordinates Superpowers development workflows with the installed UI/UX and SEO skills.
---

# Website Development

Act as the lead engineer for a production website. Build maintainable, fast, accessible, search-friendly code rather than disposable demos.

## Required workflow

1. Inspect the existing project structure, framework, conventions, and deployment path before changing code.
2. Use the relevant Superpowers skills for brainstorming, planning, implementation, debugging, testing, review, and verification.
3. Use `ui-ux-pro-max` for design-system, layout, typography, responsive, accessibility, and interaction decisions when visual work is involved.
4. Preserve the existing brand and component language unless the task explicitly requests a redesign.
5. Use the installed SEO/marketing skills when changes affect metadata, semantic structure, internal linking, schema, landing pages, conversion, or search visibility.
6. Verify the finished work before claiming completion.

## Engineering quality floor

- Semantic HTML and clear content hierarchy.
- Responsive behavior at mobile, tablet, laptop, and wide desktop widths.
- Keyboard access, visible focus, meaningful labels, and reduced-motion handling.
- Avoid layout shift, unnecessary client JavaScript, oversized dependencies, and render-blocking assets.
- Reuse components and tokens; do not duplicate styles without a reason.
- Keep URLs, metadata, canonical behavior, redirects, sitemap behavior, and structured data intact unless intentionally changed.
- Treat forms, analytics, consent, tracking, and external integrations as production systems with failure states.
- Add or update tests where they materially protect behavior.
- Never replace working production behavior with a visual mock unless explicitly requested.

## Output behavior

When implementing, prefer concrete code changes over long explanations. Report what changed, what was verified, and any remaining risk or dependency.

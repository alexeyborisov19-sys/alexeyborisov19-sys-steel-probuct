---
name: site-quality-gate
description: Final acceptance gate for website changes. Uses browser verification, tests, performance, accessibility, security, and code review before completion claims.
---

# Site Quality Gate

Apply this after implementation and before saying a website task is finished.

## Gate order
1. Build/type/lint/test: run the project's relevant checks and fix failures.
2. Browser QA: when Playwright MCP is available, open the changed pages and verify the real rendered result, navigation, controls, forms, responsive behavior, overflow, broken assets, console-visible failures, and obvious regressions. Check desktop and mobile-sized viewports for UI work.
3. Functional testing: use `test-automator` for missing high-value tests and regression coverage.
4. Performance: use `performance-engineer` to identify avoidable bundle, rendering, image, animation, loading, and Core Web Vitals risks introduced by the change.
5. Accessibility: use `accessibility-expert` for keyboard, focus, semantics, contrast, labels, reduced motion, and WCAG-relevant issues.
6. Security: use `security-auditor` for changes touching forms, user input, APIs, authentication, headers, dependencies, or external integrations.
7. Final review: use `code-reviewer` to check correctness, maintainability, regressions, and production readiness.

## Completion standard
Never claim success from code inspection alone when browser verification is available. Report any gate that could not be run and why. Critical failures block completion.

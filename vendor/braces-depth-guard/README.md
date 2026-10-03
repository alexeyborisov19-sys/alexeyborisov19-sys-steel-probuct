# Bounded-depth braces fork

Source: braces3.0.3, https://github.com/micromatch/braces/tree/3.0.3 (MIT; original LICENSE retained).
Reason: GHSA-vfj7-8cjw-p6xm / CVE-2026-93687. Advisory updated2Oct2026 reports no patched upstream version. npm audit's suggested Tailwind4 migration is not an API-compatible fix for this website.

Changes:
- parser rejects a stack depth over128 before cleanup can recurse;
- iterative preflight before compile/expand/stringify rejects nodes deeper than128, cyclic/shared nodes and trees exceeding100000 nodes;
- upstream algorithm otherwise retained, including range limits and length checks.

Package is explicitly named @steelprodukt/braces-depth-guard, not misrepresented as an upstream security release. npm override replaces braces for all transitive consumers. npm audit remains unchanged and checks all other advisories. This patch addresses recursion exhaustion; it is not a claim that arbitrary glob expansion is generally safe for public untrusted input. Application routes do not expose this library.

Tests cover ordinary nested patterns/ranges and malicious valid/unclosed/deep/cyclic inputs; full build/lint/test validates consumers. Remove override and vendor only after a maintained upstream fix is verified with these regressions. Review no later than2026-11-03.

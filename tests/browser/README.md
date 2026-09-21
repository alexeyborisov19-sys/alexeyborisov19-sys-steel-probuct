# CAD browser checks

Use an installed Playwright module via `PLAYWRIGHT_MODULE`, and Chrome. No paid services are needed.

Public regression: start the production build on localhost:3100, then run `node tests/browser/cad-workspace.mjs`. It uses a real CAD analyzer and a synthetic delayed calculation response to exercise invalidation.

Employee application: stop that server; run `node --import tsx tests/browser/production-fixture.ts`. This creates a temporary SQLite database, generated session secrets and synthetic rates under `/private/tmp`, outside the repository. Start `next dev --port 3100` with the generated JSON's `environment` object added to the child process environment, then run `node tests/browser/production-workspace.mjs`. The test uses real analysis, calculation, report persistence and authenticated report rendering. It expects AI to be disabled and verifies that this is displayed honestly.

Never use the synthetic fixture or its account on production. Screenshots are written under `/tmp`. Stop the test server after use; sessions expire automatically.

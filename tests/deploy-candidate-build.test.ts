import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const buildScriptPath = new URL("../deploy/build-and-restart.sh", import.meta.url);
const nextConfigPath = new URL("../next.config.ts", import.meta.url);
const workflowPath = new URL("../.github/workflows/deploy-beget.yml", import.meta.url);

test("production builds and audits a candidate before replacing the active Next build", async () => {
  const [buildScript, nextConfig] = await Promise.all([
    readFile(buildScriptPath, "utf8"),
    readFile(nextConfigPath, "utf8"),
  ]);

  assert.match(nextConfig, /distDir: process\.env\.NEXT_DIST_DIR \|\| "\.next"/);
  assert.match(buildScript, /CANDIDATE_DIST="\.next-candidate"/);
  assert.match(buildScript, /NEXT_DIST_DIR="\$CANDIDATE_DIST" npm run build/);
  assert.match(
    buildScript,
    /NEXT_DIST_DIR="\$CANDIDATE_DIST" node \.\/node_modules\/next\/dist\/bin\/next start/,
  );
  assert.doesNotMatch(buildScript, /NEXT_DIST_DIR="\$CANDIDATE_DIST" npm run start/);
  assert.match(buildScript, /SEO_AUDIT_PORT:-/);
  assert.match(buildScript, /server\.listen\(0, "127\.0\.0\.1"/);
  assert.match(buildScript, /if ! kill -0 "\$AUDIT_PID" 2>\/dev\/null; then[\s\S]*?curl -fsS "http:\/\/127\.0\.0\.1:\$AUDIT_PORT\/robots\.txt"/);
  assert.match(buildScript, /test -f "\$CANDIDATE_DIST\/required-server-files\.json"/);
  assert.match(buildScript, /test -f "\$CANDIDATE_DIST\/server\/middleware-manifest\.json"/);
  assert.match(buildScript, /mv "\$CANDIDATE_DIST" \.next/);
  assert.match(buildScript, /Candidate failed after promotion; rolling back the previous build\./);
  assert.match(
    buildScript,
    /SEO_AUDIT_BASE_URL="http:\/\/127\.0\.0\.1:3000" node scripts\/audit-legacy-redirects\.mjs/,
  );

  const candidateBuild = buildScript.indexOf('NEXT_DIST_DIR="$CANDIDATE_DIST" npm run build');
  const stopOldWorker = buildScript.indexOf('pm2 delete "$APP_NAME"');
  const productionRedirectAudit = buildScript.indexOf('SEO_AUDIT_BASE_URL="http://127.0.0.1:3000" node scripts/audit-legacy-redirects.mjs');
  // The rollback copy is also cleared at the start of a deploy, so the discard
  // this test is about is the one that follows the audit. Searching from the
  // audit keeps the assertion on its real subject: move the discard above the
  // audit and this finds nothing, exactly as it should.
  const discardPreviousBuild = buildScript.indexOf('rm -rf "$PREVIOUS_DIST"', productionRedirectAudit);
  assert.ok(candidateBuild >= 0 && stopOldWorker > candidateBuild, "the live worker must stay up during the candidate build");
  assert.ok(
    productionRedirectAudit > stopOldWorker && discardPreviousBuild > productionRedirectAudit,
    "the promoted build must prove legacy redirects before the rollback build is discarded",
  );

  assert.doesNotMatch(buildScript, /\nnpm run build\n/);
});

test("production publishes the release built on the runner instead of building on the host", async () => {
  const [buildScript, workflow] = await Promise.all([
    readFile(buildScriptPath, "utf8"),
    readFile(workflowPath, "utf8"),
  ]);

  // The host stopped building because next build peaks near 1.9GB there and was
  // OOM-killed mid-deploy. The runner builds, the host publishes.
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /actions\/upload-artifact/);
  assert.match(workflow, /actions\/download-artifact/);
  assert.match(buildScript, /PREBUILT_CANDIDATE=true/);

  // A candidate left behind by an interrupted deploy must never be promoted as
  // if it were the new release.
  assert.match(workflow, /printf '%s' "\$GITHUB_SHA" > \.next\/BUILD_COMMIT/);
  assert.match(buildScript, /Refusing to publish a release that does not match the deployed source\./);

  // sudo -i starts a login shell and drops the environment, so the expected
  // commit has to arrive as an argument. Passing it as a variable would leave
  // the check silently disabled.
  assert.match(
    workflow,
    /sudo -iu nodejs bash "\$APP_PATH\/deploy\/build-and-restart\.sh" "\$APP_PATH" "\$EXPECTED_BUILD_COMMIT"/,
  );
  assert.doesNotMatch(workflow, /sudo -iu nodejs EXPECTED_BUILD_COMMIT=/);
  assert.match(buildScript, /EXPECTED_BUILD_COMMIT="\$\{2:-\$\{EXPECTED_BUILD_COMMIT:-\}\}"/);

  // Validation moves to the runner with the build, and the host must not repeat
  // it — repeating it is what competed for the memory the build needed.
  const prebuiltGuard = buildScript.indexOf('if [ "$PREBUILT_CANDIDATE" != true ]; then');
  const lintOnHost = buildScript.indexOf("npm run lint");
  assert.ok(prebuiltGuard >= 0 && lintOnHost > prebuiltGuard, "host validation must sit behind the prebuilt guard");

  // Runtime configuration still belongs to the host, so it is still checked there.
  const envCheck = buildScript.indexOf("npm run env:check");
  assert.ok(envCheck >= 0 && envCheck < lintOnHost, "the host must still validate its own runtime environment");

  // .next/cache is build state and by far the largest part of the tree.
  assert.match(workflow, /tar --exclude=\.\/cache/);

  // The counter has no fallback in code, so a build without it would silently
  // ship a site with no analytics.
  assert.match(workflow, /NEXT_PUBLIC_YM_COUNTER_ID/);
  assert.match(workflow, /The Yandex Metrica counter is absent from the built client bundle\./);
});

test("an interrupted promotion cannot leave production without a worker", async () => {
  const buildScript = await readFile(buildScriptPath, "utf8");

  // GitHub Actions cancels superseded runs, which kills the SSH child at an
  // arbitrary point. Between "pm2 delete" and "pm2 start" nothing answers on
  // port 3000, so that window must restore a serving state before exiting.
  assert.match(buildScript, /trap restore_service_on_abort INT TERM HUP/);
  assert.match(buildScript, /restore_service_on_abort\(\) \{/);
  assert.match(buildScript, /promotion_in_progress=true/);

  const guardInstalled = buildScript.indexOf("trap restore_service_on_abort INT TERM HUP");
  const windowOpens = buildScript.indexOf("promotion_in_progress=true");
  const stopOldWorker = buildScript.indexOf('pm2 delete "$APP_NAME"');
  const guardCleared = buildScript.lastIndexOf("trap - INT TERM HUP");

  assert.ok(guardInstalled >= 0, "the abort guard must be installed");
  assert.ok(windowOpens > guardInstalled, "the guard must be armed before the window opens");
  assert.ok(stopOldWorker > windowOpens, "the old worker must only stop inside the guarded window");
  assert.ok(guardCleared > stopOldWorker, "the guard must stay armed until the new worker is audited");

  // The recovery itself must put a build back and restart the worker.
  const handler = buildScript.slice(
    buildScript.indexOf("restore_service_on_abort() {"),
    guardInstalled,
  );
  assert.match(handler, /mv "\$CANDIDATE_DIST" \.next/);
  assert.match(handler, /mv "\$PREVIOUS_DIST" \.next/);
  assert.match(handler, /pm2 start ecosystem\.config\.cjs --env production --update-env/);
  assert.match(handler, /wait_for_production/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const buildScriptPath = new URL("../deploy/build-and-restart.sh", import.meta.url);
const nextConfigPath = new URL("../next.config.ts", import.meta.url);

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

  const candidateBuild = buildScript.indexOf('NEXT_DIST_DIR="$CANDIDATE_DIST" npm run build');
  const stopOldWorker = buildScript.indexOf('pm2 delete "$APP_NAME"');
  assert.ok(candidateBuild >= 0 && stopOldWorker > candidateBuild, "the live worker must stay up during the candidate build");

  assert.doesNotMatch(buildScript, /\nnpm run build\n/);
});

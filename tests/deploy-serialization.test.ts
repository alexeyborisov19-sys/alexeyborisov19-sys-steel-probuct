import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const buildScriptPath = new URL("../deploy/build-and-restart.sh", import.meta.url);
const prepareScriptPath = new URL("../deploy/prepare-production.sh", import.meta.url);

test("Beget serializes production builds on the server", async () => {
  const buildScript = await readFile(buildScriptPath, "utf8");

  assert.match(buildScript, /STEELPRODUKT_DEPLOY_LOCK/);
  assert.match(buildScript, /exec 9>"\$DEPLOY_LOCK"/);
  assert.match(buildScript, /flock -w 900 9/);
});

test("production install avoids optional npm audit and funding work", async () => {
  const buildScript = await readFile(buildScriptPath, "utf8");

  assert.match(buildScript, /npm ci --no-audit --no-fund/);
});

test("production preparation removes explicit development artifacts only", async () => {
  const prepareScript = await readFile(prepareScriptPath, "utf8");
  const cleanupStart = prepareScript.indexOf(
    "Development-only agent/runtime artifacts from older deployment layouts",
  );
  const cleanupEnd = prepareScript.indexOf("install -d -m 0700", cleanupStart);

  assert.ok(cleanupStart >= 0, "cleanup policy marker must exist");
  assert.ok(cleanupEnd > cleanupStart, "cleanup block must have a bounded end");

  const cleanupBlock = prepareScript.slice(cleanupStart, cleanupEnd);
  for (const artifact of [
    ".agents",
    ".codex",
    ".claude",
    ".claude-flow",
    ".mcp.json",
    "AGENTS.md",
    "tsconfig.tsbuildinfo",
  ]) {
    assert.ok(cleanupBlock.includes(`$APP_PATH/${artifact}`), `${artifact} must be removed`);
  }

  for (const protectedPath of [".data", ".env", "node_modules", ".next"]) {
    assert.ok(
      !cleanupBlock.includes(`$APP_PATH/${protectedPath}`),
      `${protectedPath} must not be removed by the dev-artifact cleanup`,
    );
  }
});

test("production build removes generated TypeScript incremental metadata", async () => {
  const buildScript = await readFile(buildScriptPath, "utf8");

  assert.ok(buildScript.includes('rm -f "$APP_PATH/tsconfig.tsbuildinfo"'));
});

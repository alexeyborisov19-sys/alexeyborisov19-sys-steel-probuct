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


    test("production preparation removes explicit development artifacts", async () => {
      const prepareScript = await readFile(prepareScriptPath, "utf8");

      for (const artifact of [".agents", ".codex", ".claude", ".claude-flow", ".mcp.json", "AGENTS.md"]) {
        assert.ok(prepareScript.includes(`$APP_PATH/${artifact}`));
      }
      assert.doesNotMatch(prepareScript, /rm -rf --[^
]*\.data/);
      assert.doesNotMatch(prepareScript, /rm -rf --[^
]*\.env/);
    });

    test("production build removes generated TypeScript incremental metadata", async () => {
      const buildScript = await readFile(buildScriptPath, "utf8");
      assert.ok(buildScript.includes('rm -f "$APP_PATH/tsconfig.tsbuildinfo"'));
    });

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const buildScriptPath = new URL("../deploy/build-and-restart.sh", import.meta.url);

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

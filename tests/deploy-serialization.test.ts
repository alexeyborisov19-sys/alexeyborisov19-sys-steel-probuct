import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL("../.github/workflows/deploy-beget.yml", import.meta.url);
const buildScriptPath = new URL("../deploy/build-and-restart.sh", import.meta.url);

test("GitHub and Beget both serialize production deploys", async () => {
  const [workflow, buildScript] = await Promise.all([
    readFile(workflowPath, "utf8"),
    readFile(buildScriptPath, "utf8"),
  ]);

  assert.match(workflow, /group: steelprodukt-production/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.match(buildScript, /STEELPRODUKT_DEPLOY_LOCK/);
  assert.match(buildScript, /flock -w 900 9/);
});

test("production install avoids optional npm audit and funding work", async () => {
  const buildScript = await readFile(buildScriptPath, "utf8");

  assert.match(buildScript, /npm ci --no-audit --no-fund/);
});

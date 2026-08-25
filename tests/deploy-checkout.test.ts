import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL("../.github/workflows/deploy-beget.yml", import.meta.url);

test("production checkout skips agent runtimes before upload", async (t) => {
  if (!existsSync(workflowPath)) {
    t.skip("deployment workflow is intentionally absent from the production bundle");
    return;
  }

  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /uses: actions\/checkout@v5[\s\S]*?timeout-minutes: 5/);
  assert.match(workflow, /sparse-checkout-cone-mode: false/);
  assert.match(workflow, /sparse-checkout: \|/);
  assert.match(workflow, /\/\*[\s\S]*!\/\.agents\//);

  for (const runtime of [".agents", ".codex", ".claude", ".claude-flow"]) {
    assert.ok(
      workflow.includes(`!/${runtime}/`),
      `${runtime} must stay outside the production checkout`,
    );
  }
});

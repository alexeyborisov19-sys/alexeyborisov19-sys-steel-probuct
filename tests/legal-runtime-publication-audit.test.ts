import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const scriptPath = join(root, "scripts/audit-live-legal-publication.py");

test("public legal audit covers every published legal page and its edition", () => {
  const source = readFileSync(scriptPath, "utf8");
  const workflow = readFileSync(join(root, ".github/workflows/legal-controls-audit.yml"), "utf8");
  const routes = [
    "privacy", "personal-data-consent", "analytics-consent", "marketing-consent",
    "cookies", "services", "terms", "requisites",
  ];
  for (const route of routes) {
    assert.ok(source.includes('"' + route + '": ('), route + " must be checked");
  }
  assert.match(source, /lib"\s*\/\s*"legal\.ts"/);
  assert.match(source, /Cache-Control.*no-cache/);
  assert.match(source, /raise RuntimeError\(f"\/legal\/\{slug\}:/);
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /audit-live-legal-publication\.py/);
  assert.match(workflow, /RETENTION_REVIEW_REQUIRED/);
  assert.match(workflow, /raise SystemExit\(2\)/);
});

test("public legal audit script has valid Python syntax", (t) => {
  const command = spawnSync("python3", ["-c",
    "import ast,sys; ast.parse(open(sys.argv[1], encoding='utf-8').read())",
    scriptPath,
  ], { encoding: "utf8", timeout: 10_000 });
  if (command.error && "code" in command.error && command.error.code === "ENOENT") {
    t.skip("python3 unavailable in this environment");
    return;
  }
  assert.equal(command.status, 0, command.stderr || command.error?.message);
});

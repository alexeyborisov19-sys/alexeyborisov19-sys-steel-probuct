import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/diagnose-online-order-runtime.yml", import.meta.url), "utf8");
const match = workflow.match(/sudo -iu nodejs pm2 jlist \| node -e '([\s\S]*?)^\s*'\r?\n/m);
assert.ok(match, "PM2 JSON needs a dedicated stdin; source code must use node -e");
const script = match[1];
function run(input: string) {
  return spawnSync(process.execPath, ["-e", script], { input, encoding: "utf8", timeout: 5000 });
}
const fixture = [{
  name: "steelprodukt", pid: 123, monit: { memory: 100000000, cpu: 0.5 },
  pm2_env: { status: "online", node_version: "22.16.0", restart_time: 4, max_memory_restart: 629145600, pm_uptime: 1790767000000 },
}];

test("runtime diagnostic reads service JSON and reports bounded memory fields", () => {
  const result = run(JSON.stringify(fixture));
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    name: "steelprodukt", pid: 123, status: "online", node: "22.16.0", rssBytes: 100000000,
    cpuPercent: 0.5, restartCount: 4, memoryRestartLimitBytes: 629145600, startedAtEpochMs: 1790767000000,
  });
});

test("runtime diagnostic does not print environments or command arguments", () => {
  const result = run(JSON.stringify([{...fixture[0], pm2_env: {...fixture[0].pm2_env,
    SMTP_PASSWORD: "FIXTURE_NOT_A_REAL_SECRET", args: ["--token=FIXTURE_ONLY"],
  }}]));
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout + result.stderr, /FIXTURE|SMTP_PASSWORD|args/);
});

test("runtime diagnostic filters other services and null array members", () => {
  const result = run(JSON.stringify([null, {name: "other-service"}, ...fixture]));
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).name, "steelprodukt");
  assert.doesNotMatch(result.stdout, /other-service/);
});

for (const [label, input] of [
  ["missing service", "[]"], ["invalid JSON", "SYNTHETIC_INVALID_INPUT"], ["wrong root type", "{}"], ["empty input", ""],
]) {
  test(`runtime diagnostic fails safely for ${label}`, () => {
    const result = run(input);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.trim(), "PM2_SNAPSHOT_UNAVAILABLE");
  });
}

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/legal-controls-audit.yml", "utf8");
const diagnostic = workflow.match(/          # BEGIN OFFSITE DIAGNOSTIC\n([\s\S]*?)          # END OFFSITE DIAGNOSTIC/);
const source = diagnostic?.[1].split("\n").map((line) => line.startsWith("          ") ? line.slice(10) : line).join("\n");
const invocation = "0123456789abcdef0123456789abcdef";
const properties = [
  "Result=exit-code", "ExecMainCode=1", "ExecMainStatus=1",
  "ExecMainStartTimestamp=Sat 2026-10-10 14:29:41 UTC",
  "ExecMainExitTimestamp=Sat 2026-10-10 14:29:49 UTC",
  `InvocationID=${invocation}`,
].join("\n");
const classes = ["LOCK", "SQLITE", "PERMISSION", "DISK_FULL", "NETWORK", "DNS", "TLS", "REMOTE_AUTH", "THROTTLE", "HASH", "RESTORE", "UNKNOWN"];

function runDiagnostic(options: { messages?: unknown[]; properties?: string; retention?: string; journal?: string; failure?: string } = {}) {
  assert.ok(source, "the audit must include the aggregate-only offsite diagnostic");
  const fixture = JSON.stringify({ properties, ...options });
  const program = `
import json, subprocess, os, re, datetime, sys
fixture = json.load(sys.stdin)
commands = []
def fake_run(command, **kwargs):
    commands.append(command)
    assert kwargs['stderr'] == subprocess.DEVNULL
    assert kwargs['stdin'] == subprocess.DEVNULL
    assert kwargs['timeout'] == 15
    assert kwargs['env']['LC_ALL'] == 'C'
    assert kwargs['env']['TZ'] == 'UTC'
    if fixture.get('failure') == 'timeout':
        raise subprocess.TimeoutExpired(command, 15, output=b'secret timeout payload', stderr=b'private error')
    if fixture.get('failure') == 'exception':
        raise OSError('secret exception payload')
    if command[0] == 'systemctl':
        assert command[1] == 'show'
        assert command[2] in ('steelprodukt-pd-offsite-backup.service', 'steelprodukt-pd-retention-check.service')
        output = fixture.get('retention', fixture['properties']) if command[2] == 'steelprodukt-pd-retention-check.service' else fixture['properties']
    else:
        assert command[0] == 'journalctl'
        assert '-n' in command and command[command.index('-n') + 1] == '200'
        assert '--output-fields=MESSAGE' in command
        assert '_SYSTEMD_INVOCATION_ID=${invocation}' in command
        assert '_SYSTEMD_UNIT=steelprodukt-pd-offsite-backup.service' in command
        output = fixture.get('journal', '\\n'.join(json.dumps({'MESSAGE': value}) for value in fixture.get('messages', [])))
    return subprocess.CompletedProcess(command, 1 if fixture.get('failure') == 'nonzero' else 0, output.encode())
subprocess.run = fake_run
${source}
`;
  const stdout = execFileSync("python3", ["-c", program], { input: fixture, encoding: "utf8", timeout: 10_000, stdio: "pipe" });
  const lines = stdout.split("\n").filter(Boolean);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].startsWith("RETENTION_SERVICE="));
  assert.ok(stdout.length < 1800, "output must be bounded independently of input messages");
  assert.ok(stdout.startsWith("OFFSITE_DIAGNOSTIC="));
  const result = JSON.parse(lines[0].slice("OFFSITE_DIAGNOSTIC=".length));
  const retention = JSON.parse(lines[1].slice("RETENTION_SERVICE=".length));
  assert.deepEqual(Object.keys(retention), ["result", "exec_main_code", "exec_main_status", "started_at", "exited_at"]);
  assert.deepEqual(Object.keys(result), [...Object.keys(retention), "journal_status", "error_counts"]);
  assert.deepEqual(Object.keys(result.error_counts), classes);
  for (const count of Object.values(result.error_counts)) assert.ok(Number.isInteger(count) && Number(count) >= 0 && Number(count) <= 200);
  return { result, retention, stdout };
}

test("offsite diagnostics classify stable tool errors and emit only validated service facts", () => {
  const cases: [string, string][] = [
    ["PD backup already running", "LOCK"],
    ["PD backup staging/retention failed: OperationalError; code=SQLITE_READONLY", "SQLITE"],
    ["sqlite3.OperationalError: database is locked", "SQLITE"],
    ["PD backup staging/retention failed: PermissionError; code=13", "PERMISSION"],
    ["open private-path: read-only file system", "PERMISSION"],
    ["PD backup staging/retention failed: OSError; code=28", "DISK_FULL"],
    ["No space left on device", "DISK_FULL"],
    ["dial tcp: connection refused", "NETWORK"],
    ["dial tcp: lookup private-bucket: no such host", "DNS"],
    ["x509: certificate signed by unknown authority", "TLS"],
    ["api error AccessDenied: Access Denied", "REMOTE_AUTH"],
    ["api error SignatureDoesNotMatch: private-signature", "REMOTE_AUTH"],
    ["api error SlowDown: retry later", "THROTTLE"],
    ["HTTP status code: 429", "THROTTLE"],
    ["corrupted on transfer: sha256 hashes differ", "HASH"],
    ["restore verification failed", "RESTORE"],
    ["bad decrypt", "RESTORE"],
  ];
  for (const [message, expected] of cases) {
    const { result } = runDiagnostic({ messages: [message] });
    assert.equal(result.error_counts[expected], 1, expected);
    assert.equal(result.error_counts.UNKNOWN, 0, expected);
    assert.equal(result.result, "exit-code");
    assert.equal(result.exec_main_code, 1);
    assert.equal(result.exec_main_status, 1);
    assert.equal(result.started_at, "2026-10-10T14:29:41+00:00");
    assert.equal(result.exited_at, "2026-10-10T14:29:49+00:00");
  }
});

test("journal messages, paths, credentials and customer data never reach diagnostic output", () => {
  const forbidden = ["customer@example.invalid", "+79991234567", "Customer Private Name", "private-secret-token", "AKIA_FAKE_SECRET", "private-bucket.example.invalid", "/private/customer/file.json", "-----BEGIN PRIVATE KEY-----", "secret exception payload", "secret timeout payload"];
  const messages = forbidden.map((value) => `ERROR: AccessDenied: ${value}`);
  const { stdout } = runDiagnostic({ messages });
  for (const value of forbidden) assert.ok(!stdout.includes(value), value);
  for (const failure of ["exception", "timeout", "nonzero"]) {
    const output = runDiagnostic({ failure, messages }).stdout;
    for (const value of forbidden) assert.ok(!output.includes(value), value);
  }
  const poisoned = runDiagnostic({ properties: `Result=${forbidden.join(" ")}\nExecMainStatus=${forbidden[0]}\nExecMainCode=999999999999999999\nExecMainStartTimestamp=${forbidden[1]}\nExecMainExitTimestamp=Sat 2026-99-99 99:99:99 UTC\nInvocationID=${forbidden[2]}` });
  for (const value of forbidden) assert.ok(!poisoned.stdout.includes(value), value);
  assert.equal(poisoned.result.result, "unknown");
  assert.equal(poisoned.result.exec_main_status, null);
  assert.equal(poisoned.result.exec_main_code, null);
  assert.equal(poisoned.result.started_at, null);
  assert.equal(poisoned.result.exited_at, null);
  assert.equal(poisoned.result.journal_status, "unscoped");
});

test("missing, silent and malformed evidence stays unknown without guessing a backup cause", () => {
  for (const options of [
    {}, { messages: ["Starting backup", "Finished stage"] },
    { messages: ["Failed with exit code 1"] },
    { messages: [null, [112, 114, 105, 118, 97, 116, 101], { private: "customer" }] },
    { journal: "invalid private JSON" },
    { failure: "timeout" }, { failure: "exception" }, { failure: "nonzero" },
  ]) {
    const { result } = runDiagnostic(options);
    assert.ok(result.error_counts.UNKNOWN >= 1);
    for (const name of classes.filter((name) => name !== "UNKNOWN")) assert.equal(result.error_counts[name], 0);
  }
  const { result } = runDiagnostic({ properties: properties.replace("Result=exit-code", "Result=success").replace("ExecMainStatus=1", "ExecMainStatus=0"), messages: ["offsite_backup=ok"] });
  assert.equal(result.error_counts.UNKNOWN, 0);
});

test("journal evidence and counters remain bounded", () => {
  const many = runDiagnostic({ messages: Array.from({ length: 1000 }, () => "No space left on device") }).result;
  assert.equal(many.error_counts.DISK_FULL, 200);
  assert.equal(many.journal_status, "truncated");
  const oversized = runDiagnostic({ journal: "private-secret-token".repeat(70_000) }).result;
  assert.equal(oversized.journal_status, "unavailable");
  assert.equal(oversized.error_counts.UNKNOWN, 1);
});

test("diagnostic workflow keeps the existing read-only trigger and credential scope", () => {
  assert.ok(source);
  assert.doesNotMatch(source, /\b(?:restart|reload|enable|delete|prune|copyto|unlink|rmtree)\b/);
  assert.match(workflow, /paths:\n\s+- '\.github\/workflows\/legal-controls-audit\.yml'/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.doesNotMatch(source, /\.env(?:\.production)?[\'"]|rclone\.conf|pd-backup\.key/);
});


test("retention service reports independently validated exit and time without journal access", () => {
  const result = runDiagnostic({ retention: properties.replace("Result=exit-code", "Result=success").replace("ExecMainStatus=1", "ExecMainStatus=0").replace("14:29:49", "14:29:41") });
  assert.equal(result.result.result, "exit-code");
  assert.deepEqual(result.retention, {
    result: "success", exec_main_code: 1, exec_main_status: 0,
    started_at: "2026-10-10T14:29:41+00:00", exited_at: "2026-10-10T14:29:41+00:00",
  });
  const invalid = runDiagnostic({ retention: "Result=private-secret-token\nExecMainStatus=private-secret-token\nExecMainCode=private-secret-token\nExecMainStartTimestamp=private-secret-token\nExecMainExitTimestamp=private-secret-token" });
  assert.deepEqual(invalid.retention, { result: "unknown", exec_main_code: null, exec_main_status: null, started_at: null, exited_at: null });
  assert.ok(!invalid.stdout.includes("private-secret-token"));
});

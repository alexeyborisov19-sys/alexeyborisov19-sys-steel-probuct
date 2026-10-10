import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

const gatePath = join(process.cwd(), "deploy/install-pd-retention-controls.sh");
const verifier = "/usr/local/sbin/steelprodukt-verify-offsite-recovery";
const offsite = "/usr/local/sbin/steelprodukt-pd-offsite-backup";

// Execute the real shell entry point. Only external system operations are
// intercepted: no service, backup, upload or retention process may run in tests.
function runGate(environment: Record<string, string> = {}, appPath = "/var/www/html") {
  return spawnSync("bash", ["-c", `
    set -Eeuo pipefail
    record() { printf '%s' "$1"; shift; printf ' <%s>' "$@"; printf '\\n'; }
    install() { record install "$@"; }
    systemctl() {
      record systemctl "$@"
      if [[ "$1" == is-active ]]; then
        local active=false
        shift
        for timer in "$@"; do
          case "$timer" in
            steelprodukt-pd-retention-check.timer) [[ "\${RETENTION_TIMER_STATUS:-0}" == 0 ]] && active=true ;;
            steelprodukt-pd-export-expiry.timer) [[ "\${EXPORT_TIMER_STATUS:-0}" == 0 ]] && active=true ;;
          esac
        done
        # systemctl is-active returns success if ANY requested unit is active.
        [[ "$active" == true ]] && return 0
        return 3
      fi
      if [[ "$1" == start && "$2" == steelprodukt-pd-retention-check.service ]]; then
        return "\${RETENTION_STATUS:-0}"
      fi
    }
    function /usr/bin/python3() { record verify "$@"; return "\${VERIFY_STATUS:-0}"; }
    source "$1" "$2"
  `, "gate-fixture", gatePath, appPath], {
    encoding: "utf8",
    timeout: 10_000,
    env: { ...process.env, ...environment },
  });
}

test("release verifies an existing backup before changing service configuration", () => {
  const result = runGate();
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split("\n");
  assert.equal(lines[0], `verify <${verifier}> <${offsite}> <--verify-only>`);
  assert.ok(lines.findIndex((line) => line.startsWith("install ")) > 0);
  assert.match(result.stdout, /systemctl <is-active> <steelprodukt-pd-retention-check.timer>/);
  assert.match(result.stdout, /systemctl <is-active> <steelprodukt-pd-export-expiry.timer>/);
  assert.doesNotMatch(result.stdout, /systemctl <(?:start|restart|try-restart|enable)> <steelprodukt-pd-(?:offsite-backup|export-expiry)/);
  assert.doesNotMatch(result.stdout, /<--now>|<--apply>|<--upload-existing>/);
});

for (const [reason, status] of [
  ["missing or stale backup", 1],
  ["missing or incompatible verifier", 2],
  ["hash, stream or unsupported configuration failure", 23],
] as const) {
  test(`release stops on ${reason} without starting services or changing units`, () => {
    const result = runGate({ VERIFY_STATUS: String(status) });
    assert.equal(result.status, status, result.stderr);
    assert.equal(result.stdout.trim(), `verify <${verifier}> <${offsite}> <--verify-only>`);
  });
}

for (const timerStatus of ["RETENTION_TIMER_STATUS", "EXPORT_TIMER_STATUS"]) {
  test(`release fails if ${timerStatus} is inactive while the other timer remains active`, () => {
    const result = runGate({ [timerStatus]: "3" });
    assert.equal(result.status, 3, result.stderr);
    assert.doesNotMatch(result.stdout, /systemctl <(?:start|restart|enable)>|install </);
  });
}

test("a retention warning cannot mask an earlier failed backup gate", () => {
  const result = runGate({ VERIFY_STATUS: "23", RETENTION_STATUS: "1" });
  assert.equal(result.status, 23, result.stderr);
  assert.doesNotMatch(result.stdout, /retention-check.service|needs attention/);
});

test("release rejects an unexpected application path before verification", () => {
  const result = runGate({}, "/tmp/untrusted-release");
  assert.equal(result.status, 1, result.stderr);
  assert.doesNotMatch(result.stdout, /verify <|systemctl <|install </);
});

const prepareSource = readFileSync("deploy/prepare-production.sh", "utf8");
const installStart = prepareSource.indexOf("# The scheduled off-server job");
const installEnd = prepareSource.indexOf("migrate_existing_records()", installStart);
assert.ok(installStart >= 0 && installEnd > installStart, "backup-tool installation must have a bounded test seam");
const prepareInstallBlock = prepareSource.slice(installStart, installEnd);

function prepareFixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "pd-release-install-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const app = join(root, "app release");
  const sbin = join(root, "sbin");
  mkdirSync(join(app, "deploy"), { recursive: true });
  mkdirSync(sbin);
  for (const name of ["backup-personal-data.sh", "pd-backup-files.py", "backup-personal-data-offsite.sh", "verify-offsite-recovery.py"]) {
    copyFileSync(join("deploy", name), join(app, "deploy", name));
  }
  copyFileSync("deploy/backup-personal-data-offsite.sh", join(sbin, "steelprodukt-pd-offsite-backup"));
  writeFileSync(join(sbin, "steelprodukt-verify-offsite-recovery"), "stale verifier fixture");
  const script = join(root, "prepare-install.sh");
  // Change only filesystem destinations in the extracted production block.
  // Source selection, digest guards, command order and exit behavior stay real.
  writeFileSync(script, prepareInstallBlock.replaceAll("/usr/local/sbin/", `${sbin}/`));
  return { app, sbin, script };
}

function runPreparation(fixture: ReturnType<typeof prepareFixture>) {
  return spawnSync("bash", ["-c", `
    set -euo pipefail
    APP_PATH="$1"
    install() {
      printf 'install'; printf ' <%s>' "$@"; printf '\\n'
      # Exercise actual copies/modes without requiring root in the test runner.
      local args=()
      while (($#)); do
        case "$1" in -o|-g) shift 2 ;; *) args+=("$1"); shift ;; esac
      done
      command install "\${args[@]}"
    }
    source "$2"
  `, "prepare-fixture", fixture.app, fixture.script], { encoding: "utf8", timeout: 10_000 });
}

test("preparation installs the current repository verifier with restricted root-mode contract", (t) => {
  const fixture = prepareFixture(t);
  const original = statSync(join(fixture.sbin, "steelprodukt-pd-offsite-backup"));
  const result = runPreparation(fixture);
  assert.equal(result.status, 0, result.stderr);
  const installed = join(fixture.sbin, "steelprodukt-verify-offsite-recovery");
  assert.equal(readFileSync(installed, "utf8"), readFileSync("deploy/verify-offsite-recovery.py", "utf8"));
  assert.equal(statSync(installed).mode & 0o777, 0o750);
  assert.match(result.stdout, /install <-m> <0750> <-o> <root> <-g> <root>[^\n]*verify-offsite-recovery/);
  assert.equal(statSync(join(fixture.sbin, "steelprodukt-pd-offsite-backup")).ino, original.ino);
  assert.equal(statSync(join(fixture.sbin, "steelprodukt-pd-offsite-backup")).mtimeMs, original.mtimeMs);
});

for (const target of ["canonical", "installed", "missing installed", "missing verifier"] as const) {
  test(`preparation fails closed for ${target} backup tooling`, (t) => {
    const fixture = prepareFixture(t);
    const installed = join(fixture.sbin, "steelprodukt-pd-offsite-backup");
    if (target === "canonical") writeFileSync(join(fixture.app, "deploy/backup-personal-data-offsite.sh"), "unreviewed source\n");
    if (target === "installed") writeFileSync(installed, "unrecognized installed version\n");
    if (target === "missing installed") rmSync(installed);
    if (target === "missing verifier") rmSync(join(fixture.app, "deploy/verify-offsite-recovery.py"));
    const before = existsSync(installed) ? readFileSync(installed, "utf8") : null;
    const result = runPreparation(fixture);
    assert.notEqual(result.status, 0, result.stderr);
    assert.equal(existsSync(installed) ? readFileSync(installed, "utf8") : null, before);
    assert.equal(readFileSync(join(fixture.sbin, "steelprodukt-verify-offsite-recovery"), "utf8"), "stale verifier fixture");
  });
}

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("PD backup snapshots live WAL and prunes only expired archive families", () => {
  execFileSync("python3", ["tests/pd-backup-files.py"], { timeout: 30_000, stdio: "pipe" });
});

// Exercise the production selection line only: never invoke backup, rclone,
// decryption, or retention commands against either real or synthetic data.
const offsiteSource = readFileSync("deploy/backup-personal-data-offsite.sh", "utf8");
const archiveSelection = offsiteSource.match(/^ARCHIVE=\$\(find .+$/m)?.[0];
assert.ok(archiveSelection, "offsite archive selection must be present");

function selectArchive(root: string, setup = "") {
  return spawnSync("bash", ["-c", [
    "set -Eeuo pipefail",
    setup,
    archiveSelection,
    'test -n "$ARCHIVE"',
    'printf "%s" "$ARCHIVE"',
  ].join("\n")], {
    env: { ...process.env, BACKUP_ROOT: root, LC_ALL: "C" },
    encoding: "utf8",
    timeout: 30_000,
  });
}

function writeArchive(root: string, name: string, mtime: number) {
  const path = join(root, name);
  writeFileSync(path, "synthetic encrypted archive fixture");
  utimesSync(path, mtime, mtime);
  return path;
}

test("offsite selection rejects an empty archive directory", (t) => {
  const root = mkdtempSync(join(tmpdir(), "pd offsite empty "));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = selectArchive(root);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("offsite selection preserves spaces and ignores sidecars and nested archives", (t) => {
  const root = mkdtempSync(join(tmpdir(), "pd offsite spaces "));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const expected = writeArchive(root, "steelprodukt-pd-20261010 archive with spaces.tar.gz.enc", 1_791_633_600);
  writeFileSync(`${expected}.sha256`, "synthetic checksum");
  writeFileSync(join(root, "steelprodukt-pd-20261010.json"), "{}");
  writeFileSync(join(root, "unrelated.tar.gz.enc"), "synthetic unrelated file");
  const nested = join(root, "nested");
  mkdirSync(nested);
  writeArchive(nested, "steelprodukt-pd-nested.tar.gz.enc", 1_791_720_000);
  mkdirSync(join(root, "steelprodukt-pd-directory.tar.gz.enc"));

  const result = selectArchive(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, expected);
  assert.equal(result.stderr, "");
});

test("offsite selection orders modification times numerically before archive names", (t) => {
  const root = mkdtempSync(join(tmpdir(), "pd offsite ordering "));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeArchive(root, "steelprodukt-pd-z-old.tar.gz.enc", 999_999_999);
  const expected = writeArchive(root, "steelprodukt-pd-a-new.tar.gz.enc", 1_000_000_000);

  const result = selectArchive(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, expected);
});

test("offsite selection preserves reverse lexical tie breaking for equal modification times", (t) => {
  const root = mkdtempSync(join(tmpdir(), "pd offsite tied "));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeArchive(root, "steelprodukt-pd-a.tar.gz.enc", 1_791_633_600);
  const expected = writeArchive(root, "steelprodukt-pd-z.tar.gz.enc", 1_791_633_600);

  const result = selectArchive(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, expected);
});

test("offsite selection drains a large archive listing without a broken pipe", (t) => {
  const root = mkdtempSync(join(tmpdir(), "pd offsite many "));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // Far more than a pipe buffer so an early-closing selector fails under pipefail.
  for (let index = 0; index < 20_000; index += 1) {
    writeArchive(root, `steelprodukt-pd-${index.toString().padStart(5, "0")} synthetic archive.tar.gz.enc`, 1_791_633_600 + index);
  }

  const result = selectArchive(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, join(root, "steelprodukt-pd-19999 synthetic archive.tar.gz.enc"));
  assert.equal(result.stderr, "");
});

test("offsite selection still rejects find and sort failures under pipefail", (t) => {
  const root = mkdtempSync(join(tmpdir(), "pd offsite failures "));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const missingResult = selectArchive(join(root, "missing"));
  assert.equal(missingResult.status, 1);
  assert.equal(missingResult.stdout, "");
  assert.match(missingResult.stderr, /No such file or directory/);

  writeArchive(root, "steelprodukt-pd-synthetic.tar.gz.enc", 1_791_633_600);
  // Even a sort that writes a valid selection before failing must abort the job.
  const sortResult = selectArchive(root, 'sort() { command sort "$@"; return 23; }');
  assert.equal(sortResult.status, 23, sortResult.stderr);
  assert.equal(sortResult.stdout, "");
});

import { execFileSync } from "node:child_process";
import test from "node:test";

test("PD backup snapshots live WAL and prunes only expired archive families", () => {
  execFileSync("python3", ["tests/pd-backup-files.py"], { timeout: 30_000, stdio: "pipe" });
});

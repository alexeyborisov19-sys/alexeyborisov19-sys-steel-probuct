import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const scriptUrl = new URL("../scripts/pd-reset-admin-password.ts", import.meta.url);

test("admin password reset is interactive and never accepts a password argument", async () => {
  const source = await readFile(scriptUrl, "utf8");
  assert.match(source, /createHiddenPromptSession/);
  assert.match(source, /New temporary password:/);
  assert.match(source, /Confirm temporary password:/);
  assert.match(source, /password=/i);
  assert.doesNotMatch(source, /console\.log\([^\\n]*(?:firstPassword|secondPassword|encoded)/);
});

test("admin password reset hashes password, revokes sessions and records audit event", async () => {
  const source = await readFile(scriptUrl, "utf8");
  assert.match(source, /hashPassword\(firstPassword\)/);
  assert.match(source, /revokeAllUserSessions/);
  assert.match(source, /USER_PASSWORD_RESET/);
  assert.match(source, /recordAccessEventInTransaction/);
  assert.match(source, /must_change_password = 1/);
  assert.match(source, /failed_login_count = 0/);
  assert.match(source, /locked_until = NULL/);
});

import assert from "node:assert/strict";
import { chmodSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { verifyPassword } from "@/lib/pd-admin/auth/password";
import { closePdDatabase, openPdDatabase } from "@/lib/pd-admin/db/database";
import { runCreateAdminCli, type AdminCliInput, type AdminCliOutput } from "@/scripts/pd-create-admin";
import { pdTestKey } from "./helpers/pd-test-key";

const strongPassword = "Cli-Admin-Password-2026!";

type PromptAction = {
  prompt: string;
  value?: string;
  end?: boolean;
};

function scriptedTerminal(actions: PromptAction[]) {
  const input = new PassThrough() as PassThrough & AdminCliInput;
  const rawModes: boolean[] = [];
  Object.assign(input, {
    isTTY: true,
    setRawMode(mode: boolean) {
      rawModes.push(mode);
      return input;
    },
  });

  let stdout = "";
  let stderr = "";
  let actionIndex = 0;
  const respond = () => {
    const action = actions[actionIndex];
    if (!action || !stdout.includes(action.prompt)) return;
    actionIndex += 1;
    queueMicrotask(() => {
      if (action.end) input.end();
      else input.write(action.value ?? "");
    });
  };
  const output = Object.assign(new Writable({
    write(chunk, _encoding, callback) {
      stdout += String(chunk);
      respond();
      callback();
    },
  }), { isTTY: true }) as AdminCliOutput;
  const errorOutput = new Writable({
    write(chunk, _encoding, callback) {
      stderr += String(chunk);
      callback();
    },
  });

  return {
    input,
    output,
    errorOutput,
    rawModes,
    stdout: () => stdout,
    stderr: () => stderr,
    allActionsHandled: () => actionIndex === actions.length,
  };
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "steelprodukt-pd-create-admin-"));
  chmodSync(root, 0o700);
  const databasePath = join(root, "personal-data.sqlite");
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    PD_ADMIN_ENABLED: "true",
    PD_ADMIN_DB_PATH: databasePath,
    PD_EXPORT_PATH: join(root, "exports"),
    PD_SEARCH_HMAC_KEY: pdTestKey("create-admin-search"),
    PD_SESSION_HASH_KEY: pdTestKey("create-admin-session"),
    PD_AUDIT_CHAIN_KEY: pdTestKey("create-admin-audit"),
  };
  const database = openPdDatabase({ databasePath, environment });
  closePdDatabase(database, databasePath);
  return { databasePath, environment };
}

async function runFixture(
  environment: NodeJS.ProcessEnv,
  actions: PromptAction[],
) {
  const terminal = scriptedTerminal(actions);
  const exitCode = await runCreateAdminCli({
    input: terminal.input,
    output: terminal.output,
    errorOutput: terminal.errorOutput,
    argv: ["node", "scripts/pd-create-admin.ts"],
    environment,
  });
  return { ...terminal, exitCode };
}

function userCount(databasePath: string) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  const row = database.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  database.close();
  return row.count;
}

test("first-admin CLI accepts two hidden matching passwords and uses the existing scrypt service", async () => {
  const { databasePath, environment } = fixture();
  const result = await runFixture(environment, [
    { prompt: "Username: ", value: "admin\n" },
    { prompt: "Display name: ", value: "Administrator\n" },
    { prompt: "Temporary password: ", value: `${strongPassword}\n` },
    { prompt: "Confirm temporary password: ", value: `${strongPassword}\n` },
  ]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.allActionsHandled(), true);
  assert.deepEqual(result.rawModes.slice(-2), [true, false]);
  assert.equal(result.stdout().includes(strongPassword), false);
  assert.equal(result.stderr().includes(strongPassword), false);

  const database = new DatabaseSync(databasePath, { readOnly: true });
  const user = database.prepare(`
    SELECT username, role, is_active, must_change_password, password_hash, password_algorithm
    FROM users
  `).get() as {
    username: string;
    role: string;
    is_active: number;
    must_change_password: number;
    password_hash: string;
    password_algorithm: string;
  };
  const event = database.prepare("SELECT metadata_json FROM access_events WHERE action = 'CREATE_FIRST_ADMIN'").get() as {
    metadata_json: string;
  };
  database.close();

  assert.equal(user.username, "admin");
  assert.equal(user.role, "ADMIN");
  assert.equal(user.is_active, 1);
  assert.equal(user.must_change_password, 1);
  assert.equal(user.password_algorithm, "scrypt");
  assert.equal(verifyPassword(strongPassword, user.password_hash), true);
  assert.equal(user.password_hash.includes(strongPassword), false);
  assert.equal(event.metadata_json.includes(strongPassword), false);
});

test("first-admin CLI rejects mismatched passwords without creating a user", async () => {
  const { databasePath, environment } = fixture();
  const result = await runFixture(environment, [
    { prompt: "Username: ", value: "admin\n" },
    { prompt: "Display name: ", value: "Administrator\n" },
    { prompt: "Temporary password: ", value: `${strongPassword}\n` },
    { prompt: "Confirm temporary password: ", value: "Different-Admin-Password-2026!\n" },
  ]);
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr(), /Passwords do not match/);
  assert.equal(userCount(databasePath), 0);
});

test("first-admin CLI handles EOF after the first password without creating a user", async () => {
  const { databasePath, environment } = fixture();
  const result = await runFixture(environment, [
    { prompt: "Username: ", value: "admin\n" },
    { prompt: "Display name: ", value: "Administrator\n" },
    { prompt: "Temporary password: ", value: `${strongPassword}\n` },
    { prompt: "Confirm temporary password: ", end: true },
  ]);
  assert.equal(result.exitCode, 1);
  assert.equal(userCount(databasePath), 0);
  assert.equal(result.stderr().includes(strongPassword), false);
});

test("first-admin CLI handles user interruption without creating a user", async () => {
  const { databasePath, environment } = fixture();
  const result = await runFixture(environment, [
    { prompt: "Username: ", value: "admin\n" },
    { prompt: "Display name: ", value: "Administrator\n" },
    { prompt: "Temporary password: ", value: "\u0003" },
  ]);
  assert.equal(result.exitCode, 1);
  assert.equal(userCount(databasePath), 0);
});

test("first-admin CLI rejects an empty password through the existing policy", async () => {
  const { databasePath, environment } = fixture();
  const result = await runFixture(environment, [
    { prompt: "Username: ", value: "admin\n" },
    { prompt: "Display name: ", value: "Administrator\n" },
    { prompt: "Temporary password: ", value: "\n" },
    { prompt: "Confirm temporary password: ", value: "\n" },
  ]);
  assert.equal(result.exitCode, 1);
  assert.equal(userCount(databasePath), 0);
});

test("first-admin CLI rejects a weak password through the existing policy", async () => {
  const { databasePath, environment } = fixture();
  const result = await runFixture(environment, [
    { prompt: "Username: ", value: "admin\n" },
    { prompt: "Display name: ", value: "Administrator\n" },
    { prompt: "Temporary password: ", value: "Weak1!\n" },
    { prompt: "Confirm temporary password: ", value: "Weak1!\n" },
  ]);
  assert.equal(result.exitCode, 1);
  assert.equal(userCount(databasePath), 0);
});

test("first-admin CLI refuses a duplicate username", async () => {
  const { databasePath, environment } = fixture();
  const first = await runFixture(environment, [
    { prompt: "Username: ", value: "admin\n" },
    { prompt: "Display name: ", value: "Administrator\n" },
    { prompt: "Temporary password: ", value: `${strongPassword}\n` },
    { prompt: "Confirm temporary password: ", value: `${strongPassword}\n` },
  ]);
  const second = await runFixture(environment, [
    { prompt: "Username: ", value: "ADMIN\n" },
    { prompt: "Display name: ", value: "Second Administrator\n" },
    { prompt: "Temporary password: ", value: "Another-Admin-Password-2026!\n" },
    { prompt: "Confirm temporary password: ", value: "Another-Admin-Password-2026!\n" },
  ]);
  assert.equal(first.exitCode, 0);
  assert.equal(second.exitCode, 1);
  assert.equal(userCount(databasePath), 1);
});

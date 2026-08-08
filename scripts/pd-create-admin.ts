import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { recordAccessEvent } from "@/lib/pd-admin/audit/chain";
import { hashPassword, passwordAlgorithm, passwordVersion } from "@/lib/pd-admin/auth/password";
import { hashAdministrativeFingerprint } from "@/lib/pd-admin/auth/session-store";
import { readPdAdminConfig } from "@/lib/pd-admin/config";
import { closePdDatabase, openPdDatabase } from "@/lib/pd-admin/db/database";

async function hiddenPrompt(prompt: string) {
  stdout.write(prompt);
  stdin.setRawMode?.(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  let value = "";
  try {
    for await (const chunk of stdin) {
      for (const character of String(chunk)) {
        if (character === "\r" || character === "\n") {
          stdout.write("\n");
          return value;
        }
        if (character === "\u0003") throw new Error("Input cancelled");
        if (character === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }
        value += character;
      }
    }
    throw new Error("Input stream closed");
  } finally {
    stdin.setRawMode?.(false);
    stdin.pause();
  }
}

async function main() {
  if (process.argv.some((argument) => /password/i.test(argument))) {
    console.error("Passwords must not be passed in command-line arguments.");
    process.exitCode = 1;
    return;
  }
  if (!stdin.isTTY || !stdout.isTTY) {
    console.error("First-administrator creation requires an interactive server terminal.");
    process.exitCode = 1;
    return;
  }

  const config = readPdAdminConfig();
  if (!config.enabled || !config.sessionHashKey || !config.auditChainKey) {
    console.error("PD administration must be safely configured and enabled before creating an administrator.");
    process.exitCode = 1;
    return;
  }

  try {
    const databaseMode = statSync(config.databasePath).mode & 0o777;
    const directoryMode = statSync(dirname(config.databasePath)).mode & 0o777;
    if (databaseMode !== 0o600 || directoryMode !== 0o700) throw new Error("unsafe permissions");
  } catch {
    console.error("The migrated administrative database must exist with file mode 0600 and directory mode 0700.");
    process.exitCode = 1;
    return;
  }

  const readline = createInterface({ input: stdin, output: stdout });
  const username = (await readline.question("Username: ")).normalize("NFKC").trim().toLowerCase();
  const displayName = (await readline.question("Display name: ")).normalize("NFKC").trim();
  readline.close();
  if (!/^[a-z][a-z0-9._-]{2,63}$/.test(username) || displayName.length < 2 || displayName.length > 120) {
    console.error("Username or display name is invalid.");
    process.exitCode = 1;
    return;
  }
  const firstPassword = await hiddenPrompt("Temporary password: ");
  const secondPassword = await hiddenPrompt("Confirm temporary password: ");
  if (firstPassword !== secondPassword) {
    console.error("Passwords do not match.");
    process.exitCode = 1;
    return;
  }

  let database;
  try {
    database = openPdDatabase();
    const userId = randomUUID();
    const now = new Date().toISOString();
    const encoded = hashPassword(firstPassword);
    database.prepare(`
      INSERT INTO users(
        id, username, display_name, password_hash, password_algorithm,
        password_version, role, is_active, must_change_password,
        failed_login_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'ADMIN', 1, 1, 0, ?, ?)
    `).run(userId, username, displayName, encoded, passwordAlgorithm, passwordVersion, now, now);
    recordAccessEvent(database, {
      occurredAt: now,
      userId,
      action: "CREATE_FIRST_ADMIN",
      targetType: "USER",
      targetId: userId,
      legalBasis: "INITIAL_SYSTEM_CONFIGURATION",
      result: "SUCCESS",
      ipHash: hashAdministrativeFingerprint("local-console", config.sessionHashKey, "ip"),
      metadata: { role: "ADMIN", code: "MUST_CHANGE_PASSWORD" },
    }, config.auditChainKey);
    console.info("Administrator account created. Password change is required on first login.");
  } catch {
    console.error("Administrator account was not created. No secret or account data was logged.");
    process.exitCode = 1;
  } finally {
    if (database) closePdDatabase(database, config.databasePath);
  }
}

main().catch(() => {
  console.error("Administrator account was not created. No secret or account data was logged.");
  process.exitCode = 1;
});

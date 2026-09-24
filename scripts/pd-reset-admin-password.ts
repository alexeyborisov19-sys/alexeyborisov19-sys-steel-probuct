import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { stdin, stderr, stdout } from "node:process";
import type { Readable, Writable } from "node:stream";
import { hashPassword, passwordAlgorithm, passwordVersion } from "@/lib/pd-admin/auth/password";
import { hashAdministrativeFingerprint, revokeAllUserSessions } from "@/lib/pd-admin/auth/session-store";
import { recordAccessEventInTransaction } from "@/lib/pd-admin/audit/chain";
import { readPdAdminConfig } from "@/lib/pd-admin/config";
import { closePdDatabase, migrationStatus, openPdDatabase } from "@/lib/pd-admin/db/database";
import { createHiddenPromptSession } from "@/scripts/pd-create-admin";

type CliInput = Readable & {
  isTTY?: boolean;
  setRawMode?: (mode: boolean) => unknown;
};

type CliOutput = Writable & {
  isTTY?: boolean;
};

export type ResetAdminOptions = {
  input?: CliInput;
  output?: CliOutput;
  errorOutput?: Writable;
  argv?: string[];
  environment?: NodeJS.ProcessEnv;
};

function line(output: Writable, message: string) {
  output.write(message + "\n");
}

export async function runResetAdminPassword(options: ResetAdminOptions = {}) {
  const input = options.input ?? stdin;
  const output = options.output ?? stdout;
  const errorOutput = options.errorOutput ?? stderr;
  const argv = options.argv ?? process.argv;
  const environment = options.environment ?? process.env;

  if (!input.isTTY || !output.isTTY) {
    line(errorOutput, "Password reset requires an interactive server terminal.");
    return 1;
  }
  if (argv.some((argument) => /password=/i.test(argument))) {
    line(errorOutput, "Passwords must not be passed in command-line arguments.");
    return 1;
  }

  const username = String(argv[2] || "admin").normalize("NFKC").trim().toLowerCase();
  if (!/^[a-z][a-z0-9._-]{2,63}$/.test(username)) {
    line(errorOutput, "Invalid administrative username.");
    return 1;
  }

  let config;
  try {
    config = readPdAdminConfig(environment, { production: environment.NODE_ENV === "production" });
  } catch {
    line(errorOutput, "PD administration configuration is invalid.");
    return 1;
  }

  if (!config.enabled || !config.sessionHashKey || !config.auditChainKey) {
    line(errorOutput, "PD administration must be enabled and securely configured.");
    return 1;
  }

  try {
    const databaseMode = statSync(config.databasePath).mode & 0o777;
    const directoryMode = statSync(dirname(config.databasePath)).mode & 0o777;
    if (databaseMode !== 0o600 || directoryMode !== 0o700) throw new Error("unsafe permissions");
  } catch {
    line(errorOutput, "Administrative database permissions are unsafe.");
    return 1;
  }

  let firstPassword = "";
  let secondPassword = "";
  const hiddenInput = createHiddenPromptSession(input, output);
  try {
    firstPassword = await hiddenInput.read("New temporary password: ");
    secondPassword = await hiddenInput.read("Confirm temporary password: ");
  } catch {
    line(errorOutput, "Password reset cancelled.");
    return 1;
  } finally {
    hiddenInput.close();
  }

  if (firstPassword !== secondPassword) {
    line(errorOutput, "Passwords do not match.");
    return 1;
  }

  let database;
  try {
    database = openPdDatabase({
      applyMigrations: false,
      databasePath: config.databasePath,
      environment,
    });
    if (migrationStatus(database).some((migration) => migration.state === "pending")) {
      throw new Error("PD schema migration is pending");
    }

    const user = database.prepare(
      "SELECT id, role, is_active FROM users WHERE username = ?"
    ).get(username) as { id: string; role: string; is_active: number } | undefined;

    if (!user || user.is_active !== 1) {
      line(errorOutput, "Active administrator account was not found.");
      return 1;
    }

    const encoded = hashPassword(firstPassword);
    const now = new Date();
    const ipHash = hashAdministrativeFingerprint("local-console", config.sessionHashKey, "ip");

    database.exec("BEGIN IMMEDIATE");
    try {
      database.prepare(
        "UPDATE users SET password_hash = ?, password_algorithm = ?, password_version = ?, " +
        "must_change_password = 1, password_changed_at = ?, failed_login_count = 0, " +
        "locked_until = NULL, updated_at = ? WHERE id = ?"
      ).run(
        encoded,
        passwordAlgorithm,
        passwordVersion,
        now.toISOString(),
        now.toISOString(),
        user.id,
      );

      revokeAllUserSessions(database, user.id, "PASSWORD_RESET_LOCAL_CONSOLE", now);

      recordAccessEventInTransaction(database, {
        occurredAt: now.toISOString(),
        userId: user.id,
        action: "USER_PASSWORD_RESET",
        targetType: "USER",
        targetId: user.id,
        legalBasis: "ADMINISTRATIVE_ACCESS_CONTROL",
        result: "SUCCESS",
        ipHash,
        metadata: {
          role: user.role,
          code: "MUST_CHANGE_PASSWORD",
          method: "LOCAL_CONSOLE",
        },
      }, config.auditChainKey);

      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }

    line(output, "Temporary password reset successfully. Password change is required on next login.");
    return 0;
  } catch {
    line(errorOutput, "Administrator password was not reset.");
    return 1;
  } finally {
    if (database) closePdDatabase(database, config.databasePath);
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  runResetAdminPassword()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch(() => {
      line(stderr, "Administrator password was not reset.");
      process.exitCode = 1;
    });
}

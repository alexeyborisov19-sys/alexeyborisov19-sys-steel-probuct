import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stderr, stdout } from "node:process";
import type { Readable, Writable } from "node:stream";
import { pathToFileURL } from "node:url";
import { recordAccessEvent } from "@/lib/pd-admin/audit/chain";
import { hashPassword, passwordAlgorithm, passwordVersion } from "@/lib/pd-admin/auth/password";
import { hashAdministrativeFingerprint } from "@/lib/pd-admin/auth/session-store";
import { readPdAdminConfig } from "@/lib/pd-admin/config";
import { closePdDatabase, migrationStatus, openPdDatabase } from "@/lib/pd-admin/db/database";

export type AdminCliInput = Readable & {
  isTTY?: boolean;
  setRawMode?: (mode: boolean) => unknown;
};

export type AdminCliOutput = Writable & {
  isTTY?: boolean;
};

type HiddenPromptSession = {
  read(prompt: string): Promise<string>;
  close(): void;
};

type ActivePrompt = {
  value: string;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
};

export type RunCreateAdminCliOptions = {
  input?: AdminCliInput;
  output?: AdminCliOutput;
  errorOutput?: Writable;
  argv?: string[];
  environment?: NodeJS.ProcessEnv;
};

function writeLine(output: Writable, message: string) {
  output.write(`${message}\n`);
}

export function createHiddenPromptSession(
  input: AdminCliInput,
  output: AdminCliOutput,
): HiddenPromptSession {
  let active: ActivePrompt | null = null;
  let buffer = "";
  let ended = false;
  let closed = false;
  let rawModeEnabled = false;

  const finish = (result: { value: string } | { error: Error }) => {
    const current = active;
    active = null;
    if (!current) return;
    if ("error" in result) current.reject(result.error);
    else current.resolve(result.value);
  };

  const drain = () => {
    while (active && buffer.length > 0) {
      const character = buffer[0];
      buffer = buffer.slice(1);
      if (character === "\u0003" || character === "\u0004") {
        output.write("\n");
        finish({ error: new Error("Input cancelled") });
        return;
      }
      if (character === "\r" || character === "\n") {
        if (character === "\r" && buffer.startsWith("\n")) buffer = buffer.slice(1);
        const value = active.value;
        output.write("\n");
        finish({ value });
        continue;
      }
      if (character === "\u007f" || character === "\b") {
        active.value = active.value.slice(0, -1);
        continue;
      }
      active.value += character;
    }
    if (active && ended) finish({ error: new Error("Input stream closed") });
  };

  const onData = (chunk: string | Buffer) => {
    buffer += String(chunk);
    drain();
  };
  const onEnd = () => {
    ended = true;
    drain();
  };
  const onError = () => finish({ error: new Error("Input stream failed") });

  input.setEncoding("utf8");
  input.on("data", onData);
  input.once("end", onEnd);
  input.once("error", onError);

  return {
    read(prompt: string) {
      if (closed) return Promise.reject(new Error("Input session is closed"));
      if (active) return Promise.reject(new Error("Another password prompt is active"));
      output.write(prompt);
      if (!rawModeEnabled) {
        input.setRawMode?.(true);
        rawModeEnabled = true;
      }
      input.resume();
      return new Promise<string>((resolvePrompt, rejectPrompt) => {
        active = { value: "", resolve: resolvePrompt, reject: rejectPrompt };
        drain();
      });
    },
    close() {
      if (closed) return;
      closed = true;
      input.off("data", onData);
      input.off("end", onEnd);
      input.off("error", onError);
      if (active) finish({ error: new Error("Input session closed") });
      if (rawModeEnabled) input.setRawMode?.(false);
      input.pause();
    },
  };
}

export async function runCreateAdminCli(options: RunCreateAdminCliOptions = {}) {
  const input = options.input ?? stdin;
  const output = options.output ?? stdout;
  const errorOutput = options.errorOutput ?? stderr;
  const argv = options.argv ?? process.argv;
  const environment = options.environment ?? process.env;

  if (argv.some((argument) => /password/i.test(argument))) {
    writeLine(errorOutput, "Passwords must not be passed in command-line arguments.");
    return 1;
  }
  if (!input.isTTY || !output.isTTY) {
    writeLine(errorOutput, "First-administrator creation requires an interactive server terminal.");
    return 1;
  }

  let config;
  try {
    config = readPdAdminConfig(environment);
  } catch {
    writeLine(errorOutput, "PD administration is not safely configured for administrator creation.");
    return 1;
  }
  if (!config.enabled || !config.sessionHashKey || !config.auditChainKey) {
    writeLine(errorOutput, "PD administration must be safely configured and enabled before creating an administrator.");
    return 1;
  }

  try {
    const databaseMode = statSync(config.databasePath).mode & 0o777;
    const directoryMode = statSync(dirname(config.databasePath)).mode & 0o777;
    if (databaseMode !== 0o600 || directoryMode !== 0o700) throw new Error("unsafe permissions");
  } catch {
    writeLine(errorOutput, "The migrated administrative database must exist with file mode 0600 and directory mode 0700.");
    return 1;
  }

  let username: string;
  let displayName: string;
  const readline = createInterface({ input, output });
  try {
    username = (await readline.question("Username: ")).normalize("NFKC").trim().toLowerCase();
    displayName = (await readline.question("Display name: ")).normalize("NFKC").trim();
  } catch {
    writeLine(errorOutput, "Administrator account was not created. No secret or account data was logged.");
    return 1;
  } finally {
    readline.close();
  }
  if (!/^[a-z][a-z0-9._-]{2,63}$/.test(username) || displayName.length < 2 || displayName.length > 120) {
    writeLine(errorOutput, "Username or display name is invalid.");
    return 1;
  }

  let firstPassword: string;
  let secondPassword: string;
  const hiddenInput = createHiddenPromptSession(input, output);
  try {
    firstPassword = await hiddenInput.read("Temporary password: ");
    secondPassword = await hiddenInput.read("Confirm temporary password: ");
  } catch {
    writeLine(errorOutput, "Administrator account was not created. No secret or account data was logged.");
    return 1;
  } finally {
    hiddenInput.close();
  }
  if (firstPassword !== secondPassword) {
    writeLine(errorOutput, "Passwords do not match.");
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
    writeLine(output, "Administrator account created. Password change is required on first login.");
    return 0;
  } catch {
    writeLine(errorOutput, "Administrator account was not created. No secret or account data was logged.");
    return 1;
  } finally {
    if (database) closePdDatabase(database, config.databasePath);
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  runCreateAdminCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch(() => {
      writeLine(stderr, "Administrator account was not created. No secret or account data was logged.");
      process.exitCode = 1;
    });
}

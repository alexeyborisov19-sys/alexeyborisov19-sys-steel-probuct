import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isPrivatePath, readPdAdminConfig } from "@/lib/pd-admin/config";

const MIGRATION_PATTERN = /^(\d{4})_([a-z\d_-]+)\.sql$/;
const DEFAULT_MIGRATIONS_PATH = resolve(process.cwd(), "db/personal-data/migrations");

export type MigrationStatus = {
  version: number;
  name: string;
  checksum: string;
  appliedAt: string | null;
  state: "applied" | "pending";
};

export type OpenPdDatabaseOptions = {
  databasePath?: string;
  migrationsPath?: string;
  applyMigrations?: boolean;
  requireEnabled?: boolean;
  environment?: NodeJS.ProcessEnv;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function assertProtectedNode(path: string, kind: "directory" | "file") {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error(`PD ${kind} must not be a symbolic link`);
  if (kind === "directory" && !stat.isDirectory()) throw new Error("PD database parent is not a directory");
  if (kind === "file" && !stat.isFile()) throw new Error("PD database path is not a regular file");
}

function prepareDatabasePath(databasePath: string) {
  if (!isPrivatePath(databasePath)) throw new Error("PD database must be outside public and .next");
  const parent = dirname(databasePath);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  assertProtectedNode(parent, "directory");
  chmodSync(parent, 0o700);
  if (existsSync(databasePath)) assertProtectedNode(databasePath, "file");
}

function protectSqliteFiles(databasePath: string) {
  for (const path of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    if (!existsSync(path)) continue;
    assertProtectedNode(path, "file");
    chmodSync(path, 0o600);
  }
}

function ensureMigrationJournal(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT
  `);
}

function loadMigrations(migrationsPath: string) {
  const migrations = readdirSync(migrationsPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && MIGRATION_PATTERN.test(entry.name))
    .map((entry) => {
      const match = entry.name.match(MIGRATION_PATTERN);
      if (!match) throw new Error("Invalid migration filename");
      const sql = readFileSync(join(migrationsPath, entry.name), "utf8");
      return {
        version: Number(match[1]),
        name: match[2],
        checksum: sha256(sql),
        sql,
      };
    })
    .sort((left, right) => left.version - right.version);

  const versions = new Set<number>();
  for (const migration of migrations) {
    if (versions.has(migration.version)) throw new Error(`Duplicate migration version ${migration.version}`);
    versions.add(migration.version);
  }
  return migrations;
}

export function migrationStatus(database: DatabaseSync, migrationsPath = DEFAULT_MIGRATIONS_PATH) {
  ensureMigrationJournal(database);
  const applied = new Map(
    (database.prepare("SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version").all() as Array<{
      version: number;
      name: string;
      checksum: string;
      applied_at: string;
    }>).map((row) => [row.version, row]),
  );

  return loadMigrations(migrationsPath).map<MigrationStatus>((migration) => {
    const existing = applied.get(migration.version);
    if (existing && (existing.name !== migration.name || existing.checksum !== migration.checksum)) {
      throw new Error(`Applied migration ${migration.version} does not match the repository checksum`);
    }
    return {
      version: migration.version,
      name: migration.name,
      checksum: migration.checksum,
      appliedAt: existing?.applied_at ?? null,
      state: existing ? "applied" : "pending",
    };
  });
}

export function applyPdMigrations(database: DatabaseSync, migrationsPath = DEFAULT_MIGRATIONS_PATH) {
  ensureMigrationJournal(database);
  const statuses = migrationStatus(database, migrationsPath);
  const migrations = loadMigrations(migrationsPath);
  const pending = new Set(statuses.filter((status) => status.state === "pending").map((status) => status.version));
  const insert = database.prepare(
    "INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
  );

  for (const migration of migrations) {
    if (!pending.has(migration.version)) continue;
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(migration.sql);
      insert.run(migration.version, migration.name, migration.checksum, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  return migrationStatus(database, migrationsPath);
}

export function openPdDatabase(options: OpenPdDatabaseOptions = {}) {
  const environment = options.environment ?? process.env;
  const config = readPdAdminConfig(environment, {
    production: environment.NODE_ENV === "production",
  });
  if (options.requireEnabled !== false && !config.enabled) {
    throw new Error("PD administration is disabled");
  }
  const databasePath = options.databasePath ?? config.databasePath;
  const migrationsPath = options.migrationsPath ?? DEFAULT_MIGRATIONS_PATH;
  prepareDatabasePath(databasePath);

  const previousUmask = process.umask(0o077);
  let database: DatabaseSync;
  try {
    database = new DatabaseSync(databasePath);
    database.exec("PRAGMA foreign_keys = ON");
    database.exec("PRAGMA busy_timeout = 5000");
    database.exec("PRAGMA journal_mode = WAL");
    database.exec("PRAGMA synchronous = FULL");
    protectSqliteFiles(databasePath);
  } finally {
    process.umask(previousUmask);
  }

  if (options.applyMigrations !== false) applyPdMigrations(database, migrationsPath);
  return database;
}

export function closePdDatabase(database: DatabaseSync, databasePath?: string) {
  database.close();
  if (databasePath) protectSqliteFiles(databasePath);
}

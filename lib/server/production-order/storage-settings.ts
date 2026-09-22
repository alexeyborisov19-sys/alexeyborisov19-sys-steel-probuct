import { constants, readFileSync } from "node:fs";
import { chmod, mkdir, open, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

export type ProductionOrderStorageSource = "saved" | "environment" | "unset";

export type ProductionOrderStorageSettings = {
  schemaVersion: "1";
  ordersRoot: string | null;
  updatedAt: string | null;
  updatedByUserId: string | null;
  updatedByDisplayName: string | null;
};

export type ProductionOrderStorageSnapshot = ProductionOrderStorageSettings & {
  source: ProductionOrderStorageSource;
};

export type ProductionOrderStorageActor = {
  userId: string;
  displayName: string;
};

const SETTINGS_FILE_NAME = "production-order-storage.json";

function environmentValue(environment: Readonly<Record<string, string | undefined>>, key: string) {
  const value = environment[key]?.trim();
  return value || null;
}

function assertOutsidePublic(value: string) {
  const resolved = path.resolve(value);
  const publicRoot = path.resolve(process.cwd(), "public");
  if (resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("Папка заказов не может находиться внутри public/.");
  }
  return resolved;
}

function settingsDirectory(environment: Readonly<Record<string, string | undefined>>) {
  const configured = environmentValue(environment, "STEEL_PRODUCT_PRIVATE_SETTINGS_ROOT");
  return assertOutsidePublic(configured ? path.resolve(configured) : path.join(os.homedir(), ".steelprodukt"));
}

export function productionOrderSettingsFile(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  return path.join(settingsDirectory(environment), SETTINGS_FILE_NAME);
}

function emptySettings(): ProductionOrderStorageSettings {
  return {
    schemaVersion: "1",
    ordersRoot: null,
    updatedAt: null,
    updatedByUserId: null,
    updatedByDisplayName: null,
  };
}

function parseSettings(value: unknown): ProductionOrderStorageSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<ProductionOrderStorageSettings>;
  if (candidate.schemaVersion !== "1") return null;
  if (candidate.ordersRoot !== null && typeof candidate.ordersRoot !== "string") return null;
  if (candidate.updatedAt !== null && typeof candidate.updatedAt !== "string") return null;
  if (candidate.updatedByUserId !== null && typeof candidate.updatedByUserId !== "string") return null;
  if (candidate.updatedByDisplayName !== null && typeof candidate.updatedByDisplayName !== "string") return null;
  return {
    schemaVersion: "1",
    ordersRoot: candidate.ordersRoot?.trim() || null,
    updatedAt: candidate.updatedAt ?? null,
    updatedByUserId: candidate.updatedByUserId ?? null,
    updatedByDisplayName: candidate.updatedByDisplayName ?? null,
  };
}

function parseSettingsText(raw: string) {
  try {
    return parseSettings(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function readProductionOrderStorageSettings(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<ProductionOrderStorageSnapshot> {
  try {
    const saved = parseSettingsText(await readFile(productionOrderSettingsFile(environment), "utf8"));
    if (saved?.ordersRoot) return { ...saved, source: "saved" };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }

  const fromEnvironment = environmentValue(environment, "STEEL_PRODUCT_ORDER_ROOT");
  if (fromEnvironment) {
    return {
      ...emptySettings(),
      ordersRoot: path.resolve(fromEnvironment),
      source: "environment",
    };
  }
  return { ...emptySettings(), source: "unset" };
}

/**
 * Synchronous resolver used by the package planner. The saved value wins; the
 * environment variable remains a deployment fallback.
 */
export function loadConfiguredOrderStorageRootSync(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  try {
    const saved = parseSettingsText(readFileSync(productionOrderSettingsFile(environment), "utf8"));
    if (saved?.ordersRoot) return assertOutsidePublic(saved.ordersRoot);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }

  const fromEnvironment = environmentValue(environment, "STEEL_PRODUCT_ORDER_ROOT");
  if (!fromEnvironment) throw new Error("Путь для папок заказов не настроен.");
  return assertOutsidePublic(fromEnvironment);
}

export function normalizeProductionOrderRoot(value: string) {
  const trimmed = value.normalize("NFKC").trim();
  if (!trimmed || trimmed.includes("\u0000")) throw new Error("Укажите путь к папке заказов.");
  if (!path.isAbsolute(trimmed)) throw new Error("Укажите абсолютный путь к папке заказов.");
  return assertOutsidePublic(trimmed);
}

export async function verifyProductionOrderRootWritable(value: string) {
  const normalized = normalizeProductionOrderRoot(value);
  const info = await stat(normalized).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") throw new Error("Указанная папка не найдена.");
    throw error;
  });
  if (!info.isDirectory()) throw new Error("Указанный путь не является папкой.");

  const root = assertOutsidePublic(await realpath(normalized));
  const probePath = path.join(root, `.steelprodukt-write-test-${randomUUID()}.tmp`);
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    handle = await open(probePath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    await handle.writeFile("write-test", "utf8");
  } catch {
    throw new Error("Нет прав на запись в выбранную папку.");
  } finally {
    await handle?.close().catch(() => undefined);
    await unlink(probePath).catch(() => undefined);
  }
  return root;
}

async function replaceSettingsFile(temporary: string, target: string) {
  try {
    await rename(temporary, target);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST" && code !== "EPERM" && code !== "ENOTEMPTY") throw error;
    await unlink(target).catch((unlinkError: NodeJS.ErrnoException) => {
      if (unlinkError.code !== "ENOENT") throw unlinkError;
    });
    await rename(temporary, target);
  }
}

export async function saveProductionOrderStorageSettings(input: {
  ordersRoot: string;
  actor: ProductionOrderStorageActor;
  environment?: Readonly<Record<string, string | undefined>>;
  now?: Date;
}) {
  const environment = input.environment ?? process.env;
  const ordersRoot = await verifyProductionOrderRootWritable(input.ordersRoot);
  const directory = settingsDirectory(environment);
  const target = productionOrderSettingsFile(environment);
  const temporary = `${target}.${randomUUID()}.tmp`;
  const settings: ProductionOrderStorageSettings = {
    schemaVersion: "1",
    ordersRoot,
    updatedAt: (input.now ?? new Date()).toISOString(),
    updatedByUserId: input.actor.userId,
    updatedByDisplayName: input.actor.displayName,
  };

  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700).catch(() => undefined);
  let committed = false;
  try {
    await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await chmod(temporary, 0o600).catch(() => undefined);
    await replaceSettingsFile(temporary, target);
    committed = true;
    await chmod(target, 0o600).catch(() => undefined);
  } finally {
    if (!committed) await unlink(temporary).catch(() => undefined);
  }
  return { ...settings, source: "saved" as const };
}

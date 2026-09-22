import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProductionOrder } from "@/lib/production-order/domain";
import { parseProductionOrder } from "@/lib/production-order/parse-production-order";
import {
  planProductionOrderPackage,
  productionOrderRevisionDirectory,
  type ProductionOrderPackagePlan,
} from "@/lib/server/production-order/storage";

export class ProductionOrderPackageConflictError extends Error {
  constructor(message = "Папка с таким номером КП уже занята другим заказом.") {
    super(message);
    this.name = "ProductionOrderPackageConflictError";
  }
}

export type ProductionOrderPackageResult = {
  created: boolean;
  changed: boolean;
  revision: number;
  revisionDirectory: string;
  revisionManifestPath: string;
  plan: ProductionOrderPackagePlan;
};

async function existingManifest(plan: ProductionOrderPackagePlan) {
  try {
    return parseProductionOrder(JSON.parse(await readFile(plan.manifestPath, "utf8")) as unknown);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

async function existingDirectoryState(plan: ProductionOrderPackagePlan) {
  try {
    const info = await stat(plan.orderDirectory);
    if (!info.isDirectory()) throw new ProductionOrderPackageConflictError("Путь заказа уже занят файлом.");
    return { exists: true, entries: await readdir(plan.orderDirectory) };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { exists: false, entries: [] as string[] };
    throw error;
  }
}

function canonical(value: ProductionOrder) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function replaceFile(temporary: string, target: string) {
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

async function atomicWrite(target: string, content: string) {
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  let committed = false;
  try {
    await writeFile(temporary, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await replaceFile(temporary, target);
    committed = true;
  } finally {
    if (!committed) await unlink(temporary).catch(() => undefined);
  }
}

async function latestRevision(plan: ProductionOrderPackagePlan) {
  try {
    const entries = await readdir(plan.revisionsDirectory, { withFileTypes: true });
    let latest = 0;
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^\d{4}$/.test(entry.name)) continue;
      latest = Math.max(latest, Number(entry.name));
    }
    return latest;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return 0;
    throw error;
  }
}

/**
 * Creates the order directory only once. A repeated request for the same
 * orderId updates the manifest in place and adds a numbered revision only when
 * data really changed. A different orderId using the same folder name is
 * rejected instead of silently overwriting another order.
 */
export async function createOrUpdateProductionOrderPackage(
  order: ProductionOrder,
  root?: string,
): Promise<ProductionOrderPackageResult> {
  const plan = planProductionOrderPackage(order, root);
  const [before, directoryState, currentRevision] = await Promise.all([
    existingManifest(plan),
    existingDirectoryState(plan),
    latestRevision(plan),
  ]);
  if (before && before.orderId !== order.orderId) throw new ProductionOrderPackageConflictError();
  if (!before && directoryState.exists && directoryState.entries.length > 0) {
    throw new ProductionOrderPackageConflictError("Папка уже существует и содержит файлы, но не принадлежит этому заказу.");
  }

  await mkdir(plan.orderDirectory, { recursive: true, mode: 0o700 });
  for (const directory of Object.values(plan.artifactDirectories)) {
    if (directory) await mkdir(directory, { recursive: true, mode: 0o700 });
  }

  const next = canonical(order);
  const previous = before ? canonical(before) : null;
  const changed = previous !== next;
  const revision = changed ? currentRevision + 1 : Math.max(1, currentRevision);
  const revisionDirectory = productionOrderRevisionDirectory(plan, revision);
  const revisionManifestPath = path.join(revisionDirectory, "order-manifest.json");

  if (changed) {
    await mkdir(revisionDirectory, { recursive: true, mode: 0o700 });
    await atomicWrite(revisionManifestPath, next);
    await atomicWrite(plan.manifestPath, next);
  } else if (currentRevision === 0) {
    await mkdir(revisionDirectory, { recursive: true, mode: 0o700 });
    await atomicWrite(revisionManifestPath, next);
  }

  const folderInfo = await stat(plan.orderDirectory);
  if (!folderInfo.isDirectory()) throw new Error("Не удалось создать папку заказа.");

  return {
    created: before === null,
    changed,
    revision,
    revisionDirectory,
    revisionManifestPath,
    plan,
  };
}

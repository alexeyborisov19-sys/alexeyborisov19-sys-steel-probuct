import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProductionOrder } from "@/lib/production-order/domain";
import { parseProductionOrder } from "@/lib/production-order/parse-production-order";
import { planProductionOrderPackage, type ProductionOrderPackagePlan } from "@/lib/server/production-order/storage";

export class ProductionOrderPackageConflictError extends Error {
  constructor(message = "Папка с таким номером КП уже занята другим заказом.") {
    super(message);
    this.name = "ProductionOrderPackageConflictError";
  }
}

export type ProductionOrderPackageResult = {
  created: boolean;
  changed: boolean;
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

function canonical(value: ProductionOrder) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function atomicWrite(target: string, content: string) {
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
  try {
    await import("node:fs/promises").then(({ rename }) => rename(temporary, target));
  } catch (error) {
    await import("node:fs/promises").then(({ unlink }) => unlink(temporary).catch(() => undefined));
    throw error;
  }
}

/**
 * Creates the order directory only once. A repeated request for the same
 * orderId updates the manifest in place; a different orderId using the same
 * folder name is rejected instead of silently overwriting another order.
 */
export async function createOrUpdateProductionOrderPackage(
  order: ProductionOrder,
  root?: string,
): Promise<ProductionOrderPackageResult> {
  const plan = planProductionOrderPackage(order, root);
  const before = await existingManifest(plan);
  if (before && before.orderId !== order.orderId) throw new ProductionOrderPackageConflictError();

  await mkdir(plan.orderDirectory, { recursive: true, mode: 0o700 });
  for (const directory of Object.values(plan.artifactDirectories)) {
    if (directory) await mkdir(directory, { recursive: true, mode: 0o700 });
  }

  const next = canonical(order);
  const previous = before ? canonical(before) : null;
  const changed = previous !== next;
  if (changed) await atomicWrite(plan.manifestPath, next);

  const folderInfo = await stat(plan.orderDirectory);
  if (!folderInfo.isDirectory()) throw new Error("Не удалось создать папку заказа.");

  return {
    created: before === null,
    changed,
    plan,
  };
}

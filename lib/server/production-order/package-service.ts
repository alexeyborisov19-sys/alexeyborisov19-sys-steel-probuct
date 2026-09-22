import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
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

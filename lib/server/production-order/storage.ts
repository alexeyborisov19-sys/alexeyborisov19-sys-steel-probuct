import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProductionOrder, ProductionOrderArtifactKind } from "@/lib/production-order/domain";
import { loadConfiguredOrderStorageRootSync } from "@/lib/server/production-order/storage-settings";

export type ProductionOrderPackagePlan = {
  root: string;
  orderDirectory: string;
  quotePdfPath: string;
  productionOrderPdfPath: string;
  manifestPath: string;
  journalPath: string;
  revisionsDirectory: string;
  artifactDirectories: Partial<Record<ProductionOrderArtifactKind, string>>;
};

export type ServerArtifactSource = {
  artifactId: string;
  sourcePath: string;
};

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export function safeWindowsPathSegment(value: string, max = 120) {
  let cleaned = value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, max)
    .replace(/[. ]+$/g, "");
  if (!cleaned) cleaned = "Без названия";
  if (WINDOWS_RESERVED.test(cleaned)) cleaned = `_${cleaned}`;
  return cleaned;
}

export function buildOrderFolderName(quoteNumber: string, quoteTitle: string) {
  return safeWindowsPathSegment(`${quoteNumber} ${quoteTitle}`, 160);
}

function assertPrivateRoot(root: string) {
  const resolved = path.resolve(root);
  const publicRoot = path.resolve(process.cwd(), "public");
  if (resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("Order package root must not be inside public/");
  }
  return resolved;
}

function resolveInside(root: string, ...segments: string[]) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);
  const relative = path.relative(resolvedRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Unsafe order package path");
  return target;
}

function artifactFolderName(kind: ProductionOrderArtifactKind) {
  if (kind === "cad") return "CAD";
  if (kind === "drawing") return "Чертежи";
  return "Вложения";
}

/** Saved UI settings win; STEEL_PRODUCT_ORDER_ROOT remains a deployment fallback. */
export function loadOrderStorageRoot(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  return assertPrivateRoot(loadConfiguredOrderStorageRootSync(environment));
}

export function planProductionOrderPackage(order: ProductionOrder, root = loadOrderStorageRoot()): ProductionOrderPackagePlan {
  const safeRoot = assertPrivateRoot(root);
  const orderDirectory = resolveInside(safeRoot, buildOrderFolderName(order.quoteNumber, order.quoteTitle));
  const artifactDirectories: ProductionOrderPackagePlan["artifactDirectories"] = {};
  for (const kind of new Set(order.artifacts.map((artifact) => artifact.kind))) {
    artifactDirectories[kind] = resolveInside(orderDirectory, artifactFolderName(kind));
  }

  return {
    root: safeRoot,
    orderDirectory,
    quotePdfPath: resolveInside(orderDirectory, safeWindowsPathSegment(`КП ${order.quoteNumber}.pdf`, 180)),
    productionOrderPdfPath: resolveInside(orderDirectory, safeWindowsPathSegment(`Заявка в производство ${order.quoteNumber}.pdf`, 180)),
    manifestPath: resolveInside(orderDirectory, "order-manifest.json"),
    journalPath: resolveInside(orderDirectory, "order-journal.jsonl"),
    revisionsDirectory: resolveInside(orderDirectory, "Ревизии"),
    artifactDirectories,
  };
}

export function productionOrderRevisionDirectory(plan: ProductionOrderPackagePlan, revision: number) {
  if (!Number.isSafeInteger(revision) || revision < 1 || revision > 9999) throw new Error("Invalid order revision");
  return resolveInside(plan.revisionsDirectory, String(revision).padStart(4, "0"));
}

export async function prepareProductionOrderPackage(order: ProductionOrder, root?: string) {
  const plan = planProductionOrderPackage(order, root);
  await mkdir(plan.orderDirectory, { recursive: true, mode: 0o700 });
  for (const directory of Object.values(plan.artifactDirectories)) {
    if (directory) await mkdir(directory, { recursive: true, mode: 0o700 });
  }
  await writeFile(plan.manifestPath, `${JSON.stringify(order, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return plan;
}

function uniqueFileName(fileName: string, used: Set<string>) {
  const safe = safeWindowsPathSegment(path.basename(fileName), 180);
  if (!used.has(safe.toLocaleLowerCase("ru"))) {
    used.add(safe.toLocaleLowerCase("ru"));
    return safe;
  }
  const ext = path.extname(safe);
  const base = ext ? safe.slice(0, -ext.length) : safe;
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base} (${index})${ext}`;
    const key = candidate.toLocaleLowerCase("ru");
    if (!used.has(key)) {
      used.add(key);
      return candidate;
    }
  }
  throw new Error("Unable to allocate unique artifact filename");
}

export async function copyProductionOrderArtifacts(
  order: ProductionOrder,
  plan: ProductionOrderPackagePlan,
  sources: readonly ServerArtifactSource[],
) {
  const byId = new Map(sources.map((source) => [source.artifactId, source.sourcePath]));
  const usedByKind = new Map<ProductionOrderArtifactKind, Set<string>>();
  const copied: Array<{ artifactId: string; destinationPath: string }> = [];

  for (const artifact of order.artifacts) {
    const sourcePath = byId.get(artifact.id);
    if (!sourcePath) throw new Error(`Missing server source for artifact ${artifact.id}`);
    const sourceStat = await stat(sourcePath);
    if (!sourceStat.isFile()) throw new Error(`Artifact source is not a file: ${artifact.id}`);

    const directory = plan.artifactDirectories[artifact.kind];
    if (!directory) throw new Error(`Artifact directory is missing for ${artifact.kind}`);
    const used = usedByKind.get(artifact.kind) ?? new Set<string>();
    usedByKind.set(artifact.kind, used);

    const destinationPath = resolveInside(directory, uniqueFileName(artifact.fileName, used));
    await copyFile(sourcePath, destinationPath);
    copied.push({ artifactId: artifact.id, destinationPath });
  }

  return copied;
}

export async function writeGeneratedOrderDocument(targetPath: string, content: Uint8Array) {
  const parent = path.dirname(targetPath);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  await writeFile(targetPath, content, { mode: 0o600 });
  return targetPath;
}

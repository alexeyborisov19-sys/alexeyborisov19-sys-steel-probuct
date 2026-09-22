import { stat } from "node:fs/promises";
import path from "node:path";
import type { ProductionOrder } from "@/lib/production-order/domain";
import type { ServerArtifactSource } from "@/lib/server/production-order/storage";

const REQUEST_ID = /^CALC-[A-F0-9]{8}-[A-F0-9]{3}$/;
const STORAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+$/i;

function quarantineRoot(environment: Readonly<Record<string, string | undefined>>) {
  return path.resolve(environment.UPLOAD_QUARANTINE_PATH?.trim() || ".data/quarantine");
}

function resolveInside(root: string, ...segments: string[]) {
  const target = path.resolve(root, ...segments);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Unsafe quarantine artifact path");
  return target;
}

/**
 * Resolves opaque quarantine references from the internal order manifest. The
 * browser never receives the real quarantine path, and no arbitrary source path
 * supplied by a client is accepted.
 */
export async function resolveProductionOrderArtifactSources(
  order: ProductionOrder,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<ServerArtifactSource[]> {
  const root = quarantineRoot(environment);
  const sources: ServerArtifactSource[] = [];

  for (const artifact of order.artifacts) {
    const source = artifact.source;
    if (!source) throw new Error(`Для файла ${artifact.fileName} отсутствует защищённый источник.`);
    if (source.kind !== "quarantine" || !REQUEST_ID.test(source.requestId) || !STORAGE_ID.test(source.storageId)) {
      throw new Error(`Некорректная ссылка на источник файла ${artifact.fileName}.`);
    }
    if (!source.storageId.toLowerCase().endsWith(`.${source.extension.toLowerCase()}`)) {
      throw new Error(`Расширение источника файла ${artifact.fileName} не совпадает.`);
    }

    const sourcePath = resolveInside(root, source.requestId, source.storageId);
    const info = await stat(sourcePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") throw new Error(`Исходный файл ${artifact.fileName} больше не найден в защищённом хранилище.`);
      throw error;
    });
    if (!info.isFile()) throw new Error(`Источник ${artifact.fileName} не является файлом.`);
    sources.push({ artifactId: artifact.id, sourcePath });
  }

  return sources;
}

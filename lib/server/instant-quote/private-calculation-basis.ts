import "server-only";

import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FactualRate, FactualRateBook } from "@/lib/instant-quote/factual-calculation";
import type { StoredPriceSnapshot } from "@/lib/instant-quote/material-price-feed";
import type { MaterialId, MaterialMarketPrice } from "@/lib/instant-quote/pricing";
import type { PrivateCommercialPricing } from "@/lib/server/instant-quote/private-commercial-pricing";

export type PrivateCalculationBasis = {
  version: string;
  rateBook: FactualRateBook;
  materialPriceSnapshots: StoredPriceSnapshot[];
  commercialPricing?: PrivateCommercialPricing | null;
};

function finitePositive(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid private calculation basis: ${label}`);
  }
  return value;
}

function finiteNonNegative(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid private calculation basis: ${label}`);
  }
  return value;
}

function optionalPositive(value: unknown, label: string): number | undefined {
  if (value == null) return undefined;
  return finitePositive(value, label);
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid private calculation basis: ${label}`);
  return value.trim();
}

function isoDate(value: unknown, label: string): string {
  const result = text(value, label);
  if (!Number.isFinite(Date.parse(result))) throw new Error(`Invalid private calculation basis: ${label}`);
  return result;
}

function optionalSha256(value: unknown, label: string): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(`Invalid private calculation basis: ${label}`);
  }
  return value.toLowerCase();
}

function source(value: unknown, label: string): FactualRate["source"] {
  if (!value || typeof value !== "object") throw new Error(`Invalid private calculation basis: ${label}`);
  const row = value as Record<string, unknown>;
  return {
    id: text(row.id, `${label}.id`),
    label: text(row.label, `${label}.label`),
    confirmedAt: isoDate(row.confirmedAt, `${label}.confirmedAt`),
    note: text(row.note, `${label}.note`),
  };
}

function rate(value: unknown, label: string): FactualRate | null {
  if (value == null) return null;
  if (!value || typeof value !== "object") throw new Error(`Invalid private calculation basis: ${label}`);
  const row = value as Record<string, unknown>;
  return {
    rateRub: finitePositive(row.rateRub, `${label}.rateRub`),
    source: source(row.source, `${label}.source`),
  };
}

function commercialPricing(value: unknown): PrivateCommercialPricing | null {
  if (value == null) return null;
  if (!value || typeof value !== "object") throw new Error("Invalid private calculation basis: commercialPricing");
  const row = value as Record<string, unknown>;
  if (typeof row.fixedAddEnabled !== "boolean") {
    throw new Error("Invalid private calculation basis: commercialPricing.fixedAddEnabled");
  }
  return {
    materialMultiplier: finitePositive(row.materialMultiplier, "commercialPricing.materialMultiplier"),
    drawPct: finiteNonNegative(row.drawPct, "commercialPricing.drawPct"),
    finalPct: finiteNonNegative(row.finalPct, "commercialPricing.finalPct"),
    fixedAddRubEach: finiteNonNegative(row.fixedAddRubEach, "commercialPricing.fixedAddRubEach"),
    fixedAddEnabled: row.fixedAddEnabled,
    roundStepRub: finitePositive(row.roundStepRub, "commercialPricing.roundStepRub"),
  };
}

function materialId(value: unknown): MaterialId {
  if (value === "cold" || value === "hot" || value === "zinc" || value === "inox" || value === "alu" || value === "copper" || value === "brass") return value;
  throw new Error("Invalid private calculation basis: materialId");
}

function materialPrice(value: unknown, label: string, snapshotFetchedAt: string): MaterialMarketPrice {
  if (!value || typeof value !== "object") throw new Error(`Invalid private calculation basis: ${label}`);
  const row = value as Record<string, unknown>;
  const from3t = row.rubPerTonFrom3t;
  if (from3t != null) finitePositive(from3t, `${label}.rubPerTonFrom3t`);
  const exactThickness = row.exactThickness;
  if (exactThickness != null && typeof exactThickness !== "boolean") {
    throw new Error(`Invalid private calculation basis: ${label}.exactThickness`);
  }
  const size = row.size;
  if (size != null && typeof size !== "string") throw new Error(`Invalid private calculation basis: ${label}.size`);

  return {
    materialId: materialId(row.materialId),
    thicknessMm: finitePositive(row.thicknessMm, `${label}.thicknessMm`),
    rubPerTon: finitePositive(row.rubPerTon, `${label}.rubPerTon`),
    rubPerTonFrom3t: from3t == null ? undefined : from3t as number,
    source: text(row.source, `${label}.source`),
    sourceDate: isoDate(row.sourceDate, `${label}.sourceDate`),
    fetchedAt: row.fetchedAt == null ? snapshotFetchedAt : isoDate(row.fetchedAt, `${label}.fetchedAt`),
    size: size as string | undefined,
    exactThickness: exactThickness as boolean | undefined,
  };
}

function snapshot(value: unknown, index: number): StoredPriceSnapshot {
  const label = `materialPriceSnapshots[${index}]`;
  if (!value || typeof value !== "object") throw new Error(`Invalid private calculation basis: ${label}`);
  const row = value as Record<string, unknown>;
  const status = row.status;
  if (status !== "ok" && status !== "stale" && status !== "failed") {
    throw new Error(`Invalid private calculation basis: ${label}.status`);
  }
  const fetchedAt = isoDate(row.fetchedAt, `${label}.fetchedAt`);
  const rows = row.rows;
  if (!Array.isArray(rows)) throw new Error(`Invalid private calculation basis: ${label}.rows`);
  if (status !== "failed" && rows.length === 0) throw new Error(`Invalid private calculation basis: ${label}.rows empty`);
  const error = row.error;
  if (error != null && typeof error !== "string") throw new Error(`Invalid private calculation basis: ${label}.error`);

  return {
    sourceId: text(row.sourceId, `${label}.sourceId`),
    fetchedAt,
    sourceDate: isoDate(row.sourceDate, `${label}.sourceDate`),
    status,
    error: error as string | undefined,
    contentSha256: optionalSha256(row.contentSha256, `${label}.contentSha256`),
    rows: rows.map((item, rowIndex) => materialPrice(item, `${label}.rows[${rowIndex}]`, fetchedAt)),
  };
}

function parseBasis(value: unknown): PrivateCalculationBasis {
  if (!value || typeof value !== "object") throw new Error("Invalid private calculation basis root");
  const root = value as Record<string, unknown>;
  const rateBookRaw = root.rateBook as Record<string, unknown> | undefined;
  if (!rateBookRaw) throw new Error("Invalid private calculation basis: rateBook");

  const laserRowsRaw = rateBookRaw.laserRubPerM;
  if (!Array.isArray(laserRowsRaw)) throw new Error("Invalid private calculation basis: laserRubPerM");
  const laserRubPerM = laserRowsRaw.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`Invalid private laser rate ${index}`);
    const row = entry as Record<string, unknown>;
    return {
      materialId: materialId(row.materialId),
      thicknessMm: finitePositive(row.thicknessMm, `laserRubPerM[${index}].thicknessMm`),
      rateRub: finitePositive(row.rateRub, `laserRubPerM[${index}].rateRub`),
      from100mRubPerM: optionalPositive(row.from100mRubPerM, `laserRubPerM[${index}].from100mRubPerM`),
      from500mRubPerM: optionalPositive(row.from500mRubPerM, `laserRubPerM[${index}].from500mRubPerM`),
      pierceRubEach: optionalPositive(row.pierceRubEach, `laserRubPerM[${index}].pierceRubEach`),
      source: source(row.source, `laserRubPerM[${index}].source`),
    };
  });

  const uniqueLaserRows = new Set<string>();
  for (const row of laserRubPerM) {
    const key = `${row.materialId}:${row.thicknessMm}`;
    if (uniqueLaserRows.has(key)) throw new Error(`Invalid private calculation basis: duplicate laser rate ${key}`);
    uniqueLaserRows.add(key);
  }

  const snapshotsRaw = root.materialPriceSnapshots;
  if (!Array.isArray(snapshotsRaw)) throw new Error("Invalid private calculation basis: materialPriceSnapshots");
  const materialPriceSnapshots = snapshotsRaw.map(snapshot);

  return {
    version: text(root.version, "version"),
    rateBook: {
      laserRubPerM,
      bendRubEach: rate(rateBookRaw.bendRubEach, "bendRubEach"),
      weldRubPerM: rate(rateBookRaw.weldRubPerM, "weldRubPerM"),
      powderRubPerM2: rate(rateBookRaw.powderRubPerM2, "powderRubPerM2"),
      assemblyRubPerHour: rate(rateBookRaw.assemblyRubPerHour, "assemblyRubPerHour"),
      surfacePreparationRubPerM2: rate(rateBookRaw.surfacePreparationRubPerM2, "surfacePreparationRubPerM2"),
      packagingRubEach: rate(rateBookRaw.packagingRubEach, "packagingRubEach"),
    },
    materialPriceSnapshots,
    commercialPricing: commercialPricing(root.commercialPricing),
  };
}

function privateBasisPath() {
  const configured = process.env.STEEL_PRODUCT_PRIVATE_CALCULATION_BASIS_PATH?.trim();
  if (!configured) throw new Error("STEEL_PRODUCT_PRIVATE_CALCULATION_BASIS_PATH is not configured");
  const resolved = path.resolve(configured);
  const publicRoot = path.resolve(process.cwd(), "public");
  if (resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("Private calculation basis must not be stored under public/");
  }
  return resolved;
}

async function writeBasisAtomically(candidate: Record<string, unknown>) {
  const validated = parseBasis(candidate);
  const basisPath = privateBasisPath();
  const directory = path.dirname(basisPath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const tempPath = `${basisPath}.${randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(candidate, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await chmod(tempPath, 0o600);
  await rename(tempPath, basisPath);
  await chmod(basisPath, 0o600);
  return validated;
}

/** Load confidential rates/prices only on the server. No fallback is allowed. */
export async function loadPrivateCalculationBasis(): Promise<PrivateCalculationBasis> {
  const raw = await readFile(privateBasisPath(), "utf8");
  return parseBasis(JSON.parse(raw) as unknown);
}

/** Initialize or replace the complete validated private basis atomically. */
export async function writePrivateCalculationBasis(nextBasis: PrivateCalculationBasis) {
  return writeBasisAtomically(nextBasis as unknown as Record<string, unknown>);
}

/**
 * Atomically replaces one validated supplier snapshot while preserving every
 * other private rate/source. A failed refresh must never call this function, so
 * the last known good snapshot remains available.
 */
export async function replacePrivateMaterialPriceSnapshot(nextSnapshot: StoredPriceSnapshot) {
  if (nextSnapshot.status === "failed") throw new Error("Refusing to replace private prices with a failed snapshot");

  const basisPath = privateBasisPath();
  const raw = await readFile(basisPath, "utf8");
  const root = JSON.parse(raw) as Record<string, unknown>;
  const current = parseBasis(root);
  const mergedSnapshots = [
    ...current.materialPriceSnapshots.filter((item) => item.sourceId !== nextSnapshot.sourceId),
    nextSnapshot,
  ];
  const candidate: Record<string, unknown> = {
    ...root,
    materialPriceSnapshots: mergedSnapshots,
  };

  return writeBasisAtomically(candidate);
}

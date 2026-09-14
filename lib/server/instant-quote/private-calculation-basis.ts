import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FactualRate, FactualRateBook } from "@/lib/instant-quote/factual-calculation";
import type { StoredPriceSnapshot } from "@/lib/instant-quote/material-price-feed";
import type { MaterialId } from "@/lib/instant-quote/pricing";

export type PrivateCalculationBasis = {
  version: string;
  rateBook: FactualRateBook;
  materialPriceSnapshots: StoredPriceSnapshot[];
};

function finitePositive(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid private calculation basis: ${label}`);
  }
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid private calculation basis: ${label}`);
  return value.trim();
}

function source(value: unknown, label: string): FactualRate["source"] {
  if (!value || typeof value !== "object") throw new Error(`Invalid private calculation basis: ${label}`);
  const row = value as Record<string, unknown>;
  return {
    id: text(row.id, `${label}.id`),
    label: text(row.label, `${label}.label`),
    confirmedAt: text(row.confirmedAt, `${label}.confirmedAt`),
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

function materialId(value: unknown): MaterialId {
  if (value === "cold" || value === "hot" || value === "zinc" || value === "inox" || value === "alu" || value === "copper" || value === "brass") return value;
  throw new Error("Invalid private calculation basis: materialId");
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
      source: source(row.source, `laserRubPerM[${index}].source`),
    };
  });

  const snapshots = root.materialPriceSnapshots;
  if (!Array.isArray(snapshots)) throw new Error("Invalid private calculation basis: materialPriceSnapshots");

  return {
    version: text(root.version, "version"),
    rateBook: {
      laserRubPerM,
      bendRubEach: rate(rateBookRaw.bendRubEach, "bendRubEach"),
      weldRubPerM: rate(rateBookRaw.weldRubPerM, "weldRubPerM"),
      powderRubPerM2: rate(rateBookRaw.powderRubPerM2, "powderRubPerM2"),
    },
    materialPriceSnapshots: snapshots as StoredPriceSnapshot[],
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

/** Load confidential rates/prices only on the server. No fallback is allowed. */
export async function loadPrivateCalculationBasis(): Promise<PrivateCalculationBasis> {
  const raw = await readFile(privateBasisPath(), "utf8");
  return parseBasis(JSON.parse(raw) as unknown);
}

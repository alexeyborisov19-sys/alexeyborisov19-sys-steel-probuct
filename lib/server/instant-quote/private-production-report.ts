import "server-only";

import { chmod, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { summarizeProjectCalculationCompleteness, type CalculationCompletenessStatus } from "@/lib/instant-quote/calculation-completeness";
import type { ProjectFactualCalculationResult } from "@/lib/instant-quote/project-factual-calculation";
import type { ProductionParameterSummary } from "@/lib/instant-quote/production-parameters";

export type InternalProductionReport = {
  classification: "internal-production-confidential";
  schemaVersion: "1";
  reportId: string;
  projectId: string;
  generatedAt: string;
  basisVersion: string;
  calculation: ProjectFactualCalculationResult;
  productionParametersByPartId: Record<string, ProductionParameterSummary>;
  internalNotes: string[];
};

export type InternalProductionReportListItem = {
  fileName: string;
  projectId: string;
  generatedAt: string;
  basisVersion: string;
  totalParts: number;
  completeParts: number;
  partialParts: number;
  blockedParts: number;
  confirmedDirectCostRub: number;
  readinessScorePct: number;
  readinessStatus: CalculationCompletenessStatus;
  bytes: number;
};

function privateReportRoot() {
  const configured = process.env.STEEL_PRODUCT_PRIVATE_PRODUCTION_REPORT_ROOT?.trim();
  if (!configured) throw new Error("STEEL_PRODUCT_PRIVATE_PRODUCTION_REPORT_ROOT is not configured");

  const resolved = path.resolve(configured);
  const publicRoot = path.resolve(process.cwd(), "public");
  if (resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("Private production reports must not be stored under public/");
  }
  return resolved;
}

function safeFileToken(value: string) {
  const normalized = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 80);
  return normalized || "project";
}

function assertSafeReportFileName(fileName: string) {
  if (path.basename(fileName) !== fileName || !/^[a-zA-Z0-9._-]+\.json$/.test(fileName)) {
    throw new Error("Invalid internal production report filename");
  }
}

function assertReport(value: unknown): InternalProductionReport {
  const parsed = value as InternalProductionReport;
  if (!parsed || parsed.classification !== "internal-production-confidential" || parsed.schemaVersion !== "1") {
    throw new Error("Invalid internal production report");
  }
  return parsed;
}

export function createInternalProductionReport(input: {
  projectId: string;
  basisVersion: string;
  calculation: ProjectFactualCalculationResult;
  productionParametersByPartId: Record<string, ProductionParameterSummary>;
  internalNotes?: string[];
  now?: Date;
}): InternalProductionReport {
  const now = input.now ?? new Date();
  return {
    classification: "internal-production-confidential",
    schemaVersion: "1",
    reportId: randomUUID(),
    projectId: input.projectId,
    generatedAt: now.toISOString(),
    basisVersion: input.basisVersion,
    calculation: input.calculation,
    productionParametersByPartId: input.productionParametersByPartId,
    internalNotes: [...(input.internalNotes ?? [])],
  };
}

/**
 * Persists a confidential report outside the public web tree. The directory is
 * owner-only (0700) and report files are owner-read/write only (0600).
 */
export async function writeInternalProductionReport(report: InternalProductionReport) {
  const root = privateReportRoot();
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);

  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  const fileName = `${safeFileToken(report.projectId)}_${stamp}_${safeFileToken(report.reportId)}.json`;
  const finalPath = path.join(root, fileName);
  const tempPath = `${finalPath}.${randomUUID()}.tmp`;
  const payload = `${JSON.stringify(report, null, 2)}\n`;

  await writeFile(tempPath, payload, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await chmod(tempPath, 0o600);
  await rename(tempPath, finalPath);
  await chmod(finalPath, 0o600);

  return { fileName, path: finalPath };
}

/** Only authenticated internal server routes should call this function. */
export async function readInternalProductionReport(fileName: string): Promise<InternalProductionReport> {
  const root = privateReportRoot();
  assertSafeReportFileName(fileName);
  const raw = await readFile(path.join(root, fileName), "utf8");
  return assertReport(JSON.parse(raw) as unknown);
}

/**
 * Produces a compact index for the authenticated internal dashboard. Corrupt or
 * non-report files are ignored rather than surfaced as trusted calculations.
 */
export async function listInternalProductionReports(limit = 200): Promise<InternalProductionReportListItem[]> {
  const root = privateReportRoot();
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);

  const names = (await readdir(root))
    .filter((name) => /^[a-zA-Z0-9._-]+\.json$/.test(name))
    .slice(-Math.max(1, Math.min(limit, 1000)));

  const rows: InternalProductionReportListItem[] = [];
  for (const fileName of names) {
    try {
      assertSafeReportFileName(fileName);
      const fullPath = path.join(root, fileName);
      const [raw, fileStat] = await Promise.all([readFile(fullPath, "utf8"), stat(fullPath)]);
      if (!fileStat.isFile()) continue;
      const report = assertReport(JSON.parse(raw) as unknown);
      const readiness = summarizeProjectCalculationCompleteness(
        report.calculation,
        report.productionParametersByPartId,
      );
      rows.push({
        fileName,
        projectId: report.projectId,
        generatedAt: report.generatedAt,
        basisVersion: report.basisVersion,
        totalParts: report.calculation.totalParts,
        completeParts: report.calculation.completeParts,
        partialParts: report.calculation.partialParts,
        blockedParts: report.calculation.blockedParts,
        confirmedDirectCostRub: report.calculation.confirmedDirectCostRub,
        readinessScorePct: readiness.scorePct,
        readinessStatus: readiness.status,
        bytes: fileStat.size,
      });
    } catch {
      // The dashboard never treats a malformed file as a valid confidential report.
    }
  }

  return rows.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)).slice(0, Math.max(1, Math.min(limit, 1000)));
}

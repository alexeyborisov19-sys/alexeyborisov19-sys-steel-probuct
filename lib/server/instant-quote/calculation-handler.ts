import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { parsePublicCalculationManifest, CalculationManifestError } from "@/lib/instant-quote/calculation-manifest";
import type { NormalizedCadModel } from "@/lib/instant-quote/cad-model";
import { dxfCadAdapter } from "@/lib/instant-quote/dxf-adapter";
import { parseAsciiDxf } from "@/lib/instant-quote/dxf";
import {
  normalizeCadFormat,
  type InstantQuoteProject,
  type ProjectPart,
} from "@/lib/instant-quote/domain";
import type { ClientProjectCalculationView } from "@/lib/instant-quote/client-calculation-view";
import type { PartFactualInputs, ProjectCadEvidence } from "@/lib/instant-quote/project-factual-calculation";
import { clientKey } from "@/lib/security/client-ip";
import { consumeRules, quoteRateRules } from "@/lib/security/rate-limit";
import { PayloadTooLargeError, readMultipartForm } from "@/lib/security/request-body";
import { safeSecurityLog } from "@/lib/security/safe-log";
import { assertSameOriginRequest, CrossSiteRequestError } from "@/lib/security/same-origin";
import {
  inspectUploads,
  quarantineUploads,
  uploadLimits,
  UploadValidationError,
  type UploadInspection,
  type QuarantinedUpload,
} from "@/lib/security/uploads";

const ROUTE = "online-calculation";

type RunCalculationInputs = {
  internalNotes?: string[];
  authoritativeFactualByPartId?: Record<string, PartFactualInputs>;
  factualByPartId?: Record<string, PartFactualInputs>;
  powderSidesByPartId?: Record<string, 1 | 2>;
};

type RunCalculation = (
  project: InstantQuoteProject,
  evidenceByPartId: ProjectCadEvidence,
  inputs?: RunCalculationInputs,
  now?: Date,
) => Promise<ClientProjectCalculationView>;

type StepServerAnalysis = {
  model: NormalizedCadModel;
  productionReady: boolean;
  authoritativeFactualInputs?: PartFactualInputs;
};

type AnalyzeStep = (inspection: UploadInspection, format: "step" | "stp") => Promise<StepServerAnalysis>;

export type OnlineCalculationHandlerDependencies = {
  inspectUploads: typeof inspectUploads;
  quarantineUploads: typeof quarantineUploads;
  runCalculation: RunCalculation;
  analyzeStep: AnalyzeStep;
};

async function analyzePlanarStep(inspection: UploadInspection, format: "step" | "stp"): Promise<StepServerAnalysis> {
  const [{ createStepCadAdapter }, { occtStepKernel }, { measurePrivateStepProductionEvidence }] = await Promise.all([
    import("@/lib/instant-quote/step-adapter"),
    import("@/lib/instant-quote/occt-step-kernel"),
    import("@/lib/server/instant-quote/private-step-production-evidence"),
  ]);
  const adapter = createStepCadAdapter(occtStepKernel);
  const bytes = new Uint8Array(
    inspection.buffer.buffer,
    inspection.buffer.byteOffset,
    inspection.buffer.byteLength,
  );
  const [model, privateEvidence] = await Promise.all([
    adapter.analyze({ fileName: inspection.safeName, format, bytes }),
    measurePrivateStepProductionEvidence(bytes).catch(() => null),
  ]);
  const flat = model.sheetMetal?.flatPatternCandidate;
  const productionReady = flat?.confidence === "high"
    && (model.geometry.areaMm2 ?? 0) > 0
    && (model.geometry.blankAreaMm2 ?? 0) > 0
    && (model.geometry.cutLengthMm ?? 0) > 0
    && (model.geometry.contourCount ?? 0) > 0;
  const authoritativeFactualInputs = productionReady && privateEvidence?.surfaceAreaMm2
    ? { powderAreaM2: privateEvidence.surfaceAreaMm2 / 1_000_000 }
    : undefined;

  return { model, productionReady, authoritativeFactualInputs };
}

const defaults: OnlineCalculationHandlerDependencies = {
  inspectUploads,
  quarantineUploads,
  analyzeStep: analyzePlanarStep,
  runCalculation: async (...args) => {
    // Keep the confidential boundary out of the public handler's eager module
    // graph. Production requests load it on demand; unit tests can inject a
    // safe calculation stub without resolving private server-only modules.
    const { runConfidentialCalculationForClient } = await import("@/lib/server/instant-quote/run-confidential-calculation");
    return runConfidentialCalculationForClient(...args);
  },
};

function response(status: number, requestId: string, body: Record<string, unknown>) {
  const headers = new Headers({
    "Cache-Control": "no-store, max-age=0",
    "X-Request-Id": requestId,
    "X-Content-Type-Options": "nosniff",
  });
  return NextResponse.json(body, { status, headers });
}

function serverProjectId(now: Date) {
  return `calc-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 12)}`;
}

function parseDxfInspection(inspection: UploadInspection) {
  return parseAsciiDxf(inspection.buffer.toString("utf8"));
}

/**
 * Maps an internal exception to a coarse server-log-only category. The raw
 * exception, paths, rate values and private report details are deliberately not
 * logged or returned to the browser.
 */
function safeCalculationFailureCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("STEEL_PRODUCT_PRIVATE_CALCULATION_BASIS_PATH")) return "PRIVATE_BASIS_CONFIG";
  if (message.includes("Invalid private calculation basis")) return "PRIVATE_BASIS_INVALID";
  if (/STEEL_PRODUCT_(?:METAL_MULTIPLIER|DRAW_PCT|FINAL_PCT|FIXED_ADD_RUB|FIXED_ADD_ENABLED|ROUND_STEP_RUB)/.test(message)) {
    return "PRIVATE_PRICING_CONFIG";
  }
  if (message.includes("STEEL_PRODUCT_PRIVATE_PRODUCTION_REPORT_ROOT")) return "PRIVATE_REPORT_CONFIG";
  if (/EACCES|EPERM|permission denied/i.test(message)) return "PRIVATE_STORAGE_ACCESS";
  if (/ENOENT|no such file or directory/i.test(message)) return "PRIVATE_STORAGE_MISSING";
  if (/server-only/i.test(message)) return "SERVER_MODULE_BOUNDARY";
  if (/report/i.test(message) && /write|rename|mkdir|chmod/i.test(message)) return "PRIVATE_REPORT_WRITE";
  return "CALCULATION_RUNTIME";
}

async function buildAuthoritativeProject(
  manifestRaw: string,
  inspections: UploadInspection[],
  now: Date,
  analyzeStep: AnalyzeStep,
): Promise<{
  project: InstantQuoteProject;
  evidenceByPartId: ProjectCadEvidence;
  authoritativeFactualByPartId: Record<string, PartFactualInputs>;
  analysisNotes: string[];
}> {
  const manifest = parsePublicCalculationManifest(manifestRaw, inspections.length);
  const projectId = serverProjectId(now);
  const createdAt = now.toISOString();
  const evidenceByPartId: ProjectCadEvidence = {};
  const authoritativeFactualByPartId: Record<string, PartFactualInputs> = {};
  const analysisNotes: string[] = [];
  const parts: ProjectPart[] = [];

  for (const item of manifest.parts) {
    const inspection = inspections[item.fileIndex];
    const format = normalizeCadFormat(inspection.safeName);
    if (!format) throw new CalculationManifestError("Формат CAD не поддерживается расчётным контуром.");

    let geometry: ProjectPart["geometry"] = null;
    let state: ProjectPart["state"] = "manual-review";

    if (format === "dxf") {
      const bytes = new Uint8Array(
        inspection.buffer.buffer,
        inspection.buffer.byteOffset,
        inspection.buffer.byteLength,
      );
      const model = await dxfCadAdapter.analyze({ fileName: inspection.safeName, format, bytes });
      const parsed = parseDxfInspection(inspection);
      geometry = model.geometry;
      evidenceByPartId[item.clientPartId] = {
        unsupportedEntities: [...parsed.unsupportedEntities],
        ...(parsed.skippedServiceLayers.length
          ? { skippedServiceLayers: [...parsed.skippedServiceLayers] }
          : {}),
      };
      state = model.warnings.length ? "manual-review" : "configurable";
    } else if (format === "step" || format === "stp") {
      try {
        const { model, productionReady, authoritativeFactualInputs } = await analyzeStep(inspection, format);
        if (productionReady) {
          geometry = model.geometry;
          evidenceByPartId[item.clientPartId] = { reviewReasons: [...model.warnings] };
          if (authoritativeFactualInputs && Object.keys(authoritativeFactualInputs).length > 0) {
            authoritativeFactualByPartId[item.clientPartId] = { ...authoritativeFactualInputs };
          }
          state = model.warnings.length ? "manual-review" : "configurable";
          analysisNotes.push(`STEP ${inspection.safeName}: server OpenCascade confirmed a high-confidence planar sheet flat pattern.`);
        } else {
          evidenceByPartId[item.clientPartId] = {
            reviewReasons: [
              ...model.warnings,
              "STEP распознан OpenCascade на сервере, но production-authoritative 2D-развёртка для этой модели не подтверждена.",
            ],
          };
          analysisNotes.push(`STEP ${inspection.safeName}: BRep inspected on server; factual material/laser calculation withheld until authoritative flat pattern.`);
        }
      } catch {
        evidenceByPartId[item.clientPartId] = {
          reviewReasons: ["Серверный OpenCascade не смог подтвердить производственную геометрию STEP; требуется технологическая проверка."],
        };
        analysisNotes.push(`STEP ${inspection.safeName}: authoritative server analysis failed; no production geometry was priced.`);
      }
    } else {
      evidenceByPartId[item.clientPartId] = {
        reviewReasons: ["DWG принят в защищённое хранилище и требует внутренней технологической обработки перед расчётом."],
      };
    }

    parts.push({
      id: item.clientPartId,
      fileName: inspection.safeName,
      format,
      fileSizeBytes: inspection.size,
      createdAt,
      state,
      geometry,
      configuration: {
        materialId: item.materialId,
        thicknessMm: item.thicknessMm,
        quantity: item.quantity,
        operations: [...item.operations],
        operationInputs: { ...item.operationInputs },
      },
      quote: { kind: "not-requested" },
    });
  }

  // Quantities the CAD cannot carry. Server-side CAD evidence still wins where
  // it exists: resolveEffectiveFactualInputs layers these over it, and the
  // manifest parser has already dropped anything whose operation is not
  // selected and bounds-checked the rest.
  const declaredFactualByPartId: Record<string, PartFactualInputs> = {};
  const powderSidesByPartId: Record<string, 1 | 2> = {};
  for (const item of manifest.parts) {
    const declared: PartFactualInputs = {};
    if (item.operationInputs.bendCount != null) declared.bendCount = item.operationInputs.bendCount;
    if (item.operationInputs.weldLengthM != null) declared.weldLengthM = item.operationInputs.weldLengthM;
    if (item.operationInputs.assemblyMinutes != null) declared.assemblyMinutes = item.operationInputs.assemblyMinutes;
    if (Object.keys(declared).length > 0) declaredFactualByPartId[item.clientPartId] = declared;
    if (item.operationInputs.powderSides != null) powderSidesByPartId[item.clientPartId] = item.operationInputs.powderSides;
  }

  return {
    project: {
      id: projectId,
      title: manifest.title,
      createdAt,
      updatedAt: createdAt,
      activePartId: parts[0]?.id ?? null,
      parts,
    },
    evidenceByPartId,
    authoritativeFactualByPartId,
    declaredFactualByPartId,
    powderSidesByPartId,
    analysisNotes,
  };
}

function storageNotes(requestId: string, stored: QuarantinedUpload[]) {
  return stored.map((file, index) =>
    `CAD ${index + 1}: quarantine request ${requestId}, storage ${file.storageId}, format ${file.extension}, antivirus ${file.antivirus}.`,
  );
}

/**
 * Secure public calculation endpoint handler. All authoritative production
 * geometry is derived from the uploaded CAD on the server. The only successful
 * response payload is ClientProjectCalculationView; the confidential report is
 * persisted internally by the lazily loaded confidential calculation boundary.
 */
export function createOnlineCalculationHandler(overrides: Partial<OnlineCalculationHandlerDependencies> = {}) {
  const dependencies = { ...defaults, ...overrides };

  return async function handleOnlineCalculation(request: Request) {
    const requestId = `CALC-${randomUUID().slice(0, 12).toUpperCase()}`;
    const ownerKey = clientKey(request);

    try {
      assertSameOriginRequest(request);
    } catch (error) {
      if (error instanceof CrossSiteRequestError) {
        safeSecurityLog(ROUTE, "cross_site_rejected", ownerKey, { requestId, code: "CROSS_ORIGIN_REJECTED" });
        return response(403, requestId, { ok: false, code: "CROSS_ORIGIN_REJECTED", message: "Запрос отклонён." });
      }
      throw error;
    }

    const limited = consumeRules(ownerKey, quoteRateRules);
    if (limited) {
      return response(429, requestId, {
        ok: false,
        code: "RATE_LIMITED",
        message: "Слишком много запросов расчёта. Повторите позже.",
        retryAfterSeconds: limited.retryAfterSeconds,
      });
    }

    try {
      const formData = await readMultipartForm(request, uploadLimits.maximumMultipartBytes);
      const manifestRaw = String(formData.get("manifest") ?? "");
      const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
      const inspections = await dependencies.inspectUploads(files);
      const manifest = parsePublicCalculationManifest(manifestRaw, inspections.length);

      for (const item of manifest.parts) {
        const format = normalizeCadFormat(inspections[item.fileIndex].safeName);
        if (!format) throw new CalculationManifestError("Неподдерживаемый формат CAD.");
      }

      const quarantined = await dependencies.quarantineUploads(requestId, inspections);
      if (quarantined.some((file) => file.antivirus === "blocked")) {
        safeSecurityLog(ROUTE, "antivirus_blocked", ownerKey, { requestId, code: "UPLOAD_REJECTED" });
        return response(422, requestId, { ok: false, code: "UPLOAD_REJECTED", message: "Один из CAD-файлов не прошёл проверку." });
      }

      const now = new Date();
      const {
        project,
        evidenceByPartId,
        authoritativeFactualByPartId,
        declaredFactualByPartId,
        powderSidesByPartId,
        analysisNotes,
      } = await buildAuthoritativeProject(
        manifestRaw,
        inspections,
        now,
        dependencies.analyzeStep,
      );
      const clientView = await dependencies.runCalculation(
        project,
        evidenceByPartId,
        {
          authoritativeFactualByPartId,
          factualByPartId: declaredFactualByPartId,
          powderSidesByPartId,
          internalNotes: [...storageNotes(requestId, quarantined), ...analysisNotes],
        },
        now,
      );

      safeSecurityLog(ROUTE, "calculated", ownerKey, { requestId, code: "CALCULATED" });
      return response(200, requestId, { ok: true, requestId, calculation: clientView });
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return response(413, requestId, { ok: false, code: "UPLOAD_REJECTED", message: "Общий размер запроса превышает допустимый." });
      }
      if (error instanceof UploadValidationError) {
        return response(error.status, requestId, { ok: false, code: "UPLOAD_REJECTED", message: error.message });
      }
      if (error instanceof CalculationManifestError) {
        return response(400, requestId, { ok: false, code: "INVALID_CONFIGURATION", message: error.message });
      }

      safeSecurityLog(ROUTE, "calculation_failed", ownerKey, { requestId, code: safeCalculationFailureCode(error) });
      return response(503, requestId, {
        ok: false,
        code: "CALCULATION_UNAVAILABLE",
        message: "Внутренний расчёт временно недоступен. Конфигурация не опубликована клиенту.",
      });
    }
  };
}
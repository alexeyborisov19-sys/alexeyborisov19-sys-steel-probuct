import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { parsePublicCalculationManifest, CalculationManifestError } from "@/lib/instant-quote/calculation-manifest";
import { dxfCadAdapter } from "@/lib/instant-quote/dxf-adapter";
import { parseAsciiDxf } from "@/lib/instant-quote/dxf";
import {
  normalizeCadFormat,
  type InstantQuoteProject,
  type ProjectPart,
} from "@/lib/instant-quote/domain";
import type { ClientProjectCalculationView } from "@/lib/instant-quote/client-calculation-view";
import type { ProjectCadEvidence } from "@/lib/instant-quote/project-factual-calculation";
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

type RunCalculation = (
  project: InstantQuoteProject,
  evidenceByPartId: ProjectCadEvidence,
  inputs?: { internalNotes?: string[] },
  now?: Date,
) => Promise<ClientProjectCalculationView>;

export type OnlineCalculationHandlerDependencies = {
  inspectUploads: typeof inspectUploads;
  quarantineUploads: typeof quarantineUploads;
  runCalculation: RunCalculation;
};

const defaults: OnlineCalculationHandlerDependencies = {
  inspectUploads,
  quarantineUploads,
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

async function analyzePlanarStep(inspection: UploadInspection, format: "step" | "stp") {
  const [{ createStepCadAdapter }, { occtStepKernel }] = await Promise.all([
    import("@/lib/instant-quote/step-adapter"),
    import("@/lib/instant-quote/occt-step-kernel"),
  ]);
  const adapter = createStepCadAdapter(occtStepKernel);
  const bytes = new Uint8Array(
    inspection.buffer.buffer,
    inspection.buffer.byteOffset,
    inspection.buffer.byteLength,
  );
  const model = await adapter.analyze({ fileName: inspection.safeName, format, bytes });
  const flat = model.sheetMetal?.flatPatternCandidate;
  const productionReady = flat?.confidence === "high"
    && (model.geometry.areaMm2 ?? 0) > 0
    && (model.geometry.blankAreaMm2 ?? 0) > 0
    && (model.geometry.cutLengthMm ?? 0) > 0
    && (model.geometry.contourCount ?? 0) > 0;

  return { model, productionReady };
}

async function buildAuthoritativeProject(
  manifestRaw: string,
  inspections: UploadInspection[],
  now: Date,
): Promise<{ project: InstantQuoteProject; evidenceByPartId: ProjectCadEvidence; analysisNotes: string[] }> {
  const manifest = parsePublicCalculationManifest(manifestRaw, inspections.length);
  const projectId = serverProjectId(now);
  const createdAt = now.toISOString();
  const evidenceByPartId: ProjectCadEvidence = {};
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
      evidenceByPartId[item.clientPartId] = { unsupportedEntities: [...parsed.unsupportedEntities] };
      state = model.warnings.length ? "manual-review" : "configurable";
    } else if (format === "step" || format === "stp") {
      try {
        const { model, productionReady } = await analyzePlanarStep(inspection, format);
        if (productionReady) {
          geometry = model.geometry;
          evidenceByPartId[item.clientPartId] = { reviewReasons: [...model.warnings] };
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
      },
      quote: { kind: "not-requested" },
    });
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
      const { project, evidenceByPartId, analysisNotes } = await buildAuthoritativeProject(manifestRaw, inspections, now);
      const clientView = await dependencies.runCalculation(
        project,
        evidenceByPartId,
        { internalNotes: [...storageNotes(requestId, quarantined), ...analysisNotes] },
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

      safeSecurityLog(ROUTE, "calculation_failed", ownerKey, { requestId, code: "CALCULATION_UNAVAILABLE" });
      return response(503, requestId, {
        ok: false,
        code: "CALCULATION_UNAVAILABLE",
        message: "Внутренний расчёт временно недоступен. Конфигурация не опубликована клиенту.",
      });
    }
  };
}

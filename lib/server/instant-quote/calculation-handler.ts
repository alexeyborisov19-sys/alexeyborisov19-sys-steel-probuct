import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { parsePublicCalculationManifest, CalculationManifestError } from "@/lib/instant-quote/calculation-manifest";
import { dxfCadAdapter } from "@/lib/instant-quote/dxf-adapter";
import { parseAsciiDxf, type ParsedDxf } from "@/lib/instant-quote/dxf";
import {
  normalizeCadFormat,
  type InstantQuoteProject,
  type ProjectPart,
} from "@/lib/instant-quote/domain";
import type { ClientProjectCalculationView } from "@/lib/instant-quote/client-calculation-view";
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
import { runConfidentialCalculationForClient } from "@/lib/server/instant-quote/run-confidential-calculation";

const ROUTE = "online-calculation";

export type OnlineCalculationHandlerDependencies = {
  inspectUploads: typeof inspectUploads;
  quarantineUploads: typeof quarantineUploads;
  runCalculation: typeof runConfidentialCalculationForClient;
};

const defaults: OnlineCalculationHandlerDependencies = {
  inspectUploads,
  quarantineUploads,
  runCalculation: runConfidentialCalculationForClient,
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
  const text = inspection.buffer.toString("utf8");
  return parseAsciiDxf(text);
}

async function buildAuthoritativeProject(
  manifestRaw: string,
  inspections: UploadInspection[],
  now: Date,
): Promise<{ project: InstantQuoteProject; parsedByPartId: Record<string, ParsedDxf> }> {
  const manifest = parsePublicCalculationManifest(manifestRaw, inspections.length);
  const projectId = serverProjectId(now);
  const createdAt = now.toISOString();
  const parsedByPartId: Record<string, ParsedDxf> = {};
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
      geometry = model.geometry;
      parsedByPartId[item.clientPartId] = parseDxfInspection(inspection);
      state = model.warnings.length ? "manual-review" : "configurable";
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
    parsedByPartId,
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
 * persisted internally by runConfidentialCalculationForClient.
 *
 * This module deliberately has no `server-only` package marker so it can be
 * imported directly by Node unit tests. It remains server-side by architecture:
 * the public API route imports it, and every confidential dependency it reaches
 * keeps its own server-only boundary.
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

      // Restrict the first authoritative server calculation route to formats in
      // the public workspace. STEP/STP/DWG are quarantined and reported as
      // needing internal review until a server-side CAD worker is authoritative.
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
      const { project, parsedByPartId } = await buildAuthoritativeProject(manifestRaw, inspections, now);
      const clientView: ClientProjectCalculationView = await dependencies.runCalculation(
        project,
        parsedByPartId,
        { internalNotes: storageNotes(requestId, quarantined) },
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

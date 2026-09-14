import type { CadAnalysisAdapter, CadAnalysisRequest, NormalizedCadModel } from "@/lib/instant-quote/cad-model";
import { validateNormalizedCadModel } from "@/lib/instant-quote/cad-model";

const CAD_WORKER_TIMEOUT_MS = 45_000;

function workerUrl() {
  return process.env.STEEL_PRODUCT_CAD_WORKER_URL?.trim() || null;
}

function workerToken() {
  return process.env.STEEL_PRODUCT_CAD_WORKER_TOKEN?.trim() || null;
}

export function isStepCadWorkerConfigured() {
  return Boolean(workerUrl() && workerToken());
}

function assertSafeWorkerUrl(value: string) {
  const url = new URL(value);
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !local) {
    throw new Error("STEP CAD worker must use HTTPS in production.");
  }
  return url;
}

function asNormalizedModel(payload: unknown): NormalizedCadModel {
  const candidate = payload && typeof payload === "object" && "model" in payload
    ? (payload as { model: unknown }).model
    : payload;
  const validation = validateNormalizedCadModel(candidate as NormalizedCadModel);
  if (!validation.ok) {
    throw new Error(`CAD worker returned an invalid normalized model: ${validation.errors.join(" ")}`);
  }
  return candidate as NormalizedCadModel;
}

async function analyzeViaWorker(request: CadAnalysisRequest): Promise<NormalizedCadModel> {
  const endpoint = workerUrl();
  const token = workerToken();
  if (!endpoint || !token) throw new Error("STEP CAD worker is not configured.");

  const base = assertSafeWorkerUrl(endpoint);
  const analyzeUrl = new URL("./analyze", base.toString().endsWith("/") ? base : new URL(`${base.toString()}/`));
  const body = request.bytes.buffer.slice(
    request.bytes.byteOffset,
    request.bytes.byteOffset + request.bytes.byteLength,
  ) as ArrayBuffer;

  const response = await fetch(analyzeUrl, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${token}`,
      "content-type": "application/octet-stream",
      "x-cad-format": request.format,
      "x-cad-file-name": encodeURIComponent(request.fileName),
      "x-cad-contract": "steel-product-normalized-cad-v1",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(CAD_WORKER_TIMEOUT_MS),
  });

  if (!response.ok) {
    const safeCode = response.status >= 500 ? "CAD_WORKER_UPSTREAM_ERROR" : "CAD_WORKER_REJECTED_FILE";
    throw new Error(`${safeCode}:${response.status}`);
  }

  const model = asNormalizedModel(await response.json());
  if (model.format !== request.format) throw new Error("CAD worker response format does not match the uploaded file.");
  return model;
}

export const remoteStepCadAdapter: CadAnalysisAdapter = {
  id: "steel-product-step-worker-v1",
  formats: ["step", "stp"],
  analyze: analyzeViaWorker,
};

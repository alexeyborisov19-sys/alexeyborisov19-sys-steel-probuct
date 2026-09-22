import { NextResponse } from "next/server";
import { createClientCadPreview } from "@/lib/instant-quote/client-cad-preview";
import { analyzeCad, cadFormatFromFileName, CadAdapterUnavailableError } from "@/lib/instant-quote/cad-router";
import { CadReadError, validateNormalizedCadModel } from "@/lib/instant-quote/cad-model";
import { decodeDxfText, isBinaryDxf, parseAsciiDxf } from "@/lib/instant-quote/dxf";
import { clientKey } from "@/lib/security/client-ip";
import { cadPreviewRateRules, consumeRules } from "@/lib/security/rate-limit";
import { readMultipartForm, PayloadTooLargeError } from "@/lib/security/request-body";
import { safeSecurityLog } from "@/lib/security/safe-log";
import { assertSameOriginRequest, CrossSiteRequestError } from "@/lib/security/same-origin";
import { inspectUploads, UploadValidationError, cadUploadLimits } from "@/lib/security/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "online-order-cad-preview";

async function analyzeForClientPreview(input: {
  fileName: string;
  format: "dxf" | "dwg" | "step" | "stp";
  bytes: Uint8Array;
}) {
  if (input.format === "step" || input.format === "stp") {
    const [{ createStepCadAdapter }, { occtStepKernel }] = await Promise.all([
      import("@/lib/instant-quote/step-adapter"),
      import("@/lib/instant-quote/occt-step-kernel"),
    ]);
    return createStepCadAdapter(occtStepKernel).analyze(input);
  }

  return analyzeCad(input);
}

/**
 * Public CAD preview. It runs the same kernel as the calculation endpoint, so
 * it carries the same protections: same-origin only, rate limited, and the
 * identical upload inspection and size limits — a file the calculation would
 * later refuse is refused here, before the customer spends time configuring it.
 */
export async function POST(request: Request) {
  const ownerKey = clientKey(request);

  try {
    assertSameOriginRequest(request);
  } catch (error) {
    if (error instanceof CrossSiteRequestError) {
      safeSecurityLog(ROUTE, "cross_site_rejected", ownerKey, { code: "CROSS_ORIGIN_REJECTED" });
      return NextResponse.json({ ok: false, error: "Запрос отклонён." }, { status: 403 });
    }
    throw error;
  }

  const limited = consumeRules(ownerKey, cadPreviewRateRules);
  if (limited) {
    return NextResponse.json(
      { ok: false, error: "Слишком много загрузок моделей подряд. Повторите позже.", retryAfterSeconds: limited.retryAfterSeconds },
      { status: 429 },
    );
  }

  try {
    const form = await readMultipartForm(request, cadUploadLimits.maximumFileBytes + 1024 * 1024);
    const entry = form.get("file");

    if (!(entry instanceof File)) {
      return NextResponse.json({ ok: false, error: "Файл модели не получен. Выберите DXF или STEP и загрузите снова." }, { status: 400 });
    }
    if (entry.size <= 0) {
      return NextResponse.json({ ok: false, error: "Файл пустой — в нём нет ни одного байта. Сохраните чертёж из CAD заново." }, { status: 400 });
    }

    const format = cadFormatFromFileName(entry.name);
    if (!format) {
      return NextResponse.json({ ok: false, error: "Формат не поддерживается автоматическим разбором. Загрузите DXF (текстовый) или STEP." }, { status: 415 });
    }

    // Same inspection the calculation runs: extension, declared type, magic
    // bytes and the published size limits, so preview and price agree on what
    // is acceptable.
    const [inspection] = await inspectUploads([entry], 1, cadUploadLimits);
    const bytes = new Uint8Array(
      inspection.buffer.buffer,
      inspection.buffer.byteOffset,
      inspection.buffer.byteLength,
    );

    if (format === "dxf" && isBinaryDxf(bytes)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Это двоичный DXF (AutoCAD Binary DXF). Автоматический разбор работает с текстовым DXF — сохраните файл как «ASCII DXF» и загрузите снова.",
        },
        { status: 415 },
      );
    }

    const model = await analyzeForClientPreview({
      fileName: inspection.safeName,
      format,
      bytes,
    });
    const validation = validateNormalizedCadModel(model);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: "Модель разобрана, но её геометрия не прошла проверку. Передайте файл технологу — расчёт по такой модели был бы недостоверным." }, { status: 422 });
    }

    const parsedDxf = format === "dxf"
      ? parseAsciiDxf(decodeDxfText(bytes))
      : undefined;

    return NextResponse.json({ ok: true, preview: createClientCadPreview(model, parsedDxf) });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return NextResponse.json({ok:false,error:"Для предпросмотра допустим CAD-файл до 50 МБ."},{status:413});
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof CadAdapterUnavailableError) {
      return NextResponse.json(
        { ok: false, error: error.message, format: error.format, code: "CAD_ADAPTER_UNAVAILABLE" },
        { status: 501 },
      );
    }
    // The file is readable but its content is the problem, and the message says
    // which part of it and what to change. Returning it is the difference
    // between a customer who fixes the export in a minute and one who reloads
    // the same file until they leave.
    if (error instanceof CadReadError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 422 });
    }

    return NextResponse.json(
      { ok: false, error: "Не удалось разобрать модель. Проверьте, что файл открывается в CAD и сохранён как текстовый DXF или STEP (AP203/AP214), затем попробуйте снова." },
      { status: 422 },
    );
  }
}

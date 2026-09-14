import { NextResponse } from "next/server";
import { createClientCadPreview } from "@/lib/instant-quote/client-cad-preview";
import { analyzeCad, cadFormatFromFileName, CadAdapterUnavailableError } from "@/lib/instant-quote/cad-router";
import { validateNormalizedCadModel } from "@/lib/instant-quote/cad-model";
import { parseAsciiDxf } from "@/lib/instant-quote/dxf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Technical Alpha guard only; not a published commercial file-size limit.
const MAX_ALPHA_CAD_BYTES = 25 * 1024 * 1024;

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

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const entry = form.get("file");

    if (!(entry instanceof File)) {
      return NextResponse.json({ ok: false, error: "CAD file is required." }, { status: 400 });
    }
    if (entry.size <= 0) {
      return NextResponse.json({ ok: false, error: "CAD file is empty." }, { status: 400 });
    }
    if (entry.size > MAX_ALPHA_CAD_BYTES) {
      return NextResponse.json({ ok: false, error: "CAD file exceeds the current Alpha processing guard." }, { status: 413 });
    }

    const format = cadFormatFromFileName(entry.name);
    if (!format) {
      return NextResponse.json({ ok: false, error: "Unsupported CAD format." }, { status: 415 });
    }

    const bytes = new Uint8Array(await entry.arrayBuffer());
    const model = await analyzeForClientPreview({
      fileName: entry.name,
      format,
      bytes,
    });
    const validation = validateNormalizedCadModel(model);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: "Normalized CAD model validation failed." }, { status: 422 });
    }

    const parsedDxf = format === "dxf"
      ? parseAsciiDxf(new TextDecoder("utf-8").decode(bytes))
      : undefined;

    return NextResponse.json({ ok: true, preview: createClientCadPreview(model, parsedDxf) });
  } catch (error) {
    if (error instanceof CadAdapterUnavailableError) {
      return NextResponse.json(
        { ok: false, error: error.message, format: error.format, code: "CAD_ADAPTER_UNAVAILABLE" },
        { status: 501 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "CAD analysis failed." },
      { status: 422 },
    );
  }
}

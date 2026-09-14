import { NextResponse } from "next/server";
import { analyzeCad, cadFormatFromFileName, CadAdapterUnavailableError } from "@/lib/instant-quote/cad-router";
import { validateNormalizedCadModel } from "@/lib/instant-quote/cad-model";

export const runtime = "nodejs";

// Technical Alpha guard only; not a published commercial file-size limit.
const MAX_ALPHA_CAD_BYTES = 25 * 1024 * 1024;

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

    const model = await analyzeCad({
      fileName: entry.name,
      format,
      bytes: new Uint8Array(await entry.arrayBuffer()),
    });
    const validation = validateNormalizedCadModel(model);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: "Normalized CAD model validation failed.", details: validation.errors }, { status: 422 });
    }

    return NextResponse.json({ ok: true, model });
  } catch (error) {
    if (error instanceof CadAdapterUnavailableError) {
      return NextResponse.json(
        { ok: false, error: error.message, format: error.format, code: "CAD_ADAPTER_UNAVAILABLE" },
        { status: 501 },
      );
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "CAD analysis failed." },
      { status: 422 },
    );
  }
}

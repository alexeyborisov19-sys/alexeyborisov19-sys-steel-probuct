import { NextResponse } from "next/server";
import {
  estimateMetalCassettes,
  metalCassetteThicknesses,
  type MetalCassetteEstimateInput,
  type MetalCassetteThickness,
  type MetalCassetteType,
} from "@/lib/metal-cassette-estimate";

function isType(value: unknown): value is MetalCassetteType {
  return value === "open" || value === "closed";
}

function isThickness(value: unknown): value is MetalCassetteThickness {
  return typeof value === "string" && metalCassetteThicknesses.includes(value as MetalCassetteThickness);
}

function asNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace(",", "."));
  return Number.NaN;
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некорректные данные расчёта." }, { status: 400 });
  }

  const mode = payload.mode === "wall" ? "wall" : payload.mode === "area" ? "area" : null;
  if (!mode || !isType(payload.type) || !isThickness(payload.thickness)) {
    return NextResponse.json({ error: "Проверьте режим, тип кассеты и толщину." }, { status: 400 });
  }

  const input: MetalCassetteEstimateInput = {
    mode,
    type: payload.type,
    thickness: payload.thickness,
  };

  if (mode === "area") {
    input.areaM2 = asNumber(payload.areaM2);
  } else {
    input.wallWidthMm = asNumber(payload.wallWidthMm);
    input.wallHeightMm = asNumber(payload.wallHeightMm);
    input.openingsM2 = asNumber(payload.openingsM2);
  }

  const estimate = estimateMetalCassettes(input);
  return NextResponse.json(estimate, {
    headers: { "Cache-Control": "no-store" },
  });
}

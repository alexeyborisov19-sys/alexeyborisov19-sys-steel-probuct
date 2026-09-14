import { NextResponse } from "next/server";
import {
  getMaterialPriceCatalog,
  getSelectedMaterialPrice,
} from "@/lib/instant-quote/material-price-service";
import type { MaterialId } from "@/lib/instant-quote/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMaterialId(value: string | null): value is MaterialId {
  return value === "cold" || value === "hot" || value === "zinc" || value === "inox" || value === "alu" || value === "copper" || value === "brass";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const material = url.searchParams.get("material");
  const thicknessRaw = url.searchParams.get("thickness");

  if (material || thicknessRaw) {
    if (!isMaterialId(material)) {
      return NextResponse.json({ error: "Unsupported material" }, { status: 400 });
    }
    const thicknessMm = Number(thicknessRaw);
    if (!Number.isFinite(thicknessMm) || thicknessMm <= 0) {
      return NextResponse.json({ error: "Invalid thickness" }, { status: 400 });
    }

    const selection = getSelectedMaterialPrice(material, thicknessMm);
    return NextResponse.json(
      {
        material,
        thicknessMm,
        selection,
        upliftPct: 5,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(getMaterialPriceCatalog(), {
    headers: { "Cache-Control": "no-store" },
  });
}

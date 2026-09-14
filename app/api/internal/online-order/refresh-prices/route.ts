import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { refreshAtlantikPriceSnapshot } from "@/lib/server/instant-quote/refresh-atlantik-prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function configuredToken() {
  const token = process.env.STEEL_PRODUCT_PRICE_REFRESH_TOKEN?.trim() || "";
  return token.length >= 32 ? token : null;
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function equalSecret(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = configuredToken();
  if (!expected) return noStore({ ok: false, code: "NOT_CONFIGURED" }, 503);
  if (!equalSecret(bearerToken(request), expected)) {
    return noStore({ ok: false, code: "UNAUTHORIZED" }, 401);
  }

  try {
    const result = await refreshAtlantikPriceSnapshot();
    return noStore({
      ok: true,
      sourceId: result.sourceId,
      sourceDate: result.sourceDate,
      fetchedAt: result.fetchedAt,
      rowCount: result.rowCount,
      materialCounts: result.materialCounts,
    }, 200);
  } catch {
    // Do not disclose upstream, parser, filesystem or private-basis details.
    return noStore({ ok: false, code: "REFRESH_FAILED" }, 503);
  }
}

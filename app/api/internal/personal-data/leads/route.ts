import { NextRequest } from "next/server";
import { listLeads } from "@/lib/pd-admin/leads/repository";
import { pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";
import { pdSafeJson } from "@/lib/pd-admin/http/safe-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let context;
  try {
    context = requirePdApiContext(request, "VIEW_MASKED_LEADS");
    const query = request.nextUrl.searchParams;
    return pdSafeJson({ ok: true, ...listLeads(context, {
      page: Number(query.get("page") || "1"),
      requestId: query.get("requestId") || undefined,
      status: query.get("status") || undefined,
      source: query.get("source") || undefined,
      integrity: query.get("integrity") || undefined,
    }) });
  } catch (error) {
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

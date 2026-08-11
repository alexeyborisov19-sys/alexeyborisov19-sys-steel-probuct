import { NextRequest } from "next/server";
import { listAccessEvents } from "@/lib/pd-admin/audit/repository";
import { pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";
import { pdSafeJson } from "@/lib/pd-admin/http/safe-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let context;
  try {
    context = requirePdApiContext(request, "VIEW_ACCESS_LOG");
    return pdSafeJson({ ok: true, ...listAccessEvents(context, Number(request.nextUrl.searchParams.get("page") || "1")) });
  } catch (error) {
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

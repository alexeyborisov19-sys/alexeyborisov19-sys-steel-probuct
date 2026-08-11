import { NextRequest } from "next/server";
import { listConsentRecords } from "@/lib/pd-admin/consents/repository";
import { pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";
import { pdSafeJson } from "@/lib/pd-admin/http/safe-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let context;
  try {
    context = requirePdApiContext(request, "VIEW_CONSENT");
    const result = await listConsentRecords(context, Number(request.nextUrl.searchParams.get("page") || "1"));
    return pdSafeJson({ ok: true, ...result });
  } catch (error) {
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

import { NextRequest } from "next/server";
import { getConsentRecord } from "@/lib/pd-admin/consents/repository";
import { pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";
import { pdSafeError, pdSafeJson } from "@/lib/pd-admin/http/safe-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ auditId: string }> }) {
  let context;
  try {
    context = requirePdApiContext(request, "VIEW_CONSENT");
    const { auditId } = await params;
    const consent = await getConsentRecord(context, auditId);
    return consent ? pdSafeJson({ ok: true, consent }) : pdSafeError("NOT_FOUND", 404);
  } catch (error) {
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

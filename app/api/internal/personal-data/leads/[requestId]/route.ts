import { NextRequest } from "next/server";
import { getMaskedLead } from "@/lib/pd-admin/leads/repository";
import { pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";
import { pdSafeError, pdSafeJson } from "@/lib/pd-admin/http/safe-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  let context;
  try {
    context = requirePdApiContext(request, "VIEW_MASKED_LEADS");
    const { requestId } = await params;
    const lead = await getMaskedLead(context, requestId);
    return lead ? pdSafeJson({ ok: true, lead }) : pdSafeError("NOT_FOUND", 404);
  } catch (error) {
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

import { NextRequest } from "next/server";
import { assertPdMutationRequest } from "@/lib/pd-admin/auth/csrf";
import { revealLead } from "@/lib/pd-admin/leads/repository";
import { readPdJsonBody } from "@/lib/pd-admin/http/body";
import { assertJsonMutation } from "@/lib/pd-admin/http/request";
import { pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";
import { pdSafeError, pdSafeJson } from "@/lib/pd-admin/http/safe-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  let context;
  try {
    assertJsonMutation(request);
    context = requirePdApiContext(request, "REVEAL_CONTACTS");
    if (!context.config.sessionHashKey) throw new Error("Configuration unavailable");
    assertPdMutationRequest(request, context.session.csrfSecretHash, context.config.sessionHashKey);
    const body = await readPdJsonBody<{ legalBasis?: unknown }>(request, 8 * 1024);
    const { requestId } = await params;
    const lead = await revealLead(context, requestId, typeof body.legalBasis === "string" ? body.legalBasis : "");
    return lead ? pdSafeJson({ ok: true, lead }) : pdSafeError("NOT_FOUND", 404);
  } catch (error) {
    if (error instanceof Error && ["LEGAL_BASIS_REQUIRED", "MANAGER_NOT_ASSIGNED"].includes(error.message)) {
      return pdSafeError(error.message === "MANAGER_NOT_ASSIGNED" ? "PERMISSION_DENIED" : "VALIDATION_ERROR", error.message === "MANAGER_NOT_ASSIGNED" ? 403 : 400);
    }
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

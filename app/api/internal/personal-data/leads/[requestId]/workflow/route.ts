import { NextRequest } from "next/server";
import { assertPdMutationRequest } from "@/lib/pd-admin/auth/csrf";
import { updateWorkflow } from "@/lib/pd-admin/leads/repository";
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
    context = requirePdApiContext(request, "CHANGE_WORKFLOW");
    if (!context.config.sessionHashKey) throw new Error("Configuration unavailable");
    assertPdMutationRequest(request, context.session.csrfSecretHash, context.config.sessionHashKey);
    const body = await readPdJsonBody<{ status?: unknown }>(request, 8 * 1024);
    const { requestId } = await params;
    const updated = updateWorkflow(context, requestId, typeof body.status === "string" ? body.status : "");
    return updated ? pdSafeJson({ ok: true }) : pdSafeError("NOT_FOUND", 404);
  } catch (error) {
    if (error instanceof Error && ["INVALID_STATUS", "INVALID_TRANSITION"].includes(error.message)) return pdSafeError("VALIDATION_ERROR", 400);
    if (error instanceof Error && error.message === "MANAGER_NOT_ASSIGNED") return pdSafeError("PERMISSION_DENIED", 403);
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

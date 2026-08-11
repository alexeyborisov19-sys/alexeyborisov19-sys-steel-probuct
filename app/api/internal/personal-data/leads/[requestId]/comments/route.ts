import { NextRequest } from "next/server";
import { assertPdMutationRequest } from "@/lib/pd-admin/auth/csrf";
import { addLeadComment, editOwnLeadComment } from "@/lib/pd-admin/leads/repository";
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
    context = requirePdApiContext(request, "ADD_COMMENT");
    if (!context.config.sessionHashKey) throw new Error("Configuration unavailable");
    assertPdMutationRequest(request, context.session.csrfSecretHash, context.config.sessionHashKey);
    const body = await readPdJsonBody<{ body?: unknown }>(request, 16 * 1024);
    const { requestId } = await params;
    const result = addLeadComment(context, requestId, typeof body.body === "string" ? body.body : "");
    return result ? pdSafeJson({ ok: true, comment: result }, 201) : pdSafeError("NOT_FOUND", 404);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_COMMENT") return pdSafeError("VALIDATION_ERROR", 400);
    if (error instanceof Error && error.message === "MANAGER_NOT_ASSIGNED") return pdSafeError("PERMISSION_DENIED", 403);
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  let context;
  try {
    assertJsonMutation(request);
    context = requirePdApiContext(request, "EDIT_OWN_COMMENT");
    if (!context.config.sessionHashKey) throw new Error("Configuration unavailable");
    assertPdMutationRequest(request, context.session.csrfSecretHash, context.config.sessionHashKey);
    const body = await readPdJsonBody<{ commentId?: unknown; body?: unknown }>(request, 16 * 1024);
    const { requestId } = await params;
    const result = editOwnLeadComment(
      context,
      requestId,
      typeof body.commentId === "string" ? body.commentId : "",
      typeof body.body === "string" ? body.body : "",
    );
    return result ? pdSafeJson({ ok: true }) : pdSafeError("NOT_FOUND", 404);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_COMMENT") return pdSafeError("VALIDATION_ERROR", 400);
    if (error instanceof Error && error.message === "MANAGER_NOT_ASSIGNED") return pdSafeError("PERMISSION_DENIED", 403);
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

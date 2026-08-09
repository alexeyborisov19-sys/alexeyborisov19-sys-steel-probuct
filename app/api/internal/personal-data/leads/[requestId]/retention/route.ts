import { NextRequest } from "next/server";
import { assertPdMutationRequest } from "@/lib/pd-admin/auth/csrf";
import { updateRetentionOverride } from "@/lib/pd-admin/leads/repository";
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
    context = requirePdApiContext(request, "CHANGE_RETENTION");
    if (!context.config.sessionHashKey) throw new Error("Configuration unavailable");
    assertPdMutationRequest(request, context.session.csrfSecretHash, context.config.sessionHashKey);
    const body = await readPdJsonBody<{ until?: unknown; reason?: unknown }>(request, 8 * 1024);
    const updated = updateRetentionOverride(context, (await params).requestId, {
      until: body.until === null ? null : typeof body.until === "string" ? body.until : null,
      reason: typeof body.reason === "string" ? body.reason : "",
    });
    return updated ? pdSafeJson({ ok: true }) : pdSafeError("NOT_FOUND", 404);
  } catch (error) {
    if (error instanceof Error && error.message === "STEP_UP_REQUIRED") return pdSafeError("STEP_UP_REQUIRED", 403);
    if (error instanceof Error && ["LEGAL_BASIS_REQUIRED", "INVALID_RETENTION"].includes(error.message)) return pdSafeError("VALIDATION_ERROR", 400);
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

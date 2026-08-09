import { NextRequest } from "next/server";
import { assertPdMutationRequest } from "@/lib/pd-admin/auth/csrf";
import { getUser, updateUser } from "@/lib/pd-admin/users/repository";
import { readPdJsonBody } from "@/lib/pd-admin/http/body";
import { assertJsonMutation } from "@/lib/pd-admin/http/request";
import { pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";
import { pdSafeError, pdSafeJson } from "@/lib/pd-admin/http/safe-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let context;
  try {
    context = requirePdApiContext(request, "MANAGE_USERS");
    const user = getUser(context, (await params).id);
    return user ? pdSafeJson({ ok: true, user }) : pdSafeError("NOT_FOUND", 404);
  } catch (error) {
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let context;
  try {
    assertJsonMutation(request);
    context = requirePdApiContext(request, "MANAGE_USERS");
    if (!context.config.sessionHashKey) throw new Error("Configuration unavailable");
    assertPdMutationRequest(request, context.session.csrfSecretHash, context.config.sessionHashKey);
    const body = await readPdJsonBody<{ action?: unknown; role?: unknown; temporaryPassword?: unknown }>(request, 16 * 1024);
    const allowedActions = ["change-role", "deactivate", "activate", "unlock", "reset-password", "revoke-sessions"] as const;
    if (!allowedActions.includes(body.action as (typeof allowedActions)[number])) return pdSafeError("VALIDATION_ERROR", 400);
    const updated = updateUser(context, (await params).id, {
      action: body.action as (typeof allowedActions)[number],
      role: typeof body.role === "string" ? body.role : undefined,
      temporaryPassword: typeof body.temporaryPassword === "string" ? body.temporaryPassword : undefined,
    });
    return updated ? pdSafeJson({ ok: true }) : pdSafeError("NOT_FOUND", 404);
  } catch (error) {
    if (error instanceof Error && error.message === "STEP_UP_REQUIRED") return pdSafeError("STEP_UP_REQUIRED", 403);
    if (error instanceof Error && ["LAST_ADMIN", "SELF_DEACTIVATION", "INVALID_ROLE", "PASSWORD_REQUIRED"].includes(error.message)) return pdSafeError("CONFLICT", 409);
    if (error instanceof Error && /^Password/.test(error.message)) return pdSafeError("VALIDATION_ERROR", 400);
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

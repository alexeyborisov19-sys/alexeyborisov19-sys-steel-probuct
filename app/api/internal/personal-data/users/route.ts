import { NextRequest } from "next/server";
import { assertPdMutationRequest } from "@/lib/pd-admin/auth/csrf";
import { createUser, listUsers } from "@/lib/pd-admin/users/repository";
import { readPdJsonBody } from "@/lib/pd-admin/http/body";
import { assertJsonMutation } from "@/lib/pd-admin/http/request";
import { pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";
import { pdPrivateHeaders, pdSafeError, pdSafeJson } from "@/lib/pd-admin/http/safe-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let context;
  try {
    context = requirePdApiContext(request, "MANAGE_USERS");
    return pdSafeJson({ ok: true, users: listUsers(context) });
  } catch (error) {
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

export async function POST(request: NextRequest) {
  let context;
  try {
    assertJsonMutation(request);
    context = requirePdApiContext(request, "MANAGE_USERS");
    if (!context.config.sessionHashKey) throw new Error("Configuration unavailable");
    assertPdMutationRequest(request, context.session.csrfSecretHash, context.config.sessionHashKey);
    const body = await readPdJsonBody<{
      username?: unknown;
      displayName?: unknown;
      role?: unknown;
      temporaryPassword?: unknown;
    }>(request, 16 * 1024);
    const result = createUser(context, {
      username: typeof body.username === "string" ? body.username : "",
      displayName: typeof body.displayName === "string" ? body.displayName : "",
      role: typeof body.role === "string" ? body.role : "",
      temporaryPassword: typeof body.temporaryPassword === "string" ? body.temporaryPassword : "",
    });
    return new Response(JSON.stringify({ ok: true, user: result }), { status: 201, headers: pdPrivateHeaders({ "Content-Type": "application/json" }) });
  } catch (error) {
    if (error instanceof Error && error.message === "STEP_UP_REQUIRED") return pdSafeError("STEP_UP_REQUIRED", 403);
    if (error instanceof Error && /^(INVALID_|Password)/.test(error.message)) return pdSafeError("VALIDATION_ERROR", 400);
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

import { NextRequest, NextResponse } from "next/server";
import { assertPdMutationRequest } from "@/lib/pd-admin/auth/csrf";
import { changeAdministrativePassword } from "@/lib/pd-admin/auth/service";
import { readPdJsonBody } from "@/lib/pd-admin/http/body";
import { assertJsonMutation } from "@/lib/pd-admin/http/request";
import { pdPrivateHeaders } from "@/lib/pd-admin/http/safe-response";
import { pdRouteError, requirePdApiContext, setPdSessionCookies } from "@/lib/pd-admin/http/route-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let context;
  try {
    assertJsonMutation(request);
    context = requirePdApiContext(request, undefined, { allowPasswordChange: true });
    if (!context.config.sessionHashKey) throw new Error("Configuration unavailable");
    assertPdMutationRequest(request, context.session.csrfSecretHash, context.config.sessionHashKey);
    const body = await readPdJsonBody<{
      currentPassword?: unknown;
      newPassword?: unknown;
      confirmPassword?: unknown;
    }>(request, 16 * 1024);
    const session = changeAdministrativePassword(context, {
      currentPassword: typeof body.currentPassword === "string" ? body.currentPassword : "",
      newPassword: typeof body.newPassword === "string" ? body.newPassword : "",
      confirmPassword: typeof body.confirmPassword === "string" ? body.confirmPassword : "",
    });
    const response = NextResponse.json({ ok: true, next: "/internal/personal-data" }, { headers: pdPrivateHeaders() });
    setPdSessionCookies(response, session);
    return response;
  } catch (error) {
    if (error instanceof Error && ["INVALID_PASSWORD", "INVALID_NEW_PASSWORD"].includes(error.message)) {
      return NextResponse.json({ ok: false, code: "VALIDATION_ERROR" }, { status: 400, headers: pdPrivateHeaders() });
    }
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

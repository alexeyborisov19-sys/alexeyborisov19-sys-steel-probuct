import { NextRequest, NextResponse } from "next/server";
import { assertPdMutationRequest } from "@/lib/pd-admin/auth/csrf";
import { stepUpAdministrativeSession } from "@/lib/pd-admin/auth/service";
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
    context = requirePdApiContext(request);
    if (!context.config.sessionHashKey) throw new Error("Configuration unavailable");
    assertPdMutationRequest(request, context.session.csrfSecretHash, context.config.sessionHashKey);
    const body = await readPdJsonBody<{ password?: unknown }>(request, 8 * 1024);
    const result = stepUpAdministrativeSession(
      context,
      typeof body.password === "string" ? body.password : "",
    );
    const response = NextResponse.json({ ok: true, stepUpUntil: result.stepUpUntil }, { headers: pdPrivateHeaders() });
    setPdSessionCookies(response, result.session);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PASSWORD") {
      return NextResponse.json({ ok: false, code: "VALIDATION_ERROR" }, { status: 400, headers: pdPrivateHeaders() });
    }
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

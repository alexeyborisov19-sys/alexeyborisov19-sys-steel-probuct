import { NextRequest, NextResponse } from "next/server";
import { recordAccessEvent } from "@/lib/pd-admin/audit/chain";
import { assertPdMutationRequest } from "@/lib/pd-admin/auth/csrf";
import { revokeSession } from "@/lib/pd-admin/auth/session-store";
import { assertJsonMutation } from "@/lib/pd-admin/http/request";
import { pdPrivateHeaders } from "@/lib/pd-admin/http/safe-response";
import { clearPdSessionCookies, pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let context;
  try {
    assertJsonMutation(request);
    context = requirePdApiContext(request, undefined, { allowPasswordChange: true });
    if (!context.config.sessionHashKey || !context.config.auditChainKey) throw new Error("Configuration unavailable");
    assertPdMutationRequest(request, context.session.csrfSecretHash, context.config.sessionHashKey);
    revokeSession(context.database, context.session.id, "USER_LOGOUT");
    recordAccessEvent(context.database, {
      userId: context.user.id,
      sessionId: context.session.id,
      action: "LOGOUT",
      targetType: "SESSION",
      targetId: context.session.id,
      legalBasis: "ADMINISTRATIVE_ACCESS_CONTROL",
      result: "SUCCESS",
      ipHash: context.ipHash,
      metadata: { code: "USER_INITIATED" },
    }, context.config.auditChainKey);
    const response = NextResponse.json({ ok: true }, { headers: pdPrivateHeaders() });
    clearPdSessionCookies(response);
    return response;
  } catch (error) {
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

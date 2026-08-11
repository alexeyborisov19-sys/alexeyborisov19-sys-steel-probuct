import { NextRequest, NextResponse } from "next/server";
import { recordAccessEvent } from "@/lib/pd-admin/audit/chain";
import { assertPdMutationRequest } from "@/lib/pd-admin/auth/csrf";
import {
  listUserSessions,
  revokeAllUserSessions,
  revokeOtherUserSessions,
  revokeSession,
} from "@/lib/pd-admin/auth/session-store";
import { readPdJsonBody } from "@/lib/pd-admin/http/body";
import { assertJsonMutation } from "@/lib/pd-admin/http/request";
import { pdPrivateHeaders, pdSafeJson } from "@/lib/pd-admin/http/safe-response";
import { clearPdSessionCookies, pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let context;
  try {
    context = requirePdApiContext(request, undefined, { allowPasswordChange: true });
    const sessions = listUserSessions(context.database, context.user.id, context.session.id);
    return pdSafeJson({
      ok: true,
      sessions: context.user.mustChangePassword ? sessions.filter((session) => session.current) : sessions,
    });
  } catch (error) {
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

export async function DELETE(request: NextRequest) {
  let context;
  try {
    assertJsonMutation(request);
    context = requirePdApiContext(request, undefined, { allowPasswordChange: true });
    if (!context.config.sessionHashKey || !context.config.auditChainKey) throw new Error("Configuration unavailable");
    assertPdMutationRequest(request, context.session.csrfSecretHash, context.config.sessionHashKey);
    const body = await readPdJsonBody<{ mode?: unknown; sessionId?: unknown }>(request, 8 * 1024);
    const mode = body.mode;
    if (context.user.mustChangePassword && !(mode === "one" && body.sessionId === context.session.id)) {
      return NextResponse.json({ ok: false, code: "PERMISSION_DENIED" }, { status: 403, headers: pdPrivateHeaders() });
    }
    let affected = 0;
    let clearCurrent = false;
    if (mode === "others") {
      affected = Number(revokeOtherUserSessions(context.database, context.user.id, context.session.id, "USER_REVOKED_OTHER_SESSIONS"));
    } else if (mode === "all") {
      affected = Number(revokeAllUserSessions(context.database, context.user.id, "USER_REVOKED_ALL_SESSIONS"));
      clearCurrent = true;
    } else if (mode === "one" && typeof body.sessionId === "string") {
      const target = context.database.prepare("SELECT id FROM sessions WHERE id = ? AND user_id = ?")
        .get(body.sessionId, context.user.id) as { id: string } | undefined;
      if (!target) return NextResponse.json({ ok: false, code: "NOT_FOUND" }, { status: 404, headers: pdPrivateHeaders() });
      revokeSession(context.database, target.id, "USER_REVOKED_SESSION");
      affected = 1;
      clearCurrent = target.id === context.session.id;
    } else {
      return NextResponse.json({ ok: false, code: "VALIDATION_ERROR" }, { status: 400, headers: pdPrivateHeaders() });
    }
    recordAccessEvent(context.database, {
      userId: context.user.id,
      sessionId: context.session.id,
      action: "SESSIONS_REVOKED",
      targetType: "SESSION",
      targetId: mode === "one" && typeof body.sessionId === "string" ? body.sessionId : context.user.id,
      legalBasis: "ADMINISTRATIVE_ACCESS_CONTROL",
      result: "SUCCESS",
      ipHash: context.ipHash,
      metadata: { count: affected, code: String(mode).toUpperCase() },
    }, context.config.auditChainKey);
    const response = NextResponse.json({ ok: true, affected }, { headers: pdPrivateHeaders() });
    if (clearCurrent) clearPdSessionCookies(response);
    return response;
  } catch (error) {
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

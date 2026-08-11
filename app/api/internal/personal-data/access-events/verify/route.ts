import { NextRequest } from "next/server";
import { verifyAuditForUser } from "@/lib/pd-admin/audit/repository";
import { assertPdMutationRequest } from "@/lib/pd-admin/auth/csrf";
import { assertJsonMutation } from "@/lib/pd-admin/http/request";
import { pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";
import { pdSafeJson } from "@/lib/pd-admin/http/safe-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let context;
  try {
    assertJsonMutation(request);
    context = requirePdApiContext(request, "VERIFY_ACCESS_LOG");
    if (!context.config.sessionHashKey) throw new Error("Configuration unavailable");
    assertPdMutationRequest(request, context.session.csrfSecretHash, context.config.sessionHashKey);
    return pdSafeJson({ ok: true, verification: verifyAuditForUser(context) });
  } catch (error) {
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

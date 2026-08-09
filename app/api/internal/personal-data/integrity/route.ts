import { NextRequest } from "next/server";
import { assertPdMutationRequest } from "@/lib/pd-admin/auth/csrf";
import { listIntegrityRuns, runIntegrityCheck } from "@/lib/pd-admin/integrity/service";
import { assertJsonMutation } from "@/lib/pd-admin/http/request";
import { pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";
import { pdSafeJson } from "@/lib/pd-admin/http/safe-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let context;
  try {
    context = requirePdApiContext(request, "VIEW_INTEGRITY");
    return pdSafeJson({ ok: true, runs: listIntegrityRuns(context) });
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
    context = requirePdApiContext(request, "RUN_INTEGRITY_CHECK");
    if (!context.config.sessionHashKey) throw new Error("Configuration unavailable");
    assertPdMutationRequest(request, context.session.csrfSecretHash, context.config.sessionHashKey);
    return pdSafeJson({ ok: true, run: await runIntegrityCheck(context) }, 201);
  } catch (error) {
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

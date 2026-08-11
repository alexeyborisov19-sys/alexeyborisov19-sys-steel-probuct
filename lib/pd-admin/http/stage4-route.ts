import type { NextRequest } from "next/server";
import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import type { PdPermission } from "@/lib/pd-admin/auth/permissions";
import { assertPdMutationRequest } from "@/lib/pd-admin/auth/csrf";
import { readPdJsonBody } from "@/lib/pd-admin/http/body";
import { assertJsonMutation } from "@/lib/pd-admin/http/request";
import { pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";
import { pdSafeJson } from "@/lib/pd-admin/http/safe-response";

type MaybePromise<T> = T | Promise<T>;

export async function pdStage4Get(
  request: NextRequest,
  permission: PdPermission,
  action: (context: PdAuthContext) => MaybePromise<unknown>,
) {
  let context: PdAuthContext | undefined;
  try {
    context = requirePdApiContext(request, permission);
    return pdSafeJson({ ok: true, data: await action(context) });
  } catch (error) {
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

export async function pdStage4Mutation(
  request: NextRequest,
  permission: PdPermission,
  action: (context: PdAuthContext, body: Record<string, unknown>) => MaybePromise<unknown>,
  status = 200,
) {
  let context: PdAuthContext | undefined;
  try {
    assertJsonMutation(request);
    context = requirePdApiContext(request, permission);
    if (!context.config.sessionHashKey) throw new Error("Configuration unavailable");
    assertPdMutationRequest(request, context.session.csrfSecretHash, context.config.sessionHashKey);
    const body = await readPdJsonBody<Record<string, unknown>>(request, 128 * 1024);
    return pdSafeJson({ ok: true, data: await action(context, body) }, status);
  } catch (error) {
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

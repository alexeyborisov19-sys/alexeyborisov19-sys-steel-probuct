import { NextRequest } from "next/server";
import { assertPdMutationRequest } from "@/lib/pd-admin/auth/csrf";
import { searchContact } from "@/lib/pd-admin/leads/repository";
import { readPdJsonBody } from "@/lib/pd-admin/http/body";
import { assertJsonMutation } from "@/lib/pd-admin/http/request";
import { pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";
import { pdSafeError, pdSafeJson } from "@/lib/pd-admin/http/safe-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let context;
  try {
    assertJsonMutation(request);
    context = requirePdApiContext(request, "SEARCH_CONTACT");
    if (!context.config.sessionHashKey) throw new Error("Configuration unavailable");
    assertPdMutationRequest(request, context.session.csrfSecretHash, context.config.sessionHashKey);
    const body = await readPdJsonBody<{ kind?: unknown; value?: unknown; legalBasis?: unknown }>(request, 16 * 1024);
    if (body.kind !== "phone" && body.kind !== "email") return pdSafeError("VALIDATION_ERROR", 400);
    const items = searchContact(context, {
      kind: body.kind,
      value: typeof body.value === "string" ? body.value : "",
      legalBasis: typeof body.legalBasis === "string" ? body.legalBasis : "",
    });
    return pdSafeJson({ ok: true, items });
  } catch (error) {
    if (error instanceof Error && ["LEGAL_BASIS_REQUIRED", "INVALID_CONTACT"].includes(error.message)) return pdSafeError("VALIDATION_ERROR", 400);
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

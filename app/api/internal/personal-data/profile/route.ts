import { NextRequest } from "next/server";
import { isStepUpActive } from "@/lib/pd-admin/auth/session";
import { pdSafeJson } from "@/lib/pd-admin/http/safe-response";
import { pdRouteError, requirePdApiContext } from "@/lib/pd-admin/http/route-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let context;
  try {
    context = requirePdApiContext(request, undefined, { allowPasswordChange: true });
    return pdSafeJson({
      ok: true,
      user: {
        id: context.user.id,
        username: context.user.username,
        displayName: context.user.displayName,
        role: context.user.role,
        mustChangePassword: context.user.mustChangePassword,
      },
      session: {
        id: context.session.id,
        expiresAt: context.session.expiresAt,
        absoluteExpiresAt: context.session.absoluteExpiresAt,
        stepUpActive: isStepUpActive(context.session.stepUpUntil),
        stepUpUntil: context.session.stepUpUntil,
      },
    });
  } catch (error) {
    return pdRouteError(error);
  } finally {
    context?.close();
  }
}

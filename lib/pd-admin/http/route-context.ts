import type { NextRequest, NextResponse } from "next/server";
import type { PdPermission } from "@/lib/pd-admin/auth/permissions";
import { PdAuthorizationError } from "@/lib/pd-admin/auth/permissions";
import { PdCsrfError } from "@/lib/pd-admin/auth/csrf";
import {
  authenticatePdSession,
  PdAuthenticationError,
  PdPasswordChangeRequiredError,
  PdPermissionError,
  type PdAuthContext,
} from "@/lib/pd-admin/auth/context";
import {
  csrfCookieOptions,
  PD_CSRF_COOKIE,
  PD_SESSION_COOKIE,
  sessionCookieOptions,
  type NewSession,
} from "@/lib/pd-admin/auth/session";
import { readPdAdminConfig } from "@/lib/pd-admin/config";
import { administrativeRequestHashes } from "@/lib/pd-admin/http/request";
import { PdRequestRejectedError } from "@/lib/pd-admin/http/request";
import { pdSafeError } from "@/lib/pd-admin/http/safe-response";
import { PdSafeFileError } from "@/lib/pd-admin/storage/safe-files";
import { PdStage4Error } from "@/lib/pd-admin/stage4/common";
import { PdBodyError } from "@/lib/pd-admin/http/body";

export function requirePdApiContext(
  request: NextRequest,
  permission?: PdPermission,
  options: { allowPasswordChange?: boolean } = {},
) {
  const config = readPdAdminConfig();
  if (!config.enabled || !config.sessionHashKey) throw new PdAuthenticationError();
  const hashes = administrativeRequestHashes(request.headers, config.sessionHashKey);
  return authenticatePdSession({
    sessionToken: request.cookies.get(PD_SESSION_COOKIE)?.value,
    csrfToken: request.cookies.get(PD_CSRF_COOKIE)?.value,
    ipHash: hashes.ipHash,
    userAgentHash: hashes.userAgentHash,
    permission,
    allowPasswordChange: options.allowPasswordChange,
  });
}

export function setPdSessionCookies(
  response: NextResponse,
  session: NewSession,
) {
  const maximumAge = Math.max(1, Math.floor((Date.parse(session.absoluteExpiresAt) - Date.now()) / 1_000));
  const sessionCookie = sessionCookieOptions(maximumAge);
  response.cookies.set(sessionCookie.name, session.token, sessionCookie);
  const csrfCookie = csrfCookieOptions(maximumAge);
  response.cookies.set(csrfCookie.name, session.csrfToken, csrfCookie);
}

export function clearPdSessionCookies(response: NextResponse) {
  const sessionCookie = sessionCookieOptions(0);
  response.cookies.set(PD_SESSION_COOKIE, "", {
    ...sessionCookie,
    expires: new Date(0),
  });
  const csrfCookie = csrfCookieOptions(0);
  response.cookies.set(PD_CSRF_COOKIE, "", {
    ...csrfCookie,
    expires: new Date(0),
  });
}

export function pdRouteError(error: unknown) {
  if (error instanceof PdAuthenticationError) return pdSafeError("AUTH_REQUIRED", 401);
  if (error instanceof PdPasswordChangeRequiredError) return pdSafeError("AUTH_REQUIRED", 403);
  if (error instanceof PdPermissionError || error instanceof PdAuthorizationError) return pdSafeError("PERMISSION_DENIED", 403);
  if (error instanceof PdCsrfError || error instanceof PdRequestRejectedError) return pdSafeError("CSRF_REJECTED", 403);
  if (error instanceof PdSafeFileError) return pdSafeError("NOT_FOUND", 404);
  if (error instanceof PdBodyError) return pdSafeError("VALIDATION_ERROR", 400);
  if (error instanceof PdStage4Error) {
    const status = error.code === "NOT_FOUND" ? 404
      : error.code === "CONFLICT" ? 409
        : error.code === "STEP_UP_REQUIRED" ? 403
          : error.code === "BLOCKED" ? 423
            : 400;
    return pdSafeError(error.code, status);
  }
  return pdSafeError("INTERNAL_ERROR", 500);
}

export type { PdAuthContext };

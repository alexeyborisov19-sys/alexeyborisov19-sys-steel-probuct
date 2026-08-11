import { NextRequest, NextResponse } from "next/server";
import { createPreAuthChallenge, verifyPreAuthChallenge } from "@/lib/pd-admin/auth/preauth";
import { loginAdministrativeUser, PdLoginFailedError, genericLoginMessage } from "@/lib/pd-admin/auth/service";
import { PD_PREAUTH_COOKIE, preAuthCookieOptions } from "@/lib/pd-admin/auth/session";
import { readPdAdminConfig } from "@/lib/pd-admin/config";
import { readPdJsonBody } from "@/lib/pd-admin/http/body";
import { assertJsonMutation, trustedAdministrativeIp } from "@/lib/pd-admin/http/request";
import { pdPrivateHeaders } from "@/lib/pd-admin/http/safe-response";
import { setPdSessionCookies } from "@/lib/pd-admin/http/route-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = readPdAdminConfig();
    if (!config.enabled || !config.sessionHashKey) return new NextResponse("Not Found", { status: 404, headers: pdPrivateHeaders() });
    const challenge = createPreAuthChallenge(config.sessionHashKey);
    const response = NextResponse.json({ ok: true, preAuthToken: challenge.token }, { headers: pdPrivateHeaders() });
    const options = preAuthCookieOptions();
    response.cookies.set(options.name, challenge.cookieValue, options);
    return response;
  } catch {
    return new NextResponse("Not Found", { status: 404, headers: pdPrivateHeaders() });
  }
}

export async function POST(request: NextRequest) {
  try {
    assertJsonMutation(request);
    const config = readPdAdminConfig();
    if (!config.enabled || !config.sessionHashKey) return new NextResponse("Not Found", { status: 404, headers: pdPrivateHeaders() });
    const body = await readPdJsonBody<{ username?: unknown; password?: unknown; preAuthToken?: unknown }>(request, 16 * 1024);
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    const preAuthToken = typeof body.preAuthToken === "string" ? body.preAuthToken : "";
    if (!verifyPreAuthChallenge(
      preAuthToken,
      request.cookies.get(PD_PREAUTH_COOKIE)?.value,
      config.sessionHashKey,
    )) throw new PdLoginFailedError();
    const result = loginAdministrativeUser({
      username,
      password,
      ipAddress: trustedAdministrativeIp(request.headers),
      userAgent: request.headers.get("user-agent") || "unknown",
    });
    const response = NextResponse.json({
      ok: true,
      next: result.mustChangePassword
        ? "/internal/personal-data/change-password"
        : "/internal/personal-data",
    }, { headers: pdPrivateHeaders() });
    setPdSessionCookies(response, result.session);
    const preAuthCookie = preAuthCookieOptions(0);
    response.cookies.set(PD_PREAUTH_COOKIE, "", {
      ...preAuthCookie,
      expires: new Date(0),
    });
    return response;
  } catch (error) {
    const message = error instanceof PdLoginFailedError ? error.message : genericLoginMessage;
    return NextResponse.json({ ok: false, message }, { status: 401, headers: pdPrivateHeaders() });
  }
}

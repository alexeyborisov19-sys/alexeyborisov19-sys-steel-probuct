import { isIP } from "node:net";
import { hashAdministrativeFingerprint } from "@/lib/pd-admin/auth/session-store";
import { siteConfig } from "@/lib/site";

export class PdRequestRejectedError extends Error {
  readonly code = "PD_REQUEST_REJECTED";
}

export function trustedAdministrativeIp(headers: Headers) {
  if (process.env.TRUST_NGINX_PROXY !== "true") return "unknown";
  const value = headers.get("x-real-ip")?.trim() ?? "";
  return isIP(value) ? value : "unknown";
}

export function administrativeRequestHashes(headers: Headers, key: string) {
  const ip = trustedAdministrativeIp(headers);
  const userAgent = headers.get("user-agent")?.slice(0, 512) || "unknown";
  return {
    ipHash: hashAdministrativeFingerprint(ip, key, "ip"),
    userAgentHash: hashAdministrativeFingerprint(userAgent, key, "user-agent"),
  };
}

export function assertAdministrativeOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (!origin || fetchSite === "cross-site") throw new PdRequestRejectedError();
  const requestOrigin = new URL(request.url).origin;
  const canonicalOrigin = new URL(siteConfig.url).origin;
  if (process.env.NODE_ENV === "production") {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.trim().toLowerCase();
    const forwardedHost = (request.headers.get("x-forwarded-host") || request.headers.get("host"))
      ?.split(",", 1)[0]
      ?.trim()
      .toLowerCase();
    if (forwardedProto !== "https" || forwardedHost !== new URL(siteConfig.url).host) {
      throw new PdRequestRejectedError();
    }
  }
  const allowed = process.env.NODE_ENV === "production"
    ? origin === canonicalOrigin
    : origin === requestOrigin || origin === canonicalOrigin;
  if (!allowed) throw new PdRequestRejectedError();
}

export function assertJsonMutation(request: Request) {
  assertAdministrativeOrigin(request);
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) throw new PdRequestRejectedError();
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new PdRequestRejectedError();
}

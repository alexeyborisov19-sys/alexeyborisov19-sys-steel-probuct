import { createHash } from "node:crypto";
import { isIP } from "node:net";

const UNKNOWN_CLIENT = "unknown";

/**
 * Next.js does not expose the peer socket address to route handlers. In
 * production we therefore accept exactly one header written by our Nginx
 * reverse proxy. The public must not be able to reach the Node.js port.
 *
 * x-forwarded-for is deliberately ignored because a browser can forge it.
 */
export function getTrustedClientIp(request: Request) {
  if (process.env.TRUST_NGINX_PROXY !== "true") return UNKNOWN_CLIENT;
  const candidate = request.headers.get("x-real-ip")?.trim() ?? "";
  return isIP(candidate) ? candidate : UNKNOWN_CLIENT;
}

export function hashClientIp(ip: string) {
  const configuredSalt = process.env.IP_HASH_SALT;
  if (process.env.NODE_ENV === "production" && !configuredSalt) {
    throw new Error("IP_HASH_SALT is required in production");
  }
  const salt = configuredSalt || "steelprodukt-local-rate-limit";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function clientKey(request: Request) {
  return hashClientIp(getTrustedClientIp(request));
}

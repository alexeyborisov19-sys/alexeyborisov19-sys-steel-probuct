type SafeRoute = "assistant" | "assistant-lead" | "quote";
type SafeResult =
  | "accepted"
  | "antivirus_blocked"
  | "bad_request"
  | "cross_site_rejected"
  | "duplicate"
  | "internal_error"
  | "payload_too_large"
  | "rate_limited"
  | "stored"
  | "upstream_fallback";

export function safeSecurityLog(route: SafeRoute, result: SafeResult, ipHash: string) {
  console.info(JSON.stringify({
    event: "website_api",
    route,
    timestamp: new Date().toISOString(),
    result,
    ipHash,
  }));
}

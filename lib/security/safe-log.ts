type SafeRoute = "assistant" | "assistant-lead" | "quote";
type SafeResult =
  | "accepted"
  | "antivirus_blocked"
  | "bad_request"
  | "configuration_error"
  | "consent_audit_deferred"
  | "cross_site_rejected"
  | "duplicate"
  | "internal_error"
  | "payload_too_large"
  | "rate_limited"
  | "smtp_deferred"
  | "storage_error"
  | "stored"
  | "upstream_fallback";

type SafeLogContext = {
  requestId?: string;
  code?: string;
};

export function safeSecurityLog(
  route: SafeRoute,
  result: SafeResult,
  ipHash: string,
  context: SafeLogContext = {},
) {
  console.info(JSON.stringify({
    event: "website_api",
    route,
    timestamp: new Date().toISOString(),
    result,
    ipHash,
    ...(context.requestId ? { requestId: context.requestId } : {}),
    ...(context.code ? { code: context.code } : {}),
  }));
}

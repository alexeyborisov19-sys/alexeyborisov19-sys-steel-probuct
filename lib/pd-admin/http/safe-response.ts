const privateResponseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

const safeErrorCodes = new Set([
  "ADMIN_DISABLED",
  "AUTH_REQUIRED",
  "PERMISSION_DENIED",
  "CSRF_REJECTED",
  "STEP_UP_REQUIRED",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);

export function pdPrivateHeaders(extra: HeadersInit = {}) {
  return new Headers({ ...privateResponseHeaders, ...Object.fromEntries(new Headers(extra)) });
}

export function pdSafeError(code: string, status: number) {
  const safeCode = safeErrorCodes.has(code) ? code : "INTERNAL_ERROR";
  return Response.json({ ok: false, code: safeCode }, {
    status,
    headers: pdPrivateHeaders(),
  });
}

export function pdSafeJson<T>(body: T, status = 200) {
  return Response.json(body, { status, headers: pdPrivateHeaders() });
}

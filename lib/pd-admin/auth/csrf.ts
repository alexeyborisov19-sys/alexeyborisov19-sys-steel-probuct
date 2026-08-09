import { siteConfig } from "@/lib/site";
import { verifyCsrfToken } from "@/lib/pd-admin/auth/session";

export class PdCsrfError extends Error {
  readonly code = "PD_CSRF_REJECTED";

  constructor() {
    super("Administrative request origin or CSRF token is invalid");
    this.name = "PdCsrfError";
  }
}

export function assertPdMutationRequest(
  request: Request,
  expectedCsrfHash: string,
  sessionHashKey: string,
) {
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(siteConfig.url).origin;
  const requestOrigin = new URL(request.url).origin;
  const allowed = process.env.NODE_ENV === "production"
    ? origin === expectedOrigin
    : origin === expectedOrigin || origin === requestOrigin;
  if (!origin || !allowed) throw new PdCsrfError();
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin") throw new PdCsrfError();
  const csrfToken = request.headers.get("x-steelprodukt-csrf")?.trim();
  if (!csrfToken || !verifyCsrfToken(csrfToken, expectedCsrfHash, sessionHashKey)) {
    throw new PdCsrfError();
  }
}

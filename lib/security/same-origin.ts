import { siteConfig } from "@/lib/site";

export class CrossSiteRequestError extends Error {
  constructor() {
    super("Cross-site request rejected");
    this.name = "CrossSiteRequestError";
  }
}

/**
 * Browser form/fetch requests carry Origin and Fetch Metadata headers. Reject
 * cross-site mutations while still allowing trusted server-to-server health
 * checks, which may legitimately omit both headers.
 */
export function assertSameOriginRequest(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") {
    throw new CrossSiteRequestError();
  }

  const origin = request.headers.get("origin");
  if (!origin || origin === "null") {
    if (origin === "null") throw new CrossSiteRequestError();
    return;
  }

  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    throw new CrossSiteRequestError();
  }

  const canonicalOrigin = new URL(siteConfig.url).origin;
  if (origin !== requestOrigin && origin !== canonicalOrigin) {
    throw new CrossSiteRequestError();
  }
}

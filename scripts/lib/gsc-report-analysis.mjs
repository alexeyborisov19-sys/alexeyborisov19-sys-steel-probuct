import { inspectStructuredData } from "./structured-data-audit.mjs";

// Only the origin's empty path and '/' are equivalent here. Do not hide
// non-root trailing-slash, query, protocol, subdomain or fragment differences.
export function sameCanonical(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string") return false;
  try {
    const a = new URL(actual);
    const b = new URL(expected);
    if (![a, b].every((url) => ["https:", "http:"].includes(url.protocol) && !url.username && !url.password)) return false;
    if (actual === expected) return true;
    return /^https?:\/\/[^/?#]+\/?$/.test(actual)
      && /^https?:\/\/[^/?#]+\/?$/.test(expected)
      && actual.replace(/\/$/, "") === expected.replace(/\/$/, "");
  } catch { return false; }
}

function productCommerceOnly(type, issue) {
  // Keep all other/unknown ERRORs critical. A translated message we don't know
  // stays unresolved rather than being silently downgraded.
  return ["Product snippets", "Описания товара"].includes(type)
    && [
      /^Задайте значение для одного из следующих элементов данных: "(?:hasVariant\.)?offers", "review" или "aggregateRating"\.$/,
      /^Either "(?:hasVariant\.)?offers", "review", or "aggregateRating" should be specified\.?$/,
    ].some((pattern) => pattern.test(issue.issueMessage ?? ""));
}

export function analyzeGscReport(report, evidence = { pages: [] }) {
  if (!report || !Array.isArray(report.inspections) || !Array.isArray(report.technical)) {
    throw new Error("Expected a GSC report with inspections and technical arrays");
  }
  if (!Array.isArray(evidence.pages)) throw new Error("Evidence must contain a pages array");
  const basicErrors = [];
  for (const page of report.technical.filter((page) => page.inSitemap === true)) {
    const add = (code) => basicErrors.push({ url: page.url, code });
    if (page.http !== 200) add("HTTP_NOT_200");
    if (!Array.isArray(page.canonical) || page.canonical.length !== 1 || !sameCanonical(page.canonical[0], page.url)) add("CANONICAL_MISMATCH");
    if (/noindex/i.test([...(page.robots ?? []), page.xRobotsTag ?? ""].join(" "))) add("NOINDEX");
    if (!page.title?.trim()) add("TITLE_MISSING");
    if (page.h1Count !== 1) add("H1_COUNT");
  }
  const storedSchemaErrors = [];
  const storedEligibilityLimitations = [];
  const unresolvedStoredVerdicts = [];
  const pages = report.inspections.map((page) => {
    const rich = page.richResults ?? {};
    let errorCount = 0;
    for (const type of rich.detectedItems ?? []) for (const item of type.items ?? []) for (const issue of item.issues ?? []) {
      if (issue.severity !== "ERROR") continue;
      errorCount += 1;
      const finding = { url: page.url, richResultType: type.richResultType, item: item.name, issue, lastCrawlTime: page.index?.lastCrawlTime ?? null };
      (productCommerceOnly(type.richResultType, issue) ? storedEligibilityLimitations : storedSchemaErrors).push(finding);
    }
    if (["FAIL", "PARTIAL"].includes(rich.verdict) && !errorCount) unresolvedStoredVerdicts.push({ url: page.url, verdict: rich.verdict });
    const live = evidence.pages.find((entry) => entry.url === page.url);
    let currentEvidence = null;
    if (live) {
      if (typeof live.html !== "string" || !Number.isFinite(Date.parse(live.checkedAt))) throw new Error(`Invalid live HTML evidence for ${page.url}`);
      const crawl = Date.parse(page.index?.lastCrawlTime);
      currentEvidence = {
        checkedAt: live.checkedAt,
        afterGoogleCrawl: Number.isFinite(crawl) ? Date.parse(live.checkedAt) >= crawl : null,
        scope: "server-html-only; absence does not exclude client-rendered markup",
        ...inspectStructuredData(live.html),
      };
    }
    return { url: page.url, inSitemap: page.inSitemap, index: page.index, richResults: rich, currentEvidence };
  });
  const live = pages.filter((page) => page.currentEvidence);
  return {
    checkedAt: report.checkedAt,
    scope: "Stored Google crawl and optional current server HTML are separate; no automatic fixed/historical verdict",
    counts: {
      inspectedPages: pages.length,
      inspectedSitemapPages: pages.filter((page) => page.inSitemap === true).length,
      indexingUnknown: pages.filter((page) => !["PASS", "FAIL", "NEUTRAL", "PARTIAL"].includes(page.index?.verdict)).length,
      indexingFailures: pages.filter((page) => page.index?.verdict === "FAIL").length,
      indexingNeutral: pages.filter((page) => page.index?.verdict === "NEUTRAL").length,
      basicErrors: basicErrors.length,
      storedRichResultFailures: pages.filter((page) => ["FAIL", "PARTIAL"].includes(page.richResults.verdict)).length,
      storedSchemaErrors: storedSchemaErrors.length,
      storedEligibilityLimitations: storedEligibilityLimitations.length,
      unresolvedStoredVerdicts: unresolvedStoredVerdicts.length,
      livePagesChecked: live.length,
      liveSchemaErrors: live.reduce((sum, page) => sum + page.currentEvidence.errors.length, 0),
      liveEligibilityLimitations: live.reduce((sum, page) => sum + page.currentEvidence.eligibilityLimitations.length, 0),
    },
    basicErrors, storedSchemaErrors, storedEligibilityLimitations, unresolvedStoredVerdicts, pages,
  };
}

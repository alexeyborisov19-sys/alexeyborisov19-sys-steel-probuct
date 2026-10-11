import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

function call(name: string, args: unknown[]) {
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", `import { ${name} } from './scripts/lib/gsc-report-analysis.mjs'; console.log(JSON.stringify(${name}(...${JSON.stringify(args)})));`], { encoding: "utf8" }));
}
const url = "https://www.steelprodukt.ru/";
const technical = [{ url, inSitemap: true, http: 200, canonical: [url.slice(0, -1)], title: "Home", h1Count: 1 }];
const issue = { issueMessage: 'Задайте значение для одного из следующих элементов данных: "offers", "review" или "aggregateRating".', severity: "ERROR" };
const report = { checkedAt: "2026-10-11T06:30:00Z", technical, inspections: [{ url, index: { verdict: "PASS", lastCrawlTime: "2026-07-24T00:00:00Z" }, richResults: { verdict: "FAIL", detectedItems: [{ richResultType: "Описания товара", items: [{ name: "Item", issues: [issue] }] }] } }] };

test("canonical normalization is limited to the origin root", () => {
  assert.equal(call("sameCanonical", [url, url.slice(0, -1)]), true);
  for (const pair of [[url+'a', url+'a/'], [url, url+'?x=1'], [url+'?x=1&y=2',url+'?y=2&x=1'], [url,url.replace('www.','')], [url,url.replace('https:','http:')], [url,url+'#x'], [url,url+'a/..'], [url,url+'?'], [url,url+'#'], [url,url.replace('.ru/', '.ru:443/')], ['bad','bad']]) assert.equal(call("sameCanonical", pair), false);
});

test("Google FAIL remains raw while known Product eligibility is separated", () => {
  const result = call("analyzeGscReport", [report]);
  assert.equal(result.counts.basicErrors, 0);
  assert.equal(result.counts.indexingFailures, 0);
  assert.equal(result.counts.storedRichResultFailures, 1);
  assert.equal(result.counts.storedEligibilityLimitations, 1);
  assert.deepEqual(result.pages[0].richResults, report.inspections[0].richResults);
  assert.equal(result.pages[0].currentEvidence, null);
});

test("old crawl alone never becomes fixed; unknown/video errors stay errors", () => {
  const other = structuredClone(report);
  other.inspections[0].richResults.detectedItems[0].items[0].issues.push({ issueMessage: 'Отсутствует поле "uploadDate"', severity: "ERROR" });
  const result = call("analyzeGscReport", [other]);
  assert.equal(result.counts.storedSchemaErrors, 1);
  assert.equal(result.pages[0].currentEvidence, null);
  const evidence = { pages: [{ url, checkedAt: "2026-10-11T06:40:00Z", html: '<script type="application/ld+json">{"@type":"VideoObject","name":"Film"}</script>' }] };
  const live = call("analyzeGscReport", [other, evidence]);
  assert.equal(live.counts.liveSchemaErrors, 2);
  assert.equal(live.pages[0].currentEvidence.afterGoogleCrawl, true);
  assert.equal(live.pages[0].richResults.verdict, "FAIL");
});

test("unexplained FAIL and missing/current evidence are never hidden", () => {
  const other = structuredClone(report);
  other.inspections[0].richResults.detectedItems = [];
  const result = call("analyzeGscReport", [other]);
  assert.equal(result.counts.unresolvedStoredVerdicts, 1);
  assert.equal(result.counts.storedRichResultFailures, 1);
  const earlier = { pages: [{ url, checkedAt: "2026-01-01T00:00:00Z", html: "" }] };
  assert.equal(call("analyzeGscReport", [report, earlier]).pages[0].currentEvidence.afterGoogleCrawl, false);
});


test("unknown invalid-commerce messages are never downgraded", () => {
  const other = structuredClone(report);
  other.inspections[0].richResults.detectedItems[0].items[0].issues = [{ issueMessage: "Invalid offers, review or aggregateRating: one of the supplied properties has an invalid value", severity: "ERROR" }];
  const result = call("analyzeGscReport", [other]);
  assert.equal(result.counts.storedSchemaErrors, 1);
  assert.equal(result.counts.storedEligibilityLimitations, 0);
});

test("recognized missing hasVariant commerce is explicit and still retains Google's failure", () => {
  const other = structuredClone(report);
  other.inspections[0].richResults.detectedItems[0].items[0].issues[0].issueMessage = issue.issueMessage.replace('"offers"', '"hasVariant.offers"');
  const result = call("analyzeGscReport", [other]);
  assert.equal(result.counts.storedEligibilityLimitations, 1);
  assert.equal(result.pages[0].richResults.verdict, "FAIL");
});

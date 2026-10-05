// Read-only status check (2026-10-05 12:35 MSK): Direct campaign 714391927 since the rework
// (groups, search queries, ad statuses) and Metrika lead goals since 1 October. Nothing is changed.
import { writeFileSync } from "node:fs";

const CAMPAIGN_ID = 714391927;
const out = { generated_at: new Date().toISOString(), pass: "check", calls: [], errors: [], direct: {}, metrika: {} };
const norm = (raw = "") => {
  let v = String(raw).trim().replace(/^OAuth\s+/i, "").replace(/^Bearer\s+/i, "");
  const m = v.match(/(?:^|[#?&])access_token=([^&#\s]+)/i);
  if (m) { try { v = decodeURIComponent(m[1]); } catch { v = m[1]; } }
  return v.trim();
};
const token = norm(process.env.YD_TOKEN || "");
const login = String(process.env.YD_CLIENT_LOGIN || "").trim();
const ym = norm(process.env.YM_TOKEN || "");

async function direct(service, method, params, label) {
  const headers = { Authorization: `Bearer ${token}`, "Accept-Language": "ru", "Content-Type": "application/json; charset=utf-8" };
  if (login) headers["Client-Login"] = login;
  const res = await fetch(`https://api.direct.yandex.com/json/v501/${service}`, { method: "POST", headers, body: JSON.stringify({ method, params }), signal: AbortSignal.timeout(60000) });
  const text = await res.text();
  out.calls.push({ label, status: res.status });
  try { return JSON.parse(text.replace(/([:\[,]\s*)(-?\d{16,})(?=\s*[,\]}])/g, '$1"BIG:$2"')); } catch { return { raw: text.slice(0, 2000) }; }
}

async function report(name, type, fields, range, extra = {}) {
  const body = { params: {
    SelectionCriteria: { Filter: [{ Field: "CampaignId", Operator: "EQUALS", Values: [String(CAMPAIGN_ID)] }], ...(extra.dates || {}) },
    FieldNames: fields, ReportName: `SP status ${name} ${Date.now()}`, ReportType: type,
    DateRangeType: range, Format: "TSV", IncludeVAT: "YES", IncludeDiscount: "NO",
    ...(extra.goals ? { Goals: extra.goals, AttributionModels: ["AUTO"] } : {}),
  } };
  const headers = { Authorization: `Bearer ${token}`, "Accept-Language": "ru", "Content-Type": "application/json; charset=utf-8",
    processingMode: "auto", returnMoneyInMicros: "false", skipReportHeader: "true", skipReportSummary: "true" };
  if (login) headers["Client-Login"] = login;
  for (let i = 0; i < 20; i++) {
    const res = await fetch("https://api.direct.yandex.com/json/v5/reports", { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
    const text = await res.text();
    out.calls.push({ label: `report:${name}`, status: res.status });
    if (res.status === 200) return { tsv: text };
    if (res.status === 201 || res.status === 202) { await new Promise((r) => setTimeout(r, (Number(res.headers.get("retryIn")) || 10) * 1000)); continue; }
    out.errors.push({ step: name, status: res.status, body: text.slice(0, 1500) });
    return { status: res.status };
  }
  return { error: "TIMEOUT" };
}

const GOALS = [612680821, 612680809, 666575171]; // quote_request_success, assistant_lead_success, phone_click
const since = { dates: { DateFrom: "2026-10-01", DateTo: new Date().toISOString().slice(0, 10) } };

if (token) {
  out.direct.campaign = (await direct("campaigns", "get", { SelectionCriteria: { Ids: [CAMPAIGN_ID] }, FieldNames: ["Id", "State", "Status", "Statistics", "Funds"], UnifiedCampaignFieldNames: ["BiddingStrategy"] }, "campaign"))?.result?.Campaigns?.[0];
  out.direct.groups = (await direct("adgroups", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "Name", "Status", "ServingStatus"] }, "groups"))?.result?.AdGroups;
  out.direct.ads = (await direct("ads", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "AdGroupId", "State", "Status", "StatusClarification"] }, "ads"))?.result?.Ads;
  out.direct.daily = await report("daily", "CUSTOM_REPORT", ["Date", "Impressions", "Clicks", "Cost"], "CUSTOM_DATE", since);
  out.direct.groups_since = await report("groups_since", "CUSTOM_REPORT", ["AdGroupName", "Impressions", "Clicks", "Cost"], "CUSTOM_DATE", since);
  out.direct.groups_conv = await report("groups_conv", "CUSTOM_REPORT", ["AdGroupName", "Clicks", "Conversions"], "CUSTOM_DATE", { ...since, goals: GOALS });
  out.direct.queries_since = await report("queries_since", "SEARCH_QUERY_PERFORMANCE_REPORT", ["Query", "AdGroupName", "Criterion", "CriterionType", "Impressions", "Clicks", "Cost"], "CUSTOM_DATE", since);
}
if (ym) {
  const m = async (label, q) => {
    const res = await fetch(`https://api-metrika.yandex.net/stat/v1/data?ids=112542227&accuracy=full&${q}`, { headers: { Authorization: `OAuth ${ym}` }, signal: AbortSignal.timeout(60000) });
    out.calls.push({ label: `metrika:${label}`, status: res.status });
    return res.json().catch(() => null);
  };
  const goalMetrics = GOALS.map((g) => `ym:s:goal${g}reaches`).join(",");
  out.metrika.by_source = await m("by_source", `date1=2026-10-01&date2=today&dimensions=ym:s:lastsignTrafficSource&metrics=ym:s:visits,${goalMetrics}`);
  out.metrika.by_day = await m("by_day", `date1=2026-10-01&date2=today&dimensions=ym:s:date&metrics=ym:s:visits,${goalMetrics}&sort=ym:s:date`);
}
writeFileSync("/tmp/report.json", JSON.stringify(out));
console.log("ERRORS:", out.errors.length);

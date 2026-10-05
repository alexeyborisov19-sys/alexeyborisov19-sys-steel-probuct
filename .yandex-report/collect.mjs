// Negatives pass (2026-10-05 12:50 MSK): merge negatives-spec.json into campaign 714391927 and its groups.
// Only adds negative keywords; nothing is removed, stopped or started.
import { readFileSync, writeFileSync } from "node:fs";

const CAMPAIGN_ID = 714391927;
const spec = JSON.parse(readFileSync(".yandex-report/negatives-spec.json", "utf8"));
const out = { generated_at: new Date().toISOString(), pass: "negatives", calls: [], errors: [], steps: { groups: {} } };
const norm = (raw = "") => {
  let v = String(raw).trim().replace(/^OAuth\s+/i, "").replace(/^Bearer\s+/i, "");
  const m = v.match(/(?:^|[#?&])access_token=([^&#\s]+)/i);
  if (m) { try { v = decodeURIComponent(m[1]); } catch { v = m[1]; } }
  return v.trim();
};
const token = norm(process.env.YD_TOKEN || "");
const login = String(process.env.YD_CLIENT_LOGIN || "").trim();
async function api(service, method, params, label) {
  if (!["get", "update"].includes(method)) throw new Error(`method ${method} is not allowed`);
  const headers = { Authorization: `Bearer ${token}`, "Accept-Language": "ru", "Content-Type": "application/json; charset=utf-8" };
  if (login) headers["Client-Login"] = login;
  const res = await fetch(`https://api.direct.yandex.com/json/v501/${service}`, { method: "POST", headers, body: JSON.stringify({ method, params }), signal: AbortSignal.timeout(60000) });
  const body = await res.json().catch(() => null);
  const results = body?.result?.UpdateResults || [];
  const itemErrors = results.filter((x) => x.Errors?.length);
  out.calls.push({ label: `${service}.${method}:${label}`, status: res.status, itemErrors: itemErrors.length });
  if (body?.error) out.errors.push({ step: label, error: body.error });
  if (itemErrors.length) out.errors.push({ step: label, itemErrors: itemErrors.slice(0, 10) });
  return body;
}
if (token) {
  const c = await api("campaigns", "get", { SelectionCriteria: { Ids: [CAMPAIGN_ID] }, FieldNames: ["Id", "NegativeKeywords"] }, "campaign");
  const before = c?.result?.Campaigns?.[0]?.NegativeKeywords?.Items || [];
  const merged = [...new Set([...before, ...spec.Campaign])];
  if (merged.length !== before.length) await api("campaigns", "update", { Campaigns: [{ Id: CAMPAIGN_ID, NegativeKeywords: { Items: merged } }] }, "campaign");
  out.steps.campaign = { before: before.length, after: merged.length };
  const g = await api("adgroups", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "Name", "NegativeKeywords"] }, "groups");
  const updates = [];
  for (const grp of g?.result?.AdGroups || []) {
    const add = spec.Groups[grp.Name];
    if (!add) continue;
    const was = grp.NegativeKeywords?.Items || [];
    const now = [...new Set([...was, ...add])];
    out.steps.groups[grp.Name] = { before: was.length, after: now.length };
    if (now.length !== was.length) updates.push({ Id: grp.Id, NegativeKeywords: { Items: now } });
  }
  if (updates.length) await api("adgroups", "update", { AdGroups: updates }, `groups_${updates.length}`);
  const g2 = await api("adgroups", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "Name", "NegativeKeywords"] }, "groups_after");
  out.steps.after = Object.fromEntries((g2?.result?.AdGroups || []).filter((x) => spec.Groups[x.Name]).map((x) => [x.Name, (x.NegativeKeywords?.Items || []).length]));
}
writeFileSync("/tmp/report.json", JSON.stringify(out));
console.log("ERRORS:", out.errors.length);

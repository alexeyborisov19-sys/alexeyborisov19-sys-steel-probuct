// Pass 4: finish the live campaign 714391927. Run: 2026-10-01 18:10 MSK.
//  0) leftover campaigns are deleted: the draft 714957797 and five archived empty "Новая" campaigns
//     (only these ids, only while they are a draft or archived and have no impressions and no clicks;
//     Direct refuses to delete an archived campaign, so it is unarchived first and archived back if the delete fails);
//  N) negative keywords from negatives-spec.json are merged into the campaign and the new groups (nothing removed);
//  1) services sitelink set (the first try was rejected for the "×" sign) attached to every services ad;
//  2) extra ads from extra-spec.json for groups with fewer than three ads, sent to moderation;
//  3) done once on 2026-10-01 17:00 MSK (owner's request): 50 ads of the old groups resumed, St. Petersburg left off.
//     The step is removed so later runs never undo a manual stop;
//  4) read back, plus today's group statistics and search queries (read-only reports).
import { readFileSync, writeFileSync } from "node:fs";

const CAMPAIGN_ID = 714391927;
const extra = JSON.parse(readFileSync(".yandex-report/extra-spec.json", "utf8"));
const base = JSON.parse(readFileSync(".yandex-report/campaign-spec.json", "utf8"));
const negSpec = JSON.parse(readFileSync(".yandex-report/negatives-spec.json", "utf8"));
const SV_CALLOUTS = [44698613, 44698991, 44261432, 44698992];
// Draft 714957797 was deleted on 2026-10-01. The five archived empty "Новая" campaigns
// (714090502, 714382608, 714388573, 714388647, 714391871) cannot be deleted: Direct answers 8301
// because they were once sent to moderation, so they stay archived and are no longer touched.
const DELETE_IDS = [714957797];
const out = { generated_at: new Date().toISOString(), pass: "finish", calls: [], steps: {}, errors: [] };
const UTM = "utm_source=yandex&utm_medium=cpc&utm_campaign={campaign_id}&utm_content={ad_id}.{gbid}.{source_type}.{device_type}&utm_term={keyword}";
const isServices = (name) => /^Услуги (Смоленск|Москва Калуга Брянск) \| /.test(name);

function normToken(raw = "") {
  let v = String(raw).trim().replace(/^OAuth\s+/i, "").replace(/^Bearer\s+/i, "");
  const m = v.match(/(?:^|[#?&])access_token=([^&#\s]+)/i);
  if (m) { try { v = decodeURIComponent(m[1]); } catch { v = m[1]; } }
  return v.trim();
}
const token = normToken(process.env.YD_TOKEN || "");
const login = String(process.env.YD_CLIENT_LOGIN || "").trim();

const FORBIDDEN = new Set(["resume", "unarchive", "archive", "delete"]);
let RESUME_ALLOWED = new Set();
async function api(service, method, params, label) {
  const ids = params?.SelectionCriteria?.Ids || [];
  const draftDelete = service === "campaigns" && ["delete", "unarchive", "archive"].includes(method) && ids.length > 0
    && ids.every((id) => DELETE_IDS.includes(id) && id !== CAMPAIGN_ID);
  const oldResume = service === "ads" && method === "resume" && ids.length > 0 && ids.every((id) => RESUME_ALLOWED.has(String(id)));
  if (FORBIDDEN.has(method) && !draftDelete && !oldResume) throw new Error(`method ${method} is not allowed in this script`);
  const headers = { Authorization: `Bearer ${token}`, "Accept-Language": "ru", "Content-Type": "application/json; charset=utf-8" };
  if (login) headers["Client-Login"] = login;
  let status = 0, body = null;
  try {
    // Ad ids exceed Number.MAX_SAFE_INTEGER: keep every 16+ digit integer as a "BIG:" string
    // on the way in and write it back as a bare JSON number on the way out.
    const payload = JSON.stringify({ method, params }).replace(/"BIG:(-?\d+)"/g, "$1");
    const res = await fetch(`https://api.direct.yandex.com/json/v501/${service}`, {
      method: "POST", headers, body: payload, signal: AbortSignal.timeout(60000),
    });
    status = res.status;
    const text = await res.text();
    const safe = text.replace(/([:\[,]\s*)(-?\d{16,})(?=\s*[,\]}])/g, '$1"BIG:$2"');
    try { body = JSON.parse(safe); } catch { body = { raw: text.slice(0, 3000) }; }
  } catch (e) {
    body = { error: { error_string: "NETWORK_ERROR", error_detail: e?.cause?.code || e?.name } };
  }
  const r = body?.result || {};
  const results = r.AddResults || r.UpdateResults || r.SuspendResults || r.ModerateResults || r.ResumeResults || r.DeleteResults
    || r.UnarchiveResults || r.ArchiveResults || [];
  const itemErrors = results.filter((x) => x.Errors?.length);
  out.calls.push({ label: `${service}.${method}:${label}`, status, apiError: Boolean(body?.error), itemErrors: itemErrors.length });
  console.log(`${service}.${method}:${label}: HTTP ${status}${body?.error ? " API_ERROR" : ""}${itemErrors.length ? ` ITEM_ERRORS=${itemErrors.length}` : ""}`);
  if (body?.error) out.errors.push({ step: `${service}.${method}:${label}`, error: body.error });
  if (itemErrors.length) out.errors.push({ step: `${service}.${method}:${label}`, itemErrors: itemErrors.slice(0, 20) });
  return body;
}
const addIds = (body) => (body?.result?.AddResults || []).map((x) => x.Id ?? null);
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const readAds = async (label) => (await api("ads", "get", {
  SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "AdGroupId", "State", "Status", "StatusClarification"],
  TextAdFieldNames: ["Title", "Text", "Href", "SitelinkSetId", "AdExtensions"],
}, label))?.result?.Ads || [];


// ---------- site probe (read-only): why no leads ----------
// Pages and form endpoints are checked without creating a lead: the form posts carry an empty
// name, which every handler rejects with 400 before anything is stored or e-mailed.
async function siteProbe() {
  const site = {};
  const timed = async (label, url, init = {}) => {
    const t0 = Date.now();
    try {
      const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30000), ...init });
      const text = await res.text();
      let json = null; try { json = JSON.parse(text); } catch {}
      site[label] = { status: res.status, ms: Date.now() - t0, location: res.headers.get("location"), json,
        bytes: text.length, hasMetrikaTag: /mc\.yandex\.ru\/metrika/.test(text), title: (text.match(/<title>([^<]*)<\/title>/) || [])[1] || null };
    } catch (e) { site[label] = { error: e?.cause?.code || e?.name, ms: Date.now() - t0 }; }
  };
  for (const host of ["https://www.steelprodukt.ru", "https://steelprodukt.ru", "http://steelprodukt.ru", "http://www.steelprodukt.ru"]) {
    await timed(`GET ${host}/`, `${host}/`);
  }
  for (const path of ["/contacts", "/online-order", "/products/metallokassety", "/products/korziny-dlya-konditsionerov", "/production/lazernaya-rezka-metalla", "/api/health"]) {
    await timed(`GET www${path}`, `https://www.steelprodukt.ru${path}`);
  }
  const emptyLead = () => { const f = new FormData(); f.append("name", ""); f.append("phone", ""); return f; };
  for (const host of ["https://www.steelprodukt.ru", "https://steelprodukt.ru"]) {
    for (const ep of ["/api/quote", "/api/assistant/lead"]) {
      await timed(`POST ${host}${ep} (empty name, Origin=${host})`, `${host}${ep}`, { method: "POST", body: emptyLead(), headers: { Origin: host, Referer: `${host}/contacts` } });
    }
  }
  // the non-www page posting to the non-www API while the canonical origin is www
  await timed("POST https://steelprodukt.ru/api/quote (Origin=https://steelprodukt.ru, sec-fetch-site same-origin)", "https://steelprodukt.ru/api/quote",
    { method: "POST", body: emptyLead(), headers: { Origin: "https://steelprodukt.ru", "Sec-Fetch-Site": "same-origin" } });
  out.site = site;

  // Metrika: every goal over 90 days, and visits by source, to compare with Direct clicks
  const ym = String(process.env.YM_TOKEN || "").trim();
  if (ym) {
    const get = async (label, url) => {
      try {
        const res = await fetch(url, { headers: { Authorization: `OAuth ${ym}` }, signal: AbortSignal.timeout(60000) });
        out.metrika = out.metrika || {};
        out.metrika[label] = { status: res.status, body: await res.json().catch(() => null) };
      } catch (e) { out.metrika = out.metrika || {}; out.metrika[label] = { error: e?.cause?.code || e?.name }; }
    };
    const C = 112542227;
    await get("goals", `https://api-metrika.yandex.net/management/v1/counter/${C}/goals`);
    await get("counter", `https://api-metrika.yandex.net/management/v1/counter/${C}`);
    const goals = out.metrika.goals?.body?.goals || [];
    const metrics = goals.slice(0, 18).map((g) => `ym:s:goal${g.id}reaches`).join(",");
    await get("goals_90d", `https://api-metrika.yandex.net/stat/v1/data?ids=${C}&date1=90daysAgo&date2=today&metrics=ym:s:visits${metrics ? "," + metrics : ""}&accuracy=full`);
    await get("sources_daily_14d", `https://api-metrika.yandex.net/stat/v1/data?ids=${C}&date1=14daysAgo&date2=today&dimensions=ym:s:date,ym:s:lastsignTrafficSource&metrics=ym:s:visits&sort=ym:s:date&limit=200&accuracy=full`);
  }
}

async function main() {
  await siteProbe();
  if (!token) { out.errors.push({ step: "token", error: "missing" }); return; }
  const c = await api("campaigns", "get", { SelectionCriteria: { Ids: [CAMPAIGN_ID] }, FieldNames: ["Id", "State", "Status"] }, "guard");
  const campaign = c?.result?.Campaigns?.[0];
  if (!campaign || campaign.Id !== CAMPAIGN_ID || campaign.State === "ARCHIVED") {
    out.errors.push({ step: "guard", error: "campaign not found or archived", campaign });
    return;
  }
  // ---------- 0. drafts: delete only the redundant draft campaign, list everything else ----------
  const listCampaigns = async (label) => (await api("campaigns", "get", {
    SelectionCriteria: {}, FieldNames: ["Id", "Name", "State", "Status", "Type", "Statistics"],
  }, label))?.result?.Campaigns || [];
  const all = await listCampaigns("all_before");
  const junk = all.filter((x) => DELETE_IDS.includes(x.Id) && x.Id !== CAMPAIGN_ID
    && (x.Status === "DRAFT" || x.State === "ARCHIVED") && x.State !== "ON"
    && !(x.Statistics?.Impressions > 0) && !(x.Statistics?.Clicks > 0));
  if (junk.length) {
    const archived = junk.filter((x) => x.State === "ARCHIVED").map((x) => x.Id);
    if (archived.length) await api("campaigns", "unarchive", { SelectionCriteria: { Ids: archived } }, `leftovers_${archived.length}`);
    const ids = junk.map((x) => x.Id);
    const d = await api("campaigns", "delete", { SelectionCriteria: { Ids: ids } }, `leftovers_${ids.length}`);
    const res = d?.result?.DeleteResults || [];
    out.steps.deleted = ids.map((id, i) => ({ id, ok: Boolean(res[i]?.Id) && !res[i]?.Errors?.length, errors: res[i]?.Errors }));
    const back = archived.filter((id) => !out.steps.deleted.find((x) => x.id === id)?.ok);
    if (back.length) await api("campaigns", "archive", { SelectionCriteria: { Ids: back } }, `rollback_${back.length}`);
  } else {
    out.steps.deleted = "nothing to delete";
  }
  out.steps.campaigns = (await listCampaigns("all_after")).map((x) => ({ Id: x.Id, Name: x.Name, State: x.State, Status: x.Status, Statistics: x.Statistics }));

  const groups = (await api("adgroups", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "Name"] }, "groups"))?.result?.AdGroups || [];
  const nameOf = Object.fromEntries(groups.map((g) => [g.Id, g.Name]));
  const idOf = Object.fromEntries(groups.map((g) => [g.Name, g.Id]));
  let ads = await readAds("before");

  // ---------- N. negative keywords: merge, never remove ----------
  const cn = await api("campaigns", "get", { SelectionCriteria: { Ids: [CAMPAIGN_ID] }, FieldNames: ["Id", "NegativeKeywords"] }, "negatives_before");
  const campNeg = cn?.result?.Campaigns?.[0]?.NegativeKeywords?.Items || [];
  const campMerged = [...new Set([...campNeg, ...negSpec.Campaign])];
  out.steps.negatives = { campaign_before: campNeg.length, campaign_after: campMerged.length, groups: {} };
  if (campMerged.length !== campNeg.length) {
    await api("campaigns", "update", { Campaigns: [{ Id: CAMPAIGN_ID, NegativeKeywords: { Items: campMerged } }] }, "negatives");
  }
  const gn = await api("adgroups", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "Name", "NegativeKeywords"] }, "negatives_groups");
  const groupUpdates = [];
  for (const g of gn?.result?.AdGroups || []) {
    const add = negSpec.Groups[g.Name];
    if (!add) continue;
    const before = g.NegativeKeywords?.Items || [];
    const merged = [...new Set([...before, ...add])];
    out.steps.negatives.groups[g.Name] = { before: before.length, after: merged.length };
    if (merged.length !== before.length) groupUpdates.push({ Id: g.Id, NegativeKeywords: { Items: merged } });
  }
  for (const part of chunk(groupUpdates, 100)) {
    await api("adgroups", "update", { AdGroups: part }, `negatives_${part.length}`);
  }
  const cn2 = await api("campaigns", "get", { SelectionCriteria: { Ids: [CAMPAIGN_ID] }, FieldNames: ["Id", "NegativeKeywords"] }, "negatives_after");
  out.steps.negatives.campaign_now = cn2?.result?.Campaigns?.[0]?.NegativeKeywords?.Items?.length ?? null;

  // ---------- 1. services sitelinks ----------
  const sl = await api("sitelinks", "add", { SitelinksSets: [{ Sitelinks: extra.ServicesKit.Sitelinks }] }, "kit_sv");
  const [svSitelinks] = addIds(sl);
  out.steps.sv_sitelinks = svSitelinks ?? null;
  const kits = {
    mk: base.KitIds.mk, kz: base.KitIds.kz,
    sv: { sitelinkSetId: svSitelinks ?? null, calloutIds: SV_CALLOUTS },
  };
  if (svSitelinks) {
    const need = ads.filter((a) => isServices(nameOf[a.AdGroupId]) && a.TextAd && a.TextAd.SitelinkSetId !== svSitelinks).map((a) => a.Id);
    for (const part of chunk(need, 100)) {
      await api("ads", "update", { Ads: part.map((Id) => ({ Id, TextAd: { SitelinkSetId: svSitelinks } })) }, `sv_sitelinks_${part.length}`);
    }
    out.steps.sv_sitelinks_attached = need.length;
  }

  // ---------- 2. extra ads ----------
  const titles = new Set(ads.map((a) => `${a.AdGroupId}|${a.TextAd?.Title}`));
  const newIds = [];
  const added = [];
  for (const a of extra.Ads) {
    const gid = idOf[a.Group];
    if (!gid) { out.errors.push({ step: "extra", error: `group not found: ${a.Group}` }); continue; }
    const merged = a.Title2 ? `${a.Title}. ${a.Title2}` : a.Title;
    if (titles.has(`${gid}|${merged}`) || titles.has(`${gid}|${a.Title}`)) continue;
    const kit = kits[a.Kit];
    const TextAd = { Title: a.Title, Text: a.Text, Mobile: "NO", DisplayUrlPath: a.DisplayUrlPath, Href: `${a.Href}?${UTM}`, AdExtensionIds: kit.calloutIds };
    if (a.Title2) TextAd.Title2 = a.Title2;
    if (kit.sitelinkSetId) TextAd.SitelinkSetId = kit.sitelinkSetId;
    const r = await api("ads", "add", { Ads: [{ AdGroupId: gid, TextAd }] }, "extra");
    const [id] = addIds(r);
    if (id) { newIds.push(id); added.push(`${a.Group}: ${merged}`); }
  }
  out.steps.extra_added = added;
  for (const part of chunk(newIds, 1000)) {
    const m = await api("ads", "moderate", { SelectionCriteria: { Ids: part } }, `moderate_${part.length}`);
    out.steps.moderate = m?.result?.ModerateResults ?? m?.error;
  }

  // ---------- 4. read back ----------
  out.after = { groups, ads: await readAds("after") };

  // ---------- 5. read-only reports: today's groups and search queries ----------
  const report = async (name, type, fields, range) => {
    const body = { params: {
      SelectionCriteria: { Filter: [{ Field: "CampaignId", Operator: "EQUALS", Values: [String(CAMPAIGN_ID)] }] },
      FieldNames: fields, ReportName: `SP check ${name} ${Date.now()}`, ReportType: type,
      DateRangeType: range, Format: "TSV", IncludeVAT: "YES", IncludeDiscount: "NO",
    } };
    const headers = {
      Authorization: `Bearer ${token}`, "Accept-Language": "ru", "Content-Type": "application/json; charset=utf-8",
      processingMode: "auto", returnMoneyInMicros: "false", skipReportHeader: "true", skipReportSummary: "true",
    };
    if (login) headers["Client-Login"] = login;
    for (let i = 0; i < 20; i++) {
      let res;
      try {
        res = await fetch("https://api.direct.yandex.com/json/v5/reports", { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
      } catch (e) { return { error: e?.cause?.code || e?.name }; }
      const text = await res.text();
      out.calls.push({ label: `reports:${name}`, status: res.status });
      if (res.status === 200) return { tsv: text };
      if (res.status === 201 || res.status === 202) { await new Promise((r) => setTimeout(r, (Number(res.headers.get("retryIn")) || 10) * 1000)); continue; }
      out.errors.push({ step: `reports:${name}`, status: res.status, body: text.slice(0, 1500) });
      return { status: res.status };
    }
    return { error: "TIMEOUT" };
  };
  out.reports = {
    groups_today: await report("groups_today", "CUSTOM_REPORT", ["AdGroupName", "Impressions", "Clicks", "Cost"], "TODAY"),
    queries_today: await report("queries_today", "SEARCH_QUERY_PERFORMANCE_REPORT", ["Query", "AdGroupName", "Criterion", "CriterionType", "Impressions", "Clicks", "Cost"], "TODAY"),
    groups_yesterday: await report("groups_yesterday", "CUSTOM_REPORT", ["AdGroupName", "Impressions", "Clicks", "Cost"], "YESTERDAY"),
    daily_14d: await report("daily_14d", "CUSTOM_REPORT", ["Date", "Impressions", "Clicks", "Cost"], "LAST_14_DAYS"),
  };
}

await main();
writeFileSync("/tmp/report.json", JSON.stringify(out, null, 2));
console.log("ERRORS:", out.errors.length, "REPORT_BYTES:", Buffer.byteLength(JSON.stringify(out)));

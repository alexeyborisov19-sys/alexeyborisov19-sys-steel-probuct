// Read-only collector, run 3: current Yandex Direct setup and the search queries behind ad clicks,
// Metrika view of ad traffic, and extra Wordstat frequencies for a commercial campaign.
// Nothing here changes the Direct account. Results go to /tmp/report.json (encrypted by the workflow).
import { writeFileSync } from "node:fs";

const out = { generated_at: new Date().toISOString(), calls: [], direct: {}, metrika: {}, wordstat: {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const COUNTER_ID = "112542227";

function normToken(raw = "") {
  let v = String(raw).trim().replace(/^OAuth\s+/i, "").replace(/^Bearer\s+/i, "");
  const m = v.match(/(?:^|[#?&])access_token=([^&#\s]+)/i);
  if (m) { try { v = decodeURIComponent(m[1]); } catch { v = m[1]; } }
  return v.trim();
}

async function call(label, url, { method = "GET", headers = {}, body, raw = false } = {}) {
  let status = 0, parsed = null, resHeaders = {};
  try {
    const res = await fetch(url, {
      method,
      headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json; charset=utf-8" } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60000),
    });
    status = res.status;
    resHeaders = Object.fromEntries(res.headers.entries());
    const text = await res.text();
    if (raw) parsed = text;
    else { try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = text.slice(0, 4000); } }
  } catch (e) {
    parsed = { error: "NETWORK_ERROR", code: e?.cause?.code || e?.name || "UNKNOWN" };
  }
  out.calls.push({ label, status });
  console.log(`${label}: HTTP ${status}`);
  return { ok: status >= 200 && status < 300, status, body: parsed, headers: resHeaders };
}

const yd = normToken(process.env.YD_TOKEN || process.env.YANDEX_OAUTH_TOKEN || "");
const login = String(process.env.YD_CLIENT_LOGIN || "").trim();
const ym = normToken(process.env.YM_TOKEN || process.env.YANDEX_OAUTH_TOKEN || "");

function dHeaders(extra = {}) {
  const h = { Authorization: `Bearer ${yd}`, "Accept-Language": "ru", ...extra };
  if (login) h["Client-Login"] = login;
  return h;
}

async function direct(service, label, params, fallbacks = []) {
  for (const [i, p] of [params, ...fallbacks].entries()) {
    const r = await call(`direct.${label}${i ? `#fb${i}` : ""}`, `https://api.direct.yandex.com/json/v501/${service}`, {
      method: "POST", headers: dHeaders(), body: { method: "get", params: p },
    });
    if (r.ok && !r.body?.error) return r.body?.result ?? r.body;
    if (i === fallbacks.length) return { error: r.body?.error ?? r.body, status: r.status };
  }
}

// ---------------- METRIKA: goals and ad traffic ----------------
let goals = [];
if (ym) {
  const g = await call("metrika.goals", `https://api-metrika.yandex.net/management/v1/counter/${COUNTER_ID}/goals`, { headers: { Authorization: `OAuth ${ym}` } });
  goals = (g.body?.goals || []).map((x) => ({ id: x.id, name: x.name, type: x.type, target: (x.conditions || [])[0]?.url ?? null }));
  out.metrika.goals = goals;

  async function report(label, params) {
    const u = new URL("https://api-metrika.yandex.net/stat/v1/data");
    u.searchParams.set("ids", COUNTER_ID);
    u.searchParams.set("accuracy", "full");
    u.searchParams.set("lang", "ru");
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const r = await call(`metrika.${label}`, u.toString(), { headers: { Authorization: `OAuth ${ym}` } });
    return r.ok ? { query: params, totals: r.body?.totals, data: r.body?.data } : { query: params, error: r.body, status: r.status };
  }
  const leadGoal = goals.find((x) => x.target === "ym-submit-leadform") || goals.find((x) => x.target === "quote_request_success");
  const formGoal = goals.find((x) => x.target === "quote_form_started") || goals.find((x) => x.target === "ym-open-leadform");
  const gm = [leadGoal && `ym:s:goal${leadGoal.id}reaches`, formGoal && `ym:s:goal${formGoal.id}reaches`].filter(Boolean);
  const base = { date1: "90daysAgo", date2: "today", filters: "ym:s:lastsignTrafficSource=='ad'" };
  out.metrika.ad_goals_used = { lead: leadGoal || null, form: formGoal || null };
  out.metrika.ad_search_phrases = await report("ad_search_phrases", { ...base, dimensions: "ym:s:lastsignDirectSearchPhrase", metrics: ["ym:s:visits", "ym:s:bounceRate", "ym:s:avgVisitDurationSeconds", ...gm].join(","), limit: "200", sort: "-ym:s:visits" });
  out.metrika.ad_conditions = await report("ad_conditions", { ...base, dimensions: "ym:s:lastsignDirectPhraseOrCond", metrics: ["ym:s:visits", "ym:s:bounceRate", ...gm].join(","), limit: "200", sort: "-ym:s:visits" });
  out.metrika.ad_landings = await report("ad_landings", { ...base, dimensions: "ym:s:startURL", metrics: ["ym:s:visits", "ym:s:bounceRate", "ym:s:avgVisitDurationSeconds", ...gm].join(","), limit: "50", sort: "-ym:s:visits" });
  out.metrika.ad_regions = await report("ad_regions", { ...base, dimensions: "ym:s:regionCity", metrics: "ym:s:visits,ym:s:bounceRate", limit: "40", sort: "-ym:s:visits" });
  out.metrika.ad_platforms = await report("ad_platforms", { ...base, dimensions: "ym:s:lastsignDirectPlatformType,ym:s:lastsignDirectPlatform", metrics: "ym:s:visits,ym:s:bounceRate", limit: "60", sort: "-ym:s:visits" });
  out.metrika.goal_reaches_all_sources_90d = await report("goals_all", { date1: "90daysAgo", date2: "today", dimensions: "ym:s:lastsignTrafficSource", metrics: ["ym:s:visits", ...gm].join(","), limit: "20" });
}

// ---------------- DIRECT: structure ----------------
if (yd) {
  out.direct.campaigns = await direct("campaigns", "campaigns", {
    SelectionCriteria: {},
    FieldNames: ["Id", "Name", "StartDate", "Type", "Status", "State", "StatusPayment", "StatusClarification", "Statistics", "Currency", "DailyBudget", "NegativeKeywords", "TimeTargeting", "Funds"],
    UnifiedCampaignFieldNames: ["CounterIds", "AttributionModel", "PriorityGoals", "TrackingParams", "Settings", "BiddingStrategy"],
    TextCampaignFieldNames: ["CounterIds", "AttributionModel", "PriorityGoals", "TrackingParams", "Settings", "BiddingStrategy"],
  }, [{
    SelectionCriteria: {},
    FieldNames: ["Id", "Name", "StartDate", "Type", "Status", "State", "StatusPayment", "StatusClarification", "Statistics", "Currency", "DailyBudget", "NegativeKeywords"],
    UnifiedCampaignFieldNames: ["CounterIds", "AttributionModel", "PriorityGoals", "TrackingParams", "Settings", "BiddingStrategy"],
  }]);
  const ids = (out.direct.campaigns?.Campaigns || []).map((c) => c.Id);
  if (ids.length) {
    out.direct.adgroups = await direct("adgroups", "adgroups", {
      SelectionCriteria: { CampaignIds: ids },
      FieldNames: ["Id", "Name", "CampaignId", "RegionIds", "NegativeKeywords", "Status", "ServingStatus", "Type", "Subtype"],
    }, [{ SelectionCriteria: { CampaignIds: ids }, FieldNames: ["Id", "Name", "CampaignId", "RegionIds", "NegativeKeywords", "Status", "Type"] }]);
    out.direct.keywords = await direct("keywords", "keywords", {
      SelectionCriteria: { CampaignIds: ids },
      FieldNames: ["Id", "Keyword", "AdGroupId", "CampaignId", "State", "Status", "ServingStatus", "StatisticsSearch", "StatisticsNetwork"],
      Page: { Limit: 10000 },
    }, [{ SelectionCriteria: { CampaignIds: ids }, FieldNames: ["Id", "Keyword", "AdGroupId", "CampaignId", "State", "Status"], Page: { Limit: 10000 } }]);
    out.direct.ads = await direct("ads", "ads", {
      SelectionCriteria: { CampaignIds: ids },
      FieldNames: ["Id", "CampaignId", "AdGroupId", "Status", "State", "StatusClarification", "Type", "Subtype"],
      TextAdFieldNames: ["Title", "Title2", "Text", "Href", "DisplayUrlPath", "SitelinkSetId", "AdExtensions"],
      Page: { Limit: 1000 },
    }, [{
      SelectionCriteria: { CampaignIds: ids },
      FieldNames: ["Id", "CampaignId", "AdGroupId", "Status", "State", "Type"],
      TextAdFieldNames: ["Title", "Title2", "Text", "Href"],
      Page: { Limit: 1000 },
    }]);
  }

  // ---------------- DIRECT: reports ----------------
  const fmt = (d) => d.toISOString().slice(0, 10);
  const to = new Date();
  const from = new Date(to.getTime() - 89 * 86400000);
  const goalIds = goals.filter((g) => ["ym-submit-leadform", "quote_request_success"].includes(g.target)).map((g) => g.id).slice(0, 2);

  async function directReport(name, type, fields, withGoals) {
    const spec = {
      params: {
        SelectionCriteria: { DateFrom: fmt(from), DateTo: fmt(to) },
        FieldNames: withGoals ? fields : fields.filter((f) => f !== "Conversions"),
        ReportName: `SP readonly ${name} ${Date.now()}`,
        ReportType: type,
        DateRangeType: "CUSTOM_DATE",
        Format: "TSV",
        IncludeVAT: "YES",
        IncludeDiscount: "NO",
        ...(withGoals && goalIds.length ? { Goals: goalIds, AttributionModels: ["AUTO"] } : {}),
      },
    };
    for (let i = 0; i < 20; i++) {
      const r = await call(`direct.report.${name}`, "https://api.direct.yandex.com/json/v501/reports", {
        method: "POST", body: spec, raw: true,
        headers: dHeaders({ processingMode: "auto", returnMoneyInMicros: "false", skipReportHeader: "true", skipReportSummary: "true" }),
      });
      if (r.status === 200) return { tsv: r.body };
      if (r.status === 201 || r.status === 202) { await sleep((Number(r.headers.retryin) || 10) * 1000); continue; }
      return { status: r.status, error: String(r.body).slice(0, 3000) };
    }
    return { error: "TIMEOUT" };
  }
  async function reportWithGoalsFallback(name, type, fields) {
    if (goalIds.length) {
      const r = await directReport(name, type, fields, true);
      if (r.tsv !== undefined) return r;
      out.direct[`${name}_goals_error`] = r;
    }
    return directReport(`${name}_nogoals`, type, fields, false);
  }

  out.direct.report_search_queries = await reportWithGoalsFallback("search_queries", "SEARCH_QUERY_PERFORMANCE_REPORT",
    ["Query", "CampaignId", "AdGroupName", "Criterion", "CriterionType", "MatchType", "Impressions", "Clicks", "Cost", "Conversions"]);
  out.direct.report_criteria = await reportWithGoalsFallback("criteria", "CRITERIA_PERFORMANCE_REPORT",
    ["CampaignId", "AdGroupName", "Criterion", "CriterionType", "AdNetworkType", "Impressions", "Clicks", "Cost", "Conversions"]);
  out.direct.report_placements = await directReport("placements", "CUSTOM_REPORT",
    ["AdNetworkType", "Placement", "Impressions", "Clicks", "Cost"], false);
  out.direct.report_daily = await reportWithGoalsFallback("daily", "CAMPAIGN_PERFORMANCE_REPORT",
    ["Date", "CampaignId", "CampaignName", "AdNetworkType", "Impressions", "Clicks", "Cost", "Conversions"]);
  out.direct.report_regions = await directReport("regions", "CUSTOM_REPORT",
    ["LocationOfPresenceName", "Impressions", "Clicks", "Cost"], false);
}

// ---------------- WORDSTAT (Direct API v4 Live) ----------------
const sets = [
  { name: "services_smol2", geo: [10795], phrases: ["лазерная резка металла цена", "лазерная резка металла на заказ", "гибка металла на заказ", "порошковая покраска металла", "изготовление металлоизделий", "металлоизделия на заказ", "изготовление деталей из металла", "металлообработка на заказ", "изготовление металлоконструкций", "сварка металлоконструкций"] },
  { name: "kassety_rf2", geo: [225], phrases: ["металлокассеты от производителя", "металлокассеты оптом", "фасадные кассеты производство", "фасадные кассеты цена", "металлокассеты для вентфасада", "кассеты для вентилируемого фасада", "металлокассеты оцинкованные", "металлокассеты с полимерным покрытием", "фасадные панели металлические", "изготовление фасадных кассет"] },
  { name: "b2b_rf", geo: [225], phrases: ["изготовление деталей из листового металла", "детали из листового металла на заказ", "изготовление металлоизделий по чертежам заказчика", "производство металлоизделий на заказ", "изготовление закладных деталей", "закладные детали на заказ", "изготовление металлических корпусов", "металлический корпус на заказ", "корзины для кондиционеров производство", "корзины для кондиционеров оптом"] },
  { name: "fasad_rf", geo: [225], phrases: ["парапетные крышки на заказ", "изготовление парапетных крышек", "отливы оконные на заказ", "откосы металлические на заказ", "аквилоны изготовление", "противопожарные отсечки изготовление", "доборные элементы для вентфасада", "фасонные элементы из оцинковки", "гибка оцинковки на заказ", "изготовление доборных элементов"] },
  { name: "b2b_msk", geo: [1], phrases: ["изготовление деталей из листового металла", "металлоизделия на заказ", "изготовление металлоизделий по чертежам", "лазерная резка металла", "гибка металла", "корзины для кондиционеров", "закладные детали", "парапетные крышки", "металлический корпус на заказ", "порошковая покраска металла"] },
];

async function v4(label, method, param) {
  const body = { method, locale: "ru", token: yd };
  if (param !== undefined) body.param = param;
  for (const host of ["https://api.direct.yandex.ru/live/v4/json/", "https://api.direct.yandex.com/live/v4/json/"]) {
    const r = await call(`ws.${label}`, host, { method: "POST", body, headers: { Authorization: `Bearer ${yd}` } });
    if (r.status !== 0 && !(r.status >= 500)) return r;
  }
  return { ok: false, status: 0, body: null };
}

if (yd) {
  const queue = [...sets];
  const results = {};
  while (queue.length) {
    const batch = queue.splice(0, 4);
    const created = [];
    for (const s of batch) {
      const r = await v4(`create.${s.name}`, "CreateNewWordstatReport", { Phrases: s.phrases, GeoID: s.geo });
      if (typeof r.body?.data === "number") created.push({ s, id: r.body.data });
      else results[s.name] = { geo: s.geo, error: r.body };
    }
    for (let i = 0; i < 40 && created.some((c) => !c.done); i++) {
      await sleep(8000);
      const l = await v4("poll", "GetWordstatReportList");
      const st = Object.fromEntries((l.body?.data || []).map((x) => [x.ReportID, x.StatusReport]));
      for (const c of created) {
        if (c.done || !["Done", "Failed"].includes(st[c.id])) continue;
        if (st[c.id] === "Done") {
          const g = await v4(`get.${c.s.name}`, "GetWordstatReport", c.id);
          results[c.s.name] = { geo: c.s.geo, data: g.body?.data ?? null, error: g.body?.data ? undefined : g.body };
        } else results[c.s.name] = { geo: c.s.geo, error: "REPORT_FAILED" };
        await v4(`delete.${c.s.name}`, "DeleteWordstatReport", c.id);
        c.done = true;
      }
    }
    for (const c of created) if (!c.done) {
      results[c.s.name] = { geo: c.s.geo, error: "TIMEOUT" };
      await v4(`delete.${c.s.name}`, "DeleteWordstatReport", c.id);
    }
  }
  out.wordstat.results = results;
}

writeFileSync("/tmp/report.json", JSON.stringify(out, null, 2));
console.log("REPORT_BYTES:", Buffer.byteLength(JSON.stringify(out)));

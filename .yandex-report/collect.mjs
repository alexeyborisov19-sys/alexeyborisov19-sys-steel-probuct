// Read-only collector: Yandex Webmaster (index, queries, positions) + Yandex Metrika (organic traffic).
// Writes the full result to /tmp/report.json. Only endpoint labels and HTTP statuses go to the log,
// because this repository is public and its Actions logs are public too.
import { writeFileSync } from "node:fs";

const COUNTER_ID = "112542227";
const out = { generated_at: new Date().toISOString(), calls: [], webmaster: {}, metrika: {} };

function normToken(raw = "") {
  let v = String(raw).trim().replace(/^OAuth\s+/i, "").replace(/^Bearer\s+/i, "");
  const m = v.match(/(?:^|[#?&])access_token=([^&#\s]+)/i);
  if (m) { try { v = decodeURIComponent(m[1]); } catch { v = m[1]; } }
  return v.trim();
}

async function get(label, url, token) {
  let status = 0, body = null;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `OAuth ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    status = res.status;
    const text = await res.text();
    try { body = text ? JSON.parse(text) : {}; } catch { body = text.slice(0, 2000); }
  } catch (e) {
    body = { error: "NETWORK_ERROR", code: e?.cause?.code || e?.name || "UNKNOWN" };
  }
  out.calls.push({ label, status });
  console.log(`${label}: HTTP ${status}`);
  return { ok: status >= 200 && status < 300, status, body };
}

const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const today = day(0);

// ---------------- WEBMASTER ----------------
const wmCandidates = [
  ["YANDEX_WEBMASTER_OAUTH_TOKEN", process.env.YW_TOKEN],
  ["YANDEX_OAUTH_TOKEN", process.env.YANDEX_OAUTH_TOKEN],
  ["YANDEX_METRIKA_OAUTH_TOKEN", process.env.YM_TOKEN],
  ["YANDEX_DIRECT_OAUTH_TOKEN", process.env.YD_TOKEN],
].map(([n, v]) => [n, normToken(v || "")]).filter(([, v]) => v);

let yw = "", uid = null;
for (const [name, tok] of wmCandidates) {
  const u = await get(`webmaster.user[${name}]`, "https://api.webmaster.yandex.net/v4/user", tok);
  if (u.ok && u.body?.user_id) { yw = tok; uid = u.body.user_id; out.webmaster.token_secret_used = name; break; }
  out.webmaster[`user_error_${name}`] = u.body;
}

if (uid) {
  const base = `https://api.webmaster.yandex.net/v4/user/${uid}`;
  const hosts = await get("webmaster.hosts", `${base}/hosts`, yw);
  const all = hosts.body?.hosts || [];
  const mine = all.filter((h) => String(h.unicode_host_url || h.ascii_host_url || "").includes("steelprodukt"));
  out.webmaster.hosts = mine.map((h) => ({
    host_id: h.host_id,
    url: h.unicode_host_url || h.ascii_host_url,
    verified: h.verified,
    host_data_status: h.host_data_status,
    main_mirror: h.main_mirror ? (h.main_mirror.unicode_host_url || h.main_mirror.ascii_host_url) : null,
  }));
  const main = mine.find((h) => h.verified && !h.main_mirror) || mine.find((h) => h.verified) || mine[0];

  // Summary for every steelprodukt host (www and non-www may both be registered).
  out.webmaster.summaries = {};
  for (const h of mine) {
    const s = await get(`webmaster.summary[${h.host_id}]`, `${base}/hosts/${encodeURIComponent(h.host_id)}/summary`, yw);
    out.webmaster.summaries[h.host_id] = s.body;
  }

  if (main) {
    const hb = `${base}/hosts/${encodeURIComponent(main.host_id)}`;
    out.webmaster.main_host = main.host_id;

    async function withDates(label, path, from, extra = "") {
      let r = await get(label, `${hb}/${path}?date_from=${from}&date_to=${today}${extra}`, yw);
      if (r.status === 400) {
        r = await get(`${label}#iso`, `${hb}/${path}?date_from=${from}T00:00:00%2B03:00&date_to=${today}T23:59:59%2B03:00${extra}`, yw);
      }
      return r.body;
    }

    const ind = "&query_indicator=TOTAL_SHOWS&query_indicator=TOTAL_CLICKS&query_indicator=AVG_SHOW_POSITION&query_indicator=AVG_CLICK_POSITION";
    out.webmaster.popular_queries_30d = await withDates("webmaster.popular_30d", "search-queries/popular", day(30), `&order_by=TOTAL_SHOWS${ind}&limit=500`);
    out.webmaster.popular_queries_7d = await withDates("webmaster.popular_7d", "search-queries/popular", day(7), `&order_by=TOTAL_SHOWS${ind}&limit=500`);
    out.webmaster.queries_history_90d = await withDates("webmaster.queries_history", "search-queries/all/history", day(90), "&query_indicator=TOTAL_SHOWS&query_indicator=TOTAL_CLICKS&query_indicator=AVG_SHOW_POSITION");
    out.webmaster.in_search_history_90d = await withDates("webmaster.in_search_history", "search-urls/in-search/history", day(90));
    out.webmaster.indexing_history_90d = await withDates("webmaster.indexing_history", "indexing/history", day(90));
    out.webmaster.sqi_history = await withDates("webmaster.sqi_history", "sqi-history", day(365));

    // Pages in search (paginate up to 500).
    const inSearch = [];
    let inSearchCount = null;
    for (let off = 0; off < 500; off += 100) {
      const r = await get(`webmaster.in_search_samples@${off}`, `${hb}/search-urls/in-search/samples?offset=${off}&limit=100`, yw);
      if (!r.ok) { out.webmaster.in_search_samples_error = r.body; break; }
      inSearchCount = r.body?.count ?? inSearchCount;
      inSearch.push(...(r.body?.samples || []));
      if ((r.body?.samples || []).length < 100) break;
    }
    out.webmaster.in_search = { count: inSearchCount, samples: inSearch };

    const events = await get("webmaster.search_events", `${hb}/search-urls/events/samples?offset=0&limit=100`, yw);
    out.webmaster.search_events = events.body;

    const crawled = [];
    let crawledCount = null;
    for (let off = 0; off < 300; off += 100) {
      const r = await get(`webmaster.indexing_samples@${off}`, `${hb}/indexing/samples?offset=${off}&limit=100`, yw);
      if (!r.ok) { out.webmaster.indexing_samples_error = r.body; break; }
      crawledCount = r.body?.count ?? crawledCount;
      crawled.push(...(r.body?.samples || []));
      if ((r.body?.samples || []).length < 100) break;
    }
    out.webmaster.indexing = { count: crawledCount, samples: crawled };

    out.webmaster.diagnostics = (await get("webmaster.diagnostics", `${hb}/diagnostics`, yw)).body;
    out.webmaster.important_urls = (await get("webmaster.important_urls", `${hb}/important-urls`, yw)).body;
    out.webmaster.external_links = (await get("webmaster.external_links", `${hb}/links/external/samples?offset=0&limit=100`, yw)).body;
    out.webmaster.sitemaps = (await get("webmaster.sitemaps", `${hb}/sitemaps?limit=100`, yw)).body;
  }
}

// ---------------- METRIKA ----------------
const ymCandidates = [
  ["YANDEX_METRIKA_OAUTH_TOKEN", process.env.YM_TOKEN],
  ["YANDEX_OAUTH_TOKEN", process.env.YANDEX_OAUTH_TOKEN],
].map(([n, v]) => [n, normToken(v || "")]).filter(([, v]) => v);

let ym = "";
for (const [name, tok] of ymCandidates) {
  const c = await get(`metrika.counter[${name}]`, `https://api-metrika.yandex.net/management/v1/counter/${COUNTER_ID}`, tok);
  if (c.ok) { ym = tok; out.metrika.token_secret_used = name; out.metrika.counter = { id: c.body?.counter?.id, site: c.body?.counter?.site, status: c.body?.counter?.status }; break; }
}

if (ym) {
  async function report(label, params, endpoint = "data") {
    const u = new URL(`https://api-metrika.yandex.net/stat/v1/${endpoint}`);
    u.searchParams.set("ids", COUNTER_ID);
    u.searchParams.set("accuracy", "full");
    u.searchParams.set("lang", "ru");
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const r = await get(`metrika.${label}`, u.toString(), ym);
    return r.ok ? { query: params, totals: r.body?.totals, data: r.body?.data, time_intervals: r.body?.time_intervals, sampled: r.body?.sampled } : { query: params, error: r.body, status: r.status };
  }
  const organic = "ym:s:trafficSource=='organic'";

  out.metrika.sources_30d = await report("sources_30d", { date1: "30daysAgo", date2: "today", dimensions: "ym:s:trafficSource", metrics: "ym:s:visits,ym:s:users,ym:s:bounceRate", limit: "20" });
  out.metrika.sources_90d = await report("sources_90d", { date1: "90daysAgo", date2: "today", dimensions: "ym:s:trafficSource", metrics: "ym:s:visits,ym:s:users,ym:s:bounceRate", limit: "20" });
  out.metrika.organic_engines_90d = await report("organic_engines_90d", { date1: "90daysAgo", date2: "today", dimensions: "ym:s:searchEngineRoot", metrics: "ym:s:visits,ym:s:users,ym:s:bounceRate,ym:s:pageDepth", filters: organic, limit: "20" });
  out.metrika.organic_landings_90d = await report("organic_landings_90d", { date1: "90daysAgo", date2: "today", dimensions: "ym:s:startURL", metrics: "ym:s:visits,ym:s:users,ym:s:bounceRate", filters: organic, limit: "60", sort: "-ym:s:visits" });
  let phrases = await report("organic_phrases_90d", { date1: "90daysAgo", date2: "today", dimensions: "ym:s:lastsignSearchPhrase", metrics: "ym:s:visits,ym:s:users", filters: organic, limit: "150", sort: "-ym:s:visits" });
  if (phrases.error) phrases = await report("organic_phrases_90d_fallback", { date1: "90daysAgo", date2: "today", dimensions: "ym:s:lastSearchPhrase", metrics: "ym:s:visits,ym:s:users", filters: organic, limit: "150", sort: "-ym:s:visits" });
  out.metrika.organic_phrases_90d = phrases;
  out.metrika.weekly_by_source_90d = await report("weekly_by_source_90d", { date1: "90daysAgo", date2: "today", dimensions: "ym:s:trafficSource", metrics: "ym:s:visits", group: "week", limit: "10" }, "data/bytime");

  const goals = await get("metrika.goals", `https://api-metrika.yandex.net/management/v1/counter/${COUNTER_ID}/goals`, ym);
  const list = goals.body?.goals || [];
  const primary = list.find((g) => (g.conditions || []).some((c) => c.url === "quote_request_success")) || list.find((g) => g.name === "Форма заявки — успешно отправлена");
  if (primary) {
    out.metrika.primary_goal = { id: primary.id, name: primary.name };
    out.metrika.leads_by_source_90d = await report("leads_by_source_90d", { date1: "90daysAgo", date2: "today", dimensions: "ym:s:trafficSource", metrics: `ym:s:visits,ym:s:goal${primary.id}reaches`, limit: "20" });
  }
}

writeFileSync("/tmp/report.json", JSON.stringify(out, null, 2));
console.log("REPORT_BYTES:", Buffer.byteLength(JSON.stringify(out)));

// Read-only search visibility pass (2026-10-02 09:20 MSK): Yandex Webmaster summary, queries, indexing,
// query analytics for commercial pages, Metrika organic visits. Nothing is changed anywhere.
// Writes the full result to /tmp/report.json. Only endpoint labels and HTTP statuses go to the log,
// because this repository is public and its Actions logs are public too.
import { writeFileSync } from "node:fs";

const COUNTER_ID = "112542227";
const out = { generated_at: new Date().toISOString(), pass: "search", calls: [], webmaster: {}, metrika: {} };

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


// Collapse daily statistics into totals so the report stays small.
function aggregate(body) {
  const rows = body?.text_indicator_to_statistics;
  if (!Array.isArray(rows)) return null;
  const dates = new Set();
  const items = rows.map((r) => {
    const acc = { IMPRESSIONS: 0, CLICKS: 0, DEMAND: 0, POS_W: 0, POS_N: 0 };
    for (const s of r.statistics || []) {
      if (s.date) dates.add(String(s.date).slice(0, 10));
      const v = Number(s.value) || 0;
      if (s.field === "IMPRESSIONS") acc.IMPRESSIONS += v;
      else if (s.field === "CLICKS") acc.CLICKS += v;
      else if (s.field === "DEMAND") acc.DEMAND += v;
    }
    // position weighted by daily impressions
    const byDate = {};
    for (const s of r.statistics || []) {
      const d = String(s.date).slice(0, 10);
      byDate[d] ??= {};
      byDate[d][s.field] = Number(s.value) || 0;
    }
    for (const d of Object.values(byDate)) {
      if (d.POSITION && d.IMPRESSIONS) { acc.POS_W += d.POSITION * d.IMPRESSIONS; acc.POS_N += d.IMPRESSIONS; }
    }
    return {
      value: r.text_indicator?.value,
      type: r.text_indicator?.type,
      impressions: acc.IMPRESSIONS,
      clicks: acc.CLICKS,
      demand: acc.DEMAND,
      position: acc.POS_N ? +(acc.POS_W / acc.POS_N).toFixed(2) : null,
    };
  });
  const sorted = [...dates].sort();
  return { count: body.count, date_from: sorted[0] || null, date_to: sorted.at(-1) || null, days: sorted.length, items };
}


async function post(label, url, body) {
  let status = 0, parsed = null;
  try {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `OAuth ${yw}`, Accept: "application/json", "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) });
    status = res.status;
    const text = await res.text();
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = text.slice(0, 3000); }
  } catch (e) { parsed = { error: "NETWORK_ERROR", code: e?.cause?.code || e?.name || "UNKNOWN" }; }
  out.calls.push({ label, status });
  console.log(`${label}: HTTP ${status}`);
  return { ok: status >= 200 && status < 300, status, body: parsed };
}

if (uid) {
  const hostId = "https:www.steelprodukt.ru:443";
  const qaUrl = `https://api.webmaster.yandex.net/v4/user/${uid}/hosts/${encodeURIComponent(hostId)}/query-analytics/list`;
  async function qaList(label, body) {
    const variants = [body, { ...body, filters: { ...(body.filters || {}), statistic_filters: [] } }, (() => { const b = { ...body }; delete b.device_type_indicator; return b; })()];
    let last = null;
    for (const [i, v] of variants.entries()) {
      const r = await post(`wm.qa.${label}${i ? `#v${i}` : ""}`, qaUrl, v);
      if (r.ok) { const a = aggregate(r.body); return a ? { request: v, ...a } : { request: v, raw_head: JSON.stringify(r.body).slice(0, 4000) }; }
      last = { request: v, status: r.status, error: r.body };
      if (r.status !== 400) break;
    }
    return last;
  }
  const base = { offset: 0, limit: 500, device_type_indicator: "ALL", text_indicator: "QUERY", region_ids: [], filters: {} };
  out.webmaster.qa_queries = await qaList("queries", base);
  out.webmaster.qa_urls = await qaList("urls", { ...base, text_indicator: "URL" });
  const pages = ["/", "/products/metallokassety", "/calculator-metallokassety", "/products/korziny-dlya-konditsionerov",
    "/production/lazernaya-rezka-metalla", "/production/gibka-listovogo-metalla", "/production/poroshkovaya-okraska-metalla",
    "/production/svarka-i-sborka-metalloizdeliy", "/online-order", "/solutions/custom", "/contacts"];
  out.webmaster.qa_by_page = {};
  for (const p of pages) {
    out.webmaster.qa_by_page[p] = await qaList(`page${p.replaceAll("/", "_")}`, { ...base, limit: 100,
      filters: { text_filters: [{ text_indicator: "URL", operation: "TEXT_MATCH", value: `https://www.steelprodukt.ru${p}` }] } });
  }
}

// ---------------- METRIKA: organic visits by day and landing page ----------------
const ym = normToken(process.env.YM_TOKEN || "");
if (ym) {
  const C = 112542227;
  const m = async (label, q) => (await get(`metrika.${label}`, `https://api-metrika.yandex.net/stat/v1/data?ids=${C}&accuracy=full&${q}`, ym)).body;
  out.metrika.organic_daily_30d = await m("organic_daily", "date1=30daysAgo&date2=today&dimensions=ym:s:date,ym:s:lastsignSearchEngineRoot&filters=ym:s:lastsignTrafficSource=='organic'&metrics=ym:s:visits&sort=ym:s:date&limit=200");
  out.metrika.organic_landings_30d = await m("organic_landings", "date1=30daysAgo&date2=today&dimensions=ym:s:startURLPath&filters=ym:s:lastsignTrafficSource=='organic'&metrics=ym:s:visits,ym:s:bounceRate&sort=-ym:s:visits&limit=50");
}

writeFileSync("/tmp/report.json", JSON.stringify(out));
console.log("REPORT_BYTES:", Buffer.byteLength(JSON.stringify(out)));

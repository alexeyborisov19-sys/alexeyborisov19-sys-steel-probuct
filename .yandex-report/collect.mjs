// Read-only collector, run 2: Webmaster query analytics (per page / per query, with demand)
// and Wordstat frequencies via Direct API v4 Live for commercial phrases.
// Full results go to /tmp/report.json (encrypted by the workflow). The public log gets labels and HTTP codes only.
import { writeFileSync } from "node:fs";

const out = { generated_at: new Date().toISOString(), calls: [], webmaster: {}, wordstat: {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normToken(raw = "") {
  let v = String(raw).trim().replace(/^OAuth\s+/i, "").replace(/^Bearer\s+/i, "");
  const m = v.match(/(?:^|[#?&])access_token=([^&#\s]+)/i);
  if (m) { try { v = decodeURIComponent(m[1]); } catch { v = m[1]; } }
  return v.trim();
}

async function call(label, url, { token, method = "GET", body, auth = "OAuth" } = {}) {
  let status = 0, parsed = null;
  try {
    const headers = { Accept: "application/json" };
    if (token && auth) headers.Authorization = `${auth} ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json; charset=utf-8";
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(40000),
    });
    status = res.status;
    const text = await res.text();
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = text.slice(0, 3000); }
  } catch (e) {
    parsed = { error: "NETWORK_ERROR", code: e?.cause?.code || e?.name || "UNKNOWN" };
  }
  out.calls.push({ label, status });
  console.log(`${label}: HTTP ${status}`);
  return { ok: status >= 200 && status < 300, status, body: parsed };
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

// ---------------- WEBMASTER QUERY ANALYTICS ----------------
const wmCandidates = [
  ["YANDEX_WEBMASTER_OAUTH_TOKEN", process.env.YW_TOKEN],
  ["YANDEX_DIRECT_OAUTH_TOKEN", process.env.YD_TOKEN],
  ["YANDEX_OAUTH_TOKEN", process.env.YANDEX_OAUTH_TOKEN],
  ["YANDEX_METRIKA_OAUTH_TOKEN", process.env.YM_TOKEN],
].map(([n, v]) => [n, normToken(v || "")]).filter(([, v]) => v);

let yw = "", uid = null;
for (const [name, tok] of wmCandidates) {
  const u = await call(`wm.user[${name}]`, "https://api.webmaster.yandex.net/v4/user", { token: tok });
  if (u.ok && u.body?.user_id) { yw = tok; uid = u.body.user_id; out.webmaster.token_secret_used = name; break; }
}

if (uid) {
  const hostId = "https:www.steelprodukt.ru:443";
  const qa = `https://api.webmaster.yandex.net/v4/user/${uid}/hosts/${encodeURIComponent(hostId)}/query-analytics/list`;

  async function qaList(label, body) {
    const variants = [
      body,
      { ...body, filters: { ...(body.filters || {}), statistic_filters: [] } },
      (() => { const b = { ...body }; delete b.device_type_indicator; return b; })(),
    ];
    let last = null;
    for (const [i, v] of variants.entries()) {
      const r = await call(`wm.qa.${label}${i ? `#v${i}` : ""}`, qa, { token: yw, method: "POST", body: v });
      if (r.ok) {
        const agg = aggregate(r.body);
        return agg ? { request: v, ...agg } : { request: v, raw_head: JSON.stringify(r.body).slice(0, 4000) };
      }
      last = { request: v, status: r.status, error: r.body };
      if (r.status !== 400) break;
    }
    return last;
  }

  const base = { offset: 0, limit: 500, device_type_indicator: "ALL", text_indicator: "QUERY", region_ids: [], filters: {} };

  out.webmaster.qa_urls = await qaList("urls", { ...base, text_indicator: "URL" });
  out.webmaster.qa_queries = await qaList("queries", base);
  if (out.webmaster.qa_queries?.count > 500) {
    out.webmaster.qa_queries_p2 = await qaList("queries_p2", { ...base, offset: 500 });
    if (out.webmaster.qa_queries?.count > 1000) out.webmaster.qa_queries_p3 = await qaList("queries_p3", { ...base, offset: 1000 });
    if (out.webmaster.qa_queries?.count > 1500) out.webmaster.qa_queries_p4 = await qaList("queries_p4", { ...base, offset: 1500 });
  }
  out.webmaster.qa_queries_smolensk = await qaList("queries_smolensk", { ...base, region_ids: [12] });
  out.webmaster.qa_queries_moscow = await qaList("queries_moscow", { ...base, region_ids: [213] });

  // Queries landing on each commercial page (cross filter by URL).
  const pages = [
    "/products/metallokassety", "/products/metallokassety-standart", "/products/metallokassety-premium",
    "/products/metallokassety-azhur", "/products/metallokassety-relef", "/calculator-metallokassety",
    "/production/lazernaya-rezka-metalla", "/production/gibka-listovogo-metalla",
    "/production/poroshkovaya-okraska-metalla", "/production/svarka-i-sborka-metalloizdeliy",
    "/production/proektirovanie-metalloizdeliy", "/products/korziny-dlya-konditsionerov",
    "/products/metallicheskie-korpusa", "/products/ventilyacionnye-reshetki", "/products/zakladnye-detali",
    "/products/dobornye-elementy", "/products/akvilon", "/products/pozharnye-otsechki",
    "/products/otkosy-dlya-okon", "/products/otlivy-dlya-okon", "/products/parapetnye-kryshki",
    "/solutions/custom", "/solutions/industry", "/solutions/climate", "/production", "/products", "/",
  ];
  out.webmaster.qa_by_page = {};
  for (const p of pages) {
    const url = `https://www.steelprodukt.ru${p}`;
    out.webmaster.qa_by_page[p] = await qaList(`page${p.replaceAll("/", "_")}`, {
      ...base,
      limit: 200,
      filters: { text_filters: [{ text_indicator: "URL", operation: "TEXT_MATCH", value: url }] },
    });
    if (out.webmaster.qa_by_page[p]?.status === 400 || out.webmaster.qa_by_page[p]?.error) {
      out.webmaster.qa_by_page[p] = await qaList(`page${p.replaceAll("/", "_")}#contains`, {
        ...base,
        limit: 200,
        filters: { text_filters: [{ text_indicator: "URL", operation: "TEXT_CONTAINS", value: p === "/" ? "steelprodukt.ru/" : p }] },
      });
    }
  }

  // All queries containing commercial stems (beyond the top-500 list).
  const stems = ["кассет", "лазер", "резк", "гибк", "гнут", "окрас", "покрас", "порошк", "корзин", "кондиц", "корпус", "шкаф",
    "металлоизд", "изделия из", "решет", "решёт", "отлив", "откос", "парапет", "закладн", "доборн", "смоленск", "на заказ", "по чертеж"];
  out.webmaster.qa_by_stem = {};
  for (const s of stems) {
    out.webmaster.qa_by_stem[s] = await qaList(`stem`, {
      ...base,
      filters: { text_filters: [{ text_indicator: "QUERY", operation: "TEXT_CONTAINS", value: s }] },
    });
  }
}

// ---------------- WORDSTAT via Direct API v4 Live ----------------
const yd = normToken(process.env.YD_TOKEN || process.env.YANDEX_OAUTH_TOKEN || "");
const login = String(process.env.YD_CLIENT_LOGIN || "").trim();
const sets = [
  { name: "kassety_rf", geo: [225], phrases: ["металлокассеты", "фасадные кассеты", "металлокассеты для фасада", "металлокассеты цена", "металлокассеты производство", "металлокассеты купить", "кассетный фасад", "металлокассеты закрытого типа", "металлокассеты открытого типа", "производство фасадных кассет"] },
  { name: "kassety_msk", geo: [1], phrases: ["металлокассеты", "фасадные кассеты", "металлокассеты для фасада", "металлокассеты цена", "металлокассеты производство", "металлокассеты купить", "кассетный фасад", "металлокассеты закрытого типа", "металлокассеты открытого типа", "производство фасадных кассет"] },
  { name: "services_smol", geo: [10795], phrases: ["лазерная резка металла", "лазерная резка", "гибка металла", "порошковая покраска", "порошковая окраска", "металлообработка", "изготовление металлоизделий", "металлоизделия на заказ", "резка металла", "сварочные работы"] },
  { name: "services_rf", geo: [225], phrases: ["лазерная резка металла", "гибка листового металла", "порошковая окраска металла", "изготовление металлоизделий", "изделия из листового металла", "изготовление металлоизделий по чертежам", "металлоизделия на заказ", "изготовление корпусов из металла", "контрактное производство металлоизделий", "металлообработка на заказ"] },
  { name: "products_rf", geo: [225], phrases: ["корзины для кондиционеров", "корзина для кондиционера на фасад", "вентиляционные решетки металлические", "откосы металлические", "отливы оконные металлические", "парапетные крышки", "аквилон", "противопожарные отсечки", "закладные детали", "доборные элементы фасада"] },
  { name: "products_smol", geo: [10795], phrases: ["металлокассеты", "корзина для кондиционера", "отливы", "откосы", "парапет", "металлический корпус", "металлический шкаф", "вентиляционная решетка", "закладные детали", "металлоконструкции"] },
];

async function v4(label, method, param) {
  const body = { method, locale: "ru", token: yd };
  if (param !== undefined) body.param = param;
  for (const host of ["https://api.direct.yandex.ru/live/v4/json/", "https://api.direct.yandex.com/live/v4/json/"]) {
    const r = await call(`ws.${label}`, host, { token: yd, method: "POST", body, auth: "Bearer" });
    if (r.status !== 0 && !(r.status >= 500)) return r;
  }
  return { ok: false, status: 0, body: null };
}

if (!yd) {
  out.wordstat.error = "DIRECT_TOKEN_MISSING";
} else {
  const list0 = await v4("list0", "GetWordstatReportList");
  out.wordstat.initial_list = list0.body;
  const queue = [...sets];
  const results = {};
  while (queue.length) {
    const batch = queue.splice(0, 4);
    const created = [];
    for (const s of batch) {
      const param = { Phrases: s.phrases, GeoID: s.geo };
      if (login) param.Login = login;
      let r = await v4(`create.${s.name}`, "CreateNewWordstatReport", param);
      if (r.body?.error_code && login) {
        // retry without Login for non-agency accounts
        r = await v4(`create.${s.name}#nologin`, "CreateNewWordstatReport", { Phrases: s.phrases, GeoID: s.geo });
      }
      if (typeof r.body?.data === "number") created.push({ s, id: r.body.data });
      else results[s.name] = { geo: s.geo, error: r.body };
    }
    // poll
    for (let i = 0; i < 40 && created.some((c) => !c.done); i++) {
      await sleep(8000);
      const l = await v4(`poll`, "GetWordstatReportList");
      const st = Object.fromEntries((l.body?.data || []).map((x) => [x.ReportID, x.StatusReport]));
      for (const c of created) {
        if (!c.done && st[c.id] === "Done") {
          const g = await v4(`get.${c.s.name}`, "GetWordstatReport", c.id);
          results[c.s.name] = { geo: c.s.geo, data: g.body?.data ?? null, error: g.body?.data ? undefined : g.body };
          await v4(`delete.${c.s.name}`, "DeleteWordstatReport", c.id);
          c.done = true;
        } else if (!c.done && st[c.id] === "Failed") {
          results[c.s.name] = { geo: c.s.geo, error: "REPORT_FAILED" };
          await v4(`delete.${c.s.name}`, "DeleteWordstatReport", c.id);
          c.done = true;
        }
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

// Read-only live SERP check (2026-10-03). Runs on the site server via SSH, uses the Yandex Search API
// key already configured there, prints ONE JSON line between markers. Keys never leave the server and
// are never printed; only the env variable NAME that worked is reported.
import { createRequire } from "node:module";

const require = createRequire(process.cwd() + "/package.json");
const silent = { info() {}, warn() {}, error() {}, log() {} };
try { require("@next/env").loadEnvConfig(process.cwd(), false, silent); } catch {}
const e = process.env;
const has = (k) => Boolean(e[k] && String(e[k]).trim());

const keyNames = ["YANDEX_SEARCH_API_KEY", "YANDEX_AI_API_KEY", "YANDEX_SPEECHKIT_API_KEY"].filter(has);
const folderNames = ["YANDEX_SEARCH_FOLDER_ID", "YANDEX_AI_FOLDER_ID"].filter(has);

const SMOLENSK = "12";
const MOSCOW = "213";
const plan = [
  ["металлокассеты", [SMOLENSK, MOSCOW]],
  ["металлокассеты для фасада", [SMOLENSK, MOSCOW]],
  ["металлокассеты купить", [SMOLENSK, MOSCOW]],
  ["металлокассеты от производителя", [SMOLENSK, MOSCOW]],
  ["фасадные кассеты", [SMOLENSK, MOSCOW]],
  ["корзины для кондиционеров", [SMOLENSK, MOSCOW]],
  ["корзина для кондиционера на фасад", [SMOLENSK, MOSCOW]],
  ["металлоизделия по чертежам", [SMOLENSK, MOSCOW]],
  ["металлокассеты смоленск", [SMOLENSK]],
  ["лазерная резка металла смоленск", [SMOLENSK]],
  ["гибка металла смоленск", [SMOLENSK]],
  ["порошковая покраска смоленск", [SMOLENSK]],
  ["изготовление металлоизделий смоленск", [SMOLENSK]],
  ["сталь продукт", [SMOLENSK]],
];

const decode = (s = "") => s.replace(/<\/?hlword>/g, "").replace(/<[^>]+>/g, "")
  .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").trim();

function parse(xml) {
  const out = [];
  let pos = 0;
  for (const g of xml.matchAll(/<group>([\s\S]*?)<\/group>/g)) {
    const doc = g[1].match(/<doc[^>]*>([\s\S]*?)<\/doc>/);
    if (!doc) continue;
    pos += 1;
    const url = (doc[1].match(/<url>([\s\S]*?)<\/url>/) || [])[1] || "";
    const domain = (doc[1].match(/<domain>([\s\S]*?)<\/domain>/) || [])[1] || "";
    const title = (doc[1].match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
    out.push({ pos, url: decode(url), domain: decode(domain), title: decode(title).slice(0, 160) });
  }
  const found = (xml.match(/<found priority="all">(\d+)<\/found>/) || [])[1];
  const err = (xml.match(/<error[^>]*>([\s\S]*?)<\/error>/) || [])[1];
  return { results: out, found: found ? Number(found) : null, xml_error: err ? decode(err) : null };
}

async function search(key, folder, queryText, region, page = "0") {
  const res = await fetch("https://searchapi.api.cloud.yandex.net/v2/web/search", {
    method: "POST",
    headers: { Authorization: `Api-Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: { searchType: "SEARCH_TYPE_RU", queryText, familyMode: "FAMILY_MODE_MODERATE", page, fixTypoMode: "FIX_TYPO_MODE_OFF" },
      sortSpec: { sortMode: "SORT_MODE_BY_RELEVANCE" },
      groupSpec: { groupMode: "GROUP_MODE_DEEP", groupsOnPage: "50", docsInGroup: "1" },
      maxPassages: "1",
      region,
      l10n: "LOCALIZATION_RU",
      folderId: folder,
      responseFormat: "FORMAT_XML",
    }),
    signal: AbortSignal.timeout(40000),
  });
  const text = await res.text();
  if (!res.ok) return { status: res.status, error: text.slice(0, 300) };
  let payload;
  try { payload = JSON.parse(text); } catch { return { status: res.status, error: "NON_JSON" }; }
  if (typeof payload.rawData !== "string") return { status: res.status, error: "NO_RAWDATA" };
  return { status: res.status, ...parse(Buffer.from(payload.rawData, "base64").toString("utf8")) };
}

const report = { generated_at: new Date().toISOString(), key_names_present: keyNames, folder_names_present: folderNames, auth: null, probes: [], serp: [] };

let auth = null;
outer: for (const k of keyNames) {
  for (const f of folderNames) {
    const r = await search(e[k].trim(), e[f].trim(), "сталь продукт", SMOLENSK);
    report.probes.push({ key: k, folder: f, status: r.status, error: r.error ? r.error.slice(0, 200) : undefined });
    if (r.status === 200 && !r.error) { auth = { k, f }; break outer; }
  }
}

if (auth) {
  report.auth = { key: auth.k, folder: auth.f };
  for (const [q, regions] of plan) {
    for (const region of regions) {
      const r = await search(e[auth.k].trim(), e[auth.f].trim(), q, region);
      report.serp.push({ query: q, region, ...r });
    }
  }
}

console.log("@@SERP_BEGIN@@" + JSON.stringify(report) + "@@SERP_END@@");

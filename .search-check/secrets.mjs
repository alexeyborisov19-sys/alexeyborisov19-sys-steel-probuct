// Read-only inventory of repository secrets (2026-10-03). Input: ALL_SECRETS = toJSON(secrets).
// Records only secret NAMES, a type guess and value length. Values are never written or printed.
// Any value that looks like a Yandex Cloud API key / IAM token is probed against Search API v2
// (a refused probe costs nothing). If a working key+folder pair is found, runs serp.mjs with it.
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

let all = {};
try { all = JSON.parse(process.env.ALL_SECRETS || "{}"); } catch { all = {}; }
delete all.github_token;
delete all.GITHUB_TOKEN;

function kind(v) {
  const s = String(v || "").trim();
  if (!s) return "empty";
  if (/^AQVN[\w-]{20,}$/.test(s)) return "yandex_cloud_api_key";
  if (/^t1\.[\w.-]{20,}$/.test(s)) return "yandex_iam_token";
  if (/^y[0-3]_[\w-]{20,}$/.test(s) || /^AQAAAA[\w-]{20,}$/.test(s)) return "yandex_oauth_token";
  if (/^(b1|ao)[a-z0-9]{18}$/.test(s)) return "yandex_cloud_folder_or_cloud_id";
  if (/^-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s) || /^LS0tLS1CRUdJTi/.test(s)) return "private_key";
  if (/^https?:\/\//.test(s)) return "url";
  if (/^\{[\s\S]*\}$/.test(s)) return "json";
  if (/^[a-f0-9]{32}$/i.test(s)) return "hex32";
  return "other";
}

const inventory = Object.keys(all).sort().map((name) => ({ name, kind: kind(all[name]), length: String(all[name] || "").length }));
const keys = inventory.filter((x) => x.kind === "yandex_cloud_api_key" || x.kind === "yandex_iam_token").map((x) => x.name);
const folders = inventory.filter((x) => x.kind === "yandex_cloud_folder_or_cloud_id").map((x) => x.name);

async function probe(keyName, folderName) {
  const v = String(all[keyName]).trim();
  const auth = v.startsWith("t1.") ? `Bearer ${v}` : `Api-Key ${v}`;
  const body = {
    query: { searchType: "SEARCH_TYPE_RU", queryText: "сталь продукт", familyMode: "FAMILY_MODE_MODERATE", page: "0" },
    groupSpec: { groupMode: "GROUP_MODE_DEEP", groupsOnPage: "10", docsInGroup: "1" },
    region: "12", l10n: "LOCALIZATION_RU", responseFormat: "FORMAT_XML",
    ...(folderName ? { folderId: String(all[folderName]).trim() } : {}),
  };
  try {
    const res = await fetch("https://searchapi.api.cloud.yandex.net/v2/web/search", {
      method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    let msg = "";
    try { msg = JSON.parse(text).message || ""; } catch {}
    return { key: keyName, folder: folderName || "(none)", status: res.status, message: String(msg).slice(0, 160) };
  } catch (e) {
    return { key: keyName, folder: folderName || "(none)", status: 0, message: e?.name || "NETWORK_ERROR" };
  }
}

const probes = [];
let working = null;
outer: for (const k of keys) {
  for (const f of [...folders, ""]) {
    const r = await probe(k, f);
    probes.push(r);
    if (r.status === 200) { working = { k, f }; break outer; }
  }
}

let serp = null;
if (working) {
  try {
    const raw = execFileSync("node", [".search-check/serp.mjs"], {
      env: {
        PATH: process.env.PATH,
        YANDEX_SEARCH_API_KEY: String(all[working.k]).trim(),
        ...(working.f ? { YANDEX_SEARCH_FOLDER_ID: String(all[working.f]).trim() } : {}),
      },
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"], timeout: 15 * 60 * 1000,
    });
    const m = raw.match(/@@SERP_BEGIN@@([\s\S]*)@@SERP_END@@/);
    serp = m ? JSON.parse(m[1]) : { error: "NO_MARKERS" };
  } catch (e) {
    serp = { error: "SERP_RUN_FAILED", code: e?.status ?? null };
  }
}

writeFileSync("/tmp/secrets-check.json", JSON.stringify({
  generated_at: new Date().toISOString(),
  inventory, search_key_candidates: keys, folder_candidates: folders, probes,
  working: working ? { key: working.k, folder: working.f || "(none)" } : null, serp,
}));
console.log(`secrets: ${inventory.length}, key candidates: ${keys.length}, folder candidates: ${folders.length}, working: ${Boolean(working)}`);

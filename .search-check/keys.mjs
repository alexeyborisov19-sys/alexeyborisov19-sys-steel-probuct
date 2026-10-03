// Read-only check of Yandex-related repository secrets by explicit name (2026-10-03).
// Records only secret NAMES, a type guess and value length; values are never written or printed.
// Tries every way the secrets could reach Yandex Search API v2 (refused probes cost nothing):
//   - Yandex Cloud API keys / IAM tokens directly;
//   - service-account authorized keys (JSON) -> IAM token;
//   - Yandex OAuth tokens -> IAM token (works only for tokens issued for Yandex Cloud).
// With an IAM token and no folder secret, folders are discovered read-only via Resource Manager.
// If a working credential is found, runs serp.mjs with it.
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createSign } from "node:crypto";

const names = String(process.env.CANDIDATE_NAMES || "").split(",").map((s) => s.trim()).filter(Boolean);
const all = Object.fromEntries(names.map((n) => [n, String(process.env[n] || "").trim()]).filter(([, v]) => v));

function kind(s) {
  if (/^AQVN[\w-]{20,}$/.test(s)) return "yandex_cloud_api_key";
  if (/^t1\.[\w.-]{20,}$/.test(s)) return "yandex_iam_token";
  if (/^y[0-3]_[\w-]{20,}$/.test(s) || /^AQAAAA[\w-]{20,}$/.test(s)) return "yandex_oauth_token";
  if (/^(b1|ao)[a-z0-9]{18}$/.test(s)) return "yandex_cloud_folder_or_cloud_id";
  if (/^\{[\s\S]*"private_key"[\s\S]*\}$/.test(s)) return "service_account_key_json";
  if (/^-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s)) return "private_key_pem";
  if (/^https?:\/\//.test(s)) return "url";
  return "other";
}
const inventory = Object.keys(all).sort().map((name) => ({ name, kind: kind(all[name]), length: all[name].length }));
const of = (k) => inventory.filter((x) => x.kind === k).map((x) => x.name);

async function call(url, opts = {}) {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json };
  } catch (e) { return { status: 0, json: { message: e?.name || "NETWORK_ERROR" } }; }
}

// ---- collect credentials: { label, auth } ----
const creds = [];
for (const n of of("yandex_cloud_api_key")) creds.push({ label: `api_key:${n}`, auth: `Api-Key ${all[n]}`, iam: false });
for (const n of of("yandex_iam_token")) creds.push({ label: `iam:${n}`, auth: `Bearer ${all[n]}`, iam: true });

const exchanges = [];
for (const n of of("service_account_key_json")) {
  try {
    const k = JSON.parse(all[n]);
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const head = b64({ typ: "JWT", alg: "PS256", kid: k.id });
    const body = b64({ aud: "https://iam.api.cloud.yandex.net/iam/v1/tokens", iss: k.service_account_id, iat: now, exp: now + 600 });
    const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign({ key: k.private_key, padding: 6, saltLength: 32 }).toString("base64url");
    const r = await call("https://iam.api.cloud.yandex.net/iam/v1/tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jwt: `${head}.${body}.${sig}` }) });
    exchanges.push({ from: n, via: "sa_key", status: r.status, message: r.json?.message?.slice?.(0, 160) });
    if (r.json?.iamToken) creds.push({ label: `iam_from_sa:${n}`, auth: `Bearer ${r.json.iamToken}`, iam: true });
  } catch (e) { exchanges.push({ from: n, via: "sa_key", status: 0, message: "PARSE_OR_SIGN_FAILED" }); }
}
for (const n of of("yandex_oauth_token")) {
  const r = await call("https://iam.api.cloud.yandex.net/iam/v1/tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yandexPassportOauthToken: all[n] }) });
  exchanges.push({ from: n, via: "oauth", status: r.status, message: r.json?.message?.slice?.(0, 160) });
  if (r.json?.iamToken) creds.push({ label: `iam_from_oauth:${n}`, auth: `Bearer ${r.json.iamToken}`, iam: true });
}

// ---- folders: from secrets, plus read-only discovery for IAM credentials ----
const folders = of("yandex_cloud_folder_or_cloud_id").map((n) => ({ label: `secret:${n}`, id: all[n] }));
const discovery = [];
for (const c of creds.filter((c) => c.iam)) {
  const clouds = await call("https://resource-manager.api.cloud.yandex.net/resource-manager/v1/clouds", { headers: { Authorization: c.auth } });
  discovery.push({ cred: c.label, clouds_status: clouds.status, clouds: (clouds.json?.clouds || []).map((x) => x.name) });
  for (const cl of clouds.json?.clouds || []) {
    const fs = await call(`https://resource-manager.api.cloud.yandex.net/resource-manager/v1/folders?cloudId=${cl.id}`, { headers: { Authorization: c.auth } });
    for (const f of fs.json?.folders || []) folders.push({ label: `discovered:${cl.name}/${f.name}`, id: f.id });
  }
}

// ---- probe Search API ----
async function probe(c, f) {
  const r = await call("https://searchapi.api.cloud.yandex.net/v2/web/search", {
    method: "POST", headers: { Authorization: c.auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: { searchType: "SEARCH_TYPE_RU", queryText: "сталь продукт", familyMode: "FAMILY_MODE_MODERATE", page: "0" },
      groupSpec: { groupMode: "GROUP_MODE_DEEP", groupsOnPage: "10", docsInGroup: "1" },
      region: "12", l10n: "LOCALIZATION_RU", responseFormat: "FORMAT_XML", ...(f ? { folderId: f.id } : {}),
    }),
  });
  return { cred: c.label, folder: f ? f.label : "(none)", status: r.status, message: String(r.json?.message || "").slice(0, 160) };
}
const probes = [];
let working = null;
outer: for (const c of creds) {
  for (const f of [...folders, null]) {
    const r = await probe(c, f);
    probes.push(r);
    if (r.status === 200) { working = { c, f }; break outer; }
  }
}

let serp = null;
if (working) {
  const env = { PATH: process.env.PATH };
  if (working.c.auth.startsWith("Api-Key ")) env.YANDEX_SEARCH_API_KEY = working.c.auth.slice(8);
  else env.YANDEX_SEARCH_IAM_TOKEN = working.c.auth.slice(7);
  if (working.f) env.YANDEX_SEARCH_FOLDER_ID = working.f.id;
  try {
    const raw = execFileSync("node", [".search-check/serp.mjs"], { env, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"], timeout: 15 * 60 * 1000 });
    const m = raw.match(/@@SERP_BEGIN@@([\s\S]*)@@SERP_END@@/);
    serp = m ? JSON.parse(m[1]) : { error: "NO_MARKERS" };
  } catch (e) { serp = { error: "SERP_RUN_FAILED", code: e?.status ?? null }; }
}

writeFileSync("/tmp/keys-check.json", JSON.stringify({
  generated_at: new Date().toISOString(), names_checked: names.length, inventory, exchanges, discovery,
  folders: folders.map((f) => f.label), probes,
  working: working ? { cred: working.c.label, folder: working.f ? working.f.label : "(none)" } : null, serp,
}));
console.log(`checked: ${names.length}, present: ${inventory.length}, credentials: ${creds.length}, working: ${Boolean(working)}`);

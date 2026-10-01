// Pass 4: finish the live campaign 714391927. Run: 2026-10-01 12:16 MSK.
//  0) leftover campaigns are deleted: the draft 714957797 and five archived empty "Новая" campaigns
//     (only these ids, only while they are a draft or archived and have no impressions and no clicks;
//     Direct refuses to delete an archived campaign, so it is unarchived first and archived back if the delete fails);
//  N) negative keywords from negatives-spec.json are merged into the campaign and the new groups (nothing removed);
//  1) services sitelink set (the first try was rejected for the "×" sign) attached to every services ad;
//  2) extra ads from extra-spec.json for groups with fewer than three ads, sent to moderation;
//  3) old cassette/basket groups are suspended only for the product whose new groups all have an accepted ad;
//  4) read back.
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
const OLD = { cassettes: /^МК (Москва\/МО|ЦФО|Россия) \| /, baskets: /^Корзины \| Кондиционеры$/ };
const NEW = { cassettes: /^Металлокассеты \| /, baskets: /^Корзины \| (?!Кондиционеры$)/ };

function normToken(raw = "") {
  let v = String(raw).trim().replace(/^OAuth\s+/i, "").replace(/^Bearer\s+/i, "");
  const m = v.match(/(?:^|[#?&])access_token=([^&#\s]+)/i);
  if (m) { try { v = decodeURIComponent(m[1]); } catch { v = m[1]; } }
  return v.trim();
}
const token = normToken(process.env.YD_TOKEN || "");
const login = String(process.env.YD_CLIENT_LOGIN || "").trim();

const FORBIDDEN = new Set(["resume", "unarchive", "archive", "delete"]);
async function api(service, method, params, label) {
  const ids = params?.SelectionCriteria?.Ids || [];
  const draftDelete = service === "campaigns" && ["delete", "unarchive", "archive"].includes(method) && ids.length > 0
    && ids.every((id) => DELETE_IDS.includes(id) && id !== CAMPAIGN_ID);
  if (FORBIDDEN.has(method) && !draftDelete) throw new Error(`method ${method} is not allowed in this script`);
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
  const results = r.AddResults || r.UpdateResults || r.SuspendResults || r.ModerateResults || r.DeleteResults
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

async function main() {
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

  // ---------- 3. stop old groups only where the replacement is live ----------
  ads = await readAds("statuses");
  out.steps.switch = {};
  for (const product of ["cassettes", "baskets"]) {
    const newGroups = groups.filter((g) => NEW[product].test(g.Name));
    const ready = newGroups.length > 0 && newGroups.every((g) => ads.some((a) => a.AdGroupId === g.Id && a.Status === "ACCEPTED"));
    const stop = ads.filter((a) => OLD[product].test(nameOf[a.AdGroupId] || "") && a.State === "ON").map((a) => a.Id);
    out.steps.switch[product] = {
      ready,
      new_groups_waiting: newGroups.filter((g) => !ads.some((a) => a.AdGroupId === g.Id && a.Status === "ACCEPTED")).map((g) => g.Name),
      old_ads_on: stop.length,
    };
    if (ready && stop.length) {
      await api("ads", "suspend", { SelectionCriteria: { Ids: stop } }, `suspend_${product}_${stop.length}`);
      out.steps.switch[product].suspended = stop.length;
    }
  }

  // ---------- 4. read back ----------
  out.after = { groups, ads: await readAds("after") };
}

await main();
writeFileSync("/tmp/report.json", JSON.stringify(out, null, 2));
console.log("ERRORS:", out.errors.length, "REPORT_BYTES:", Buffer.byteLength(JSON.stringify(out)));

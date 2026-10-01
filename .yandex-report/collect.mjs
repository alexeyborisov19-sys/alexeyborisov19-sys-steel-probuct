// Pass 1: rework the LIVE campaign 714391927 around metal cassettes and AC baskets.
// Every change is reversible: the previous state is saved into the encrypted report.
//  1) campaign-level negative keywords are extended (old list kept), extended geo off;
//  2) the 11 groups from campaign-spec.json are added with keywords and ads, ads are sent to moderation;
//  3) autotargeting in every group is narrowed to target queries only;
//  4) ads are suspended in groups outside the focus (other products, services, SPb).
// Old cassette/basket groups keep running until the new ads pass moderation (pass 2 stops them).
import { readFileSync, writeFileSync } from "node:fs";

const CAMPAIGN_ID = 714391927;
const spec = JSON.parse(readFileSync(".yandex-report/campaign-spec.json", "utf8"));
const out = { generated_at: new Date().toISOString(), calls: [], steps: {}, errors: [], before: {} };
const UTM = "utm_source=yandex&utm_medium=cpc&utm_campaign={campaign_id}&utm_content={ad_id}.{gbid}.{source_type}.{device_type}&utm_term={keyword}";

const KEEP_RUNNING = [/^МК Москва\/МО/, /^МК ЦФО/, /^МК Россия/, /^Корзины \| Кондиционеры$/, /^Бренд$/];
const isNewGroup = (name) => spec.Groups.some((g) => g.Name === name);

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
  if (FORBIDDEN.has(method)) throw new Error(`method ${method} is not allowed in this script`);
  const headers = { Authorization: `Bearer ${token}`, "Accept-Language": "ru", "Content-Type": "application/json; charset=utf-8" };
  if (login) headers["Client-Login"] = login;
  let status = 0, body = null;
  try {
    const res = await fetch(`https://api.direct.yandex.com/json/v501/${service}`, {
      method: "POST", headers, body: JSON.stringify({ method, params }), signal: AbortSignal.timeout(60000),
    });
    status = res.status;
    const text = await res.text();
    try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 3000) }; }
  } catch (e) {
    body = { error: { error_string: "NETWORK_ERROR", error_detail: e?.cause?.code || e?.name } };
  }
  const results = body?.result?.AddResults || body?.result?.UpdateResults || body?.result?.SuspendResults || body?.result?.ModerateResults || [];
  const itemErrors = results.filter((r) => r.Errors?.length);
  out.calls.push({ label: `${service}.${method}:${label}`, status, apiError: Boolean(body?.error), itemErrors: itemErrors.length });
  console.log(`${service}.${method}:${label}: HTTP ${status}${body?.error ? " API_ERROR" : ""}${itemErrors.length ? ` ITEM_ERRORS=${itemErrors.length}` : ""}`);
  if (body?.error) out.errors.push({ step: `${service}.${method}:${label}`, error: body.error });
  if (itemErrors.length) out.errors.push({ step: `${service}.${method}:${label}`, itemErrors: itemErrors.slice(0, 20) });
  return body;
}
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function main() {
  if (!token) { out.errors.push({ step: "token", error: "missing" }); return; }

  // ---------- 0. read and save the current state ----------
  const c = await api("campaigns", "get", {
    SelectionCriteria: { Ids: [CAMPAIGN_ID] },
    FieldNames: ["Id", "Name", "State", "Status", "NegativeKeywords"],
    UnifiedCampaignFieldNames: ["Settings", "TrackingParams", "BiddingStrategy"],
  }, "before");
  const campaign = c?.result?.Campaigns?.[0];
  if (!campaign || campaign.Id !== CAMPAIGN_ID || campaign.State === "ARCHIVED") {
    out.errors.push({ step: "guard", error: "campaign not found or archived", campaign });
    return;
  }
  out.before.campaign = campaign;
  const groupsRes = await api("adgroups", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "Name", "RegionIds"] }, "before");
  const oldGroups = groupsRes?.result?.AdGroups || [];
  const kwRes = await api("keywords", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "Keyword", "AdGroupId", "State", "AutotargetingCategories"] }, "before");
  const oldKeywords = kwRes?.result?.Keywords || [];
  const adsRes = await api("ads", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "AdGroupId", "State", "Status"] }, "before");
  const oldAds = adsRes?.result?.Ads || [];
  out.before.groups = oldGroups;
  out.before.autotargeting = oldKeywords.filter((k) => k.Keyword.startsWith("---"));
  out.before.ads = oldAds;

  // ---------- 1. campaign settings ----------
  const oldNeg = campaign.NegativeKeywords?.Items || [];
  const negatives = [...new Set([...oldNeg, ...spec.NegativeKeywords])];
  await api("campaigns", "update", { Campaigns: [{ Id: CAMPAIGN_ID, NegativeKeywords: { Items: negatives } }] }, "negatives");
  await api("campaigns", "update", { Campaigns: [{ Id: CAMPAIGN_ID, UnifiedCampaign: { Settings: [
    { Option: "ENABLE_AREA_OF_INTEREST_TARGETING", Value: "NO" },
  ] } }] }, "geo");
  out.steps.negatives = { before: oldNeg.length, after: negatives.length };

  // ---------- 2. new groups, keywords, ads ----------
  const groupIds = Object.fromEntries(oldGroups.map((g) => [g.Name, g.Id]));
  for (const g of spec.Groups) {
    if (groupIds[g.Name]) continue;
    const r = await api("adgroups", "add", { AdGroups: [{ Name: g.Name, CampaignId: CAMPAIGN_ID, RegionIds: g.RegionIds, NegativeKeywords: { Items: g.Neg } }] }, "group");
    const id = r?.result?.AddResults?.[0]?.Id;
    if (id) groupIds[g.Name] = id;
  }
  const newGids = spec.Groups.map((g) => groupIds[g.Name]).filter(Boolean);
  out.steps.new_groups = Object.fromEntries(spec.Groups.map((g) => [g.Name, groupIds[g.Name] ?? null]));

  const have = new Set(oldKeywords.map((k) => `${k.AdGroupId}|${k.Keyword}`));
  if (newGids.length) {
    const ek = await api("keywords", "get", { SelectionCriteria: { AdGroupIds: newGids }, FieldNames: ["Id", "Keyword", "AdGroupId"] }, "new_existing");
    for (const k of ek?.result?.Keywords || []) have.add(`${k.AdGroupId}|${k.Keyword}`);
  }
  const toAdd = [];
  for (const g of spec.Groups) {
    const gid = groupIds[g.Name];
    if (!gid) continue;
    for (const kw of g.Keywords) if (!have.has(`${gid}|${kw}`)) toAdd.push({ AdGroupId: gid, Keyword: kw });
  }
  let kwAdded = 0;
  for (const part of chunk(toAdd, 500)) {
    const r = await api("keywords", "add", { Keywords: part }, `add_${part.length}`);
    kwAdded += (r?.result?.AddResults || []).filter((x) => x.Id).length;
  }
  out.steps.keywords_added = kwAdded;

  const ea = newGids.length ? await api("ads", "get", { SelectionCriteria: { AdGroupIds: newGids }, FieldNames: ["Id", "AdGroupId", "Status"] }, "new_existing") : null;
  const groupsWithAds = new Set((ea?.result?.Ads || []).map((a) => a.AdGroupId));
  const newAdIds = (ea?.result?.Ads || []).filter((a) => a.Status === "DRAFT").map((a) => a.Id);
  for (const g of spec.Groups) {
    const gid = groupIds[g.Name];
    if (!gid || groupsWithAds.has(gid)) continue;
    for (const a of g.Ads) {
      const kit = spec.KitIds[a.Kit];
      const make = (fix) => {
        const f = (s) => (fix ? s.replaceAll("м²", "м2").replace(/[«»]/g, "\"") : s);
        return { AdGroupId: gid, TextAd: {
          Title: f(a.Title), Title2: f(a.Title2), Text: f(a.Text), Mobile: "NO", DisplayUrlPath: a.DisplayUrlPath,
          Href: `${a.Href}?${UTM}`, SitelinkSetId: kit.sitelinkSetId, AdExtensionIds: kit.calloutIds,
        } };
      };
      let r = await api("ads", "add", { Ads: [make(false)] }, "ad");
      let id = r?.result?.AddResults?.[0]?.Id;
      if (!id) { r = await api("ads", "add", { Ads: [make(true)] }, "ad#ascii"); id = r?.result?.AddResults?.[0]?.Id; }
      if (id) newAdIds.push(id);
    }
  }
  out.steps.new_ads = newAdIds.length;
  for (const part of chunk(newAdIds, 1000)) {
    const m = await api("ads", "moderate", { SelectionCriteria: { Ids: part } }, `moderate_${part.length}`);
    out.steps.moderate = m?.result?.ModerateResults ?? m?.error;
  }

  // ---------- 3. autotargeting: target queries only, in every group ----------
  const at = await api("keywords", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "Keyword", "AdGroupId"] }, "autotargeting");
  const autoIds = (at?.result?.Keywords || []).filter((k) => k.Keyword.startsWith("---")).map((k) => k.Id);
  const cats = [
    { Category: "EXACT", Value: "YES" }, { Category: "ALTERNATIVE", Value: "NO" }, { Category: "COMPETITOR", Value: "NO" },
    { Category: "BROADER", Value: "NO" }, { Category: "ACCESSORY", Value: "NO" },
  ];
  for (const part of chunk(autoIds, 100)) {
    await api("keywords", "update", { Keywords: part.map((id) => ({ Id: id, AutotargetingCategories: cats })) }, `autotargeting_${part.length}`);
  }
  out.steps.autotargeting_narrowed = autoIds.length;

  // ---------- 4. suspend ads outside the focus ----------
  const stopGroupIds = oldGroups.filter((g) => !isNewGroup(g.Name) && !KEEP_RUNNING.some((re) => re.test(g.Name))).map((g) => g.Id);
  const stopAds = oldAds.filter((a) => stopGroupIds.includes(a.AdGroupId) && a.State === "ON").map((a) => a.Id);
  out.steps.stopped_groups = oldGroups.filter((g) => stopGroupIds.includes(g.Id)).map((g) => g.Name);
  for (const part of chunk(stopAds, 1000)) {
    await api("ads", "suspend", { SelectionCriteria: { Ids: part } }, `suspend_${part.length}`);
  }
  out.steps.suspended_ads = stopAds.length;

  // ---------- 5. read back ----------
  const rc = await api("campaigns", "get", { SelectionCriteria: { Ids: [CAMPAIGN_ID] }, FieldNames: ["Id", "State", "Status", "NegativeKeywords"], UnifiedCampaignFieldNames: ["Settings"] }, "after");
  const rg = await api("adgroups", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "Name", "RegionIds", "Status"] }, "after");
  const rk = await api("keywords", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "Keyword", "AdGroupId", "State", "Status", "AutotargetingCategories"] }, "after");
  const ra = await api("ads", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "AdGroupId", "State", "Status", "StatusClarification"], TextAdFieldNames: ["Title", "Href"] }, "after");
  out.after = { campaign: rc?.result?.Campaigns?.[0], groups: rg?.result?.AdGroups, keywords: rk?.result?.Keywords, ads: ra?.result?.Ads };
}

await main();
writeFileSync("/tmp/report.json", JSON.stringify(out, null, 2));
console.log("ERRORS:", out.errors.length, "REPORT_BYTES:", Buffer.byteLength(JSON.stringify(out)));

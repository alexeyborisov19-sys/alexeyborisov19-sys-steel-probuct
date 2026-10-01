// Pass 3: metalworking services in the LIVE campaign 714391927.
// Regions: Smolensk region first (own groups + regional bid adjustment), then Moscow + Moscow region,
// Kaluga region and Bryansk region. Nothing existing is changed or stopped; everything added can be
// suspended later. The previous state of what this pass touches is saved into the encrypted report.
//  1) a services sitelink set and callouts;
//  2) the 9 groups from services-spec.json with keywords and ads, new ads go to moderation;
//  3) autotargeting in the new groups is narrowed to target queries only;
//  4) campaign-level regional bid adjustment for the Smolensk region.
import { readFileSync, writeFileSync } from "node:fs";

const CAMPAIGN_ID = 714391927;
const spec = JSON.parse(readFileSync(".yandex-report/services-spec.json", "utf8"));
const out = { generated_at: new Date().toISOString(), pass: "services", calls: [], steps: {}, errors: [], before: {} };
const UTM = "utm_source=yandex&utm_medium=cpc&utm_campaign={campaign_id}&utm_content={ad_id}.{gbid}.{source_type}.{device_type}&utm_term={keyword}";

function normToken(raw = "") {
  let v = String(raw).trim().replace(/^OAuth\s+/i, "").replace(/^Bearer\s+/i, "");
  const m = v.match(/(?:^|[#?&])access_token=([^&#\s]+)/i);
  if (m) { try { v = decodeURIComponent(m[1]); } catch { v = m[1]; } }
  return v.trim();
}
const token = normToken(process.env.YD_TOKEN || "");
const login = String(process.env.YD_CLIENT_LOGIN || "").trim();

const FORBIDDEN = new Set(["resume", "unarchive", "archive", "delete", "suspend"]);
async function api(service, method, params, label) {
  if (FORBIDDEN.has(method)) throw new Error(`method ${method} is not allowed in this script`);
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
  const results = r.AddResults || r.UpdateResults || r.SetResults || r.ModerateResults || [];
  const itemErrors = results.filter((x) => x.Errors?.length);
  out.calls.push({ label: `${service}.${method}:${label}`, status, apiError: Boolean(body?.error), itemErrors: itemErrors.length });
  console.log(`${service}.${method}:${label}: HTTP ${status}${body?.error ? " API_ERROR" : ""}${itemErrors.length ? ` ITEM_ERRORS=${itemErrors.length}` : ""}`);
  if (body?.error) out.errors.push({ step: `${service}.${method}:${label}`, error: body.error });
  if (itemErrors.length) out.errors.push({ step: `${service}.${method}:${label}`, itemErrors: itemErrors.slice(0, 20) });
  return body;
}
const addIds = (body) => (body?.result?.AddResults || []).map((x) => x.Id ?? x.Ids?.[0] ?? null);
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function main() {
  if (!token) { out.errors.push({ step: "token", error: "missing" }); return; }

  // ---------- 0. guard and current state ----------
  const c = await api("campaigns", "get", { SelectionCriteria: { Ids: [CAMPAIGN_ID] }, FieldNames: ["Id", "Name", "State", "Status"] }, "before");
  const campaign = c?.result?.Campaigns?.[0];
  if (!campaign || campaign.Id !== CAMPAIGN_ID || campaign.State === "ARCHIVED") {
    out.errors.push({ step: "guard", error: "campaign not found or archived", campaign });
    return;
  }
  const groupsRes = await api("adgroups", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "Name", "RegionIds"] }, "before");
  const oldGroups = groupsRes?.result?.AdGroups || [];
  const bm = await api("bidmodifiers", "get", {
    SelectionCriteria: { CampaignIds: [CAMPAIGN_ID], Levels: ["CAMPAIGN"] },
    FieldNames: ["Id", "CampaignId", "Level", "Type"], RegionalAdjustmentFieldNames: ["RegionId", "BidModifier", "Enabled"],
  }, "before");
  out.before = { campaign, groups: oldGroups.map((g) => g.Name), bidmodifiers: bm?.result?.BidModifiers || [] };

  // ---------- 1. services kit: sitelinks + callouts ----------
  const sl = await api("sitelinks", "add", { SitelinksSets: [{ Sitelinks: spec.Kit.Sitelinks }] }, "kit_sv");
  const [sitelinkSetId] = addIds(sl);
  const ex = await api("adextensions", "add", { AdExtensions: spec.Kit.Callouts.map((t) => ({ Callout: { CalloutText: t } })) }, "kit_sv");
  let calloutIds = addIds(ex);
  if (calloutIds.length !== spec.Kit.Callouts.length || calloutIds.some((x) => !x)) {
    // Direct keeps one callout per text: reuse the existing ones instead of failing.
    const list = await api("adextensions", "get", {
      SelectionCriteria: { Types: ["CALLOUT"] }, FieldNames: ["Id", "Type", "State"], CalloutFieldNames: ["CalloutText"],
    }, "kit_sv_existing");
    const byText = Object.fromEntries((list?.result?.AdExtensions || []).map((e) => [e.Callout?.CalloutText, e.Id]));
    calloutIds = spec.Kit.Callouts.map((t, i) => calloutIds[i] || byText[t] || null);
  }
  const kit = { sitelinkSetId: sitelinkSetId ?? null, calloutIds: calloutIds.filter(Boolean) };
  out.steps.kit = kit;

  // ---------- 2. groups, keywords, ads ----------
  const groupIds = Object.fromEntries(oldGroups.map((g) => [g.Name, g.Id]));
  for (const g of spec.Groups) {
    if (groupIds[g.Name]) continue;
    const r = await api("adgroups", "add", { AdGroups: [{ Name: g.Name, CampaignId: CAMPAIGN_ID, RegionIds: g.RegionIds, NegativeKeywords: { Items: g.Neg } }] }, "group");
    const [id] = addIds(r);
    if (id) groupIds[g.Name] = id;
  }
  const newGids = spec.Groups.map((g) => groupIds[g.Name]).filter(Boolean);
  out.steps.groups = Object.fromEntries(spec.Groups.map((g) => [g.Name, groupIds[g.Name] ?? null]));

  const have = new Set();
  if (newGids.length) {
    const ek = await api("keywords", "get", { SelectionCriteria: { AdGroupIds: newGids }, FieldNames: ["Id", "Keyword", "AdGroupId"] }, "existing");
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
    kwAdded += addIds(r).filter(Boolean).length;
  }
  out.steps.keywords_added = kwAdded;

  const ea = newGids.length ? await api("ads", "get", { SelectionCriteria: { AdGroupIds: newGids }, FieldNames: ["Id", "AdGroupId", "Status"] }, "existing") : null;
  const groupsWithAds = new Set((ea?.result?.Ads || []).map((a) => a.AdGroupId));
  const newAdIds = (ea?.result?.Ads || []).filter((a) => a.Status === "DRAFT").map((a) => a.Id);
  for (const g of spec.Groups) {
    const gid = groupIds[g.Name];
    if (!gid || groupsWithAds.has(gid)) continue;
    for (const a of g.Ads) {
      const make = (fix) => {
        const f = (s) => (fix ? s.replaceAll("×", "x").replace(/[«»]/g, "\"") : s);
        const TextAd = {
          Title: f(a.Title), Title2: f(a.Title2), Text: f(a.Text), Mobile: "NO", DisplayUrlPath: a.DisplayUrlPath,
          Href: `${a.Href}?${UTM}`, AdExtensionIds: kit.calloutIds,
        };
        if (kit.sitelinkSetId) TextAd.SitelinkSetId = kit.sitelinkSetId;
        return { AdGroupId: gid, TextAd };
      };
      let r = await api("ads", "add", { Ads: [make(false)] }, "ad");
      let [id] = addIds(r);
      if (!id) { r = await api("ads", "add", { Ads: [make(true)] }, "ad#ascii"); [id] = addIds(r); }
      if (id) newAdIds.push(id);
    }
  }
  out.steps.new_ads = newAdIds.length;
  for (const part of chunk(newAdIds, 1000)) {
    const m = await api("ads", "moderate", { SelectionCriteria: { Ids: part } }, `moderate_${part.length}`);
    out.steps.moderate = m?.result?.ModerateResults ?? m?.error;
  }

  // ---------- 3. autotargeting in the new groups: target queries only ----------
  if (newGids.length) {
    const at = await api("keywords", "get", { SelectionCriteria: { AdGroupIds: newGids }, FieldNames: ["Id", "Keyword", "AdGroupId"] }, "autotargeting");
    const autoIds = (at?.result?.Keywords || []).filter((k) => k.Keyword.startsWith("---")).map((k) => k.Id);
    const cats = [
      { Category: "EXACT", Value: "YES" }, { Category: "ALTERNATIVE", Value: "NO" }, { Category: "COMPETITOR", Value: "NO" },
      { Category: "BROADER", Value: "NO" }, { Category: "ACCESSORY", Value: "NO" },
    ];
    for (const part of chunk(autoIds, 100)) {
      await api("keywords", "update", { Keywords: part.map((id) => ({ Id: id, AutotargetingCategories: cats })) }, `autotargeting_${part.length}`);
    }
    out.steps.autotargeting_narrowed = autoIds.length;
  }

  // ---------- 4. Smolensk region first: regional bid adjustment ----------
  const existing = (bm?.result?.BidModifiers || []).find((b) => b.RegionalAdjustment?.RegionId === spec.SmolenskRegionId);
  if (existing) {
    if (existing.RegionalAdjustment.BidModifier !== spec.SmolenskBidModifier) {
      await api("bidmodifiers", "set", { BidModifiers: [{ Id: existing.Id, BidModifier: spec.SmolenskBidModifier }] }, "smolensk");
    }
    out.steps.smolensk_bid = { existing: existing.RegionalAdjustment, target: spec.SmolenskBidModifier };
  } else {
    const r = await api("bidmodifiers", "add", { BidModifiers: [{ CampaignId: CAMPAIGN_ID, RegionalAdjustments: [{ RegionId: spec.SmolenskRegionId, BidModifier: spec.SmolenskBidModifier }] }] }, "smolensk");
    out.steps.smolensk_bid = r?.result?.AddResults ?? r?.error;
  }

  // ---------- 5. read back ----------
  const rg = await api("adgroups", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "Name", "RegionIds", "Status"] }, "after");
  const rk = newGids.length ? await api("keywords", "get", { SelectionCriteria: { AdGroupIds: newGids }, FieldNames: ["Id", "Keyword", "AdGroupId", "State", "Status", "AutotargetingCategories"] }, "after") : null;
  const ra = await api("ads", "get", { SelectionCriteria: { CampaignIds: [CAMPAIGN_ID] }, FieldNames: ["Id", "AdGroupId", "State", "Status", "StatusClarification"], TextAdFieldNames: ["Title", "Text", "Href", "SitelinkSetId", "AdExtensions"] }, "after");
  const rb = await api("bidmodifiers", "get", {
    SelectionCriteria: { CampaignIds: [CAMPAIGN_ID], Levels: ["CAMPAIGN"] },
    FieldNames: ["Id", "CampaignId", "Level", "Type"], RegionalAdjustmentFieldNames: ["RegionId", "BidModifier", "Enabled"],
  }, "after");
  out.after = { groups: rg?.result?.AdGroups, keywords: rk?.result?.Keywords, ads: ra?.result?.Ads, bidmodifiers: rb?.result?.BidModifiers };
}

await main();
writeFileSync("/tmp/report.json", JSON.stringify(out, null, 2));
console.log("ERRORS:", out.errors.length, "REPORT_BYTES:", Buffer.byteLength(JSON.stringify(out)));

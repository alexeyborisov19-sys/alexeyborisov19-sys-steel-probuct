// Creates ONE new Yandex Direct campaign as a DRAFT from .yandex-report/campaign-spec.json.
// It never sends anything to moderation and never starts or changes other campaigns.
// Idempotent: an existing non-archived campaign with the same name is reused, existing groups,
// keywords and ads are kept. The full result goes to /tmp/report.json (encrypted by the workflow);
// the public log gets step labels and HTTP codes only.
import { readFileSync, writeFileSync } from "node:fs";

const spec = JSON.parse(readFileSync(".yandex-report/campaign-spec.json", "utf8"));
const out = { generated_at: new Date().toISOString(), calls: [], steps: {}, errors: [] };

function normToken(raw = "") {
  let v = String(raw).trim().replace(/^OAuth\s+/i, "").replace(/^Bearer\s+/i, "");
  const m = v.match(/(?:^|[#?&])access_token=([^&#\s]+)/i);
  if (m) { try { v = decodeURIComponent(m[1]); } catch { v = m[1]; } }
  return v.trim();
}
const token = normToken(process.env.YD_TOKEN || "");
const login = String(process.env.YD_CLIENT_LOGIN || "").trim();

const FORBIDDEN = new Set(["moderate", "resume", "unarchive", "archive", "delete"]);
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
  const itemErrors = (body?.result?.AddResults || body?.result?.UpdateResults || body?.result?.SuspendResults || [])
    .filter((r) => r.Errors?.length).length;
  out.calls.push({ label: `${service}.${method}:${label}`, status, apiError: Boolean(body?.error), itemErrors });
  console.log(`${service}.${method}:${label}: HTTP ${status}${body?.error ? " API_ERROR" : ""}${itemErrors ? ` ITEM_ERRORS=${itemErrors}` : ""}`);
  if (body?.error) out.errors.push({ step: `${service}.${method}:${label}`, error: body.error, params });
  return body;
}
function addIds(body, step) {
  return (body?.result?.AddResults || []).map((r, i) => {
    if (r.Errors?.length) out.errors.push({ step, index: i, errors: r.Errors, warnings: r.Warnings });
    return r.Id ?? null;
  });
}

if (!token) { out.errors.push({ step: "token", error: "YANDEX_DIRECT_OAUTH_TOKEN missing" }); }
else {
  // ---------- 1. campaign ----------
  const all = await api("campaigns", "get", { SelectionCriteria: {}, FieldNames: ["Id", "Name", "State", "Status"] }, "find");
  let campaign = (all?.result?.Campaigns || []).find((c) => c.Name === spec.Name && c.State !== "ARCHIVED");
  let campaignId = campaign?.Id ?? null;
  out.steps.campaign_reused = Boolean(campaignId);

  if (!campaignId) {
    const strategy = { Search: { BiddingStrategyType: "WB_MAXIMUM_CLICKS", WbMaximumClicks: { WeeklySpendLimit: spec.WeeklySpendLimitMicros, BudgetType: "WEEKLY_BUDGET" } }, Network: { BiddingStrategyType: "SERVING_OFF" } };
    const settings = [
      { Option: "ADD_METRICA_TAG", Value: "YES" },
      { Option: "ENABLE_AREA_OF_INTEREST_TARGETING", Value: "NO" },
      { Option: "ALTERNATIVE_TEXTS_ENABLED", Value: "NO" },
      { Option: "AUTO_ASSETS_ENABLED", Value: "NO" },
      { Option: "ENABLE_SITE_MONITORING", Value: "YES" },
      { Option: "ENABLE_COMPANY_INFO", Value: "YES" },
    ];
    const base = { Name: spec.Name, StartDate: spec.StartDate, TimeZone: spec.TimeZone, NegativeKeywords: { Items: spec.NegativeKeywords }, TimeTargeting: spec.TimeTargeting };
    const unified = { BiddingStrategy: strategy, Settings: settings, CounterIds: { Items: [spec.CounterId] }, TrackingParams: spec.TrackingParams };
    const variants = [
      { ...base, UnifiedCampaign: unified },
      { ...base, UnifiedCampaign: { ...unified, BiddingStrategy: { ...strategy, Search: { BiddingStrategyType: "WB_MAXIMUM_CLICKS", WbMaximumClicks: { WeeklySpendLimit: spec.WeeklySpendLimitMicros } } } } },
      { ...base, UnifiedCampaign: { ...unified, Settings: settings.filter((s) => ["ADD_METRICA_TAG", "ENABLE_AREA_OF_INTEREST_TARGETING"].includes(s.Option)) } },
    ];
    for (const [i, v] of variants.entries()) {
      const r = await api("campaigns", "add", { Campaigns: [v] }, `create#${i}`);
      const [id] = addIds(r, `campaigns.add#${i}`);
      if (id) { campaignId = id; out.steps.campaign_variant = i; break; }
    }
  }
  out.steps.campaign_id = campaignId;

  if (campaignId) {
    // ---------- 2. sitelinks and callouts per kit ----------
    // Settings Direct may ignore on create: switch off extended geo targeting explicitly.
    await api("campaigns", "update", { Campaigns: [{ Id: campaignId, UnifiedCampaign: { Settings: [
      { Option: "ENABLE_AREA_OF_INTEREST_TARGETING", Value: "NO" },
      { Option: "ALTERNATIVE_TEXTS_ENABLED", Value: "NO" },
      { Option: "AUTO_ASSETS_ENABLED", Value: "NO" },
    ] } }] }, "settings");

    const kits = {};
    for (const [name, kit] of Object.entries(spec.Kits)) {
      if (spec.KitIds?.[name]) { kits[name] = spec.KitIds[name]; continue; }
      const sl = await api("sitelinks", "add", { SitelinksSets: [{ Sitelinks: kit.Sitelinks }] }, `kit_${name}`);
      const [sitelinkSetId] = addIds(sl, `sitelinks.add:${name}`);
      const ex = await api("adextensions", "add", { AdExtensions: kit.Callouts.map((t) => ({ Callout: { CalloutText: t } })) }, `kit_${name}`);
      let calloutIds = addIds(ex, `adextensions.add:${name}`);
      if (calloutIds.some((x) => !x)) {
        // Direct keeps one callout per text: reuse the existing ones instead of failing.
        const list = await api("adextensions", "get", {
          SelectionCriteria: { Types: ["CALLOUT"] }, FieldNames: ["Id", "Type", "State"], CalloutFieldNames: ["CalloutText"],
        }, `kit_${name}_existing`);
        const byText = Object.fromEntries((list?.result?.AdExtensions || []).map((e) => [e.Callout?.CalloutText, e.Id]));
        calloutIds = kit.Callouts.map((t, i) => calloutIds[i] || byText[t] || null);
      }
      kits[name] = { sitelinkSetId, calloutIds: calloutIds.filter(Boolean) };
    }
    out.steps.kits = kits;

    // ---------- 3. groups ----------
    const existingGroups = await api("adgroups", "get", { SelectionCriteria: { CampaignIds: [campaignId] }, FieldNames: ["Id", "Name"] }, "existing");
    const groupIds = Object.fromEntries((existingGroups?.result?.AdGroups || []).map((g) => [g.Name, g.Id]));
    for (const g of spec.Groups) {
      if (groupIds[g.Name]) continue;
      const item = { Name: g.Name, CampaignId: campaignId, RegionIds: g.RegionIds, NegativeKeywords: { Items: g.Neg } };
      let r = await api("adgroups", "add", { AdGroups: [{ ...item, UnifiedAdGroup: {} }] }, "group");
      let [id] = addIds(r, `adgroups.add:${g.Name}`);
      if (!id) {
        r = await api("adgroups", "add", { AdGroups: [item] }, "group#plain");
        [id] = addIds(r, `adgroups.add#plain:${g.Name}`);
      }
      if (id) groupIds[g.Name] = id;
    }
    out.steps.group_ids = groupIds;
    const gids = spec.Groups.map((g) => groupIds[g.Name]).filter(Boolean);

    // ---------- 4. keywords ----------
    if (gids.length) {
      const ek = await api("keywords", "get", { SelectionCriteria: { AdGroupIds: gids }, FieldNames: ["Id", "Keyword", "AdGroupId", "State"] }, "existing");
      const have = new Set((ek?.result?.Keywords || []).map((k) => `${k.AdGroupId}|${k.Keyword}`));
      const toAdd = [];
      for (const g of spec.Groups) {
        const gid = groupIds[g.Name];
        if (!gid) continue;
        for (const kw of g.Keywords) if (!have.has(`${gid}|${kw}`)) toAdd.push({ AdGroupId: gid, Keyword: kw });
      }
      if (toAdd.length) {
        const r = await api("keywords", "add", { Keywords: toAdd }, `add_${toAdd.length}`);
        out.steps.keywords_added = addIds(r, "keywords.add").filter(Boolean).length;
      }

      // ---------- 5. autotargeting off ----------
      const kk = await api("keywords", "get", { SelectionCriteria: { AdGroupIds: gids }, FieldNames: ["Id", "Keyword", "AdGroupId", "State", "Status"] }, "after_add");
      const auto = (kk?.result?.Keywords || []).filter((k) => k.Keyword.startsWith("---autotargeting"));
      out.steps.autotargeting_found = auto.length;
      const autoOn = auto.filter((k) => k.State !== "SUSPENDED").map((k) => k.Id);
      if (autoOn.length) {
        const s = await api("keywords", "suspend", { SelectionCriteria: { Ids: autoOn } }, "autotargeting");
        const failed = (s?.result?.SuspendResults || []).filter((x) => x.Errors?.length);
        out.steps.autotargeting_suspend_errors = failed;
        if (s?.error || failed.length) {
          const upd = await api("keywords", "update", {
            Keywords: autoOn.map((id) => ({ Id: id, AutotargetingCategories: [
              { Category: "EXACT", Value: "YES" }, { Category: "ALTERNATIVE", Value: "NO" }, { Category: "COMPETITOR", Value: "NO" },
              { Category: "BROADER", Value: "NO" }, { Category: "ACCESSORY", Value: "NO" }] })),
          }, "autotargeting_exact_only");
          out.steps.autotargeting_update = upd?.result ?? upd?.error;
        }
      }

      // ---------- 6. ads ----------
      const ea = await api("ads", "get", { SelectionCriteria: { AdGroupIds: gids }, FieldNames: ["Id", "AdGroupId"] }, "existing");
      const groupsWithAds = new Set((ea?.result?.Ads || []).map((a) => a.AdGroupId));
      const added = [];
      for (const g of spec.Groups) {
        const gid = groupIds[g.Name];
        if (!gid || groupsWithAds.has(gid)) continue;
        for (const a of g.Ads) {
          const kit = kits[a.Kit] || {};
          const make = (fix) => {
            const f = (s) => (fix ? s.replaceAll("м²", "м2").replace(/[«»]/g, "\"") : s);
            const t = { Title: f(a.Title), Title2: f(a.Title2), Text: f(a.Text), Href: a.Href, Mobile: "NO", DisplayUrlPath: a.DisplayUrlPath };
            if (kit.sitelinkSetId) t.SitelinkSetId = kit.sitelinkSetId;
            if (kit.calloutIds?.length) t.AdExtensionIds = kit.calloutIds;
            return { AdGroupId: gid, TextAd: t };
          };
          let r = await api("ads", "add", { Ads: [make(false)] }, "ad");
          let [id] = addIds(r, `ads.add:${g.Name}:${a.Title}`);
          if (!id) { r = await api("ads", "add", { Ads: [make(true)] }, "ad#ascii"); [id] = addIds(r, `ads.add#ascii:${g.Name}:${a.Title}`); }
          if (id) added.push(id);
        }
      }
      out.steps.ads_added = added.length;
    }

    // ---------- 7. read back ----------
    const c = await api("campaigns", "get", {
      SelectionCriteria: { Ids: [campaignId] },
      FieldNames: ["Id", "Name", "StartDate", "Status", "State", "StatusClarification", "NegativeKeywords", "TimeTargeting"],
      UnifiedCampaignFieldNames: ["CounterIds", "TrackingParams", "Settings", "BiddingStrategy"],
    }, "readback");
    out.readback = { campaign: c?.result?.Campaigns?.[0] ?? c?.error };
    const g = await api("adgroups", "get", { SelectionCriteria: { CampaignIds: [campaignId] }, FieldNames: ["Id", "Name", "RegionIds", "NegativeKeywords", "Status", "Type"] }, "readback");
    out.readback.groups = g?.result?.AdGroups ?? g?.error;
    const k = await api("keywords", "get", { SelectionCriteria: { CampaignIds: [campaignId] }, FieldNames: ["Id", "Keyword", "AdGroupId", "State", "Status"] }, "readback");
    out.readback.keywords = k?.result?.Keywords ?? k?.error;
    const at = await api("keywords", "get", { SelectionCriteria: { CampaignIds: [campaignId] }, FieldNames: ["Id", "Keyword", "AdGroupId", "State", "AutotargetingCategories"] }, "readback_autotargeting");
    out.readback.autotargeting = (at?.result?.Keywords || []).filter((x) => x.Keyword.startsWith("---")).map((x) => ({ AdGroupId: x.AdGroupId, State: x.State, AutotargetingCategories: x.AutotargetingCategories })) || at?.error;
    const a = await api("ads", "get", {
      SelectionCriteria: { CampaignIds: [campaignId] },
      FieldNames: ["Id", "AdGroupId", "Status", "State", "StatusClarification", "Type"],
      TextAdFieldNames: ["Title", "Title2", "Text", "Href", "DisplayUrlPath", "SitelinkSetId", "AdExtensions"],
    }, "readback");
    out.readback.ads = a?.result?.Ads ?? a?.error;
  }
}

writeFileSync("/tmp/report.json", JSON.stringify(out, null, 2));
console.log("ERRORS:", out.errors.length, "REPORT_BYTES:", Buffer.byteLength(JSON.stringify(out)));

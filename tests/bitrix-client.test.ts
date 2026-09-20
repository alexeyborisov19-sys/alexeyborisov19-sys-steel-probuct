import assert from "node:assert/strict";
import test from "node:test";
import {
  findDuplicateLeadId,
  loadBitrixConfig,
  upsertBitrixLead,
  type BitrixCaller,
  type BitrixConfig,
} from "../lib/server/crm/bitrix-client";

/** Same shape the other env-driven tests in this suite use: a real ProcessEnv, not a bare literal. */
function env(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...overrides };
}

test("Bitrix integration is off (null config) when no webhook is configured — never a thrown error", () => {
  assert.equal(loadBitrixConfig(env()), null);
});

test("the config loader parses the webhook and internal field map from real environment values", () => {
  const config = loadBitrixConfig(env({
    BITRIX_WEBHOOK_URL: "https://example.bitrix24.ru/rest/1/abc123/",
    BITRIX_INTERNAL_FIELD_MAP_JSON: JSON.stringify({ costRubBatch: "UF_CRM_1700000001", calculatorUsed: "UF_CRM_1700000002" }),
    BITRIX_SOURCE_ID: "WEBFORM",
  }));
  assert.ok(config);
  assert.equal(config!.webhookUrl, "https://example.bitrix24.ru/rest/1/abc123"); // trailing slash trimmed
  assert.equal(config!.internalFieldMap.costRubBatch, "UF_CRM_1700000001");
  assert.equal(config!.sourceId, "WEBFORM");
});

test("a malformed field map does not crash configuration — it falls back to an empty map", () => {
  const config = loadBitrixConfig(env({ BITRIX_WEBHOOK_URL: "https://example.bitrix24.ru/rest/1/abc123", BITRIX_INTERNAL_FIELD_MAP_JSON: "{not json" }));
  assert.ok(config);
  assert.deepEqual(config!.internalFieldMap, {});
});

const baseConfig: BitrixConfig = {
  webhookUrl: "https://example.bitrix24.ru/rest/1/abc123",
  internalFieldMap: { costRubBatch: "UF_CRM_1700000001", calculatorUsed: "UF_CRM_1700000002" },
  sourceId: "WEB",
};

function recordingCaller(responses: Record<string, unknown> = {}) {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  const caller: BitrixCaller = async (method, params) => {
    calls.push({ method, params });
    return responses[method];
  };
  return { caller, calls };
}

test("findDuplicateLeadId checks phone, then email, and stops at the first match", async () => {
  const { caller, calls } = recordingCaller({ "crm.duplicate.findbycomm": { LEAD: [42] } });
  const id = await findDuplicateLeadId(baseConfig, { phone: "+79991234567", email: "a@b.ru" }, caller);
  assert.equal(id, 42);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.type, "PHONE");
});

test("findDuplicateLeadId falls back to email when the phone search finds nothing", async () => {
  let call = 0;
  const caller: BitrixCaller = async (method, params) => {
    call += 1;
    if (params.type === "PHONE") return { LEAD: [] };
    return { LEAD: [77] };
  };
  const id = await findDuplicateLeadId(baseConfig, { phone: "+79991234567", email: "a@b.ru" }, caller);
  assert.equal(id, 77);
  assert.equal(call, 2);
});

test("findDuplicateLeadId returns null when nothing matches, rather than throwing", async () => {
  const { caller } = recordingCaller({ "crm.duplicate.findbycomm": { LEAD: [] } });
  const id = await findDuplicateLeadId(baseConfig, { phone: "+79991234567" }, caller);
  assert.equal(id, null);
});

test("upsertBitrixLead creates a new lead when no duplicate is found, never updating one that doesn't exist", async () => {
  const { caller, calls } = recordingCaller({
    "crm.duplicate.findbycomm": { LEAD: [] },
    "crm.lead.add": 123,
  });
  const result = await upsertBitrixLead(
    baseConfig,
    { title: "Кронштейн 500x400, 100 шт", phone: "+79991234567", opportunity: 68_000 },
    { costRubBatch: 45000, calculatorUsed: "metal-parts" },
    { phone: "+79991234567" },
    caller,
  );
  assert.equal(result.created, true);
  assert.equal(result.leadId, 123);
  const addCall = calls.find((call) => call.method === "crm.lead.add");
  assert.ok(addCall);
  const fields = addCall!.params.fields as Record<string, unknown>;
  assert.equal(fields.TITLE, "Кронштейн 500x400, 100 шт");
  assert.equal(fields.OPPORTUNITY, 68_000);
  assert.equal(fields.CURRENCY_ID, "RUB");
  assert.equal(fields.UF_CRM_1700000001, 45000);
  assert.equal(fields.UF_CRM_1700000002, "metal-parts");
  assert.equal(calls.some((call) => call.method === "crm.lead.update"), false);
});

test("upsertBitrixLead updates the existing lead when a duplicate is found, never creating a second one", async () => {
  const { caller, calls } = recordingCaller({
    "crm.duplicate.findbycomm": { LEAD: [999] },
    "crm.lead.update": true,
  });
  const result = await upsertBitrixLead(
    baseConfig,
    { title: "Повторная заявка", phone: "+79991234567" },
    {},
    { phone: "+79991234567" },
    caller,
  );
  assert.equal(result.created, false);
  assert.equal(result.leadId, 999);
  assert.equal(calls.some((call) => call.method === "crm.lead.add"), false);
  const updateCall = calls.find((call) => call.method === "crm.lead.update");
  assert.ok(updateCall);
  assert.equal(updateCall!.params.id, 999);
});

test("an internal field with no configured mapping is silently omitted, never sent under a guessed code", async () => {
  const { caller, calls } = recordingCaller({ "crm.duplicate.findbycomm": { LEAD: [] }, "crm.lead.add": 1 });
  await upsertBitrixLead(
    baseConfig,
    { title: "T" },
    { marketMedianRubPerM2: 3200 }, // not present in baseConfig.internalFieldMap
    {},
    caller,
  );
  const fields = calls.find((call) => call.method === "crm.lead.add")!.params.fields as Record<string, unknown>;
  assert.equal(Object.keys(fields).some((key) => key.includes("3200") || fields[key] === 3200), false);
});

test("no supplier rate, cost line or coefficient is ever sent — only the one approved price and mapped internal figures", async () => {
  const { caller, calls } = recordingCaller({ "crm.duplicate.findbycomm": { LEAD: [] }, "crm.lead.add": 1 });
  await upsertBitrixLead(
    baseConfig,
    { title: "T", opportunity: 68_000 },
    { costRubBatch: 45000 },
    {},
    caller,
  );
  const fields = calls.find((call) => call.method === "crm.lead.add")!.params.fields as Record<string, unknown>;
  const numericValues = Object.values(fields).filter((value) => typeof value === "number");
  assert.deepEqual(numericValues.sort(), [45000, 68000]); // only the mapped cost and the approved price
});

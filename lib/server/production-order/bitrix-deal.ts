import type { ProductionOrder } from "@/lib/production-order/domain";

export type ProductionOrderBitrixConfig = {
  webhookUrl: string;
  categoryId: number;
  stageId: string;
  sourceId: string;
  customFieldMap: Record<string, string>;
};

export type ProductionOrderBitrixCaller = (
  method: "crm.deal.list" | "crm.deal.add" | "crm.deal.update",
  params: Record<string, unknown>,
) => Promise<unknown>;

function parsePositiveInteger(value: string | undefined) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseFieldMap(raw: string | undefined) {
  if (!raw?.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0),
    );
  } catch {
    return {};
  }
}

function validatedWebhook(raw: string | undefined) {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.port
      || url.search
      || url.hash
      || !/^[a-z0-9][a-z0-9-]*\.bitrix24\.ru$/i.test(url.hostname)
      || !/^\/rest\/\d+\/[a-z0-9_-]+\/?$/i.test(url.pathname)
    ) return null;
    return url.href.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function loadProductionOrderBitrixConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ProductionOrderBitrixConfig | null {
  if (environment.BITRIX_ORDER_INTEGRATION_ENABLED !== "true") return null;
  const webhookUrl = validatedWebhook(environment.BITRIX_WEBHOOK_URL);
  const categoryId = parsePositiveInteger(environment.BITRIX_ORDER_CATEGORY_ID);
  const stageId = environment.BITRIX_ORDER_STAGE_ID?.trim();
  if (!webhookUrl || categoryId == null || !stageId) return null;

  return {
    webhookUrl,
    categoryId,
    stageId,
    sourceId: environment.BITRIX_SOURCE_ID?.trim() || "WEB",
    customFieldMap: parseFieldMap(environment.BITRIX_ORDER_FIELD_MAP_JSON),
  };
}

function clean(value: string, max: number) {
  return value.replace(/[<>\[\]\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function defaultCaller(webhookUrl: string): ProductionOrderBitrixCaller {
  return async (method, params) => {
    const response = await fetch(`${webhookUrl}/${method}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      redirect: "error",
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => null) as { result?: unknown; error?: unknown; error_description?: unknown } | null;
    if (!response.ok || !payload || payload.error != null) {
      throw new Error(`Bitrix24 ${method} failed`);
    }
    return payload.result;
  };
}

function customFields(
  order: ProductionOrder,
  folderPath: string,
  config: ProductionOrderBitrixConfig,
) {
  const values: Record<string, string | number | null> = {
    quoteNumber: order.quoteNumber,
    quoteTitle: order.quoteTitle,
    orderFolder: folderPath,
    dueDate: order.dueDate,
    projectId: order.projectId,
    partsCount: order.parts.length,
  };
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    const code = config.customFieldMap[key];
    if (code && value != null) fields[code] = value;
  }
  return fields;
}

async function findExistingDealId(
  order: ProductionOrder,
  caller: ProductionOrderBitrixCaller,
) {
  const result = await caller("crm.deal.list", {
    filter: {
      "=ORIGINATOR_ID": "steelprodukt-production-order",
      "=ORIGIN_ID": order.orderId,
    },
    select: ["ID"],
    start: 0,
  });
  if (!Array.isArray(result)) throw new Error("Invalid Bitrix24 deal list response");
  if (result.length > 1) throw new Error("Ambiguous Bitrix24 production order identity");
  if (result.length === 0) return null;
  const id = Number((result[0] as { ID?: unknown }).ID);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid Bitrix24 deal id");
  return id;
}

function dealFields(
  order: ProductionOrder,
  folderPath: string,
  config: ProductionOrderBitrixConfig,
) {
  const fields: Record<string, unknown> = {
    TITLE: clean(`${order.quoteNumber} | ${order.quoteTitle}`, 255),
    CATEGORY_ID: config.categoryId,
    STAGE_ID: config.stageId,
    SOURCE_ID: config.sourceId,
    ORIGINATOR_ID: "steelprodukt-production-order",
    ORIGIN_ID: order.orderId,
    OPENED: "N",
    COMMENTS: clean(
      [
        `Заказчик: ${order.customerName}`,
        `Позиций: ${order.parts.length}`,
        order.dueDate ? `Срок готовности: ${order.dueDate}` : null,
        `Папка заказа: ${folderPath}`,
      ].filter(Boolean).join("\n"),
      5000,
    ),
    ...customFields(order, folderPath, config),
  };

  if (order.commercial.totalRub != null && order.commercial.totalRub > 0) {
    fields.OPPORTUNITY = order.commercial.totalRub;
    fields.CURRENCY_ID = order.commercial.currency;
    fields.IS_MANUAL_OPPORTUNITY = "Y";
  }
  return fields;
}

export async function upsertProductionOrderDeal(
  config: ProductionOrderBitrixConfig,
  order: ProductionOrder,
  folderPath: string,
  caller: ProductionOrderBitrixCaller = defaultCaller(config.webhookUrl),
): Promise<{ dealId: number; created: boolean }> {
  const fields = dealFields(order, folderPath, config);
  const existingId = await findExistingDealId(order, caller);

  if (existingId != null) {
    await caller("crm.deal.update", { id: existingId, fields });
    return { dealId: existingId, created: false };
  }

  const createdId = Number(await caller("crm.deal.add", {
    fields,
    params: { REGISTER_SONET_EVENT: "Y" },
  }));
  if (!Number.isSafeInteger(createdId) || createdId <= 0) throw new Error("Bitrix24 did not confirm deal creation");
  return { dealId: createdId, created: true };
}

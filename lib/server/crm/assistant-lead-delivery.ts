import { CALCULATION_DISCLAIMER_SHORT } from "@/lib/instant-quote/client-labels";
import type { SessionQuoteSnapshot } from "@/lib/server/quote-engine/quote-snapshot";

export type AssistantCrmLead = {
  requestId: string; name: string; phone: string | null; email: string | null;
  company: string | null; summary: string; quoteSnapshot: SessionQuoteSnapshot | null;
  consent: { personalData: boolean };
};
export type AssistantCrmDelivery = {
  status: "not-configured" | "not-approved" | "delivered" | "needs-retry";
  checkedAt: string;
  leadId?: number;
};
export type AssistantCrmCaller = (method: "crm.lead.list" | "crm.lead.add", data: Record<string, unknown>) => Promise<unknown>;

/** No automatic transfer to foreign/custom portals or arbitrary webhook hosts. */
export function assistantCrmWebhook(environment: Readonly<Record<string, string | undefined>>): string | null {
  const raw = environment.BITRIX_WEBHOOK_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash
      || !/^[a-z0-9][a-z0-9-]*\.bitrix24\.ru$/i.test(url.hostname)
      || !/^\/rest\/\d+\/[a-z0-9_-]+\/?$/i.test(url.pathname)) return null;
    return url.href.replace(/\/+$/, "");
  } catch { return null; }
}
function makeCaller(webhook: string): AssistantCrmCaller {
  return async (method, data) => {
    const response = await fetch(`${webhook}/${method}.json`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", redirect: "error",
      body: JSON.stringify(data), signal: AbortSignal.timeout(6000),
    });
    if (!response.ok || !response.body) throw new Error("CRM unavailable");
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 65_536) { await reader.cancel(); throw new Error("CRM response too large"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { result?: unknown; error?: unknown };
    if (!parsed || parsed.error != null) throw new Error("CRM rejected request");
    return parsed.result;
  };
}
function clean(value: string, limit: number): string {
  // CRM comments can interpret markup. Keep user fields as text rather than links or instructions.
  return value.replace(/[<>\[\]\u0000-\u001f]/g, " ").slice(0, limit);
}

/** Called after private storage + consent audit + file checks. Never forwards internal rates or uploaded files. */
export async function deliverAssistantLeadToCrm(
  lead: AssistantCrmLead,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  caller?: AssistantCrmCaller,
): Promise<AssistantCrmDelivery> {
  const checkedAt = new Date().toISOString();
  if (!lead.consent.personalData || environment.BITRIX_DATA_TRANSFER_APPROVED !== "true") return { status: "not-approved", checkedAt };
  const webhook = assistantCrmWebhook(environment);
  if (environment.BITRIX_INTEGRATION_ENABLED !== "true" || !webhook) return { status: "not-configured", checkedAt };
  if (!/^SP-AI-\d{8}-[A-F0-9]{8}$/.test(lead.requestId)) return { status: "needs-retry", checkedAt };
  const call = caller ?? makeCaller(webhook);
  try {
    // One site request is one CRM lead. Never overwrite another order just because the phone matches.
    const existing = await call("crm.lead.list", {
      filter: { "=ORIGINATOR_ID": "steelprodukt-assistant", "=ORIGIN_ID": lead.requestId },
      select: ["ID"], start: 0,
    });
    if (!Array.isArray(existing)) throw new Error("Invalid CRM response");
    if (existing.length > 1) throw new Error("Ambiguous CRM identity");
    if (existing.length === 1) {
      const id = Number(existing[0]?.ID);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid CRM identifier");
      return { status: "delivered", checkedAt, leadId: id };
    }
    const fields: Record<string, unknown> = {
      TITLE: `Запрос расчёта ${lead.requestId}`, NAME: clean(lead.name, 120),
      SOURCE_ID: "WEB", ORIGINATOR_ID: "steelprodukt-assistant", ORIGIN_ID: lead.requestId, OPENED: "N",
      COMMENTS: `${clean(lead.summary, 5000)}\n${CALCULATION_DISCLAIMER_SHORT}`,
    };
    if (lead.phone) fields.PHONE = [{ VALUE: clean(lead.phone, 80), VALUE_TYPE: "WORK" }];
    if (lead.email) fields.EMAIL = [{ VALUE: clean(lead.email, 160), VALUE_TYPE: "WORK" }];
    if (lead.company) fields.COMPANY_TITLE = clean(lead.company, 160);
    const quote = lead.quoteSnapshot;
    if (quote?.status === "priced" && quote.record) {
      const price = quote.record.finalPriceRubBatch;
      if (Number.isFinite(price) && price > 0) {
        fields.OPPORTUNITY = price; fields.CURRENCY_ID = "RUB"; fields.IS_MANUAL_OPPORTUNITY = "Y";
      }
      fields.COMMENTS = `${fields.COMMENTS}\n${clean(quote.clientMessage, 3000)}`;
    }
    const id = Number(await call("crm.lead.add", { fields, params: { REGISTER_SONET_EVENT: "Y" } }));
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error("CRM did not confirm creation");
    return { status: "delivered", checkedAt, leadId: id };
  } catch {
    // A timeout could mean a successful remote write. A later retry rechecks ORIGIN_ID first.
    return { status: "needs-retry", checkedAt };
  }
}

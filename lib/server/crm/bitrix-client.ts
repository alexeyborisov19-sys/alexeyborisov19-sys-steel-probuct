// No `import "server-only"` here: it is not a dependency of this project — only
// the Next build aliases it — so it breaks every test importing this module.

/**
 * §24: a generic Bitrix24 REST client over an incoming webhook, using only
 * the platform's own documented methods (crm.lead.add / crm.lead.update /
 * crm.duplicate.findbycomm) — nothing here is Steel Product-specific except
 * the field values passed in. Custom internal figures (cost, market stats,
 * which calculator ran, a calculation id) go into portal-specific UF_CRM_*
 * fields, and those codes are configured per-portal, never guessed: every
 * Bitrix24 account names its own custom fields differently, so inventing a
 * code here would silently write into the wrong field or none at all.
 */

export type BitrixLeadFields = {
  title: string;
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  sourceId?: string;
  /** The customer's own original request, or a summary of it. */
  comments?: string;
  /** The one client-safe commercial price — never a rate, a cost, or a coefficient. */
  opportunity?: number;
  currencyId?: string;
};

export type BitrixInternalFields = Record<string, string | number | boolean | null>;

export type BitrixConfig = {
  webhookUrl: string;
  internalFieldMap: Record<string, string>;
  sourceId: string;
};

/** Bitrix integration is simply off when unconfigured — never a thrown error that would block lead capture. */
export function loadBitrixConfig(environment: NodeJS.ProcessEnv = process.env): BitrixConfig | null {
  const webhookUrl = environment.BITRIX_WEBHOOK_URL?.trim();
  if (!webhookUrl) return null;

  let internalFieldMap: Record<string, string> = {};
  const rawMap = environment.BITRIX_INTERNAL_FIELD_MAP_JSON?.trim();
  if (rawMap) {
    try {
      const parsed: unknown = JSON.parse(rawMap);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        internalFieldMap = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        );
      }
    } catch {
      // A malformed map must not crash lead capture — standard fields still go through, internal ones are omitted.
    }
  }

  return { webhookUrl: webhookUrl.replace(/\/+$/, ""), internalFieldMap, sourceId: environment.BITRIX_SOURCE_ID?.trim() || "WEB" };
}

export type BitrixCaller = (method: string, params: Record<string, unknown>) => Promise<unknown>;

function defaultCaller(webhookUrl: string): BitrixCaller {
  return async (method, params) => {
    const response = await fetch(`${webhookUrl}/${method}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => null) as { result?: unknown; error?: string; error_description?: string } | null;
    if (!response.ok || payload?.error) {
      throw new Error(`Bitrix24 ${method} failed: ${payload?.error_description ?? payload?.error ?? response.statusText}`);
    }
    return payload?.result;
  };
}

function toBitrixFields(lead: BitrixLeadFields, internal: BitrixInternalFields, config: BitrixConfig): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    TITLE: lead.title,
    SOURCE_ID: lead.sourceId ?? config.sourceId,
  };
  if (lead.name) fields.NAME = lead.name;
  if (lead.phone) fields.PHONE = [{ VALUE: lead.phone, VALUE_TYPE: "WORK" }];
  if (lead.email) fields.EMAIL = [{ VALUE: lead.email, VALUE_TYPE: "WORK" }];
  if (lead.company) fields.COMPANY_TITLE = lead.company;
  if (lead.comments) fields.COMMENTS = lead.comments;
  if (lead.opportunity != null) {
    fields.OPPORTUNITY = lead.opportunity;
    fields.CURRENCY_ID = lead.currencyId ?? "RUB";
  }

  // Only a key the portal owner has explicitly mapped is ever written, and
  // only under the exact code they configured — an unmapped key is silently
  // dropped rather than sent under a guessed name.
  for (const [key, value] of Object.entries(internal)) {
    const code = config.internalFieldMap[key];
    if (code && value != null) fields[code] = value;
  }

  return fields;
}

/** crm.duplicate.findbycomm — checks phone first, then email, so a single business is one lead, not two (§24: "не допускать дублей"). */
export async function findDuplicateLeadId(
  config: BitrixConfig,
  contact: { phone?: string; email?: string },
  caller: BitrixCaller = defaultCaller(config.webhookUrl),
): Promise<number | null> {
  const attempts: Array<{ type: "PHONE" | "EMAIL"; value: string }> = [];
  if (contact.phone) attempts.push({ type: "PHONE", value: contact.phone });
  if (contact.email) attempts.push({ type: "EMAIL", value: contact.email });

  for (const attempt of attempts) {
    const result = await caller("crm.duplicate.findbycomm", {
      type: attempt.type,
      values: [attempt.value],
      entity_type: "LEAD",
    }) as { LEAD?: number[] } | undefined;
    const found = result?.LEAD?.[0];
    if (found != null) return found;
  }
  return null;
}

/** Updates the existing lead when a duplicate is found, otherwise creates one — never both. */
export async function upsertBitrixLead(
  config: BitrixConfig,
  lead: BitrixLeadFields,
  internal: BitrixInternalFields,
  contact: { phone?: string; email?: string },
  caller: BitrixCaller = defaultCaller(config.webhookUrl),
): Promise<{ leadId: number; created: boolean }> {
  const fields = toBitrixFields(lead, internal, config);
  const existingId = await findDuplicateLeadId(config, contact, caller);

  if (existingId != null) {
    await caller("crm.lead.update", { id: existingId, fields });
    return { leadId: existingId, created: false };
  }

  const newId = await caller("crm.lead.add", { fields, params: { REGISTER_SONET_EVENT: "Y" } }) as number;
  return { leadId: newId, created: true };
}

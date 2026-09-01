import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { legalDocumentDisplayDates, legalDocumentVersions, legalLinks, legalOperator } from "@/lib/legal";
import { siteConfig } from "@/lib/site";

/**
 * Supervisory journal assembled only for a concrete official request.
 *
 * The module reads private storage directly but deliberately exports only
 * aggregated, non-identifying information. Server paths, filesystem modes,
 * feature flags, antivirus configuration and other implementation details are
 * never included in the generated regulator-facing payload.
 */

export type StorageSurvey = {
  label: string;
  path: string;
  present: boolean;
  mode: string | null;
  files: number;
  oldest: string | null;
  newest: string | null;
  unreadable: number;
};

export type ConsentSummary = {
  total: number;
  byEvent: Record<string, number>;
  byPersonalDataVersion: Record<string, number>;
  byPrivacyVersion: Record<string, number>;
  withMarketing: number;
  retentionDays: number[];
  earliest: string | null;
  latest: string | null;
  malformed: number;
};

export type LeadSummary = {
  total: number;
  bySource: Record<string, number>;
  byConsentAudit: Record<string, number>;
  byDelivery: Record<string, number>;
  withAttachments: number;
  attachments: number;
  retentionDays: number[];
  pastRetention: number;
  earliest: string | null;
  latest: string | null;
  malformed: number;
};

export type JournalInput = {
  generatedAt: string;
  requestNumber: string | null;
  requestDate: string | null;
  authority: string | null;
  preparedBy: string | null;
  storage: StorageSurvey[];
  consents: ConsentSummary;
  leads: LeadSummary;
};

function assertPrivateTarget(path: string) {
  const publicRoot = resolve(process.cwd(), "public");
  const fromPublic = relative(publicRoot, path);
  if (fromPublic === "" || (!fromPublic.startsWith(`..${sep}`) && fromPublic !== "..")) {
    throw new Error("Journal must not be written inside public/");
  }
}

function requireText(value: string | null, label: string) {
  const cleaned = value?.trim();
  if (!cleaned) throw new Error(`Не указан обязательный реквизит: ${label}`);
  return cleaned;
}

function assertRequestMetadata(input: JournalInput) {
  const authority = requireText(input.authority, "орган, направивший запрос");
  const requestNumber = requireText(input.requestNumber, "номер запроса");
  const requestDate = requireText(input.requestDate, "дата запроса");
  const preparedBy = requireText(input.preparedBy, "ФИО подготовившего выгрузку");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestDate) || Number.isNaN(Date.parse(`${requestDate}T00:00:00Z`))) {
    throw new Error("Дата запроса должна быть указана в формате YYYY-MM-DD");
  }
  return { authority, requestNumber, requestDate, preparedBy };
}

function bump(counter: Record<string, number>, key: string) {
  counter[key] = (counter[key] || 0) + 1;
}

function span(current: { earliest: string | null; latest: string | null }, value: unknown) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return;
  if (!current.earliest || value < current.earliest) current.earliest = value;
  if (!current.latest || value > current.latest) current.latest = value;
}

async function jsonFiles(root: string) {
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name);
}

export async function surveyStorage(label: string, path: string): Promise<StorageSurvey> {
  const survey: StorageSurvey = {
    label, path, present: false, mode: null, files: 0, oldest: null, newest: null, unreadable: 0,
  };
  let directory;
  try {
    directory = await stat(path);
  } catch {
    return survey;
  }
  survey.present = directory.isDirectory();
  survey.mode = (directory.mode & 0o777).toString(8).padStart(3, "0");
  if (!survey.present) return survey;

  let names: string[];
  try {
    names = await jsonFiles(path);
  } catch {
    survey.unreadable = 1;
    return survey;
  }
  survey.files = names.length;
  for (const name of names) {
    try {
      const info = await stat(resolve(path, name));
      const at = info.mtime.toISOString();
      if (!survey.oldest || at < survey.oldest) survey.oldest = at;
      if (!survey.newest || at > survey.newest) survey.newest = at;
    } catch {
      survey.unreadable += 1;
    }
  }
  return survey;
}

export async function summariseConsents(path: string): Promise<ConsentSummary> {
  const summary: ConsentSummary = {
    total: 0, byEvent: {}, byPersonalDataVersion: {}, byPrivacyVersion: {},
    withMarketing: 0, retentionDays: [], earliest: null, latest: null, malformed: 0,
  };
  let names: string[];
  try {
    names = await jsonFiles(path);
  } catch {
    return summary;
  }
  const retention = new Set<number>();
  for (const name of names) {
    let record: Record<string, unknown>;
    try {
      record = JSON.parse(await readFile(resolve(path, name), "utf8")) as Record<string, unknown>;
    } catch {
      summary.malformed += 1;
      continue;
    }
    summary.total += 1;
    bump(summary.byEvent, String(record.event || "unknown"));
    bump(summary.byPersonalDataVersion, String(record.personalDataConsentVersion || "unknown"));
    bump(summary.byPrivacyVersion, String(record.privacyVersion || "unknown"));
    if (record.marketing === true) summary.withMarketing += 1;
    if (Number.isInteger(record.retentionDays)) retention.add(Number(record.retentionDays));
    span(summary, record.createdAt);
  }
  summary.retentionDays = [...retention].sort((a, b) => a - b);
  return summary;
}

export async function summariseLeads(path: string, now = new Date()): Promise<LeadSummary> {
  const summary: LeadSummary = {
    total: 0, bySource: {}, byConsentAudit: {}, byDelivery: {}, withAttachments: 0,
    attachments: 0, retentionDays: [], pastRetention: 0, earliest: null, latest: null, malformed: 0,
  };
  let names: string[];
  try {
    names = await jsonFiles(path);
  } catch {
    return summary;
  }
  const retention = new Set<number>();
  for (const name of names) {
    let record: Record<string, unknown>;
    try {
      record = JSON.parse(await readFile(resolve(path, name), "utf8")) as Record<string, unknown>;
    } catch {
      summary.malformed += 1;
      continue;
    }
    // Only non-identifying fields are read. Name, phone, e-mail, company,
    // message and attachment contents are never touched.
    summary.total += 1;
    bump(summary.bySource, String(record.source || "unknown"));
    bump(summary.byConsentAudit, String(record.consentAudit || "unknown"));
    bump(summary.byDelivery, String(record.delivery || "unknown"));
    const files = Array.isArray(record.files) ? record.files.length : 0;
    if (files > 0) summary.withAttachments += 1;
    summary.attachments += files;
    const days = Number(record.retentionDays);
    if (Number.isInteger(days) && days > 0) {
      retention.add(days);
      const createdAt = Date.parse(String(record.createdAt || ""));
      if (Number.isFinite(createdAt) && now.getTime() - createdAt > days * 86_400_000) {
        summary.pastRetention += 1;
      }
    }
    span(summary, record.createdAt);
  }
  summary.retentionDays = [...retention].sort((a, b) => a - b);
  return summary;
}

export function buildJournal(input: JournalInput) {
  const request = assertRequestMetadata(input);
  const publicStorage = input.storage.map(({ label, present, files, oldest, newest, unreadable }) => ({
    label, present, files, oldest, newest, unreadable,
  }));

  const payload = {
    document: "Журнал сведений об обработке персональных данных",
    generated_at: input.generatedAt,
    request: {
      authority: request.authority,
      number: request.requestNumber,
      date: request.requestDate,
      prepared_by: request.preparedBy,
    },
    operator: {
      name: legalOperator.name,
      short_name: legalOperator.shortName,
      inn: legalOperator.inn,
      kpp: legalOperator.kpp,
      ogrn: legalOperator.ogrn,
      director: legalOperator.director,
      legal_address: legalOperator.legalAddress,
      postal_address: legalOperator.postalAddress,
      production_address: legalOperator.productionAddress,
      contact_for_subjects: legalOperator.privacyEmail,
      site: siteConfig.url,
    },
    published_documents: (Object.keys(legalDocumentVersions) as Array<keyof typeof legalDocumentVersions>)
      .map((key) => ({
        key,
        version: legalDocumentVersions[key],
        displayed_date: legalDocumentDisplayDates[key as keyof typeof legalDocumentDisplayDates] ?? null,
        url: `${siteConfig.url}${legalLinks[key as keyof typeof legalLinks] ?? ""}`,
      })),
    storage_summary: publicStorage,
    consent_evidence: input.consents,
    requests_register: input.leads,
    notice: "Журнал содержит только агрегированные сведения и не содержит персональных данных субъектов. "
      + "Доказательства согласия учитываются без раскрытия идентификаторов субъектов. Сведения о конкретном "
      + "субъекте формируются отдельно и только в объёме, необходимом для исполнения законного запроса. "
      + "Перед передачей документ проверяется уполномоченным сотрудником и направляется только по официальному каналу.",
  };
  const canonical = JSON.stringify(payload, null, 2);
  return { payload, canonical, sha256: createHash("sha256").update(canonical).digest("hex") };
}

export { assertPrivateTarget };

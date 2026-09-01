import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertPrivateTarget, buildJournal, summariseConsents, summariseLeads, surveyStorage,
} from "@/lib/legal/regulator-journal";

/**
 * Assembles a regulator-facing journal only for a concrete official request.
 *
 * Example:
 *   npm run pd:journal -- --authority "Роскомнадзор" --request-number 12-345 \
 *     --request-date 2026-09-01 --prepared-by "Фамилия И.О."
 *
 * The result contains aggregated information only. Internal server paths,
 * permissions, feature flags and security-tool configuration are intentionally
 * omitted from both Markdown and JSON exports.
 */

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function requiredArgument(name: string, label: string) {
  const value = argument(name)?.trim();
  if (!value) throw new Error(`Не указан обязательный параметр --${name} (${label})`);
  return value;
}

const paths = {
  "Обращения (форма расчёта)": process.env.QUOTE_STORAGE_PATH || ".data/quote-leads",
  "Обращения (инженерный помощник)": process.env.ASSISTANT_LEAD_STORAGE_PATH || ".data/assistant-leads",
  "Доказательства согласия": process.env.CONSENT_AUDIT_STORAGE_PATH || ".data/consent-audit",
  "Карантин вложений": process.env.UPLOAD_QUARANTINE_PATH || ".data/quarantine",
};

function heading(title: string) {
  return `\n## ${title}\n`;
}

function cell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ").trim();
}

function table(rows: Array<[string, string]>) {
  return ["| Показатель | Значение |", "|---|---|", ...rows.map(([k, v]) => `| ${cell(k)} | ${cell(v)} |`)].join("\n");
}

function counts(record: Record<string, number>) {
  const entries = Object.entries(record).sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join("; ") : "нет записей";
}

function markdown(journal: ReturnType<typeof buildJournal>) {
  const { payload, sha256 } = journal;
  const parts: string[] = [`# ${payload.document}`, ""];
  parts.push(table([
    ["Сформирован", payload.generated_at],
    ["Орган", payload.request.authority],
    ["Номер запроса", payload.request.number],
    ["Дата запроса", payload.request.date],
    ["Подготовил", payload.request.prepared_by],
  ]));

  parts.push(heading("1. Оператор"));
  parts.push(table([
    ["Наименование", payload.operator.name],
    ["ИНН", payload.operator.inn],
    ["КПП", payload.operator.kpp],
    ["ОГРН", payload.operator.ogrn],
    ["Руководитель", payload.operator.director],
    ["Юридический адрес", payload.operator.legal_address],
    ["Почтовый адрес", payload.operator.postal_address],
    ["Адрес производства", payload.operator.production_address],
    ["Контакт для субъектов", payload.operator.contact_for_subjects],
    ["Сайт", payload.operator.site],
  ]));

  parts.push(heading("2. Опубликованные документы"));
  parts.push(["| Документ | Редакция | Дата в тексте | Адрес |", "|---|---|---|---|",
    ...payload.published_documents.map((d) => `| ${cell(d.key)} | ${cell(d.version)} | ${cell(d.displayed_date ?? "—")} | ${cell(d.url)} |`),
  ].join("\n"));

  parts.push(heading("3. Сводка по хранилищам"));
  parts.push(["| Назначение | Доступно | Файлов | Старейший | Новейший | Ошибок чтения |", "|---|---|---|---|---|---|",
    ...payload.storage_summary.map((s) => `| ${cell(s.label)} | ${s.present ? "да" : "нет"} | ${s.files} | ${s.oldest ?? "—"} | ${s.newest ?? "—"} | ${s.unreadable} |`),
  ].join("\n"));

  const c = payload.consent_evidence;
  parts.push(heading("4. Журнал доказательств согласия"));
  parts.push(table([
    ["Всего записей", String(c.total)],
    ["По событию", counts(c.byEvent)],
    ["По редакции согласия", counts(c.byPersonalDataVersion)],
    ["По редакции политики", counts(c.byPrivacyVersion)],
    ["С рекламным согласием", String(c.withMarketing)],
    ["Срок хранения, дней", c.retentionDays.join(", ") || "—"],
    ["Период", `${c.earliest ?? "—"} — ${c.latest ?? "—"}`],
    ["Нечитаемых", String(c.malformed)],
  ]));

  const l = payload.requests_register;
  parts.push(heading("5. Реестр обращений"));
  parts.push(table([
    ["Всего записей", String(l.total)],
    ["По источнику", counts(l.bySource)],
    ["По фиксации согласия", counts(l.byConsentAudit)],
    ["По доставке", counts(l.byDelivery)],
    ["С вложениями", `${l.withAttachments} (файлов: ${l.attachments})`],
    ["Срок хранения, дней", l.retentionDays.join(", ") || "—"],
    ["Просрочено сверх срока", String(l.pastRetention)],
    ["Период", `${l.earliest ?? "—"} — ${l.latest ?? "—"}`],
    ["Нечитаемых", String(l.malformed)],
  ]));

  parts.push(heading("6. Оговорка"));
  parts.push(payload.notice);
  parts.push(heading("7. Целостность"));
  parts.push(table([["SHA-256 машиночитаемой части", sha256]]));
  return `${parts.join("\n")}\n`;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const authority = requiredArgument("authority", "орган, направивший запрос");
  const requestNumber = requiredArgument("request-number", "номер запроса");
  const requestDate = requiredArgument("request-date", "дата запроса YYYY-MM-DD");
  const preparedBy = requiredArgument("prepared-by", "ФИО подготовившего");

  const outputDirectory = resolve(argument("out") || process.env.PD_JOURNAL_PATH || ".data/regulator-journals");
  assertPrivateTarget(outputDirectory);

  const storage = [];
  for (const [label, path] of Object.entries(paths)) storage.push(await surveyStorage(label, resolve(path)));

  const journal = buildJournal({
    generatedAt,
    authority,
    requestNumber,
    requestDate,
    preparedBy,
    storage,
    consents: await summariseConsents(resolve(paths["Доказательства согласия"])),
    leads: await summariseLeads(resolve(paths["Обращения (форма расчёта)"])),
  });

  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  const stamp = generatedAt.replace(/[:.]/g, "-");
  const jsonPath = resolve(outputDirectory, `regulator-journal-${stamp}.json`);
  const markdownPath = resolve(outputDirectory, `regulator-journal-${stamp}.md`);
  await writeFile(jsonPath, `${journal.canonical}\n`, { encoding: "utf8", mode: 0o600 });
  await writeFile(markdownPath, markdown(journal), { encoding: "utf8", mode: 0o600 });

  console.info(`Журнал сформирован.\n  ${markdownPath}\n  ${jsonPath}\n  SHA-256: ${journal.sha256}`);
}

main().catch((error) => {
  console.error(`Журнал не сформирован: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  process.exitCode = 1;
});

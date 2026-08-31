import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertPrivateTarget, buildJournal, summariseConsents, summariseLeads, surveyStorage,
} from "@/lib/legal/regulator-journal";

/**
 * Assembles the supervisory journal on demand. Run it on the server:
 *
 *   npm run pd:journal -- --authority "Роскомнадзор" --request-number 12-345 \
 *     --request-date 2026-09-01 --prepared-by "Фамилия И.О."
 *
 * Nothing is exposed over HTTP: the personal-data interface stays closed and
 * this reads the storage directories directly. The journal carries no personal
 * data, so it can be attached to a reply without becoming a disclosure itself.
 */

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
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

function table(rows: Array<[string, string]>) {
  return ["| Показатель | Значение |", "|---|---|", ...rows.map(([k, v]) => `| ${k} | ${v} |`)].join("\n");
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
    ["Орган", payload.request.authority || "не указан"],
    ["Номер запроса", payload.request.number || "не указан"],
    ["Дата запроса", payload.request.date || "не указана"],
    ["Подготовил", payload.request.prepared_by || "не указан"],
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
    ...payload.published_documents.map((d) => `| ${d.key} | ${d.version} | ${d.displayed_date ?? "—"} | ${d.url} |`),
  ].join("\n"));

  parts.push(heading("3. Места хранения"));
  parts.push(["| Назначение | Путь | Есть | Права | Файлов | Старейший | Новейший |", "|---|---|---|---|---|---|---|",
    ...payload.storage.map((s) => `| ${s.label} | \`${s.path}\` | ${s.present ? "да" : "нет"} | ${s.mode ?? "—"} | ${s.files} | ${s.oldest ?? "—"} | ${s.newest ?? "—"} |`),
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

  parts.push(heading("6. Параметры обработки"));
  parts.push(table(Object.entries(payload.environment).map(([k, v]) => [k, v] as [string, string])));

  parts.push(heading("7. Оговорка"));
  parts.push(payload.notice);
  parts.push(heading("8. Целостность"));
  parts.push(table([["SHA-256 машиночитаемой части", sha256]]));
  return `${parts.join("\n")}\n`;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const outputDirectory = resolve(argument("out") || process.env.PD_JOURNAL_PATH || ".data/regulator-journals");
  assertPrivateTarget(outputDirectory);

  const storage = [];
  for (const [label, path] of Object.entries(paths)) storage.push(await surveyStorage(label, resolve(path)));

  const journal = buildJournal({
    generatedAt,
    authority: argument("authority"),
    requestNumber: argument("request-number"),
    requestDate: argument("request-date"),
    preparedBy: argument("prepared-by"),
    storage,
    consents: await summariseConsents(resolve(paths["Доказательства согласия"])),
    leads: await summariseLeads(resolve(paths["Обращения (форма расчёта)"])),
    environment: {
      "Срок хранения обращения, дней": process.env.LEAD_RETENTION_DAYS || "90 (по умолчанию)",
      "Срок хранения доказательств согласия, дней": process.env.CONSENT_AUDIT_RETENTION_DAYS || "1095 (по умолчанию)",
      "Внутренний интерфейс персональных данных": process.env.PD_ADMIN_ENABLED === "true" ? "включён" : "выключен (404)",
      "Антивирусная проверка вложений": process.env.CLAMAV_ENABLED === "true" ? "включена" : "выключена",
      "Аналитика загружается": "только после отдельного согласия на аналитику",
    },
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

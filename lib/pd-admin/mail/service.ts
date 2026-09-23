import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { assertPdPermission } from "@/lib/pd-admin/auth/permissions";
import { recordAccessEvent } from "@/lib/pd-admin/audit/chain";
import {
  listRecentMail,
  readMailMessage,
  readMailThread,
  searchMailHeaders,
  type MailMessage,
} from "@/lib/mail/read-only";

function audit(
  context: PdAuthContext,
  input: {
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, string | number | boolean | null>;
  },
) {
  if (!context.config.auditChainKey) throw new Error("Audit configuration unavailable");
  recordAccessEvent(context.database, {
    userId: context.user.id,
    sessionId: context.session.id,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    legalBasis: "BUSINESS_CORRESPONDENCE_PROCESSING",
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: input.metadata ?? {},
  }, context.config.auditChainKey);
}

function compact(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function firstSenderName(message: MailMessage) {
  const from = compact(message.from || "");
  const name = from.match(/^"?([^"<]+?)"?\s*</)?.[1]?.trim();
  return name && !name.includes("@") ? name : "";
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function analyzeMailLocally(message: MailMessage) {
  const source = (message.subject + "\n" + message.text).toLocaleLowerCase("ru");
  const category = hasAny(source, [/стоимост/, /цен[ауеы]/, /рассчит/, /кп\b/, /коммерческ.*предлож/])
    ? "Запрос расчёта / коммерческого предложения"
    : hasAny(source, [/сч[её]т/, /оплат/, /договор/, /реквизит/])
      ? "Финансово-договорной вопрос"
      : hasAny(source, [/черт[её]ж/, /dxf/, /dwg/, /step/, /stp/, /технич/, /ткп/, /тз\b/])
        ? "Техническая документация"
        : "Деловая переписка";

  const signals = [
    hasAny(source, [/срочн/, /как можно быстрее/, /сегодня/, /завтра/]) ? "В тексте есть признак срочности." : null,
    message.attachments.length ? "Вложений: " + message.attachments.length + "." : "Вложений нет.",
    hasAny(source, [/материал/, /сталь/, /оцинк/, /нержав/, /алюмин/]) ? "Материал упоминается." : "Материал явно не найден.",
    hasAny(source, [/толщин/, /\b\d+[.,]\d+\s*мм\b/, /\b\d+\s*мм\b/]) ? "Толщина/размеры упоминаются." : "Толщина явно не найдена.",
    hasAny(source, [/количеств/, /\b\d+\s*(шт|штук|комплект)/]) ? "Количество упоминается." : "Количество явно не найдено.",
  ].filter((item): item is string => Boolean(item));

  const sender = firstSenderName(message);
  const greeting = sender ? "Здравствуйте, " + sender + "!" : "Здравствуйте!";
  const attachmentLine = message.attachments.length
    ? "Вложения получили и передадим на техническую проверку."
    : "Если есть чертежи, спецификация или иные исходные данные, пожалуйста, приложите их к ответу.";
  const draft = [
    greeting,
    "",
    "Спасибо за обращение в «Сталь Продукт» по теме «" + compact(message.subject || "без темы").slice(0, 180) + "».",
    attachmentLine,
    "Проверим исходные данные и подготовим предметный ответ. Если для расчёта будет не хватать материала, толщины, количества или чертежей, уточним это отдельным сообщением.",
    "",
    "С уважением,",
    "Сталь Продукт",
  ].join("\n");

  return {
    category,
    signals,
    draft,
    note: "Локальный черновик не отправляется и не сохраняется в почтовом ящике.",
  };
}

export async function listMailbox(
  context: PdAuthContext,
  input: { query?: string; unseen?: boolean; limit?: number } = {},
) {
  assertPdPermission(context.user.role, "VIEW_FULL_LEAD");
  const query = input.query?.trim().slice(0, 300) || "";
  const result = query
    ? await searchMailHeaders(query, { limit: input.limit ?? 30, scanLimit: 250 })
    : await listRecentMail({ limit: input.limit ?? 30, unseen: input.unseen });
  audit(context, {
    action: query ? "MAIL_SEARCH" : "MAIL_LIST_VIEWED",
    targetType: "MAILBOX",
    metadata: {
      count: result.messages.length,
      query: Boolean(query),
      unseenOnly: Boolean(input.unseen),
    },
  });
  return result;
}

export async function getMailboxMessage(context: PdAuthContext, uid: string) {
  assertPdPermission(context.user.role, "VIEW_FULL_LEAD");
  const [{ message }, thread] = await Promise.all([
    readMailMessage(uid),
    readMailThread(uid, { limit: 30, scanLimit: 300 }),
  ]);
  audit(context, {
    action: "MAIL_MESSAGE_VIEWED",
    targetType: "MAIL_MESSAGE",
    targetId: uid,
    metadata: {
      threadCount: thread.messages.length,
      attachmentCount: message.attachments.length,
      bytes: message.size ?? 0,
    },
  });
  return {
    message,
    thread: thread.messages,
    analysis: analyzeMailLocally(message),
  };
}

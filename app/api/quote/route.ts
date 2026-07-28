import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { legalDocumentVersions } from "@/lib/legal";

export const runtime = "nodejs";

const MAX_FILES = 10;
// Conservative limits keep requests reliable across the future approved mail provider.
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_FILE_BYTES = 7 * 1024 * 1024;
const allowedExtensions = new Set([
  "pdf", "dxf", "dwg", "dwt", "dws", "step", "stp", "iges", "igs",
  "sldprt", "sldasm", "ipt", "iam", "idw", "png", "jpg", "jpeg", "webp",
  "tif", "tiff", "doc", "docx", "xls", "xlsx", "zip", "rar", "7z",
]);

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim().replace(/[\r\n]+/g, " ");
}

function extensionOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function smtpConfiguration() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? "465");
  return {
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: { user, pass },
  };
}

function sha256(valueToHash: string) {
  return createHash("sha256").update(valueToHash).digest("hex");
}

async function appendConsentAudit(record: Record<string, unknown>) {
  const configuredPath = process.env.CONSENT_LOG_PATH;
  const auditPath = resolve(configuredPath || ".data/consent-audit.jsonl");
  if (auditPath.includes("/public/")) {
    throw new Error("Consent audit path must not be inside the public directory.");
  }
  await mkdir(dirname(auditPath), { recursive: true, mode: 0o700 });
  await appendFile(auditPath, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
}

export async function POST(request: Request) {
  const configuration = smtpConfiguration();
  if (!configuration) {
    return NextResponse.json({ message: "Почтовый сервер ещё не подключён. Пожалуйста, отправьте файлы на info@steelprodukt.ru." }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const name = value(formData, "name");
    const phone = value(formData, "phone");
    const email = value(formData, "email");
    const company = value(formData, "company");
    const message = value(formData, "message");
    const pageUrl = value(formData, "pageUrl");
    const referrer = value(formData, "referrer");
    const personalDataConsent = value(formData, "personalDataConsent");
    const marketingConsent = value(formData, "marketingConsent");
    const consentTimestamp = value(formData, "consentTimestamp");
    const personalDataConsentVersion = value(formData, "personalDataConsentVersion");
    const privacyVersion = value(formData, "privacyVersion");
    const marketingConsentVersion = value(formData, "marketingConsentVersion");
    const website = value(formData, "website");
    const attribution = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "yclid", "gclid"]
      .map((key) => [key, value(formData, key)] as const)
      .filter(([, attributionValue]) => attributionValue);

    // Invisible bot trap: respond successfully without delivering spam.
    if (website) return NextResponse.json({ ok: true });

    if (!name || !phone) {
      return NextResponse.json({ message: "Укажите имя и телефон для связи." }, { status: 400 });
    }
    if (personalDataConsent !== "yes") {
      return NextResponse.json({ message: "Для отправки заявки требуется согласие на обработку персональных данных." }, { status: 400 });
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ message: "Проверьте адрес электронной почты." }, { status: 400 });
    }

    const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    if (files.length > MAX_FILES) {
      return NextResponse.json({ message: `Можно прикрепить не более ${MAX_FILES} файлов.` }, { status: 400 });
    }
    if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) {
      return NextResponse.json({ message: "Общий размер вложений не должен превышать 10 МБ." }, { status: 400 });
    }
    if (files.some((file) => file.size > MAX_FILE_BYTES)) {
      return NextResponse.json({ message: "Размер каждого вложения не должен превышать 7 МБ." }, { status: 400 });
    }
    if (files.some((file) => !allowedExtensions.has(extensionOf(file.name)))) {
      return NextResponse.json({ message: "Один или несколько файлов имеют неподдерживаемый формат." }, { status: 400 });
    }

    const requestId = randomUUID();
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const contactHash = sha256(`${phone.replace(/\D/g, "")}|${email.toLowerCase()}`);
    const consentAudit = {
      event: "quote_request_consent",
      requestId,
      recordedAt: new Date().toISOString(),
      clientTimestamp: consentTimestamp || null,
      pageUrl: pageUrl || null,
      referrer: referrer || null,
      personalDataConsent: true,
      personalDataConsentVersion: personalDataConsentVersion || legalDocumentVersions.personalDataConsent,
      privacyVersion: privacyVersion || legalDocumentVersions.privacy,
      marketingConsent: marketingConsent === "yes",
      marketingConsentVersion: marketingConsent === "yes"
        ? marketingConsentVersion || legalDocumentVersions.marketingConsent
        : null,
      contactHash,
      ipHash: forwardedFor ? sha256(forwardedFor) : null,
      userAgent: request.headers.get("user-agent") ?? null,
    };

    try {
      await appendConsentAudit(consentAudit);
    } catch (auditError) {
      console.error("Consent audit write failed", auditError);
      if (process.env.NODE_ENV === "production" || process.env.CONSENT_LOG_REQUIRED === "true") {
        return NextResponse.json({
          message: "Не удалось зафиксировать согласие. Пожалуйста, повторите отправку или напишите на info@steelprodukt.ru.",
        }, { status: 503 });
      }
    }

    const recipient = process.env.QUOTE_RECIPIENT ?? "info@steelprodukt.ru";
    // Never fall back to a technical SMTP login as the visible sender: it breaks
    // SPF/DKIM alignment and is frequently rejected by Mail.ru. The verified
    // company mailbox is used until an explicit replacement is configured.
    const from = process.env.SMTP_FROM ?? "info@steelprodukt.ru";
    // Mail.ru requires the visible sender, SMTP envelope sender and DKIM domain
    // to align. Keep the envelope configurable while defaulting to the sender.
    const envelopeFrom = process.env.SMTP_ENVELOPE_FROM ?? from;
    const transporter = nodemailer.createTransport(configuration);
    const attachments = await Promise.all(files.map(async (file) => ({
      filename: file.name.replace(/[\r\n]/g, "_"),
      content: Buffer.from(await file.arrayBuffer()),
    })));

    await transporter.sendMail({
      from: `Сталь Продукт <${from}>`,
      to: recipient,
      envelope: {
        from: envelopeFrom,
        to: recipient,
      },
      replyTo: email || undefined,
      subject: `Заявка на расчёт${company ? ` — ${company}` : ""}`,
      text: [
        "Новая заявка с сайта «Сталь Продукт».",
        `ID заявки: ${requestId}`,
        `Имя: ${name}`,
        `Телефон: ${phone}`,
        `E-mail: ${email || "не указан"}`,
        `Компания: ${company || "не указана"}`,
        `Задача: ${message || "не описана"}`,
        `Вложений: ${files.length}`,
        `Страница заявки: ${pageUrl || "не определена"}`,
        `Источник перехода: ${referrer || "прямой переход"}`,
        `Согласие на обработку персональных данных: получено (${consentTimestamp || "время не передано"}; редакция ${personalDataConsentVersion || legalDocumentVersions.personalDataConsent})`,
        `Политика обработки данных: редакция ${privacyVersion || legalDocumentVersions.privacy}`,
        `Согласие на рекламные сообщения: ${marketingConsent === "yes" ? `получено; редакция ${marketingConsentVersion || legalDocumentVersions.marketingConsent}` : "не получено"}`,
        `User-Agent: ${request.headers.get("user-agent") ?? "не определён"}`,
        ...(attribution.length ? ["Метки кампании:", ...attribution.map(([key, attributionValue]) => `${key}: ${attributionValue}`)] : []),
      ].join("\n"),
      attachments,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const diagnostic = error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          code: "code" in error ? String(error.code ?? "") : undefined,
        }
      : { name: "UnknownError", message: String(error) };

    console.error("Quote request sending failed", diagnostic);
    // A short, non-sensitive marker makes delivery faults traceable in PM2 logs.
    console.log("QUOTE_MAIL_DIAGNOSTIC", diagnostic);
    return NextResponse.json({ message: "Не удалось отправить заявку. Попробуйте ещё раз или напишите на info@steelprodukt.ru." }, { status: 500 });
  }
}

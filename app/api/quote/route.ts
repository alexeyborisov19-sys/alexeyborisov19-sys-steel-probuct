import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { recordConsentAudit } from "@/lib/legal/consent-audit";
import { legalDocumentVersions } from "@/lib/legal";
import { clientKey } from "@/lib/security/client-ip";
import {
  consumeRules,
  isDuplicateSubmission,
  quoteRateRules,
} from "@/lib/security/rate-limit";
import { PayloadTooLargeError, readMultipartForm } from "@/lib/security/request-body";
import { assertSameOriginRequest, CrossSiteRequestError } from "@/lib/security/same-origin";
import { safeSecurityLog } from "@/lib/security/safe-log";
import {
  inspectUploads,
  quarantineUploads,
  uploadLimits,
  UploadValidationError,
} from "@/lib/security/uploads";

export const runtime = "nodejs";

function value(formData: FormData, key: string, maximumLength = 2000) {
  return String(formData.get(key) ?? "")
    .trim()
    .replace(/[\r\n]+/g, " ")
    .slice(0, maximumLength);
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

function assertPrivateStorage(path: string) {
  const publicRoot = resolve(process.cwd(), "public");
  const fromPublic = relative(publicRoot, path);
  if (fromPublic === "" || (!fromPublic.startsWith(`..${sep}`) && fromPublic !== "..")) {
    throw new Error("Quote storage must be outside public");
  }
}

function safePageUrl(raw: string) {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const ownerKey = clientKey(request);
  try {
    assertSameOriginRequest(request);
  } catch (error) {
    if (error instanceof CrossSiteRequestError) {
      safeSecurityLog("quote", "cross_site_rejected", ownerKey);
      return NextResponse.json({ message: "Запрос отклонён." }, { status: 403 });
    }
    throw error;
  }

  const limited = consumeRules(ownerKey, quoteRateRules);
  if (limited) {
    safeSecurityLog("quote", "rate_limited", ownerKey);
    return NextResponse.json(
      { message: "Слишком много заявок. Повторите позже." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  try {
    const formData = await readMultipartForm(request, uploadLimits.maximumMultipartBytes);
    const name = value(formData, "name", 120);
    const phone = value(formData, "phone", 80);
    const email = value(formData, "email", 160).toLowerCase();
    const company = value(formData, "company", 160);
    const message = value(formData, "message", 8000);
    const pageUrl = value(formData, "pageUrl", 1000);
    const referrer = value(formData, "referrer", 1000);
    const personalDataConsent = value(formData, "personalDataConsent", 20);
    const marketingConsent = value(formData, "marketingConsent", 20);
    const consentTimestamp = value(formData, "consentTimestamp", 80);
    const website = value(formData, "website", 200);
    const attribution = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "yclid", "gclid"]
      .map((key) => [key, value(formData, key, 200)] as const)
      .filter(([, attributionValue]) => attributionValue);

    if (website) {
      safeSecurityLog("quote", "accepted", ownerKey);
      return NextResponse.json({ ok: true });
    }
    if (!name) {
      safeSecurityLog("quote", "bad_request", ownerKey);
      return NextResponse.json({ message: "Укажите имя." }, { status: 400 });
    }
    if (!phone && !email) {
      safeSecurityLog("quote", "bad_request", ownerKey);
      return NextResponse.json({ message: "Укажите телефон или электронную почту — достаточно одного способа связи." }, { status: 400 });
    }
    if (personalDataConsent !== "yes") {
      safeSecurityLog("quote", "bad_request", ownerKey);
      return NextResponse.json({ message: "Для отправки заявки требуется согласие на обработку персональных данных." }, { status: 400 });
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      safeSecurityLog("quote", "bad_request", ownerKey);
      return NextResponse.json({ message: "Проверьте адрес электронной почты." }, { status: 400 });
    }

    const files = formData.getAll("files").filter((item): item is File =>
      item instanceof File && item.size > 0,
    );
    const inspected = await inspectUploads(files);
    const fingerprint = sha256([
      ownerKey,
      name.toLowerCase(),
      phone.replace(/\D/g, ""),
      email,
      company.toLowerCase(),
      sha256(message),
      ...inspected.map((file) => `${file.safeName}:${file.size}`),
    ].join("|"));
    if (isDuplicateSubmission(fingerprint, "quote")) {
      safeSecurityLog("quote", "duplicate", ownerKey);
      return NextResponse.json(
        { message: "Такая заявка уже принята. Повторная отправка не требуется." },
        { status: 429, headers: { "Retry-After": "600" } },
      );
    }

    const requestId = `SP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const quarantinedFiles = await quarantineUploads(requestId, inspected);
    const antivirusBlocked = quarantinedFiles.some((file) => file.antivirus === "blocked");
    const recordedAt = new Date().toISOString();
    const consent = {
      event: "quote_request_consent",
      recordedAt,
      clientTimestamp: consentTimestamp || null,
      personalData: true,
      personalDataConsentVersion: legalDocumentVersions.personalDataConsent,
      privacyVersion: legalDocumentVersions.privacy,
      marketing: marketingConsent === "yes",
      marketingConsentVersion: marketingConsent === "yes"
        ? legalDocumentVersions.marketingConsent
        : null,
      ipHash: ownerKey,
    };

    const storageRoot = resolve(process.env.QUOTE_STORAGE_PATH || ".data/quote-leads");
    assertPrivateStorage(storageRoot);
    await mkdir(storageRoot, { recursive: true, mode: 0o700 });
    const recordPath = resolve(storageRoot, `${requestId}.json`);
    const record = {
      requestId,
      createdAt: recordedAt,
      source: "quote-form",
      name,
      phone: phone || null,
      email: email || null,
      company: company || null,
      message: message || null,
      pageUrl: safePageUrl(pageUrl),
      referrer: safePageUrl(referrer),
      attribution: Object.fromEntries(attribution),
      files: quarantinedFiles,
      consent,
      delivery: "stored" as "email" | "stored",
      retentionDays: Number(process.env.LEAD_RETENTION_DAYS || "90"),
    };
    await writeFile(
      recordPath,
      `${JSON.stringify(record, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600, flag: "wx" },
    );
    await recordConsentAudit({
      event: "quote_request_consent",
      requestId,
      recordedAt,
      clientTimestamp: consentTimestamp || null,
      personalDataConsentVersion: consent.personalDataConsentVersion,
      privacyVersion: consent.privacyVersion,
      marketing: consent.marketing,
      marketingConsentVersion: consent.marketingConsentVersion,
      ownerKey,
      phone,
      email,
    });

    const configuration = smtpConfiguration();
    if (configuration && !antivirusBlocked) {
      try {
        const recipient = process.env.QUOTE_RECIPIENT ?? "info@steelprodukt.ru";
        const from = process.env.SMTP_FROM ?? "info@steelprodukt.ru";
        const envelopeFrom = process.env.SMTP_ENVELOPE_FROM ?? from;
        const transporter = nodemailer.createTransport(configuration);
        const attachments = inspected.map((file, index) => {
          const quarantine = quarantinedFiles[index];
          const unverified = quarantine.antivirus !== "clean" || quarantine.safety !== "verified";
          return {
            filename: `${unverified ? "НЕПРОВЕРЕНО-" : ""}${file.safeName}`,
            content: file.buffer,
          };
        });

        await transporter.sendMail({
          from: `Сталь Продукт <${from}>`,
          to: recipient,
          envelope: { from: envelopeFrom, to: recipient },
          replyTo: email || undefined,
          subject: `Заявка на расчёт ${requestId}${company ? ` — ${company}` : ""}`,
          text: [
            "Новая заявка с сайта «Сталь Продукт».",
            `ID заявки: ${requestId}`,
            `Имя: ${name}`,
            `Телефон: ${phone || "не указан"}`,
            `E-mail: ${email || "не указан"}`,
            `Компания: ${company || "не указана"}`,
            `Задача: ${message || "не описана"}`,
            `Вложений: ${files.length}`,
            "Вложения первично сохранены в закрытом карантине. Файлы с пометкой НЕПРОВЕРЕНО требуют проверки перед открытием.",
          ].join("\n"),
          attachments,
        });
        record.delivery = "email";
      } catch {
        record.delivery = "stored";
      }
    }
    await writeFile(
      recordPath,
      `${JSON.stringify(record, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );

    if (antivirusBlocked) {
      safeSecurityLog("quote", "antivirus_blocked", ownerKey);
      return NextResponse.json(
        { message: "Заявка сохранена, но один из файлов не прошёл обязательную проверку. Специалист свяжется с вами безопасным способом." },
        { status: 500 },
      );
    }

    safeSecurityLog("quote", "stored", ownerKey);
    return NextResponse.json({
      ok: true,
      requestId,
      message: record.delivery === "email"
        ? "Заявка принята."
        : "Заявка сохранена. Специалист обработает её после проверки материалов.",
    });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      safeSecurityLog("quote", "payload_too_large", ownerKey);
      return NextResponse.json({ message: "Общий размер запроса превышает 10 МБ." }, { status: 413 });
    }
    if (error instanceof UploadValidationError) {
      safeSecurityLog("quote", error.status === 413 ? "payload_too_large" : "bad_request", ownerKey);
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    safeSecurityLog("quote", "internal_error", ownerKey);
    return NextResponse.json(
      { message: "Не удалось принять заявку. Попробуйте ещё раз или позвоните +7 910 780 37 23." },
      { status: 500 },
    );
  }
}

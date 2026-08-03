import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { validateProductionEnvironment } from "@/lib/config/production-env";
import { legalDocumentVersions } from "@/lib/legal";
import { recordConsentAudit } from "@/lib/legal/consent-audit";
import { deliverQuoteEmail } from "@/lib/quote/mailer";
import { createQuoteRecord, QuoteStorageError, updateQuoteRecord } from "@/lib/quote/storage";
import type { QuoteErrorCode, QuoteRecord } from "@/lib/quote/types";
import { clientKey } from "@/lib/security/client-ip";
import { consumeRules, isDuplicateSubmission, quoteRateRules } from "@/lib/security/rate-limit";
import { PayloadTooLargeError, readMultipartForm } from "@/lib/security/request-body";
import { safeSecurityLog } from "@/lib/security/safe-log";
import { assertSameOriginRequest, CrossSiteRequestError } from "@/lib/security/same-origin";
import {
  inspectUploads,
  quarantineUploads,
  uploadLimits,
  UploadValidationError,
} from "@/lib/security/uploads";

const CONFIGURATION_LOG_KEY = "configuration-unavailable";

function value(formData: FormData, key: string, maximumLength = 2000) {
  return String(formData.get(key) ?? "")
    .trim()
    .replace(/[\r\n]+/g, " ")
    .slice(0, maximumLength);
}

function sha256(valueToHash: string) {
  return createHash("sha256").update(valueToHash).digest("hex");
}

function safePageUrl(raw: string) {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return null;
  }
}

function createRequestId(now = new Date()) {
  return `SP-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function response(
  status: number,
  requestId: string,
  code: QuoteErrorCode,
  message: string,
  headers?: HeadersInit,
) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Request-Id", requestId);
  return NextResponse.json(
    { ok: status < 400, requestId, code, message },
    { status, headers: responseHeaders },
  );
}

export type QuoteHandlerDependencies = {
  validateEnvironment: typeof validateProductionEnvironment;
  inspectUploads: typeof inspectUploads;
  quarantineUploads: typeof quarantineUploads;
  recordConsentAudit: typeof recordConsentAudit;
  createQuoteRecord: typeof createQuoteRecord;
  updateQuoteRecord: typeof updateQuoteRecord;
  deliverQuoteEmail: typeof deliverQuoteEmail;
};

const defaultDependencies: QuoteHandlerDependencies = {
  validateEnvironment: validateProductionEnvironment,
  inspectUploads,
  quarantineUploads,
  recordConsentAudit,
  createQuoteRecord,
  updateQuoteRecord,
  deliverQuoteEmail,
};

export function createQuoteHandler(overrides: Partial<QuoteHandlerDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function handleQuoteRequest(request: Request) {
    const requestId = createRequestId();

    try {
      assertSameOriginRequest(request);
    } catch (error) {
      if (error instanceof CrossSiteRequestError) {
        safeSecurityLog("quote", "cross_site_rejected", CONFIGURATION_LOG_KEY, {
          requestId,
          code: "CROSS_ORIGIN_REJECTED",
        });
        return response(403, requestId, "CROSS_ORIGIN_REJECTED", "Запрос отклонён.");
      }
      throw error;
    }

    const configurationIssues = dependencies.validateEnvironment();
    if (configurationIssues.length) {
      safeSecurityLog("quote", "configuration_error", CONFIGURATION_LOG_KEY, {
        requestId,
        code: "CONFIGURATION_ERROR",
      });
      return response(
        503,
        requestId,
        "CONFIGURATION_ERROR",
        "Сервис заявок временно недоступен. Позвоните нам по телефону +7 910 780 37 23.",
      );
    }

    const ownerKey = clientKey(request);
    const limited = consumeRules(ownerKey, quoteRateRules);
    if (limited) {
      safeSecurityLog("quote", "rate_limited", ownerKey, { requestId, code: "RATE_LIMITED" });
      return response(
        429,
        requestId,
        "RATE_LIMITED",
        "Слишком много заявок. Повторите позже.",
        { "Retry-After": String(limited.retryAfterSeconds) },
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
        safeSecurityLog("quote", "accepted", ownerKey, { requestId, code: "ACCEPTED" });
        return response(200, requestId, "ACCEPTED", "Заявка принята.");
      }
      if (!name) {
        safeSecurityLog("quote", "bad_request", ownerKey, { requestId, code: "VALIDATION_ERROR" });
        return response(400, requestId, "VALIDATION_ERROR", "Укажите имя.");
      }
      if (!phone && !email) {
        safeSecurityLog("quote", "bad_request", ownerKey, { requestId, code: "VALIDATION_ERROR" });
        return response(400, requestId, "VALIDATION_ERROR", "Укажите телефон или электронную почту — достаточно одного способа связи.");
      }
      if (personalDataConsent !== "yes") {
        safeSecurityLog("quote", "bad_request", ownerKey, { requestId, code: "VALIDATION_ERROR" });
        return response(400, requestId, "VALIDATION_ERROR", "Для отправки заявки требуется согласие на обработку персональных данных.");
      }
      if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        safeSecurityLog("quote", "bad_request", ownerKey, { requestId, code: "VALIDATION_ERROR" });
        return response(400, requestId, "VALIDATION_ERROR", "Проверьте адрес электронной почты.");
      }

      const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
      const inspected = await dependencies.inspectUploads(files);
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
        safeSecurityLog("quote", "duplicate", ownerKey, { requestId, code: "DUPLICATE_REQUEST" });
        return response(
          429,
          requestId,
          "DUPLICATE_REQUEST",
          "Такая заявка уже принята. Повторная отправка не требуется.",
          { "Retry-After": "600" },
        );
      }

      let quarantinedFiles;
      try {
        quarantinedFiles = await dependencies.quarantineUploads(requestId, inspected);
      } catch {
        safeSecurityLog("quote", "storage_error", ownerKey, { requestId, code: "STORAGE_ERROR" });
        return response(
          500,
          requestId,
          "STORAGE_ERROR",
          "Не удалось безопасно сохранить вложения. Повторите позже или позвоните +7 910 780 37 23.",
        );
      }
      if (quarantinedFiles.some((file) => file.antivirus === "blocked")) {
        safeSecurityLog("quote", "antivirus_blocked", ownerKey, { requestId, code: "UPLOAD_REJECTED" });
        return response(
          422,
          requestId,
          "UPLOAD_REJECTED",
          "Один из файлов не прошёл обязательную проверку. Удалите его или отправьте материалы другим безопасным способом.",
        );
      }

      const recordedAt = new Date().toISOString();
      const consent = {
        event: "quote_request_consent" as const,
        recordedAt,
        clientTimestamp: consentTimestamp || null,
        personalData: true as const,
        personalDataConsentVersion: legalDocumentVersions.personalDataConsent,
        privacyVersion: legalDocumentVersions.privacy,
        marketing: marketingConsent === "yes",
        marketingConsentVersion: marketingConsent === "yes" ? legalDocumentVersions.marketingConsent : null,
        ipHash: ownerKey,
      };
      const record: QuoteRecord = {
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
        consentAudit: "pending",
        delivery: "stored",
        retentionDays: Number(process.env.LEAD_RETENTION_DAYS || "90"),
      };

      await dependencies.createQuoteRecord(record);

      try {
        await dependencies.recordConsentAudit({
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
        record.consentAudit = "recorded";
      } catch {
        record.consentAudit = "deferred";
        safeSecurityLog("quote", "consent_audit_deferred", ownerKey, {
          requestId,
          code: "CONSENT_AUDIT_DEFERRED",
        });
      }

      let smtpDeferred = false;
      try {
        await dependencies.deliverQuoteEmail(record, inspected);
        record.delivery = "email";
      } catch {
        smtpDeferred = true;
        record.delivery = "stored";
        safeSecurityLog("quote", "smtp_deferred", ownerKey, {
          requestId,
          code: "SMTP_DELIVERY_DEFERRED",
        });
      }

      try {
        await dependencies.updateQuoteRecord(record);
      } catch {
        safeSecurityLog("quote", "storage_error", ownerKey, { requestId, code: "STORAGE_ERROR" });
        return response(
          202,
          requestId,
          "STORAGE_ERROR",
          "Заявка принята и сохранена. Специалист обработает её по защищённой локальной записи.",
        );
      }

      if (record.consentAudit === "deferred") {
        return response(
          202,
          requestId,
          "CONSENT_AUDIT_DEFERRED",
          "Заявка принята и сохранена. Специалист обработает её после служебной проверки.",
        );
      }
      if (smtpDeferred) {
        return response(
          202,
          requestId,
          "SMTP_DELIVERY_DEFERRED",
          "Заявка принята и сохранена. Почтовое уведомление отложено, но обращение не потеряно.",
        );
      }

      safeSecurityLog("quote", "stored", ownerKey, { requestId, code: "ACCEPTED" });
      return response(200, requestId, "ACCEPTED", "Заявка принята.");
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        safeSecurityLog("quote", "payload_too_large", ownerKey, { requestId, code: "UPLOAD_REJECTED" });
        return response(413, requestId, "UPLOAD_REJECTED", "Общий размер запроса превышает 10 МБ.");
      }
      if (error instanceof UploadValidationError) {
        safeSecurityLog("quote", error.status === 413 ? "payload_too_large" : "bad_request", ownerKey, {
          requestId,
          code: "UPLOAD_REJECTED",
        });
        return response(error.status, requestId, "UPLOAD_REJECTED", error.message);
      }
      if (error instanceof QuoteStorageError) {
        safeSecurityLog("quote", "storage_error", ownerKey, { requestId, code: "STORAGE_ERROR" });
        return response(
          500,
          requestId,
          "STORAGE_ERROR",
          "Не удалось безопасно сохранить заявку. Повторите позже или позвоните +7 910 780 37 23.",
        );
      }
      safeSecurityLog("quote", "internal_error", ownerKey, { requestId, code: "INTERNAL_ERROR" });
      return response(
        500,
        requestId,
        "INTERNAL_ERROR",
        "Не удалось принять заявку. Попробуйте ещё раз или позвоните +7 910 780 37 23.",
      );
    }
  };
}

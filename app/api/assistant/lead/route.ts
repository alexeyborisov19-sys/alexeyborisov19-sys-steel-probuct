import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { NextResponse } from "next/server";
import { assistantSessionStore } from "@/lib/assistant/session-store";
import { sessionLeadSummary } from "@/lib/assistant/state";
import { recordConsentAudit } from "@/lib/legal/consent-audit";
import { legalDocumentVersions } from "@/lib/legal";
import { clientKey } from "@/lib/security/client-ip";
import {
  consumeRules,
  isDuplicateSubmission,
  leadRateRules,
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

const MAX_FILES = 8;

function field(formData: FormData, key: string, maxLength = 2000) {
  return String(formData.get(key) ?? "").trim().slice(0, maxLength);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safePageUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return null;
  }
}

function assertPrivateStorage(path: string) {
  const publicRoot = resolve(process.cwd(), "public");
  const pathFromPublic = relative(publicRoot, path);
  if (pathFromPublic === "" || (!pathFromPublic.startsWith(`..${sep}`) && pathFromPublic !== "..")) {
    throw new Error("Lead storage must be outside public");
  }
}

export async function POST(request: Request) {
  const ownerKey = clientKey(request);
  try {
    assertSameOriginRequest(request);
  } catch (error) {
    if (error instanceof CrossSiteRequestError) {
      safeSecurityLog("assistant-lead", "cross_site_rejected", ownerKey);
      return NextResponse.json({ message: "Запрос отклонён." }, { status: 403 });
    }
    throw error;
  }

  const limited = consumeRules(ownerKey, leadRateRules);
  if (limited) {
    safeSecurityLog("assistant-lead", "rate_limited", ownerKey);
    return NextResponse.json(
      { message: "Слишком много заявок. Повторите позже." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  try {
    const formData = await readMultipartForm(request, uploadLimits.maximumMultipartBytes);
    const name = field(formData, "name", 120);
    const phone = field(formData, "phone", 80);
    const email = field(formData, "email", 160).toLowerCase();
    const company = field(formData, "company", 160);
    const pageUrl = field(formData, "pageUrl", 1000);
    const sessionId = field(formData, "sessionId", 80);
    const consent = field(formData, "personalDataConsent", 20);
    const consentTimestamp = field(formData, "consentTimestamp", 80);
    const website = field(formData, "website", 200);

    if (website) {
      safeSecurityLog("assistant-lead", "accepted", ownerKey);
      return NextResponse.json({ ok: true });
    }
    if (!name) {
      safeSecurityLog("assistant-lead", "bad_request", ownerKey);
      return NextResponse.json({ message: "Укажите имя." }, { status: 400 });
    }
    if (!phone && !email) {
      safeSecurityLog("assistant-lead", "bad_request", ownerKey);
      return NextResponse.json({ message: "Укажите телефон или электронную почту — достаточно одного способа связи." }, { status: 400 });
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      safeSecurityLog("assistant-lead", "bad_request", ownerKey);
      return NextResponse.json({ message: "Проверьте адрес электронной почты." }, { status: 400 });
    }
    if (consent !== "yes") {
      safeSecurityLog("assistant-lead", "bad_request", ownerKey);
      return NextResponse.json(
        { message: "Для передачи заявки необходимо согласие на обработку персональных данных." },
        { status: 400 },
      );
    }

    const files = formData.getAll("files").filter((entry): entry is File =>
      entry instanceof File && entry.size > 0,
    );
    const inspected = await inspectUploads(files, MAX_FILES);
    const duplicateFingerprint = sha256([
      ownerKey,
      name.toLowerCase(),
      phone.replace(/\D/g, ""),
      email,
      company.toLowerCase(),
      ...inspected.map((file) => `${file.safeName}:${file.size}`),
    ].join("|"));
    if (isDuplicateSubmission(duplicateFingerprint, "lead")) {
      safeSecurityLog("assistant-lead", "duplicate", ownerKey);
      return NextResponse.json(
        { message: "Такая заявка уже принята. Повторная отправка не требуется." },
        { status: 429, headers: { "Retry-After": "600" } },
      );
    }

    const requestId = `SP-AI-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const quarantinedFiles = await quarantineUploads(requestId, inspected);
    const antivirusBlocked = quarantinedFiles.some((file) => file.antivirus === "blocked");
    const session = sessionId ? assistantSessionStore.get(sessionId, ownerKey) : undefined;
    const storageRoot = resolve(process.env.ASSISTANT_LEAD_STORAGE_PATH || ".data/assistant-leads");
    assertPrivateStorage(storageRoot);
    const leadFile = resolve(storageRoot, `${requestId}.json`);
    await mkdir(dirname(leadFile), { recursive: true, mode: 0o700 });

    const record = {
      requestId,
      createdAt: new Date().toISOString(),
      source: "engineering-assistant",
      name,
      phone: phone || null,
      email: email || null,
      company: company || null,
      engineeringState: session?.state ?? null,
      summary: session ? sessionLeadSummary(session) : "Диалоговая сессия не найдена; требуется уточнение менеджером.",
      pageUrl: safePageUrl(pageUrl),
      files: quarantinedFiles,
      consent: {
        personalData: true,
        capturedAt: consentTimestamp || new Date().toISOString(),
        personalDataConsentVersion: legalDocumentVersions.personalDataConsent,
        privacyVersion: legalDocumentVersions.privacy,
      },
      ipHash: ownerKey,
      retentionDays: Number(process.env.LEAD_RETENTION_DAYS || "90"),
    };
    await writeFile(leadFile, `${JSON.stringify(record, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await recordConsentAudit({
      event: "assistant_lead_consent",
      requestId,
      recordedAt: record.createdAt,
      clientTimestamp: consentTimestamp || null,
      personalDataConsentVersion: record.consent.personalDataConsentVersion,
      privacyVersion: record.consent.privacyVersion,
      marketing: false,
      marketingConsentVersion: null,
      ownerKey,
      phone,
      email,
    });

    if (antivirusBlocked) {
      safeSecurityLog("assistant-lead", "antivirus_blocked", ownerKey);
      return NextResponse.json(
        { message: "Заявка сохранена, но один из файлов не прошёл обязательную проверку. Специалист свяжется с вами безопасным способом." },
        { status: 500 },
      );
    }

    safeSecurityLog("assistant-lead", "stored", ownerKey);
    return NextResponse.json({ ok: true, requestId });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      safeSecurityLog("assistant-lead", "payload_too_large", ownerKey);
      return NextResponse.json({ message: "Общий размер запроса превышает 10 МБ." }, { status: 413 });
    }
    if (error instanceof UploadValidationError) {
      safeSecurityLog("assistant-lead", error.status === 413 ? "payload_too_large" : "bad_request", ownerKey);
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    safeSecurityLog("assistant-lead", "internal_error", ownerKey);
    return NextResponse.json(
      { message: "Не удалось передать заявку. Позвоните по номеру +7 910 780 37 23." },
      { status: 500 },
    );
  }
}

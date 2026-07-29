import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { NextResponse } from "next/server";
import { legalDocumentVersions } from "@/lib/legal";

export const runtime = "nodejs";

const MAX_FILES = 8;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_FILE_BYTES = 7 * 1024 * 1024;
// Telegram delivery is intentionally disabled by product and legal decision.
// Re-enabling it requires a separate code change, legal review and deployment;
// server environment variables alone cannot activate the integration.
const TELEGRAM_DELIVERY_ALLOWED = false;
const allowedExtensions = new Set([
  "pdf", "dxf", "dwg", "dwt", "dws", "step", "stp", "iges", "igs",
  "sldprt", "sldasm", "ipt", "iam", "idw", "png", "jpg", "jpeg", "webp",
  "tif", "tiff", "doc", "docx", "xls", "xlsx", "zip", "rar", "7z",
]);

function field(formData: FormData, key: string, maxLength = 2000) {
  return String(formData.get(key) ?? "").trim().slice(0, maxLength);
}

function safeFileName(name: string) {
  const cleaned = basename(name)
    .replace(/[^\p{L}\p{N}._()\- ]/gu, "_")
    .replace(/\s+/g, "_")
    .slice(0, 140);
  return cleaned || "attachment";
}

function extensionOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function escapeTelegram(value: string) {
  return value.replace(/[<>&]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
  }[character] ?? character));
}

async function notifyTelegram(message: string, files: File[]) {
  if (!TELEGRAM_DELIVERY_ALLOWED) return false;
  if (process.env.ASSISTANT_TELEGRAM_ENABLED !== "true") return false;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_LEADS_CHAT_ID;
  if (!token || !chatId) return false;

  const messageResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
    cache: "no-store",
  });
  if (!messageResponse.ok) throw new Error(`Telegram sendMessage returned ${messageResponse.status}`);

  for (const file of files) {
    const payload = new FormData();
    payload.append("chat_id", chatId);
    payload.append("caption", "Вложение к заявке ИИ-помощника");
    payload.append("document", file, safeFileName(file.name));
    const documentResponse = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: payload,
      cache: "no-store",
    });
    if (!documentResponse.ok) {
      throw new Error(`Telegram sendDocument returned ${documentResponse.status}`);
    }
  }
  return true;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const name = field(formData, "name", 120);
    const phone = field(formData, "phone", 80);
    const email = field(formData, "email", 160);
    const company = field(formData, "company", 160);
    const summary = field(formData, "summary", 8000);
    const pageUrl = field(formData, "pageUrl", 1000);
    const consent = field(formData, "personalDataConsent", 20);
    const consentTimestamp = field(formData, "consentTimestamp", 80);
    const website = field(formData, "website", 200);

    // Honeypot: report success but do not store automated spam.
    if (website) return NextResponse.json({ ok: true });
    if (!name) {
      return NextResponse.json({ message: "Укажите имя." }, { status: 400 });
    }
    if (!phone && !email) {
      return NextResponse.json({ message: "Укажите телефон или электронную почту — достаточно одного способа связи." }, { status: 400 });
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ message: "Проверьте адрес электронной почты." }, { status: 400 });
    }
    if (consent !== "yes") {
      return NextResponse.json(
        { message: "Для передачи заявки необходимо согласие на обработку персональных данных." },
        { status: 400 },
      );
    }

    const files = formData.getAll("files").filter((entry): entry is File =>
      entry instanceof File && entry.size > 0,
    );
    if (files.length > MAX_FILES) {
      return NextResponse.json({ message: `Можно приложить не более ${MAX_FILES} файлов.` }, { status: 400 });
    }
    if (files.some((file) => !allowedExtensions.has(extensionOf(file.name)))) {
      return NextResponse.json({ message: "Один из файлов имеет неподдерживаемый формат." }, { status: 400 });
    }
    if (files.some((file) => file.size > MAX_FILE_BYTES)) {
      return NextResponse.json({ message: "Размер одного файла не должен превышать 7 МБ." }, { status: 400 });
    }
    if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) {
      return NextResponse.json({ message: "Общий размер файлов не должен превышать 10 МБ." }, { status: 400 });
    }

    const requestId = `SP-AI-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const storageRoot = resolve(
      process.env.ASSISTANT_LEAD_STORAGE_PATH || ".data/assistant-leads",
    );
    if (storageRoot.includes("/public/")) {
      throw new Error("Assistant lead storage must not be inside public.");
    }
    const leadDirectory = join(storageRoot, requestId);
    await mkdir(leadDirectory, { recursive: true, mode: 0o700 });

    const savedFiles: Array<{ name: string; size: number; path: string }> = [];
    for (const [index, file] of files.entries()) {
      const fileName = `${String(index + 1).padStart(2, "0")}-${safeFileName(file.name)}`;
      const target = join(leadDirectory, fileName);
      await writeFile(target, Buffer.from(await file.arrayBuffer()), { mode: 0o600 });
      savedFiles.push({ name: file.name, size: file.size, path: target });
    }

    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const record = {
      requestId,
      createdAt: new Date().toISOString(),
      source: "engineering-assistant",
      name,
      phone,
      email: email || null,
      company: company || null,
      summary: summary || null,
      pageUrl: pageUrl || null,
      files: savedFiles,
      consent: {
        personalData: true,
        capturedAt: consentTimestamp || new Date().toISOString(),
        personalDataConsentVersion: legalDocumentVersions.personalDataConsent,
        privacyVersion: legalDocumentVersions.privacy,
      },
      ipHash: forwardedFor ? sha256(forwardedFor) : null,
      userAgent: request.headers.get("user-agent") ?? null,
    };
    await writeFile(
      join(leadDirectory, "lead.json"),
      `${JSON.stringify(record, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await appendFile(
      join(storageRoot, "leads-index.jsonl"),
      `${JSON.stringify({
        requestId,
        createdAt: record.createdAt,
        directory: leadDirectory,
        contactHash: sha256(`${phone}|${email.toLowerCase()}`),
        consent: record.consent,
      })}\n`,
      { encoding: "utf8", mode: 0o600 },
    );

    let telegramDelivered = false;
    try {
      telegramDelivered = await notifyTelegram([
        `<b>Новая заявка ${escapeTelegram(requestId)}</b>`,
        "Источник: ИИ-помощник сайта",
        "",
        `<b>Имя:</b> ${escapeTelegram(name)}`,
        `<b>Телефон:</b> ${escapeTelegram(phone || "не указан")}`,
        `<b>E-mail:</b> ${escapeTelegram(email || "не указан")}`,
        `<b>Компания:</b> ${escapeTelegram(company || "не указана")}`,
        `<b>Файлов:</b> ${files.length}`,
        "",
        `<b>Сводка:</b>\n${escapeTelegram(summary || "Задача не описана")}`,
      ].join("\n"), files);
    } catch (telegramError) {
      console.error("Assistant lead Telegram notification failed", telegramError);
    }

    return NextResponse.json({ ok: true, requestId, telegramDelivered });
  } catch (error) {
    console.error("Engineering assistant lead failed", error);
    return NextResponse.json(
      { message: "Не удалось передать заявку. Позвоните по номеру +7 910 780 37 23." },
      { status: 500 },
    );
  }
}

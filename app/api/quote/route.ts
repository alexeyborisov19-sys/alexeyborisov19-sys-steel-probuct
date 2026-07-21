import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
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
    const website = value(formData, "website");
    const attribution = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "yclid", "gclid"]
      .map((key) => [key, value(formData, key)] as const)
      .filter(([, attributionValue]) => attributionValue);

    // Invisible bot trap: respond successfully without delivering spam.
    if (website) return NextResponse.json({ ok: true });

    if (!name || !phone) {
      return NextResponse.json({ message: "Укажите имя и телефон для связи." }, { status: 400 });
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ message: "Проверьте адрес электронной почты." }, { status: 400 });
    }

    const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    if (files.length > MAX_FILES) {
      return NextResponse.json({ message: `Можно прикрепить не более ${MAX_FILES} файлов.` }, { status: 400 });
    }
    if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) {
      return NextResponse.json({ message: "Общий размер вложений не должен превышать 25 МБ." }, { status: 400 });
    }
    if (files.some((file) => !allowedExtensions.has(extensionOf(file.name)))) {
      return NextResponse.json({ message: "Один или несколько файлов имеют неподдерживаемый формат." }, { status: 400 });
    }

    const recipient = process.env.QUOTE_RECIPIENT ?? "info@steelprodukt.ru";
    const from = process.env.SMTP_FROM ?? configuration.auth.user;
    const transporter = nodemailer.createTransport(configuration);
    const attachments = await Promise.all(files.map(async (file) => ({
      filename: file.name.replace(/[\r\n]/g, "_"),
      content: Buffer.from(await file.arrayBuffer()),
    })));

    await transporter.sendMail({
      from,
      to: recipient,
      replyTo: email || undefined,
      subject: `Заявка на расчёт${company ? ` — ${company}` : ""}`,
      text: [
        "Новая заявка с сайта «Сталь Продукт».",
        `Имя: ${name}`,
        `Телефон: ${phone}`,
        `E-mail: ${email || "не указан"}`,
        `Компания: ${company || "не указана"}`,
        `Задача: ${message || "не описана"}`,
        `Вложений: ${files.length}`,
        `Страница заявки: ${pageUrl || "не определена"}`,
        `Источник перехода: ${referrer || "прямой переход"}`,
        ...(attribution.length ? ["Метки кампании:", ...attribution.map(([key, attributionValue]) => `${key}: ${attributionValue}`)] : []),
      ].join("\n"),
      attachments,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Quote request sending failed", error);
    return NextResponse.json({ message: "Не удалось отправить заявку. Попробуйте ещё раз или напишите на info@steelprodukt.ru." }, { status: 500 });
  }
}

import nodemailer from "nodemailer";
import type { QuoteRecord } from "@/lib/quote/types";
import type { UploadInspection } from "@/lib/security/uploads";

export async function deliverQuoteEmail(record: QuoteRecord, uploads: UploadInspection[]) {
  const port = Number(process.env.SMTP_PORT);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true",
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  const recipient = process.env.QUOTE_RECIPIENT as string;
  const from = process.env.SMTP_FROM as string;
  const envelopeFrom = process.env.SMTP_ENVELOPE_FROM as string;
  const attachments = uploads.map((file, index) => {
    const quarantine = record.files[index];
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
    replyTo: record.email || undefined,
    subject: `Заявка на расчёт ${record.requestId}${record.company ? ` — ${record.company}` : ""}`,
    text: [
      "Новая заявка с сайта «Сталь Продукт».",
      `ID заявки: ${record.requestId}`,
      `Имя: ${record.name}`,
      `Телефон: ${record.phone || "не указан"}`,
      `E-mail: ${record.email || "не указан"}`,
      `Компания: ${record.company || "не указана"}`,
      `Задача: ${record.message || "не описана"}`,
      `Вложений: ${record.files.length}`,
      "Вложения первично сохранены в закрытом карантине. Файлы с пометкой НЕПРОВЕРЕНО требуют проверки перед открытием.",
    ].join("\n"),
    attachments,
  });
}

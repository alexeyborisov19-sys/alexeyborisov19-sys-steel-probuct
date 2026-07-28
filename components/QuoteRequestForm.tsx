"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { trackLeadEvent } from "@/lib/analytics";
import { legalDocumentVersions, legalLinks } from "@/lib/legal";

const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_FILE_BYTES = 7 * 1024 * 1024;
const acceptedExtensions = [
  "pdf", "dxf", "dwg", "dwt", "dws", "step", "stp", "iges", "igs",
  "sldprt", "sldasm", "ipt", "iam", "idw", "png", "jpg", "jpeg", "webp",
  "tif", "tiff", "doc", "docx", "xls", "xlsx", "zip", "rar", "7z",
];

const acceptedFiles = acceptedExtensions.map((extension) => `.${extension}`).join(",");

type Feedback = { type: "error" | "success"; message: string } | null;

function extensionOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".0", "")} МБ`;
}

export function QuoteRequestForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSending, setIsSending] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!incoming.length) return;

    const wrongFiles = incoming.filter((file) => !acceptedExtensions.includes(extensionOf(file.name)));
    const validFiles = incoming.filter((file) => acceptedExtensions.includes(extensionOf(file.name)));
    const combined = [...files, ...validFiles].filter((file, index, items) =>
      items.findIndex((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified) === index,
    );

    if (combined.length > MAX_FILES) {
      setFeedback({ type: "error", message: `Можно прикрепить не более ${MAX_FILES} файлов.` });
      return;
    }
    if (combined.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) {
      setFeedback({ type: "error", message: "Общий размер вложений не должен превышать 10 МБ." });
      return;
    }
    if (combined.some((file) => file.size > MAX_FILE_BYTES)) {
      setFeedback({ type: "error", message: "Размер каждого вложения не должен превышать 7 МБ." });
      return;
    }

    setFiles(combined);
    setFeedback(wrongFiles.length ? { type: "error", message: "Часть файлов не добавлена: проверьте допустимые форматы." } : null);
    if (validFiles.length) trackLeadEvent("quote_file_attached", { files_added: validFiles.length, total_files: combined.length });
  }

  function markFormStarted() {
    if (hasStarted) return;
    setHasStarted(true);
    trackLeadEvent("quote_form_started", { form_location: "contacts" });
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setFeedback(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (formData.get("personalDataConsent") !== "yes") {
      setFeedback({ type: "error", message: "Для отправки заявки необходимо согласие на обработку персональных данных." });
      return;
    }
    formData.append("consentTimestamp", new Date().toISOString());
    formData.append("personalDataConsentVersion", legalDocumentVersions.personalDataConsent);
    formData.append("privacyVersion", legalDocumentVersions.privacy);
    if (formData.get("marketingConsent") === "yes") {
      formData.append("marketingConsentVersion", legalDocumentVersions.marketingConsent);
    }
    files.forEach((file) => formData.append("files", file));
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      formData.append("pageUrl", url.href);
      formData.append("referrer", document.referrer);
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "yclid", "gclid"].forEach((key) => {
        const value = url.searchParams.get(key);
        if (value) formData.append(key, value);
      });
    }

    setIsSending(true);
    trackLeadEvent("quote_request_submit", { form_location: "contacts", has_files: files.length > 0, files_count: files.length });
    try {
      const response = await fetch("/api/quote", { method: "POST", body: formData });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Не удалось отправить заявку.");

      form.reset();
      setFiles([]);
      setHasStarted(false);
      trackLeadEvent("quote_request_success", { form_location: "contacts", has_files: files.length > 0, files_count: files.length });
      setFeedback({ type: "success", message: "Заявка отправлена. Мы свяжемся с вами в ближайшее время." });
    } catch (error) {
      trackLeadEvent("quote_request_error", { form_location: "contacts" });
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Не удалось отправить заявку. Попробуйте ещё раз.",
      });
    } finally {
      setIsSending(false);
    }
  }

  return <form id="quote-request-form" name="quote-request-form" data-ym-form="quote-request" onSubmit={handleSubmit} onFocus={markFormStarted} className="grid gap-6" noValidate>
    <label className="sr-only" aria-hidden="true">Не заполняйте это поле<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold text-white">Имя *
        <input name="name" required className="mt-2 w-full border border-white/20 bg-black/20 p-4 text-sm font-normal outline-none transition placeholder:text-white/30 focus:border-steel-orange" placeholder="Как к вам обращаться" autoComplete="name" />
      </label>
      <label className="text-sm font-semibold text-white">Телефон *
        <input name="phone" required className="mt-2 w-full border border-white/20 bg-black/20 p-4 text-sm font-normal outline-none transition placeholder:text-white/30 focus:border-steel-orange" placeholder="+7 ___ ___ __ __" type="tel" autoComplete="tel" />
      </label>
      <label className="text-sm font-semibold text-white">Электронная почта
        <input name="email" className="mt-2 w-full border border-white/20 bg-black/20 p-4 text-sm font-normal outline-none transition placeholder:text-white/30 focus:border-steel-orange" placeholder="name@company.ru" type="email" autoComplete="email" />
      </label>
      <label className="text-sm font-semibold text-white">Компания
        <input name="company" className="mt-2 w-full border border-white/20 bg-black/20 p-4 text-sm font-normal outline-none transition placeholder:text-white/30 focus:border-steel-orange" placeholder="Название компании" autoComplete="organization" />
      </label>
    </div>

    <label className="text-sm font-semibold text-white">Задача
      <textarea name="message" className="mt-2 min-h-36 w-full resize-y border border-white/20 bg-black/20 p-4 text-sm font-normal outline-none transition placeholder:text-white/30 focus:border-steel-orange" placeholder="Что необходимо изготовить, в каком объёме и в какие сроки?" />
    </label>

    <div className="border border-white/15 bg-black/20 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Чертежи и техническая документация</p>
          <p className="mt-1 text-xs leading-relaxed text-white/50">До 10 файлов, суммарно до 10 МБ; каждый — до 7 МБ. Можно приложить чертежи, спецификации, визуализации и фотографии.</p>
        </div>
        <a href="mailto:info@steelprodukt.ru" className="shrink-0 text-xs font-bold text-steel-orange transition hover:text-orange-400">info@steelprodukt.ru&nbsp; ↗</a>
      </div>

      <label className="mt-5 flex cursor-pointer flex-col items-center justify-center border border-dashed border-white/25 bg-[#111519] px-5 py-8 text-center transition hover:border-steel-orange hover:bg-[#15191c]">
        <span className="grid h-10 w-10 place-items-center border border-steel-orange/60 text-xl text-steel-orange">＋</span>
        <span className="mt-3 text-sm font-semibold text-white">Выбрать файлы</span>
        <span className="mt-1 text-[11px] leading-relaxed text-white/45">PDF, DXF, DWG, STEP, изображения, Office-документы и архивы</span>
        <input ref={fileInput} onChange={handleFiles} accept={acceptedFiles} className="sr-only" type="file" multiple />
      </label>

      {files.length ? <div className="mt-4 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="font-semibold text-white">Прикреплено: {files.length} из {MAX_FILES}</span>
          <button type="button" onClick={() => { setFiles([]); setFeedback(null); }} className="text-white/50 transition hover:text-steel-orange">Очистить список</button>
        </div>
        <ul className="mt-3 space-y-2">
          {files.map((file, index) => <li key={`${file.name}-${file.lastModified}`} className="flex items-center gap-3 border border-white/10 bg-[#15191c] px-3 py-2 text-xs">
            <span className="truncate text-white/75">{file.name}</span>
            <span className="ml-auto shrink-0 text-white/40">{formatSize(file.size)}</span>
            <button type="button" onClick={() => removeFile(index)} className="shrink-0 text-lg leading-none text-white/45 transition hover:text-steel-orange" aria-label={`Удалить ${file.name}`}>×</button>
          </li>)}
        </ul>
        <p className="mt-3 text-[11px] text-white/40">Общий размер: {formatSize(totalSize)} из 10 МБ</p>
      </div> : null}
    </div>

    {feedback ? <p role="status" className={`border px-4 py-3 text-sm ${feedback.type === "success" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-steel-orange/50 bg-steel-orange/10 text-orange-100"}`}>{feedback.message}</p> : null}

    <div className="border-t border-white/10 pt-6">
      <p className="mb-4 text-[11px] leading-relaxed text-white/48">
        До отправки ознакомьтесь с <Link href={legalLinks.privacy} target="_blank" className="text-steel-orange underline-offset-2 hover:underline">политикой обработки персональных данных</Link>. Согласие на обработку данных и необязательное согласие на рекламу оформляются отдельно.
      </p>
      <label className="flex cursor-pointer items-start gap-3 text-[11px] leading-relaxed text-white/62">
        <input name="personalDataConsent" value="yes" type="checkbox" required aria-required="true" className="mt-0.5 h-4 w-4 shrink-0 accent-[#EA5B0C]" />
        <span>Я даю отдельное <Link href={legalLinks.personalDataConsent} target="_blank" className="text-steel-orange underline-offset-2 hover:underline">согласие на обработку персональных данных</Link> для рассмотрения заявки, связи со мной и подготовки расчёта. <b className="text-steel-orange">*</b></span>
      </label>
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-[11px] leading-relaxed text-white/48">
        <input name="marketingConsent" value="yes" type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#EA5B0C]" />
        <span>Я отдельно соглашаюсь получать рекламные и информационные сообщения по e-mail, телефону и в указанных мной мессенджерах. Это необязательно и не влияет на расчёт. <Link href={legalLinks.marketingConsent} target="_blank" className="text-steel-orange underline-offset-2 hover:underline">Условия и отзыв согласия</Link>.</span>
      </label>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-[11px] leading-relaxed text-white/40">Поля со звёздочкой обязательны. При отказе от согласия заявку через форму отправить нельзя — напишите нам на info@steelprodukt.ru.</p>
      <button disabled={isSending} type="submit" className="clip-corner shrink-0 bg-steel-orange px-8 py-4 text-xs font-bold uppercase transition hover:bg-orange-600 disabled:cursor-wait disabled:opacity-65">{isSending ? "Отправляем…" : "Получить расчёт →"}</button>
      </div>
    </div>
  </form>;
}

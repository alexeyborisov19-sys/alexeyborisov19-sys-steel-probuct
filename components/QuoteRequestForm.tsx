"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { createResettableOnce, trackLeadEvent } from "@/lib/analytics";
import { legalLinks } from "@/lib/legal";
import { siteConfig } from "@/lib/site";

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
type QuoteRequestFailure = Error & { code?: string };

function extensionOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".0", "")} МБ`;
}

function focusFormField(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLElement) field.focus();
}

export function QuoteRequestForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const formStartTracker = useRef<ReturnType<typeof createResettableOnce> | null>(null);
  if (!formStartTracker.current) {
    formStartTracker.current = createResettableOnce(() => {
      trackLeadEvent("quote_form_started", { form_location: "contacts" });
    });
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") !== "calculator-metallokassety") return;

    const area = params.get("area");
    const thickness = params.get("thickness");
    const quantity = Number(params.get("quantity") ?? "");
    const formatNumber = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);

    const summary = [
      "Прошу выполнить точный расчёт металлокассет по приложенным исходным данным.",
      area ? `Площадь фасада: ${area.replace(".", ",")} м².` : "",
      "Размер кассеты: 1170×545 мм. Руст: 20×20 мм.",
      thickness ? `Выбранная толщина металла: ${thickness} мм.` : "",
      Number.isFinite(quantity) && quantity > 0 ? `Ориентировочное количество по калькулятору: ≈ ${formatNumber(quantity)} шт.` : "",
      "Необходима проверка специалистом и итоговое коммерческое предложение.",
    ].filter(Boolean).join("\n");

    setMessage((current) => current || summary);
  }, []);

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
    formStartTracker.current?.fire();
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
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    if (!name) {
      setFeedback({ type: "error", message: "Укажите имя — это обязательное поле." });
      focusFormField(form, "name");
      return;
    }
    if (!phone && !email) {
      setFeedback({ type: "error", message: "Укажите телефон или электронную почту — достаточно одного способа связи." });
      return;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setFeedback({ type: "error", message: "Проверьте адрес электронной почты." });
      return;
    }
    if (formData.get("personalDataConsent") !== "yes") {
      setFeedback({ type: "error", message: "Для отправки заявки необходимо согласие на обработку персональных данных." });
      return;
    }
    formData.append("consentTimestamp", new Date().toISOString());
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
      const payload = await response.json() as { message?: string; requestId?: string; code?: string };
      if (!response.ok) {
        const failure = new Error(payload.message ?? "Не удалось отправить заявку.") as QuoteRequestFailure;
        failure.code = payload.code;
        throw failure;
      }

      form.reset();
      setFiles([]);
      formStartTracker.current?.reset();
      setMessage("");
      trackLeadEvent("quote_request_success", { form_location: "contacts", has_files: files.length > 0, files_count: files.length });
      setFeedback({
        type: "success",
        message: `${payload.message || "Заявка принята."}${payload.requestId ? ` Номер заявки: ${payload.requestId}.` : ""} Материалы переданы на проверку. Срок подготовки расчёта сообщим после проверки документации.`,
      });
    } catch (error) {
      trackLeadEvent("quote_request_error", {
        form_location: "contacts",
        error_code: error instanceof Error && "code" in error
          ? String((error as QuoteRequestFailure).code || "UNKNOWN_ERROR")
          : "NETWORK_ERROR",
      });
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
      <label className="text-sm font-semibold text-white">Компания
        <input name="company" className="mt-2 w-full border border-white/20 bg-black/20 p-4 text-sm font-normal outline-none transition placeholder:text-white/30 focus:border-steel-orange" placeholder="Название компании" autoComplete="organization" />
      </label>
    </div>

    <fieldset className="border border-white/15 bg-black/10 p-4 sm:p-5">
      <legend className="px-2 text-sm font-semibold text-white">
        Контакт для ответа <span className="text-steel-orange">*</span>
      </legend>
      <p id="quote-contact-rule" className="mb-4 border-l-2 border-steel-orange pl-3 text-xs leading-5 text-white/62">
        Телефон или электронная почта — заполните хотя бы одно поле.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-white">Телефон
          <input name="phone" aria-describedby="quote-contact-rule" className="mt-2 w-full border border-white/20 bg-black/20 p-4 text-sm font-normal outline-none transition placeholder:text-white/30 focus:border-steel-orange" placeholder="+7 ___ ___ __ __" type="tel" autoComplete="tel" />
        </label>
        <label className="text-sm font-semibold text-white">Электронная почта
          <input name="email" aria-describedby="quote-contact-rule" className="mt-2 w-full border border-white/20 bg-black/20 p-4 text-sm font-normal outline-none transition placeholder:text-white/30 focus:border-steel-orange" placeholder="name@company.ru" type="email" autoComplete="email" />
        </label>
      </div>
    </fieldset>

    <label className="text-sm font-semibold text-white">Задача
      <textarea name="message" value={message} onChange={(event) => setMessage(event.target.value)} className="mt-2 min-h-36 w-full resize-y border border-white/20 bg-black/20 p-4 text-sm font-normal outline-none transition placeholder:text-white/30 focus:border-steel-orange" placeholder="Что необходимо изготовить, в каком объёме и в какие сроки?" />
    </label>

    <div className="border border-white/15 bg-black/20 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Чертежи и техническая документация</p>
          <p className="mt-1 text-xs leading-relaxed text-white/50">До 10 файлов, суммарно до 10 МБ; каждый — до 7 МБ. Можно приложить чертежи, спецификации, визуализации и фотографии.</p>
        </div>
        <a href={`mailto:${siteConfig.email}`} className="shrink-0 text-xs font-bold text-steel-orange transition hover:text-orange-400">{siteConfig.email}&nbsp; ↗</a>
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

    {feedback ? <p role={feedback.type === "error" ? "alert" : "status"} className={`border px-4 py-3 text-sm ${feedback.type === "success" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-steel-orange/50 bg-steel-orange/10 text-orange-100"}`}>{feedback.message}</p> : null}

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
        <div className="max-w-xl">
          <p className="text-xs font-semibold leading-relaxed text-white/70">После отправки материалы поступят на инженерную и коммерческую проверку.</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/42">Срок подготовки расчёта сообщим после проверки документации. Поля со звёздочкой обязательны.</p>
        </div>
      <button disabled={isSending} type="submit" className="clip-corner shrink-0 bg-steel-orange px-8 py-4 text-xs font-bold uppercase transition hover:bg-orange-600 disabled:cursor-wait disabled:opacity-65">{isSending ? "Отправляем…" : "Получить расчёт →"}</button>
      </div>
    </div>
  </form>;
}

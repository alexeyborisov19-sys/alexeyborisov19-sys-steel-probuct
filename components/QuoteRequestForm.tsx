"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, FocusEvent, FormEvent, useEffect, useRef, useState } from "react";
import { createResettableOnce, trackLeadEvent } from "@/lib/analytics";
import { legalLinks } from "@/lib/legal";
import { siteConfig } from "@/lib/site";
import { basketBriefSummary } from "@/lib/quote/basket-brief";
import { cassetteHandoffSummary } from "@/lib/quote/cassette-handoff";

const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_FILE_BYTES = 7 * 1024 * 1024;
const acceptedExtensions = [
  "pdf", "dxf", "dwg", "dwt", "dws", "step", "stp", "iges", "igs",
  "sldprt", "sldasm", "ipt", "iam", "idw", "png", "jpg", "jpeg", "webp",
  "tif", "tiff", "doc", "docx", "xls", "xlsx", "zip", "rar", "7z",
];

const acceptedFiles = acceptedExtensions.map((extension) => `.${extension}`).join(",");

type Feedback = { type: "error" | "success"; message: string; requestId?: string } | null;
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
  const sendingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (feedback?.type === "success") feedbackRef.current?.focus();
  }, [feedback]);
  const [message, setMessage] = useState("");
  const [cadHandoff, setCadHandoff] = useState(false);
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
    const formatNumber = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);

    const basketBrief = basketBriefSummary(params);
    if (basketBrief) {
      setMessage((current) => current || basketBrief);
      return;
    }

    if (params.get("source") === "online-order") {
      setCadHandoff(true);
      // Handoff from the CAD calculator. Only the customer's own project scope
      // travels here; the calculation basis stays on the server.
      const parts = Number(params.get("parts") ?? "");
      const total = Number(params.get("total") ?? "");
      // Opaque calculation number. It lets the engineer open the calculation
      // this request came from instead of re-deriving it from the attachments.
      const calc = (params.get("calc") ?? "").trim().slice(0, 64);
      const summary = [
        "Прошу рассчитать изготовление по CAD-моделям из онлайн-калькулятора.",
        /^[A-Za-z0-9_-]+$/.test(calc) ? `Номер расчёта: ${calc}.` : "",
        Number.isFinite(parts) && parts > 0 ? `Позиций в проекте: ${formatNumber(parts)}.` : "",
        Number.isFinite(total) && total > 0
          ? `Предварительная оценка калькулятора: ≈ ${formatNumber(total)} ₽ с НДС.`
          : "",
        "Исходные CAD-файлы необходимо приложить к заявке отдельно.",
        "Необходима проверка инженером и итоговое коммерческое предложение.",
      ].filter(Boolean).join("\n");

      setMessage((current) => current || summary);
      return;
    }

    if (params.get("source") !== "calculator-metallokassety") return;

    const summary = cassetteHandoffSummary(params);

    setMessage((current) => current || summary);
  }, []);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";
    addFiles(incoming);
  }

  function addFiles(incoming: File[]) {
    if (sendingRef.current || !incoming.length) return;

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

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  function markFormStarted(event: FocusEvent<HTMLFormElement>) {
    // Re-enabling the submit button can restore focus after a successful send.
    // Count a new form start only when the visitor focuses an editable field.
    if (sendingRef.current || !(event.target instanceof HTMLElement) || !event.target.matches("input:not([name=website]), textarea, select")) return;
    formStartTracker.current?.fire();
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setFeedback(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingRef.current) return;
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
      focusFormField(form, "phone");
      return;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setFeedback({ type: "error", message: "Проверьте адрес электронной почты." });
      focusFormField(form, "email");
      return;
    }
    if (formData.get("personalDataConsent") !== "yes") {
      setFeedback({ type: "error", message: "Для отправки заявки необходимо согласие на обработку персональных данных." });
      focusFormField(form, "personalDataConsent");
      return;
    }
    formData.append("consentTimestamp", new Date().toISOString());
    files.forEach((file) => formData.append("files", file));
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      formData.append("pageUrl", url.href);
      formData.append("referrer", document.referrer);

      // Attribution is read only when the user submits the form after giving the
      // required personal-data consent. No advertising identifier is persisted
      // in cookies/localStorage merely for attribution.
      const attributionSources = [url];
      try {
        const referrerUrl = new URL(document.referrer);
        if (referrerUrl.origin === url.origin) attributionSources.push(referrerUrl);
      } catch {
        // External/empty referrers are intentionally ignored here.
      }
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "yclid", "gclid"].forEach((key) => {
        const value = attributionSources
          .map((source) => source.searchParams.get(key))
          .find((candidate) => Boolean(candidate));
        if (value) formData.append(key, value);
      });
    }

    sendingRef.current = true;
    setIsSending(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    trackLeadEvent("quote_request_submit", { form_location: "contacts", has_files: files.length > 0, files_count: files.length });
    try {
      const response = await fetch("/api/quote", { method: "POST", body: formData, signal: controller.signal });
      const payload = await response.json().catch(() => null) as { ok?: boolean; message?: string; requestId?: string; code?: string } | null;
      if (!payload || typeof payload.message !== "string") {
        throw new Error("Сервер не подтвердил приём заявки. Данные сохранены в форме; свяжитесь с нами или повторите отправку позже.");
      }
      if (!response.ok) {
        const failure = new Error(payload.message ?? "Не удалось отправить заявку.") as QuoteRequestFailure;
        failure.code = payload.code;
        throw failure;
      }

      if (payload.ok !== true || !/^SP-\d{8}-[A-F0-9]{8}$/.test(payload.requestId ?? "")) {
        throw new Error("Не получено подтверждение с номером заявки. Данные остались в форме; уточните получение у специалиста.");
      }
      form.reset();
      setFiles([]);
      formStartTracker.current?.reset();
      setMessage("");
      setCadHandoff(false);
      trackLeadEvent("quote_request_success", { form_location: "contacts", has_files: files.length > 0, files_count: files.length });
      setFeedback({
        type: "success",
        message: payload.message,
        requestId: payload.requestId,
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
        message: controller.signal.aborted
          ? "Не удалось дождаться подтверждения. Заявка могла поступить на сервер. Данные остались в форме — уточните получение у специалиста перед повторной отправкой."
          : error instanceof TypeError
            ? "Соединение прервалось, подтверждение не получено. Данные остались в форме. Проверьте связь и уточните получение заявки перед повторной отправкой."
            : error instanceof Error ? error.message : "Не удалось отправить заявку. Данные остались в форме.",
      });
    } finally {
      window.clearTimeout(timeout);
      sendingRef.current = false;
      setIsSending(false);
    }
  }

  return <form id="quote-request-form" name="quote-request-form" data-ym-form="quote-request" onSubmit={handleSubmit} onFocus={markFormStarted} className="ym-hide-content ym-disable-submit grid gap-6" aria-busy={isSending} noValidate>
    <fieldset disabled={isSending} className="grid min-w-0 gap-6 border-0 p-0">
    <legend className="sr-only">Данные заявки</legend>
    {cadHandoff && <div className="rounded-lg border border-steel-orange/40 bg-steel-orange/10 p-4 text-sm leading-6 text-white/85"><strong className="block text-white">Продолжение расчёта CAD</strong>Данные расчёта перенесены в поле «Задача». Исходные файлы автоматически не прикрепляются — добавьте их ниже, чтобы инженер мог проверить геометрию.</div>}
    <label className="sr-only" aria-hidden="true">Не заполняйте это поле<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold text-white">Имя *
        <input name="name" required className="mt-2 w-full border border-white/35 bg-black/20 p-4 text-sm font-normal outline-none transition placeholder:text-white/48 focus:border-steel-orange" placeholder="Как к вам обращаться" autoComplete="name" />
      </label>
      <label className="text-sm font-semibold text-white">Компания
        <input name="company" className="mt-2 w-full border border-white/35 bg-black/20 p-4 text-sm font-normal outline-none transition placeholder:text-white/48 focus:border-steel-orange" placeholder="Название компании" autoComplete="organization" />
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
          <input name="phone" aria-describedby="quote-contact-rule" className="mt-2 w-full border border-white/35 bg-black/20 p-4 text-sm font-normal outline-none transition placeholder:text-white/48 focus:border-steel-orange" placeholder="+7 ___ ___ __ __" type="tel" autoComplete="tel" />
        </label>
        <label className="text-sm font-semibold text-white">Электронная почта
          <input name="email" aria-describedby="quote-contact-rule" className="mt-2 w-full border border-white/35 bg-black/20 p-4 text-sm font-normal outline-none transition placeholder:text-white/48 focus:border-steel-orange" placeholder="name@company.ru" type="email" autoComplete="email" />
        </label>
      </div>
    </fieldset>

    <label className="text-sm font-semibold text-white">Задача
      <textarea name="message" value={message} onChange={(event) => setMessage(event.target.value)} className="mt-2 min-h-36 w-full resize-y border border-white/35 bg-black/20 p-4 text-sm font-normal outline-none transition placeholder:text-white/48 focus:border-steel-orange" placeholder="Что необходимо изготовить, в каком объёме и в какие сроки?" />
    </label>

    <div onDragEnter={(event) => { event.preventDefault(); dragDepth.current += 1; setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setIsDragging(false); }} onDrop={handleDrop} className={`rounded-lg border p-4 sm:p-5 ${isDragging ? "border-steel-orange bg-steel-orange/10" : "border-white/20 bg-black/20"}`} aria-label="Вложения к заявке">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Чертежи и техническая документация</p>
          <p className="mt-1 text-xs leading-relaxed text-white/70">До 10 файлов, суммарно до 10 МБ; каждый — до 7 МБ. Можно приложить чертежи, спецификации, визуализации и фотографии.</p>
        </div>
        <a href={`mailto:${siteConfig.email}`} className="shrink-0 text-xs font-bold text-steel-orange transition hover:text-orange-400">{siteConfig.email}&nbsp; ↗</a>
      </div>

      <label className="mt-5 flex cursor-pointer flex-col items-center justify-center border border-dashed border-white/25 bg-[#111519] px-5 py-8 text-center transition hover:border-steel-orange hover:bg-[#15191c] focus-within:outline focus-within:outline-2 focus-within:outline-steel-orange">
        <span className="grid h-10 w-10 place-items-center border border-steel-orange/60 text-xl text-steel-orange">＋</span>
        <span className="mt-3 text-sm font-semibold text-white">{isDragging ? "Отпустите файлы здесь" : "Выбрать файлы или перетащить сюда"}</span>
        <span className="mt-1 text-[13px] leading-relaxed text-white/70">PDF, DXF, DWG, STEP, изображения, Office-документы и архивы</span>
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
            <span className="ml-auto shrink-0 text-white/65">{formatSize(file.size)}</span>
            <button type="button" onClick={() => removeFile(index)} className="grid min-h-11 min-w-11 shrink-0 place-items-center text-xl text-white/75 transition hover:text-steel-orange" aria-label={`Удалить ${file.name}`}>×</button>
          </li>)}
        </ul>
        <p className="mt-3 text-[13px] text-white/40">Общий размер: {formatSize(totalSize)} из 10 МБ</p>
      </div> : null}
    </div>

    {feedback ? <div ref={feedbackRef} tabIndex={-1} role={feedback.type === "error" ? "alert" : "status"} className={`border px-4 py-3 text-sm ${feedback.type === "success" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-steel-orange/50 bg-steel-orange/10 text-orange-100"}`}><p className="font-semibold">{feedback.message}</p>{feedback.requestId ? <><p className="mt-3">Номер заявки: <strong className="break-all font-mono">{feedback.requestId}</strong></p><p className="mt-2 leading-relaxed">Сохраните номер для обращения к специалисту. Срок подготовки расчёта сообщим после проверки документации.</p></> : <p className="mt-3"><a className="underline underline-offset-4" href={`tel:${siteConfig.telephone}`}>Позвонить {siteConfig.telephoneDisplay}</a><span className="mx-2">·</span><a className="underline underline-offset-4" href={`mailto:${siteConfig.email}`}>Написать на почту</a></p>}</div> : null}

    <div className="border-t border-white/10 pt-6">
      <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-white/62">
        <input name="personalDataConsent" value="yes" type="checkbox" required aria-required="true" className="mt-0.5 h-4 w-4 shrink-0 accent-[#EA5B0C]" />
        <span>Я даю отдельное <Link href={legalLinks.personalDataConsent} target="_blank" className="text-steel-orange underline-offset-2 hover:underline">согласие на обработку персональных данных</Link> для рассмотрения заявки, связи со мной и подготовки расчёта. <b className="text-steel-orange">*</b></span>
      </label>
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-white/48">
        <input name="marketingConsent" value="yes" type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#EA5B0C]" />
        <span>Я отдельно соглашаюсь получать рекламные и информационные сообщения по e-mail, телефону и в указанных мной мессенджерах. Это необязательно и не влияет на расчёт. <Link href={legalLinks.marketingConsent} target="_blank" className="text-steel-orange underline-offset-2 hover:underline">Условия и отзыв согласия</Link>.</span>
      </label>
      <p className="mt-4 text-[13px] leading-relaxed text-white/48">
        Согласие на обработку данных и необязательное согласие на рекламу оформляются отдельными документами. С <Link href={legalLinks.privacy} target="_blank" className="text-steel-orange underline-offset-2 hover:underline">политикой обработки персональных данных</Link> можно ознакомиться до отправки.
      </p>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-semibold leading-relaxed text-white/70">После отправки материалы поступят на инженерную и коммерческую проверку.</p>
          <p className="mt-1 text-[13px] leading-relaxed text-white/42">Срок подготовки расчёта сообщим после проверки документации. Поля со звёздочкой обязательны.</p>
        </div>
      <button disabled={isSending} type="submit" className="clip-corner shrink-0 bg-steel-orange-deep px-8 py-4 text-xs font-bold uppercase transition hover:bg-steel-orange-deeper disabled:cursor-wait disabled:opacity-65">{isSending ? "Отправляем…" : "Отправить заявку →"}</button>
      </div>
    </div>
    </fieldset>
  </form>;
}

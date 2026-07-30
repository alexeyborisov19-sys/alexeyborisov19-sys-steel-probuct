"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { trackLeadEvent } from "@/lib/analytics";
import { legalLinks } from "@/lib/legal";

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatMessage = AssistantMessage & { id: string };
type AssistantResponse = {
  answer?: string;
  message?: string;
  mode?: "ai" | "knowledge";
  sessionId?: string;
  suggestions?: string[];
};

const initialMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Опишите изделие или производственную задачу. Я уточню исходные данные и подготовлю технически корректную заявку.",
};

const acceptedFiles = [
  ".pdf", ".dxf", ".dwg", ".dwt", ".dws", ".step", ".stp", ".iges", ".igs",
  ".sldprt", ".sldasm", ".ipt", ".iam", ".idw", ".png", ".jpg", ".jpeg",
  ".webp", ".tif", ".tiff", ".doc", ".docx", ".xls", ".xlsx", ".zip", ".rar", ".7z",
].join(",");

const assistantQuickQuestions = [
  "Рассчитать изделие",
  "Возможности производства",
  "Подготовка чертежа",
  "Порошковая окраска",
] as const;

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".0", "")} МБ`;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function EngineerBrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={[
        "relative isolate block shrink-0",
        compact ? "h-9 w-[58px]" : "h-11 w-[66px]",
      ].join(" ")}
      aria-hidden="true"
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_45%_50%,rgba(234,91,12,.13),transparent_68%)] blur-[5px]" />
      <span className={compact
        ? "absolute left-0 top-1/2 h-[27px] w-[52px] -translate-y-1/2 overflow-hidden"
        : "absolute left-0 top-1/2 h-[31px] w-[60px] -translate-y-1/2 overflow-hidden"
      }>
        <img
          src="/logo/steel-product.png"
          alt=""
          width={1851}
          height={402}
          loading="lazy"
          decoding="async"
          className={compact
            ? "absolute left-0 top-0 h-[27px] w-auto max-w-none drop-shadow-[0_0_7px_rgba(234,91,12,.22)]"
            : "absolute left-0 top-0 h-[31px] w-auto max-w-none drop-shadow-[0_0_8px_rgba(234,91,12,.25)]"
          }
        />
      </span>
      <motion.span
        className="absolute bottom-0 left-0 h-px bg-[linear-gradient(90deg,#ea5b0c,rgba(234,91,12,.08))] shadow-[0_0_6px_rgba(234,91,12,.45)]"
        initial={{ width: "22%" }}
        animate={{ width: ["22%", "78%", "22%"] }}
        transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2.8, ease: "easeInOut" }}
      />
    </span>
  );
}

export function EngineeringAssistant({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([...assistantQuickQuestions]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [leadFeedback, setLeadFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [completedRequestId, setCompletedRequestId] = useState<string | null>(null);
  const messageEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, leadFormOpen, open]);

  useEffect(() => {
    if (open && !leadFormOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 180);
    }
  }, [open, leadFormOpen]);

  function toggleAssistant() {
    setOpen((current) => {
      const next = !current;
      if (next) trackLeadEvent("assistant_opened", { assistant: "engineering" });
      return next;
    });
  }

  function returnToAssistantHome() {
    setMessages([initialMessage]);
    setSuggestions([...assistantQuickQuestions]);
    setInput("");
    setLoading(false);
    setLeadFormOpen(false);
    setFiles([]);
    setLeadFeedback(null);
    setCompletedRequestId(null);
    setSessionId(null);
    window.setTimeout(() => inputRef.current?.focus(), 120);
  }

  async function sendQuestion(question: string) {
    const content = question.trim();
    if (!content || loading) return;
    const userMessage: ChatMessage = { id: makeId(), role: "user", content };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);
    setSuggestions([]);
    trackLeadEvent("assistant_question", { assistant: "engineering" });

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          sessionId,
        }),
      });
      const payload = await response.json() as AssistantResponse;
      if (!response.ok) throw new Error(payload.message || "Не удалось получить ответ.");
      if (payload.sessionId) setSessionId(payload.sessionId);
      setMessages((current) => [...current, {
        id: makeId(),
        role: "assistant",
        content: payload.answer || "Уточните задачу, пожалуйста.",
      }]);
      setSuggestions(payload.suggestions ?? []);
    } catch (error) {
      setMessages((current) => [...current, {
        id: makeId(),
        role: "assistant",
        content: error instanceof Error
          ? `${error.message} Можно сразу передать задачу инженеру.`
          : "Не удалось получить ответ. Передайте задачу инженеру.",
      }]);
      setSuggestions(["Передать задачу инженеру", "Попробовать ещё раз"]);
    } finally {
      setLoading(false);
    }
  }

  function handleSuggestion(suggestion: string) {
    if (/передать|заявк/i.test(suggestion)) {
      setLeadFormOpen(true);
      trackLeadEvent("assistant_lead_form_opened", { assistant: "engineering" });
      return;
    }
    void sendQuestion(suggestion);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendQuestion(input);
    }
  }

  function handleLeadFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";
    const next = [...files, ...incoming].filter((file, index, list) =>
      list.findIndex((item) =>
        item.name === file.name
        && item.size === file.size
        && item.lastModified === file.lastModified,
      ) === index,
    );
    if (next.length > 8) {
      setLeadFeedback({ type: "error", text: "Можно приложить не более 8 файлов." });
      return;
    }
    if (next.some((file) => file.size > 7 * 1024 * 1024)) {
      setLeadFeedback({ type: "error", text: "Размер одного файла не должен превышать 7 МБ." });
      return;
    }
    if (next.reduce((sum, file) => sum + file.size, 0) > 10 * 1024 * 1024) {
      setLeadFeedback({ type: "error", text: "Общий размер файлов не должен превышать 10 МБ." });
      return;
    }
    setFiles(next);
    setLeadFeedback(null);
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    if (!phone && !email) {
      setLeadFeedback({ type: "error", text: "Укажите телефон или e-mail — достаточно одного способа связи." });
      return;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setLeadFeedback({ type: "error", text: "Проверьте адрес электронной почты." });
      return;
    }
    if (formData.get("personalDataConsent") !== "yes") {
      setLeadFeedback({ type: "error", text: "Подтвердите согласие на обработку персональных данных." });
      return;
    }
    if (sessionId) formData.set("sessionId", sessionId);
    formData.set("consentTimestamp", new Date().toISOString());
    if (typeof window !== "undefined") formData.set("pageUrl", window.location.href);
    files.forEach((file) => formData.append("files", file));
    setSubmittingLead(true);
    setLeadFeedback(null);
    trackLeadEvent("assistant_lead_submit", { files_count: files.length });

    try {
      const response = await fetch("/api/assistant/lead", { method: "POST", body: formData });
      const payload = await response.json() as { message?: string; requestId?: string };
      if (!response.ok) throw new Error(payload.message || "Не удалось передать заявку.");
      const requestId = payload.requestId || "принята";
      setCompletedRequestId(requestId);
      setFiles([]);
      form.reset();
      setLeadFeedback({
        type: "success",
        text: `Заявка ${requestId} зарегистрирована. Специалист свяжется с вами после проверки задачи.`,
      });
      trackLeadEvent("assistant_lead_success", { files_count: files.length });
    } catch (error) {
      setLeadFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Не удалось передать заявку.",
      });
      trackLeadEvent("assistant_lead_error");
    } finally {
      setSubmittingLead(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-4 z-[85] sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {open ? (
          <motion.section
            key="assistant-panel"
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="assistant-panel absolute bottom-[74px] right-0 flex h-[min(720px,calc(100dvh-110px))] w-[min(430px,calc(100vw-32px))] flex-col overflow-hidden border border-white/15 bg-[#0b0e10]/[.985] shadow-[0_28px_90px_rgba(0,0,0,.72)] backdrop-blur-xl"
            role="dialog"
            aria-label="Инженерный помощник Сталь Продукт"
          >
            <header className="relative flex items-center gap-3 border-b border-white/10 bg-[linear-gradient(105deg,rgba(234,91,12,.17),rgba(15,18,20,.96)_52%)] px-4 py-4">
              <EngineerBrandMark />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">ИИ-инженер</p>
                <h2 className="truncate text-sm font-semibold text-white">Помощник «Сталь Продукт»</h2>
                <p className="mt-0.5 text-[10px] text-white/45">Технологии · изделия · подготовка заявки</p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={returnToAssistantHome}
                  className="grid h-9 w-9 place-items-center border border-white/10 text-white/55 transition hover:border-steel-orange hover:text-white"
                  aria-label="На главную ИИ-помощника"
                  title="Начать заново"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path d="M4 11.2 12 4l8 7.2v8.3h-5.2v-5.4H9.2v5.4H4Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-9 w-9 place-items-center border border-white/10 text-xl text-white/55 transition hover:border-steel-orange hover:text-white"
                  aria-label="Закрыть помощника"
                >
                  ×
                </button>
              </div>
            </header>

            {!leadFormOpen ? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="mb-4 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.13em] text-white/35">
                    <span className="h-px flex-1 bg-white/10" />
                    Техническое сопровождение
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                      >
                        <div className={message.role === "user"
                          ? "max-w-[88%] border border-steel-orange/45 bg-steel-orange/12 px-4 py-3 text-sm leading-relaxed text-white"
                          : "max-w-[92%] border-l-2 border-steel-orange bg-[#15191c] px-4 py-3 text-sm leading-relaxed text-white/78"
                        }>
                          <p className="whitespace-pre-line">{message.content}</p>
                        </div>
                      </motion.div>
                    ))}
                    {loading ? (
                      <div className="flex justify-start">
                        <div className="flex items-center gap-1 border-l-2 border-steel-orange bg-[#15191c] px-4 py-4" aria-label="Формируется ответ">
                          {[0, 1, 2].map((index) => (
                            <motion.span
                              key={index}
                              className="h-1.5 w-1.5 rounded-full bg-steel-orange"
                              animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                              transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.13 }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {suggestions.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleSuggestion(suggestion)}
                          className="border border-white/15 bg-[#111519] px-3 py-2 text-left text-[10px] font-semibold leading-snug text-white/67 transition hover:border-steel-orange hover:text-white"
                        >
                          {suggestion}&nbsp; →
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div ref={messageEnd} />
                </div>

                <div className="border-t border-white/10 bg-[#101315] p-3">
                  <div className="flex items-end gap-2 border border-white/15 bg-black/20 p-2 focus-within:border-steel-orange/70">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(event) => setInput(event.target.value.slice(0, 1400))}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      placeholder="Опишите задачу или задайте вопрос"
                      className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/28"
                    />
                    <button
                      type="button"
                      disabled={!input.trim() || loading}
                      onClick={() => void sendQuestion(input)}
                      className="grid h-10 w-10 shrink-0 place-items-center bg-steel-orange text-lg font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Отправить вопрос"
                    >
                      ↑
                    </button>
                  </div>
                  <p className="mt-2 text-[9px] leading-4 text-white/35">
                    Не указывайте в диалоге контакты и персональные данные. Чертежи передавайте только через защищённую форму. Подробнее — в <Link href={legalLinks.services} className="text-white/55 hover:text-steel-orange">описании сервисов</Link>.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLeadFormOpen(true);
                      trackLeadEvent("assistant_lead_form_opened", { assistant: "engineering" });
                    }}
                    className="mt-2 w-full border border-steel-orange/45 px-4 py-3 text-[10px] font-bold uppercase tracking-[.08em] text-steel-orange transition hover:bg-steel-orange hover:text-white"
                  >
                    Передать задачу инженеру&nbsp; →
                  </button>
                </div>
              </>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <button
                  type="button"
                  onClick={() => setLeadFormOpen(false)}
                  className="text-[10px] font-bold uppercase tracking-[.08em] text-white/50 transition hover:text-steel-orange"
                >
                  ← Вернуться в диалог
                </button>
                <div className="mt-5 border-l-2 border-steel-orange pl-4">
                  <p className="text-[10px] font-bold uppercase tracking-[.15em] text-steel-orange">Передача инженеру</p>
                  <h3 className="mt-2 text-xl font-semibold">Контакты и исходные данные</h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/48">Диалог будет приложен к заявке как техническая сводка.</p>
                </div>

                {completedRequestId ? (
                  <div className="mt-6 border border-emerald-400/35 bg-emerald-400/10 p-5">
                    <p className="text-sm font-semibold text-emerald-100">Заявка зарегистрирована</p>
                    <p className="mt-2 text-xs text-emerald-100/70">Номер: {completedRequestId}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCompletedRequestId(null);
                        setLeadFeedback(null);
                        setLeadFormOpen(false);
                      }}
                      className="mt-5 border border-emerald-300/30 px-4 py-3 text-[10px] font-bold uppercase text-emerald-100"
                    >
                      Вернуться к помощнику
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submitLead} className="mt-6 space-y-4">
                    <label className="sr-only" aria-hidden="true">
                      Не заполняйте это поле
                      <input name="website" tabIndex={-1} autoComplete="off" />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-[10px] font-bold uppercase tracking-[.06em] text-white/65">
                        Имя *
                        <input
                          name="name"
                          required
                          autoComplete="name"
                          className="mt-2 w-full border border-white/15 bg-black/20 p-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-steel-orange"
                        />
                      </label>
                      <label className="text-[10px] font-bold uppercase tracking-[.06em] text-white/65">
                        Телефон
                        <input
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                          placeholder="+7 ___ ___ __ __"
                          className="mt-2 w-full border border-white/15 bg-black/20 p-3 text-sm font-normal normal-case tracking-normal text-white outline-none placeholder:text-white/25 focus:border-steel-orange"
                        />
                      </label>
                      <label className="text-[10px] font-bold uppercase tracking-[.06em] text-white/65">
                        E-mail
                        <input
                          name="email"
                          type="email"
                          autoComplete="email"
                          className="mt-2 w-full border border-white/15 bg-black/20 p-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-steel-orange"
                        />
                      </label>
                      <label className="text-[10px] font-bold uppercase tracking-[.06em] text-white/65">
                        Компания
                        <input
                          name="company"
                          autoComplete="organization"
                          className="mt-2 w-full border border-white/15 bg-black/20 p-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-steel-orange"
                        />
                      </label>
                    </div>
                    <p className="border-l-2 border-steel-orange pl-3 text-[10px] leading-5 text-white/52">
                      Телефон или e-mail — заполните хотя бы одно поле.
                    </p>

                    <div className="border border-white/12 bg-[#111519] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold">Чертежи и спецификации</p>
                          <p className="mt-1 text-[10px] leading-relaxed text-white/40">До 8 файлов, суммарно до 10 МБ.</p>
                        </div>
                        <label className="cursor-pointer border border-steel-orange/50 px-3 py-2 text-[9px] font-bold uppercase text-steel-orange transition hover:bg-steel-orange hover:text-white">
                          Добавить
                          <input type="file" multiple accept={acceptedFiles} onChange={handleLeadFiles} className="sr-only" />
                        </label>
                      </div>
                      {files.length ? (
                        <ul className="mt-3 space-y-2 border-t border-white/10 pt-3">
                          {files.map((file, index) => (
                            <li key={`${file.name}-${file.lastModified}`} className="flex items-center gap-2 text-[10px] text-white/60">
                              <span className="min-w-0 flex-1 truncate">{file.name}</span>
                              <span className="shrink-0 text-white/35">{formatFileSize(file.size)}</span>
                              <button
                                type="button"
                                onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                                className="shrink-0 text-base leading-none text-white/40 hover:text-steel-orange"
                                aria-label={`Удалить ${file.name}`}
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 text-[10px] leading-relaxed text-white/55">
                      <input
                        name="personalDataConsent"
                        value="yes"
                        type="checkbox"
                        required
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#EA5B0C]"
                      />
                      <span>
                        Я даю <Link href={legalLinks.personalDataConsent} target="_blank" className="text-steel-orange hover:underline">согласие на обработку персональных данных</Link> для рассмотрения заявки и связи со мной. Ознакомлен с <Link href={legalLinks.privacy} target="_blank" className="text-steel-orange hover:underline">политикой обработки данных</Link>.
                      </span>
                    </label>

                    {leadFeedback ? (
                      <p className={`border px-3 py-3 text-xs leading-relaxed ${
                        leadFeedback.type === "success"
                          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                          : "border-steel-orange/50 bg-steel-orange/10 text-orange-100"
                      }`}>
                        {leadFeedback.text}
                      </p>
                    ) : null}

                    <p className="text-[10px] leading-5 text-white/48">
                      Подтвердим получение материалов в течение рабочего дня. Срок подготовки расчёта сообщим после проверки документации.
                    </p>

                    <button
                      type="submit"
                      disabled={submittingLead}
                      className="clip-corner w-full bg-steel-orange px-5 py-4 text-[10px] font-bold uppercase tracking-[.08em] text-white transition hover:bg-orange-600 disabled:cursor-wait disabled:opacity-55"
                    >
                      {submittingLead ? "Регистрируем заявку…" : "Передать инженеру →"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </motion.section>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={toggleAssistant}
        whileHover={{ scale: 1.025 }}
        whileTap={{ scale: 0.97 }}
        className="assistant-launcher group flex h-[58px] items-center gap-3 border border-steel-orange/65 bg-[#111519] pl-3 pr-4 shadow-[0_14px_50px_rgba(0,0,0,.58),0_0_26px_rgba(234,91,12,.16)]"
        aria-expanded={open}
        aria-label={open ? "Закрыть инженерного помощника" : "Открыть инженерного помощника"}
      >
        <EngineerBrandMark compact />
        <span className="text-left">
          <b className="block text-[10px] uppercase tracking-[.1em] text-white">ИИ-инженер</b>
          <span className="mt-0.5 block text-[9px] text-white/45">Задать технический вопрос</span>
        </span>
      </motion.button>
    </div>
  );
}

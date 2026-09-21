"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import { getAssistantPageContext } from "@/data/assistant-page-context";
import { trackLeadEvent } from "@/lib/analytics";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };
type AssistantResponse = { answer?: string; message?: string; sessionId?: string; suggestions?: string[] };

const CALCULATION_INTENT = /рассчита|расч[её]т|посчита|цен[ауы]|стоимост|калькулятор|черт[её]ж|dxf|step|stp|dwg/i;

function id() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function BrandMark() {
  return (
    <span className="relative block h-10 w-[62px] shrink-0" aria-hidden="true">
      <img
        src="/logo/steel-product-mark.png"
        alt=""
        width={740}
        height={402}
        loading="lazy"
        decoding="async"
        className="absolute left-0 top-1/2 h-[32px] w-[60px] -translate-y-1/2 object-contain"
      />
    </span>
  );
}

export function NavigationAssistant({ initialOpen = false }: { initialOpen?: boolean }) {
  const pathname = usePathname();
  const pageContext = getAssistantPageContext(pathname);
  const [open, setOpen] = useState(initialOpen);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: "Здравствуйте. Помогу сориентироваться по сайту, расскажу о возможностях производства и подскажу, куда перейти для расчёта заказа." },
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading, open]);

  function addAssistant(content: string) {
    setMessages((current) => [...current, { id: id(), role: "assistant", content }]);
  }

  async function sendQuestion(raw: string) {
    const question = raw.trim();
    if (!question || loading) return;

    setMessages((current) => [...current, { id: id(), role: "user", content: question }]);
    setInput("");
    trackLeadEvent("assistant_question", { assistant: "navigation", page_context: pageContext.id });

    if (CALCULATION_INTENT.test(question)) {
      addAssistant("Для расчёта лучше открыть полноценный CAD-калькулятор. Там можно загрузить DXF, STEP, STP или DWG, проверить геометрию, задать материал, количество и операции.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, sessionId, pathname }),
      });
      const payload = await response.json() as AssistantResponse;
      if (!response.ok) throw new Error(payload.message || "Не удалось получить ответ.");
      if (payload.sessionId) setSessionId(payload.sessionId);
      addAssistant(payload.answer || "Уточните вопрос, пожалуйста.");
    } catch {
      addAssistant("Сейчас не удалось получить справочный ответ. Можно перейти к разделам производства или сразу открыть расчёт заказа.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendQuestion(input);
    }
  }

  return (
    <div className="fixed bottom-5 right-4 z-[85] sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {open ? (
          <motion.section
            key="navigation-assistant"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-[72px] right-0 flex h-[min(620px,calc(100dvh-108px))] w-[min(390px,calc(100vw-28px))] flex-col overflow-hidden border border-white/15 bg-[#0b0e10]/[.985] shadow-[0_28px_80px_rgba(0,0,0,.72)] backdrop-blur-xl"
            role="dialog"
            aria-label="Помощник Сталь Продукт"
          >
            <header className="flex items-center gap-3 border-b border-white/10 bg-[linear-gradient(105deg,rgba(234,91,12,.14),rgba(15,18,20,.96)_58%)] px-4 py-4">
              <BrandMark />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-steel-orange">Помощник</p>
                <h2 className="mt-1 truncate text-sm font-semibold text-white">Сталь Продукт</h2>
                <p className="mt-1 truncate text-[11px] text-white/40">{pageContext.label}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center border border-white/10 text-xl text-white/55 transition hover:border-steel-orange hover:text-white" aria-label="Закрыть">×</button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className={message.role === "user"
                      ? "max-w-[88%] border border-steel-orange/35 bg-steel-orange/10 px-4 py-3 text-sm leading-6 text-white"
                      : "max-w-[92%] border-l-2 border-steel-orange bg-[#15191c] px-4 py-3 text-sm leading-6 text-white/78"
                    }>
                      <p className="whitespace-pre-line">{message.content}</p>
                    </div>
                  </div>
                ))}
                {loading ? (
                  <div className="flex justify-start">
                    <div className="border-l-2 border-steel-orange bg-[#15191c] px-4 py-3 text-xs text-white/45">Ищу ответ…</div>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 grid gap-2">
                <Link href="/online-order" onClick={() => trackLeadEvent("assistant_calculator_opened", { assistant: "navigation" })} className="clip-corner bg-steel-orange px-4 py-3 text-center text-xs font-bold uppercase tracking-[.08em] text-black transition hover:bg-white">
                  Рассчитать заказ →
                </Link>
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/production" className="border border-white/14 bg-[#111519] px-3 py-3 text-center text-[11px] font-semibold uppercase text-white/70 transition hover:border-steel-orange hover:text-white">Производство</Link>
                  <Link href="/company" className="border border-white/14 bg-[#111519] px-3 py-3 text-center text-[11px] font-semibold uppercase text-white/70 transition hover:border-steel-orange hover:text-white">О компании</Link>
                </div>
                <Link href="/contacts#contact-form" className="border border-white/14 bg-[#111519] px-3 py-3 text-center text-[11px] font-semibold uppercase text-white/70 transition hover:border-steel-orange hover:text-white">Связаться с инженером</Link>
              </div>
              <div ref={endRef} />
            </div>

            <div className="border-t border-white/10 bg-[#101315] p-3">
              <div className="flex items-end gap-2 border border-white/15 bg-black/20 p-2 focus-within:border-steel-orange/70">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value.slice(0, 1000))}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder="Спросите о компании или возможностях"
                  className="max-h-24 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/28"
                />
                <button type="button" disabled={loading || !input.trim()} onClick={() => void sendQuestion(input)} className="grid h-11 w-11 shrink-0 place-items-center bg-steel-orange text-lg font-bold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25" aria-label="Отправить">→</button>
              </div>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          trackLeadEvent("assistant_opened", { assistant: "navigation" });
        }}
        className="assistant-launcher group flex h-[58px] items-center gap-0 border border-steel-orange/65 bg-[#111519] px-1.5 shadow-[0_14px_50px_rgba(0,0,0,.58),0_0_26px_rgba(234,91,12,.16)] transition hover:scale-[1.025] sm:gap-3 sm:pl-3 sm:pr-4"
        aria-label="Открыть помощника"
      >
        <BrandMark />
        <span className="hidden min-w-[142px] whitespace-nowrap text-left sm:block">
          <b className="block text-xs leading-none uppercase tracking-[.1em] text-white">Помощник</b>
          <span className="mt-1 block text-xs leading-none text-white/45">Навигация и вопросы</span>
        </span>
      </button>
    </div>
  );
}

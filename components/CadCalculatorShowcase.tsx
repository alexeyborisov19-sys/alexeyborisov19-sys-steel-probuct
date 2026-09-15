"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

const STEPS = [
  {
    title: "Загрузите файл",
    text: "DXF, STEP или STP. Можно загрузить несколько деталей одновременно.",
  },
  {
    title: "Автоматический анализ",
    text: "Система определит габариты, площадь, длину реза, количество врезок, толщину и гибы.",
  },
  {
    title: "Получите стоимость",
    text: "Выберите материал, количество и обработку — система рассчитает предварительную стоимость изготовления.",
  },
] as const;

const FORMATS = ["DXF", "STEP", "STP"] as const;

/**
 * Homepage entry point for the CAD calculator. It shows the mechanism rather
 * than advertising it: three steps, one line of motion, one link. The section
 * is meant to be noticed on the way past, not to interrupt.
 */
export function CadCalculatorShowcase() {
  const reduceMotion = useReducedMotion();

  const appear = (index: number) => ({
    initial: reduceMotion ? undefined : { opacity: 0, y: 14 },
    whileInView: reduceMotion ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.4 },
    transition: { duration: 0.45, delay: index * 0.09, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <section aria-labelledby="cad-calculator-title" className="border-y border-white/10 bg-[#101112] py-12 sm:py-14">
      <div className="container">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-steel-orange">
              Онлайн-расчёт по CAD-файлу
            </p>
            <h2 id="cad-calculator-title" className="mt-3 text-2xl font-semibold uppercase leading-tight sm:text-3xl">
              Загрузите модель — система сама определит геометрию
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-white/55">
              Система считывает параметры детали напрямую из чертежа и формирует предварительный расчёт стоимости.
            </p>
          </div>
          <Link
            href="/online-order"
            className="clip-corner inline-block whitespace-nowrap bg-steel-orange-deep px-6 py-4 text-[13px] font-bold uppercase transition hover:bg-steel-orange-deeper"
          >
            Открыть онлайн-расчёт&nbsp; →
          </Link>
        </div>

        <ol className="mt-8 grid gap-3 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <motion.li
              key={step.title}
              {...appear(index)}
              className="group relative overflow-hidden border border-white/10 bg-[#111519] p-5 transition-colors hover:border-steel-orange/45"
            >
              {/* A single quiet line that sweeps once, like a part passing the head. */}
              {!reduceMotion && (
                <motion.span
                  aria-hidden="true"
                  initial={{ x: "-100%" }}
                  whileInView={{ x: "100%" }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 1.1, delay: 0.25 + index * 0.09, ease: "easeInOut" }}
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-steel-orange/10 to-transparent"
                />
              )}
              <span className="font-mono text-xs font-bold text-steel-orange">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 text-sm font-semibold uppercase leading-snug">{step.title}</h3>
              <p className="mt-3 text-[13px] leading-relaxed text-white/55">{step.text}</p>
            </motion.li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-[.12em] text-white/35">
          <span>Форматы</span>
          {FORMATS.map((format) => (
            <span key={format} className="border border-white/12 px-2.5 py-1 text-white/55">{format}</span>
          ))}
          <span className="text-white/30">DWG — после проверки инженером</span>
        </div>
      </div>
    </section>
  );
}

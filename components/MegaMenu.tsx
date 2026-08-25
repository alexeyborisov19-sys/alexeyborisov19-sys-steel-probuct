"use client";

import Link from "next/link";
import { useState } from "react";
import { solutions } from "@/data/solutions";

const productLinks: Record<string, string> = {
  Металлокассеты: "/products/metallokassety",
  "Доборные элементы": "/products/dobornye-elementy",
  "Декоративные панели": "/contacts#contact-form",
  Аквилоны: "/products/akvilon",
  "Откосы для окон": "/products/otkosy-dlya-okon",
  "Парапетные крышки": "/products/parapetnye-kryshki",
  "Отливы для окон": "/products/otlivy-dlya-okon",
  "Пожарные отсечки": "/products/pozharnye-otsechki",
};

const quickLinks = [
  { label: "Вся продукция", href: "/products" },
  { label: "Производство", href: "/production" },
  { label: "Калькулятор металлокассет", href: "/calculator-metallokassety" },
] as const;

export function MegaMenu({ onClose }: { onClose: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = solutions[activeIndex];
  const isArchitecture = activeIndex === 0;
  const activeHref = active.href;
  return (
    <div className="container absolute left-1/2 top-full z-50 w-full -translate-x-1/2 pt-3">
      <section
        id="solutions-mega-menu"
        aria-label="Раздел решений"
        onMouseLeave={onClose}
        className="overflow-hidden rounded-md border border-white/15 bg-[#111417]/[.98] shadow-2xl shadow-black/70"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-5">
          <nav aria-label="Быстрые переходы" className="flex flex-wrap gap-2">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="border border-white/15 bg-black/25 px-4 py-3 text-xs font-bold uppercase text-white/75 transition hover:border-steel-orange hover:text-steel-orange"
              >
                {item.label}&nbsp; →
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-7 lg:flex">
            <span className="border-r border-white/10 pr-7">
              <b className="text-2xl text-steel-orange">70+</b>
              <small className="ml-2 text-xs text-white/65">специалистов</small>
            </span>
            <span>
              <b className="text-2xl text-steel-orange">2000 м²</b>
              <small className="ml-2 text-xs text-white/65">производства</small>
            </span>
          </div>
        </div>
        <div className="grid min-h-[450px] grid-cols-[.9fr_1.35fr_1.05fr]">
          <nav className="border-r border-white/10 py-2" aria-label="Категории решений">
            {solutions.map((solution, index) => (
              <button
                type="button"
                key={solution.title}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onClick={() => setActiveIndex(index)}
                aria-current={index === activeIndex ? "true" : undefined}
                className={`flex w-full items-center justify-between border-l-2 px-6 py-5 text-left text-base font-semibold uppercase leading-tight transition ${index === activeIndex ? "border-steel-orange bg-white/[.03] text-steel-orange" : "border-transparent text-white hover:bg-white/[.03]"}`}
              >
                <span>{solution.shortTitle}</span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </nav>
          <article className="border-r border-white/10 p-5">
            <div
              className={`solution-media aspect-video border border-white/10 bg-black/30 ${active.imageClassName ?? ""}`}
              style={{ backgroundImage: `url('${active.image}')` }}
              aria-hidden="true"
            />
            <h2 className="mt-5 flex items-center gap-3 text-2xl font-semibold">
              <span className="text-steel-orange" aria-hidden="true">{active.icon}</span>
              {active.title}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/60">
              {active.text}
            </p>
            <Link
              onClick={onClose}
              href={activeHref}
              className="mt-5 inline-block border border-steel-orange px-4 py-3 text-xs font-bold uppercase text-steel-orange"
            >
              Перейти в раздел&nbsp; →
            </Link>
            {isArchitecture && (
              <a
                href="/documents/katalog-fasadnyh-resheniy-stal-produkt.pdf"
                target="_blank"
                rel="noreferrer"
                className="ml-4 mt-5 inline-block text-xs font-bold uppercase text-white/50 transition hover:text-steel-orange"
              >
                PDF-каталог ↗
              </a>
            )}
          </article>
          <aside className="max-h-[510px] overflow-y-auto p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
              {activeIndex === 4
                ? "Что мы можем для вас"
                : "Популярная продукция"}
            </p>
            <ul className="mt-4">
              {active.items.map((item) => (
                <li
                  key={item}
                  className="border-b border-white/10 text-sm text-white/85"
                >
                  <Link
                    href={
                      isArchitecture
                        ? (productLinks[item] ?? "/products")
                        : activeHref
                    }
                    onClick={onClose}
                    className="flex items-center justify-between py-3 transition hover:text-steel-orange"
                  >
                    <span>{item}</span>
                    <span className="text-steel-orange" aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
        <div className="flex items-center justify-between gap-6 border-t border-white/10 bg-black/25 px-7 py-5">
          <div>
            <b className="text-lg">Не нашли нужное изделие?</b>
            <p className="mt-1 text-sm text-white/55">
              Изготавливаем нестандартные детали и сборочные единицы по вашим
              чертежам, 3D-моделям и техническому заданию.
            </p>
          </div>
          <Link
            onClick={onClose}
            href="/contacts#contact-form"
            className="clip-corner whitespace-nowrap bg-steel-orange px-8 py-4 text-sm font-bold"
          >
            Получить расчёт&nbsp; →
          </Link>
        </div>
      </section>
    </div>
  );
}

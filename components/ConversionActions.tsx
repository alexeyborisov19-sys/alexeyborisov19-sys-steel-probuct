"use client";

import Link from "next/link";
import { trackLeadEvent } from "@/lib/analytics";

const actions = [
  {
    eyebrow: "01 · Для архитектора и закупщика",
    title: "Каталог фасадных решений",
    text: "Откройте компактный каталог: металлокассеты, парапетные крышки, откосы, отливы и доборные элементы.",
    href: "/documents/katalog-fasadnyh-resheniy-kratkij-4-stranicy.pdf",
    label: "Скачать PDF-каталог",
    external: true,
    event: "catalog_download",
  },
  {
    eyebrow: "02 · Для инженерной задачи",
    title: "Передать чертёж на разбор",
    text: "Принимаем DXF, DWG, STEP, PDF и спецификации. Уточним исходные данные и предложим следующий шаг по проекту.",
    href: "#contact-form",
    label: "Прикрепить файлы",
    external: false,
    event: "quote_files_cta_click",
  },
  {
    eyebrow: "03 · Если удобнее обсудить",
    title: "Написать в инженерный отдел",
    text: "Опишите задачу в письме или приложите материалы — это удобно для предварительной оценки нестандартного изделия.",
    href: "mailto:info@steelprodukt.ru?subject=Запрос%20на%20инженерное%20решение",
    label: "info@steelprodukt.ru",
    external: true,
    event: "email_click",
  },
] as const;

export function ConversionActions() {
  return <section aria-labelledby="conversion-actions-title" className="border-y border-white/10 bg-[#0d1012] py-10 sm:py-12">
    <div className="container">
      <div className="max-w-3xl">
        <p className="eyebrow">Полезные материалы и быстрый старт</p>
        <h2 id="conversion-actions-title" className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">Получите нужную информацию без лишних шагов</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">Каталог можно открыть сразу, а исходные данные — передать в удобном формате. Не нужно регистрироваться или разбираться в терминологии до первого обращения.</p>
      </div>
      <div className="mt-7 grid gap-3 lg:grid-cols-3">
        {actions.map((action) => {
          const className = "group flex min-h-[220px] flex-col border border-white/12 bg-[#151719] p-5 transition hover:border-steel-orange hover:bg-[#191c1f]";
          const content = <>
            <p className="text-[10px] font-bold uppercase tracking-[.13em] text-steel-orange">{action.eyebrow}</p>
            <h3 className="mt-4 text-lg font-semibold leading-tight">{action.title}</h3>
            <p className="mt-3 text-xs leading-relaxed text-white/58">{action.text}</p>
            <span className="mt-auto pt-6 text-xs font-bold uppercase text-steel-orange">{action.label}&nbsp; →</span>
          </>;
          if (action.external) {
            return <a key={action.title} className={className} href={action.href} target={action.href.startsWith("/") ? "_blank" : undefined} rel={action.href.startsWith("/") ? "noreferrer" : undefined} onClick={() => trackLeadEvent(action.event, { location: "contacts_value_actions" })}>{content}</a>;
          }
          return <Link key={action.title} className={className} href={action.href} onClick={() => trackLeadEvent(action.event, { location: "contacts_value_actions" })}>{content}</Link>;
        })}
      </div>
    </div>
  </section>;
}

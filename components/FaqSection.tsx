import type { FaqItem } from "@/lib/schema";

export function FaqSection({ items, title = "Частые вопросы" }: { items: FaqItem[]; title?: string }) {
  return <section className="border-y border-white/10 bg-[#101112] py-14 sm:py-20">
    <div className="container">
      <p className="eyebrow">Ответы на вопросы</p>
      <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">{title}</h2>
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {items.map((item, index) => <article key={item.question} className="border border-white/12 bg-[#111519] p-6">
          <span className="font-mono text-xl font-bold text-steel-orange">0{index + 1}</span>
          <h3 className="mt-5 text-base font-semibold leading-snug">{item.question}</h3>
          <p className="mt-4 text-sm leading-relaxed text-white/62">{item.answer}</p>
        </article>)}
      </div>
    </div>
  </section>;
}

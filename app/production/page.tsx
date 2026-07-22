import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { ProductionShowreel } from "@/components/ProductionVideo";
import { semanticKeywords } from "@/data/semantic";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Производство изделий из листового металла",
  description:
    "Современное производство полного цикла: инженерный отдел, лазерная резка, гибка, сварка, порошковая окраска, контроль качества и отгрузка.",
  path: "/production",
  image: "/images/web/production.jpg",
  keywords: semanticKeywords.production,
});

const stages = [
  ["Проектирование", "cycle-design.jpg"],
  ["Раскрой металла", "cycle-laser-cutting.jpg"],
  ["Гибка", "cycle-bending.jpg"],
  ["Сварка и сборка", "cycle-welding.jpg"],
  ["Покраска", "cycle-powder-coating.jpg"],
  ["Контроль и отгрузка", "cycle-quality-control.jpg"],
];
const capabilities = [
  "Инженерный отдел",
  "Современное оборудование",
  "Высокое качество",
  "Индивидуальный подход",
  "Собственное производство",
  "Сроки и надежность",
  "Упаковка и логистика",
  "Импортозамещение",
];

export default function ProductionPage() {
  return (
    <PageLayout
      path="/production"
      eyebrow="Производство"
      title="Современное производство инженерных решений из листового металла"
      description="Полный цикл производства — от разработки и проектирования до упаковки и отгрузки готовой продукции. Контроль качества на каждом этапе."
      image="/images/web/production.jpg"
    >
      <section className="border-y border-white/10 bg-[#0c1013] py-7">
        <div className="container grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["2000 м²", "производственных площадей"],
            ["70+", "опытных специалистов"],
            ["3", "лазерных комплекса с ЧПУ"],
            ["100%", "контроль качества"],
            ["В срок", "выполняем заказы"],
          ].map(([value, label]) => (
            <div key={label} className="border-l border-white/10 px-4">
              <b className="text-3xl text-steel-orange">{value}</b>
              <p className="mt-1 text-[10px] uppercase text-white/55">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>
      <ProductionShowreel />
      <section className="bg-[#101112] py-14">
        <div className="container">
          <h2 className="text-3xl font-semibold">Производственный цикл</h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {stages.map(([title, image], index) => (
              <article
                key={title}
                className="overflow-hidden border border-white/10 bg-[#111519]"
              >
                <div className="relative aspect-video overflow-hidden bg-[#192026]">
                  <img
                    src={`/images/web/${image}`}
                    width={428}
                    height={240}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover brightness-[1.07] contrast-[1.01] saturate-[1.02]"
                  />
                </div>
                <div className="p-4">
                  <b className="text-xl text-steel-orange">
                    {String(index + 1).padStart(2, "0")}
                  </b>
                  <h3 className="mt-2 text-sm font-bold">{title}</h3>
                  <p className="mt-3 text-[11px] leading-relaxed text-white/50">
                    Контроль технологии и качества на каждом этапе изготовления.
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-[#0c1013] py-14">
        <div className="container">
          <h2 className="text-3xl font-semibold">Наши возможности</h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((title, index) => (
              <article
                key={title}
                className="border border-white/10 bg-[#111519] p-5"
              >
                <span className="text-2xl text-steel-orange">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 text-sm font-bold">{title}</h3>
                <p className="mt-3 text-[11px] leading-relaxed text-white/55">
                  Выполняем полный комплекс работ и обеспечиваем стабильный
                  результат для каждого заказа.
                </p>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-col justify-between gap-5 border border-white/15 bg-[#14181b] p-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-semibold">Есть задача?</h3>
              <p className="mt-2 text-sm text-white/55">
                Изготовим решение под ваши требования.
              </p>
            </div>
            <Link
              href="/contacts#contact-form"
              className="bg-steel-orange px-7 py-4 text-xs font-bold uppercase"
            >
              Получить расчет&nbsp; →
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}

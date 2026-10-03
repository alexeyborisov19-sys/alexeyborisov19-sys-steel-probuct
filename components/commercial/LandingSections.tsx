import Link from "next/link";
import { AttributionLink } from "@/components/AttributionLink";
import {
  productionEquipment,
  productionScale,
} from "@/data/manufacturing-facts";

export function SectionHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        {title}
      </h2>
      {text && <p className="mt-5 text-base leading-7 text-white/75">{text}</p>}
    </div>
  );
}
export function LandingNav({
  items,
}: {
  items: { id: string; label: string }[];
}) {
  return (
    <nav
      aria-label="Разделы страницы"
      className="border-b border-white/15 bg-[#181c1f]"
    >
      <div className="container flex flex-wrap gap-x-6 gap-y-1 py-3">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-white/85 underline-offset-8 hover:text-steel-orange hover:underline"
          >
            {item.label}{" "}
            <span className="ml-2 text-steel-orange" aria-hidden="true">
              ↘
            </span>
          </a>
        ))}
      </div>
    </nav>
  );
}
export function ProductionProof() {
  return (
    <section className="border-y border-white/15 bg-[#181c1f] py-12">
      <div className="container">
        <p className="eyebrow">Собственная производственная база</p>
        <div className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {[
            {
              value: productionEquipment.laserComplexes,
              label: "лазерных комплекса",
            },
            {
              value: productionEquipment.pressBrakes,
              label: "листогибочных комплекса",
            },
            {
              value: productionEquipment.powderCoatingBooths,
              label: "камеры порошковой окраски",
            },
            { value: productionScale.specialists, label: "специалистов" },
          ].map((item) => (
            <div key={item.label} className="border-l border-white/20 pl-4">
              <p className="font-mono text-4xl font-semibold text-steel-orange">
                {item.value}
              </p>
              <p className="mt-2 text-sm text-white/80">{item.label}</p>
            </div>
          ))}
        </div>
        <Link
          href="/production"
          className="mt-7 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
        >
          Посмотреть производство →
        </Link>
      </div>
    </section>
  );
}
export function EnquiryFinish({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <section
      id="enquiry"
      className="scroll-mt-28 border-t border-white/15 bg-[#181c1f] py-14 sm:py-20"
    >
      <div className="container grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="eyebrow">Следующий шаг</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
            {title}
          </h2>
          <p className="mt-5 max-w-2xl leading-7 text-white/80">{text}</p>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <AttributionLink
            href="/contacts#contact-form"
            className="clip-corner bg-steel-orange-deep px-6 py-4 text-center font-bold"
          >
            Передать проект инженеру →
          </AttributionLink>
          <a
            href="/documents/zadanie-na-izgotovlenie.txt"
            download
            className="min-h-12 border border-white/30 px-6 py-4 text-center text-sm font-semibold"
          >
            Скачать шаблон задания ↓
          </a>
          <p className="text-xs leading-5 text-white/70">
            Можно начать с описания. Файлы и компания в заявке необязательны.
          </p>
        </div>
      </div>
    </section>
  );
}

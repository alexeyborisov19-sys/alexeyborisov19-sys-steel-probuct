import { AttributionLink } from "@/components/AttributionLink";

const STEPS = [
  {
    title: "Загрузите файл",
    text: "DXF, STEP или STP. Можно загрузить несколько деталей одновременно.",
  },
  {
    title: "Автоматический анализ",
    text: "Считываем доступную геометрию из файла. Проверьте материал, толщину и операции перед расчётом.",
  },
  {
    title: "Получите стоимость",
    text: "Выберите материал, количество и обработку — система рассчитает предварительную стоимость изготовления.",
  },
] as const;

const FORMATS = ["DXF", "STEP", "STP"] as const;

/**
 * Homepage entry point for the CAD calculator. It shows the mechanism rather
 * than advertising it: three steps and one link. The section
 * is meant to be noticed on the way past, not to interrupt.
 */
export function CadCalculatorShowcase() {
  return (
    <section aria-labelledby="cad-calculator-title" className="border-y border-white/10 bg-[#101112] py-12 sm:py-14">
      <div className="container">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-steel-orange">
              Бесплатный онлайн-расчёт
            </p>
            <h2 id="cad-calculator-title" className="mt-3 text-2xl font-semibold uppercase leading-tight sm:text-3xl">
              Рассчитайте деталь по CAD или размерам
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/75">
              Загрузите DXF или STEP либо введите размеры вручную. До пяти изделий в одном расчёте, бесплатно и без регистрации. Стоимость предварительная; неоднозначную геометрию проверит инженер.
            </p>
          </div>
          <AttributionLink prefetch={false}
            href="/online-order"
            className="clip-corner inline-block whitespace-nowrap bg-steel-orange-deep px-6 py-4 text-[13px] font-bold uppercase transition hover:bg-steel-orange-deeper"
          >
            Рассчитать онлайн&nbsp; →
          </AttributionLink>
        </div>

        <ol className="mt-8 grid gap-3 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="motion-reduce:!opacity-100 motion-reduce:!transform-none group relative overflow-hidden border border-white/10 bg-[#111519] p-5 transition-colors hover:border-steel-orange/45"
            >
              <span className="font-mono text-xs font-bold text-steel-orange">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 text-sm font-semibold uppercase leading-snug">{step.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-white/75">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-[.12em] text-white/70">
          <span>Форматы</span>
          {FORMATS.map((format) => (
            <span key={format} className="border border-white/12 px-2.5 py-1 text-white/75">{format}</span>
          ))}
          <span className="text-white/70">DWG — после проверки инженером</span>
        </div>
      </div>
    </section>
  );
}

type SolutionDiagramProps = {
  title: string;
  caption: string;
  steps: string[];
};

export function SolutionDiagram({ title, caption, steps }: SolutionDiagramProps) {
  return <section className="border border-white/12 bg-[#111519] p-5 sm:p-8">
    <div className="max-w-3xl">
      <p className="eyebrow">Проектная схема</p>
      <h2 className="mt-3 text-2xl font-semibold uppercase leading-tight sm:text-3xl">{title}</h2>
      <p className="mt-4 text-sm leading-relaxed text-white/62">{caption}</p>
    </div>
    <div className="mt-8 overflow-hidden border border-white/10 bg-[#0b0e10] p-4 sm:p-7">
      <div className="relative grid gap-3 md:grid-cols-4 md:gap-0">
        {steps.map((step, index) => <div key={step} className="relative flex min-h-32 flex-col justify-between border border-white/10 bg-[#14191c] p-5 md:border-y-0 md:border-l-0 md:last:border-r-0">
          <span className="font-mono text-2xl font-bold text-steel-orange">0{index + 1}</span>
          <p className="max-w-[12rem] text-sm font-semibold leading-snug text-white">{step}</p>
          {index < steps.length - 1 && <span className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rotate-45 border-r border-t border-steel-orange bg-[#14191c] md:block" aria-hidden="true" />}
        </div>)}
      </div>
      <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs leading-relaxed text-white/52 sm:flex-row sm:items-center sm:justify-between"><span>Точные размеры, узлы и состав крепежа утверждаются после получения исходных данных.</span><span className="font-semibold uppercase tracking-[.12em] text-steel-orange">Сталь Продукт</span></div>
    </div>
  </section>;
}

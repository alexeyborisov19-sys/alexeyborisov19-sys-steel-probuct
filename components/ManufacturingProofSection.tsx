import Link from "next/link";
import { productionEquipment } from "@/data/manufacturing-facts";

const proofItems = [
  {
    title: "Производство полного цикла",
    text: "Инженерно-конструкторская подготовка, раскрой, гибка, сварка, сборка, подготовка поверхности, окраска, контроль, комплектация и упаковка объединены в один производственный маршрут.",
  },
  {
    title: "Инженерно-конструкторский центр",
    text: "Разрабатываем и проверяем КД, оцениваем технологичность и готовим изделие к повторяемому выпуску — от первого образца до серийной партии.",
  },
  {
    title: "Собственная производственная база",
    text: `${productionEquipment.laserComplexes} лазерных комплекса, ${productionEquipment.pressBrakes} листогибочных комплекса, ${productionEquipment.panelBenders} панельгиб, ${productionEquipment.weldingStations} сварочных поста и ${productionEquipment.powderCoatingBooths} камеры порошковой окраски работают внутри единой производственной цепочки.`,
  },
  {
    title: "От опытного образца до серии",
    text: "Проверяем прототип, фиксируем согласованное исполнение и переносим его в повторяемую партию с контролем комплектности перед отгрузкой.",
  },
] as const;

export function ManufacturingProofSection() {
  return <section className="border-y border-white/10 bg-[#151719] py-14 sm:py-20">
    <div className="container">
      <div className="max-w-3xl">
        <p className="eyebrow">Почему «Сталь Продукт»</p>
        <h2 className="mt-3 text-2xl font-semibold uppercase leading-tight sm:text-3xl">От инженерной подготовки до готовой партии — в одном производственном маршруте</h2>
        <p className="mt-4 text-sm leading-7 text-white/62">Не ограничиваемся одной операцией. Связываем конструкторскую подготовку, изготовление, покрытие, контроль и комплектацию, чтобы изделие было готово к повторяемому выпуску.</p>
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {proofItems.map((proof, index) => <article key={proof.title} className="border border-white/12 bg-[#101214] p-6">
          <span className="font-mono text-sm font-bold text-steel-orange">{String(index + 1).padStart(2, "0")}</span>
          <h3 className="mt-5 text-base font-semibold uppercase leading-tight">{proof.title}</h3>
          <p className="mt-4 text-sm leading-relaxed text-white/60">{proof.text}</p>
        </article>)}
      </div>
      <div className="mt-7 flex flex-col justify-between gap-4 border-l-2 border-steel-orange bg-black/20 px-5 py-4 sm:flex-row sm:items-center">
        <p className="text-sm font-semibold leading-relaxed text-white/82">От чертежа и опытного образца — к повторяемой партии, подготовленной к организованной отгрузке.</p>
        <Link href="/production" className="whitespace-nowrap text-xs font-bold uppercase text-steel-orange">Смотреть производство&nbsp; →</Link>
      </div>
    </div>
  </section>;
}

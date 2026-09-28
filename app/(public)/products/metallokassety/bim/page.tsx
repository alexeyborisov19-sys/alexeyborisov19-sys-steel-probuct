import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { CassetteBimConfigurator } from "@/components/CassetteBimConfigurator";
import { JsonLd } from "@/components/JsonLd";
import { faqSchema } from "@/lib/schema";
import { absoluteUrl } from "@/lib/site";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({ title: "BIM-модель металлокассет — скачать IFC и спецификацию", description: "Бесплатная координационная IFC-модель металлокассет: размеры, толщина, швы, марки и спецификация CSV. Настройте фасадный фрагмент для архитектурного проекта.", path: "/products/metallokassety/bim" });
const faq = [
  {question: "Можно скачать модель бесплатно?", answer: "Да. Генерация IFC и спецификации CSV бесплатна и не требует регистрации. Изготовление кассет рассчитывается отдельно."},
  {question: "Можно менять параметры после загрузки в Revit?", answer: "Размеры этой IFC-модели задаются в генераторе до скачивания. Она не является редактируемым семейством RFA. Семейства для Revit 2022 будут доступны после отдельной проверки."},
  {question: "Подходит ли модель для заказа в производство?", answer: "Нет. Она предназначена для архитектурной компоновки и подсчёта элементов. Точные борта, крепления, замки и развёртки согласуются по рабочей документации."},
];
export default function CassetteBimPage() {
  return <PageLayout compactHero breadcrumbs={[{name:"Главная",path:"/"},{name:"Продукция",path:"/products"},{name:"Металлокассеты",path:"/products/metallokassety"},{name:"BIM-модель",path:"/products/metallokassety/bim"}]} path="/products/metallokassety/bim" eyebrow="Инструменты проектировщика" title="BIM-модель металлокассет" description="Задайте размеры, выберите кассеты и назначьте RAL. Скачайте IFC и спецификацию — бесплатно, без регистрации.">
    <JsonLd data={[faqSchema(faq), {"@context":"https://schema.org","@type":"WebApplication",name:"Генератор IFC-модели металлокассет",url:absoluteUrl("/products/metallokassety/bim"),applicationCategory:"DesignApplication",operatingSystem:"Современный веб-браузер",isAccessibleForFree:true,inLanguage:"ru-RU",featureList:["Настройка размеров и швов","Поэлементная окраска RAL","Экспорт IFC4","Спецификация CSV"]}]} />
    <section className="bg-[#e9eeec] py-8 text-slate-900 sm:py-10">
      <div className="container">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600"><p>IFC4 · поэлементная окраска RAL · спецификация CSV</p><a className="font-semibold text-orange-800 underline underline-offset-4" href="#bim-passport">О модели и ограничениях ↓</a></div>
        <CassetteBimConfigurator />
        <div id="bim-passport" className="mt-8 scroll-mt-28 rounded-xl border border-slate-300 bg-white p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Что вы скачиваете</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Координационную модель фасадного фрагмента: отдельные кассеты с размерами, марками и назначенными цветами. Она подходит для архитектурной компоновки и ведомости элементов.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4"><h3 className="font-semibold">IFC4 — модель</h3><p className="mt-2 text-sm leading-6 text-slate-600">Геометрия и RAL каждой кассеты. Размеры задаются здесь, перед скачиванием.</p></div>
            <div className="rounded-lg bg-slate-50 p-4"><h3 className="font-semibold">CSV — спецификация</h3><p className="mt-2 text-sm leading-6 text-slate-600">Отдельная строка на кассету: марка, размеры, покрытие и площадь лица. Открывается в табличном редакторе.</p></div>
            <div className="rounded-lg bg-amber-50 p-4"><h3 className="font-semibold">RFA — в разработке</h3><p className="mt-2 text-sm leading-6 text-slate-600">Семейства для Revit 2022 пока недоступны. IFC не заменяет параметрическое семейство.</p></div>
          </div>
          <details className="mt-6 border-t border-slate-200 py-4"><summary className="cursor-pointer font-semibold">Паспорт параметров и геометрия</summary><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Паспорт IFC-модели металлокассет</caption><tbody>{[
            ["Элементы", "IfcPlate / IfcPlateType. Каждая кассета имеет отдельный номер."],
            ["Размеры", "Width, Height, Depth, Thickness, Joint — миллиметры. Внешний шов по краям не добавляется."],
            ["Материал и RAL", "Оцинкованная сталь. Finish — покрытие каждого элемента; DefaultFinish — описание по умолчанию. Экранный оттенок приблизительный."],
            ["Площадь", "FaceArea — лицевая поверхность в м² без швов. Не расход металла и не площадь окраски с бортами."],
            ["Координаты", "Ширина по X, высота по Z, глубина по −Y. Начало у нижнего левого края блока."],
            ["Ограничения", "Лицевая поверхность и четыре прямых борта. Замки, монтажные полки, отверстия, радиусы гиба и подсистема не моделируются. Открытое и скрытое крепление не различаются."],
          ].map(([name,value])=><tr key={name} className="border-b border-slate-200"><th scope="row" className="p-3 align-top font-medium">{name}</th><td className="p-3 text-slate-600">{value}</td></tr>)}</tbody></table></div></details>
          <h3 className="mt-3 font-semibold">Вопросы о BIM-модели</h3>
          {faq.map(item=><details key={item.question} className="border-b border-slate-200 py-4"><summary className="cursor-pointer text-sm font-medium">{item.question}</summary><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{item.answer}</p></details>)}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4"><p className="max-w-xl text-sm leading-6 text-slate-600">Для изготовления согласуйте рабочие чертежи и узлы. Модель не содержит расчёта нагрузок и производственных развёрток.</p><div className="flex flex-wrap gap-5 text-sm font-semibold text-orange-800"><Link className="underline underline-offset-4" href="/products/metallokassety#calculator-metallokasset">Рассчитать металлокассеты</Link><Link className="underline underline-offset-4" href="/contacts#contact-form">Передать инженеру</Link></div></div>
        </div>
      </div>
    </section>
  </PageLayout>;
}

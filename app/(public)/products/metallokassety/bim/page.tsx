import { AttributionLink } from "@/components/AttributionLink";
import { PageLayout } from "@/components/PageLayout";
import { CassetteBimConfigurator } from "@/components/CassetteBimConfigurator";
import { CassetteBimLibrary } from "@/components/CassetteBimLibrary";
import { CassetteJointGuide } from "@/components/CassetteJointGuide";
import { JsonLd } from "@/components/JsonLd";
import { faqSchema } from "@/lib/schema";
import { absoluteUrl } from "@/lib/site";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({ title: "BIM-модель металлокассет — скачать IFC и спецификацию", description: "Бесплатная координационная IFC-модель металлокассет: размеры, толщина, швы, марки и спецификация CSV. Настройте фасадный фрагмент для архитектурного проекта.", path: "/products/metallokassety/bim" });
const faq = [
  {question: "Можно скачать модель бесплатно?", answer: "Да. Генерация IFC и спецификации CSV бесплатна и не требует регистрации. Изготовление кассет рассчитывается отдельно."},
  {question: "Можно менять параметры после загрузки в Revit?", answer: "Размеры этой IFC-модели задаются в генераторе до скачивания. Она не является редактируемым семейством RFA. Семейства RFA в этом сервисе пока недоступны."},
  {question: "Подходит ли модель для заказа в производство?", answer: "Нет. Она предназначена для архитектурной компоновки и подсчёта элементов. Открытый и закрытый типы воспроизводят исходные STEP с точностью сетки 0,1 мм; изменённые размеры и узлы стыковки согласуются по рабочей документации."},
];
export default function CassetteBimPage() {
  return <PageLayout compactHero breadcrumbs={[{name:"Главная",path:"/"},{name:"Продукция",path:"/products"},{name:"Металлокассеты",path:"/products/metallokassety"},{name:"BIM-модель",path:"/products/metallokassety/bim"}]} path="/products/metallokassety/bim" eyebrow="Инструменты проектировщика" title="Бесплатная BIM-библиотека" description="Выберите кассету или добор, скачайте IFC или настройте размеры. Раскладка фасада и карта примыканий — отдельные инструменты.">
    <JsonLd data={[faqSchema(faq), {"@context":"https://schema.org","@type":"WebApplication",name:"Генератор IFC-модели металлокассет",url:absoluteUrl("/products/metallokassety/bim"),applicationCategory:"DesignApplication",operatingSystem:"Современный веб-браузер",isAccessibleForFree:true,inLanguage:"ru-RU",featureList:["Настройка размеров и швов","Поэлементная окраска RAL","Экспорт IFC4","Спецификация CSV"]}]} />
    <section aria-labelledby="bim-config-title" className="bg-[#e9eeec] py-8 text-slate-900 sm:py-10">
      <div className="container">
        <nav aria-label="Разделы BIM-библиотеки" className="mb-5 flex flex-wrap gap-3 text-sm font-semibold text-orange-800"><a className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3" href="#bim-library">Модели изделий</a><a className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3" href="#bim-joints">Узлы и примыкания</a><a className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3" href="#bim-config-title">Раскладка фасада</a></nav>
        <CassetteBimLibrary />
        <CassetteJointGuide />
        <h2 id="bim-config-title" className="mt-10 mb-4 scroll-mt-28 text-2xl font-semibold">Раскладка фасадного фрагмента</h2>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600"><p>IFC4 · поэлементная окраска RAL · спецификация CSV</p><a className="font-semibold text-orange-800 underline underline-offset-4" href="#bim-passport">О модели и ограничениях ↓</a></div>
        <CassetteBimConfigurator />
        <div id="bim-passport" className="mt-8 scroll-mt-28 rounded-xl border border-slate-300 bg-white p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Что вы скачиваете</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Координационную модель фасадного фрагмента: отдельные кассеты с размерами, марками и назначенными цветами. Она подходит для архитектурной компоновки и ведомости элементов.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4"><h3 className="font-semibold">IFC4 — модель</h3><p className="mt-2 text-sm leading-6 text-slate-600">Геометрия и RAL каждой кассеты. Размеры задаются здесь, перед скачиванием.</p></div>
            <div className="rounded-lg bg-slate-50 p-4"><h3 className="font-semibold">CSV — спецификация</h3><p className="mt-2 text-sm leading-6 text-slate-600">Отдельная строка на кассету: марка, размеры, покрытие и площадь лица. Открывается в табличном редакторе.</p></div>
            <div className="rounded-lg bg-amber-50 p-4"><h3 className="font-semibold">RFA пока недоступен</h3><p className="mt-2 text-sm leading-6 text-slate-600">Скачиваемый IFC предназначен для координации проекта. Редактируемое семейство Revit не создаётся.</p></div>
          </div>
          <details className="mt-6 border-t border-slate-200 py-4"><summary className="cursor-pointer font-semibold">Паспорт параметров и геометрия</summary><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Паспорт IFC-модели металлокассет</caption><tbody>{[
            ["Элементы", "IfcPlate / IfcPlateType. Каждая кассета имеет отдельный номер."],
            ["Размеры", "Width, Height — лицевые габариты; Depth, Thickness, Joint — миллиметры. Монтажные полки могут выходить за лицевой габарит. ReturnWidth — второе крыло угловой кассеты. Внешний шов по краям не добавляется."],
            ["Материал и RAL", "Оцинкованная сталь. Finish — покрытие каждого элемента; DefaultFinish — описание по умолчанию. Экранный оттенок приблизительный."],
            ["Площадь", "FaceArea — лицевая поверхность в м² без швов. Не расход металла и не площадь окраски с бортами."],
            ["Координаты", "Ширина по X, высота по Z, глубина по −Y. Начало у нижнего левого края блока."],
            ["Ограничения", "ОТ и ЗТ толщиной 0,7/1 мм — по исходным STEP: борта, полки, отверстия и гибы. Угловая закрытая — исходная IFC-сетка SP-CAS-05 с замком, гибами и отверстиями, пока без изменения размеров. Размеры меняются через центральную часть, а не масштабирование металла. Крепёж и подсистема не входят."],
          ].map(([name,value])=><tr key={name} className="border-b border-slate-200"><th scope="row" className="p-3 align-top font-medium">{name}</th><td className="p-3 text-slate-600">{value}</td></tr>)}</tbody></table></div></details>
          <h3 className="mt-3 font-semibold">Вопросы о BIM-модели</h3>
          {faq.map(item=><details key={item.question} className="border-b border-slate-200 py-4"><summary className="cursor-pointer text-sm font-medium">{item.question}</summary><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{item.answer}</p></details>)}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4"><p className="max-w-xl text-sm leading-6 text-slate-600">Для изготовления согласуйте рабочие чертежи и узлы. Модель не содержит расчёта нагрузок и производственных развёрток. Скачанные файлы нужно приложить к обращению самостоятельно.</p><div className="flex flex-wrap gap-5 text-sm font-semibold text-orange-800"><AttributionLink className="underline underline-offset-4" href="/products/metallokassety#calculator-metallokasset">Рассчитать металлокассеты</AttributionLink><AttributionLink className="underline underline-offset-4" href="/contacts#contact-form">Открыть форму обращения</AttributionLink></div></div>
        </div>
      </div>
    </section>
  </PageLayout>;
}

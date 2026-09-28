import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { CassetteBimConfigurator } from "@/components/CassetteBimConfigurator";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
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
  return <PageLayout compactHero breadcrumbs={[{name:"Главная",path:"/"},{name:"Продукция",path:"/products"},{name:"Металлокассеты",path:"/products/metallokassety"},{name:"BIM-модель",path:"/products/metallokassety/bim"}]} path="/products/metallokassety/bim" eyebrow="Инструменты проектировщика" title="BIM-модель металлокассет" description="Настройте размеры и раскладку фасадного фрагмента. Скачайте координационную модель IFC и спецификацию бесплатно, без регистрации.">
    <JsonLd data={[faqSchema(faq), {"@context":"https://schema.org","@type":"WebApplication",name:"Генератор IFC-модели металлокассет",url:absoluteUrl("/products/metallokassety/bim"),applicationCategory:"DesignApplication",operatingSystem:"Современный веб-браузер",isAccessibleForFree:true,inLanguage:"ru-RU",featureList:["Настройка размеров и швов","Экспорт IFC4","Спецификация CSV"]}]} />
    <section className="container py-12 sm:py-16"><div className="mb-6 flex flex-wrap gap-3 text-sm"><span className="rounded border border-white/20 px-4 py-2">IFC4 · версия модели 1.0</span><span className="rounded border border-white/20 px-4 py-2">Обновлено 28.09.2026</span><a className="rounded border border-white/20 px-4 py-2 text-steel-orange" href="#bim-passport">Паспорт параметров ↓</a></div><CassetteBimConfigurator /></section>
    <section id="bim-passport" className="container pb-14"><h2 className="text-2xl font-semibold">Паспорт модели</h2><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Параметры и назначение IFC-модели металлокассеты</caption><thead><tr className="border-b border-white/20"><th className="p-3">Параметр</th><th className="p-3">Содержание</th></tr></thead><tbody>{[
      ["Элемент / тип", "IfcPlate / IfcPlateType. Одинаковые кассеты объединены одним типом."],
      ["Размеры", "Width, Height, Depth, Thickness — миллиметры. Размеры задаются до экспорта."],
      ["Шов", "Joint — зазор между соседними кассетами. Внешний отступ по краям не добавляется."],
      ["Материал и покрытие", "Оцинкованная сталь; Finish — текстовое обозначение покрытия по проекту."],
      ["Маркировка", "Mark — марка типа; каждый элемент получает отдельный номер."],
      ["Площадь", "FaceArea — лицевая поверхность в м² без швов. Это не расход металла и не площадь окраски."],
      ["Ориентация", "Ширина по X, высота по Z, глубина по −Y. Начало координат у нижнего левого края фрагмента."],
      ["Назначение", "Архитектурная координация и ведомость количества. Рабочие чертежи разрабатываются отдельно."],
    ].map(([name, value]) => <tr key={name} className="border-b border-white/10"><th scope="row" className="p-3 align-top font-medium">{name}</th><td className="p-3 text-white/70">{value}</td></tr>)}</tbody></table></div></section>
    <section className="container pb-16"><div className="grid gap-8 md:grid-cols-2">
      <div><h2 className="text-2xl font-semibold">Что входит в модель</h2><p className="mt-4 leading-7 text-white/70">Каждая кассета — отдельный элемент IfcPlate с маркой. Сохраняются ширина, высота, глубина, толщина, шов, описание покрытия и материал. Общий тип объединяет одинаковые кассеты; CSV содержит количество и суммарную площадь лицевой поверхности без швов.</p><p className="mt-4 leading-7 text-white/70">Геометрия упрощена до лицевой поверхности и четырёх прямых бортов. Открытое и скрытое крепление не различаются этой моделью: замки, монтажные полки, отверстия, радиусы гиба и подсистема требуют отдельной проектной проработки.</p></div>
      <div><h2 className="text-2xl font-semibold">Как использовать IFC</h2><ol className="mt-4 list-decimal space-y-3 pl-5 leading-7 text-white/70"><li>Введите проектные размеры кассеты и межкассетного шва.</li><li>Задайте число рядов и колонок, марку и покрытие.</li><li>Скачайте IFC4 и CSV. После импорта проверьте единицы, ориентацию и количество элементов.</li><li>Перед изготовлением согласуйте рабочие чертежи и узлы с инженером.</li></ol></div>
      <div><h2 className="text-2xl font-semibold">Семейства Revit 2022</h2><p className="mt-4 leading-7 text-white/70">Редактируемые семейства RFA готовятся отдельно и пока недоступны для скачивания. IFC не заменяет параметрическое семейство Revit. Проверенные RFA будут опубликованы после проверки в Revit 2022.</p></div>
      <div><h2 className="text-2xl font-semibold">От модели к заказу</h2><p className="mt-4 leading-7 text-white/70">Модель помогает с компоновкой и ведомостью элементов. Она не содержит расчёта нагрузок, подтверждения несущей способности или производственной развёртки.</p><div className="mt-5 flex flex-wrap gap-4"><Link className="text-steel-orange underline underline-offset-4" href="/products/metallokassety#calculator-metallokasset">Рассчитать металлокассеты</Link><Link className="text-steel-orange underline underline-offset-4" href="/contacts#contact-form">Передать проект инженеру</Link></div></div>
    </div></section>
    <FaqSection items={faq} />
  </PageLayout>;
}

import { AttributionLink } from "@/components/AttributionLink";
import { PageLayout } from "@/components/PageLayout";
import { CassetteBimConfigurator } from "@/components/CassetteBimConfigurator";
import { CassetteBimLibrary } from "@/components/CassetteBimLibrary";
import { CassetteBimWorkspace } from "@/components/CassetteBimWorkspace";
import { CassetteJointGuide } from "@/components/CassetteJointGuide";
import { JsonLd } from "@/components/JsonLd";
import { faqSchema } from "@/lib/schema";
import { absoluteUrl } from "@/lib/site";
import { createPageMetadata } from "@/lib/seo";
import styles from "@/components/CassetteBimWorkspace.module.css";

export const metadata = createPageMetadata({ title: "BIM-библиотека фасадных изделий — IFC-модели металлокассет", description: "15 исходных IFC-моделей кассет и доборов. Выберите изделие, измените габариты или соберите фасадный фрагмент со спецификацией CSV. Бесплатно, без регистрации.", path: "/products/metallokassety/bim" });
const faq = [
  {question: "Можно скачать модель бесплатно?", answer: "Да. Исходные IFC, настройка габаритов и экспорт фасадного фрагмента с CSV доступны бесплатно, без регистрации. Изготовление изделий рассчитывается отдельно."},
  {question: "Можно менять параметры после загрузки в Revit?", answer: "Габариты IFC задаются в веб-конфигураторе до скачивания. Изменение свойств IFC в Revit само по себе не перестраивает геометрию. Нативные семейства RFA для Revit 2021 пока не опубликованы; совместимость импорта IFC в Revit 2021 отдельно не подтверждена."},
  {question: "Подходит ли модель для заказа в производство?", answer: "Модель служит для архитектурной компоновки и ведомости элементов. Она не заменяет производственные развёртки, рабочие чертежи, расчёт нагрузок и согласование узлов. Изменённые габариты и применимость конкретного изделия необходимо согласовать с инженером."},
];
const passport = [
  ["Модели изделий", "Исходные габариты X/Y/Z — внешние размеры тела. Они не равны размерам лицевой части или монтажному модулю. Толщина берётся из исходной геометрии; диапазон настройки не является производственным допуском."],
  ["Настройка отдельного изделия", "Перестраиваются прямые участки координационной сетки. Гибы и отверстия защищены от масштабирования; положение отверстий в изменённом изделии требует согласования по чертежу. IFC фиксирует геометрию на момент скачивания."],
  ["Раскладка фасада", "Width и Height — лицевые размеры, ReturnWidth — второе крыло угловой кассеты. Depth, Thickness и Joint задаются в миллиметрах. Монтажные полки могут выходить за лицевой габарит. Внешний шов по краям блока не добавляется."],
  ["Площадь и покрытие", "FaceArea в раскладке — площадь лицевой поверхности в м² без швов, не расход металла и не площадь окраски с бортами. Finish задаёт покрытие элемента, DefaultFinish — описание по умолчанию. Цвет на экране приблизительный. В исходной библиотеке материал, RAL и масса автоматически не назначаются."],
  ["Координаты раскладки", "Ширина по X, высота по Z, глубина по −Y. Начало у нижнего левого края блока. Каждая кассета — отдельный IfcPlate / IfcPlateType с собственным номером."],
  ["Геометрия и ограничения", "ОТ и ЗТ толщиной 0,7/1 мм в раскладке — по исходным STEP. Угловая 90° в раскладке — упрощённая по чертежу, без отверстий и радиусов. Отдельные исходные угловые модели каталога — самостоятельные образцы. Крепёж и подсистема не входят; собираемость и проектные узлы отдельно не утверждены."],
];

function BimHelp() {
  return <section id="bim-passport" aria-labelledby="bim-help-title" className={styles.sectionAnchor}>
    <p className={styles.eyebrow}>Файлы и совместимость</p>
    <h2 id="bim-help-title" className={styles.sectionHeading}>Выберите формат под свою задачу</h2>
    <p className={styles.sectionText}>Готовое изделие, изменённая модель и фасадная раскладка — разные результаты. Проверьте назначение файла перед добавлением в проект.</p>
    <div className={styles.tableWrap}><table className={styles.table}><caption className="sr-only">Форматы BIM-библиотеки и их назначение</caption><thead><tr><th scope="col">Формат</th><th scope="col">Для чего нужен</th><th scope="col">Как изменить</th></tr></thead><tbody>
      <tr><th scope="row">IFC4 · изделие</th><td>Одна кассета или добор. Координационная сетка и точная исходная геометрия — альтернативные представления одной детали.</td><td>Выберите «Задать размеры» в каталоге. Повторная настройка — в веб-конфигураторе, не в свойствах скачанного IFC.</td></tr>
      <tr><th scope="row">IFC4 · раскладка</th><td>Фасадный фрагмент из отдельных кассет с марками, размерами и назначенными RAL.</td><td>Размеры, сетка и цвета задаются во вкладке «Раскладка фасада» до экспорта.</td></tr>
      <tr><th scope="row">CSV</th><td>Ведомость фасадного фрагмента: строка на кассету, размеры, покрытие и площадь лица.</td><td>Откройте в табличном редакторе. Изменения CSV не перестраивают модель.</td></tr>
      <tr><th scope="row">JSON</th><td>Настройки для продолжения работы в соответствующем веб-инструменте.</td><td>Загрузите сохранённый JSON в тот инструмент, в котором он создан. Это не BIM-модель.</td></tr>
    </tbody></table></div>
    <div className={styles.notice}><h3>Revit 2021: семейства RFA пока не опубликованы</h3><p>Скачиваемый IFC не является редактируемым семейством Revit. Импорт и работу модели в Revit 2021 необходимо проверить в целевой программе. Подготовка исходников сама по себе не подтверждает готовность RFA.</p></div>
    <details className={styles.details}><summary>Паспорт параметров и геометрия</summary><div className={styles.tableWrap}><table className={styles.table}><caption className="sr-only">Паспорт IFC-модели металлокассет</caption><tbody>{passport.map(([name, value]) => <tr key={name}><th scope="row">{name}</th><td>{value}</td></tr>)}</tbody></table></div></details>
    <h3 className={styles.faqTitle}>Вопросы о BIM-модели</h3>
    {faq.map(item => <details key={item.question} className={styles.details}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
    <div className={styles.contact}><p>Для изготовления согласуйте рабочие чертежи и узлы. Модель не содержит расчёта нагрузок и производственных развёрток. Скачанные файлы нужно приложить к обращению самостоятельно.</p><div className={styles.links}><AttributionLink className="underline underline-offset-4" href="/products/metallokassety#calculator-metallokasset">Рассчитать металлокассеты</AttributionLink><AttributionLink className="underline underline-offset-4" href="/contacts#contact-form">Открыть форму обращения</AttributionLink></div></div>
  </section>;
}

export default function CassetteBimPage() {
  return <PageLayout compactHero breadcrumbs={[{name:"Главная",path:"/"},{name:"Продукция",path:"/products"},{name:"Металлокассеты",path:"/products/metallokassety"},{name:"BIM-библиотека",path:"/products/metallokassety/bim"}]} path="/products/metallokassety/bim" eyebrow="Инструменты проектировщика" title="BIM-библиотека фасадных изделий" description="Кассеты и доборные элементы для архитектурной компоновки. Готовые модели, настройка габаритов и раскладка — в одном рабочем пространстве.">
    <JsonLd data={[faqSchema(faq), {"@context":"https://schema.org","@type":"WebApplication",name:"BIM-библиотека фасадных изделий Сталь Продукт",url:absoluteUrl("/products/metallokassety/bim"),applicationCategory:"DesignApplication",operatingSystem:"Современный веб-браузер",isAccessibleForFree:true,inLanguage:"ru-RU",featureList:["Каталог 15 исходных изделий","Настройка габаритов IFC","Раскладка фасадного фрагмента","Экспорт IFC4 и CSV"]}]} />
    <CassetteBimWorkspace library={<CassetteBimLibrary />} joints={<CassetteJointGuide />} help={<BimHelp />} layout={<section aria-labelledby="bim-config-title"><p className={styles.eyebrow}>Компоновка и ведомость</p><h2 id="bim-config-title" className={`${styles.sectionHeading} ${styles.sectionAnchor}`}>Раскладка фасадного фрагмента</h2><p className={styles.sectionText}>Задайте лицевые размеры кассет и сетку, назначьте цвета и сохраните IFC-модель со спецификацией. Для одной детали используйте каталог изделий.</p><div className={styles.layoutMeta}><p>IFC4 · поэлементная окраска RAL · спецификация CSV</p><a href="#bim-passport">Форматы и ограничения →</a></div><CassetteBimConfigurator /></section>} />
  </PageLayout>;
}

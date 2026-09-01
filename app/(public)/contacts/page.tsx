import { QuoteRequestForm } from "@/components/QuoteRequestForm";
import { ConversionActions } from "@/components/ConversionActions";
import { PageLayout } from "@/components/PageLayout";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";
import { faqSchema } from "@/lib/schema";
import { siteConfig } from "@/lib/site";
import {
  customerMaterialSummary,
  laserCuttingCapabilities,
  productionLeadTimeSummary,
} from "@/data/manufacturing-facts";

export const metadata: Metadata = createPageMetadata({
  title: "Получить расчёт металлоизделий",
  description: `Расчёт металлоизделий по PDF, DXF, DWG или STEP. Лазерная резка чёрной стали ${laserCuttingCapabilities.thicknessRange}, стол ${laserCuttingCapabilities.tableWorkingArea}.`,
  path: "/contacts",
  keywords: ["расчёт металлоизделий", "заказать металлоизделия по чертежам", "стоимость изготовления деталей", "DXF DWG STEP производство", "подрядчик по металлообработке"],
});

const contactFaq = [
  { question: "Какие файлы приложить к заявке?", answer: "Подойдут PDF, DXF, DWG, STEP, IGES, SLDPRT, IPT, изображения, спецификации и архивы. Для первичной оценки можно отправить эскиз или описание задачи. Перед загрузкой удалите или обезличьте персональные данные третьих лиц, если у вас нет законного основания для их передачи Оператору." },
  { question: "Телефон обязателен?", answer: "Нет. Для отправки заявки достаточно указать хотя бы один способ связи — телефон или электронную почту." },
  { question: "Что происходит после отправки материалов?", answer: "Проверим, что файлы и контактные данные получены и доступны для инженерной проверки. Если исходных данных недостаточно, сформируем перечень уточнений. Срок подготовки расчёта сообщим после проверки документации и состава заказа." },
  { question: "Какой средний срок изготовления?", answer: productionLeadTimeSummary },
  { question: "Можно использовать металл заказчика?", answer: customerMaterialSummary },
];

export default function ContactsPage() {
  return <><JsonLd data={faqSchema(contactFaq)} /><PageLayout path="/contacts" eyebrow="Получить расчёт" title="Передайте задачу на инженерную проверку" description="Приложите чертёж, 3D-модель, спецификацию или опишите изделие. Проверим исходные данные, уточним технологический маршрут и подготовим расчёт.">
    <ConversionActions />
    <section id="contact-form" className="bg-[#101112] py-14 sm:py-20">
      <div className="container grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="border border-white/15 bg-[#151719] p-5 sm:p-8">
          <p className="eyebrow">Заявка на расчёт</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">Передайте исходные данные — мы подготовим решение</h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/60">Файлы поступят в инженерный и коммерческий отдел. Укажите материал, толщину, количество, критические размеры, покрытие и требуемую дату — это сократит число уточнений перед расчётом.</p>
          <div className="mt-4 max-w-2xl border-l-2 border-steel-orange pl-4 text-xs leading-relaxed text-white/55">
            <b className="text-white">Перед загрузкой файлов:</b> не передавайте документы, содержащие персональные данные третьих лиц, если у вас отсутствует законное основание для их передачи Оператору. Удалите или обезличьте такие сведения. Не передавайте через форму специальные категории персональных данных и биометрические персональные данные.
          </div>
          <div className="mt-8"><QuoteRequestForm /></div>
        </div>

        <aside className="border border-white/15 bg-[#151719] p-6 sm:p-7">
          <p className="eyebrow">Контакты</p>
          <h2 className="mt-3 text-2xl font-semibold">Удобно обсудить задачу напрямую?</h2>
          <div className="mt-7 space-y-5 text-sm">
            <div className="border-l-2 border-steel-orange pl-4"><p className="text-xs uppercase tracking-[.12em] text-white/45">Телефон</p><a className="mt-2 block font-semibold transition hover:text-steel-orange" href={`tel:${siteConfig.telephone}`}>{siteConfig.telephoneDisplay}</a></div>
            <div className="border-l-2 border-steel-orange pl-4"><p className="text-xs uppercase tracking-[.12em] text-white/45">Электронная почта</p><a className="mt-2 block font-semibold transition hover:text-steel-orange" href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a></div>
            <div className="border-l-2 border-steel-orange pl-4"><p className="text-xs uppercase tracking-[.12em] text-white/45">Сайт</p><a className="mt-2 block font-semibold transition hover:text-steel-orange" href={siteConfig.url} target="_blank" rel="noreferrer">{siteConfig.hostDisplay}&nbsp; ↗</a></div>
            <div className="border-l-2 border-steel-orange pl-4"><p className="text-xs uppercase tracking-[.12em] text-white/45">Адрес производства</p><address className="mt-2 not-italic leading-relaxed text-white/82">{siteConfig.productionAddress.line1},<br />{siteConfig.productionAddress.line2}</address></div>
          </div>
          <div className="mt-8 border border-white/10 bg-black/20 p-4 text-xs leading-relaxed text-white/55"><b className="text-white">Форматы чертежей:</b><br />PDF, DXF, DWG, STEP, IGES, SLDPRT, IPT, изображения, офисные документы и архивы.</div>
          <div className="mt-3 border border-white/10 bg-black/20 p-4 text-xs leading-relaxed text-white/55"><b className="text-white">Лазерная резка чёрной стали:</b><br />толщина {laserCuttingCapabilities.thicknessRange}, рабочее поле стола {laserCuttingCapabilities.tableWorkingArea}. Давальческий материал принимаем после входного контроля.</div>
        </aside>
      </div>
    </section>
    <FaqSection items={contactFaq} title="Вопросы о заявке на расчёт" />
  </PageLayout></>;
}

import { QuoteRequestForm } from "@/components/QuoteRequestForm";
import { ConversionActions } from "@/components/ConversionActions";
import { PageLayout } from "@/components/PageLayout";
import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Получить расчёт металлоизделий",
  description: "Отправьте чертёж, DXF, DWG, PDF или техническое задание. Сталь Продукт подготовит расчёт и инженерное решение для вашего проекта.",
  path: "/contacts",
  keywords: ["расчёт металлоизделий", "заказать металлоизделия по чертежам", "DXF DWG производство"],
});

export default function ContactsPage() {
  return <PageLayout path="/contacts" eyebrow="Получить расчёт" title="Обсудим ваш проект" description="Прикрепите чертёж, спецификацию или опишите задачу — подготовим коммерческое предложение и предложим оптимальное решение.">
    <ConversionActions />
    <section id="contact-form" className="bg-[#101112] py-14 sm:py-20">
      <div className="container grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="border border-white/15 bg-[#151719] p-5 sm:p-8">
          <p className="eyebrow">Заявка на расчёт</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">Передайте исходные данные — мы подготовим решение</h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/60">Файлы поступят непосредственно в конструкторский и коммерческий отдел. При необходимости уточним технические детали до подготовки предложения.</p>
          <div className="mt-8"><QuoteRequestForm /></div>
        </div>

        <aside className="border border-white/15 bg-[#151719] p-6 sm:p-7">
          <p className="eyebrow">Контакты</p>
          <h2 className="mt-3 text-2xl font-semibold">Удобно обсудить задачу напрямую?</h2>
          <div className="mt-7 space-y-5 text-sm">
            <div className="border-l-2 border-steel-orange pl-4"><p className="text-xs uppercase tracking-[.12em] text-white/45">Телефон</p><a className="mt-2 block font-semibold transition hover:text-steel-orange" href="tel:+79107803723">+7 910 780 37 23</a></div>
            <div className="border-l-2 border-steel-orange pl-4"><p className="text-xs uppercase tracking-[.12em] text-white/45">Электронная почта</p><a className="mt-2 block font-semibold transition hover:text-steel-orange" href="mailto:info@steelprodukt.ru">info@steelprodukt.ru</a></div>
            <div className="border-l-2 border-steel-orange pl-4"><p className="text-xs uppercase tracking-[.12em] text-white/45">Сайт</p><a className="mt-2 block font-semibold transition hover:text-steel-orange" href="https://steelprodukt.ru" target="_blank" rel="noreferrer">steelprodukt.ru&nbsp; ↗</a></div>
            <div className="border-l-2 border-steel-orange pl-4"><p className="text-xs uppercase tracking-[.12em] text-white/45">Адрес производства</p><address className="mt-2 not-italic leading-relaxed text-white/82">г. Смоленск, Рославльское шоссе,<br />7-й км, стр. 3</address></div>
          </div>
          <div className="mt-8 border border-white/10 bg-black/20 p-4 text-xs leading-relaxed text-white/55"><b className="text-white">Форматы чертежей:</b><br />PDF, DXF, DWG, STEP, IGES, SLDPRT, IPT, изображения, офисные документы и архивы.</div>
        </aside>
      </div>
    </section>
  </PageLayout>;
}

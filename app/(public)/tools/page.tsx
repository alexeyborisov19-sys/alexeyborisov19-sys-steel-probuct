import { CustomerResources } from "@/components/commercial/CustomerResources";
import { PageLayout } from "@/components/PageLayout";
import { FreeServiceLink } from "@/components/FreeServiceLink";
import { AttributionLink } from "@/components/AttributionLink";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { freeServices } from "@/data/free-services";
import { createPageMetadata } from "@/lib/seo";
import { faqSchema } from "@/lib/schema";
const faq = [
  {question:"Нужна ли регистрация для бесплатного расчёта?",answer:"Нет. Можно загрузить CAD или ввести размеры без регистрации. Контактные данные понадобятся, если вы решите отправить заявку инженеру."},
  {question:"Можно ли посчитать изделие без чертежа?",answer:"Да. Введите максимальные размеры прямоугольной заготовки, толщину, количество и условные отверстия. Это предварительная оценка; перед изготовлением нужно согласовать геометрию."},
  {question:"Онлайн-цена окончательная?",answer:"Нет. Онлайн-расчёт предварительный и не является офертой. Итоговые стоимость, состав работ и сроки подтверждаются после инженерной проверки."},
  {question:"Что делать, если автоматический расчёт не подходит?",answer:"Передайте инженеру чертёж, эскиз или описание задачи. Укажите материал и количество, если они известны. Отсутствующие параметры можно уточнить при обсуждении заказа."},
];
export const metadata = createPageMetadata({title:"Бесплатные калькуляторы металла, корзин и BIM-модели",description:"Бесплатно рассчитайте изделие по DXF, STEP или размерам без регистрации. Подбор корзин кондиционеров по размерам и количеству, калькулятор металлокассет, IFC-модели и шаблон задания.",path:"/tools"});
export default function ToolsPage(){return <PageLayout compactHero eyebrow="Инструменты для вашего проекта" title="Бесплатные сервисы" description="Начните с того, что уже есть: чертежа, размеров или задачи. Получите предварительный результат, а затем передайте проект инженеру." path="/tools">
  <JsonLd data={faqSchema(faq)} />
  <section className="bg-[#101519] py-10 sm:py-14" aria-label="Выберите задачу">
    <div className="container">
      <p className="mb-6 text-base text-white/75">Без регистрации для расчёта. Без обязательной заявки. Вы сами выбираете следующий шаг.</p>
      <div className="grid gap-5 md:grid-cols-2">{freeServices.map((tool,index)=><article key={tool.id} className="flex flex-col rounded-xl border border-white/15 bg-[#172129] p-6 sm:p-8">
        <p className="font-mono text-sm text-steel-orange">0{index+1} · Бесплатно</p><h2 className="mt-3 text-xl font-semibold sm:text-2xl">{tool.title}</h2>
        <p className="mt-4 text-base leading-7 text-white/80">{tool.description}</p><p className="mb-6 mt-3 text-sm leading-6 text-white/70">{tool.result}</p>
        <FreeServiceLink href={tool.href} service={tool.id}>{tool.action}</FreeServiceLink>
      </article>)}</div>
    </div>
  </section>
  <section className="border-y border-white/10 bg-[#111519] py-10" aria-labelledby="brief-title"><div className="container grid gap-8 md:grid-cols-2">
    <div><h2 id="brief-title" className="text-2xl font-semibold">Подготовьте задание на изготовление</h2><p className="mt-4 leading-7 text-white/80">Скачайте текстовый шаблон, заполните известные параметры и приложите его к заявке вместе с чертежом. Неизвестные значения оставьте для уточнения.</p><a download href="/documents/zadanie-na-izgotovlenie.txt" className="mt-5 inline-flex min-h-12 items-center rounded-lg border border-steel-orange/60 px-5 py-3 font-semibold text-steel-orange">Скачать шаблон задания · TXT ↓</a></div>
    <div><h3 className="text-lg font-semibold">Что поможет подготовить предложение</h3><ul className="mt-4 list-disc space-y-3 pl-5 text-white/80"><li>Чертёж, модель или эскиз с размерами.</li><li>Материал, толщина и количество изделий.</li><li>Гибка, сварка, отверстия и другие операции.</li><li>Покрытие, требования к качеству и желаемый срок.</li></ul></div>
  </div></section>
  <section className="bg-[#172129] py-10"><div className="container flex flex-wrap items-center justify-between gap-6"><div className="max-w-2xl"><h2 className="text-2xl font-semibold">Нужен расчёт сложного заказа?</h2><p className="mt-3 leading-7 text-white/80">Пришлите исходные данные инженеру. Уточним состав работ, недостающие параметры и подготовим предложение.</p></div><AttributionLink prefetch={false} href="/contacts#contact-form" className="inline-flex min-h-12 items-center rounded-lg bg-steel-orange px-6 py-3 font-semibold text-black">Отправить проект инженеру →</AttributionLink></div></section>
  <FaqSection items={faq} title="Как пользоваться бесплатными сервисами" />
<CustomerResources />
</PageLayout>}

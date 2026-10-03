import { PageLayout } from "@/components/PageLayout";
import { AttributionLink } from "@/components/AttributionLink";
import { JsonLd } from "@/components/JsonLd";
import { CustomerResources } from "@/components/commercial/CustomerResources";
import {
  EnquiryFinish,
  SectionHeading,
} from "@/components/commercial/LandingSections";
import { customerGuides } from "@/data/customer-guides";
import { createPageMetadata } from "@/lib/seo";
import { itemListSchema } from "@/lib/schema";
const title = "Заказчику: подготовка заказа металлоизделий";
const description =
  "Выберите путь от задачи к изготовлению: подготовка чертежей, материал и покрытие, онлайн-расчёт, согласование заказа и отгрузка готовой партии.";
export const metadata = createPageMetadata({
  title,
  description,
  path: "/customers",
});
const routes = [
  {
    tag: "Есть чертёж",
    title: "Изготовить по документации",
    text: "Передайте геометрию, спецификацию и требования. Оценим весь маршрут: резку, гибку, сварку, покрытие и сборку.",
    href: "/solutions/custom",
    label: "Изготовление по чертежам",
  },
  {
    tag: "Нужен ориентир по цене",
    title: "Посчитать деталь онлайн",
    text: "Бесплатная предварительная оценка по CAD или размерам. Результат требует проверки перед согласованием производства.",
    href: "/online-order",
    label: "Открыть бесплатный расчёт",
  },
  {
    tag: "Есть идея или эскиз",
    title: "Подготовить конструкцию",
    text: "Начните с назначения, габаритов и условий работы. Инженерная подготовка поможет определить необходимые исходные данные.",
    href: "/production/proektirovanie-metalloizdeliy",
    label: "Проектирование и КД",
  },
  {
    tag: "Нужны фасадные изделия",
    title: "Выбрать готовое направление",
    text: "Металлокассеты, корзины, решётки и доборные элементы: изучите варианты и передайте параметры своего проекта.",
    href: "/products",
    label: "Перейти к продукции",
  },
];
export default function CustomersPage() {
  return (
    <>
      <JsonLd
        data={itemListSchema({
          name: title,
          description,
          path: "/customers",
          items: customerGuides.map((g) => ({
            name: g.title,
            path: "/customers/" + g.slug,
          })),
        })}
      />
      <PageLayout
        path="/customers"
        eyebrow="Сталь Продукт / Заказчику"
        title="Хороший заказ начинается с понятной задачи"
        description={description}
        image="/images/real-production/engineering-department.jpg"
        imageAlt="Инженерная подготовка заказа в Сталь Продукт"
      >
        <section className="bg-[#101416] py-14 sm:py-20">
          <div className="container">
            <SectionHeading
              eyebrow="Выберите свою ситуацию"
              title="Отправная точка уже есть"
              text="Не обязательно разбираться во всём производственном цикле. Начните с того, что у вас готово."
            />
            <div className="mt-9 grid gap-4 lg:grid-cols-2">
              {routes.map((route, i) => (
                <article
                  key={route.href}
                  className="flex flex-col border border-white/20 bg-[#181c1f] p-6 sm:p-8"
                >
                  <p className="text-sm font-semibold text-steel-orange">
                    0{i + 1} / {route.tag}
                  </p>
                  <h3 className="mt-5 text-2xl font-semibold">{route.title}</h3>
                  <p className="mb-7 mt-4 max-w-xl leading-7 text-white/80">
                    {route.text}
                  </p>
                  <AttributionLink
                    href={route.href}
                    className="mt-auto inline-flex min-h-12 items-center justify-between gap-4 border-t border-white/20 pt-4 font-semibold hover:text-steel-orange"
                  >
                    {route.label}
                    <span aria-hidden="true">→</span>
                  </AttributionLink>
                </article>
              ))}
            </div>
          </div>
        </section>
        <CustomerResources />
        <section className="bg-[#eeefeb] py-14 text-[#151a1d]">
          <div className="container grid gap-9 lg:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest">
                Сначала проверяем, потом запускаем
              </p>
              <h2 className="mt-4 text-3xl font-semibold">
                Что помогает получить точное предложение
              </h2>
              <p className="mt-5 leading-7">
                Согласованный комплект показывает не только форму изделия, но и
                условия, при которых вы его примете. Неизвестные параметры можно
                обсудить с инженером.
              </p>
              <a
                download
                href="/documents/zadanie-na-izgotovlenie.txt"
                className="mt-6 inline-flex min-h-12 items-center border-2 border-[#151a1d] px-5 py-3 font-semibold hover:bg-white"
              >
                Шаблон задания · TXT ↓
              </a>
            </div>
            <ol className="space-y-4">
              {[
                "Геометрия и действующая редакция чертежа.",
                "Материал, толщина и количество по позициям.",
                "Гибка, сварка, отверстия, покрытие и сборка.",
                "Критичные размеры, внешний вид и комплектность.",
                "Желаемая дата, город и условия получения.",
              ].map((s, i) => (
                <li
                  className="flex gap-4 border-b border-black/20 pb-4"
                  key={s}
                >
                  <span className="font-mono font-bold">0{i + 1}</span>
                  <span className="leading-7">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="bg-[#101416] py-12">
          <div className="container">
            <h2 className="text-2xl font-semibold">
              Проверьте возможности до обращения
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Производство и оборудование",
                  text: "Подтверждённые возможности и этапы изготовления.",
                  href: "/production",
                },
                {
                  title: "Контроль и упаковка",
                  text: "Что согласовать для приёмки и сохранности партии.",
                  href: "/production/kontrol-kachestva-i-upakovka",
                },
                {
                  title: "Бесплатные сервисы и BIM",
                  text: "Расчёты, модели металлокассет и задание инженеру.",
                  href: "/tools",
                },
              ].map((x) => (
                <AttributionLink
                  href={x.href}
                  key={x.href}
                  className="border border-white/20 p-6 hover:border-steel-orange"
                >
                  <h3 className="text-lg font-semibold">{x.title} →</h3>
                  <p className="mt-3 leading-7 text-white/80">{x.text}</p>
                </AttributionLink>
              ))}
            </div>
          </div>
        </section>
        <EnquiryFinish
          title="Расскажите, что нужно изготовить"
          text="Приложите имеющиеся данные. Инженер уточнит параметры, которые влияют на конструкцию, стоимость и срок."
        />
      </PageLayout>
    </>
  );
}

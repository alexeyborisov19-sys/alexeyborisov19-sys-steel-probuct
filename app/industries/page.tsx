import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Решения для отраслей и объектов",
  description: "Изделия из листового металла для жилых комплексов, бизнес-центров, промышленности, энергетики, ЦОД и инженерной инфраструктуры.",
  path: "/industries",
  keywords: ["металлоизделия для строительства", "фасадные решения", "корпуса оборудования", "инженерные системы"],
});

const industries = ["Жилые комплексы", "Бизнес-центры", "Торговые центры", "Медицинские учреждения", "Образовательные учреждения", "Гостиницы и апарт-отели", "Инженерная инфраструктура", "Производственные предприятия", "Агропромышленный комплекс", "Энергетика", "Нефтегазовая отрасль", "Транспортная инфраструктура", "Пищевая промышленность", "Фармацевтическая промышленность", "ЦОД и технологическая инфраструктура", "Машиностроение и приборостроение"];
const products = ["Металлокассеты", "Архитектурные панели", "Корзины для кондиционеров", "Кронштейны", "Вентиляционные решетки", "Люки доступа"];

const visualByCard = [
  "residential.png",
  "business-center.png",
  "manufacturing.png",
  "medical.png",
  "educational.png",
  "hotel.png",
  "infrastructure.png",
  "production.png",
  "agro.png",
  "energy.png",
  "oil-gas.png",
  "transport.png",
  "food.png",
  "pharmaceutical.png",
  "data-center.png",
  "machine-building.png",
];
export default function IndustriesPage() { return <PageLayout path="/industries" eyebrow="Решения для объектов" title="Решения для отраслей и объектов" description="Комплексные решения из листового металла для строительства, промышленности и инженерной инфраструктуры. Выберите направление и ознакомьтесь с продукцией и реализованными проектами." image="/images/industry/hero-building-v1.png"><section className="bg-[#0c1013] py-14"><div className="container"><div className="flex flex-wrap gap-3"><Link href="/contacts#contact-form" className="bg-steel-orange px-5 py-3 text-xs font-bold uppercase">Получить расчет&nbsp; →</Link><Link href="/production" className="border border-white/30 px-5 py-3 text-xs font-bold uppercase">Посмотреть производство&nbsp; →</Link></div><div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{industries.map((title,index) => <article key={title} className="border border-white/15 bg-[#111519] p-4"><div className="solution-media -mx-4 -mt-4 mb-5 h-28" style={{ backgroundImage: `url('/images/industries/${visualByCard[index]}')` }} /><h2 className="text-xl font-semibold leading-tight">{title}</h2><ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5">{products.slice(0,index % 2 ? 5:6).map((product) => <li key={product} className="text-[11px] leading-[1.35] text-white/70 before:mr-1 before:text-steel-orange before:content-['•']">{product}</li>)}</ul><Link href="/projects" className="mt-5 block border-t border-white/10 pt-4 text-xs font-bold uppercase text-steel-orange">Смотреть реализованные объекты&nbsp; →</Link></article>)}</div></div></section></PageLayout>; }

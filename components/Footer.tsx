import Link from "next/link";
import { legalLinks, legalOperator } from "@/lib/legal";
import { Brand } from "./Brand";
import { CookieSettingsButton } from "./CookieConsent";

const columns = [
  ["Компания", ["О компании", "Преимущества", "Сертификаты", "Журнал «Сталь Продукт»"]],
  ["Решения", ["Архитектурные", "Для кондиционирования", "Для промышленности", "Инженерные системы"]],
  ["Для объектов", ["Строительство", "Промышленность", "Инженерная инфраструктура"]],
  ["Производство", ["Производственный процесс", "Контроль качества", "Материалы и покрытия"]],
] as const;

const footerLinks: Record<string, string> = {
  "О компании": "/company",
  "Преимущества": "/company#advantages",
  "Сертификаты": "/company#certificates",
  "Архитектурные": "/products",
  "Для кондиционирования": "/solutions/climate",
  "Для промышленности": "/solutions/industry",
  "Инженерные системы": "/solutions/engineering",
  "Строительство": "/industries",
  "Промышленность": "/industries",
  "Инженерная инфраструктура": "/industries",
  "Производственный процесс": "/production",
  "Контроль качества": "/production",
  "Материалы и покрытия": "/production",
  "Журнал «Сталь Продукт»": "/articles",
};

const legalDocuments = [
  ["Политика обработки данных", legalLinks.privacy],
  ["Согласие на обработку данных", legalLinks.personalDataConsent],
  ["Согласие на рассылку", legalLinks.marketingConsent],
  ["Политика cookies", legalLinks.cookies],
  ["Сервисы обработки данных", legalLinks.services],
  ["Пользовательское соглашение", legalLinks.terms],
  ["Реквизиты", legalLinks.requisites],
] as const;

export function Footer() {
  return <footer className="border-t border-white/10 bg-black py-10">
    <div className="container">
      <div className="grid gap-9 lg:grid-cols-[1.35fr_repeat(4,1fr)_1.1fr]">
        <div>
          <Brand />
          <p className="mt-4 max-w-[180px] text-xs leading-relaxed text-white/50">Инженерные решения<br />из листового металла</p>
        </div>
        {columns.map(([title, links]) => <div key={title}>
          <p className="text-xs font-bold uppercase text-white">{title}</p>
          <ul className="mt-4 space-y-2">
            {links.map((label) => <li key={label}><Link href={footerLinks[label]} className="text-[11px] text-white/50 transition hover:text-steel-orange">{label}</Link></li>)}
          </ul>
        </div>)}
        <div>
          <p className="text-xs font-bold uppercase text-white">Контакты</p>
          <a className="mt-4 block text-xs text-white" href="tel:+79107803723">+7 910 780 37 23</a>
          <a className="mt-2 block text-xs text-white/55" href="mailto:info@steelprodukt.ru">info@steelprodukt.ru</a>
          <a className="mt-2 block text-xs text-white/55 transition hover:text-steel-orange" href="https://steelprodukt.ru" target="_blank" rel="noreferrer">steelprodukt.ru ↗</a>
          <p className="mt-3 text-xs leading-relaxed text-white/55"><span className="text-white/38">Производство:</span><br />г. Смоленск,<br />Рославльское шоссе,<br />7-й км, стр. 3</p>
        </div>
      </div>
      <div className="mt-9 border-t border-white/10 pt-5">
        <p className="text-[10px] font-bold uppercase tracking-[.12em] text-white/40">Правовые документы</p>
        <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {legalDocuments.map(([label, href]) => <Link key={href} href={href} className="text-[10px] text-white/45 transition hover:text-steel-orange">{label}</Link>)}
          <CookieSettingsButton className="text-left text-[10px] text-white/45 transition hover:text-steel-orange" />
          <a href="/sitemap.xml" className="text-[10px] text-white/45 transition hover:text-steel-orange">Карта сайта</a>
        </nav>
      </div>
      <div className="mt-5 flex flex-col gap-2 border-t border-white/8 pt-5 text-[10px] leading-relaxed text-white/35 lg:flex-row lg:items-end lg:justify-between">
        <p>© 2026 Сталь Продукт. Все права защищены.</p>
        <p className="max-w-3xl lg:text-right">
          Владелец сайта и оператор персональных данных: {legalOperator.shortName}, ИНН {legalOperator.inn}, ОГРН {legalOperator.ogrn}.<br />
          Юридический адрес: {legalOperator.legalAddress}.
        </p>
      </div>
    </div>
  </footer>;
}

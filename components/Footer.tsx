import Link from "next/link";
import { legalLinks, legalOperator } from "@/lib/legal";
import { Brand } from "./Brand";
import { CookieSettingsButton } from "./CookieConsent";

const columns = [
  ["Компания", ["О компании", "Преимущества", "Инженерный журнал «Сталь Продукт»"]],
  ["Решения", ["Архитектурные", "Для кондиционирования", "Для промышленности", "Инженерные системы"]],
  ["Для объектов", ["Строительство", "Промышленность", "Инженерная инфраструктура"]],
  ["Производство", ["Производственный процесс", "Контроль качества", "Материалы и покрытия"]],
] as const;

const footerLinks: Record<string, string> = {
  "О компании": "/company",
  "Преимущества": "/company#advantages",
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
  "Инженерный журнал «Сталь Продукт»": "/articles",
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
            {links.map((label) => <li key={label}><Link href={footerLinks[label]} className="text-xs text-white/60 transition hover:text-steel-orange">{label}</Link></li>)}
          </ul>
        </div>)}
        <div>
          <p className="text-sm font-bold uppercase tracking-[.08em] text-white">Контакты</p>
          <a className="mt-4 block text-lg font-semibold leading-tight text-white transition hover:text-steel-orange" href="tel:+79107803723">+7 910 780 37 23</a>
          <a className="mt-3 block text-base font-medium text-white/75 transition hover:text-steel-orange" href="mailto:info@steelprodukt.ru">info@steelprodukt.ru</a>
          <a className="mt-2 block text-sm text-white/65 transition hover:text-steel-orange" href="https://www.steelprodukt.ru" target="_blank" rel="noreferrer">steelprodukt.ru ↗</a>
          <p className="mt-4 text-sm leading-relaxed text-white/65"><span className="font-medium text-white/45">Производство:</span><br />г. Смоленск,<br />Рославльское шоссе,<br />7-й км, стр. 3</p>
        </div>
      </div>
      <div className="mt-9 border-t border-white/10 pt-5">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-white/60">Правовые документы</p>
        <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {legalDocuments.map(([label, href]) => <Link key={href} href={href} className="text-xs text-white/60 transition hover:text-steel-orange">{label}</Link>)}
          <CookieSettingsButton className="text-left text-xs text-white/60 transition hover:text-steel-orange" />
          <a href="/sitemap.xml" className="text-xs text-white/60 transition hover:text-steel-orange">Карта сайта</a>
        </nav>
      </div>
      <div className="mt-5 flex flex-col gap-2 border-t border-white/8 pt-5 text-xs leading-relaxed text-white/55 lg:flex-row lg:items-end lg:justify-between">
        <p>© 2026 Сталь Продукт. Все права защищены.</p>
        <p className="max-w-3xl lg:text-right">
          Владелец сайта и оператор персональных данных: {legalOperator.shortName}, ИНН {legalOperator.inn}, ОГРН {legalOperator.ogrn}.<br />
          Юридический адрес: {legalOperator.legalAddress}.
        </p>
      </div>
    </div>
  </footer>;
}

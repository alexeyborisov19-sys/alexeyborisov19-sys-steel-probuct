import Link from "next/link";
import { brandOfficialProfiles } from "@/data/entity-references";
import { legalLinks, legalOperator } from "@/lib/legal";
import { siteConfig } from "@/lib/site";
import { Brand } from "./Brand";
import { CookieSettingsButton } from "./CookieConsent";

const columns = [
  ["Компания", ["О компании", "Факты о производстве", "Преимущества", "Проекты", "Инженерный журнал «Сталь Продукт»"]],
  ["Решения", ["Архитектурные", "Для кондиционирования", "Для промышленности", "Инженерные системы", "Индивидуальные решения"]],
  ["Для объектов", ["Жилые комплексы", "Производственные предприятия", "Инженерная инфраструктура"]],
  ["Производство", ["Производственный процесс", "Контроль качества", "Материалы и покрытия"]],
] as const;

const footerLinks: Record<string, string> = {
  "О компании": "/company",
  "Факты о производстве": "/company/facts",
  "Преимущества": "/company#advantages",
  "Проекты": "/projects",
  "Архитектурные": "/products",
  "Для кондиционирования": "/solutions/climate",
  "Для промышленности": "/solutions/industry",
  "Инженерные системы": "/solutions/engineering",
  "Индивидуальные решения": "/solutions/custom",
  "Жилые комплексы": "/industries/zhilye-kompleksy",
  "Производственные предприятия": "/industries/proizvodstvennye-predpriyatiya",
  "Инженерная инфраструктура": "/industries/inzhenernaya-infrastruktura",
  "Производственный процесс": "/production",
  "Контроль качества": "/production",
  "Материалы и покрытия": "/production",
  "Инженерный журнал «Сталь Продукт»": "/articles",
};

const keyCommercialLinks = [
  ["Металлокассеты", "/products/metallokassety"],
  ["Корзины для кондиционеров", "/products/korziny-dlya-konditsionerov"],
  ["Вентиляционные решётки", "/products/ventilyacionnye-reshetki"],
  ["Металлические корпуса", "/products/metallicheskie-korpusa"],
  ["Закладные детали", "/products/zakladnye-detali"],
  ["Проекты", "/projects"],
] as const;

const legalDocuments = [
  ["Политика обработки данных", legalLinks.privacy],
  ["Согласие на обработку данных", legalLinks.personalDataConsent],
  ["Согласие на рассылку", legalLinks.marketingConsent],
  ["Политика cookies", legalLinks.cookies],
  ["Сервисы обработки данных", legalLinks.services],
  ["Пользовательское соглашение", legalLinks.terms],
  ["Реквизиты", legalLinks.requisites],
] as const;

export function Footer({ workspace = false }: { workspace?: boolean } = {}) {
  return <footer className="border-t border-white/10 bg-black py-10">
    <div className="container">
      <div className={workspace ? "grid gap-9 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[1.35fr_repeat(4,1fr)_1.1fr]" : "grid gap-9 lg:grid-cols-[1.35fr_repeat(4,1fr)_1.1fr]"}>
        <div>
          <Brand />
        </div>
        {columns.map(([title, links]) => <div key={title}>
          <p className="text-xs font-bold uppercase text-white">{title}</p>
          <ul className="mt-4 space-y-2">
            {links.map((label) => <li key={label}><Link href={footerLinks[label]} className="text-xs text-white/60 transition hover:text-steel-orange">{label}</Link></li>)}
          </ul>
        </div>)}
        <div>
          <p className="text-sm font-bold uppercase tracking-[.08em] text-white">Контакты</p>
          <a className="mt-4 block text-lg font-semibold leading-tight text-white transition hover:text-steel-orange" href={`tel:${siteConfig.telephone}`}>{siteConfig.telephoneDisplay}</a>
          <a className="mt-3 block text-base font-medium text-white/75 transition hover:text-steel-orange" href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
          {siteConfig.maxUrl ? <a className="mt-2 block text-sm font-medium text-white/75 transition hover:text-steel-orange" href={siteConfig.maxUrl} target="_blank" rel="noopener noreferrer">MAX — написать ↗</a> : null}
          <a className="mt-2 block text-sm text-white/65 transition hover:text-steel-orange" href={siteConfig.url} target="_blank" rel="noreferrer">{siteConfig.hostDisplay} ↗</a>
          {brandOfficialProfiles.map((profile) => (
            <a
              key={profile.url}
              className="mt-2 block text-sm text-white/65 transition hover:text-steel-orange"
              href={profile.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {profile.name} — официальный профиль ↗
            </a>
          ))}
          <p className="mt-4 text-sm leading-relaxed text-white/65"><span className="font-medium text-white/45">Производство:</span><br />{siteConfig.productionAddress.line1},<br />{siteConfig.productionAddress.line2}</p>
        </div>
      </div>
      <div className="mt-9 border-t border-white/10 pt-5">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-white/60">Ключевые направления</p>
        <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2" aria-label="Ключевые направления продукции">
          {keyCommercialLinks.map(([label, href]) => <Link key={href} href={href} className="text-xs text-white/60 transition hover:text-steel-orange">{label}</Link>)}
        </nav>
      </div>
      <div className="mt-5 border-t border-white/10 pt-5">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-white/60">Правовые документы</p>
        <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2" aria-label="Правовые документы и настройки">
          {legalDocuments.map(([label, href]) => <Link key={href} href={href} prefetch={false} className="text-xs text-white/60 transition hover:text-steel-orange">{label}</Link>)}
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
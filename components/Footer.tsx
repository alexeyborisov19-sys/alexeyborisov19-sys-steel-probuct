import Link from "next/link";
import { Brand } from "./Brand";

const columns = [
  ["Компания", ["О компании", "Преимущества", "Сертификаты"]],
  ["Решения", ["Архитектурные", "Для кондиционирования", "Для промышленности", "Инженерные системы"]],
  ["Для объектов", ["Строительство", "Промышленность", "Инженерная инфраструктура"]],
  ["Производство", ["Производственный процесс", "Контроль качества", "Материалы и покрытия"]],
];

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
};

export function Footer() { return <footer className="border-t border-white/10 bg-black py-10"><div className="container"><div className="grid gap-9 lg:grid-cols-[1.35fr_repeat(4,1fr)_1.1fr]"><div><Brand /><p className="mt-4 max-w-[180px] text-xs leading-relaxed text-white/50">Инженерные решения<br />из листового металла</p></div>{columns.map(([title, links]) => <div key={title as string}><p className="text-xs font-bold uppercase text-white">{title}</p><ul className="mt-4 space-y-2">{(links as string[]).map((label) => <li key={label}><Link href={footerLinks[label] ?? "/contacts#contact-form"} className="text-[11px] text-white/50 transition hover:text-steel-orange">{label}</Link></li>)}</ul></div>)}<div><p className="text-xs font-bold uppercase text-white">Контакты</p><a className="mt-4 block text-xs text-white" href="tel:+79107803723">+7 910 780 37 23</a><a className="mt-2 block text-xs text-white/55" href="mailto:info@steelprodukt.ru">info@steelprodukt.ru</a><a className="mt-2 block text-xs text-white/55 transition hover:text-steel-orange" href="https://steelprodukt.ru" target="_blank" rel="noreferrer">steelprodukt.ru ↗</a><p className="mt-3 text-xs leading-relaxed text-white/55">г. Смоленск,<br />Рославльское шоссе,<br />7-й км, стр. 3</p></div></div><div className="mt-9 flex flex-col gap-2 border-t border-white/10 pt-5 text-[10px] text-white/35 sm:flex-row sm:justify-between"><span>© 2025 Сталь Продукт. Все права защищены.</span><span>Политика конфиденциальности   Карта сайта</span></div></div></footer>; }

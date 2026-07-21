"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Brand } from "./Brand";
import { MegaMenu } from "./MegaMenu";

const navigation = [
  { label: "Компания", href: "/company" },
  { label: "Решения для объектов", href: "/industries" },
  { label: "Производство", href: "/production" },
  { label: "Проекты", href: "/projects" },
  { label: "Контакты", href: "/contacts" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const pathname = usePathname();
  const navClass = (active: boolean) => `header-nav-link ${active ? "header-nav-link-active" : ""}`;
  return <header className="absolute inset-x-0 top-0 z-40 border-b border-white/15 bg-black/90 backdrop-blur-md">
    <div className="container flex h-[72px] items-center justify-between gap-4">
      <Link href="/" aria-label="На главную"><Brand /></Link>
      <nav className="header-nav hidden items-stretch self-stretch xl:flex">
        <Link className={navClass(pathname === "/company")} href="/company"><span>Компания</span></Link>
        <button className={navClass(pathname.startsWith("/solutions") || solutionsOpen)} onMouseEnter={() => setSolutionsOpen(true)} onClick={() => setSolutionsOpen((value) => !value)}><span>Решения</span><b aria-hidden="true">{solutionsOpen ? "⌃" : "⌄"}</b></button>
        {navigation.slice(1).map((item) => <Link key={item.href} className={navClass(pathname === item.href)} href={item.href}><span>{item.label}</span></Link>)}
      </nav>
      <div className="hidden items-center gap-4 lg:flex"><a href="tel:+79107803723" className="text-xs font-semibold">⌕&nbsp; +7 910 780 37 23</a><Link href="/contacts#contact-form" className="clip-corner bg-steel-orange px-4 py-3 text-[10px] font-bold uppercase tracking-wider transition hover:bg-orange-600">Получить расчет</Link></div>
      <button onClick={() => setMobileOpen(!mobileOpen)} className="grid h-10 w-10 place-items-center border border-white/30 lg:hidden" aria-label="Открыть меню"><span className="text-xl">{mobileOpen ? "×" : "☰"}</span></button>
    </div>
    {solutionsOpen && <MegaMenu onClose={() => setSolutionsOpen(false)} />}
    {mobileOpen && <nav className="container flex flex-col gap-5 border-t border-white/15 py-6 lg:hidden"><Link href="/solutions" onClick={() => setMobileOpen(false)}>Решения</Link>{navigation.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>{item.label}</Link>)}<a href="tel:+79107803723" className="text-steel-orange">+7 910 780 37 23</a></nav>}
  </header>;
}

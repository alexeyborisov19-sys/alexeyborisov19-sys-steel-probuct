"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { siteMode } from "@/data/site-mode";
import { Brand } from "./Brand";
import { MegaMenu } from "./MegaMenu";

const navigation = [
  { label: "Компания", href: "/company" },
  { label: "Решения для объектов", href: "/industries" },
  { label: "Производство", href: "/production" },
  { label: "Проекты", href: "/projects" },
  { label: "Инженерный журнал", href: "/articles" },
  { label: "Контакты", href: "/contacts" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const pathname = usePathname();
  const navClass = (active: boolean) => `header-nav-link ${active ? "header-nav-link-active" : ""}`;

  useEffect(() => {
    setMobileOpen(false);
    setSolutionsOpen(false);
  }, [pathname]);

  return <header className="absolute inset-x-0 top-0 z-40 border-b border-white/15 bg-black/92 backdrop-blur-md">
    {siteMode.isTest ? <div role="status" className="flex h-7 items-center justify-center bg-steel-orange px-4 text-center text-[10px] font-bold uppercase tracking-[.14em] text-black sm:text-[11px]">{siteMode.label}</div> : null}
    <div className="header-shell flex h-[76px] items-center gap-3">
      <Link href="/" aria-label="На главную" className="header-brand shrink-0"><Brand /></Link>
      <nav className="header-nav hidden items-stretch self-stretch xl:flex">
        <Link className={navClass(pathname === "/company")} href="/company"><span>Компания</span></Link>
        <button className={navClass(pathname.startsWith("/solutions") || solutionsOpen)} onMouseEnter={() => setSolutionsOpen(true)} onClick={() => setSolutionsOpen((value) => !value)}><span>Решения</span><b aria-hidden="true">{solutionsOpen ? "⌃" : "⌄"}</b></button>
        {navigation.slice(1).map((item) => <Link key={item.href} className={navClass(pathname === item.href)} href={item.href}><span>{item.label}</span></Link>)}
      </nav>
      <div className="header-actions ml-auto hidden shrink-0 items-center gap-3 xl:flex">
        <a href="tel:+79107803723" className="header-phone hidden whitespace-nowrap font-semibold 2xl:block">+7 910 780 37 23</a>
        <Link href="/contacts#contact-form" className="clip-corner whitespace-nowrap bg-steel-orange px-4 py-3 text-[10px] font-bold uppercase tracking-wider transition hover:bg-orange-600">Получить расчёт</Link>
      </div>
      <button onClick={() => setMobileOpen(!mobileOpen)} className="ml-auto grid h-10 w-10 shrink-0 place-items-center border border-white/30 xl:hidden" aria-label="Открыть меню" aria-expanded={mobileOpen}><span className="text-xl">{mobileOpen ? "×" : "☰"}</span></button>
    </div>
    {solutionsOpen && <MegaMenu onClose={() => setSolutionsOpen(false)} />}
    {mobileOpen && <nav className="header-mobile-nav container flex flex-col border-t border-white/15 py-4 xl:hidden">
      <Link href="/solutions">Решения</Link>
      {navigation.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
      <a href="tel:+79107803723" className="text-steel-orange">+7 910 780 37 23</a>
      <Link href="/contacts#contact-form" className="mt-2 bg-steel-orange px-4 py-3 text-center text-xs font-bold uppercase">Получить расчёт</Link>
    </nav>}
  </header>;
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/lib/site";
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
  const solutionsButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const navClass = (active: boolean) => `header-nav-link ${active ? "header-nav-link-active" : ""}`;

  useEffect(() => {
    setMobileOpen(false);
    setSolutionsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen && !solutionsOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      const trigger = mobileOpen
        ? mobileMenuButtonRef.current
        : solutionsOpen
          ? solutionsButtonRef.current
          : null;

      setMobileOpen(false);
      setSolutionsOpen(false);
      trigger?.focus();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen, solutionsOpen]);

  function skipToContent() {
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) return;
    main.id = main.id || "main-content";
    main.tabIndex = -1;
    main.focus();
  }

  return <header className="absolute inset-x-0 top-0 z-40 border-b border-white/15 bg-black/92 backdrop-blur-md">
    <a
      href="#main-content"
      onClick={(event) => {
        event.preventDefault();
        skipToContent();
      }}
      className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:bg-steel-orange-deep focus:px-4 focus:py-3 focus:text-xs focus:font-bold focus:uppercase focus:text-white"
    >
      Перейти к содержимому
    </a>
    <div className="header-shell flex h-[76px] items-center gap-3">
      <Link href="/" aria-label="На главную" className="header-brand shrink-0"><Brand /></Link>
      <nav aria-label="Основная навигация" className="header-nav hidden items-stretch self-stretch xl:flex">
        <Link className={navClass(isActive("/company"))} href="/company" aria-current={isActive("/company") ? "page" : undefined}><span>Компания</span></Link>
        <button
          ref={solutionsButtonRef}
          type="button"
          className={navClass(pathname.startsWith("/solutions") || solutionsOpen)}
          onMouseEnter={() => setSolutionsOpen(true)}
          onClick={() => setSolutionsOpen((value) => !value)}
          aria-expanded={solutionsOpen}
          aria-haspopup="true"
          aria-controls="solutions-mega-menu"
        ><span>Решения</span><b aria-hidden="true">{solutionsOpen ? "⌃" : "⌄"}</b></button>
        {navigation.slice(1).map((item) => {
          const active = isActive(item.href);
          return <Link key={item.href} className={navClass(active)} href={item.href} aria-current={active ? "page" : undefined}><span>{item.label}</span></Link>;
        })}
      </nav>
      <div className="header-actions ml-auto hidden shrink-0 items-center gap-3 xl:flex">
        <a href={`tel:${siteConfig.telephone}`} className="header-phone hidden whitespace-nowrap font-semibold 2xl:block">{siteConfig.telephoneDisplay}</a>
        <Link href="/contacts#contact-form" className="clip-corner whitespace-nowrap bg-steel-orange-deep px-4 py-3 text-xs font-bold uppercase tracking-wider transition hover:bg-steel-orange-deeper">Получить расчёт</Link>
      </div>
      <button
        ref={mobileMenuButtonRef}
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="ml-auto grid h-11 w-11 shrink-0 place-items-center border border-white/30 xl:hidden"
        aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
        aria-expanded={mobileOpen}
        aria-controls="mobile-navigation"
      ><span className="text-xl" aria-hidden="true">{mobileOpen ? "×" : "☰"}</span></button>
    </div>
    {solutionsOpen && <MegaMenu onClose={() => setSolutionsOpen(false)} />}
    {mobileOpen && <nav id="mobile-navigation" aria-label="Мобильная навигация" className="header-mobile-nav container flex flex-col border-t border-white/15 py-4 xl:hidden">
      <Link href="/solutions" aria-current={pathname.startsWith("/solutions") ? "page" : undefined}>Решения</Link>
      {navigation.map((item) => {
        const active = isActive(item.href);
        return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>{item.label}</Link>;
      })}
      <a href={`tel:${siteConfig.telephone}`} className="text-steel-orange">{siteConfig.telephoneDisplay}</a>
      <Link href="/contacts#contact-form" className="mt-2 bg-steel-orange-deep px-4 py-3 text-center text-xs font-bold uppercase">Получить расчёт</Link>
    </nav>}
  </header>;
}

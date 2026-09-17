import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { siteConfig } from "@/lib/site";

// Next resolves a notFound() call to the nearest not-found file up the tree, and an
// unmatched URL to this root one, so a single file covers both. Without it a visitor
// from a stale link lands on the built-in English stub rendered in the bare root
// layout: no header, no footer and not one link back into the site.
const sections = [
  { href: "/products", label: "Продукция" },
  { href: "/production", label: "Производство" },
  { href: "/solutions", label: "Решения" },
  { href: "/industries", label: "Решения для объектов" },
  { href: "/projects", label: "Проекты" },
  { href: "/articles", label: "Инженерный журнал" },
  { href: "/contacts", label: "Контакты" },
];

export default function NotFound() {
  return <>
    {/* The project's own SEO audit requires the 404 response to carry noindex
        (scripts/audit-seo.mjs). Declaring it here rather than relying on whatever a
        custom not-found file inherits keeps that guarantee in one visible place;
        React hoists the tag into the document head. */}
    <meta name="robots" content="noindex" />
    <Header />
    <main id="main-content" tabIndex={-1} className="border-b border-white/10 bg-[#0c1013] pt-[76px]">
      <div className="container py-16 sm:py-24">
        <p className="eyebrow">Ошибка 404</p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold uppercase leading-[1.08] sm:text-5xl">Страница не найдена</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70">
          Адрес изменился или страница была удалена. Ниже — основные разделы сайта.
          Если вы искали конкретное изделие, начните с каталога продукции: подберём
          аналог по чертежу или размерам.
        </p>
        <nav aria-label="Основные разделы сайта" className="mt-8 flex flex-wrap gap-3">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="clip-corner border border-white/20 px-5 py-3 text-xs font-bold uppercase tracking-[.1em] text-white/80 transition hover:border-steel-orange hover:text-steel-orange"
            >
              {section.label}
            </Link>
          ))}
        </nav>
        <div className="mt-10 flex flex-wrap items-center gap-5">
          <Link
            href="/contacts#contact-form"
            className="clip-corner bg-steel-orange-deep px-6 py-4 text-xs font-bold uppercase tracking-[.1em] transition hover:bg-steel-orange-deeper"
          >
            Получить расчёт
          </Link>
          <a href={`tel:${siteConfig.telephone}`} className="text-sm font-semibold text-steel-orange transition hover:text-white">
            {siteConfig.telephoneDisplay}
          </a>
        </div>
      </div>
    </main>
    <Footer />
  </>;
}

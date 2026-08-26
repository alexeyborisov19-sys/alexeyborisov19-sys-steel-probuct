import { Footer } from "./Footer";
import { Header } from "./Header";
import { InnerHero } from "./InnerHero";
import { JsonLd } from "./JsonLd";
import { breadcrumbSchema, webPageSchema, type Breadcrumb } from "@/lib/schema";

type PageLayoutProps = { eyebrow: string; title: string; titleAccent?: string; description: string; image?: string; imageAlt?: string; imageBrightness?: boolean; path?: string; children: React.ReactNode };

type SecondaryAction = { secondaryHref: string; secondaryLabel: string };

const parentSections = [
  { prefix: "/production/", name: "Производство", path: "/production" },
  { prefix: "/solutions/", name: "Решения", path: "/solutions" },
  { prefix: "/industries/", name: "Решения для объектов", path: "/industries" },
  { prefix: "/products/", name: "Продукция", path: "/products" },
  { prefix: "/articles/", name: "Инженерный журнал", path: "/articles" },
  { prefix: "/legal/", name: "Правовая информация", path: "/legal/privacy" },
] as const;

function pageBreadcrumbs(path: string, name: string): Breadcrumb[] {
  const breadcrumbs: Breadcrumb[] = [{ name: "Главная", path: "/" }];
  const parent = parentSections.find((item) => path.startsWith(item.prefix));

  if (path === "/calculator-metallokassety") {
    breadcrumbs.push({ name: "Продукция", path: "/products" });
  } else if (parent && parent.path !== path) {
    breadcrumbs.push({ name: parent.name, path: parent.path });
  }

  breadcrumbs.push({ name, path });
  return breadcrumbs;
}

function secondaryAction(path?: string): SecondaryAction | undefined {
  if (!path || path.startsWith("/legal/")) return undefined;

  if (path === "/calculator-metallokassety") {
    return { secondaryHref: "/products/metallokassety", secondaryLabel: "Металлокассеты" };
  }
  if (path === "/products") {
    return { secondaryHref: "/production", secondaryLabel: "Производство" };
  }
  if (path.startsWith("/products/")) {
    return { secondaryHref: "/products", secondaryLabel: "Вся продукция" };
  }
  if (path === "/production") {
    return { secondaryHref: "/products", secondaryLabel: "Продукция" };
  }
  if (path.startsWith("/production/")) {
    return { secondaryHref: "/production", secondaryLabel: "Всё производство" };
  }
  if (path === "/solutions") {
    return { secondaryHref: "/products", secondaryLabel: "Продукция" };
  }
  if (path.startsWith("/solutions/")) {
    return { secondaryHref: "/solutions", secondaryLabel: "Все решения" };
  }
  if (path === "/industries") {
    return { secondaryHref: "/projects", secondaryLabel: "Проекты" };
  }
  if (path.startsWith("/industries/")) {
    return { secondaryHref: "/industries", secondaryLabel: "Все отрасли" };
  }
  if (path === "/articles") {
    return { secondaryHref: "/production", secondaryLabel: "Производство" };
  }
  if (path.startsWith("/articles/")) {
    return { secondaryHref: "/articles", secondaryLabel: "Все статьи" };
  }
  if (path === "/projects") {
    return { secondaryHref: "/industries", secondaryLabel: "Решения для объектов" };
  }
  if (path === "/company" || path === "/contacts") {
    return { secondaryHref: "/production", secondaryLabel: "Производство" };
  }

  return undefined;
}

export function PageLayout({ children, path, ...hero }: PageLayoutProps) {
  const name = [hero.title, hero.titleAccent].filter(Boolean).join(" ");
  const contextualAction = secondaryAction(path);

  return <>
    {path ? (
      <JsonLd
        data={[
          webPageSchema({ name, description: hero.description, path }),
          breadcrumbSchema(pageBreadcrumbs(path, name)),
        ]}
      />
    ) : null}
    <Header />
    <main id="main-content" tabIndex={-1}><InnerHero {...hero} {...contextualAction} />{children}</main>
    <Footer />
  </>;
}

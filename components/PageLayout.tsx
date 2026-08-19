import { Footer } from "./Footer";
import { Header } from "./Header";
import { InnerHero } from "./InnerHero";
import { JsonLd } from "./JsonLd";
import { breadcrumbSchema, webPageSchema, type Breadcrumb } from "@/lib/schema";

type PageLayoutProps = { eyebrow: string; title: string; titleAccent?: string; description: string; image?: string; imageAlt?: string; imageBrightness?: boolean; path?: string; children: React.ReactNode };

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

export function PageLayout({ children, path, ...hero }: PageLayoutProps) {
  const name = [hero.title, hero.titleAccent].filter(Boolean).join(" ");

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
    <main><InnerHero {...hero} />{children}</main>
    <Footer />
  </>;
}

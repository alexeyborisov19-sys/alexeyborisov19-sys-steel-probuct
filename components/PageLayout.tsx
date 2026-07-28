import { Footer } from "./Footer";
import { Header } from "./Header";
import { InnerHero } from "./InnerHero";
import { JsonLd } from "./JsonLd";
import { webPageSchema } from "@/lib/schema";

type PageLayoutProps = { eyebrow: string; title: string; titleAccent?: string; description: string; image?: string; imageBrightness?: boolean; path?: string; children: React.ReactNode };
export function PageLayout({ children, path, ...hero }: PageLayoutProps) { return <>{path ? <JsonLd data={webPageSchema({ name: [hero.title, hero.titleAccent].filter(Boolean).join(" "), description: hero.description, path })} /> : null}<Header /><main><InnerHero {...hero} />{children}</main><Footer /></>; }

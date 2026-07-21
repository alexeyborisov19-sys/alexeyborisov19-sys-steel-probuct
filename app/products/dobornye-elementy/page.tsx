import { ProductCollectionPage } from "@/components/ProductCollectionPage";
import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Откосы и отливы для фасадов",
  description: "Доборные элементы из листового металла: оконные откосы и отливы под размеры проёма, фасадную систему и цвет RAL.",
  path: "/products/dobornye-elementy",
  keywords: ["откосы для окон", "металлические отливы", "доборные элементы для фасада"],
});

export default function DobornyeElementsCollectionPage() {
  return <ProductCollectionPage path="/products/dobornye-elementy" eyebrow="Архитектурные решения" title="Доборные элементы" description="Откосы и отливы для оконных проёмов — точные элементы, которые защищают монтажные швы и завершают фасадный узел." heading="Откосы и отливы" intro="Доборные элементы изготавливаются под размеры объекта. Это обеспечивает точную стыковку с рамой, кассетами и утеплителем, помогает исключить лишнюю подрезку на площадке и сохранить чистую геометрию фасада." slugs={["otkosy-dlya-okon", "otlivy-dlya-okon"]} />;
}

import type { Metadata } from "next";
import { commercialProductLandingBySlug } from "@/data/commercial-product-landings";
import { createPageMetadata } from "@/lib/seo";

const landing = commercialProductLandingBySlug["korziny-dlya-konditsionerov"];

export const basketPageMetadata: Metadata = createPageMetadata({
  title: "Фасадные корзины для кондиционеров — расчёт",
  description: "Фасадные корзины и экраны для кондиционеров по проекту: размеры под наружный блок, перфорация, RAL и кронштейны. Подготовьте спецификацию для расчёта.",
  path: `/products/${landing.slug}`,
  image: landing.image,
  keywords: landing.keywords,
});

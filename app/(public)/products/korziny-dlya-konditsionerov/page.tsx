import type { Metadata } from "next";
import { BasketLandingPage } from "@/components/commercial/BasketLandingPage";
import { commercialProductLandingBySlug } from "@/data/commercial-product-landings";
import { createPageMetadata } from "@/lib/seo";

const landing = commercialProductLandingBySlug["korziny-dlya-konditsionerov"];

export const metadata: Metadata = createPageMetadata({
  title: "Корзины для кондиционеров: подбор и цена",
  description: "Подбор корзины для кондиционера: размеры, зазоры, перфорация и RAL. Подготовка задания на расчёт стоимости. Бесплатное сохранение спецификации.",
  path: `/products/${landing.slug}`,
  image: landing.image,
  keywords: landing.keywords,
});

export default function Page() {
  return <BasketLandingPage />;
}

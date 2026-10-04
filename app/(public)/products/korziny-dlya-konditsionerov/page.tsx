import type { Metadata } from "next";
import { BasketLandingPage } from "@/components/commercial/BasketLandingPage";
import { commercialProductLandingBySlug } from "@/data/commercial-product-landings";
import { createPageMetadata } from "@/lib/seo";

const landing = commercialProductLandingBySlug["korziny-dlya-konditsionerov"];

export const metadata: Metadata = createPageMetadata({
  title: "Корзины для кондиционеров: подбор и цена",
  description: "Бесплатный подбор корзины для кондиционера: класс блока, размеры, зазоры, перфорация и RAL. Цена базовой корзины с окраской зависит от количества. Сохраните спецификацию и отправьте инженеру.",
  path: `/products/${landing.slug}`,
  image: landing.image,
  keywords: landing.keywords,
});

export default function Page() {
  return <BasketLandingPage />;
}

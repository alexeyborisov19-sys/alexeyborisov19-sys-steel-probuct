import type { Metadata } from "next";
import { BasketLandingPage } from "@/components/commercial/BasketLandingPage";
import { commercialProductLandingBySlug } from "@/data/commercial-product-landings";
import { createPageMetadata } from "@/lib/seo";

const landing = commercialProductLandingBySlug["korziny-dlya-konditsionerov"];

export const metadata: Metadata = createPageMetadata({
  title: landing.seoTitle,
  description: landing.metaDescription,
  path: `/products/${landing.slug}`,
  image: landing.image,
  keywords: landing.keywords,
});

export default function Page() {
  return <BasketLandingPage />;
}

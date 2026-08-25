import type { Metadata } from "next";
import { CommercialProductLandingPage } from "@/components/CommercialProductLandingPage";
import { commercialProductLandingBySlug } from "@/data/commercial-product-landings";
import { createPageMetadata } from "@/lib/seo";

const landing = commercialProductLandingBySlug["zakladnye-detali"];

export const metadata: Metadata = createPageMetadata({
  title: landing.seoTitle,
  description: landing.metaDescription,
  path: `/products/${landing.slug}`,
  image: landing.image,
  keywords: landing.keywords,
});

export default function Page() {
  return <CommercialProductLandingPage landing={landing} />;
}

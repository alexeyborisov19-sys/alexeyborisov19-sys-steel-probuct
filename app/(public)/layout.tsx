import type { Metadata, Viewport } from "next";
import { Analytics } from "@/components/Analytics";
import { CookieConsent } from "@/components/CookieConsent";
import { EngineeringAssistantLauncher } from "@/components/EngineeringAssistantLauncher";
import { JsonLd } from "@/components/JsonLd";
import { SitePreloader } from "@/components/SitePreloader";
import { organizationSchema, websiteSchema } from "@/lib/schema";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Сталь Продукт — инженерные решения из листового металла",
    template: "%s | Сталь Продукт",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: "Производство изделий из листового металла",
  alternates: {
    types: { "application/rss+xml": [{ url: "/feed.xml", title: "Инженерный журнал «Сталь Продукт»" }] },
  },
  icons: {
    icon: [{ url: "/icon.svg?v=2", type: "image/svg+xml", sizes: "any" }],
    // Yandex reads the legacy shortcut link and does not accept an SVG there,
    // so it points at the raster app/favicon.ico.
    shortcut: ["/favicon.ico"],
    // iOS ignores an SVG touch icon, so this one stays raster as well.
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: "Сталь Продукт — инженерные решения из листового металла",
    description: siteConfig.description,
    images: [{ url: siteConfig.defaultOgImage, width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#101112",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <JsonLd data={[organizationSchema(), websiteSchema()]} />
      <Analytics />
      <SitePreloader />
      {children}
      <EngineeringAssistantLauncher />
      <CookieConsent />
    </>
  );
}

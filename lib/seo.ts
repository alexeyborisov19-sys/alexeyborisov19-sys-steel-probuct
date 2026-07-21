import type { Metadata } from "next";
import { absoluteUrl, canonicalPath, siteConfig } from "./site";

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  keywords?: readonly string[];
};

export function createPageMetadata({ title, description, path, image = siteConfig.defaultOgImage, keywords = [] }: PageMetadataInput): Metadata {
  const canonical = canonicalPath(path);

  return {
    title,
    description,
    keywords: [...keywords],
    alternates: { canonical },
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
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      url: absoluteUrl(canonical),
      siteName: siteConfig.name,
      title,
      description,
      images: [{ url: absoluteUrl(image), width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteUrl(image)],
    },
  };
}

import type { Metadata } from "next";
import { absoluteUrl, canonicalPath, siteConfig } from "./site";

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  keywords?: readonly string[];
  openGraphType?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
};

export function createPageMetadata({
  title,
  description,
  path,
  image = siteConfig.defaultOgImage,
  keywords = [],
  openGraphType = "website",
  publishedTime,
  modifiedTime,
}: PageMetadataInput): Metadata {
  const canonical = canonicalPath(path);
  const openGraph: NonNullable<Metadata["openGraph"]> = {
    type: openGraphType,
    locale: siteConfig.locale,
    url: absoluteUrl(canonical),
    siteName: siteConfig.name,
    title,
    description,
    images: [{ url: absoluteUrl(image), width: 1200, height: 630, alt: title }],
    ...(openGraphType === "article"
      ? {
          publishedTime,
          modifiedTime,
          authors: [siteConfig.name],
        }
      : {}),
  };

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
    openGraph,
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteUrl(image)],
    },
  };
}

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

function socialImagePath(image: string) {
  // Project/article content can legitimately use an attributed external photo,
  // but Open Graph images should stay on our own domain. This keeps social
  // previews stable and prevents SEO audits from depending on third-party CDNs.
  return /^https?:\/\//i.test(image) ? siteConfig.defaultOgImage : image;
}

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
  const socialImage = socialImagePath(image);
  const openGraph: NonNullable<Metadata["openGraph"]> = {
    type: openGraphType,
    locale: siteConfig.locale,
    url: absoluteUrl(canonical),
    siteName: siteConfig.name,
    title,
    description,
    images: [{ url: absoluteUrl(socialImage), width: 1200, height: 630, alt: title }],
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
      images: [absoluteUrl(socialImage)],
    },
  };
}

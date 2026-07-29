import { articles } from "@/data/articles";
import { products } from "@/data/products";
import { productionServices } from "@/data/production-services";
import { solutionDetails } from "@/data/solution-details";
import {
  getIndustrySolutions,
  industryVisualByTitle,
} from "@/lib/industry-solutions";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

type ImageEntry = {
  pagePath: string;
  images: Array<{ path: string; title: string; caption: string }>;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function imageXml(image: ImageEntry["images"][number]) {
  return `<image:image>
      <image:loc>${escapeXml(absoluteUrl(image.path))}</image:loc>
      <image:title>${escapeXml(image.title)}</image:title>
      <image:caption>${escapeXml(image.caption)}</image:caption>
    </image:image>`;
}

export function GET() {
  const entries: ImageEntry[] = [
    {
      pagePath: "/",
      images: [{
        path: "/images/web/hero-main.jpg",
        title: "Инженерные решения из листового металла",
        caption: "Архитектурные и промышленные решения компании «Сталь Продукт».",
      }],
    },
    {
      pagePath: "/company",
      images: [{
        path: "/images/company-video-poster.png",
        title: "Компания «Сталь Продукт»",
        caption: "Команда и производство изделий из листового металла.",
      }],
    },
    {
      pagePath: "/production",
      images: [
        {
          path: "/images/real-production/workshop-team.jpg",
          title: "Производство «Сталь Продукт»",
          caption: "Специалисты компании на действующем производственном участке.",
        },
        {
          path: "/images/real-production/laser-cutting-action.jpg",
          title: "Лазерная резка листового металла",
          caption: "Лазерный раскрой деталей на производстве «Сталь Продукт».",
        },
        {
          path: "/images/real-production/press-brake-durma.jpg",
          title: "Гибка листового металла",
          caption: "Листогибочный комплекс с ЧПУ на производстве «Сталь Продукт».",
        },
        {
          path: "/images/real-production/welding-station.jpg",
          title: "Сварка металлоизделий",
          caption: "Сборка и сварка изделий из листового металла.",
        },
      ],
    },
    ...productionServices.map((service) => ({
      pagePath: `/production/${service.slug}`,
      images: [{
        path: service.image,
        title: service.title,
        caption: service.description,
      }],
    })),
    ...solutionDetails.map((solution) => ({
      pagePath: `/solutions/${solution.slug}`,
      images: [{
        path: solution.image,
        title: solution.title,
        caption: solution.description,
      }],
    })),
    ...getIndustrySolutions().map((industry) => ({
      pagePath: `/industries/${industry.slug}`,
      images: [{
        path: `/images/industries/${industryVisualByTitle[industry.title] ?? "hero-main.jpg"}`,
        title: `Металлоизделия: ${industry.title}`,
        caption: `Решения из листового металла для направления «${industry.title}».`,
      }],
    })),
    ...products.map((product) => ({
      pagePath: `/products/${product.slug}`,
      images: [{
        path: product.technicalImage,
        title: product.title,
        caption: `Техническое изображение изделия «${product.title}».`,
      }],
    })),
    ...articles.map((article) => ({
      pagePath: `/articles/${article.slug}`,
      images: [{
        path: article.image,
        title: article.title,
        caption: article.lead,
      }],
    })),
  ];

  const urls = entries
    .map((entry) => `<url>
    <loc>${escapeXml(absoluteUrl(entry.pagePath))}</loc>
    ${entry.images.map(imageXml).join("\n    ")}
  </url>`)
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}

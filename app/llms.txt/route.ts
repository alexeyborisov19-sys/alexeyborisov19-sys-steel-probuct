import { customerGuides } from "@/data/customer-guides";
import { publicTools } from "@/data/public-tools";
import { brandOfficialProfiles } from "@/data/entity-references";
import {
  installationScopeSummary,
  metalCassetteOutputSummary,
  productionScaleSummary,
} from "@/data/manufacturing-facts";
import { legalOperator } from "@/lib/legal";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const officialProfiles = brandOfficialProfiles
    .map((profile) => `${profile.name}: ${profile.url}`)
    .join("; ");

  const tools = publicTools.map((tool) =>
    `### ${tool.name}\n\n${tool.description}\n${tool.limitation}\nURL: ${siteConfig.url}${tool.path}`,
  ).join("\n\n");

  const content = `# ${siteConfig.name}

> «${siteConfig.name}» — российский производственный бренд изделий из листового металла: инженерная подготовка, лазерный раскрой, гибка, сварка, порошковая окраска, контроль, упаковка и поставка.

## Бренд и производство

- «${siteConfig.name}» — бренд/товарный знак, не юридическое лицо; юридический оператор: ${legalOperator.name}.
- Основной официальный сайт бренда: ${siteConfig.url}.
- Официальные профили бренда: ${officialProfiles}.
- Производство: ${legalOperator.productionAddress}.
- География поставок: Россия.
- ${productionScaleSummary}
- ${metalCassetteOutputSummary}
- ${installationScopeSummary}

## Основные направления

- Фасадные металлокассеты и доборные элементы.
- Металлические корпуса, шкафы, кожухи, кронштейны и нестандартные изделия по КД.
- Лазерная резка, гибка, сварка, сборка и порошковая окраска.
- Производство по PDF, DXF, DWG, STEP, 3D-моделям, эскизам и техническим заданиям.

## Инструменты для расчёта и проектирования

${tools}

## Ключевые страницы

- [Главная](${siteConfig.url}/)
- [Проверенные факты о производстве](${siteConfig.url}/company/facts)
- [О компании](${siteConfig.url}/company)
- [Продукция](${siteConfig.url}/products)
- [Фасадные металлокассеты](${siteConfig.url}/products/metallokassety)
- [Производство](${siteConfig.url}/production)
- [Реальные проекты](${siteConfig.url}/projects)
- [Бесплатные сервисы: CAD, размеры, металлокассеты и BIM](${siteConfig.url}/tools)
- [Инженерный журнал](${siteConfig.url}/articles)
- [Бесплатный расчёт по CAD или габаритам](${siteConfig.url}/online-order)
- [Калькулятор металлокассет](${siteConfig.url}/calculator-metallokassety)
- [Контакты и отправка проекта](${siteConfig.url}/contacts)

## Заказчику

- [Подготовка заказа](${siteConfig.url}/customers)
${customerGuides.map((guide) => `- [${guide.title}](${siteConfig.url}/customers/${guide.slug}): ${guide.description}`).join("\n")}

## Машиночитаемые источники

- [Расширенная справка для ИИ](${siteConfig.url}/llms-full.txt)
- [XML sitemap](${siteConfig.url}/sitemap.xml)
- [Image sitemap](${siteConfig.url}/sitemap-images.xml)
- [Robots](${siteConfig.url}/robots.txt)
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}

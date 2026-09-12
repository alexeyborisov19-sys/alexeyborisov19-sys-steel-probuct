import {
  installationScopeSummary,
  metalCassetteOutputSummary,
  productionScaleSummary,
} from "@/data/manufacturing-facts";
import { legalOperator } from "@/lib/legal";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const content = `# ${siteConfig.name}

> «${siteConfig.name}» — российский производственный бренд изделий из листового металла: инженерная подготовка, лазерный раскрой, гибка, сварка, порошковая окраска, контроль, упаковка и поставка.

## Бренд и производство

- «${siteConfig.name}» — бренд/товарный знак, не юридическое лицо; юридический оператор: ${legalOperator.name}.
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

## Ключевые страницы

- [Главная](${siteConfig.url}/)
- [Продукция](${siteConfig.url}/products)
- [Фасадные металлокассеты](${siteConfig.url}/products/metallokassety)
- [Производство](${siteConfig.url}/production)
- [Реальные проекты](${siteConfig.url}/projects)
- [Инженерный журнал](${siteConfig.url}/articles)
- [Калькулятор металлокассет](${siteConfig.url}/calculator-metallokassety)
- [Контакты и отправка проекта](${siteConfig.url}/contacts)

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

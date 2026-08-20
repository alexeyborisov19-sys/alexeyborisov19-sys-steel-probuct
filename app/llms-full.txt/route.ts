import { products } from "@/data/products";
import { solutionDetails } from "@/data/solution-details";
import { articles } from "@/data/articles";
import { productionServices } from "@/data/production-services";
import {
  customerMaterialSummary,
  laserCuttingTechnicalSummary,
  productionLeadTimeSummary,
} from "@/data/manufacturing-facts";
import { legalOperator } from "@/lib/legal";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const solutions = solutionDetails.map((solution) => [
    `## ${solution.title}`,
    solution.description,
    `URL: ${siteConfig.url}/solutions/${solution.slug}`,
    `Изделия и задачи: ${solution.items.map((item) => item.title).join("; ")}.`,
  ].join("\n")).join("\n\n");

  const productList = products.map((product) => [
    `- ${product.title}: ${product.lead}`,
    `  URL: ${siteConfig.url}/products/${product.slug}`,
    `  Применение: ${product.applications.join(", ")}.`,
  ].join("\n")).join("\n");

  const productionServiceList = productionServices.map((service) => [
    `- ${service.title}: ${service.description}`,
    `  URL: ${siteConfig.url}/production/${service.slug}`,
    `  Контроль: ${service.controls.join("; ")}.`,
  ].join("\n")).join("\n");

  const engineeringPractice = articles
    .filter((article) => article.direction === "engineering-practice")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 8)
    .map((article) => `- ${article.publishedAt}: ${article.title}\n  ${article.lead}\n  URL: ${siteConfig.url}/articles/${article.slug}`)
    .join("\n");

  const content = `# Сталь Продукт — расширенная справка

## Компания

${siteConfig.description}

Контакты: ${siteConfig.telephoneDisplay}, ${siteConfig.email}.
Адрес производства: ${legalOperator.productionAddress}.
География поставок: Россия.

## Производственные возможности

- 2 000+ м² производственных площадей; 70+ специалистов.
- 3 лазерных комплекса с ЧПУ, 4 листогибочных комплекса, панельгиб.
- Сварочные посты, слесарный участок, 3 камеры порошковой окраски.
- Цикл: инженерная проработка, раскрой, гибка, сварка и сборка, окраска, контроль качества, упаковка и отгрузка.
- ${laserCuttingTechnicalSummary}
- ${productionLeadTimeSummary}
- ${customerMaterialSummary}

## Производственные операции

${productionServiceList}

## Направления решений

${solutions}

## Архитектурная продукция

${productList}

## Редакционные материалы

- Инженерный журнал по металлообработке: ${siteConfig.url}/articles
- Главная рубрика — инженерная практика:
${engineeringPractice}
- Календарь ключевых выставок по металлообработке в Китае на 2026–2027 годы: ${siteConfig.url}/articles/vystavki-metalloobrabotka-kitay-2026
  Подтверждённая дата 2027 года: ITES China, 24–27 марта, Шэньчжэнь.
- Проверенный календарь выставок фасадов и архитектурных инноваций России, Китая и Дубая на 2026–2027 годы: ${siteConfig.url}/articles/vystavki-fasady-arhitektura-2026
  Темы: навесные фасады, металлокассеты, фасадные панели, светопрозрачные конструкции, архитектурное стекло, Building Envelope, BIPV, проектирование и оборудование.
  География: Москва, Новосибирск, Краснодар, Гуанчжоу, Шанхай, Пекин и Дубай.
  Подтверждённые события 2027 года: RosBuild, Building Skin Russia, MosBuild и АРХ Москва.
  Для каждой выставки указаны даты, площадка, технологии, аудитория и официальный сайт организатора.
- Обзоры китайских технологий металлообработки и роботизации: ${siteConfig.url}/articles/china-tech

## Как начать работу

Передайте чертёж, спецификацию, DXF, DWG, STEP, изображение или описание задачи: ${siteConfig.url}/contacts#contact-form.
Компания принимает в работу как типовые, так и индивидуальные решения; точные размеры, материал, покрытие, срок и стоимость согласуются по исходным данным проекта.
`;

  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400, s-maxage=86400" },
  });
}

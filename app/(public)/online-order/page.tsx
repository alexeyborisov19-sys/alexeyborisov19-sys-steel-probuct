import type { Metadata } from "next";
import { ClientManufacturingWorkspace } from "@/components/ClientManufacturingWorkspace";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import { createPageMetadata } from "@/lib/seo";
import { absoluteUrl, siteConfig } from "@/lib/site";

const path = "/online-order";
const title = "Онлайн-расчёт металлоизделий по CAD";
const description =
  "Загрузите DXF или STEP/STP, проверьте CAD-модель и задайте параметры изделия для производственного расчёта в Сталь Продукт.";

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path,
  keywords: [
    "онлайн расчет металлоизделий",
    "расчет по DXF",
    "STEP производство металлоизделий",
    "лазерная резка DXF",
    "изготовление по чертежу",
  ],
});

const calculatorSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Калькулятор металлоизделий по CAD-модели",
  description,
  url: absoluteUrl(path),
  applicationCategory: "BusinessApplication",
  operatingSystem: "Любая платформа",
  browserRequirements: "Современный веб-браузер с поддержкой JavaScript",
  isAccessibleForFree: true,
  inLanguage: "ru-RU",
  featureList: [
    "Загрузка DXF, STEP и STP",
    "Автоматическое определение габаритов по CAD-модели",
    "Просмотр 2D-контура и 3D-модели",
    "Выбор материала, толщины и количества",
    "Выбор производственных операций",
    "Предварительная оценка стоимости проекта",
  ],
  provider: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
};

export default function OnlineOrderPage() {
  return (
    <>
      <JsonLd data={[calculatorSchema]} />
      <PageLayout
        path={path}
        eyebrow="CAD → конфигурация → расчёт"
        title="Калькулятор металлоизделий"
        description="Загрузите чертёж или 3D-модель: габариты определятся автоматически. Останется выбрать материал, толщину, количество и обработку."
        image="/images/web/hero-main.webp"
      >
        <ClientManufacturingWorkspace />
      </PageLayout>
    </>
  );
}

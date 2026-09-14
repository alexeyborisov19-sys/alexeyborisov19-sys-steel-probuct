import type { Metadata } from "next";
import { ClientManufacturingWorkspace } from "@/components/ClientManufacturingWorkspace";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Онлайн-расчёт металлоизделий по CAD",
  description:
    "Загрузите DXF или STEP/STP, проверьте CAD-модель и задайте параметры изделия для производственного расчёта в Сталь Продукт.",
  path: "/online-order",
  keywords: [
    "онлайн расчет металлоизделий",
    "расчет по DXF",
    "STEP производство металлоизделий",
    "лазерная резка DXF",
    "изготовление по чертежу",
  ],
});

export default function OnlineOrderPage() {
  return <ClientManufacturingWorkspace />;
}

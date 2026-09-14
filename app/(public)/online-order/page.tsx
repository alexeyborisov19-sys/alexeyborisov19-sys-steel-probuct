import type { Metadata } from "next";
import { ManufacturingWorkspace } from "@/components/ManufacturingWorkspace";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Онлайн-заказ металлоизделий по CAD",
  description:
    "Загрузите DXF или STEP/STP, проверьте 2D/3D-геометрию, DFM и подготовьте заказ на производство в Сталь Продукт.",
  path: "/online-order",
  keywords: [
    "онлайн заказ металлоизделий",
    "расчет по DXF",
    "STEP производство металлоизделий",
    "лазерная резка DXF",
    "изготовление по чертежу",
  ],
});

export default function OnlineOrderPage() {
  return <ManufacturingWorkspace />;
}

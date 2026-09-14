import type { Metadata } from "next";
import { InstantQuoteWorkspace } from "@/components/InstantQuoteWorkspace";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Онлайн-заказ металлоизделий по CAD",
  description:
    "Загрузите CAD-файл детали, проверьте геометрию и подготовьте заказ на производство в Сталь Продукт.",
  path: "/online-order",
  keywords: [
    "онлайн заказ металлоизделий",
    "расчет по DXF",
    "лазерная резка DXF",
    "изготовление по чертежу",
  ],
});

export default function OnlineOrderPage() {
  return <InstantQuoteWorkspace />;
}

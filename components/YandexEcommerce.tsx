"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { consentEvent, hasAnalyticsConsent } from "./CookieConsent";

type JsonRecord = Record<string, unknown>;

type YandexEcommerceProduct = {
  id: string;
  name: string;
  brand: string;
  category?: string;
  list?: string;
  position?: number;
};

type DataLayerWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
};

const brandName = "Сталь Продукт";

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function schemaHasType(schema: JsonRecord, expected: string) {
  const type = schema["@type"];
  return type === expected || (Array.isArray(type) && type.includes(expected));
}

function toPath(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  try {
    return new URL(value, window.location.origin).pathname;
  } catch {
    return null;
  }
}

function productIdFromPath(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "products" || parts.length < 2) return null;
  return parts[parts.length - 1];
}

function readJsonLdSchemas() {
  const schemas: JsonRecord[] = [];
  for (const script of document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')) {
    try {
      const parsed: unknown = JSON.parse(script.textContent || "null");
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of candidates) {
        if (isRecord(candidate)) schemas.push(candidate);
      }
    } catch {
      // A malformed unrelated JSON-LD block must not break public navigation.
    }
  }
  return schemas;
}

function productFromSchema(schema: JsonRecord): YandexEcommerceProduct | null {
  if (!schemaHasType(schema, "Product")) return null;
  const name = typeof schema.name === "string" ? schema.name.trim() : "";
  const path = toPath(schema.url ?? schema["@id"]);
  const id = path ? productIdFromPath(path) : null;
  if (!name || !id) return null;

  let brand = brandName;
  if (isRecord(schema.brand) && typeof schema.brand.name === "string" && schema.brand.name.trim()) {
    brand = schema.brand.name.trim();
  }

  return {
    id,
    name,
    brand,
    category: typeof schema.category === "string" ? schema.category : undefined,
    list: "Карточка продукции",
  };
}

function productsFromItemList(schema: JsonRecord): YandexEcommerceProduct[] {
  if (!schemaHasType(schema, "ItemList") || !Array.isArray(schema.itemListElement)) return [];

  const result: YandexEcommerceProduct[] = [];
  for (const item of schema.itemListElement) {
    if (!isRecord(item)) continue;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const path = toPath(item.url ?? item.item);
    const id = path ? productIdFromPath(path) : null;
    if (!name || !id) continue;

    result.push({
      id,
      name,
      brand: brandName,
      category: "Каталог продукции",
      list: "Каталог продукции",
      position: typeof item.position === "number" ? item.position : result.length + 1,
    });
  }
  return result;
}

function pushDetail(product: YandexEcommerceProduct) {
  const analyticsWindow = window as DataLayerWindow;
  analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
  analyticsWindow.dataLayer.push({
    ecommerce: {
      currencyCode: "RUB",
      detail: {
        products: [product],
      },
    },
  });
}

function pushImpressions(products: YandexEcommerceProduct[]) {
  if (!products.length) return;
  const analyticsWindow = window as DataLayerWindow;
  analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
  analyticsWindow.dataLayer.push({
    ecommerce: {
      currencyCode: "RUB",
      impressions: products,
    },
  });
}

/**
 * The site is a B2B lead-generation catalog, not an online store. Therefore we
 * deliberately send only product-list impressions and product-detail views.
 * Cart, purchase and revenue actions are never fabricated.
 */
export function YandexEcommerce() {
  const pathname = usePathname();

  useEffect(() => {
    let sentForPage = false;

    function syncEcommerce() {
      if (sentForPage) return;
      try {
        if (!hasAnalyticsConsent()) return;
      } catch {
        return;
      }

      const schemas = readJsonLdSchemas();
      const detailProduct = schemas
        .map(productFromSchema)
        .find((product): product is YandexEcommerceProduct => product !== null);
      if (detailProduct) {
        pushDetail(detailProduct);
        sentForPage = true;
        return;
      }

      if (pathname === "/products") {
        const products = schemas.flatMap(productsFromItemList);
        if (products.length) {
          pushImpressions(products);
          sentForPage = true;
        }
      }
    }

    syncEcommerce();
    window.addEventListener(consentEvent, syncEcommerce);
    return () => window.removeEventListener(consentEvent, syncEcommerce);
  }, [pathname]);

  return null;
}

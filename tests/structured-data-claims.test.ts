import assert from "node:assert/strict";
import test from "node:test";
import { products } from "@/data/products";
import {
  organizationSchema,
  productGroupSchema,
  productSchema,
  serviceSchema,
} from "@/lib/schema";
import { siteConfig } from "@/lib/site";

test("structured data exposes only confirmed contact capabilities", () => {
  const organization = organizationSchema();
  const service = serviceSchema({
    name: "Лазерная резка металла",
    description: "Производственная услуга",
    path: "/production/lazernaya-rezka-metalla",
  });
  const channel = service.availableChannel as Record<string, unknown>;

  assert.equal(organization.telephone, siteConfig.telephone);
  assert.ok(!("openingHoursSpecification" in organization), "unconfirmed opening hours must not be published");
  assert.equal(channel.servicePhone, siteConfig.telephone);
  assert.ok(!("serviceSmsNumber" in channel), "SMS capability must not be claimed without confirmation");
});

function assertNoFabricatedCommerce(schema: Record<string, unknown>, label: string) {
  assert.ok(!("offers" in schema), `${label}: price or offer must not be invented`);
  assert.ok(!("aggregateRating" in schema), `${label}: rating must not be invented`);
  assert.ok(!("review" in schema), `${label}: review must not be invented`);
}

test("product structured data never fabricates commerce signals", () => {
  for (const product of products) {
    assertNoFabricatedCommerce(productSchema(product), product.slug);
  }
});

test("product group variants never fabricate commerce signals", () => {
  const variants = products.filter((product) => product.category === "Кассеты");
  const schema = productGroupSchema({
    name: "Фасадные металлокассеты",
    description: "Коллекция фасадных металлокассет",
    path: "/products/metallokassety",
    groupId: "metallokassety",
    products: variants,
  });

  assertNoFabricatedCommerce(schema, "metallokassety product group");
  const hasVariant = schema.hasVariant as Array<Record<string, unknown>>;
  assert.equal(hasVariant.length, variants.length);
  for (const variant of hasVariant) {
    assertNoFabricatedCommerce(variant, String(variant["@id"] ?? "product variant"));
  }
});

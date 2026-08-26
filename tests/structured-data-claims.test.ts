import assert from "node:assert/strict";
import test from "node:test";
import { products } from "@/data/products";
import { organizationSchema, productSchema, serviceSchema } from "@/lib/schema";
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

test("product structured data never fabricates commerce signals", () => {
  for (const product of products) {
    const schema = productSchema(product);

    assert.ok(!("offers" in schema), `${product.slug}: price or offer must not be invented`);
    assert.ok(!("aggregateRating" in schema), `${product.slug}: rating must not be invented`);
    assert.ok(!("review" in schema), `${product.slug}: review must not be invented`);
  }
});

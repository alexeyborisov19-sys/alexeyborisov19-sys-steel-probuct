import assert from "node:assert/strict";
import test from "node:test";
import { organizationSchema, serviceSchema } from "@/lib/schema";
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

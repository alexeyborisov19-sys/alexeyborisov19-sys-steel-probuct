import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import sitemap from "@/app/sitemap";
import { middleware } from "@/middleware";

test("/vnutri redirects directly to the laser cutting page", () => {
  const response = middleware(new NextRequest("https://www.steelprodukt.ru/vnutri"));

  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("location"),
    "https://www.steelprodukt.ru/production/lazernaya-rezka-metalla",
  );
});

test("/vnutri is excluded from sitemap", () => {
  const urls = sitemap().map((entry) => entry.url);

  assert.equal(urls.some((url) => new URL(url).pathname === "/vnutri"), false);
});

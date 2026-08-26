import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import Home, { metadata as homeMetadata } from "@/app/(public)/page";
import sitemap from "@/app/sitemap";
import { Hero } from "@/components/Hero";
import { siteMode } from "@/data/site-mode";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function collectPublicStrings(value: unknown, seen = new Set<object>()): string[] {
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (!value || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectPublicStrings(item, seen));
  }

  if (React.isValidElement<Record<string, unknown>>(value)) {
    return collectPublicStrings(value.props, seen);
  }

  return Object.values(value).flatMap((item) => collectPublicStrings(item, seen));
}

function collectRenderedText(value: unknown): string[] {
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectRenderedText);
  if (!React.isValidElement<{ children?: unknown }>(value)) return [];
  return collectRenderedText(value.props.children);
}

test("the public site no longer presents itself as a test version", () => {
  assert.equal(siteMode.isTest, false);
});

test("the homepage hero restores equipment proof instead of laser envelope figures", () => {
  const heroText = collectRenderedText(Hero()).join(" ");

  assert.match(heroText, /3 лазерных комплекса/);
  assert.match(heroText, /4 листогибочных комплекса/);
  assert.doesNotMatch(heroText, /0,5[–-]40 мм/);
  assert.doesNotMatch(heroText, /1500\s*[×x]\s*3000 мм/);
});

test("homepage search copy leaves laser envelope details to the production landing", () => {
  const homepageSearchText = collectPublicStrings([homeMetadata, Home()]).join(" ");

  assert.doesNotMatch(homepageSearchText, /0,5[–-]40 мм/);
  assert.doesNotMatch(homepageSearchText, /1500\s*[×x]\s*3000 мм/);
  assert.match(homepageSearchText, /производств[ао] полного цикла/i);
});

test("the homepage benefits use the approved evidence-led wording", () => {
  const homepageText = collectPublicStrings(Home()).join(" ");

  assert.match(homepageText, /Весь цикл — в одном производственном контуре/);
  assert.match(homepageText, /Инженерия до запуска в цех/);
  assert.match(homepageText, /Согласованный образец — основа серии/);
  assert.match(homepageText, /Срок рассчитываем по заказу/);
  assert.match(homepageText, /Работаем с материалом заказчика/);
  assert.doesNotMatch(homepageText, /Средний производственный срок — 7–14 дней/);
});

test("the changed homepage tells crawlers its current modification date", () => {
  const homepage = sitemap().find((entry) => entry.url === "https://www.steelprodukt.ru/");

  assert.ok(homepage?.lastModified);
  assert.ok(new Date(homepage.lastModified).getTime() >= Date.parse("2026-08-26T00:00:00.000Z"));
});

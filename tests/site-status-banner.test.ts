import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { siteMode, heroOffset, innerHeroOffset } from "@/data/site-mode";

const headerPath = new URL("../components/Header.tsx", import.meta.url);
const heroPath = new URL("../components/Hero.tsx", import.meta.url);
const innerHeroPath = new URL("../components/InnerHero.tsx", import.meta.url);
const publicLayoutPath = new URL("../app/(public)/layout.tsx", import.meta.url);
const siteModePath = new URL("../data/site-mode.ts", import.meta.url);

// These assertions deliberately do not pin siteMode.isTest to a value. An
// earlier pair of guards did — one demanded the flag be on, another demanded the
// header never mention it — and together they locked the site into the broken
// combination where the banner was gone but every hero still reserved its space.
// What matters is that the banner and that space always agree.

test("the header keeps the banner wired to the flag", async () => {
  const header = await readFile(headerPath, "utf8");

  assert.match(header, /siteMode\.isTest \?/);
  assert.match(header, /data-site-status="test-mode"/);
  assert.match(header, /\{siteMode\.label\}/);
  assert.match(header, /role="status"/);
});

test("the banner cannot clip its own notice on narrow screens", async () => {
  const header = await readFile(headerPath, "utf8");

  const banner = header.slice(
    header.indexOf('data-site-status="test-mode"'),
    header.indexOf("{siteMode.label}"),
  );

  // The notice is long enough to wrap on a phone. A fixed-height strip cut it
  // off there, which is what made the banner look like it had not shipped.
  assert.match(banner, /min-h-\[28px\]/);
  assert.doesNotMatch(banner, /(^|\s)h-\d/);
});

test("the banner is published in exactly one place", async () => {
  const [header, layout] = await Promise.all([
    readFile(headerPath, "utf8"),
    readFile(publicLayoutPath, "utf8"),
  ]);

  const escapedLabel = new RegExp(siteMode.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  assert.doesNotMatch(layout, escapedLabel);
  assert.doesNotMatch(layout, /data-site-status="test-mode"/);
  assert.equal(header.match(/data-site-status="test-mode"/g)?.length, 1);
});

test("hero offsets and the banner move together on one switch", async () => {
  const [hero, innerHero, siteModeSource] = await Promise.all([
    readFile(heroPath, "utf8"),
    readFile(innerHeroPath, "utf8"),
    readFile(siteModePath, "utf8"),
  ]);

  // The header is absolutely positioned, so each hero reserves its height. When
  // that offset and the banner branched on the flag separately, removing the
  // banner left the reserved strip behind as an empty gap under the header.
  assert.match(siteModeSource, /export const heroOffset = siteMode\.isTest/);
  assert.match(siteModeSource, /export const innerHeroOffset = siteMode\.isTest/);

  assert.match(hero, /\$\{heroOffset\}/);
  assert.match(innerHero, /\$\{innerHeroOffset\}/);
  assert.doesNotMatch(hero, /siteMode\.isTest/);
  assert.doesNotMatch(innerHero, /siteMode\.isTest/);
});

test("the offset in force matches the state of the flag", () => {
  // Whichever way the flag is set, the reserved space has to follow it: extra
  // room only while the banner is actually rendered, none once it is off.
  const withBanner = { hero: "min-h-[638px] pt-[100px]", inner: "min-h-[648px] pt-[116px]" };
  const withoutBanner = { hero: "min-h-[610px] pt-[72px]", inner: "min-h-[620px] pt-[88px]" };
  const expected = siteMode.isTest ? withBanner : withoutBanner;

  assert.equal(heroOffset, expected.hero);
  assert.equal(innerHeroOffset, expected.inner);
});

test("Tailwind scans every file that declares the banner's layout classes", async () => {
  const tailwindConfig = await readFile(
    new URL("../tailwind.config.ts", import.meta.url),
    "utf8",
  );

  // Tailwind emits only utilities it reads as literals in a scanned file. The
  // offsets live outside app/ and components/, so an unscanned data/site-mode.ts
  // puts the classes in the markup with no CSS behind them — the header then
  // covers hero content and the banner looks like it never shipped.
  assert.match(tailwindConfig, /"\.\/data\/site-mode\.ts"/);

  const declaresUtilities = /(min-h|pt|h)-\[\d+px\]/.test(
    await readFile(siteModePath, "utf8"),
  );
  assert.ok(
    declaresUtilities,
    "site-mode.ts is expected to declare the offsets this guard protects",
  );
});

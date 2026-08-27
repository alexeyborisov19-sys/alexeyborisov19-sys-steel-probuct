export const siteMode = {
  isTest: true,
  label: "Сайт работает в тестовом режиме до завершения согласования документов.",
} as const;

/**
 * The header is absolutely positioned over the hero, so every hero reserves the
 * header's height as its own top padding. The test-mode banner lives inside the
 * header and makes it taller, which is why these offsets are derived from the
 * same flag that renders the banner: an offset without a banner leaves an empty
 * strip under the header, and a banner without the offset pushes the header over
 * page content. Keeping both on one switch makes those states unreachable.
 *
 * Tailwind only emits classes it can see as literals, so each variant is spelled
 * out instead of being composed at runtime.
 */
export const heroOffset = siteMode.isTest
  ? "min-h-[638px] pt-[100px]"
  : "min-h-[610px] pt-[72px]";

export const innerHeroOffset = siteMode.isTest
  ? "min-h-[648px] pt-[116px]"
  : "min-h-[620px] pt-[88px]";

# Customer review sources — 28 September 2026

The owner requested a homepage review area and consolidation of existing public reviews.

- Yandex Business authenticated company record 167948059010 identifies «Сталь Продукт», Smolensk, Roslavlskoe highway. Its Reviews section currently displays «Отзывов пока нет». Public Maps link resolves to the same company: https://yandex.ru/maps/org/stal_produkt/167948059010/?tab=reviews . No numerical rating or testimonial has been published on our site.
- Avito official profile was already verified in `data/entity-references.ts`. Reading it today returns an IP access challenge. Review text, rating and count remain unverified; the homepage links to the company profile without claiming any of them.
- Reference layouts: Xometry customer testimonials and SendCutSend testimonials use attributable customer evidence and links to source/stories. Our implementation uses a compact static source directory until genuine review excerpts can be verified.

The homepage block sits after project scenarios and before the final quote CTA. It loads no external widgets/scripts and makes no third-party request before a visitor follows a link. Yandex was also added to the official Organization sameAs sources. Protected header, hero and project scenarios remain unchanged.

Follow-up: verify Avito after its normal access challenge is resolved; if reviews exist, add short attributed excerpts with direct source links, preserving original meaning. Do not substitute reviews of similarly named companies or imply that a source directory is a complete imported review collection.

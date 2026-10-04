/** Transcribed from owner-supplied assembly drawing, visually reviewed.
 * This is a reference BOM, NOT a load-approved configurable production family.
 * Private drawing provenance is kept outside the public repository.
 */
export const basketReference = {
  width: 1180,
  height: 630,
  depth: 510,
  parts: [
    { name: "Передняя панель", quantity: 1, thicknessMm: 1 },
    { name: "Боковая панель", quantity: 2, thicknessMm: 1 },
    { name: "Усиление", quantity: 1, thicknessMm: 1 },
    { name: "Полка", quantity: 2, thicknessMm: 2 },
    { name: "Z-образный уголок", quantity: 2, thicknessMm: 2 },
    { name: "Пятка", quantity: 2, thicknessMm: 3 },
  ],
  fasteners: [
    { name: "Винт М6×16", quantity: 24 },
    { name: "Болт М6×20", quantity: 4 },
    { name: "Гайка М6", quantity: 4 },
    { name: "Шайба М6", quantity: 8 },
    { name: "Болт М10×20", quantity: 8 },
    { name: "Гайка М10", quantity: 8 },
    { name: "Шайба М10", quantity: 16 },
  ],
} as const;

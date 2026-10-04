/** Owner-approved final prices for the basic painted 900×600×550 basket, 2026-10-04.
 * No second commercial uplift. Other constructions need a separate quote.
 */
export const basketPriceTiers = [
  { min: 1, max: 10, price: 7300, label: "1–10 шт." },
  { min: 11, max: 49, price: 6700, label: "11–49 шт." },
  { min: 50, max: 99, price: 6100, label: "50–99 шт." },
  { min: 100, max: 10000, price: 5600, label: "От 100 шт." },
] as const;
export function basketVolumePrice(quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000)
    return null;
  const tier = basketPriceTiers.find(
    (t) => quantity >= t.min && quantity <= t.max,
  )!;
  return { unit: tier.price, total: tier.price * quantity };
}

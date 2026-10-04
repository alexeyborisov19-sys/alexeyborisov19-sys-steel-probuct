import "server-only";
import type { BasketEstimateRates } from "@/lib/quote/basket-volume-price";
import { selectBestStoredPrice } from "@/lib/instant-quote/material-price-feed";
import { applyMetalUplift } from "@/lib/instant-quote/pricing";
import { loadPrivateCalculationBasis, type PrivateCalculationBasis } from "./private-calculation-basis";
import { publicEstimateRateBook } from "./public-estimate-rates";
import { metalMarketUpliftPct } from "./metal-market-uplift";

/** Server-only extraction. Never expose this object or its source rows in an API response. */
export function basketRatesFromPrivateBasis(
  basis: PrivateCalculationBasis,
  now = new Date(),
  materialUpliftPct = metalMarketUpliftPct(),
): BasketEstimateRates {
  const selected = selectBestStoredPrice(basis.materialPriceSnapshots, "zinc", 1, now);
  if (!selected.price?.exactThickness || selected.stale) throw new Error("Basket material basis unavailable");
  const book = publicEstimateRateBook(basis.rateBook);
  const laser = book.laserRubPerM.find((row) => row.materialId === "zinc" && Math.abs(row.thicknessMm - 1) < .01);
  const rates = {
    metalRubPerKg: applyMetalUplift(selected.price.rubPerTon, materialUpliftPct) / 1000,
    laserRubPerM: laser?.rateRub,
    pierceRubEach: laser?.pierceRubEach,
    powderRubPerM2: book.powderRubPerM2?.rateRub,
    preparationRubPerM2: book.surfacePreparationRubPerM2?.rateRub,
  };
  if (!Object.values(rates).every((value) => typeof value === "number" && Number.isFinite(value) && value > 0)) {
    throw new Error("Basket operation basis unavailable");
  }
  return rates as BasketEstimateRates;
}

export async function loadPrivateBasketRates(): Promise<BasketEstimateRates> {
  return basketRatesFromPrivateBasis(await loadPrivateCalculationBasis());
}

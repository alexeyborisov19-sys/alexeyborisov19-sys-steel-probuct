import type {ClientProjectCalculationView} from './client-calculation-view';

/** Never present a partial project sum as the complete commercial offer. */
export function summarizeClientPrices(calculation: ClientProjectCalculationView | null, expectedParts: number) {
  if (!calculation || calculation.parts.length !== expectedParts) return {subtotalRub: null, unpricedParts: 0};
  const priced = calculation.parts.filter(part => ['approved','estimate'].includes(part.price.status)
    && Number.isFinite(part.price.totalRub) && (part.price.totalRub ?? 0) > 0);
  return {
    subtotalRub: priced.length ? Math.round(priced.reduce((sum, part) => sum + part.price.totalRub!, 0) * 100) / 100 : null,
    unpricedParts: calculation.parts.length - priced.length,
  };
}

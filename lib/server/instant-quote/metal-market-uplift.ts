import "server-only";

/**
 * Owner-approved uplift added on top of the supplier's metal price.
 *
 * The value stays server-only: the browser receives a finished total, never the
 * uplift or the supplier price it is applied to. `STEEL_PRODUCT_METAL_UPLIFT_PCT`
 * lets production change it without a code deploy; the default is the 5 %
 * approved by the owner.
 */
const DEFAULT_METAL_UPLIFT_PCT = 5;
const MAX_METAL_UPLIFT_PCT = 100;

export function metalMarketUpliftPct(
  environment: NodeJS.ProcessEnv = process.env,
): number {
  const raw = environment.STEEL_PRODUCT_METAL_UPLIFT_PCT?.trim();
  if (!raw) return DEFAULT_METAL_UPLIFT_PCT;

  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_METAL_UPLIFT_PCT) {
    // A malformed override must never silently price metal at cost.
    return DEFAULT_METAL_UPLIFT_PCT;
  }
  return parsed;
}

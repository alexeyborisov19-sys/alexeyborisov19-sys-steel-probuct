import { paidServicesAllowed, localAiSelected } from "@/lib/server/quote-engine/service-policy";
/** Runtime policy: deploying code does not enable a paid provider. */
export function quoteAiReviewRequired(environment: Record<string, string | undefined> = process.env): boolean {
  const setting = environment.STEEL_PRODUCT_QUOTE_AI_REVIEW_REQUIRED;
  if (setting === "true") return true;
  if (setting === "false") return false;
  // A malformed explicit setting must not accidentally disable a requested gate.
  if (setting != null && setting !== "") return true;
  // Preserve the existing deterministic service until the operator enables AI.
  // Once enabled in production, absent credentials and provider failures hold prices.
  return environment.NODE_ENV === "production" && (localAiSelected(environment)
    || (paidServicesAllowed(environment) && environment.YANDEX_AI_ENABLED === "true"));
}

/** Operator-only policy. Public request data must never override these settings. */
export function quoteAiReviewRequired(environment: Readonly<Record<string, string | undefined>> = process.env): boolean {
  const setting = environment.STEEL_PRODUCT_QUOTE_AI_REVIEW_REQUIRED;
  if (setting === "true") return true;
  if (setting === "false") return false;
  return environment.NODE_ENV === "production";
}

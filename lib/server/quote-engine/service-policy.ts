/** Server-owned switches. Keys, browser flags and free-trial credits are not spending consent. */
export type ServiceEnvironment = Readonly<Record<string, string | undefined>>;
export function paidServicesAllowed(environment: ServiceEnvironment = process.env): boolean {
  return environment.STEEL_PRODUCT_PAID_SERVICES_ALLOWED === "true";
}
export function localAiSelected(environment: ServiceEnvironment = process.env): boolean {
  return environment.STEEL_PRODUCT_LOCAL_AI_ENABLED === "true";
}

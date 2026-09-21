/** Only production routes opt into this environment. The PD rollout flag is never mutated. */
export function productionAccessEnvironment(environment: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...environment, PD_ADMIN_ENABLED: environment.STEEL_PRODUCT_PRODUCTION_APP_ENABLED === "true" || environment.PD_ADMIN_ENABLED === "true" ? "true" : "false" };
}

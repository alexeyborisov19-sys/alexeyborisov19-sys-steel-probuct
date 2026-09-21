import { productionAccessEnvironment } from "./environment";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { PdPermission } from "@/lib/pd-admin/auth/permissions";
import {
  authenticatePdSession,
  PdAuthenticationError,
  PdPasswordChangeRequiredError,
  PdPermissionError,
} from "@/lib/pd-admin/auth/context";
import { PD_CSRF_COOKIE, PD_SESSION_COOKIE } from "@/lib/pd-admin/auth/session";
import { readPdAdminConfig } from "@/lib/pd-admin/config";
import { administrativeRequestHashes } from "@/lib/pd-admin/http/request";

export function requireProductionEnabled() {
  const config = readPdAdminConfig(productionAccessEnvironment());
  if (!config.enabled) notFound();
  return config;
}

export async function requireProductionPageContext(
  permission?: PdPermission,
  options: { allowPasswordChange?: boolean } = {},
) {
  const config = requireProductionEnabled();
  if (!config.sessionHashKey) notFound();
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const hashes = administrativeRequestHashes(requestHeaders, config.sessionHashKey);
  try {
    return authenticatePdSession({
      sessionToken: cookieStore.get(PD_SESSION_COOKIE)?.value,
      csrfToken: cookieStore.get(PD_CSRF_COOKIE)?.value,
      ipHash: hashes.ipHash,
      userAgentHash: hashes.userAgentHash,
      permission,
      allowPasswordChange: options.allowPasswordChange,
      environment: productionAccessEnvironment(),
    });
  } catch (error) {
    if (error instanceof PdPasswordChangeRequiredError) redirect("/internal/production-access/change-password");
    if (error instanceof PdAuthenticationError) redirect("/internal/production-access/login");
    if (error instanceof PdPermissionError) notFound();
    throw error;
  }
}

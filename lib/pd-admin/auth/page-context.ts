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

export function requirePdAdminEnabled() {
  const config = readPdAdminConfig();
  if (!config.enabled) notFound();
  return config;
}

export async function requirePdPageContext(
  permission?: PdPermission,
  options: { allowPasswordChange?: boolean } = {},
) {
  const config = requirePdAdminEnabled();
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
    });
  } catch (error) {
    if (error instanceof PdPasswordChangeRequiredError) redirect("/internal/personal-data/change-password");
    if (error instanceof PdAuthenticationError) redirect("/internal/personal-data/login");
    if (error instanceof PdPermissionError) notFound();
    throw error;
  }
}

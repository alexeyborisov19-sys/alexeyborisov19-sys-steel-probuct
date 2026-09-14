"use client";

/**
 * Backward-compatible alias only.
 *
 * The former Alpha workspace exposed detailed DFM/pricing diagnostics in a
 * client component. Public UI must use the client-safe workspace so private
 * production economics and internal process diagnostics can never be shipped
 * to the browser accidentally.
 */
export { ClientManufacturingWorkspace as ManufacturingWorkspace } from "@/components/ClientManufacturingWorkspace";

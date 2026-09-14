"use client";

/**
 * Backward-compatible alias only.
 *
 * The legacy Alpha workspace contained client-side DFM and pricing diagnostics.
 * Keep a single public-safe implementation so internal production information
 * cannot be reintroduced by importing an older component name.
 */
export { ClientManufacturingWorkspace as InstantQuoteWorkspace } from "@/components/ClientManufacturingWorkspace";

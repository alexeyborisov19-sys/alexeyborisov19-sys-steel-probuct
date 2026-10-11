/** Rejects blank PDF pages while preserving Poppler's page boundaries. */
export function printablePdfPages(extracted: string): string[];
/** Extracts and raster-checks an existing PDF using installed Poppler tools. */
export function assertPrintablePdf(path: string): { pages: string[]; text: string };

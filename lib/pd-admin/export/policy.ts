import { requestIdPattern } from "@/lib/pd-admin/storage/safe-files";
import type { ExportFilter, ExportPreview } from "@/lib/pd-admin/export/types";

export class PdExportPolicyError extends Error {
  readonly code = "PD_EXPORT_POLICY_REJECTED";

  constructor() {
    super("Official export does not satisfy selection and minimization requirements");
    this.name = "PdExportPolicyError";
  }
}

export function assertSelectiveExportFilter(filter: ExportFilter) {
  const requestIds = filter.requestIds?.filter((value) => requestIdPattern.test(value)) ?? [];
  if (filter.requestIds && requestIds.length !== filter.requestIds.length) throw new PdExportPolicyError();
  const hasExactSelector = Boolean(
    requestIds.length
      || filter.subjectRequestId?.trim()
      || filter.authorityRequestId?.trim()
      || filter.phoneHmac?.trim()
      || filter.emailHmac?.trim(),
  );
  const from = filter.createdFrom ? Date.parse(filter.createdFrom) : Number.NaN;
  const to = filter.createdTo ? Date.parse(filter.createdTo) : Number.NaN;
  const hasBoundedPeriod = Number.isFinite(from) && Number.isFinite(to) && from <= to
    && to - from <= 366 * 86_400_000;
  if (!hasExactSelector && !hasBoundedPeriod) throw new PdExportPolicyError();
}

export function assertExportPreviewIsBounded(preview: ExportPreview, limits = { records: 500, bytes: 2 * 1024 * 1024 * 1024 }) {
  if (preview.recordsCount < 1 || preview.recordsCount > limits.records || preview.totalBytes > limits.bytes) {
    throw new PdExportPolicyError();
  }
}

export function neutralizeSpreadsheetFormula(value: string) {
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function assertMetadataExcludesFinalArchiveHash(metadata: Record<string, unknown>) {
  for (const forbidden of ["archiveSha256", "archive_sha256", "zipSha256", "zip_sha256"]) {
    if (forbidden in metadata) throw new PdExportPolicyError();
  }
}

export const exportStates = ["DRAFT", "PREVIEW_READY", "APPROVAL_REQUIRED", "BUILDING", "READY", "DOWNLOADED", "TRANSFERRED", "EXPIRED", "DELETED", "FAILED"] as const;
export type ExportState = typeof exportStates[number];

export const officialExportTypes = ["SUBJECT_REQUEST", "AUTHORITY_REQUEST", "COURT_REQUEST", "LAW_ENFORCEMENT_REQUEST", "INTERNAL_INVESTIGATION", "OTHER"] as const;
export type OfficialExportType = typeof officialExportTypes[number];

export const exportCategories = ["RECORDS", "CONSENT", "ATTACHMENTS", "ACCESS_EVENTS", "WORKFLOW", "COMMENTS", "TECHNICAL_EVENTS"] as const;
export type ExportCategory = typeof exportCategories[number];

export type ExportFilter = {
  requestIds?: string[];
  subjectRequestId?: string;
  authorityRequestId?: string;
  phoneHmac?: string;
  emailHmac?: string;
  createdFrom?: string;
  createdTo?: string;
  sources?: Array<"quote-form" | "engineering-assistant">;
};

export type ExportPreview = {
  requestIds: string[];
  recordsCount: number;
  consentRecordsCount: number;
  attachmentsCount: number;
  totalBytes: number;
  categories: ExportCategory[];
  sources: string[];
  blockedFiles: number;
  unavailableRecords: number;
  warnings: string[];
};

export type ExportDraftInput = {
  type: OfficialExportType;
  authorityName?: string | null;
  requestNumber: string;
  requestDate: string;
  legalBasis: string;
  filter: ExportFilter;
  categories: ExportCategory[];
  responsibleUserId: string;
  approvingUserId: string;
  subjectRequestId?: string | null;
  authorityRequestId?: string | null;
};

export type ExportArchiveItem = {
  itemType: string;
  sourceId: string;
  relativePath: string;
  sha256: string;
  sizeBytes: number;
};

export type EmbeddedExportMetadata = {
  operator_name: "Общество с ограниченной ответственностью «ЭНЕРГОАЛЬЯНС»";
  operator_inn: "6732110789";
  operator_ogrn: "1156733014657";
  created_at: string;
  export_id: string;
  export_type: OfficialExportType;
  legal_basis: string;
  authority_or_subject: string;
  request_number: string;
  request_date: string;
  created_by: string;
  approved_by: string;
  filters: Record<string, unknown>;
  categories: ExportCategory[];
  records_count: number;
  consent_count: number;
  attachments_count: number;
  total_bytes: number;
  manifest_sha256: string;
  archive_expires_at: string;
  notice: string;
};

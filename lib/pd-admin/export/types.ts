export const exportStates = [
  "DRAFT",
  "PREVIEW_READY",
  "APPROVAL_REQUIRED",
  "BUILDING",
  "READY",
  "DOWNLOADED",
  "EXPIRED",
  "DELETED",
  "FAILED",
] as const;

export type ExportState = (typeof exportStates)[number];

export type OfficialExportType =
  | "SUBJECT_REQUEST"
  | "RKN_REQUEST"
  | "COURT_REQUEST"
  | "LAW_ENFORCEMENT_REQUEST"
  | "INTERNAL_INVESTIGATION"
  | "OTHER";

export type ExportFilter = {
  requestIds?: string[];
  subjectRequestId?: string;
  phoneHmac?: string;
  emailHmac?: string;
  createdFrom?: string;
  createdTo?: string;
  sources?: Array<"quote-form" | "engineering-assistant">;
  includeAttachments?: boolean;
  includeConsentAudit?: boolean;
  includeTechnicalEvents?: boolean;
  includeAccessEvents?: boolean;
};

export type ExportPreview = {
  recordsCount: number;
  consentRecordsCount: number;
  attachmentsCount: number;
  totalBytes: number;
  categories: string[];
  containsThirdPartyRisk: boolean;
};

export type ExportDraftInput = {
  type: OfficialExportType;
  authorityName: string;
  requestNumber: string;
  requestDate: string;
  legalBasis: string;
  filter: ExportFilter;
};

export type ExportArchiveItem = {
  itemType: string;
  sourceId: string;
  relativePath: string;
  sha256: string;
  sizeBytes: number;
};

export type EmbeddedExportMetadata = {
  operator: "ООО «ЭНЕРГОАЛЬЯНС»";
  generatedAt: string;
  exportId: string;
  legalBasis: string;
  requestNumber: string;
  requestedByUserId: string;
  approvedByUserId: string;
  filters: ExportFilter;
  recordsCount: number;
  dataCategories: string[];
  attachmentsIncluded: boolean;
  archiveExpiresAt: string;
  manifestSha256: string;
};

export interface OfficialExportService {
  createDraft(input: ExportDraftInput, requestedByUserId: string): Promise<{ exportId: string }>;
  buildPreview(exportId: string): Promise<ExportPreview>;
  requestApproval(exportId: string, userId: string): Promise<void>;
  approve(exportId: string, approverUserId: string, stepUpVerifiedAt: string): Promise<void>;
  buildArchive(exportId: string): Promise<{ archiveSha256: string; manifestSha256: string }>;
  recordDownload(exportId: string, userId: string, ipHash: string): Promise<void>;
  expireArchives(now?: Date): Promise<number>;
}

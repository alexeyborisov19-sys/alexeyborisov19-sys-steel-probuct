export type BackupSource =
  | "quote-leads"
  | "assistant-leads"
  | "consent-audit"
  | "quarantine"
  | "personal-data-sqlite"
  | "legal-document-versions"
  | "administrative-reports";

export type BackupPlan = {
  sources: BackupSource[];
  excludes: string[];
  destinationType: "RUSSIAN_SECOND_VPS" | "RUSSIAN_OBJECT_STORAGE" | "LOCAL_ENCRYPTED_OFFLINE";
  encryption: "age" | "gpg" | "provider-managed-and-client-side";
  retentionDays: number;
  rpoHours: number;
  rtoHours: number;
  restoreTarget: "isolated-staging-directory";
};

export interface BackupService {
  create(plan: BackupPlan): Promise<{ backupRunId: string; archiveSha256: string }>;
  verifyChecksum(backupRunId: string): Promise<boolean>;
  restoreToIsolatedLocation(backupRunId: string): Promise<{ restorePathId: string }>;
  confirmRestore(backupRunId: string, verifiedByUserId: string): Promise<void>;
}

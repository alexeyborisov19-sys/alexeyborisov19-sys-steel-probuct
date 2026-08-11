export const deletionStages = [
  "SCAN",
  "CANDIDATES",
  "POLICY_CHECK",
  "HUMAN_APPROVAL",
  "LOCK",
  "DELETE",
  "VERIFY",
  "REPORT",
  "AUDIT",
] as const;

export type DeletionBlockers = {
  legalHold: boolean;
  openSubjectRequest: boolean;
  governmentRequest: boolean;
  courtBasis: boolean;
  openIncident: boolean;
  activeExport: boolean;
  contractualBasis: boolean;
  retentionOverride: boolean;
  backupRequiredButMissing: boolean;
};

export type DeletionCandidate = {
  requestId: string;
  expiresAt: string;
  consentExpiresAt?: string | null;
  blockers: DeletionBlockers;
};

export function evaluateDeletionCandidate(candidate: DeletionCandidate, now = new Date()) {
  const blockerCodes = Object.entries(candidate.blockers)
    .filter(([, active]) => active)
    .map(([code]) => code);
  const leadExpired = Date.parse(candidate.expiresAt) <= now.getTime();
  const consentExpired = candidate.consentExpiresAt
    ? Date.parse(candidate.consentExpiresAt) <= now.getTime()
    : false;
  return {
    eligible: leadExpired && blockerCodes.length === 0,
    leadExpired,
    preserveConsentAudit: !consentExpired,
    blockerCodes,
  };
}

export type DeletionLockService = {
  acquire(requestId: string, operation: "EXPORT" | "DELETE"): Promise<{ release(): Promise<void> }>;
};

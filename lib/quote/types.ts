import type { QuarantinedUpload } from "@/lib/security/uploads";

export type QuoteErrorCode =
  | "ACCEPTED"
  | "CONFIGURATION_ERROR"
  | "CONSENT_AUDIT_DEFERRED"
  | "CROSS_ORIGIN_REJECTED"
  | "DUPLICATE_REQUEST"
  | "INTERNAL_ERROR"
  | "RATE_LIMITED"
  | "SMTP_DELIVERY_DEFERRED"
  | "STORAGE_ERROR"
  | "UPLOAD_REJECTED"
  | "VALIDATION_ERROR";

export type QuoteConsent = {
  event: "quote_request_consent";
  recordedAt: string;
  clientTimestamp: string | null;
  personalData: true;
  personalDataConsentVersion: string;
  privacyVersion: string;
  marketing: boolean;
  marketingConsentVersion: string | null;
  ipHash: string;
};

export type QuoteRecord = {
  requestId: string;
  createdAt: string;
  source: "quote-form";
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  message: string | null;
  pageUrl: string | null;
  referrer: string | null;
  attribution: Record<string, string>;
  files: QuarantinedUpload[];
  consent: QuoteConsent;
  consentAudit: "pending" | "recorded" | "deferred";
  delivery: "email" | "stored";
  retentionDays: number;
};

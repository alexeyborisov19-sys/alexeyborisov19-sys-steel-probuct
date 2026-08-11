-- Stage 4 adds legal-process metadata without copying primary lead payloads.
-- Legacy status columns remain for backwards compatibility; stage4_status is authoritative.

ALTER TABLE subject_requests ADD COLUMN id TEXT;
ALTER TABLE subject_requests ADD COLUMN request_type TEXT NOT NULL DEFAULT 'OTHER'
  CHECK (request_type IN ('ACCESS','CLARIFICATION','BLOCKING','DELETION','CONSENT_WITHDRAWAL','PROCESSING_INFORMATION','OTHER'));
ALTER TABLE subject_requests ADD COLUMN legal_basis TEXT NOT NULL DEFAULT 'UNSPECIFIED';
ALTER TABLE subject_requests ADD COLUMN stage4_identity_status TEXT NOT NULL DEFAULT 'NOT_STARTED'
  CHECK (stage4_identity_status IN ('NOT_STARTED','ADDITIONAL_INFORMATION_REQUIRED','VERIFIED','FAILED','NOT_REQUIRED'));
ALTER TABLE subject_requests ADD COLUMN stage4_status TEXT NOT NULL DEFAULT 'RECEIVED'
  CHECK (stage4_status IN ('RECEIVED','IDENTITY_REQUIRED','IDENTITY_VERIFICATION','IN_PROGRESS','RESPONSE_PREPARED','APPROVAL_REQUIRED','COMPLETED','REJECTED_WITH_REASON','EXTENDED','CLOSED'));
ALTER TABLE subject_requests ADD COLUMN initial_due_at TEXT;
ALTER TABLE subject_requests ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);
CREATE UNIQUE INDEX subject_requests_id_idx ON subject_requests(id);
CREATE INDEX subject_requests_stage4_due_idx ON subject_requests(stage4_status, due_at, extended_due_at);

CREATE TABLE subject_identity_checks (
  id TEXT PRIMARY KEY,
  subject_request_id TEXT NOT NULL,
  method TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('ADDITIONAL_INFORMATION_REQUIRED','VERIFIED','FAILED','NOT_REQUIRED')),
  checked_at TEXT NOT NULL,
  checked_by TEXT NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  basis TEXT NOT NULL,
  FOREIGN KEY(subject_request_id) REFERENCES subject_requests(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE subject_request_deadline_events (
  id TEXT PRIMARY KEY,
  subject_request_id TEXT NOT NULL,
  previous_due_at TEXT NOT NULL,
  new_due_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY(subject_request_id) REFERENCES subject_requests(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE authority_requests (
  id TEXT PRIMARY KEY,
  registration_number TEXT NOT NULL UNIQUE,
  received_at TEXT NOT NULL,
  authority_name TEXT NOT NULL,
  department TEXT,
  official_name TEXT,
  official_position TEXT,
  request_number TEXT NOT NULL,
  request_date TEXT NOT NULL,
  delivery_channel TEXT NOT NULL,
  legal_basis TEXT NOT NULL,
  requested_scope TEXT NOT NULL,
  due_at TEXT NOT NULL,
  initial_due_at TEXT NOT NULL,
  extended_due_at TEXT,
  extension_reason TEXT,
  verification_status TEXT NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (verification_status IN ('NOT_STARTED','ADDITIONAL_INFORMATION_REQUIRED','VERIFIED','FAILED')),
  responsible_user_id TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN ('RECEIVED','VERIFICATION_REQUIRED','VERIFIED','IN_PROGRESS','PACKAGE_PREPARED','APPROVAL_REQUIRED','READY_TO_TRANSFER','TRANSFERRED','COMPLETED','REJECTED_WITH_REASON','CLOSED')),
  export_id TEXT REFERENCES exports(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  response_sent_at TEXT,
  response_channel TEXT,
  transfer_reference TEXT,
  result_summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE INDEX authority_requests_status_due_idx ON authority_requests(status, due_at, extended_due_at);

CREATE TABLE authority_request_leads (
  authority_request_id TEXT NOT NULL REFERENCES authority_requests(id) ON UPDATE CASCADE ON DELETE CASCADE,
  request_id TEXT NOT NULL REFERENCES lead_index(request_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  PRIMARY KEY(authority_request_id, request_id)
);

CREATE TABLE authority_request_deadline_events (
  id TEXT PRIMARY KEY,
  authority_request_id TEXT NOT NULL REFERENCES authority_requests(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  previous_due_at TEXT NOT NULL,
  new_due_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);

DROP INDEX legal_holds_one_active_per_request_idx;
ALTER TABLE legal_holds ADD COLUMN subject_request_id TEXT REFERENCES subject_requests(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE legal_holds ADD COLUMN authority_request_id TEXT REFERENCES authority_requests(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE legal_holds ADD COLUMN incident_id TEXT REFERENCES incidents(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE legal_holds ADD COLUMN stage4_status TEXT NOT NULL DEFAULT 'ACTIVE'
  CHECK (stage4_status IN ('ACTIVE','REVIEW_REQUIRED','RELEASED'));
ALTER TABLE legal_holds ADD COLUMN release_reason TEXT;
ALTER TABLE legal_holds ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);
CREATE INDEX legal_holds_stage4_scope_idx ON legal_holds(stage4_status, review_at, subject_request_id, authority_request_id, incident_id);

CREATE TABLE legal_hold_leads (
  legal_hold_id TEXT NOT NULL REFERENCES legal_holds(id) ON UPDATE CASCADE ON DELETE CASCADE,
  request_id TEXT NOT NULL REFERENCES lead_index(request_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  PRIMARY KEY(legal_hold_id, request_id)
);

ALTER TABLE exports ADD COLUMN subject_request_id TEXT REFERENCES subject_requests(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE exports ADD COLUMN authority_request_id TEXT REFERENCES authority_requests(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE exports ADD COLUMN responsible_user_id TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE exports ADD COLUMN approving_user_id TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE exports ADD COLUMN stage4_status TEXT NOT NULL DEFAULT 'DRAFT'
  CHECK (stage4_status IN ('DRAFT','PREVIEW_READY','APPROVAL_REQUIRED','BUILDING','READY','DOWNLOADED','TRANSFERRED','EXPIRED','DELETED','FAILED'));
ALTER TABLE exports ADD COLUMN categories_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE exports ADD COLUMN preview_json TEXT;
ALTER TABLE exports ADD COLUMN approval_self_used INTEGER NOT NULL DEFAULT 0 CHECK (approval_self_used IN (0,1));
ALTER TABLE exports ADD COLUMN updated_at TEXT;
ALTER TABLE exports ADD COLUMN transferred_at TEXT;
ALTER TABLE exports ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);
CREATE INDEX exports_stage4_status_expiry_idx ON exports(stage4_status, expires_at);

CREATE TABLE export_transfers (
  id TEXT PRIMARY KEY,
  export_id TEXT NOT NULL REFERENCES exports(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  transferred_at TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('OFFICIAL_PORTAL','SECURE_SYSTEM','REGISTERED_MAIL','IN_PERSON','OTHER_APPROVED')),
  recipient_reference TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  transfer_reference TEXT NOT NULL,
  transferred_by TEXT NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  confirmed_by TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
);

ALTER TABLE deletion_jobs ADD COLUMN stage4_mode TEXT NOT NULL DEFAULT 'DRY_RUN'
  CHECK (stage4_mode IN ('DRY_RUN','APPROVED_DELETE'));
ALTER TABLE deletion_jobs ADD COLUMN stage4_status TEXT NOT NULL DEFAULT 'SCAN'
  CHECK (stage4_status IN ('SCAN','CANDIDATES','POLICY_CHECK','HUMAN_APPROVAL','LOCKED','DELETING','VERIFYING','REPORTING','ACT','COMPLETED','PARTIALLY_COMPLETED','FAILED'));
ALTER TABLE deletion_jobs ADD COLUMN approved_at TEXT;
ALTER TABLE deletion_jobs ADD COLUMN step_up_verified_at TEXT;
ALTER TABLE deletion_jobs ADD COLUMN approval_self_used INTEGER NOT NULL DEFAULT 0 CHECK (approval_self_used IN (0,1));
ALTER TABLE deletion_jobs ADD COLUMN act_path TEXT;
ALTER TABLE deletion_jobs ADD COLUMN act_sha256 TEXT;
ALTER TABLE deletion_jobs ADD COLUMN updated_at TEXT;
ALTER TABLE deletion_jobs ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);

CREATE TABLE deletion_candidates (
  id TEXT PRIMARY KEY,
  deletion_job_id TEXT NOT NULL REFERENCES deletion_jobs(id) ON UPDATE CASCADE ON DELETE CASCADE,
  request_id TEXT NOT NULL REFERENCES lead_index(request_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  expires_at TEXT NOT NULL,
  consent_expires_at TEXT,
  blockers_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CANDIDATE','BLOCKED','APPROVED','LOCKED','DELETED','PARTIALLY_DELETED','FAILED','SKIPPED')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(deletion_job_id, request_id)
);

ALTER TABLE deletion_records ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'PENDING'
  CHECK (verification_status IN ('PENDING','VERIFIED','FAILED','PARTIAL'));
ALTER TABLE deletion_records ADD COLUMN verified_at TEXT;
ALTER TABLE deletion_records ADD COLUMN act_id TEXT;

CREATE TABLE deletion_acts (
  id TEXT PRIMARY KEY,
  deletion_job_id TEXT NOT NULL UNIQUE REFERENCES deletion_jobs(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  act_number TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  basis TEXT NOT NULL,
  categories_json TEXT NOT NULL,
  request_ids_json TEXT NOT NULL,
  files_count INTEGER NOT NULL CHECK (files_count >= 0),
  method TEXT NOT NULL,
  executed_by TEXT NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  verified_by TEXT NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  result TEXT NOT NULL,
  preserved_records_json TEXT NOT NULL,
  exceptions_json TEXT NOT NULL,
  report_sha256 TEXT NOT NULL,
  document_path TEXT NOT NULL,
  document_sha256 TEXT NOT NULL
);

ALTER TABLE incidents ADD COLUMN stage4_status TEXT NOT NULL DEFAULT 'OPEN'
  CHECK (stage4_status IN ('OPEN','ASSESSMENT','CONTAINED','NOTIFICATION_REQUIRED','NOTIFIED','INVESTIGATION','REMEDIATION','CLOSED'));
ALTER TABLE incidents ADD COLUMN notification_assessment_basis TEXT;
ALTER TABLE incidents ADD COLUMN updated_at TEXT;
ALTER TABLE incidents ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);

CREATE TABLE incident_leads (
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  request_id TEXT NOT NULL REFERENCES lead_index(request_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  PRIMARY KEY(incident_id, request_id)
);

ALTER TABLE systems_registry ADD COLUMN id TEXT;
ALTER TABLE systems_registry ADD COLUMN created_at TEXT;
ALTER TABLE systems_registry ADD COLUMN updated_at TEXT;
ALTER TABLE systems_registry ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);
CREATE UNIQUE INDEX systems_registry_id_idx ON systems_registry(id) WHERE id IS NOT NULL;

ALTER TABLE legal_document_versions ADD COLUMN version_number INTEGER NOT NULL DEFAULT 1 CHECK (version_number > 0);
ALTER TABLE legal_document_versions ADD COLUMN updated_at TEXT;

ALTER TABLE backup_runs ADD COLUMN files_count INTEGER CHECK (files_count IS NULL OR files_count >= 0);
ALTER TABLE backup_runs ADD COLUMN total_bytes INTEGER CHECK (total_bytes IS NULL OR total_bytes >= 0);
ALTER TABLE backup_runs ADD COLUMN restore_result TEXT;
ALTER TABLE backup_runs ADD COLUMN registered_by TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE backup_runs ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);

CREATE TABLE backup_restore_tests (
  id TEXT PRIMARY KEY,
  backup_run_id TEXT NOT NULL REFERENCES backup_runs(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  tested_at TEXT NOT NULL,
  tested_by TEXT NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  result TEXT NOT NULL CHECK (result IN ('PASS','FAIL','PARTIAL')),
  files_verified INTEGER NOT NULL CHECK (files_verified >= 0),
  isolated_target TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

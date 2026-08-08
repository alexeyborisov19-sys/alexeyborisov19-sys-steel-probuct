CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_algorithm TEXT NOT NULL,
  password_version INTEGER NOT NULL CHECK (password_version > 0),
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'PERSONAL_DATA_OFFICER', 'MANAGER', 'AUDITOR')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0, 1)),
  failed_login_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until TEXT,
  password_changed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  last_login_at TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_secret_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  absolute_expires_at TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  user_agent_hash TEXT NOT NULL,
  step_up_until TEXT,
  revoked_at TEXT,
  revoke_reason TEXT
);

CREATE INDEX sessions_user_active_idx ON sessions(user_id, revoked_at, expires_at);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at, absolute_expires_at);

CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  attempted_at TEXT NOT NULL,
  success INTEGER NOT NULL CHECK (success IN (0, 1)),
  failure_reason TEXT,
  user_id TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL
);

CREATE INDEX login_attempts_username_time_idx ON login_attempts(username_hash, attempted_at DESC);
CREATE INDEX login_attempts_ip_time_idx ON login_attempts(ip_hash, attempted_at DESC);

CREATE TABLE lead_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('quote-form', 'engineering-assistant')),
  created_at TEXT NOT NULL,
  storage_path_type TEXT NOT NULL CHECK (storage_path_type IN ('quote-leads', 'assistant-leads')),
  phone_hmac TEXT,
  phone_hmac_key_version INTEGER,
  email_hmac TEXT,
  email_hmac_key_version INTEGER,
  retention_days INTEGER NOT NULL CHECK (retention_days > 0),
  expires_at TEXT NOT NULL,
  consent_audit_status TEXT NOT NULL,
  delivery_status TEXT,
  files_count INTEGER NOT NULL DEFAULT 0 CHECK (files_count >= 0),
  integrity_status TEXT NOT NULL,
  first_indexed_at TEXT NOT NULL,
  last_indexed_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX lead_index_created_idx ON lead_index(created_at DESC);
CREATE INDEX lead_index_expiry_idx ON lead_index(expires_at, deleted_at);
CREATE INDEX lead_index_phone_idx ON lead_index(phone_hmac_key_version, phone_hmac);
CREATE INDEX lead_index_email_idx ON lead_index(email_hmac_key_version, email_hmac);
CREATE INDEX lead_index_integrity_idx ON lead_index(integrity_status, consent_audit_status);

CREATE TABLE lead_workflow (
  request_id TEXT PRIMARY KEY REFERENCES lead_index(request_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  internal_status TEXT NOT NULL DEFAULT 'NEW' CHECK (internal_status IN (
    'NEW', 'IN_PROGRESS', 'NEEDS_CLARIFICATION', 'PROPOSAL_SENT',
    'CONTRACT', 'CLOSED', 'PENDING_DELETION', 'DELETED'
  )),
  assigned_user_id TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  legal_hold_active INTEGER NOT NULL DEFAULT 0 CHECK (legal_hold_active IN (0, 1)),
  retention_override_until TEXT,
  retention_override_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL
);

CREATE INDEX lead_workflow_status_idx ON lead_workflow(internal_status, assigned_user_id);

CREATE TABLE staff_comments (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES lead_index(request_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX staff_comments_request_idx ON staff_comments(request_id, created_at);

CREATE TABLE access_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  session_id TEXT REFERENCES sessions(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  legal_basis TEXT,
  result TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  previous_hash TEXT,
  event_hash TEXT NOT NULL UNIQUE
);

CREATE INDEX access_events_time_idx ON access_events(occurred_at DESC);
CREATE INDEX access_events_target_idx ON access_events(target_type, target_id, occurred_at DESC);
CREATE INDEX access_events_user_idx ON access_events(user_id, occurred_at DESC);

CREATE TABLE subject_requests (
  registration_number TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  subject_contact TEXT NOT NULL,
  identity_method TEXT,
  identity_status TEXT NOT NULL,
  request_summary TEXT NOT NULL,
  due_at TEXT NOT NULL,
  extended_due_at TEXT,
  extension_reason TEXT,
  responsible_user_id TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN (
    'RECEIVED', 'IDENTIFICATION_REQUIRED', 'IN_PROGRESS', 'RESPONSE_READY',
    'COMPLETED', 'REASONED_REFUSAL', 'EXTENDED', 'CLOSED'
  )),
  answered_at TEXT,
  response_method TEXT,
  result_summary TEXT,
  export_id TEXT REFERENCES exports(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX subject_requests_status_due_idx ON subject_requests(status, due_at);

CREATE TABLE subject_request_leads (
  registration_number TEXT NOT NULL REFERENCES subject_requests(registration_number) ON UPDATE CASCADE ON DELETE CASCADE,
  request_id TEXT NOT NULL REFERENCES lead_index(request_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  PRIMARY KEY (registration_number, request_id)
);

CREATE TABLE legal_holds (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES lead_index(request_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  basis_document TEXT,
  started_at TEXT NOT NULL,
  review_at TEXT NOT NULL,
  ended_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ended_by TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RELEASED'))
);

CREATE INDEX legal_holds_request_status_idx ON legal_holds(request_id, status, review_at);
CREATE UNIQUE INDEX legal_holds_one_active_per_request_idx
  ON legal_holds(request_id) WHERE status = 'ACTIVE';

CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  detected_at TEXT NOT NULL,
  detected_by TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_systems TEXT NOT NULL,
  data_categories TEXT NOT NULL,
  estimated_subjects INTEGER CHECK (estimated_subjects IS NULL OR estimated_subjects >= 0),
  initial_measures TEXT NOT NULL,
  rkn_notification_required INTEGER NOT NULL DEFAULT 0 CHECK (rkn_notification_required IN (0, 1)),
  initial_notification_at TEXT,
  additional_notification_at TEXT,
  investigation_result TEXT,
  remediation TEXT,
  closed_at TEXT,
  responsible_user_id TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CONTAINED', 'INVESTIGATING', 'NOTIFIED', 'CLOSED'))
);

CREATE INDEX incidents_status_idx ON incidents(status, detected_at DESC);

CREATE TABLE exports (
  id TEXT PRIMARY KEY,
  export_type TEXT NOT NULL,
  authority_name TEXT,
  request_number TEXT,
  request_date TEXT,
  legal_basis TEXT NOT NULL,
  filter_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'DRAFT', 'PREVIEW_READY', 'APPROVAL_REQUIRED', 'BUILDING', 'READY',
    'DOWNLOADED', 'EXPIRED', 'DELETED', 'FAILED'
  )),
  requested_by TEXT NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  approved_by TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  step_up_verified_at TEXT,
  archive_path TEXT,
  archive_sha256 TEXT,
  manifest_sha256 TEXT,
  records_count INTEGER NOT NULL DEFAULT 0 CHECK (records_count >= 0),
  consent_records_count INTEGER NOT NULL DEFAULT 0 CHECK (consent_records_count >= 0),
  attachments_count INTEGER NOT NULL DEFAULT 0 CHECK (attachments_count >= 0),
  total_bytes INTEGER NOT NULL DEFAULT 0 CHECK (total_bytes >= 0),
  created_at TEXT NOT NULL,
  expires_at TEXT,
  downloaded_at TEXT,
  deleted_at TEXT,
  failure_reason TEXT
);

CREATE INDEX exports_status_expiry_idx ON exports(status, expires_at);

CREATE TABLE lead_operation_locks (
  request_id TEXT PRIMARY KEY REFERENCES lead_index(request_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('EXPORT', 'DELETE')),
  operation_id TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  acquired_by TEXT NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE INDEX lead_operation_locks_expiry_idx ON lead_operation_locks(expires_at);

CREATE TABLE export_items (
  export_id TEXT NOT NULL REFERENCES exports(id) ON UPDATE CASCADE ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  relative_path TEXT,
  sha256 TEXT,
  size_bytes INTEGER CHECK (size_bytes IS NULL OR size_bytes >= 0),
  included INTEGER NOT NULL DEFAULT 1 CHECK (included IN (0, 1)),
  exclusion_reason TEXT,
  PRIMARY KEY (export_id, item_type, source_id)
);

CREATE TABLE export_downloads (
  id TEXT PRIMARY KEY,
  export_id TEXT NOT NULL REFERENCES exports(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  downloaded_at TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  result TEXT NOT NULL
);

CREATE INDEX export_downloads_export_idx ON export_downloads(export_id, downloaded_at DESC);

CREATE TABLE deletion_jobs (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('DRY_RUN', 'APPLY')),
  status TEXT NOT NULL CHECK (status IN (
    'SCAN', 'CANDIDATES', 'POLICY_CHECK', 'HUMAN_APPROVAL', 'LOCKED',
    'DELETING', 'VERIFYING', 'REPORTING', 'COMPLETED', 'FAILED'
  )),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  started_by TEXT NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  approved_by TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  candidates_count INTEGER NOT NULL DEFAULT 0 CHECK (candidates_count >= 0),
  deleted_count INTEGER NOT NULL DEFAULT 0 CHECK (deleted_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  report_path TEXT,
  report_sha256 TEXT,
  failure_reason TEXT
);

CREATE TABLE deletion_records (
  id TEXT PRIMARY KEY,
  deletion_job_id TEXT NOT NULL REFERENCES deletion_jobs(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  request_id TEXT NOT NULL,
  data_category TEXT NOT NULL,
  reason TEXT NOT NULL,
  deleted_paths_json TEXT NOT NULL,
  preserved_records_json TEXT NOT NULL,
  method TEXT NOT NULL,
  result TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  executed_by TEXT NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  verified_by TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  report_hash TEXT NOT NULL
);

CREATE INDEX deletion_records_request_idx ON deletion_records(request_id, deleted_at DESC);

CREATE TABLE systems_registry (
  system_name TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  provider TEXT NOT NULL,
  database_country TEXT NOT NULL,
  data_categories TEXT NOT NULL,
  legal_basis TEXT NOT NULL,
  agreement_reference TEXT,
  retention_description TEXT NOT NULL,
  responsible_user TEXT NOT NULL,
  administrators TEXT NOT NULL,
  mfa_status TEXT NOT NULL,
  export_method TEXT NOT NULL,
  deletion_method TEXT NOT NULL,
  last_review_at TEXT,
  status TEXT NOT NULL
);

CREATE TABLE legal_document_versions (
  id TEXT PRIMARY KEY,
  document_type TEXT NOT NULL,
  version TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  content_sha256 TEXT NOT NULL,
  archive_path TEXT NOT NULL,
  status TEXT NOT NULL,
  approved_by TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  approval_basis TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(document_type, version)
);

CREATE INDEX legal_document_versions_effective_idx ON legal_document_versions(document_type, effective_from, effective_to);

CREATE TABLE integrity_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  findings_count INTEGER NOT NULL DEFAULT 0 CHECK (findings_count >= 0),
  report_path TEXT,
  report_sha256 TEXT,
  executed_by TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL
);

CREATE TABLE backup_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  backup_type TEXT NOT NULL,
  status TEXT NOT NULL,
  destination_type TEXT NOT NULL,
  encrypted INTEGER NOT NULL CHECK (encrypted IN (0, 1)),
  archive_sha256 TEXT,
  restore_tested INTEGER NOT NULL DEFAULT 0 CHECK (restore_tested IN (0, 1)),
  restore_tested_at TEXT,
  failure_reason TEXT
);

-- Technical weekday calculations are advisory. A responsible employee must
-- confirm the actual legal deadline without overwriting the calculation.

ALTER TABLE subject_requests ADD COLUMN calculated_due_at TEXT;
ALTER TABLE subject_requests ADD COLUMN confirmed_due_at TEXT;
ALTER TABLE subject_requests ADD COLUMN due_confirmed_at TEXT;
ALTER TABLE subject_requests ADD COLUMN due_confirmed_by TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE subject_requests ADD COLUMN due_confirmation_basis TEXT;

ALTER TABLE authority_requests ADD COLUMN calculated_due_at TEXT;
ALTER TABLE authority_requests ADD COLUMN confirmed_due_at TEXT;
ALTER TABLE authority_requests ADD COLUMN due_confirmed_at TEXT;
ALTER TABLE authority_requests ADD COLUMN due_confirmed_by TEXT REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE authority_requests ADD COLUMN due_confirmation_basis TEXT;

CREATE INDEX subject_requests_confirmed_due_idx ON subject_requests(stage4_status, confirmed_due_at);
CREATE INDEX authority_requests_confirmed_due_idx ON authority_requests(status, confirmed_due_at);

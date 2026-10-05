/** Additive recovery metadata. 001 is immutable once a candidate has opened it. */
export const schema = `
ALTER TABLE plugin_state ADD COLUMN deleting INTEGER NOT NULL DEFAULT 0 CHECK(deleting IN(0,1));
ALTER TABLE plugin_state ADD COLUMN data_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plugin_state ADD COLUMN clear_command_id TEXT;
ALTER TABLE plugin_state ADD COLUMN module_generations TEXT NOT NULL DEFAULT '{"leaderboard":0,"monitor":0}' CHECK(json_valid(module_generations));
ALTER TABLE receipt_attempts ADD COLUMN epoch INTEGER NOT NULL DEFAULT 0;
ALTER TABLE receipt_attempts ADD COLUMN request_hash TEXT;
ALTER TABLE receipt_attempts ADD COLUMN request TEXT CHECK(request IS NULL OR json_valid(request));
ALTER TABLE receipt_attempts ADD COLUMN raw_response TEXT CHECK(raw_response IS NULL OR json_valid(raw_response));
ALTER TABLE receipt_attempts ADD COLUMN audit_ref TEXT;
ALTER TABLE receipt_attempts ADD COLUMN audit_settled INTEGER NOT NULL DEFAULT 0 CHECK(audit_settled IN(0,1));
UPDATE receipt_attempts SET epoch=(SELECT epoch FROM receipts WHERE receipts.id=receipt_attempts.receipt_id),request_hash=(SELECT request_hash FROM receipts WHERE receipts.id=receipt_attempts.receipt_id),request=(SELECT request FROM receipts WHERE receipts.id=receipt_attempts.receipt_id);
UPDATE receipt_attempts SET raw_response=(SELECT raw_response FROM receipts WHERE receipts.id=receipt_attempts.receipt_id),audit_ref=(SELECT audit_ref FROM receipts WHERE receipts.id=receipt_attempts.receipt_id) WHERE attempt=(SELECT attempt FROM receipts WHERE receipts.id=receipt_attempts.receipt_id);
CREATE INDEX attempts_audit_recovery ON receipt_attempts(audit_settled) WHERE raw_response IS NOT NULL AND service='llm';
CREATE TABLE dispatch_plans(logical_key TEXT PRIMARY KEY,epoch INTEGER NOT NULL,request_hash TEXT NOT NULL,request TEXT NOT NULL CHECK(json_valid(request)),created_at INTEGER NOT NULL) STRICT;
CREATE TABLE mutation_history(command_id TEXT PRIMARY KEY,kind TEXT NOT NULL,subject_id TEXT NOT NULL,reason TEXT NOT NULL,before_json TEXT CHECK(before_json IS NULL OR json_valid(before_json)),after_json TEXT CHECK(after_json IS NULL OR json_valid(after_json)),at INTEGER NOT NULL) STRICT;
`;

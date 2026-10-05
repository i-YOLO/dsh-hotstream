/** A cumulative, explicit model-test allowance never resets with rolling budgets or restart. */
export const schema=`
CREATE TABLE model_authorizations(id TEXT PRIMARY KEY,epoch INTEGER NOT NULL,provider TEXT NOT NULL,model TEXT NOT NULL,article_ids TEXT NOT NULL CHECK(json_valid(article_ids)),maximum INTEGER NOT NULL CHECK(maximum BETWEEN 1 AND 30),used INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1))) STRICT;
ALTER TABLE receipt_attempts ADD COLUMN authorization_id TEXT;
CREATE INDEX jobs_subject_history ON jobs(subject,created_at DESC);
CREATE INDEX receipt_authorization ON receipt_attempts(authorization_id);
`;

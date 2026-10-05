/** Manual decisions retain a monotonic version even after their override is removed. */
export const schema = `
CREATE TABLE grouping_controls(article_id TEXT PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,revision INTEGER NOT NULL,updated_at INTEGER NOT NULL) STRICT;
INSERT INTO grouping_controls SELECT article_id,revision,created_at FROM grouping_overrides;
CREATE TABLE report_commands(command_id TEXT PRIMARY KEY,report_id TEXT NOT NULL,expected_revision INTEGER NOT NULL,reason TEXT NOT NULL,at INTEGER NOT NULL) STRICT;
CREATE TABLE report_schedule_checks(kind TEXT NOT NULL,period_key TEXT NOT NULL,material_hash TEXT NOT NULL,checked_at INTEGER NOT NULL,PRIMARY KEY(kind,period_key)) STRICT;
`;

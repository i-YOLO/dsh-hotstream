-- DESIGN REFERENCE, not a complete converted AIHOT database.
-- SQL only demonstrates core relationships, durable jobs, receipts and atomicity.
-- Every upstream business field/query must still be mapped and tested before release.
PRAGMA foreign_keys=ON;
CREATE TABLE schema_migrations (
  id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at_ms INTEGER NOT NULL
) STRICT;
CREATE TABLE plugin_state (
  id INTEGER PRIMARY KEY CHECK(id=1), schema_version INTEGER NOT NULL,
  runtime_epoch INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL, initialized INTEGER NOT NULL CHECK(initialized IN(0,1)),
  settings_json TEXT NOT NULL CHECK(json_valid(settings_json))
) STRICT;
CREATE TABLE industry_versions (
  id TEXT PRIMARY KEY, revision INTEGER NOT NULL, manifest_json TEXT NOT NULL CHECK(json_valid(manifest_json))
) STRICT;
CREATE TABLE sources (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN('rss','web_list','json_list','x_search','mp_account','external')),
  enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), deleted_at_ms INTEGER,
  revision INTEGER NOT NULL DEFAULT 1, interval_minutes INTEGER NOT NULL CHECK(interval_minutes>0),
  tier TEXT NOT NULL, owner_entity_id TEXT, signal_group_id TEXT,
  participation_mode TEXT NOT NULL,
  config_json TEXT NOT NULL CHECK(json_valid(config_json)),
  cursor_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(cursor_json)),
  blocked_reason TEXT, last_ok_at_ms INTEGER, next_due_at_ms INTEGER,
  site_fulltext INTEGER NOT NULL DEFAULT 0 CHECK(site_fulltext IN(0,1)),
  upstream_seed_id TEXT
) STRICT;
CREATE INDEX sources_due ON sources(enabled,next_due_at_ms) WHERE deleted_at_ms IS NULL;
CREATE TABLE articles (
  id TEXT PRIMARY KEY, identity_key TEXT NOT NULL UNIQUE, input_revision INTEGER NOT NULL,
  original_title TEXT NOT NULL, original_body TEXT,
  published_at_ms INTEGER, discovered_at_ms INTEGER NOT NULL,
  backfill_kind TEXT, extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json))
) STRICT;
CREATE TABLE source_observations (
  source_id TEXT NOT NULL REFERENCES sources(id), external_key TEXT NOT NULL,
  article_id TEXT NOT NULL REFERENCES articles(id), original_url TEXT NOT NULL,
  published_at_ms INTEGER, observed_at_ms INTEGER NOT NULL,
  PRIMARY KEY(source_id,external_key)
) STRICT;
CREATE INDEX observations_article ON source_observations(article_id,source_id);
CREATE TABLE analyses (
  id TEXT PRIMARY KEY, article_id TEXT NOT NULL REFERENCES articles(id), input_revision INTEGER NOT NULL,
  stage TEXT NOT NULL, slot TEXT NOT NULL,
  config_revision INTEGER NOT NULL, industry_version TEXT NOT NULL,
  provider TEXT NOT NULL, model TEXT NOT NULL, prompt_hash TEXT NOT NULL,
  result_json TEXT NOT NULL CHECK(json_valid(result_json)),
  UNIQUE(article_id,input_revision,stage,slot,config_revision)
) STRICT;
CREATE TABLE stories (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, merged_into TEXT REFERENCES stories(id),
  digest_json TEXT, revision INTEGER NOT NULL DEFAULT 1
) STRICT;
CREATE TABLE facts (
  id TEXT PRIMARY KEY, story_id TEXT NOT NULL REFERENCES stories(id),
  title TEXT NOT NULL, occurred_at_ms INTEGER, frame_json TEXT NOT NULL CHECK(json_valid(frame_json))
) STRICT;
CREATE TABLE fact_articles (
  fact_id TEXT NOT NULL REFERENCES facts(id), article_id TEXT NOT NULL REFERENCES articles(id),
  role TEXT NOT NULL, manual INTEGER NOT NULL DEFAULT 0 CHECK(manual IN(0,1)),
  grouping_revision INTEGER NOT NULL, PRIMARY KEY(fact_id,article_id)
) STRICT;
CREATE TABLE story_signals (
  story_id TEXT NOT NULL REFERENCES stories(id), source_id TEXT NOT NULL REFERENCES sources(id),
  article_id TEXT NOT NULL REFERENCES articles(id), participant_key TEXT NOT NULL,
  evidence_at_ms INTEGER NOT NULL,
  PRIMARY KEY(story_id,source_id,article_id)
) STRICT;
CREATE INDEX signals_window ON story_signals(story_id,evidence_at_ms,participant_key);
CREATE TABLE publications (
  article_id TEXT PRIMARY KEY REFERENCES articles(id), input_revision INTEGER NOT NULL,
  visibility TEXT NOT NULL, selected INTEGER NOT NULL CHECK(selected IN(0,1)),
  grouping_state TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL,
  category TEXT, publication_time_ms INTEGER,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json))
) STRICT;
CREATE INDEX publications_timeline ON publications(visibility,selected,publication_time_ms DESC,article_id);
CREATE VIRTUAL TABLE publication_search USING fts5(article_id UNINDEXED,title,summary,body,tokenize='trigram');
-- Search is a derived index maintained by the same publication transaction.
-- All returned ids must be rechecked through the visibility/permission read model.
CREATE TABLE hot_rankings (
  id TEXT PRIMARY KEY, computed_at_ms INTEGER NOT NULL, rule_version TEXT NOT NULL,
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json))
) STRICT;
CREATE TABLE reports (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN('daily','weekly','monthly')),
  period_key TEXT NOT NULL, time_zone TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  UNIQUE(kind,period_key,time_zone)
) STRICT;
CREATE TABLE user_marks (
  article_id TEXT PRIMARY KEY REFERENCES articles(id), bookmarked INTEGER NOT NULL CHECK(bookmarked IN(0,1)),
  read_at_ms INTEGER, snapshot_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(snapshot_json))
) STRICT;
CREATE TABLE topics (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, definition_json TEXT NOT NULL CHECK(json_valid(definition_json))
) STRICT;
CREATE TABLE embeddings (
  subject_id TEXT NOT NULL, model TEXT NOT NULL, dimension INTEGER NOT NULL CHECK(dimension>0),
  text_hash TEXT NOT NULL, vector BLOB NOT NULL, PRIMARY KEY(subject_id,model,dimension,text_hash)
) STRICT;
CREATE TABLE jobs (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, dedupe_key TEXT NOT NULL,
  source_id TEXT REFERENCES sources(id), input_revision INTEGER NOT NULL,
  config_revision INTEGER NOT NULL, runtime_epoch INTEGER NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  state TEXT NOT NULL CHECK(state IN('queued','running','retry_wait','blocked','succeeded','failed','cancelled')),
  due_at_ms INTEGER NOT NULL, lease_owner TEXT, lease_until_ms INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL CHECK(max_attempts>0),
  blocked_reason TEXT, result_json TEXT
) STRICT;
CREATE UNIQUE INDEX jobs_one_active ON jobs(dedupe_key)
  WHERE state IN('queued','running','retry_wait','blocked');
CREATE INDEX jobs_due ON jobs(state,due_at_ms);
CREATE TABLE receipts (
  id TEXT PRIMARY KEY, logical_key TEXT NOT NULL UNIQUE, service TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN('reserved','pending','received','completed','failed','unknown')),
  runtime_epoch INTEGER NOT NULL, request_hash TEXT NOT NULL,
  audit_session_ref TEXT, raw_response_json TEXT, usage_json TEXT,
  automatic_releases INTEGER NOT NULL DEFAULT 0 CHECK(automatic_releases BETWEEN 0 AND 1),
  updated_at_ms INTEGER NOT NULL
) STRICT;
CREATE TABLE receipt_attempts (
  id TEXT PRIMARY KEY, receipt_id TEXT NOT NULL REFERENCES receipts(id), service TEXT NOT NULL,
  attempt_no INTEGER NOT NULL, reserved_at_ms INTEGER NOT NULL, sent_at_ms INTEGER,
  outcome TEXT, finished_at_ms INTEGER, provider_request_id TEXT,
  UNIQUE(receipt_id,attempt_no)
) STRICT;
CREATE INDEX attempts_budget ON receipt_attempts(service,reserved_at_ms);
CREATE TABLE budget_policies (
  service TEXT PRIMARY KEY, per_minute INTEGER NOT NULL CHECK(per_minute>=0),
  per_hour INTEGER NOT NULL CHECK(per_hour>=0), per_24_hours INTEGER NOT NULL CHECK(per_24_hours>=0)
) STRICT;
CREATE TABLE command_receipts (
  command_id TEXT PRIMARY KEY, committed_at_ms INTEGER NOT NULL,
  result_json TEXT NOT NULL CHECK(json_valid(result_json))
) STRICT;
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, at_ms INTEGER NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), protected INTEGER NOT NULL CHECK(protected IN(0,1))
) STRICT;
CREATE TABLE ordinary_run_logs (
  id TEXT PRIMARY KEY, at_ms INTEGER NOT NULL, job_id TEXT, code TEXT NOT NULL,
  redacted_detail TEXT NOT NULL
) STRICT;
CREATE TABLE optional_module_records (
  module TEXT NOT NULL, record_kind TEXT NOT NULL, id TEXT NOT NULL,
  document_json TEXT NOT NULL CHECK(json_valid(document_json)),
  PRIMARY KEY(module,record_kind,id)
) STRICT;
-- This final table is a staging design only. M4 must enumerate and index all real
-- leaderboard/model/catalog/price/method and monitor evidence/state records.

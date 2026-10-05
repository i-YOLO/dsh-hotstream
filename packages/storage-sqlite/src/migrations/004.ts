/** Source coverage and reading corrections are additive; existing business identities stay intact. */
export const schema = `
ALTER TABLE sources ADD COLUMN created_at INTEGER;
UPDATE sources SET created_at=coalesce((SELECT min(started_at) FROM fetch_runs WHERE source_id=sources.id),(SELECT min(committed_at) FROM command_receipts WHERE kind='initialize'));
ALTER TABLE publications ADD COLUMN selected_ready_at INTEGER;
UPDATE publications SET selected_ready_at=visible_after WHERE selected=1;
UPDATE jobs SET payload=json_set(payload,'$.moduleGeneration',0) WHERE kind IN('monitor','leaderboard') AND json_extract(payload,'$.moduleGeneration') IS NULL;
CREATE INDEX publications_release ON publications(visible_after,article_id) WHERE selected=1;
CREATE INDEX signals_observed ON story_signals(observed_at,story_id);
CREATE INDEX facts_occurred ON facts(occurred_at,story_id);
`;

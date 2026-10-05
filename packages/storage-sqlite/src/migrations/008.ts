/** An explicit editorial rerun owns its projection; earlier attempts keep their evidence. */
export const schema=`
ALTER TABLE articles ADD COLUMN active_run TEXT NOT NULL DEFAULT 'initial';
ALTER TABLE articles ADD COLUMN active_config_revision INTEGER NOT NULL DEFAULT 0;
UPDATE articles SET active_run=coalesce((SELECT run_key FROM analyses WHERE analyses.article_id=articles.id AND input_revision=articles.revision ORDER BY created_at DESC,rowid DESC LIMIT 1),'initial'),active_config_revision=coalesce((SELECT config_revision FROM analyses WHERE analyses.article_id=articles.id AND input_revision=articles.revision ORDER BY created_at DESC,rowid DESC LIMIT 1),0);
`;

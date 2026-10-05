/** The scheduler's next wake and the atomic claim share the same eligibility boundary. */
export const jobAdmissionSql=`
(SELECT initialized=1 AND deleting=0 FROM plugin_state WHERE id=1)
AND (kind IN('collect','collect-shard','ingest','monitor-test','leaderboard') OR coalesce((SELECT json_extract(settings_json,'$.processing.enabled') FROM plugin_state WHERE id=1),1)=1)
AND (kind!='report' OR json_extract(payload,'$.kind')!='daily' OR NOT EXISTS(
 SELECT 1 FROM jobs prior WHERE prior.epoch=jobs.epoch AND prior.kind='report'
 AND json_extract(prior.payload,'$.kind')='daily'
 AND json_extract(prior.payload,'$.key')<json_extract(jobs.payload,'$.key')
 AND prior.state IN('queued','running','retry_wait','blocked')))
AND (kind IN('collect','collect-shard','ingest','monitor-test','leaderboard') OR NOT EXISTS(SELECT 1 FROM model_authorizations ma WHERE ma.active=1)
 OR EXISTS(SELECT 1 FROM model_authorizations ma JOIN json_each(ma.article_ids) selected
 ON selected.value=jobs.subject OR selected.value=json_extract(jobs.payload,'$.articleId')
 WHERE ma.active=1 AND json_extract(jobs.payload,'$.authorizationId')=ma.id))
`;

/** Repair derived publication subject tags; applied analyses and explicit manual tag lists remain intact. */
export const schema = `
UPDATE publications SET document=json_set(document,'$.tags',json((
 SELECT json_group_array(value) FROM (
  SELECT value,min(position) first_position FROM (
   SELECT value,CAST(key AS INTEGER) position FROM json_each(publications.document,'$.tags') WHERE type='text'
   UNION ALL
   SELECT 'entity:'||value,100000+CAST(key AS INTEGER) position FROM json_each(publications.document,'$.subjects') WHERE type='text'
  ) GROUP BY value ORDER BY first_position
 )
))) WHERE json_type(document,'$.subjects')='array'
 AND NOT EXISTS(SELECT 1 FROM editorial_overrides e WHERE e.article_id=publications.article_id AND json_type(e.fields,'$.tags')='array');
UPDATE plugin_state SET data_revision=data_revision+1 WHERE id=1;
`;

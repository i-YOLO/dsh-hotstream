/** Additive command audit and story protection. Earlier migrations remain immutable. */
export const schema=`
ALTER TABLE mutation_history ADD COLUMN request_hash TEXT;
ALTER TABLE mutation_history ADD COLUMN result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json));
CREATE TABLE story_controls(story_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,manual INTEGER NOT NULL CHECK(manual IN(0,1)),updated_at INTEGER NOT NULL) STRICT;
CREATE INDEX mutation_history_subject ON mutation_history(subject_id,at DESC);
`;

/** Human review of uncertain posts remains separate from model recognition evidence. */
export const schema=`
CREATE TABLE monitor_reviews(command_id TEXT PRIMARY KEY,post_id TEXT NOT NULL REFERENCES monitor_posts(id),request_hash TEXT NOT NULL,decision INTEGER NOT NULL CHECK(decision IN(0,1)),reason TEXT NOT NULL,at INTEGER NOT NULL) STRICT;
`;

/** Archived analysis evidence is not an applied publication projection. */
export const schema=`
ALTER TABLE analyses ADD COLUMN applied INTEGER NOT NULL DEFAULT 1 CHECK(applied IN(0,1));
CREATE INDEX analyses_projection ON analyses(article_id,input_revision,stage,applied,created_at DESC);
`;

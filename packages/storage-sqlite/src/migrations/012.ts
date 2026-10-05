/** Public monitoring activity and outage links, separate from model claims. */
export const schema=`
ALTER TABLE monitor_posts ADD COLUMN outage TEXT CHECK(outage IS NULL OR json_valid(outage));
ALTER TABLE monitor_posts ADD COLUMN activity TEXT CHECK(activity IS NULL OR json_valid(activity));
`;

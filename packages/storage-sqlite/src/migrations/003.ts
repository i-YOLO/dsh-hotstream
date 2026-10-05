/** Bind fee decisions to the exact durable work they may release. */
export const schema = `
CREATE TABLE receipt_jobs(receipt_id TEXT NOT NULL REFERENCES receipts(id),job_id TEXT NOT NULL REFERENCES jobs(id),PRIMARY KEY(receipt_id,job_id)) STRICT;
CREATE INDEX receipt_jobs_job ON receipt_jobs(job_id);
INSERT OR IGNORE INTO receipt_jobs SELECT r.id,j.id FROM receipts r JOIN jobs j ON r.epoch=j.epoch WHERE r.logical_key='model:'||j.epoch||':'||j.dedupe_key||':'||json_extract(r.request,'$.stage') OR r.logical_key='model:'||j.dedupe_key||':'||json_extract(r.request,'$.stage');
`;

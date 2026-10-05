/** Restore exact durable-job links for retained model calls; the original logical identities are unchanged. */
export const schema = `
INSERT OR IGNORE INTO receipt_jobs SELECT r.id,j.id FROM receipts r JOIN jobs j ON r.epoch=j.epoch
 WHERE r.logical_key='model:'||j.epoch||':'||j.dedupe_key||':'||json_extract(r.request,'$.stage')
 OR r.logical_key='model:'||j.dedupe_key||':'||json_extract(r.request,'$.stage');
UPDATE plugin_state SET data_revision=data_revision+1 WHERE id=1;
`;

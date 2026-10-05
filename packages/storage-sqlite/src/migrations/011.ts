/** Billing confirmation is retained across clear and never authorizes dispatch. */
export const schema=`
CREATE TABLE receipt_confirmations(
 command_id TEXT PRIMARY KEY,receipt_id TEXT NOT NULL,attempt INTEGER NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN('billed','not-billed')),
 reason TEXT NOT NULL,cost REAL,currency TEXT,confirmed_at INTEGER NOT NULL,
 UNIQUE(receipt_id,attempt),FOREIGN KEY(receipt_id) REFERENCES receipts(id)
) STRICT;
`;

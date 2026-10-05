/** Single SQLite writer. Only declared diagnostics are admitted in M0. */
import { DatabaseSync } from 'node:sqlite';
import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';
import { z } from 'zod';
import { HotstreamDatabase } from './database.ts';
import type { StorageOperations, StorageOperation, Json } from 'dsh-hotstream-contracts/runtime';
import { workerCommandSchema, storageProbeSchema, type WorkerReply } from 'dsh-hotstream-contracts/storage-protocol';

const data = z.object({ path: z.string().min(1) }).strict().parse(workerData);
const port = parentPort;
if (port === null) throw new Error('Hotstream SQLite worker requires a parent port');
await mkdir(dirname(data.path), { recursive: true, mode: 0o700 });
try {
  const handle = await open(data.path, 'wx', 0o600);
  await handle.close();
} catch (error) {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
}
const db = new DatabaseSync(data.path);
db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
// Refuse unknown versions and checksums before creating diagnostics or changing journal mode.
const store = new HotstreamDatabase(db);
db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
db.exec(`CREATE TABLE IF NOT EXISTS m0_commands (
  command_id TEXT PRIMARY KEY, result_json TEXT NOT NULL CHECK(json_valid(result_json))
) STRICT;
CREATE VIRTUAL TABLE IF NOT EXISTS m0_search USING fts5(command_id UNINDEXED, body, tokenize='trigram');`);

function send(reply: WorkerReply): void { port!.postMessage(reply); }
port.on('message', (raw: unknown) => {
  const command = workerCommandSchema.parse(raw);
  try {
    if (command.kind === 'close') {
      db.close(); send({ kind: 'closed', id: command.id }); port.close(); return;
    }
    if(command.kind==='operation'){
      const before=store.dataRevision();const value=store.execute(command.operation,command.input as StorageOperations[StorageOperation]['input']);
      send({kind:'result',id:command.id,value:JSON.parse(JSON.stringify(value)) as Json,changed:store.dataRevision()!==before});return;
    }
    const saved = db.prepare('SELECT result_json FROM m0_commands WHERE command_id=?').get(command.request.commandId);
    if (saved !== undefined) {
      const value = storageProbeSchema.parse(JSON.parse(String(saved.result_json)));
      send({ kind: 'probe', id: command.id, value }); return;
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO m0_search(command_id,body) VALUES(?,?)').run(command.request.commandId, '中文热点模型发布');
      const row = db.prepare('SELECT sqlite_version() AS v').get();
      const mode = db.prepare('PRAGMA journal_mode').get();
      const foreign = db.prepare('PRAGMA foreign_keys').get();
      const match = db.prepare('SELECT count(*) AS n FROM m0_search WHERE command_id=? AND m0_search MATCH ?').get(command.request.commandId, '热点模型');
      const count = db.prepare('SELECT count(*) AS n FROM m0_commands').get();
      const value = storageProbeSchema.parse({
        commandId: command.request.commandId, sqliteVersion: String(row?.v),
        workerNodeVersion: process.versions.node, journalMode: String(mode?.journal_mode),
        foreignKeys: foreign?.foreign_keys === 1, fts5ChineseMatch: Number(match?.n) === 1,
        persistedCommands: Number(count?.n) + 1,
      });
      db.prepare('INSERT INTO m0_commands VALUES(?,?)').run(command.request.commandId, JSON.stringify(value));
      db.exec('COMMIT'); send({ kind: 'probe', id: command.id, value });
    } catch (error) { try{db.exec('ROLLBACK');}catch{} throw error; }
  } catch (error) {
    send({ kind: 'error', id: command.id, message: error instanceof Error ? error.message : String(error),fatal:error instanceof Error&&/database or disk is full|disk I\/O error|readonly database|database disk image is malformed/i.test(error.message) });
  }
});
send({ kind: 'ready' });

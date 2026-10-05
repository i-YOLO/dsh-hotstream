/** Validated process-boundary messages for the SQLite probe worker. */
import { z } from 'zod';
import { operationSchemas, jsonSchema } from './runtime.ts';

export const probeRequestSchema = z.object({ commandId: z.string().uuid() }).strict();
export const storageProbeSchema = z.object({
  sqliteVersion: z.string(), workerNodeVersion: z.string(), journalMode: z.literal('wal'),
  foreignKeys: z.literal(true), fts5ChineseMatch: z.literal(true),
  persistedCommands: z.number().int().nonnegative(), commandId: z.string().uuid(),
}).strict();
export const workerCommandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('probe'), id: z.string().uuid(), request: probeRequestSchema }).strict(),
  z.object({ kind: z.literal('operation'), id: z.string().uuid(), operation: z.enum(Object.keys(operationSchemas) as [keyof typeof operationSchemas, ...(keyof typeof operationSchemas)[]]), input: jsonSchema }).strict(),
  z.object({ kind: z.literal('close'), id: z.string().uuid() }).strict(),
]);
export const workerReplySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ready') }).strict(),
  z.object({ kind: z.literal('probe'), id: z.string().uuid(), value: storageProbeSchema }).strict(),
  z.object({ kind: z.literal('result'), id: z.string().uuid(), value: jsonSchema, changed:z.boolean() }).strict(),
  z.object({ kind: z.literal('closed'), id: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('error'), id: z.string().uuid(), message: z.string(),fatal:z.boolean().default(false) }).strict(),
]);
export type WorkerCommand = z.infer<typeof workerCommandSchema>;
export type WorkerReply = z.infer<typeof workerReplySchema>;

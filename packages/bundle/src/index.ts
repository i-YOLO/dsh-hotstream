/** Native bundle composition; one awaited disposer owns the entire Host resource order. */
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-llm';
import type {} from '@deepseek-ai/dsh-typert-registry';
import z from '@deepseek-ai/schemastery';
import { join, resolve } from 'node:path';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { HotstreamSqliteProvider } from 'dsh-hotstream-storage-sqlite';
import { HotstreamController, registerM0Provider } from 'dsh-hotstream-host';
import { TYPERT } from 'dsh-hotstream-host/typert';
import type { TypertContribution } from '@deepseek-ai/dsh-typert-registry/types';

export const name = 'hotstream';
export const inject = ['llm','typert','credentials','jobs','agentDefaultModel'];
export interface Config { diagnosticsEnabled: boolean; dataDirectory?: string; }
export const Config: z<Config> = z.object({
  diagnosticsEnabled: z.boolean().default(false),
  dataDirectory: z.string(),
});

/** Compose library providers without independent teardown racing their consumers. */
export function apply(ctx: Context, config: Config): void {
  const root = config.dataDirectory === undefined ? join(resolveDshHome(), 'data', 'hotstream') : resolve(config.dataDirectory);
  ctx.effect(() => ctx.typert.register(TYPERT as TypertContribution), 'hotstream: generated Host Remote definitions');
  if (config.diagnosticsEnabled) registerM0Provider(ctx);
  const storage = new HotstreamSqliteProvider(join(root, 'hotstream.sqlite'));
  const controller = new HotstreamController(ctx, {
    storage, business:{store:storage,path:join(root,'hotstream.sqlite')}, auditRoot: join(root, 'audit-sessions'), diagnosticsEnabled: config.diagnosticsEnabled,
  });
  ctx.effect(() => async () => {
    const errors: unknown[] = [];
    try { await controller.close(); } catch (error) { errors.push(error); }
    try { await storage.close(); } catch (error) { errors.push(error); }
    if (errors.length > 0) throw new AggregateError(errors, 'Hotstream resource shutdown failed');
  }, 'hotstream: ordered Host shutdown');
}

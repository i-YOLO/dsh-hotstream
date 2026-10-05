/** Run with the signed Desktop executable in Node mode; never calls external services. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { HotstreamSqliteProvider } from '../../packages/storage-sqlite/lib/index.js';
import { HotstreamController, registerM0Provider } from '../../packages/host/lib/index.js';
import { TYPERT } from '../../packages/host/lib/typert.host.js';
const hostRequire = createRequire(new URL('../../packages/host/package.json', import.meta.url));
const bundleRequire = createRequire(new URL('../../packages/bundle/package.json', import.meta.url));
const clientRequire = createRequire(new URL('../../packages/client/package.json', import.meta.url));
const { Context } = await import(hostRequire.resolve('@deepseek-ai/cordis'));
const { default: LlmRuntime } = await import(hostRequire.resolve('@deepseek-ai/dsh-llm'));
const { default: TypertRegistry } = await import(bundleRequire.resolve('@deepseek-ai/dsh-typert-registry'));
const { default: Gateway } = await import(clientRequire.resolve('@deepseek-ai/dsh-api-gateway'));
const root = await mkdtemp(join(tmpdir(), 'hotstream-desktop-node-'));
const context = new Context();
new LlmRuntime(context);
new TypertRegistry(context);
context.typert.register(TYPERT);
registerM0Provider(context);
const storage = new HotstreamSqliteProvider(join(root, 'probe.sqlite'));
const controller = new HotstreamController(context, { storage, auditRoot: join(root, 'audit'), diagnosticsEnabled: true });
const gateway = new Gateway(context, { streamInboxBytes: 262144, websocketHeartbeatIntervalMs: 2000 });
try {
  const before = await gateway.invoke({ namespace: 'hotstream', method: 'status', args: {} });
  assert.equal(before.newsRequests, 0);
  assert.equal(before.modelRequests, 0);
  const sqlite = await gateway.invoke({ namespace: 'hotstream', method: 'probeStorage', args: { request: { commandId: randomUUID() } } });
  assert.equal(sqlite.workerNodeVersion, process.versions.node);
  assert.equal(sqlite.journalMode, 'wal');
  assert.equal(sqlite.fts5ChineseMatch, true);
  const model = await gateway.invoke({ namespace: 'hotstream', method: 'probeModel', args: { request: { commandId: randomUUID() } } });
  assert.equal(model.requestDurable, true);
  assert.equal(model.settlementDurable, true);
  const result = { kind: 'signed-desktop-node-mode-smoke', executedAt: new Date().toISOString(), node: process.versions.node, electron: process.versions.electron, sqlite, model, desktopUiTested: false, realProviderCalled: false };
  await mkdir(new URL('../../artifacts/m0/', import.meta.url), { recursive: true });
  await writeFile(new URL('../../artifacts/m0/node-runtime.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await controller.close();
  await storage.close();
  await context.fiber.dispose();
  await rm(root, { recursive: true, force: true });
}

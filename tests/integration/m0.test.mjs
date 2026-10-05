import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { HotstreamSqliteProvider } from '../../packages/storage-sqlite/lib/index.js';
import { HotstreamController, registerM0Provider } from '../../packages/host/lib/index.js';
import { TYPERT } from '../../packages/host/lib/typert.host.js';

const hostRequire = createRequire(new URL('../../packages/host/package.json', import.meta.url));
const bundleRequire = createRequire(new URL('../../packages/bundle/package.json', import.meta.url));
const clientRequire = createRequire(new URL('../../packages/client/package.json', import.meta.url));
const { Context } = await import(hostRequire.resolve('@deepseek-ai/cordis'));
const { default: LlmRuntime } = await import(hostRequire.resolve('@deepseek-ai/dsh-llm'));
const { default: TypertRegistry } = await import(bundleRequire.resolve('@deepseek-ai/dsh-typert-registry'));
const { default: TypertGateway } = await import(clientRequire.resolve('@deepseek-ai/dsh-api-gateway'));
const resources = [];
afterEach(async () => {
  for (const close of resources.splice(0).reverse()) await close();
});

async function fixture(diagnosticsEnabled = false) {
  const root = await mkdtemp(join(tmpdir(), 'hotstream-m0-test-'));
  resources.push(() => rm(root, { recursive: true, force: true }));
  const context = new Context();
  new LlmRuntime(context);
  new TypertRegistry(context);
  context.typert.register(TYPERT);
  const gateway = new TypertGateway(context, { streamInboxBytes: 262144, websocketHeartbeatIntervalMs: 2000 });
  if (diagnosticsEnabled) registerM0Provider(context);
  const storage = new HotstreamSqliteProvider(join(root, 'probe.sqlite'));
  resources.push(() => storage.close());
  const controller = new HotstreamController(context, { storage, business:{store:storage,path:join(root,'probe.sqlite')}, auditRoot: join(root, 'audit'), diagnosticsEnabled });
  resources.push(async () => { await controller.close(); await context.fiber.dispose(); });
  return { root, context, gateway, storage, controller };
}

describe('M0 actual DSH integration', () => {
  it('read-only status does not create storage or dispatch a model', async () => {
    const f = await fixture();
    const value = await f.gateway.invoke({ namespace: 'hotstream', method: 'status', args: {} });
    expect(value).toMatchObject({ initialized: false, productReady: false, newsRequests: 0, modelRequests: 0, storage: null });
    expect(await readdir(f.root)).toEqual([]);
  });

  it('strict stream emits a baseline without initializing and abort releases its subscription', async () => {
    const f=await fixture();const control=new AbortController();
    const stream=await f.gateway.stream({namespace:'hotstream',method:'watch',args:{request:{afterRevision:0}},signal:control.signal});
    const iterator=stream[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toMatchObject({epoch:0,dataRevision:0,reset:true});
    expect(await readdir(f.root)).toEqual([]);
    const next=iterator.next();control.abort();await expect(next).rejects.toMatchObject({code:'gateway/cancelled'});await iterator.return();expect(f.storage.listeners.size).toBe(0);
    await expect(f.gateway.stream({namespace:'hotstream',method:'watch',args:{request:{afterRevision:'bad'}}})).rejects.toMatchObject({code:'gateway/input-invalid'});
  });

  it('strict Gateway rejects missing or malformed JSON before execution', async () => {
    const f = await fixture(true);
    await expect(f.gateway.invoke({ namespace: 'hotstream', method: 'probeStorage', args: {} })).rejects.toMatchObject({ code: 'gateway/arguments-invalid' });
    await expect(f.gateway.invoke({ namespace: 'hotstream', method: 'probeStorage', args: { request: { commandId: 12 } } })).rejects.toMatchObject({ code: 'gateway/input-invalid' });
    expect(await readdir(f.root)).toEqual([]);
  });

  it('disabled diagnostics cannot admit storage or auxiliary calls', async () => {
    const f = await fixture();
    await expect(f.gateway.invoke({ namespace: 'hotstream', method: 'probeModel', args: { request: { commandId: randomUUID() } } })).rejects.toMatchObject({ code: 'hotstream/diagnostics-disabled' });
    expect(await readdir(f.root)).toEqual([]);
  });

  it('SQLite worker commits once and recovers the same command after restart', async () => {
    const f = await fixture(true);
    const request = { commandId: randomUUID() };
    const first = await f.storage.probe(request);
    const second = await f.storage.probe(request);
    expect(second).toEqual(first);
    expect(first).toMatchObject({ journalMode: 'wal', foreignKeys: true, fts5ChineseMatch: true, persistedCommands: 1 });
    await f.storage.close();
    const reopened = new HotstreamSqliteProvider(join(f.root, 'probe.sqlite'));
    resources.push(() => reopened.close());
    expect(await reopened.probe(request)).toEqual(first);
  });

  it('auxiliary dispatch uses DSH LLM and durably stores exact request and raw stream', async () => {
    const f = await fixture(true);
    const request = { commandId: randomUUID() };
    const value = await f.controller.probeModel(request);
    expect(value).toMatchObject({ provider: 'hotstream-m0', model: 'integration-probe', text: 'HOTSTREAM_M0_AUDITED_RESPONSE', requestDurable: true, settlementDurable: true });
    expect(await f.controller.probeModel(request)).toEqual(value);
    expect((await f.controller.status()).modelRequests).toBe(1);
    const files = await readdir(join(f.root, 'audit'), { recursive: true });
    const path = files.find(path => path.endsWith('.jsonl'));
    expect(path).toBeDefined();
    const rows = (await readFile(join(f.root, 'audit', path), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    expect(rows.filter(row => row.type === 'hotstream/llm-request')).toHaveLength(1);
    expect(rows.filter(row => row.type === 'hotstream/llm-settlement')).toHaveLength(1);
    const logged = rows.find(row => row.type === 'hotstream/llm-request');
    expect(logged.data).toMatchObject({ requestId: request.commandId, provider: 'hotstream-m0', model: 'integration-probe', maxTokens: 48 });
    expect(logged.data.messages[0].content[0].text).toContain('M0 integration diagnostic');
  });

  it('another writer is refused until the first provider has fully closed', async () => {
    const f = await fixture(true);
    await f.storage.probe({ commandId: randomUUID() });
    const contender = new HotstreamSqliteProvider(join(f.root, 'probe.sqlite'));
    resources.push(() => contender.close());
    await expect(contender.probe({ commandId: randomUUID() })).rejects.toThrow('writer lock');
    await f.storage.close();
    const next = new HotstreamSqliteProvider(join(f.root, 'probe.sqlite'));
    resources.push(() => next.close());
    expect((await next.probe({ commandId: randomUUID() })).persistedCommands).toBe(2);
  });
});

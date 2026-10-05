/** SQLite provider factory; its composition owner controls acquisition and shutdown. */
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { withFileLock } from '@deepseek-ai/dsh-atomic-write';
import { operationSchemas, type HotstreamStore, type StorageOperation, type StorageOperations, type Json } from 'dsh-hotstream-contracts/runtime';
import type { M0StoragePort, ProbeRequest, StorageProbe } from 'dsh-hotstream-contracts';
import { probeRequestSchema, workerReplySchema, type WorkerCommand, type WorkerReply } from 'dsh-hotstream-contracts/storage-protocol';

interface Pending {
  resolve(value: WorkerReply): void;
  reject(error: Error): void;
}

/** Lazy provider: installing or reading the panel does not create a database. */
export class HotstreamSqliteProvider implements M0StoragePort, HotstreamStore {
  private readonly listeners=new Set<(operation:StorageOperation)=>void>();
 subscribe(listener:(operation:StorageOperation)=>void):()=>void{this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
 private worker: Worker | undefined;
  private ready: Promise<void> | undefined;
  private pending = new Map<string, Pending>();
  private lastProbe: StorageProbe | null = null;
  private stopping: Promise<void> | undefined;
  private lockTask: Promise<void> | undefined;
  private failure:Error|undefined;
  private releaseLock: (() => void) | undefined;

  constructor(private readonly path: string) {}

  inspect(): StorageProbe | null { return this.lastProbe; }
  resources():Record<string,number>{return {sqliteWorkers:this.worker?1:0,storagePending:this.pending.size,subscriptions:this.listeners.size};}

  async probe(request: ProbeRequest): Promise<StorageProbe> {
    if (this.stopping !== undefined) throw new Error('Hotstream storage is stopping');
    probeRequestSchema.parse(request);
    await this.start();
    const reply = await this.dispatch({ kind: 'probe', id: randomUUID(), request });
    if (reply.kind !== 'probe') throw new Error('Unexpected storage reply');
    this.lastProbe = reply.value;
    return reply.value;
  }

  async execute<K extends StorageOperation>(operation: K, input: StorageOperations[K]['input']): Promise<StorageOperations[K]['output']> {
    if(this.stopping!==undefined) throw new Error('Hotstream storage is stopping');
    operationSchemas[operation].parse(input);
    await this.start();
    const reply=await this.dispatch({kind:'operation',id:randomUUID(),operation,input:JSON.parse(JSON.stringify(input)) as Json});
    if(reply.kind!=='result') throw new Error('Unexpected storage result');
    if(reply.changed&&!new Set(['callAttempts','modelAuthorization','candidatesPage','storyDigestWork','correctionState','mutationHistory','callSummary','reportRevisions','preferenceGet','reportMissing','dailyEdition','periodEntries','materialsKnown','state','sources','jobs','receipts','findReceipt','dispatchPlan','receiptAttempts','auditRecoverable','auditPending','work','candidates','page','detail','story','stories','topics','reports','report','reportMaterial','chronicle','evaluations','optionalData','monitorCursor','monitorWork','lbInputs','vectorGet','nextWake']).has(operation))for(const listener of this.listeners)listener(operation);
    return reply.value as StorageOperations[K]['output'];
  }

  private start(): Promise<void> {
    if(this.failure!==undefined)return Promise.reject(this.failure);
    if (this.ready !== undefined) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      void mkdir(dirname(this.path), { recursive: true, mode: 0o700 }).then(() => {
        const held = Promise.withResolvers<void>();
        this.lockTask = withFileLock(this.path, async () => {
          this.releaseLock = held.resolve;
          this.openWorker(resolve, reject);
          await held.promise;
        }, { waitMs: 0 });
        void this.lockTask.catch(reject);
      }, reject);
    });
    return this.ready;
  }

  private openWorker(resolve: () => void, reject: (error: Error) => void): void {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { workerData: { path: this.path } });
    this.worker = worker;
      const failed = (error: Error): void => {
        this.failure=error;
        reject(error);
        for (const pending of this.pending.values()) pending.reject(error);
        this.pending.clear();
      };
      worker.on('error', failed);
      worker.on('message', (raw: unknown) => {
        let reply: WorkerReply;
        try { reply = workerReplySchema.parse(raw); }
        catch (error) { failed(error instanceof Error ? error : new Error(String(error))); return; }
        if (reply.kind === 'ready') { resolve(); return; }
        const pending = this.pending.get(reply.id);
        if (pending === undefined) return;
        this.pending.delete(reply.id);
        if (reply.kind === 'error') {const error=Object.assign(new Error(reply.message),{code:reply.fatal?'HOTSTREAM_STORAGE_UNAVAILABLE':'HOTSTREAM_STORAGE_OPERATION'});pending.reject(error);if(reply.fatal)failed(error);}
        else pending.resolve(reply);
      });
      worker.on('exit', (code) => {
        if (this.stopping===undefined||code !== 0||this.pending.size>0) failed(new Error(`SQLite worker exited with code ${code}`));
      });
  }

  private dispatch(command: WorkerCommand): Promise<WorkerReply> {
    return new Promise((resolve, reject) => {
      if(this.failure!==undefined){reject(this.failure);return;}
      if (this.worker === undefined) { reject(new Error('SQLite worker is unavailable')); return; }
      const timeout=setTimeout(()=>{this.pending.delete(command.id);reject(new Error('Hotstream storage command timed out'));},60000);
      timeout.unref();
      this.pending.set(command.id, { resolve:value=>{clearTimeout(timeout);resolve(value);}, reject:error=>{clearTimeout(timeout);reject(error);} });
      this.worker.postMessage(command);
    });
  }

  close(): Promise<void> {
    return this.stopping ??= (async () => {
      let started = false;
      try {
        await this.ready;
        started = this.worker !== undefined;
        if (this.worker === undefined) return;
        const worker = this.worker;
        try {
          const reply = await this.dispatch({ kind: 'close', id: randomUUID() });
          if (reply.kind !== 'closed') throw new Error('SQLite close was not acknowledged');
        } finally { await worker.terminate(); this.worker = undefined; }
      } catch (error) {
        if (this.worker !== undefined) { await this.worker.terminate(); this.worker = undefined; }
        if (started) throw error;
      } finally {
        this.listeners.clear();
        this.releaseLock?.();
        await this.lockTask?.catch(() => {});
      }
    })();
  }
}

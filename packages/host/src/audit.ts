/** DSH-compatible, isolated audit Sessions; no Agent is created or driven. */
import { Context } from '@deepseek-ai/cordis';
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl';
import { SESSION_FORMAT_VERSION, SessionId, SessionSeq, type SessionEvent } from '@deepseek-ai/dsh-session';
import type { SessionHandle } from '@deepseek-ai/dsh-session-persistence';
import type { Json } from 'dsh-hotstream-contracts/runtime';
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm';
import { stableJson } from 'dsh-hotstream-core';

/** Exact dispatch data, without its process-local AbortSignal. */
export interface AuditedRequest {
  readonly requestId: string;
  readonly provider: string;
  readonly model: string;
  readonly messages: GenerateOptions['messages'];
  readonly system: string;
  readonly maxTokens: number;
  readonly resolvedConfig?: Json;
  readonly stage?: string;
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Auxiliary input record; it contributes no Agent conversation history. */
    'hotstream/llm-request': AuditedRequest;
    /** Exact received auxiliary chunks and their terminal outcome. */
    'hotstream/llm-settlement': { readonly requestId: string; readonly chunks: readonly StreamChunk[] };
  }
}

/** One auxiliary request's owned handle and stable persisted identity. */
export interface AuditHandle {
  readonly sessionId: string;
  readonly handle: SessionHandle;
}

export class AuxiliaryAudit {
  private readonly context = new Context();
  private readonly handles = new Set<SessionHandle>();
  private readonly sessions = new Map<string, SessionHandle>();
  private loaded: Promise<void> | undefined;
  private stopping: Promise<void> | undefined;

  constructor(private readonly root: string) {}

  private load(): Promise<void> {
    return this.loaded ??= (async () => {
      await this.context.plugin(JsonlSessionPersistence, { root: this.root, compression: 'none' });
    })();
  }

  /** Flush the request before any dispatch; reader isolation comes from this private root. */
  async request(request: AuditedRequest): Promise<AuditHandle> {
    if (this.stopping !== undefined) throw new Error('Hotstream audit is stopping');
    await this.load();
    const id = SessionId(`hotstream-${request.requestId}`);
    const existing = await this.context.sessionPersistence.stat(id);
    const handle = this.sessions.get(id) ?? (existing
      ? await this.context.sessionPersistence.open(id, 'write')
      : await this.context.sessionPersistence.create({
        version: SESSION_FORMAT_VERSION, id, createdAt: Date.now(), isSeeded: false,
      }));
    this.handles.add(handle);
    this.sessions.set(id, handle);
    const event: SessionEvent<'hotstream/llm-request'> = {
      type: 'hotstream/llm-request', seq: SessionSeq(0), time: Date.now(),
      data: request, ignorable: true,
    };
    try {
      const { events } = await handle.read();
      if (events.length === 0) await handle.append([event]);
      else if (events[0]?.type !== 'hotstream/llm-request' || stableJson(events[0].data) !== stableJson(request)) throw new Error('Auxiliary audit request identity conflict');
      await handle.flush();
    }
    catch (error) { await handle.close(); this.handles.delete(handle); this.sessions.delete(id); throw error; }
    return { sessionId: id, handle };
  }

  /** Persist the raw stream without re-dispatching if this settlement fails. */
  async settle(audit: AuditHandle, requestId: string, chunks: readonly StreamChunk[]): Promise<void> {
    const { events } = await audit.handle.read();
    const request = events.find(event => event.type === 'hotstream/llm-request');
    if (request?.type !== 'hotstream/llm-request' || request.data.requestId !== requestId) throw new Error('Auxiliary settlement has no matching durable request');
    const previous = events.find(event => event.type === 'hotstream/llm-settlement');
    if (previous) {
      if (stableJson(previous.data) !== stableJson({ requestId, chunks })) throw new Error('Auxiliary settlement identity conflict');
    } else {
      const seq = events.length ? Number(events.at(-1)!.seq) + 1 : 0;
      await audit.handle.append([{
        type: 'hotstream/llm-settlement', seq: SessionSeq(seq), time: Date.now(),
        data: { requestId, chunks }, ignorable: true,
      }]);
    }
    await audit.handle.flush();
    await audit.handle.close();
    this.handles.delete(audit.handle);
    this.sessions.delete(audit.sessionId);
  }

  /** Recover a received response through the official writer seam, without dispatch. */
  async repair(sessionId: string, requestId: string, chunks: readonly StreamChunk[]): Promise<void> {
    if (this.stopping) throw new Error('Hotstream audit is stopping');
    await this.load();
    const handle = this.sessions.get(sessionId) ?? await this.context.sessionPersistence.open(SessionId(sessionId), 'write');
    this.handles.add(handle);
    this.sessions.set(sessionId, handle);
    await this.settle({ sessionId, handle }, requestId, chunks);
  }

  /** Read a fallback settlement after SQLite could not durably receive it. */
  async settlement(sessionId:string,requestId:string):Promise<readonly StreamChunk[]|null>{
    await this.load();const handle=await this.context.sessionPersistence.open(SessionId(sessionId),'read');
    try{const {events}=await handle.read();const request=events.find(event=>event.type==='hotstream/llm-request');
      if(request?.type!=='hotstream/llm-request'||request.data.requestId!==requestId)throw new Error('Recovered auxiliary request identity conflict');
      const result=events.find(event=>event.type==='hotstream/llm-settlement');
      if(result?.type!=='hotstream/llm-settlement')return null;
      if(result.data.requestId!==requestId)throw new Error('Recovered auxiliary settlement identity conflict');return result.data.chunks;
    }finally{await handle.close();}
  }
  resources():number{return this.handles.size;}
  close(): Promise<void> {
    return this.stopping ??= (async () => {
      await this.loaded;
      const results = await Promise.allSettled([...this.handles].map(handle => handle.close()));
      this.handles.clear();
      this.sessions.clear();
      await this.context.fiber.dispose();
      const errors = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map(result => result.reason);
      if (errors.length > 0) throw new AggregateError(errors, 'Hotstream audit close failed');
    })();
  }
}

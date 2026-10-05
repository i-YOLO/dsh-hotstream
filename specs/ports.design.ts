/**
 * DESIGN ONLY. These are Hotstream-owned boundaries, not existing DSH SDK APIs.
 * Host adapters must be compiled against the pinned DSH public exports.
 * No executable plugin, network calls, or placeholder credentials are included.
 */
export type Id = string;
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
export interface ModelRoute { readonly provider: string; readonly model: string }
export interface PipelineVersion {
  readonly inputRevision: number;
  readonly configRevision: number;
  readonly industryVersion: string;
  readonly promptHash: string;
  readonly route: ModelRoute;
}
export type Stage = 'extract' | 'prefilter' | 'score' | 'structure' | 'write' | 'group' | 'digest' | 'translate' | 'period-intro';
export interface PaidCallIdentity {
  readonly service: string;
  readonly subject: string;
  readonly stage: Stage;
  readonly slot: string; // Must distinguish score:1 from score:2.
  readonly version: PipelineVersion;
  readonly inputHash: string;
  readonly explicitRerunId?: string;
}
export interface RequestAudit {
  readonly requestId: Id;
  readonly durableSessionRef: string;
  readonly inputDigest: string;
}
export interface ModelRequest {
  readonly identity: PaidCallIdentity;
  readonly requestId: Id;
  readonly runtimeEpoch: number;
  readonly messages: readonly { readonly role: 'system' | 'user'; readonly text: string }[];
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
}
export interface AuxiliaryLlmAuditPort {
  /** Must flush the exact request as DSH-compatible Session audit before network I/O. */
  persistRequest(request: ModelRequest): Promise<RequestAudit>;
  persistSettlement(audit: RequestAudit, outcome: ModelOutcome): Promise<void>;
}
export type ModelOutcome =
  | { readonly kind: 'received'; readonly text: string; readonly usage?: Json; readonly providerRequestId?: string }
  | { readonly kind: 'rejected'; readonly code: string; readonly retryable: boolean }
  | { readonly kind: 'unknown'; readonly code: string }
  | { readonly kind: 'cancelled-before-send' };
export interface LlmPort {
  listConfiguredRoutes(): Promise<readonly ModelRoute[]>;
  /** Exactly one attempt; no hidden retry or tool execution. Must have a flushed audit. */
  executeOnce(request: ModelRequest, audit: RequestAudit, signal: AbortSignal): Promise<ModelOutcome>;
}
export interface Job {
  readonly id: Id;
  readonly kind: string;
  readonly dedupeKey: string;
  readonly inputRevision: number;
  readonly configRevision: number;
  readonly runtimeEpoch: number;
  readonly payload: Json;
}
export interface CollectionCommit {
  readonly commandId: Id;
  readonly sourceId: Id;
  readonly sourceRevision: number;
  readonly runtimeEpoch: number;
  readonly observations: readonly Json[];
  readonly successCursor: Json;
  readonly nextDueAtMs: number;
  readonly jobs: readonly Job[];
}
export interface HotstreamRepositoryPort {
  /** Single provider-side transaction, not multiple caller-side network calls. */
  commitCollection(input: CollectionCommit): Promise<{ readonly created: number; readonly revised: number }>;
  claimDueJobs(nowMs: number, limit: number, owner: string): Promise<readonly Job[]>;
  commitStageAndEnqueue(input: {
    readonly commandId: Id; readonly jobId: Id; readonly runtimeEpoch: number;
    readonly expectedInputRevision: number; readonly receivedReceiptId: Id;
    readonly output: Json; readonly nextJobs: readonly Job[];
  }): Promise<void>;
  flushAndClose(): Promise<void>;
}
export interface PublicMaterial {
  readonly kind: 'article' | 'story';
  readonly id: Id;
  readonly title: string;
  readonly summary: string;
  readonly sourceName: string;
  readonly publishedAt: string | null;
  readonly originalUrls: readonly string[];
}
export interface ReadModelPort {
  /** Applies withdrawal and full-text permission rules; never raw table exposure. */
  getDiscussMaterial(kind: 'article' | 'story', id: Id): Promise<PublicMaterial | null>;
}
export interface DiscussPort {
  /** Client-side adapter to official new-session draft flow. Does not call send/followup. */
  openNewContextWithDraft(text: string): Promise<'opened' | 'cancelled' | 'blocked'>;
}
export type RuntimeState = 'uninitialized' | 'initializing' | 'ready' | 'degraded' | 'paused' | 'stopping' | 'deleting' | 'incompatible';
export interface RuntimeStatus {
  readonly state: RuntimeState;
  readonly lastSuccessAt: string | null;
  readonly queued: number;
  readonly running: number;
  readonly blocked: number;
  readonly sourceErrors: readonly { readonly sourceId: Id; readonly code: string }[];
}

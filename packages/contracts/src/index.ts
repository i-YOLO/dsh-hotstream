/** Public JSON DTOs and storage operations for Hotstream's M0 integration. */
export interface StorageProbe {
  readonly sqliteVersion: string;
  readonly workerNodeVersion: string;
  readonly journalMode: string;
  readonly foreignKeys: boolean;
  readonly fts5ChineseMatch: boolean;
  readonly persistedCommands: number;
  readonly commandId: string;
}

/** One explicit, idempotent local storage diagnostic. */
export interface ProbeRequest {
  readonly commandId: string;
}

/** One persisted auxiliary-call result, clearly separate from news content. */
export interface ModelProbe {
  readonly requestId: string;
  readonly sessionId: string;
  readonly provider: string;
  readonly model: string;
  readonly text: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly requestDurable: boolean;
  readonly settlementDurable: boolean;
}

/** Runtime evidence shown by the M0 panel without making external calls. */
export interface HostSnapshot {
  readonly milestone: 'M0';
  readonly productReady: false;
  readonly initialized: false;
  readonly targetDshVersion: string;
  readonly hostNodeVersion: string;
  readonly diagnosticsEnabled: boolean;
  readonly sourceCount: number;
  readonly newsRequests: number;
  readonly modelRequests: number;
  readonly storage: StorageProbe | null;
  readonly model: ModelProbe | null;
}

/** Storage provider; SQL and worker transport never cross this interface. */
export interface M0StoragePort {
  probe(request: ProbeRequest): Promise<StorageProbe>;
  inspect(): StorageProbe | null;
  close(): Promise<void>;
}

/** Route frozen for one auxiliary request. */
export interface ModelRoute {
  readonly provider: string;
  readonly model: string;
}

export * from './runtime.ts';
export * from './api.ts';

export * from './ui.ts';

export * from './monitor-ui.ts';
export * from './integrations.ts';

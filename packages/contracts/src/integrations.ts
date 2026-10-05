/** Explicit user actions. Credentials never appear in a read or test result. */
export interface CredentialDeleteRequest {
  service:'socialdata'|'dajiala'|'jina'|'github'|'embedding'|'external'|'artificial-analysis';
}
export interface MonitorTestRequest {commandId:string;revision:number;acknowledged:true;}
export interface MonitorTestReadRequest {jobId:string;}
export interface LeaderboardRefreshRequest {commandId:string;revision:number;}
export interface MonitorTestResult {
  jobId:string;state:string;startedAt:number|null;finishedAt:number|null;error:string|null;
  searchRequests:number;contextRequests:number;modelRequests:number;posts:number;recognized:number;
  cost:number|null;currency:string|null;costBasis:'actual'|'estimated'|'unknown';
  receiptIds:string[];results:{postId:string;url:string;outcome:string}[];
}
export interface SourceHealth {
  id:string;status:string;lastAttemptAt:number|null;lastSuccessAt:number|null;error:string|null;rows:number|null;
}
export interface OptionalModuleHealth {
  enabled:boolean;status:'disabled'|'unconfigured'|'queued'|'running'|'partial'|'failed'|'waiting-for-evidence'|'ready'|'idle';
  lastAttemptAt:number|null;lastSuccessAt:number|null;error:string|null;records:number;snapshots:number;
  sources:SourceHealth[];latestTest:MonitorTestResult|null;coverageComplete:boolean;
}
export interface ModuleHealthResult {leaderboard:OptionalModuleHealth;monitor:OptionalModuleHealth;}
export const MONITOR_TEST_LIMITS=Object.freeze({searchRequests:1,contextRequests:2,modelRequests:5});
export function optionalJobModule(kind:string):'leaderboard'|'monitor'|null {
  return kind==='monitor-test'?'monitor':kind==='leaderboard'||kind==='monitor'?kind:null;
}

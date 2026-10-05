/** Native Client API. No generic SQL, filesystem path, script or Agent-facing endpoint. */
import type {RuntimeState,RuntimeSettings,Source,Publication,Story,Report,Topic,HeatEntry,DurableJob,Receipt,ReceiptAttempt,CollectionItem,Json} from './runtime.ts';
export interface EmptyRequest {}
export interface IdRequest {id:string;}
export interface InitializeRequest {commandId:string;route:{provider:string;model:string};}
export interface SettingsRequest {commandId:string;revision:number;settings:RuntimeSettings;}
export interface SourceRequest {commandId:string;source:Source;expectedRevision:number;}
export interface DeleteSourceRequest {commandId:string;id:string;expectedRevision:number;}
export interface ClearRequest {commandId:string;confirmation:'CLEAR HOTSTREAM';}
export interface ActionResult {ok:boolean;revision:number|null;}
export interface SourcesResult {items:Source[];}
export interface DetailResult {item:Publication|null;}
export interface StoryResult {item:Story|null;}
export interface ReadingRequest {view:'hot'|'daily'|'weekly'|'monthly'|'topics'|'events';limit:number;offset:number;}
export interface ReadingResult {hot:HeatEntry[];reports:Report[];topics:Topic[];events:Story[];}
export interface RuntimeResult {state:RuntimeState;defaultRoute:{provider:string;model:string}|null;error:string|null;running:boolean;}
export interface PageRequest {limit:number;offset:number;}
export interface AdminResult {jobs:JobSummary[];receipts:CallSummary[];}
export interface PreviewRequest {id:string;commandId:string;paidAcknowledged:boolean;}
export interface PreviewResult {items:CollectionItem[];paid:boolean;committed:false;}
export interface RerunRequest {id:string;scope:'editorial'|'grouping'|'translation';commandId:string;}
export interface EditorialCorrectionRequest {commandId:string;id:string;expectedRevision:number;visibility:'public'|'summary-only'|'withdrawn'|null;fields:Record<string,Json>;reason:string;}
export interface EventCorrectionRequest {commandId:string;expectedRevision:number;id:string;mode:'standalone'|'assign'|'regroup';factId:string|null;reason:string;}
export interface EventMergeRequest {commandId:string;survivor:string;other:string;expectedSurvivor:number;expectedOther:number;reason:string;}
export interface EventSplitRequest {commandId:string;id:string;expectedRevision:number;articleIds:string[];reason:string;}
export interface CorrectionState {id:string;inputRevision:number;editorialRevision:number;groupingRevision:number;visibility:'public'|'summary-only'|'withdrawn'|null;fields:Record<string,Json>;factId:string|null;storyId:string|null;}
export interface CorrectionResult {item:CorrectionState|null;}
export interface MutationHistory {items:Record<string,Json>[];}
export interface MarkRequest {id:string;bookmarked:boolean|null;read:boolean;}
export interface CredentialWriteRequest {service:'socialdata'|'dajiala'|'jina'|'github'|'embedding'|'external'|'artificial-analysis';secret:string;}
export interface CredentialsResult {items:{service:string;configured:boolean}[];}

export interface OptionalRequest {module:'leaderboard'|'monitor';limit:number;offset:number;board:string|null;domestic:boolean;openWeights:boolean;query:string;}
export interface MonitorReviewRequest {commandId:string;postId:string;accepted:boolean;reason:string;}
export interface MonitorCorrectionRequest {commandId:string;expectedRevision:number;eventId:string;status:'announced'|'confirmed';withdrawn:boolean;reason:string;}
export interface EvaluationCase {id:string;title:string;body:string;url:string;tier:'T1'|'T1_5'|'T2'|'EXCLUDE_MP';gold:'select'|'discard';publishedAt:number|null;}
export interface EvaluationRequest {commandId:string;label:string;routes:{provider:string;model:string}[];cases:EvaluationCase[];}
export interface EvaluationResult {runs:Record<string,Json>[];results:Record<string,Json>[];}
export interface ChronicleResult {kinds:Record<string,{label:string;above:boolean;launch:boolean}>;topicId:string;months:{month:string;events:{id:string;title:string;label:string;at:string;kind:string;href:string}[]}[];highlights:{id:string;title:string;label:string;at:string;kind:string;href:string}[];}

export interface WatchRequest {afterRevision:number;}
export interface ChangeSnapshot {epoch:number;dataRevision:number;reset:boolean;scopes:('runtime'|'content'|'events'|'reports'|'topics'|'library'|'sources'|'admin'|'leaderboard'|'monitor')[];}

export interface JobSummary {id:string;kind:string;subject:string;state:string;attempts:number;maxAttempts:number;dueAt:number;error:string|null;}
export interface CallSummary {id:string;service:string;state:string;attempt:number;updatedAt:number;provider:string|null;model:string|null;stage:string|null;usage:Record<string,Json>|null;cost:number|null;currency:string|null;costBasis:'actual'|'estimated'|'unknown';auditPending:boolean;epoch:number;confirmation:UnknownConfirmation|null;}
export interface CallDetailRequest {id:string;attempt:number|null;limit:number;offset:number;}
export interface CallDetailResult {id:string;offset:number;total:number;attempts:ReceiptAttempt[];}
export interface RetryRequest {id:string;attempt:number;commandId:string;acknowledged:boolean;}
export interface UnknownConfirmation {outcome:'billed'|'not-billed';reason:string;cost:number|null;currency:string|null;confirmedAt:number;}
export interface ConfirmUnknownRequest {id:string;attempt:number;commandId:string;outcome:'billed'|'not-billed';reason:string;cost:number|null;currency:string|null;}
export interface ReportResult {item:Report|null;revisions:{revision:number;reason:string|null;generatedAt:number}[];}
export interface RegenerateReportRequest {id:string;commandId:string;expectedRevision:number;reason:string;acknowledged:boolean;}
export interface CompileHistoryRequest {commandId:string;revision:number;acknowledged:true;}
export interface CompileHistoryResult {enqueued:number;remaining:number;active:number;complete:boolean;}
export interface PreferenceResult {revision:number;values:Record<string,Json>;}
export interface PreferenceRequest {expectedRevision:number;commandId:string;values:Record<string,Json>;}
export interface CatalogResult {providers:{id:string;name:string;models:{id:string;name:string;image:boolean}[];error:string|null}[];}
export interface DiagnosticsResult {resources:Record<string,number>;databaseBytes:number;walBytes:number;schemaVersion:number;sourceCount:number;externalPort:number|null;externalError:string|null;}

export interface Candidate {id:string;sourceId:string;sourceName:string;title:string;url:string;publishedAt:number|null;discoveredAt:number;revision:number;bodyStatus:string;processingState:string;groupingStatus:string;backfill:boolean;selected:boolean;error:string|null;}
export interface CandidateRequest {query:string;limit:number;offset:number;}
export interface CandidateResult {items:Candidate[];total:number;}
export interface ReplayRssRequest {commandId:string;members:{sourceId:string;feedUrl:string;capturedAt:number;items:CollectionItem[]}[];}
export interface ModelAuthorizationRequest {commandId:string;route:{provider:string;model:string};articleIds:string[];maximum:number;}
export interface ModelAuthorizationResult {id:string;provider:string;model:string;articleIds:string[];maximum:number;used:number;active:boolean;}

export interface MediaRequest {id:string;revision:number;index:number;}
export interface MediaResult {id:string;revision:number;index:number;dataUrl:string;}

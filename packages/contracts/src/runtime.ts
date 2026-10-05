import type {UnknownConfirmation} from './api.ts';
/** Domain contracts. All clocks are UTC milliseconds; report calendars are Asia/Shanghai. */
import { z } from 'zod';
export const sourceKinds = ['rss','web_list','json_list','x_search','mp_account','external'] as const;
export type SourceKind = 'rss'|'web_list'|'json_list'|'x_search'|'mp_account'|'external';
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export const jsonSchema: z.ZodType<Json> = z.lazy(() => z.union([z.null(),z.boolean(),z.number().finite(),z.string(),z.array(jsonSchema),z.record(z.string(),jsonSchema)]));
export const jsonObjectSchema = z.record(z.string(), jsonSchema);
export const routeSchema = z.object({provider:z.string().min(1).max(120), model:z.string().min(1).max(240)}).strict();
export const budgetSchema = z.object({perMinute:z.number().int().min(0).max(10000),perHour:z.number().int().min(0).max(100000),per24Hours:z.number().int().min(0).max(1000000)}).strict();
export interface BudgetPolicy { perMinute: number; perHour: number; per24Hours: number; }
export interface RuntimeSettings {
  autoCollectEnabled:boolean;
  processing:{enabled:boolean};
  industry:{name:string;revision:number;promptOverrides:Record<string,string>;thresholds:{T1:number;T1_5:number;T2:number};categories:{key:string;label:string;section:string;guide:string;commentary:boolean}[];entities:Record<string,{name:string;aliases:string[]}>;topicTags:string[]};
  network:{dnsMode:'system'|'public-doh';publicProxyUrl:string|null};
  concurrency:{collect:number;model:number;grouping:number};
  retention:{ordinaryLogDays:number;cacheDays:number};
  model:{provider:string;model:string;stageOverrides:Record<string,{provider:string;model:string}>};
  leaderboard:{arenaProxyUrl:string|null;sources:Record<string,boolean>;excludedModels:string[];aliases:Record<string,Record<string,string>>};
  features:{leaderboard:boolean;codexResetMonitor:boolean};
  budgets:{llm:BudgetPolicy;paidCollectorPerService:BudgetPolicy};
  externalIngest:{enabled:boolean;credentialRef:string|null};
  embedding:{mode:'lexical'|'vector';endpoint:string|null;model:string|null;credentialRef:string|null;dimension:number|null};
}
export const httpProxyOriginSchema=z.string().trim().max(2048).url().refine(value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/';}catch{return false;}},'Use an HTTP(S) proxy origin without credentials').nullable().default(null);
export const arenaProxySchema=httpProxyOriginSchema;
export const settingsSchema: z.ZodType<RuntimeSettings> = z.object({
 autoCollectEnabled:z.boolean(),processing:z.object({enabled:z.boolean()}).strict().default({enabled:true}),industry:z.object({name:z.string().trim().min(1).max(120),revision:z.number().int().positive(),promptOverrides:z.record(z.string().regex(/^[a-z][a-z0-9.-]{0,100}$/),z.string().max(50000)),thresholds:z.object({T1:z.number().int().min(0).max(100),T1_5:z.number().int().min(0).max(100),T2:z.number().int().min(0).max(100)}).strict(),categories:z.array(z.object({key:z.string().regex(/^[a-z0-9.-]+$/),label:z.string().max(120),section:z.string().max(120),guide:z.string().max(2000),commentary:z.boolean()}).strict()).max(50),entities:z.record(z.string(),z.object({name:z.string().max(120),aliases:z.array(z.string().max(120)).max(30)}).strict()),topicTags:z.array(z.string().max(120)).max(200)}).strict().default({name:'AI',revision:1,promptOverrides:{},thresholds:{T1:60,T1_5:65,T2:76},categories:[],entities:{},topicTags:[]}),network:z.object({dnsMode:z.enum(['system','public-doh']),publicProxyUrl:httpProxyOriginSchema}).strict().default({dnsMode:'system',publicProxyUrl:null}),concurrency:z.object({collect:z.number().int().min(1).max(10),model:z.number().int().min(1).max(10),grouping:z.literal(1)}).strict().default({collect:3,model:2,grouping:1}),retention:z.object({ordinaryLogDays:z.number().int().min(1).max(3650),cacheDays:z.number().int().min(1).max(365)}).strict().default({ordinaryLogDays:30,cacheDays:7}),model:routeSchema.extend({stageOverrides:z.record(z.string(),routeSchema)}).strict(),
 leaderboard:z.object({arenaProxyUrl:arenaProxySchema,sources:z.record(z.string().max(120),z.boolean()),excludedModels:z.array(z.string().max(200)).max(1000),aliases:z.record(z.string().max(120),z.record(z.string().max(240),z.string().max(200)))}).strict().default({arenaProxyUrl:null,sources:{},excludedModels:[],aliases:{}}),features:z.object({leaderboard:z.boolean(),codexResetMonitor:z.boolean()}).strict(),
 budgets:z.object({llm:budgetSchema,paidCollectorPerService:budgetSchema}).strict(),
 externalIngest:z.object({enabled:z.boolean(),credentialRef:z.string().min(1).nullable()}).strict(),
 embedding:z.object({mode:z.enum(['lexical','vector']),endpoint:z.string().url().nullable(),model:z.string().nullable(),credentialRef:z.string().nullable(),dimension:z.number().int().min(1).max(16384).nullable()}).strict(),
}).strict();
export function defaultSettings(route:{provider:string;model:string}): RuntimeSettings {
 return {autoCollectEnabled:true,processing:{enabled:true},industry:{name:'AI',revision:1,promptOverrides:{},thresholds:{T1:60,T1_5:65,T2:76},categories:[],entities:{},topicTags:[]},network:{dnsMode:'system',publicProxyUrl:null},concurrency:{collect:3,model:2,grouping:1},retention:{ordinaryLogDays:30,cacheDays:7},model:{...route,stageOverrides:{}},leaderboard:{arenaProxyUrl:null,sources:{},excludedModels:[],aliases:{}},features:{leaderboard:false,codexResetMonitor:false},budgets:{llm:{perMinute:20,perHour:200,per24Hours:1000},paidCollectorPerService:{perMinute:2,perHour:20,per24Hours:100}},externalIngest:{enabled:false,credentialRef:null},embedding:{mode:'lexical',endpoint:null,model:null,credentialRef:null,dimension:null}};
}
export interface Source {
 createdAt:number|null;id:string;name:string;kind:SourceKind;config:Record<string,Json>;tags:string[];tier:'T1'|'T1_5'|'T2'|'EXCLUDE_MP';
 ownerEntityId:string|null;signalGroupId:string|null;participationMode:'editorial'|'hot_signal'|'isolated';
 firstParty:boolean;intervalMinutes:number;siteFulltext:boolean;enabled:boolean;revision:number;
 cursor:Record<string,Json>;health:string;lastOkAt:number|null;nextDueAt:number|null;lastError:string|null;
}
export const sourceSchema: z.ZodType<Source> = z.object({
 createdAt:z.number().int().nonnegative().nullable().default(null),id:z.string().regex(/^[\w.-]{1,120}$/),name:z.string().trim().min(1).max(200),kind:z.enum(sourceKinds),config:jsonObjectSchema,tags:z.array(z.string().max(120)).max(40),tier:z.enum(['T1','T1_5','T2','EXCLUDE_MP']),ownerEntityId:z.string().nullable(),signalGroupId:z.string().nullable(),participationMode:z.enum(['editorial','hot_signal','isolated']),firstParty:z.boolean(),intervalMinutes:z.number().int().min(1).max(1440),siteFulltext:z.boolean(),enabled:z.boolean(),revision:z.number().int().positive(),cursor:jsonObjectSchema,health:z.string(),lastOkAt:z.number().nullable(),nextDueAt:z.number().nullable(),lastError:z.string().nullable(),
}).strict();
export interface RuntimeState { deleting:boolean;dataRevision:number;moduleGenerations:{leaderboard:number;monitor:number};initialized:boolean;epoch:number;revision:number;settings:RuntimeSettings|null;schemaVersion:number;sourceCount:number;counts:Record<string,number>; }
export type JobState='queued'|'running'|'retry_wait'|'blocked'|'succeeded'|'failed'|'cancelled';
export interface DurableJob { id:string;kind:string;subject:string;key:string;epoch:number;inputRevision:number;configRevision:number;payload:Record<string,Json>;state:JobState;priority:number;attempts:number;maxAttempts:number;dueAt:number;leaseOwner:string|null;leaseUntil:number|null;error:string|null; }
export interface EnqueueJob {kind:string;subject:string;key:string;epoch:number;inputRevision:number;configRevision:number;payload:Record<string,Json>;priority:number;maxAttempts:number;dueAt:number;}
export const enqueueSchema: z.ZodType<EnqueueJob> = z.object({kind:z.string().min(1),subject:z.string().min(1),key:z.string().min(1),epoch:z.number().int().nonnegative(),inputRevision:z.number().int().nonnegative(),configRevision:z.number().int().positive(),payload:jsonObjectSchema,priority:z.number().int(),maxAttempts:z.number().int().min(1).max(20),dueAt:z.number().int().nonnegative()}).strict();
export interface Receipt {id:string;key:string;service:string;state:'reserved'|'pending'|'received'|'completed'|'failed'|'unknown';epoch:number;requestHash:string;request:Record<string,Json>;response:Json|null;usage:Record<string,Json>|null;auditRef:string|null;attempt:number;automaticReleases:number;updatedAt:number;}
export interface ReceiptAttempt {id:string;receiptId:string;service:string;attempt:number;epoch:number;requestHash:string|null;request:Record<string,Json>|null;response:Json|null;usage:Record<string,Json>|null;auditRef:string|null;auditSettled:boolean;outcome:string|null;reservedAt:number;sentAt:number|null;finishedAt:number|null;error:string|null;cost:number|null;currency:string|null;costBasis:'actual'|'estimated'|'unknown';confirmation:UnknownConfirmation|null;}
export interface Reservation {receipt:Receipt|null;admitted:boolean;reusable:boolean;blockedReason:string|null;retryAt:number|null;}
export interface StorageOperations {
 monitorTestStart:{input:import('./integrations.ts').MonitorTestRequest&{now:number};output:import('./integrations.ts').MonitorTestResult};
 leaderboardRefresh:{input:import('./integrations.ts').LeaderboardRefreshRequest&{now:number};output:DurableJob};
 monitorTestRead:{input:import('./integrations.ts').MonitorTestReadRequest;output:import('./integrations.ts').MonitorTestResult};
 moduleHealth:{input:Record<string,never>;output:import('./integrations.ts').ModuleHealthResult};
 credentialInvalidate:{input:{service:string;now:number};output:boolean};
 materialsKnown:{input:{keys:string[]};output:{key:string;id:string;title:string;bodyStatus:string;discoveredAt:number;raw:Json}[]};
 findReceipt:{input:{key:string};output:Receipt|null};
 dispatchPlan:{input:{key:string};output:Record<string,Json>|null};
 freezeDispatch:{input:{key:string;epoch:number;jobId:string|null;owner:string|null;request:Record<string,Json>;now:number};output:Record<string,Json>};
 retireModelAuthorization:{input:{commandId:string;id:string;reason:string;now:number};output:boolean};
 modelAuthorization:{input:Record<string,never>;output:import('./api.ts').ModelAuthorizationResult|null};
 authorizeModels:{input:import('./api.ts').ModelAuthorizationRequest&{now:number};output:import('./api.ts').ModelAuthorizationResult};
 candidatesPage:{input:import('./api.ts').CandidateRequest;output:import('./api.ts').CandidateResult};
 callAttempts:{input:import('./api.ts').CallDetailRequest;output:import('./api.ts').CallDetailResult};
 receiptAttempts:{input:{id:string;limit:number;offset:number};output:ReceiptAttempt[]};
 auditRecoverable:{input:{limit:number;offset:number};output:ReceiptAttempt[]};
 restoreResponse:{input:{id:string;attempt:number;epoch:number;response:Json;usage:Record<string,Json>;now:number};output:boolean};
 auditPending:{input:{limit:number};output:ReceiptAttempt[]};
 auditComplete:{input:{id:string;attempt:number;epoch:number};output:boolean};
 archiveResponse:{input:{id:string;attempt:number;epoch:number;response:Json;usage:Record<string,Json>;now:number};output:boolean};
 beginClear:{input:{commandId:string;now:number};output:RuntimeState};
 confirmRetry:{input:import('./api.ts').RetryRequest&{now:number};output:boolean};
 confirmUnknown:{input:import('./api.ts').ConfirmUnknownRequest&{now:number};output:boolean};
 freezeJob:{input:OwnedJob&{stage:string;request:Record<string,Json>};output:Record<string,Json>};
 state:{input:Record<string,never>;output:RuntimeState};
 initialize:{input:{commandId:string;settings:RuntimeSettings;sources:Source[];topics?:Topic[];now:number};output:RuntimeState};
 configure:{input:{commandId?:string;revision:number;settings:RuntimeSettings;now:number};output:RuntimeState};
 sources:{input:Record<string,never>;output:Source[]};
 saveSource:{input:{commandId?:string;source:Source;expectedRevision:number;now:number};output:Source};
 removeSource:{input:{commandId?:string;id:string;expectedRevision:number;now:number};output:boolean};
 schedule:{input:{now:number};output:number};
 enqueue:{input:EnqueueJob;output:DurableJob};
 cancelJob:{input:{id:string;owner:string;epoch:number;now:number;reason:string};output:boolean};
 claim:{input:{kinds:string[];owner:string;now:number;leaseMs:number};output:DurableJob|null};
 finish:{input:{id:string;owner:string;epoch:number;now:number;result:Json};output:boolean};
 fail:{input:{id:string;owner:string;epoch:number;now:number;error:string;blocked:boolean;retryAt:number};output:boolean};
 renew:{input:{id:string;owner:string;epoch:number;now:number;leaseMs:number};output:boolean};
 jobs:{input:{limit:number;offset:number};output:DurableJob[]};
 setBudget:{input:{service:string;policy:BudgetPolicy};output:boolean};
 linkReceipt:{input:{id:string;jobId:string};output:boolean};
 reserve:{input:{jobId?:string;key:string;service:string;epoch:number;requestHash:string;request:Record<string,Json>;now:number};output:Reservation};
 sent:{input:{attempt?:number;id:string;epoch:number;auditRef:string;now:number};output:boolean};
 receive:{input:{attempt?:number;id:string;epoch:number;response:Json;usage:Record<string,Json>;now:number};output:boolean};
 settle:{input:{attempt?:number;id:string;epoch:number;now:number;state:'completed'|'failed'|'unknown';error:string|null};output:boolean};
 receipts:{input:{limit:number;offset:number};output:Receipt[]};
 recover:{input:{now:number;startup?:boolean};output:{jobs:number;unknown:number;released:number}};
 clear:{input:{commandId:string;now:number};output:RuntimeState};
}
export type StorageOperation=keyof StorageOperations;
export interface HotstreamStore {
 execute<K extends StorageOperation>(operation:K,input:StorageOperations[K]['input']):Promise<StorageOperations[K]['output']>;
 resources?():Record<string,number>;
 subscribe?(listener:(operation:StorageOperation)=>void):()=>void;
 close():Promise<void>;
}
const time=z.number().int().nonnegative();const id=z.string().min(1).max(500);const epoch=z.number().int().nonnegative();
export const baseOperationSchemas = {
 monitorTestStart:z.object({commandId:z.string().uuid(),revision:z.number().int().positive(),acknowledged:z.literal(true),now:time}).strict(),
 leaderboardRefresh:z.object({commandId:z.string().uuid(),revision:z.number().int().positive(),now:time}).strict(),
 monitorTestRead:z.object({jobId:id}).strict(),moduleHealth:z.object({}).strict(),credentialInvalidate:z.object({service:id,now:time}).strict(),
 retireModelAuthorization:z.object({commandId:z.string().uuid(),id,reason:z.string().trim().min(1).max(1000),now:time}).strict(),modelAuthorization:z.object({}).strict(),authorizeModels:z.object({commandId:z.string().uuid(),route:routeSchema,articleIds:z.array(id).min(1).max(3),maximum:z.number().int().min(1).max(30),now:time}).strict(),candidatesPage:z.object({query:z.string().max(200),limit:z.number().int().min(1).max(100),offset:z.number().int().nonnegative()}).strict(),callAttempts:z.object({id,attempt:z.number().int().positive().nullable(),limit:z.number().int().min(1).max(50),offset:z.number().int().nonnegative()}).strict(),callSummary:z.object({limit:z.number().int().min(1).max(100),offset:z.number().int().nonnegative()}).strict(),reportRevisions:z.object({id}).strict(),reportRegenerate:z.object({id,commandId:z.string().uuid(),expectedRevision:z.number().int().positive(),reason:z.string().trim().min(1).max(1000),now:time}).strict(),preferenceGet:z.object({}).strict(),preferenceSave:z.object({expectedRevision:z.number().int().nonnegative(),commandId:z.string().uuid(),values:jsonObjectSchema,now:time}).strict(),reportMissing:z.object({kind:z.enum(['daily','weekly','monthly']),latest:z.string().max(20),limit:z.number().int().min(1).max(100)}).strict(),
 dispatchPlan:z.object({key:id}).strict(),freezeDispatch:z.object({key:id,epoch,jobId:id.nullable(),owner:id.nullable(),request:jsonObjectSchema,now:time}).strict(),receiptAttempts:z.object({id,limit:z.number().int().min(1).max(100),offset:z.number().int().nonnegative()}).strict(),auditRecoverable:z.object({limit:z.number().int().min(1).max(100),offset:z.number().int().nonnegative()}).strict(),restoreResponse:z.object({id,attempt:z.number().int().positive(),epoch,response:jsonSchema,usage:jsonObjectSchema,now:time}).strict(),auditPending:z.object({limit:z.number().int().min(1).max(100)}).strict(),auditComplete:z.object({id,attempt:z.number().int().positive(),epoch}).strict(),archiveResponse:z.object({id,attempt:z.number().int().positive(),epoch,response:jsonSchema,usage:jsonObjectSchema,now:time}).strict(),beginClear:z.object({commandId:z.string().uuid(),now:time}).strict(),confirmRetry:z.object({id,attempt:z.number().int().positive(),commandId:z.string().uuid(),acknowledged:z.literal(true),now:time}).strict(),confirmUnknown:z.object({id,attempt:z.number().int().positive(),commandId:z.string().uuid(),outcome:z.enum(['billed','not-billed']),reason:z.string().trim().min(1).max(1000),cost:z.number().finite().nonnegative().nullable(),currency:z.string().min(1).max(12).nullable(),now:time}).strict(),
 materialsKnown:z.object({keys:z.array(id).max(2000)}).strict(),findReceipt:z.object({key:id}).strict(),freezeJob:z.object({jobId:id,owner:id,epoch,now:time,stage:id,request:jsonObjectSchema}).strict(),
 state:z.object({}).strict(), initialize:z.object({commandId:z.string().uuid(),settings:settingsSchema,sources:z.array(sourceSchema).min(1).max(1000),topics:z.lazy(()=>z.array(topicSchema)).default([]),now:time}).strict(),
 configure:z.object({commandId:z.string().uuid().optional(),revision:z.number().int().positive(),settings:settingsSchema,now:time}).strict(),sources:z.object({}).strict(),
 saveSource:z.object({commandId:z.string().uuid().optional(),source:sourceSchema,expectedRevision:z.number().int().nonnegative(),now:time}).strict(),removeSource:z.object({commandId:z.string().uuid().optional(),id,expectedRevision:z.number().int().positive(),now:time}).strict(),
 schedule:z.object({now:time}).strict(),enqueue:enqueueSchema,
 cancelJob:z.object({id,owner:id,epoch,now:time,reason:z.string().max(1000)}).strict(),
 claim:z.object({kinds:z.array(id).min(1).max(20),owner:id,now:time,leaseMs:z.number().int().min(1000).max(600000)}).strict(),
 finish:z.object({id,owner:id,epoch,now:time,result:jsonSchema}).strict(),fail:z.object({id,owner:id,epoch,now:time,error:z.string().max(2000),blocked:z.boolean(),retryAt:time}).strict(),renew:z.object({id,owner:id,epoch,now:time,leaseMs:time}).strict(),
 jobs:z.object({limit:z.number().int().min(1).max(100),offset:z.number().int().nonnegative()}).strict(),setBudget:z.object({service:id,policy:budgetSchema}).strict(),
 linkReceipt:z.object({id,jobId:id}).strict(),reserve:z.object({jobId:id.optional(),key:id,service:id,epoch,requestHash:z.string().regex(/^[a-f\d]{64}$/),request:jsonObjectSchema,now:time}).strict(),sent:z.object({attempt:z.number().int().positive().optional(),id,epoch,auditRef:id,now:time}).strict(),receive:z.object({attempt:z.number().int().positive().optional(),id,epoch,response:jsonSchema,usage:jsonObjectSchema,now:time}).strict(),settle:z.object({attempt:z.number().int().positive().optional(),id,epoch,now:time,state:z.enum(['completed','failed','unknown']),error:z.string().nullable()}).strict(),receipts:z.object({limit:z.number().int().min(1).max(100),offset:z.number().int().nonnegative()}).strict(),recover:z.object({now:time,startup:z.boolean().default(true)}).strict(),clear:z.object({commandId:z.string().uuid(),now:time}).strict(),
};

export interface Article {
 id:string;sourceId:string;identityKey:string;url:string;title:string;author:string|null;language:string|null;
 publishedAt:number|null;publishedAtClaim:number|null;discoveredAt:number;timelineAt:number;backfill:boolean;backfillReason:string|null;
 revision:number;contentHash:string;excerpt:string|null;bodyText:string|null;bodyHtml:string|null;bodyStatus:'pending'|'ok'|'unconfirmed'|'none';
 media:Json[];xPost:Record<string,Json>|null;raw:Json;source:Source;processingState:string;groupingStatus:string;
}
export interface AnalysisStep {industryVersion?:string;articleId:string;inputRevision:number;configRevision:number;stage:string;slot:string;runKey:string;provider:string;model:string;promptHash:string;result:Record<string,Json>;receiptIds:string[];createdAt:number;}
export interface ArticleWork {groupingOverride:{mode:'standalone'|'assign';factId:string|null}|null;activeRun:string;activeConfigRevision:number;manualRevision:number;article:Article;steps:AnalysisStep[];settings:RuntimeSettings;epoch:number;configRevision:number;}
export interface Publication {
 id:string;revision:number;visibility:'public'|'summary-only'|'withdrawn';eligible:boolean;selected:boolean;selectionCandidate:boolean;seat:boolean;
 title:string;originalTitle:string;summary:string;reason:string|null;category:string|null;tags:string[];subjects:string[];score:number|null;
 url:string;sourceId:string;sourceName:string;firstParty:boolean;publishedAt:number|null;discoveredAt:number;timelineAt:number;backfill:boolean;
 body:string|null;bodyHtml:string|null;translatedHtml:string|null;media:{index:number;kind:string;alt:string|null}[];translatedBody:string|null;translationComplete:boolean|null;storyId:string|null;factId:string|null;groupingStatus:string;bookmarked:boolean;readAt:number|null;
}
export interface PageQuery {view:'selected'|'all'|'bookmarks';query:string;category:string|null;topic:string|null;limit:number;offset:number;}
export interface PageResult {items:Publication[];total:number;}
export interface EventCandidate {stamp:string;factId:string;storyId:string;factTitle:string;members:number;storyRoot:boolean;score:number;report:{title:string;source:string;firstParty:boolean;at:number|null;summary:string|null;scope:'single'|'composite'|'unknown'};selected:boolean;selectedReport:{title:string;source:string;firstParty:boolean;at:number|null;summary:string|null;scope:'single'|'composite'|'unknown'}|null;}
export interface Story {id:string;publicId:string;title:string;status:string;version:number;mergedInto:string|null;digestFallback:boolean;digest:string|null;latest:string|null;firstReportAt:number|null;latestAt:number|null;facts:{id:string;title:string;articleIds:string[]}[];articles:Publication[];links:string[];heatSeries:{hour:number;heat:number;participants:number}[];}
export interface HeatEntry {storyId:string;title:string;heat:number;participants:number;editorialParticipants:number;coverageComplete:boolean;trend:'new'|'up'|'down'|'flat'|'unknown';trendPct:number|null;badges:('surge'|'new'|'rising')[];signalCount:number;reportCount:number;sourceNames:string[];representativeItemId:string|null;latestAt:number;firstReportAt:number;}
export interface Report {id:string;kind:'daily'|'weekly'|'monthly';key:string;timeZone:string;windowStart:number;windowEnd:number;createdAt:number;revision:number;content:Record<string,Json>;coverage:string;}
export interface Topic {id:string;name:string;kind:string;tags:string[];definition:string;related:string[];entityId:string|null;orgNames:string[];chronicleTerms:string[];}
export interface CollectionItem {url:string;title:string;identityKey:string|null;author:string|null;language:string|null;publishedAt:number|null;excerpt:string|null;bodyHtml:string|null;bodyText:string|null;bodyStatus:'pending'|'ok'|'unconfirmed'|'none';media:Json[];xPost:Record<string,Json>|null;raw:Json;backfillReason:string|null;}
export interface OwnedJob {jobId:string;owner:string;epoch:number;now:number;}
export interface StorageOperations {
 work:{input:{id:string};output:ArticleWork|null};
 collectionBatch:{input:OwnedJob&{members:{sourceId:string;sourceRevision:number;items:CollectionItem[];cursor:Record<string,Json>;receiptIds:string[]}[]};output:{committed:boolean;created:number;revised:number}};
 collection:{input:OwnedJob&{observedAt?:number;foundCount?:number;sourceId:string;sourceRevision:number;items:CollectionItem[];cursor:Record<string,Json>;receiptIds:string[]};output:{committed:boolean;created:number;revised:number}};
 extraction:{input:OwnedJob&{id:string;revision:number;bodyText:string|null;bodyHtml:string|null;media?:Record<string,Json>[];status:'ok'|'unconfirmed';receiptIds:string[]};output:boolean};
 analysis:{input:OwnedJob&{step:AnalysisStep};output:boolean};
 candidates:{input:{id:string;now:number};output:EventCandidate[]};
 grouping:{input:OwnedJob&{sourceRevision?:number;analysisIdentity?:{configRevision:number;runKey:string;promptHash:string};candidateVersions?:{factId:string;stamp:string}[];manualRevision?:number;merges?:{survivor:string;other:string}[];id:string;revision:number;decisions:{factId:string;relation:string;confidence:number;note:string}[];selection:{addsValue:boolean;reason:string};receiptIds:string[]};output:boolean};
 page:{input:PageQuery;output:PageResult};
 detail:{input:{id:string};output:Publication|null};
 marks:{input:{id:string;bookmarked:boolean|null;read:boolean;now:number};output:boolean};
 override:{input:{commandId?:string;id:string;expectedRevision:number;visibility:'public'|'summary-only'|'withdrawn'|null;fields:Record<string,Json>;reason:string;now:number};output:boolean};
 correctEvent:{input:{commandId?:string;expectedRevision?:number;id:string;mode:'standalone'|'assign'|'regroup';factId:string|null;reason:string;now:number};output:boolean};
 mergeStories:{input:{commandId?:string;expectedSurvivor?:number;expectedOther?:number;reason?:string;survivor:string;other:string;now:number};output:boolean};
 story:{input:{id:string};output:Story|null};
 stories:{input:{limit:number;offset:number};output:Story[]};
 heat:{input:{now:number;epoch:number;compute:boolean};output:HeatEntry[]};
 topics:{input:Record<string,never>;output:Topic[]};
 seedTopics:{input:{topics:Topic[]};output:boolean};
 reports:{input:{kind:string;limit:number;offset:number};output:Report[]};
 report:{input:{id:string};output:Report|null};
 compileHistory:{input:import('./api.ts').CompileHistoryRequest&{now:number};output:import('./api.ts').CompileHistoryResult};
 dailyEdition:{input:{date:string;start:number;end:number;historical?:boolean;asOf?:number};output:{entries:Record<string,Json>[];stats:Record<string,number>}};
 periodEntries:{input:{startDate:string;endDate:string;now:number;historical?:boolean};output:{entries:Record<string,Json>[];issues:number}};
 reportMaterial:{input:{start:number;end:number;kind:'daily'|'weekly'|'monthly'};output:{items:Publication[];reports:Report[]}};
 saveReport:{input:{jobId?:string;owner?:string;epoch:number;report:Report;receiptIds:string[]};output:boolean};
 rerun:{input:{id:string;scope:'editorial'|'grouping'|'translation';commandId:string;now:number};output:boolean};
 sourceFailure:{input:{id:string;revision:number;epoch:number;now:number;error:string;blocked:boolean;retryAt:number};output:boolean};
 nextWake:{input:Record<string,never>;output:{at:number|null}};
 maintenance:{input:{now:number};output:{logs:number;cache:number}};
}
const owned={jobId:id,owner:id,epoch,now:time};const pagination={limit:z.number().int().min(1).max(100),offset:z.number().int().nonnegative()};
export const collectionItemSchema:z.ZodType<CollectionItem>=z.object({url:z.string().url().max(4000),title:z.string().trim().min(1).max(1000),identityKey:z.string().nullable(),author:z.string().nullable(),language:z.string().nullable(),publishedAt:z.number().nullable(),excerpt:z.string().max(20000).nullable(),bodyText:z.string().max(500000).nullable(),bodyHtml:z.string().max(1000000).nullable(),bodyStatus:z.enum(['pending','ok','unconfirmed','none']),media:z.array(jsonSchema).max(40),xPost:jsonObjectSchema.nullable(),raw:jsonSchema,backfillReason:z.string().nullable()}).strict();
export const analysisStepSchema:z.ZodType<AnalysisStep>=z.object({industryVersion:z.string().max(200).default('ai@1'),articleId:id,inputRevision:z.number().int().positive(),configRevision:z.number().int().positive(),stage:id,slot:id,runKey:id,provider:id,model:id,promptHash:id,result:jsonObjectSchema,receiptIds:z.array(id),createdAt:time}).strict();
export const topicSchema:z.ZodType<Topic>=z.object({id,name:z.string(),kind:z.string(),tags:z.array(z.string()),definition:z.string(),related:z.array(z.string()),entityId:z.string().nullable(),orgNames:z.array(z.string()),chronicleTerms:z.array(z.string())}).strict();
export const reportSchema:z.ZodType<Report>=z.object({id,kind:z.enum(['daily','weekly','monthly']),key:id,timeZone:z.literal('Asia/Shanghai'),windowStart:time,windowEnd:time,createdAt:time,revision:z.number().int().positive(),content:jsonObjectSchema,coverage:z.string()}).strict();
export const operationSchemas={...baseOperationSchemas,
 mediaReference:z.object({id,revision:z.number().int().positive(),index:z.number().int().min(0).max(11)}).strict(),
 uiArticle:z.object({id}).strict(),
 uiMonitor:z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const time=Date.parse(value+'T00:00:00Z');return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;}).nullable()}).strict(),
 uiFeed:z.object({view:z.enum(['selected','all','bookmarks']),query:z.string().max(200),category:z.string().nullable(),topic:z.string().nullable(),channel:z.enum(['all','news','x','firstParty']),tag:z.string().max(200).nullable(),...pagination,cursor:z.string().max(1000).nullable()}).strict(),
 uiGroups:z.object({factId:id,category:z.string().nullable(),channel:z.enum(['all','news','x','firstParty']),tag:z.string().max(200).nullable(),...pagination}).strict(),
 uiReportIndex:z.object({kind:z.enum(['daily','weekly','monthly']),group:z.string().regex(/^\d{4}(?:-\d{2})?$/).nullable(),...pagination}).strict(),
 uiReport:z.object({kind:z.enum(['daily','weekly','monthly']),key:z.string().max(20).nullable()}).strict(),

 work:z.object({id}).strict(),collection:z.object({...owned,observedAt:time.optional(),foundCount:z.number().int().nonnegative().optional(),sourceId:id,sourceRevision:z.number().int().positive(),items:z.array(collectionItemSchema).max(2000),cursor:jsonObjectSchema,receiptIds:z.array(id)}).strict(),extraction:z.object({...owned,id,revision:z.number().int().positive(),bodyText:z.string().nullable(),bodyHtml:z.string().nullable(),media:z.array(jsonObjectSchema).max(12).optional(),status:z.enum(['ok','unconfirmed']),receiptIds:z.array(id)}).strict(),analysis:z.object({...owned,step:analysisStepSchema}).strict(),candidates:z.object({id,now:time}).strict(),grouping:z.object({...owned,sourceRevision:z.number().int().positive().optional(),analysisIdentity:z.object({configRevision:z.number().int().positive(),runKey:id,promptHash:id}).strict().optional(),candidateVersions:z.array(z.object({factId:id,stamp:id}).strict()).max(12).optional(),manualRevision:z.number().int().nonnegative().optional(),merges:z.array(z.object({survivor:id,other:id}).strict()).max(12).default([]),id,revision:z.number().int().positive(),decisions:z.array(z.object({factId:id,relation:z.enum(['SAME_OCCURRENCE','SAME_STORY','UNRELATED','ROUNDUP']),confidence:z.number().min(0).max(1),note:z.string()}).strict()),selection:z.object({addsValue:z.boolean(),reason:z.string()}),receiptIds:z.array(id)}).strict(),
 page:z.object({view:z.enum(['selected','all','bookmarks']),query:z.string().max(200),category:z.string().nullable(),topic:z.string().nullable(),...pagination}).strict(),detail:z.object({id}).strict(),marks:z.object({id,bookmarked:z.boolean().nullable(),read:z.boolean(),now:time}).strict(),override:z.object({commandId:z.string().uuid().optional(),id,expectedRevision:z.number().int().nonnegative(),visibility:z.enum(['public','summary-only','withdrawn']).nullable(),fields:jsonObjectSchema,reason:z.string().max(1000),now:time}).strict(),correctEvent:z.object({commandId:z.string().uuid().optional(),expectedRevision:z.number().int().nonnegative().optional(),id,mode:z.enum(['standalone','assign','regroup']),factId:id.nullable(),reason:z.string(),now:time}).strict(),mergeStories:z.object({commandId:z.string().uuid().optional(),expectedSurvivor:z.number().int().positive().optional(),expectedOther:z.number().int().positive().optional(),reason:z.string().trim().min(1).max(1000).optional(),survivor:id,other:id,now:time}).strict(),story:z.object({id}).strict(),stories:z.object(pagination).strict(),heat:z.object({now:time,epoch,compute:z.boolean()}).strict(),topics:z.object({}).strict(),seedTopics:z.object({topics:z.array(topicSchema)}).strict(),reports:z.object({kind:z.string(),...pagination}).strict(),report:z.object({id}).strict(),compileHistory:z.object({commandId:z.string().uuid(),revision:z.number().int().positive(),acknowledged:z.literal(true),now:time}).strict(),dailyEdition:z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),start:time,end:time,historical:z.boolean().optional(),asOf:time.optional()}).strict(),periodEntries:z.object({startDate:z.string(),endDate:z.string(),now:time,historical:z.boolean().optional()}).strict(),reportMaterial:z.object({start:time,end:time,kind:z.enum(['daily','weekly','monthly'])}).strict(),saveReport:z.object({jobId:id.optional(),owner:id.optional(),epoch,report:reportSchema,receiptIds:z.array(id)}).strict(),rerun:z.object({id,scope:z.enum(['editorial','grouping','translation']),commandId:z.string().uuid(),now:time}).strict(),sourceFailure:z.object({id,revision:z.number().int().positive(),epoch,now:time,error:z.string().max(1000),blocked:z.boolean(),retryAt:time}).strict(),nextWake:z.object({}).strict(),maintenance:z.object({now:time}).strict(),
lbSeed:z.object({generation:z.number().int().nonnegative().optional(),epoch,models:z.array(jsonSchema),aliases:jsonSchema,calibrations:z.array(jsonSchema),prices:jsonSchema,priceDates:z.record(z.string(),z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),now:time}).strict(),lbSnapshot:z.object({generation:z.number().int().nonnegative().optional(),epoch,result:jsonObjectSchema,aliases:z.record(z.string(),z.string()).optional(),now:time}).strict(),lbHistory:z.object({now:time}).strict(),lbCalibration:z.object({generation:z.number().int().nonnegative().optional(),epoch,unit:id,protocol:id,calibration:jsonObjectSchema,now:time}).strict(),lbRun:z.object({generation:z.number().int().nonnegative().optional(),epoch,version:id,boards:z.array(jsonObjectSchema),snapshotIds:z.array(id),evidence:jsonObjectSchema,now:time}).strict(),moduleStatus:z.object({testJobId:id.optional(),generation:z.number().int().nonnegative().optional(),module:z.enum(['leaderboard','monitor']),source:id,state:jsonObjectSchema,now:time}).strict(),optionalData:z.object({module:z.enum(['leaderboard','monitor']),...pagination,board:z.string().max(120).nullable().default(null),domestic:z.boolean().default(false),openWeights:z.boolean().default(false),query:z.string().max(200).default('')}).strict(),monitorCursor:z.object({}).strict(),monitorPosts:z.object({testJobId:id.optional(),generation:z.number().int().nonnegative().optional(),epoch,posts:z.array(jsonObjectSchema).max(1000),cursor:jsonObjectSchema,receiptIds:z.array(id),now:time}).strict(),monitorWork:z.object({limit:z.number().int().min(1).max(100),postIds:z.array(id).max(1000).optional()}).strict(),monitorApply:z.object({testJobId:id.optional(),generation:z.number().int().nonnegative().optional(),epoch,postId:id,recognition:jsonObjectSchema,receiptId:id,now:time}).strict(),monitorCorrect:z.object({commandId:z.string().uuid(),expectedRevision:z.number().int().nonnegative(),eventId:id,status:z.enum(['announced','confirmed']),withdrawn:z.boolean(),reason:z.string(),now:time}).strict(),
evaluationSave:z.object({epoch,id,label:z.string(),promptVersion:id,models:z.array(id),results:z.array(jsonObjectSchema),summary:jsonObjectSchema,now:time}).strict(),evaluations:z.object(pagination).strict(),
chronicle:z.object({id,now:time}).strict(),
translation:z.object({...owned,id,revision:z.number().int().positive(),title:z.string(),html:z.string(),text:z.string(),complete:z.boolean(),receiptIds:z.array(id)}).strict(),
collectionBatch:z.object({...owned,members:z.array(z.object({foundCount:z.number().int().nonnegative().optional(),sourceId:id,sourceRevision:z.number().int().positive(),items:z.array(collectionItemSchema).max(2000),cursor:jsonObjectSchema,receiptIds:z.array(id)}).strict()).min(1).max(30)}).strict(),
vectorGet:z.object({service:id,model:id,dimension:z.number().int().min(1).max(16384),hash:id}).strict(),vectorPut:z.object({epoch,subjectId:id,service:id,model:id,dimension:z.number().int().min(1).max(16384),hash:id,vector:z.array(z.number().finite()).min(1).max(16384)}).strict(),
splitStory:z.object({commandId:z.string().uuid(),id,expectedRevision:z.number().int().positive(),articleIds:z.array(id).min(1).max(200),reason:z.string().trim().min(1).max(1000),now:time}).strict(),correctionState:z.object({id}).strict(),mutationHistory:z.object(pagination).strict(),credentialChanged:z.object({service:id,now:time}).strict(),monitorReview:z.object({commandId:z.string().uuid(),postId:id,accepted:z.boolean(),reason:z.string().trim().min(1).max(1000),now:time}).strict(),sourceReproject:z.object({id,now:time,refreshDigest:z.boolean().optional()}).strict(),reportCheck:z.object({kind:z.enum(['daily','weekly','monthly']),key:id,now:time}).strict(),storyDigestWork:z.object({id}).strict(),storyDigest:z.object({...owned,id,revision:z.number().int().positive(),inputsHash:id,digest:z.string().max(2000),latest:z.string().max(1000),receiptIds:z.array(id)}).strict(),
} satisfies Record<StorageOperation,z.ZodType>;
export interface OptionalData {enabled:boolean;total:number;records:Record<string,Json>[];sources:Record<string,Json>[];models:Record<string,Json>[];state:Record<string,Json>;}
export interface StorageOperations {
 lbSeed:{input:{generation?:number;epoch:number;models:Json[];aliases:Json;calibrations:Json[];prices:Json;priceDates?:Record<string,string>;now:number};output:boolean};
 lbSnapshot:{input:{generation?:number;epoch:number;result:Record<string,Json>;aliases?:Record<string,string>;now:number};output:{id:string;changed:boolean}};
 lbHistory:{input:{now:number};output:{snapshots:Record<string,Json>[];rows:Record<string,Json>[];calibrations:Record<string,Json>[]}};
 lbCalibration:{input:{generation?:number;epoch:number;unit:string;protocol:string;calibration:Record<string,Json>;now:number};output:boolean};
 lbRun:{input:{generation?:number;epoch:number;version:string;boards:Record<string,Json>[];snapshotIds:string[];evidence:Record<string,Json>;now:number};output:boolean};
 moduleStatus:{input:{testJobId?:string;generation?:number;module:'leaderboard'|'monitor';source:string;state:Record<string,Json>;now:number};output:boolean};
 optionalData:{input:{module:'leaderboard'|'monitor';limit:number;offset:number;board?:string|null;domestic?:boolean;openWeights?:boolean;query?:string};output:OptionalData};
 monitorCursor:{input:Record<string,never>;output:Record<string,Json>};
 monitorPosts:{input:{testJobId?:string;generation?:number;epoch:number;posts:Record<string,Json>[];cursor:Record<string,Json>;receiptIds:string[];now:number};output:boolean};
 monitorWork:{input:{limit:number;postIds?:string[]};output:Record<string,Json>[]};
 monitorApply:{input:{testJobId?:string;generation?:number;epoch:number;postId:string;recognition:Record<string,Json>;receiptId:string;now:number};output:boolean};
 monitorCorrect:{input:import('./api.ts').MonitorCorrectionRequest&{now:number};output:boolean};

}
export interface StorageOperations {
 evaluationSave:{input:{epoch:number;id:string;label:string;promptVersion:string;models:string[];results:Record<string,Json>[];summary:Record<string,Json>;now:number};output:boolean};
 evaluations:{input:{limit:number;offset:number};output:{runs:Record<string,Json>[];results:Record<string,Json>[]}};
}
export interface StorageOperations {chronicle:{input:{id:string;now:number};output:import('./api.ts').ChronicleResult};}
export interface StorageOperations {translation:{input:OwnedJob&{id:string;revision:number;title:string;html:string;text:string;complete:boolean;receiptIds:string[]};output:boolean};}
export interface StorageOperations {
 vectorGet:{input:{service:string;model:string;dimension:number;hash:string};output:number[]|null};
 vectorPut:{input:{epoch:number;subjectId:string;service:string;model:string;dimension:number;hash:string;vector:number[]};output:boolean};
}

export interface StorageOperations {
 callSummary:{input:{limit:number;offset:number};output:import('./api.ts').CallSummary[]};
 reportRevisions:{input:{id:string};output:{revision:number;reason:string|null;generatedAt:number}[]};
 reportRegenerate:{input:{id:string;commandId:string;expectedRevision:number;reason:string;now:number};output:boolean};
 preferenceGet:{input:Record<string,never>;output:import('./api.ts').PreferenceResult};
 preferenceSave:{input:{expectedRevision:number;commandId:string;values:Record<string,Json>;now:number};output:import('./api.ts').PreferenceResult};
 reportMissing:{input:{kind:'daily'|'weekly'|'monthly';latest:string;limit:number};output:string[]};
}

export interface StorageOperations {
 splitStory:{input:import('./api.ts').EventSplitRequest&{now:number};output:boolean};
 correctionState:{input:{id:string};output:import('./api.ts').CorrectionState|null};
 mutationHistory:{input:{limit:number;offset:number};output:Record<string,Json>[]};
 sourceReproject:{input:{id:string;now:number;refreshDigest?:boolean};output:boolean};
 storyDigest:{input:OwnedJob&{id:string;revision:number;inputsHash:string;digest:string;latest:string;receiptIds:string[]};output:boolean};
}

export interface StorageOperations {storyDigestWork:{input:{id:string};output:Record<string,Json>|null};}

export interface StorageOperations {reportCheck:{input:{kind:'daily'|'weekly'|'monthly';key:string;now:number};output:boolean};}

export interface StorageOperations {monitorReview:{input:import("./api.ts").MonitorReviewRequest&{now:number};output:boolean};credentialChanged:{input:{service:string;now:number};output:boolean};}

export interface StorageOperations {
 uiArticle:{input:import('./ui.ts').UiArticleRequest;output:import('./ui.ts').UiArticleResult};
 uiFeed:{input:import('./ui.ts').UiFeedRequest;output:import('./ui.ts').UiFeedResult};
 uiGroups:{input:import('./ui.ts').UiGroupRequest;output:import('./ui.ts').UiGroupResult};
 uiReportIndex:{input:import('./ui.ts').UiReportIndexRequest;output:import('./ui.ts').UiReportIndexResult};
 uiReport:{input:import('./ui.ts').UiReportRequest;output:import('./ui.ts').UiReportResult};
}

export interface StorageOperations {uiMonitor:{input:import('./monitor-ui.ts').UiMonitorRequest;output:import('./monitor-ui.ts').UiMonitorResult};}

export interface StorageOperations {mediaReference:{input:{id:string;revision:number;index:number};output:{epoch:number;url:string;cacheDays:number;dnsMode:'system'|'public-doh';publicProxyUrl:string|null}|null};}

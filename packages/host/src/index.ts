import type {UiMonitorRequest,UiMonitorResult,UiArticleRequest,UiArticleResult,UiFeedRequest,UiFeedResult,UiGroupRequest,UiGroupResult,UiReportIndexRequest,UiReportIndexResult,UiReportRequest,UiReportResult} from 'dsh-hotstream-contracts';
import {operationSchemas as uiOperationSchemas} from 'dsh-hotstream-contracts/runtime';
import type {CompileHistoryRequest,CompileHistoryResult} from 'dsh-hotstream-contracts';
import type {CredentialDeleteRequest,MonitorTestRequest,MonitorTestReadRequest,MonitorTestResult,ModuleHealthResult,LeaderboardRefreshRequest} from 'dsh-hotstream-contracts';
import {changeCredential} from './credentials.ts';
/** Host Remote controller and auxiliary-call owner, using published DSH interfaces. */
import type { Context } from '@deepseek-ai/cordis';
import type { M0StoragePort, HostSnapshot, ModelProbe, ProbeRequest, StorageProbe } from 'dsh-hotstream-contracts';
import { probeRequestSchema } from 'dsh-hotstream-contracts/storage-protocol';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { BlockAssembler, createUserMessage, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm';
import { deepFreeze } from '@deepseek-ai/dsh-util-values';
import {readingMedia} from 'dsh-hotstream-core/content/reading-media';
import {PublicNetwork} from './network.ts';
import type {Json} from 'dsh-hotstream-contracts/runtime';
import type {ImageMediaType} from '@deepseek-ai/dsh-attachment';
import { AuxiliaryAudit } from './audit.ts';
import { M0_MODEL, M0_PROVIDER } from './mock-provider.ts';

export { registerM0Provider } from './mock-provider.ts';
export type { AuditedRequest } from './audit.ts';

declare module '@deepseek-ai/cordis' {
  interface Context { hotstreamController: HotstreamController; }
}
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'hotstream/diagnostics-disabled': { readonly milestone: string };
    'hotstream/stopping': { readonly requestId: string };
  }
}

import {stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {BusinessOwner,checkSource} from './business-api.ts';
import {credentialKey} from '@deepseek-ai/dsh-credentials';
import {z} from 'zod';
import {collectionItemSchema,settingsSchema,type HotstreamStore,type RuntimeState,type PageQuery,type PageResult} from 'dsh-hotstream-contracts/runtime';
import type {EventSplitRequest,CorrectionResult,MutationHistory,CandidateRequest,CandidateResult,ReplayRssRequest,ModelAuthorizationRequest,ModelAuthorizationResult,MediaRequest,MediaResult,CallDetailRequest,CallDetailResult,RetryRequest,ConfirmUnknownRequest,ReportResult,RegenerateReportRequest,PreferenceResult,PreferenceRequest,CatalogResult,DiagnosticsResult,WatchRequest,ChangeSnapshot,ChronicleResult,EvaluationRequest,EvaluationResult,OptionalRequest,MonitorReviewRequest,MonitorCorrectionRequest,RuntimeResult,InitializeRequest,SettingsRequest,SourceRequest,DeleteSourceRequest,ClearRequest,ActionResult,SourcesResult,OptionalData,DetailResult,IdRequest,StoryResult,ReadingRequest,ReadingResult,PageRequest,AdminResult,PreviewRequest,PreviewResult,RerunRequest,EditorialCorrectionRequest,EventCorrectionRequest,EventMergeRequest,MarkRequest,CredentialWriteRequest,CredentialsResult} from 'dsh-hotstream-contracts';

/** Dependencies bound by the bundle composition entry. */
export interface HostOptions {
  readonly storage: M0StoragePort;
  readonly business?: {store:HotstreamStore;path:string};
  readonly auditRoot: string;
  readonly diagnosticsEnabled: boolean;
}

export class HotstreamController extends TypertRemoteService {
  private readonly audit: AuxiliaryAudit;
  private readonly business: BusinessOwner | undefined;
  private readonly lifetime = new AbortController();
  private readonly active = new Set<Promise<unknown>>();
  private readonly mediaCache=new Map<string,{result:MediaResult;expiresAt:number}>();
  private mediaCacheCharacters=0;
  private mediaReads=new AbortController();
  private readonly calls = new Map<string, Promise<ModelProbe>>();
  private lastModel: ModelProbe | null = null;
  private modelRequests = 0;
  private stopping: Promise<void> | undefined;

  constructor(ctx: Context, private readonly options: HostOptions) {
    super(ctx, 'hotstreamController', { namespace: 'hotstream' });
    this.audit = new AuxiliaryAudit(options.auditRoot);
    this.business=options.business?new BusinessOwner(ctx,options.business.store,options.business.path,options.auditRoot):undefined;
  }

  /** Read local evidence only; no worker or external request starts here. */
  /** Explicit image read with fresh Publication permission and public socket checks. */
  @Remote('readMedia') async readMedia(request:MediaRequest,signal:AbortSignal):Promise<MediaResult>{
    z.object({id:z.string().min(1),revision:z.number().int().positive(),index:z.number().int().min(0).max(11)}).strict().parse(request);
    const task=(async()=>{
      const owner=this.owner();await owner.ready();
      const reference=await owner.store.execute('mediaReference',request);
      if(!reference)throw new Error('Media permission or input revision changed');
      const attachments=this.ctx.get('attachments');if(!attachments)throw new Error('Official Attachment service unavailable');
      const control=AbortSignal.any([this.lifetime.signal,this.mediaReads.signal,signal??this.lifetime.signal]);control.throwIfAborted();
      const key=JSON.stringify([reference.epoch,request.id,request.revision,request.index,reference.url]);
      const cached=this.mediaCache.get(key);
      if(cached&&reference.cacheDays>0&&cached.expiresAt>Date.now()){this.mediaCache.delete(key);this.mediaCache.set(key,cached);return cached.result;}
      if(cached){this.mediaCache.delete(key);this.mediaCacheCharacters-=cached.result.dataUrl.length;}
      const direct=PublicNetwork.create(control,reference.dnsMode),network=PublicNetwork.forPublicReads(control,direct,reference.publicProxyUrl);
      try{
        const result=await network.fetch(reference.url,{signal:control,maxBytes:2*1024*1024,timeoutMs:20000});
        const type=result.headers.get('content-type')?.split(';')[0],bytes=result.body;
        const valid=type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/gif'?bytes.subarray(0,4).toString()==='GIF8':type==='image/webp'?bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP':false;
        if(result.status!==200||!valid)throw new Error('Media response is not a permitted image');
        await attachments.saveImage({data:bytes,mediaType:type as ImageMediaType,name:'hotstream-reading-image'});
        const latest=await owner.store.execute('mediaReference',request);control.throwIfAborted();
        if(!latest||latest.epoch!==reference.epoch||latest.url!==reference.url)throw new Error('Media permission changed during reading');
        const image:MediaResult={id:request.id,revision:request.revision,index:request.index,dataUrl:`data:${type};base64,${bytes.toString('base64')}`};
        const days=reference.cacheDays;
        if(days>0){const previous=this.mediaCache.get(key);if(previous)this.mediaCacheCharacters-=previous.result.dataUrl.length;this.mediaCache.set(key,{result:image,expiresAt:Date.now()+days*86400_000});this.mediaCacheCharacters+=image.dataUrl.length;while(this.mediaCacheCharacters>16*1024*1024||this.mediaCache.size>64){const oldest=this.mediaCache.keys().next().value!;this.mediaCacheCharacters-=this.mediaCache.get(oldest)!.result.dataUrl.length;this.mediaCache.delete(oldest);}}
        return image;
      }finally{await network.close();await direct.close();}
    })();this.active.add(task);try{return await task;}finally{this.active.delete(task);}
  }
  @Remote('status')
  async status(): Promise<HostSnapshot> {
    return {
      milestone: 'M0', productReady: false, initialized: false,
      targetDshVersion: '0.2.0-rc.2', hostNodeVersion: process.versions.node,
      diagnosticsEnabled: this.options.diagnosticsEnabled, sourceCount: 18,
      newsRequests: 0, modelRequests: this.modelRequests,
      storage: this.options.storage.inspect(), model: this.lastModel,
    };
  }

  /** Execute one explicit local storage diagnostic under a stable command id. */
  @Remote('probeStorage')
  async probeStorage(request: ProbeRequest): Promise<StorageProbe> {
    this.requireDiagnostics(request.commandId);
    return await this.options.storage.probe(probeRequestSchema.parse(request));
  }

  /** Exercise DSH LLM and audit with the M0 in-process route exclusively. */
  @Remote('probeModel')
  async probeModel(request: ProbeRequest): Promise<ModelProbe> {
    this.requireDiagnostics(request.commandId);
    probeRequestSchema.parse(request);
    const existing = this.calls.get(request.commandId);
    if (existing !== undefined) return await existing;
    const call = this.callOnce(request.commandId);
    this.calls.set(request.commandId, call);
    this.active.add(call);
    void call.then(() => this.active.delete(call), () => this.active.delete(call));
    return await call;
  }

  private owner():BusinessOwner {if(!this.business)throw new Error('Business runtime is not configured');return this.business;}
  @Remote({mode:'stream'})
  async *watch(request:WatchRequest,signal:AbortSignal):AsyncIterable<ChangeSnapshot>{
    z.object({afterRevision:z.number().int().nonnegative()}).strict().parse(request);
    const owner=this.owner();await owner.ready();const lifetime=AbortSignal.any([signal,this.lifetime.signal]);
    let notify:(()=>void)|undefined;let dirty=true;let first=true;
    const scopes=new Set<ChangeSnapshot['scopes'][number]>();
    const detach=owner.store.subscribe?.(operation=>{dirty=true;scopes.add(operation.startsWith('lb')?'leaderboard':operation.startsWith('monitor')?'monitor':operation.toLowerCase().includes('report')?'reports':operation.includes('Source')||operation==='collection'?'sources':'content');scopes.add('runtime');scopes.add('admin');notify?.();});
    const aborted=()=>notify?.();lifetime.addEventListener('abort',aborted);
    try{while(!lifetime.aborted){
      if(!dirty)await new Promise<void>(resolve=>{notify=resolve;if(dirty||lifetime.aborted)resolve();});
      notify=undefined;if(lifetime.aborted)break;dirty=false;
      const {state}=await owner.state();
      yield {epoch:state.epoch,dataRevision:state.dataRevision,reset:first,scopes:first?['runtime','content','events','reports','topics','library','sources','admin','leaderboard','monitor']:[...scopes]};
      first=false;scopes.clear();
    }}finally{detach?.();lifetime.removeEventListener('abort',aborted);}
  }
  @Remote('runtime') async runtime():Promise<RuntimeResult>{return await this.owner().state();}
  @Remote('initialize') async initialize(request:InitializeRequest):Promise<RuntimeState>{z.object({commandId:z.string().uuid(),route:z.object({provider:z.string().min(1),model:z.string().min(1)}).strict()}).strict().parse(request);return await this.owner().initialize(request);}
  @Remote('configure') async configure(request:SettingsRequest):Promise<RuntimeState>{const owner=this.owner();await owner.ready();const value=await owner.store.execute('configure',{...request,now:Date.now()});await owner.reconcile();owner.wake();return value;}
  @Remote('sources') async sources():Promise<SourcesResult>{const owner=this.owner();await owner.ready();if(!(await owner.state()).state.initialized)return {items:[]};return {items:await owner.store.execute('sources',{})};}
  @Remote('saveSource') async saveSource(request:SourceRequest):Promise<ActionResult>{const owner=this.owner();await owner.ready();const source=await owner.store.execute('saveSource',{commandId:request.commandId,source:checkSource(request.source),expectedRevision:request.expectedRevision,now:Date.now()});await owner.reconcile();owner.wake();return {ok:true,revision:source.revision};}
  @Remote('deleteSource') async deleteSource(request:DeleteSourceRequest):Promise<ActionResult>{const owner=this.owner();await owner.ready();const ok=await owner.store.execute('removeSource',{...request,now:Date.now()});await owner.reconcile();owner.wake();return {ok,revision:null};}
  @Remote('clear') async clear(request:ClearRequest):Promise<RuntimeState>{if(request.confirmation!=='CLEAR HOTSTREAM')throw new Error('Clear confirmation missing');const result=await this.owner().clear(request.commandId);this.mediaReads.abort(new Error('Hotstream library cleared'));this.mediaReads=new AbortController();this.mediaCache.clear();this.mediaCacheCharacters=0;return result;}
  @Remote('candidates') async candidates(request:CandidateRequest):Promise<CandidateResult>{const owner=this.owner();await owner.ready();if(!(await owner.state()).state.initialized)return {items:[],total:0};return await owner.store.execute('candidatesPage',request);}
  @Remote('replayRss') async replayRss(request:ReplayRssRequest):Promise<ActionResult>{this.requireDiagnostics(request.commandId);z.object({commandId:z.string().uuid(),members:z.array(z.object({sourceId:z.string().min(1),feedUrl:z.string().url(),capturedAt:z.number().int().nonnegative().max(Date.now()),items:z.array(collectionItemSchema).min(1).max(8)}).strict()).min(1).max(18)}).strict().parse(request);const owner=this.owner();await owner.ready();const state=(await owner.state()).state;if(!state.initialized||!state.settings||state.settings.processing.enabled)throw new Error('Pause editorial processing before replaying captured RSS');const sources=await owner.store.execute('sources',{});for(const member of request.members){const source=sources.find(source=>source.id===member.sourceId&&source.kind==='rss'&&source.config.feedUrl===member.feedUrl);if(!source)throw new Error('Captured RSS must match an existing feed');await owner.store.execute('enqueue',{kind:'ingest',subject:source.id,key:`captured-rss:${state.epoch}:${source.id}:${request.commandId}`,epoch:state.epoch,inputRevision:source.revision,configRevision:state.revision,payload:{items:JSON.parse(JSON.stringify(member.items)),observedAt:member.capturedAt,settings:JSON.parse(JSON.stringify(state.settings))},priority:100,maxAttempts:3,dueAt:Date.now()});}owner.wake();return {ok:true,revision:null};}
  @Remote('modelAuthorization') async modelAuthorization():Promise<ModelAuthorizationResult>{const owner=this.owner();await owner.ready();const authorization=await owner.store.execute('modelAuthorization',{});return authorization??{id:'',provider:'',model:'',articleIds:[],maximum:0,used:0,active:false};}
  @Remote('authorizeModels') async authorizeModels(request:ModelAuthorizationRequest):Promise<ModelAuthorizationResult>{this.requireDiagnostics(request.commandId);const owner=this.owner();await owner.ready();const authorization=await owner.store.execute('authorizeModels',{...request,now:Date.now()});await owner.reconcile();owner.wake();return authorization;}
  @Remote('browse') async browse(request:PageQuery):Promise<PageResult>{const owner=this.owner();await owner.ready();if(!(await owner.state()).state.initialized)return {items:[],total:0};return await owner.store.execute('page',request);}
  @Remote('detail') async detail(request:IdRequest):Promise<DetailResult>{const owner=this.owner();await owner.ready();return {item:await owner.store.execute('detail',request)};}
  @Remote('event') async event(request:IdRequest):Promise<StoryResult>{const owner=this.owner();await owner.ready();return {item:await owner.store.execute('story',request)};}
  @Remote('reading') async reading(request:ReadingRequest):Promise<ReadingResult>{const owner=this.owner();await owner.ready();if(!(await owner.state()).state.initialized)return {hot:[],reports:[],topics:[],events:[]};const state=await owner.store.execute('state',{});return {hot:request.view==='hot'?await owner.store.execute('heat',{compute:false,now:Date.now(),epoch:state.epoch}):[],topics:request.view==='topics'?await owner.store.execute('topics',{}):[],reports:['daily','weekly','monthly'].includes(request.view)?await owner.store.execute('reports',{kind:request.view,limit:request.limit,offset:request.offset}):[],events:request.view==='events'?await owner.store.execute('stories',{limit:request.limit,offset:request.offset}):[]};}
  @Remote('admin') async admin(request:PageRequest):Promise<AdminResult>{const owner=this.owner();await owner.ready();if(!(await owner.state()).state.initialized)return {jobs:[],receipts:[]};return {jobs:(await owner.store.execute('jobs',request)).map(job=>({id:job.id,kind:job.kind,subject:job.subject,state:job.state,attempts:job.attempts,maxAttempts:job.maxAttempts,dueAt:job.dueAt,error:job.error})),receipts:await owner.store.execute('callSummary',request)};}
  @Remote('preview') async preview(request:PreviewRequest):Promise<PreviewResult>{return await this.owner().preview(request);}
  @Remote('rerun') async rerun(request:RerunRequest):Promise<ActionResult>{const owner=this.owner();await owner.ready();const ok=await owner.store.execute('rerun',{...request,now:Date.now()});owner.wake();return {ok,revision:null};}
  @Remote('correctEditorial') async correctEditorial(request:EditorialCorrectionRequest):Promise<ActionResult>{z.string().uuid().parse(request.commandId);const owner=this.owner();await owner.ready();return {ok:await owner.store.execute('override',{...request,now:Date.now()}),revision:request.expectedRevision+1};}
  @Remote('correctEvent') async correctEvent(request:EventCorrectionRequest):Promise<ActionResult>{z.string().uuid().parse(request.commandId);z.number().int().nonnegative().parse(request.expectedRevision);const owner=this.owner();await owner.ready();const ok=await owner.store.execute('correctEvent',{...request,now:Date.now()});owner.wake();return {ok,revision:null};}
  @Remote('mergeEvents') async mergeEvents(request:EventMergeRequest):Promise<ActionResult>{z.string().uuid().parse(request.commandId);z.number().int().positive().parse(request.expectedSurvivor);z.number().int().positive().parse(request.expectedOther);z.string().trim().min(1).max(1000).parse(request.reason);const owner=this.owner();await owner.ready();return {ok:await owner.store.execute('mergeStories',{...request,now:Date.now()}),revision:null};}
  @Remote('splitEvent') async splitEvent(request:EventSplitRequest):Promise<ActionResult>{const owner=this.owner();await owner.ready();const ok=await owner.store.execute('splitStory',{...request,now:Date.now()});owner.wake();return {ok,revision:null};}
  @Remote('correctionState') async correctionState(request:IdRequest):Promise<CorrectionResult>{const owner=this.owner();await owner.ready();return {item:await owner.store.execute('correctionState',request)};}
  @Remote('mutationHistory') async mutationHistory(request:PageRequest):Promise<MutationHistory>{const owner=this.owner();await owner.ready();return {items:await owner.store.execute('mutationHistory',request)};}
  @Remote('mark') async mark(request:MarkRequest):Promise<ActionResult>{const owner=this.owner();await owner.ready();return {ok:await owner.store.execute('marks',{...request,now:Date.now()}),revision:null};}
  @Remote('credentials') async credentials():Promise<CredentialsResult>{const services=['socialdata','dajiala','jina','github','embedding','external','artificial-analysis'];const items=[];for(const service of services){const info=await this.ctx.credentials.describeRecord(credentialKey('hotstream',service));items.push({service,configured:info.configured});}return {items};}
  @Remote('setCredential') async setCredential(request:CredentialWriteRequest):Promise<ActionResult>{
    z.object({service:z.enum(['socialdata','dajiala','jina','github','embedding','external','artificial-analysis']),secret:z.string().trim().min(1).max(8192)}).strict().parse(request);
    const owner=this.owner();await owner.ready();await changeCredential(this.ctx,owner.store,request.service,request.secret);await owner.reconcile();return {ok:true,revision:null};
  }
  @Remote('deleteCredential') async deleteCredential(request:CredentialDeleteRequest):Promise<ActionResult>{
    z.object({service:z.enum(['socialdata','dajiala','jina','github','embedding','external','artificial-analysis'])}).strict().parse(request);
    const owner=this.owner();await owner.ready();await changeCredential(this.ctx,owner.store,request.service,null);await owner.reconcile();return {ok:true,revision:null};
  }
  @Remote('testMonitor') async testMonitor(request:MonitorTestRequest):Promise<MonitorTestResult>{
    z.object({commandId:z.string().uuid(),revision:z.number().int().positive(),acknowledged:z.literal(true)}).strict().parse(request);
    const owner=this.owner();await owner.ready();const credential=await this.ctx.credentials.describeRecord(credentialKey('hotstream','socialdata'));
    if(!credential.configured)throw new Error('Configure your own SocialData API Key before testing');
    const result=await owner.store.execute('monitorTestStart',{...request,now:Date.now()});owner.wake();return result;
  }
  @Remote('monitorTestResult') async monitorTestResult(request:MonitorTestReadRequest):Promise<MonitorTestResult>{const owner=this.owner();await owner.ready();return await owner.store.execute('monitorTestRead',request);}
  @Remote('moduleHealth') async moduleHealth():Promise<ModuleHealthResult>{
    const owner=this.owner();await owner.ready();const result=await owner.store.execute('moduleHealth',{});
    const social=await this.ctx.credentials.describeRecord(credentialKey('hotstream','socialdata'));
    if(result.monitor.enabled&&!social.configured){result.monitor.status='unconfigured';result.monitor.error='Monitor requires SocialData credential';}
    return result;
  }
  @Remote('refreshLeaderboard') async refreshLeaderboard(request:LeaderboardRefreshRequest):Promise<ActionResult>{const owner=this.owner();await owner.ready();await owner.store.execute('leaderboardRefresh',{...request,now:Date.now()});owner.wake();return {ok:true,revision:null};}

  @Remote('optional') async optional(request:OptionalRequest):Promise<OptionalData>{const owner=this.owner();await owner.ready();return await owner.store.execute('optionalData',request);}
  @Remote('reviewMonitor') async reviewMonitor(request:MonitorReviewRequest):Promise<ActionResult>{const owner=this.owner();await owner.ready();return {ok:await owner.store.execute('monitorReview',{...request,now:Date.now()}),revision:null};}
  @Remote('correctMonitor') async correctMonitor(request:MonitorCorrectionRequest):Promise<ActionResult>{const owner=this.owner();await owner.ready();return {ok:await owner.store.execute('monitorCorrect',{...request,now:Date.now()}),revision:null};}
  @Remote('evaluations') async evaluations(request:PageRequest):Promise<EvaluationResult>{const owner=this.owner();await owner.ready();return await owner.store.execute('evaluations',request);}
  @Remote('evaluate') async evaluate(request:EvaluationRequest):Promise<ActionResult>{z.object({commandId:z.string().uuid(),label:z.string().min(1).max(200),routes:z.array(z.object({provider:z.string().min(1),model:z.string().min(1)}).strict()).min(1).max(3),cases:z.array(z.object({id:z.string().min(1).max(120),title:z.string().min(1).max(1000),body:z.string().max(60000),url:z.string().url(),tier:z.enum(['T1','T1_5','T2','EXCLUDE_MP']),gold:z.enum(['select','discard']),publishedAt:z.number().nullable()}).strict()).min(1).max(50)}).strict().parse(request);if(new Set(request.cases.map(item=>item.id)).size!==request.cases.length||new Set(request.routes.map(route=>route.provider+'/'+route.model)).size!==request.routes.length)throw new Error('Evaluation identities must be unique');const owner=this.owner();await owner.ready();const state=await owner.store.execute('state',{});if(!state.initialized||!state.settings)throw new Error('Initialize first');await owner.store.execute('enqueue',{kind:'evaluation',subject:request.commandId,key:`evaluation:${state.epoch}:${request.commandId}`,epoch:state.epoch,inputRevision:1,configRevision:state.revision,payload:{settings:JSON.parse(JSON.stringify(state.settings)),evaluation:JSON.parse(JSON.stringify(request)),collectAt:Date.now()},priority:5,maxAttempts:3,dueAt:Date.now()});owner.wake();return {ok:true,revision:null};}
  @Remote('callDetail') async callDetail(request:CallDetailRequest):Promise<CallDetailResult>{z.object({id:z.string().min(1),attempt:z.number().int().positive().nullable(),limit:z.number().int().min(1).max(50),offset:z.number().int().nonnegative()}).strict().parse(request);const owner=this.owner();await owner.ready();const detail=await owner.store.execute('callAttempts',request);const secrets:string[]=[];for(const service of ['socialdata','dajiala','jina','github','embedding','external','artificial-analysis']){const record=await this.ctx.credentials.readRecord(credentialKey('hotstream',service));if(record?.kind==='api-key'&&record.key)secrets.push(record.key);}const redact=(value:unknown):unknown=>{if(typeof value==='string'){let text=value;for(const secret of secrets)text=text.split(secret).join('[redacted]');return text;}if(Array.isArray(value))return value.map(redact);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,/authorization|api[-_]?key|password|cookie|secret/i.test(key)?'[redacted]':redact(item)]));return value;};return redact(detail) as CallDetailResult;}
  @Remote('confirmUnknown') async confirmUnknown(request:ConfirmUnknownRequest):Promise<ActionResult>{z.object({id:z.string().min(1),attempt:z.number().int().positive(),commandId:z.string().uuid(),outcome:z.enum(['billed','not-billed']),reason:z.string().trim().min(1).max(1000),cost:z.number().finite().nonnegative().nullable(),currency:z.string().min(1).max(12).nullable()}).strict().parse(request);const owner=this.owner();await owner.ready();return {ok:await owner.store.execute('confirmUnknown',{...request,now:Date.now()}),revision:null};}
  @Remote('confirmRetry') async confirmRetry(request:RetryRequest):Promise<ActionResult>{z.object({id:z.string().min(1),attempt:z.number().int().positive(),commandId:z.string().uuid(),acknowledged:z.literal(true)}).strict().parse(request);const owner=this.owner();await owner.ready();const ok=await owner.store.execute('confirmRetry',{...request,now:Date.now()});owner.wake();return {ok,revision:null};}
  @Remote('uiMonitor') async uiMonitor(request:UiMonitorRequest,signal:AbortSignal):Promise<UiMonitorResult>{uiOperationSchemas.uiMonitor.parse(request);const owner=this.owner();await owner.ready();signal.throwIfAborted();const result=await owner.store.execute('uiMonitor',request);signal.throwIfAborted();return result;}
  @Remote('uiArticle') async uiArticle(request:UiArticleRequest,signal:AbortSignal):Promise<UiArticleResult>{uiOperationSchemas.uiArticle.parse(request);const owner=this.owner();await owner.ready();signal.throwIfAborted();const result=await owner.store.execute('uiArticle',request);signal.throwIfAborted();return result;}
  @Remote('uiFeed') async uiFeed(request:UiFeedRequest):Promise<UiFeedResult>{uiOperationSchemas.uiFeed.parse(request);const owner=this.owner();await owner.ready();return owner.store.execute('uiFeed',request);}
  @Remote('uiGroups') async uiGroups(request:UiGroupRequest):Promise<UiGroupResult>{uiOperationSchemas.uiGroups.parse(request);const owner=this.owner();await owner.ready();return owner.store.execute('uiGroups',request);}
  @Remote('uiReportIndex') async uiReportIndex(request:UiReportIndexRequest):Promise<UiReportIndexResult>{uiOperationSchemas.uiReportIndex.parse(request);const owner=this.owner();await owner.ready();return owner.store.execute('uiReportIndex',request);}
  @Remote('uiReport') async uiReport(request:UiReportRequest):Promise<UiReportResult>{uiOperationSchemas.uiReport.parse(request);const owner=this.owner();await owner.ready();return owner.store.execute('uiReport',request);}
  @Remote('report') async report(request:IdRequest):Promise<ReportResult>{const owner=this.owner();await owner.ready();if(!(await owner.state()).state.initialized)return {item:null,revisions:[]};return {item:await owner.store.execute('report',request),revisions:await owner.store.execute('reportRevisions',request)};}
  @Remote('compileHistory') async compileHistory(request:CompileHistoryRequest):Promise<CompileHistoryResult>{z.object({commandId:z.string().uuid(),revision:z.number().int().positive(),acknowledged:z.literal(true)}).strict().parse(request);const owner=this.owner();await owner.ready();const result=await owner.store.execute('compileHistory',{...request,now:Date.now()});owner.wake();return result;}
  @Remote('regenerateReport') async regenerateReport(request:RegenerateReportRequest):Promise<ActionResult>{z.object({id:z.string().min(1),commandId:z.string().uuid(),expectedRevision:z.number().int().positive(),reason:z.string().trim().min(1).max(1000),acknowledged:z.literal(true)}).strict().parse(request);const owner=this.owner();await owner.ready();const ok=await owner.store.execute('reportRegenerate',{id:request.id,commandId:request.commandId,expectedRevision:request.expectedRevision,reason:request.reason,now:Date.now()});owner.wake();return {ok,revision:null};}
  @Remote('preferences') async preferences():Promise<PreferenceResult>{const owner=this.owner();await owner.ready();return (await owner.state()).state.initialized?await owner.store.execute('preferenceGet',{}):{revision:0,values:{}};}
  @Remote('savePreferences') async savePreferences(request:PreferenceRequest):Promise<PreferenceResult>{const owner=this.owner();await owner.ready();if(!(await owner.state()).state.initialized)throw new Error('Initialize first');return await owner.store.execute('preferenceSave',{...request,now:Date.now()});}
  @Remote('models') async models():Promise<CatalogResult>{const providers=[];for(const provider of this.ctx.llm.listProviders()){try{const models=await this.ctx.llm.listModels(provider.id);providers.push({id:provider.id,name:provider.name,models:models.map(model=>({id:model.id,name:model.name,image:model.inputModalities?.includes('image')??false})),error:null});}catch(error){providers.push({id:provider.id,name:provider.name,models:[],error:error instanceof Error?error.message:'Model catalog unavailable'});}}return {providers};}
  @Remote('diagnostics') async diagnostics():Promise<DiagnosticsResult>{const owner=this.owner();await owner.ready();const state=(await owner.state()).state;const bytes=async(path:string)=>{try{return (await stat(path)).size;}catch{return 0;}};const external=owner.externalState();return {resources:owner.resources(),databaseBytes:await bytes(owner.databasePath()),walBytes:await bytes(owner.databasePath()+'-wal'),schemaVersion:state.schemaVersion,sourceCount:state.sourceCount,externalPort:external.port,externalError:external.error};}
  @Remote('chronicle') async chronicle(request:IdRequest):Promise<ChronicleResult>{const owner=this.owner();await owner.ready();return await owner.store.execute('chronicle',{...request,now:Date.now()});}
  private requireDiagnostics(requestId: string): void {
    if (!this.options.diagnosticsEnabled) {
      throw new RemoteError('hotstream/diagnostics-disabled', 'M0 diagnostics require explicit test configuration', { milestone: 'M0' });
    }
    if (this.stopping !== undefined) throw new RemoteError('hotstream/stopping', 'Hotstream is stopping', { requestId });
  }

  private async callOnce(requestId: string): Promise<ModelProbe> {
    const prepared = await this.ctx.llm.prepareCall({ provider: M0_PROVIDER, model: M0_MODEL, maxTokens: 48 }, this.lifetime.signal);
    const messages = [createUserMessage({ content: [{ type: 'text', text: 'M0 integration diagnostic. Reply with the configured probe token.' }], source: { kind: 'user' } })];
    const request = deepFreeze({ requestId, provider: prepared.config.provider, model: prepared.config.model, messages, system: 'A deterministic in-process integration diagnostic.', maxTokens: 48 });
    const audit = await this.audit.request(request);
    this.lifetime.signal.throwIfAborted();
    const options: GenerateOptions = deepFreeze({ ...prepared.config, messages, system: request.system, sessionId: audit.handle.id, signal: this.lifetime.signal });
    const chunks: StreamChunk[] = [];
    const assembler = new BlockAssembler();
    this.modelRequests += 1;
    for await (const chunk of prepared.stream(options)) { chunks.push(chunk); assembler.push(chunk); }
    await this.audit.settle(audit, requestId, chunks);
    if (assembler.finish?.kind !== 'stop') throw new Error('M0 model probe did not finish successfully');
    const blocks = assembler.blocks();
    if (blocks.some(block => block.type === 'tool-call')) throw new Error('Auxiliary output must not invoke tools');
    const text = blocks.filter(block => block.type === 'text').map(block => block.text).join('');
    const result: ModelProbe = {
      requestId, sessionId: audit.sessionId, provider: request.provider, model: request.model, text,
      inputTokens: 8, outputTokens: 4, requestDurable: true, settlementDurable: true,
    };
    this.lastModel = result;
    return result;
  }

  /** Quiesce calls before closing their audit backend. The bundle then closes SQLite. */
  close(): Promise<void> {
    return this.stopping ??= (async () => {
      this.lifetime.abort(new Error('Hotstream plugin disposed'));
      await Promise.allSettled([...this.active]);
      this.mediaCache.clear();this.mediaCacheCharacters=0;
      await this.business?.close();
      await this.audit.close();
    })();
  }
}

export { CallCoordinator,CallBlockedError,InvalidModelOutput,parseJson } from './calls.ts';
export { SourceCollectors } from './sources/collect.ts';
export { NewsPipeline } from './pipeline.ts';
export { PublicNetwork } from './network.ts';
export { defaultSources,defaultTopics } from './seeds.ts';

export {LeaderboardComputer} from './leaderboard/compute.ts';

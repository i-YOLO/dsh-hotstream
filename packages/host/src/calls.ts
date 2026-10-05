/** Durable calls: immutable dispatch, one counted attempt, response-first commit and repairable audit. */
import type {ImageAttachmentRef,ImageMediaType} from '@deepseek-ai/dsh-attachment';
import type {PublicNetwork} from './network.ts';
import type {Context} from '@deepseek-ai/cordis';
import {optionalJobModule} from 'dsh-hotstream-contracts';
import {BlockAssembler,MessageId,createUserMessage,type GenerateOptions,type StreamChunk,type PreparedLlmCall,type LlmCallConfig} from '@deepseek-ai/dsh-llm';
import {deepFreeze} from '@deepseek-ai/dsh-util-values';
import {z} from 'zod';
import {sha256,stableJson} from 'dsh-hotstream-core';
import {jsonSchema,jsonObjectSchema,type HotstreamStore,type DurableJob,type Json,type RuntimeSettings,type Receipt} from 'dsh-hotstream-contracts/runtime';
import {AuxiliaryAudit,type AuditedRequest} from './audit.ts';
export class CallBlockedError extends Error {constructor(message:string,readonly retryAt:number|null){super(message);}}
export class InvalidModelOutput extends Error {}
export interface ModelInput {imageUrl?:string;context?:Record<string,Json>;stage:string;system:string;user:string;maxTokens:number;temperature:number;json:boolean;}
export interface ModelAnswer {text:string;receiptId:string;provider:string;model:string;promptHash:string;reused:boolean;context:Record<string,Json>|null;}
const asObject=(value:unknown):Record<string,Json>=>jsonObjectSchema.parse(JSON.parse(JSON.stringify(value)));
export class CallCoordinator {
 private readonly audits:AuxiliaryAudit;
 private readonly active=new Set<Promise<unknown>>();
 private readonly running=new Map<string,Promise<ModelAnswer>>();
 private readonly jobSignals=new Map<string,AbortSignal>();
 private readonly jobNetworks=new Map<string,PublicNetwork>();
 private closed=false;
 private models=0;
 private readonly waiters=new Set<()=>void>();
 constructor(private readonly ctx:Context,private readonly store:HotstreamStore,auditRoot:string,private readonly signal:AbortSignal,private readonly network?:PublicNetwork){this.audits=new AuxiliaryAudit(auditRoot);}
 /** A process-local task signal is never part of a wire DTO or frozen request. */
 bindJob(id:string,signal:AbortSignal,network?:PublicNetwork):()=>void{this.jobSignals.set(id,signal);if(network)this.jobNetworks.set(id,network);return ()=>{this.jobSignals.delete(id);this.jobNetworks.delete(id);};}
 private signalFor(job:DurableJob):AbortSignal{const task=this.jobSignals.get(job.id);return task?AbortSignal.any([this.signal,task]):this.signal;}
 private async acquire(job:DurableJob,signal:AbortSignal):Promise<()=>void>{
  for(;;){signal.throwIfAborted();const state=await this.store.execute('state',{});const cap=state.settings?.concurrency.model??2;if(this.models<cap){this.models++;break;}
   await new Promise<void>((resolve,reject)=>{const ready=()=>{this.waiters.delete(ready);signal.removeEventListener('abort',abort);resolve();};const abort=()=>{this.waiters.delete(ready);reject(signal.reason);};this.waiters.add(ready);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
  }
  return ()=>{this.models--;for(const ready of [...this.waiters])ready();};
 }
 model(job:DurableJob,settings:RuntimeSettings,input:ModelInput):Promise<ModelAnswer>{
  const key=`model:${job.epoch}:${job.key}:${input.stage}`;const existing=this.running.get(key);if(existing)return existing;
  const task=this.callModel(key,job,settings,input);this.running.set(key,task);this.active.add(task);
  void task.then(()=>{this.active.delete(task);this.running.delete(key);},()=>{this.active.delete(task);this.running.delete(key);});return task;
 }
 private async repair(receipt:Receipt):Promise<void>{
  if(receipt.auditRef&&Array.isArray(receipt.response)){
   const attempts=await this.store.execute('receiptAttempts',{id:receipt.id,limit:100,offset:0});const attempt=attempts.find(a=>a.attempt===receipt.attempt);
   if(attempt?.auditSettled)return;
   await this.audits.repair(receipt.auditRef,`${receipt.id}-a${receipt.attempt}`,receipt.response as unknown as StreamChunk[]);
   await this.store.execute('auditComplete',{id:receipt.id,attempt:receipt.attempt,epoch:receipt.epoch});
  }
 }
 /** Recovery only writes missing audit events; it cannot reserve or dispatch. */
 async repairAudits():Promise<void>{
  for(let offset=0;;){let restored=0;const attempts=await this.store.execute('auditRecoverable',{limit:100,offset});if(!attempts.length)break;
   for(const attempt of attempts){if(!attempt.auditRef)continue;const chunks=await this.audits.settlement(attempt.auditRef,`${attempt.receiptId}-a${attempt.attempt}`);if(!chunks)continue;
    const usage:Record<string,Json>={};for(const chunk of chunks)if(chunk.type==='usage')Object.assign(usage,asObject(chunk.usage));
    await this.store.execute('restoreResponse',{id:attempt.receiptId,attempt:attempt.attempt,epoch:attempt.epoch,response:jsonSchema.parse(JSON.parse(JSON.stringify(chunks))),usage,now:Date.now()});restored++;
   }if(restored)continue;if(attempts.length<100)break;offset+=100;
  }
  for(;;){const pending=await this.store.execute('auditPending',{limit:100});if(!pending.length)return;let progress=0;for(const attempt of pending){
   if(!attempt.auditRef||!Array.isArray(attempt.response))continue;
   await this.audits.repair(attempt.auditRef,`${attempt.receiptId}-a${attempt.attempt}`,attempt.response as unknown as StreamChunk[]);
   await this.store.execute('auditComplete',{id:attempt.receiptId,attempt:attempt.attempt,epoch:attempt.epoch});progress++;
  }if(!progress)return;}
 }
 private async callModel(key:string,job:DurableJob,settings:RuntimeSettings,input:ModelInput):Promise<ModelAnswer>{
  if(this.closed)throw new Error('Hotstream model executor is closed');const signal=this.signalFor(job);signal.throwIfAborted();
  if(job.leaseOwner!==null)input=await this.store.execute('freezeJob',{jobId:job.id,owner:job.leaseOwner,epoch:job.epoch,now:Date.now(),stage:sha256(key),request:asObject(input)}) as unknown as ModelInput;
  const previous=await this.store.execute('findReceipt',{key});
  if(previous?.epoch===job.epoch){await this.store.execute('linkReceipt',{id:previous.id,jobId:job.id});
   if(previous.state==='received'||previous.state==='completed'){await this.repair(previous);await this.classifyTerminal(previous);return this.answer(previous,input,true);}
   if(['pending','unknown','reserved'].includes(previous.state))throw new CallBlockedError(previous.state==='unknown'?'unknown-result':'active-request',previous.state==='unknown'&&previous.automaticReleases===0?previous.updatedAt+1800000:null);
  }
  await this.requireModule(job);
  const release=await this.acquire(job,signal);
  let receipt:Receipt|undefined;let sent=false;let received=false;
  try{
   let plan=await this.store.execute('dispatchPlan',{key});let prepared:PreparedLlmCall;
   if(plan){
    prepared=await this.ctx.llm.prepareCall(plan.config as unknown as LlmCallConfig,signal);
    if(stableJson(prepared.config)!==stableJson(plan.config))throw new CallBlockedError('Frozen route parameters are no longer available',null);
    if(plan.imagePolicy==='image'&&!prepared.inputModalities?.includes('image'))throw new CallBlockedError('Frozen image route is no longer available',null);
   }else{
    const stage=input.stage.split(':')[0]!;const group=stage.startsWith('group')||stage.startsWith('story-merge')?'group':stage.startsWith('report')?'report':stage.replace(/\d+$/,'');const route=settings.model.stageOverrides[stage]??settings.model.stageOverrides[group]??settings.model;
    const authorization=await this.store.execute('modelAuthorization',{});prepared=await this.ctx.llm.prepareCall({provider:route.provider,model:route.model,maxTokens:input.maxTokens,temperature:input.temperature,...authorization?.active||route.provider==='deepseek-account'&&route.model==='deepseek-flash'?{reasoningEffort:'off' as import('@deepseek-ai/dsh-llm').ReasoningEffortId}:{}},signal);
    let image:ImageAttachmentRef|undefined;const network=this.jobNetworks.get(job.id)??this.network;
    if(input.imageUrl&&network&&this.ctx.get('attachments')&&prepared.inputModalities?.includes('image')){
     try{const response=await network.fetch(input.imageUrl,{signal,maxBytes:8*1024*1024,timeoutMs:20000});const type=response.headers.get('content-type')?.split(';')[0];if(response.status===200&&type&&['image/png','image/jpeg','image/webp','image/gif'].includes(type))image=await this.ctx.attachments.saveImage({data:response.body,mediaType:type as ImageMediaType,name:'hotstream-evidence'});}
     catch(error){if(signal.aborted)throw error;}
    }
    const messages=[{...createUserMessage({content:[{type:'text',text:input.user},...image?[{type:'image' as const,attachment:image}]:[]],source:{kind:'user'}}),id:MessageId('hotstream-'+sha256(key))}];
    const dispatch=asObject({...prepared.config,messages,system:input.system,tools:[]});
    plan=await this.store.execute('freezeDispatch',{key,epoch:job.epoch,jobId:job.leaseOwner?job.id:null,owner:job.leaseOwner,now:Date.now(),request:{config:asObject(prepared.config),dispatch,imagePolicy:image?'image':'text',input:asObject(input)}});
   }
   input=plan.input as unknown as ModelInput;
   const serialized=plan.dispatch as Record<string,Json>;const dispatch=deepFreeze(serialized) as unknown as GenerateOptions;
   const reservation=await this.store.execute('reserve',{jobId:job.id,key,service:'llm',epoch:job.epoch,requestHash:sha256(stableJson(serialized)),request:{...serialized,stage:input.stage,inputRevision:job.inputRevision,configRevision:job.configRevision,context:input.context??null},now:Date.now()});
   if(reservation.reusable&&reservation.receipt){await this.repair(reservation.receipt);await this.classifyTerminal(reservation.receipt);return this.answer(reservation.receipt,input,true);}
   if(!reservation.admitted||!reservation.receipt)throw new CallBlockedError(reservation.blockedReason??'Request unavailable',reservation.retryAt);
   receipt=reservation.receipt;
   const request:AuditedRequest={requestId:`${receipt.id}-a${receipt.attempt}`,provider:prepared.config.provider,model:prepared.config.model,messages:dispatch.messages,system:input.system,maxTokens:Number(prepared.config.maxTokens??input.maxTokens),resolvedConfig:serialized,stage:input.stage};
   await this.requireModule(job);signal.throwIfAborted();
   const audit=await this.audits.request(request);signal.throwIfAborted();
   if(!await this.store.execute('sent',{id:receipt.id,attempt:receipt.attempt,epoch:job.epoch,auditRef:audit.sessionId,now:Date.now()}))throw new Error('Reservation expired before dispatch');sent=true;
   const chunks:StreamChunk[]=[];for await(const chunk of prepared.stream(deepFreeze({...dispatch,sessionId:audit.handle.id,signal})))chunks.push(chunk);
   const raw=jsonSchema.parse(JSON.parse(JSON.stringify(chunks)));const usage:Record<string,Json>={};for(const chunk of chunks)if(chunk.type==='usage')Object.assign(usage,asObject(chunk.usage));
   try{if(!await this.store.execute('receive',{id:receipt.id,attempt:receipt.attempt,epoch:job.epoch,response:raw,usage,now:Date.now()}))throw new Error('Response receipt was not committed');}
   catch(error){await this.audits.settle(audit,request.requestId,chunks).catch(()=>{});await this.store.execute('archiveResponse',{id:receipt.id,attempt:receipt.attempt,epoch:job.epoch,response:raw,usage,now:Date.now()}).catch(()=>{});throw error;}
   received=true;
   await this.audits.settle(audit,request.requestId,chunks);
   await this.store.execute('auditComplete',{id:receipt.id,attempt:receipt.attempt,epoch:job.epoch});
   signal.throwIfAborted();await this.requireModule(job);
   await this.classifyTerminal({...receipt,state:'received',response:raw,usage,auditRef:audit.sessionId});
   return this.answer({...receipt,state:'received',response:raw,usage,auditRef:audit.sessionId},input,false);
  }catch(error){
   if(receipt&&!received)await this.store.execute('settle',{id:receipt.id,attempt:receipt.attempt,epoch:job.epoch,now:Date.now(),state:sent&&!explicitRejection(error)?'unknown':'failed',error:sent?'Dispatch interrupted or rejected':'Dispatch not started'}).catch(()=>{});
   throw error;
  }finally{release();}
 }
 private async classifyTerminal(receipt:Receipt):Promise<void>{if(!Array.isArray(receipt.response))return;const terminal=(receipt.response as unknown as StreamChunk[]).filter(chunk=>chunk.type==='finish').at(-1);if(terminal?.type==='finish'&&(terminal.reason.kind==='error'||terminal.reason.kind==='aborted')){const failure=terminal.reason.failure;const rejected=typeof failure.status==='number'&&failure.status>=400||['AUTH','NO_ADAPTER','INVALID_CONFIG'].includes(failure.code);await this.store.execute('settle',{id:receipt.id,attempt:receipt.attempt,epoch:receipt.epoch,state:rejected?'failed':'unknown',error:`${failure.code}: ${failure.message}`,now:Date.now()});if(['AUTH','NO_ADAPTER','INVALID_CONFIG'].includes(failure.code))throw new CallBlockedError(failure.message,null);throw Object.assign(new Error(failure.message),{status:failure.status,code:failure.code});}}
 private answer(receipt:Receipt,input:ModelInput,reused:boolean):ModelAnswer{
  if(!Array.isArray(receipt.response))throw new InvalidModelOutput('Stored response has no stream');const assembler=new BlockAssembler();for(const chunk of receipt.response)assembler.push(chunk as unknown as StreamChunk);
  const blocks=assembler.blocks();if(blocks.some(b=>b.type==='tool-call'))throw new InvalidModelOutput('Auxiliary model attempted a tool call');if(assembler.finish?.kind!=='stop')throw new InvalidModelOutput('Auxiliary model did not finish successfully');
  return {text:blocks.filter(b=>b.type==='text').map(b=>b.text).join(''),receiptId:receipt.id,provider:String(receipt.request.provider),model:String(receipt.request.model),promptHash:sha256(input.system+'\u0001'+input.user),reused,context:receipt.request.context&&typeof receipt.request.context==='object'&&!Array.isArray(receipt.request.context)?receipt.request.context as Record<string,Json>:null};
 }
 async paid(job:DurableJob,service:string,identity:Record<string,Json>,dispatch:()=>Promise<{response:Json;usage:Record<string,Json>}>):Promise<{response:Json;receiptId:string;attempt:number;reused:boolean}>{
  if(this.closed)throw new Error('Hotstream call executor is closed');await this.requireModule(job);const signal=this.signalFor(job);signal.throwIfAborted();
  const request={service,...identity};const hash=sha256(stableJson(request));const key=`paid:${job.epoch}:${service}:${job.subject}:${hash}`;
  const reservation=await this.store.execute('reserve',{jobId:job.id,key,service,epoch:job.epoch,requestHash:hash,request,now:Date.now()});
  if(reservation.reusable&&reservation.receipt)return {response:reservation.receipt.response,receiptId:reservation.receipt.id,attempt:reservation.receipt.attempt,reused:true};
  if(!reservation.admitted||!reservation.receipt)throw new CallBlockedError(reservation.blockedReason??'Request unavailable',reservation.retryAt);
  const receipt=reservation.receipt;
  const execute=(async()=>{let sent=false;let received=false;try{
   signal.throwIfAborted();await this.requireModule(job);
   if(!await this.store.execute('sent',{id:receipt.id,attempt:receipt.attempt,epoch:job.epoch,auditRef:`paid/${receipt.id}/${receipt.attempt}`,now:Date.now()}))throw new Error('Paid reservation expired');sent=true;
   const answer=await dispatch();
   try{if(!await this.store.execute('receive',{id:receipt.id,attempt:receipt.attempt,epoch:job.epoch,response:answer.response,usage:answer.usage,now:Date.now()}))throw new Error('Paid response not committed');}
   catch(error){await this.store.execute('archiveResponse',{id:receipt.id,attempt:receipt.attempt,epoch:job.epoch,response:answer.response,usage:answer.usage,now:Date.now()}).catch(()=>{});throw error;}
   received=true;signal.throwIfAborted();await this.requireModule(job);return {response:answer.response,receiptId:receipt.id,attempt:receipt.attempt,reused:false};
  }catch(error){if(!received)await this.store.execute('settle',{id:receipt.id,attempt:receipt.attempt,epoch:job.epoch,state:sent&&!explicitRejection(error)?'unknown':'failed',error:sent?'Paid dispatch interrupted or rejected':'Paid dispatch not started',now:Date.now()}).catch(()=>{});throw error;}})();
  this.active.add(execute);try{return await execute;}finally{this.active.delete(execute);}
 }
 private async requireModule(job:DurableJob):Promise<void>{
  this.signalFor(job).throwIfAborted();const state=await this.store.execute('state',{});if(state.epoch!==job.epoch||!state.initialized||state.deleting)throw new CallBlockedError('Stale Hotstream runtime epoch',null);
  const module=optionalJobModule(job.kind);if(!module)return;
  const enabled=module==='monitor'?state.settings?.features.codexResetMonitor:state.settings?.features.leaderboard;
  const generation=state.moduleGenerations[module];if(job.kind!=='monitor-test'&&!enabled||typeof job.payload.moduleGeneration==='number'&&generation!==job.payload.moduleGeneration)throw new CallBlockedError('Optional module disabled or replaced',null);
 }
 resources():Record<string,number>{return {activeCalls:this.active.size,semaphoreWaiters:this.waiters.size,auditWriters:this.audits.resources()};}
 async close():Promise<void>{this.closed=true;for(const ready of [...this.waiters])ready();await Promise.allSettled([...this.active]);await this.audits.close();this.running.clear();this.jobSignals.clear();}
}
function explicitRejection(error:unknown):boolean{if(error===null||typeof error!=='object')return false;const status='status' in error?Number(error.status):'statusCode' in error?Number(error.statusCode):NaN;return Number.isInteger(status)&&status>=400&&status<600;}
export function parseJson<T>(text:string,schema:z.ZodType<T>):T{const clean=text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');return schema.parse(JSON.parse(clean));}

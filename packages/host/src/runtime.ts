/** One wake timer and awaited owner; task/module cancellation never aborts unrelated business work. */
import type {Context} from '@deepseek-ai/cordis';
import {optionalJobModule} from 'dsh-hotstream-contracts';
import type {} from '@deepseek-ai/dsh-jobs';
import {randomUUID} from 'node:crypto';
import {settingsSchema,type DurableJob,type HotstreamStore,type StorageOperation,type StorageOperations,type RuntimeState,type Source} from 'dsh-hotstream-contracts/runtime';
import {CallCoordinator,CallBlockedError} from './calls.ts';
import {PublicNetwork} from './network.ts';
import {SourceCollectors,redactError} from './sources/collect.ts';
import {NewsPipeline} from './pipeline.ts';
import {LeaderboardModule} from './leaderboard/manager.ts';
import {MonitorModule} from './monitor/module.ts';
import {EmbeddingAdapter} from './embedding.ts';
import {SelectionEvaluator} from './evaluation.ts';
import {ExternalInput} from './external.ts';
import {ReportComposer} from './reports.ts';
declare module '@deepseek-ai/dsh-jobs/view' {interface JobKindMap {hotstream:'hotstream';}}
interface ActiveJob {job:DurableJob;task:Promise<void>;lane:string;control:AbortController;}
const moduleWrites=new Set<StorageOperation>(['lbSeed','lbSnapshot','lbCalibration','lbRun','moduleStatus','monitorPosts','monitorApply']);
export class BusinessRuntime {
 private readonly lifetime=new AbortController();
 private readonly network=new PublicNetwork(this.lifetime.signal);
 readonly calls:CallCoordinator;
 private readonly previews=new Set<Promise<unknown>>();
 private readonly publicNetworks=new Set<PublicNetwork>();
 private openPublicNetwork(signal:AbortSignal,network:PublicNetwork,proxyUrl:string|null):PublicNetwork{const value=PublicNetwork.forPublicReads(signal,network,proxyUrl);if(proxyUrl)this.publicNetworks.add(value);return value;}
 private async closePublicNetwork(network:PublicNetwork):Promise<void>{try{await network.close();}finally{this.publicNetworks.delete(network);}}
 private readonly networks=new Map<string,PublicNetwork>();
 private networkFor(mode:'system'|'public-doh'):PublicNetwork{if(mode==='system')return this.network;let network=this.networks.get(mode);if(!network){network=PublicNetwork.create(this.lifetime.signal,mode);this.networks.set(mode,network);}return network;}
 private readonly reports:ReportComposer;
 private readonly evaluator:SelectionEvaluator;
 private readonly owner=randomUUID();
 private readonly active=new Map<string,ActiveJob>();
 private timer:ReturnType<typeof setTimeout>|undefined;
 private ticking:Promise<void>|undefined;
 private closing:Promise<void>|undefined;
 private readonly detachJobs:(()=>void)|undefined;
 private readonly external:ExternalInput;
 private lastReports=0;
 private lastHeat=0;
 private lastMaintenance=0;
 private fault:string|null=null;
 private storagePaused=false;
 private pauseStorage(error:unknown):void{this.storagePaused=true;this.fault=redactError(error);if(this.timer)clearTimeout(this.timer);this.timer=undefined;for(const active of this.active.values())active.control.abort(new Error('Storage is unavailable; new work is paused'));}
 constructor(private readonly ctx:Context,private readonly store:HotstreamStore,auditRoot:string){
  this.calls=new CallCoordinator(ctx,store,auditRoot,this.lifetime.signal,this.network);
  this.reports=new ReportComposer(store,this.calls);this.evaluator=new SelectionEvaluator(store,this.calls);
  this.external=new ExternalInput(ctx,store,()=>this.wake());
  this.detachJobs=ctx.get('jobs')?ctx.jobs.attachController('hotstream'):undefined;
 }
 error():string|null{return this.fault;}
 resources():Record<string,number>{return {businessTimers:this.timer?1:0,activeJobs:this.active.size,networkOwners:1+this.networks.size+this.publicNetworks.size,activePreviews:this.previews.size,...this.calls.resources()};}
 externalState(){return this.external.state();}
 async start():Promise<void>{await this.store.execute('recover',{now:Date.now(),startup:true});await this.calls.repairAudits();await this.reconcile();this.wake();}
 async reconcile(state?:RuntimeState):Promise<void>{
  state??=await this.store.execute('state',{});
  for(const active of this.active.values()){
   const job=active.job,module=optionalJobModule(job.kind),test=job.kind==='monitor-test';
   if(state.epoch!==job.epoch||state.deleting||module&&((!test&&!(module==='monitor'?state.settings?.features.codexResetMonitor:state.settings?.features.leaderboard))||job.payload.moduleGeneration!==state.moduleGenerations[module]))active.control.abort(new Error('Task or module generation was cancelled'));
  }
  await this.external.sync();
 }
 wake():void{if(this.lifetime.signal.aborted||this.storagePaused)return;if(this.timer)clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=undefined;void this.tick().catch(error=>{if((error as {code?:string}).code==='HOTSTREAM_STORAGE_UNAVAILABLE')this.pauseStorage(error);else{this.fault=redactError(error);this.schedule(60000);}});},0);}
 private schedule(delay:number):void{if(this.lifetime.signal.aborted||this.storagePaused)return;if(this.timer)clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=undefined;void this.tick().catch(error=>{if((error as {code?:string}).code==='HOTSTREAM_STORAGE_UNAVAILABLE')this.pauseStorage(error);else{this.fault=redactError(error);this.schedule(60000);}});},Math.min(60000,Math.max(1000,delay)));}
 private tick():Promise<void>{return this.ticking??=(async()=>{
  if(this.lifetime.signal.aborted)return;const state=await this.store.execute('state',{});if(!state.initialized||!state.settings||state.deleting)return;
  await this.reconcile(state);const now=Date.now();await this.store.execute('recover',{now,startup:false});
  for(const {job}of this.active.values())await this.store.execute('renew',{id:job.id,owner:this.owner,epoch:job.epoch,now,leaseMs:600000});
  await this.store.execute('schedule',{now});
  if(state.settings.features.leaderboard){const slot=Math.floor((now+8*3600000-125*60000)/(6*3600000));await this.store.execute('enqueue',{kind:'leaderboard',subject:'leaderboard',key:`leaderboard:${state.epoch}:${slot}:g${state.moduleGenerations.leaderboard}`,epoch:state.epoch,inputRevision:0,configRevision:state.revision,payload:{settings:JSON.parse(JSON.stringify(state.settings)),collectAt:now},priority:20,maxAttempts:3,dueAt:now});}
  if(state.settings.features.codexResetMonitor){const slot=Math.floor(now/600000);const bj=new Date(now+8*3600000).toISOString();for(const lookback of [false,...bj.slice(11,16)==='04:40'?[true]:[]])await this.store.execute('enqueue',{kind:'monitor',subject:'monitor',key:`monitor:${state.epoch}:${slot}:${lookback}:g${state.moduleGenerations.monitor}`,epoch:state.epoch,inputRevision:0,configRevision:state.revision,payload:{settings:JSON.parse(JSON.stringify(state.settings)),collectAt:now,lookback},priority:50,maxAttempts:3,dueAt:now});}
  if(now-this.lastReports>=1800000){await this.reports.due(state.epoch,state.revision,state.settings,now);this.lastReports=now;}
  if(now-this.lastHeat>=300000){await this.store.execute('heat',{now,epoch:state.epoch,compute:true});this.lastHeat=now;}
  if(now-this.lastMaintenance>=3600000){await this.store.execute('maintenance',{now});this.lastMaintenance=now;}
  for(const [lane,kinds,cap]of [['collect',['collect','collect-shard','extract','ingest'],state.settings.concurrency.collect],['model',['prefilter','score1','score2','structure','writing','translate','digest','evaluation'],state.settings.concurrency.model],['report',['report'],1],['group',['group'],1],['optional',['leaderboard','monitor'],1],['integration-test',['monitor-test'],1]] as const){
   let occupied=[...this.active.values()].filter(v=>v.lane===lane).length;
   while(occupied<cap&&!this.lifetime.signal.aborted){const job=await this.store.execute('claim',{kinds:[...kinds],owner:this.owner,now:Date.now(),leaseMs:600000});if(!job)break;const control=new AbortController();const task=this.execute(job,control);this.active.set(job.id,{job,task,lane,control});occupied++;const done=()=>{this.active.delete(job.id);this.wake();};void task.then(done,done);}
  }
  const next=await this.store.execute('nextWake',{});this.schedule(next.at===null?60000:next.at-Date.now());
 })().finally(()=>{this.ticking=undefined;});}
 private moduleStore(job:DurableJob):HotstreamStore{
  return {execute:<K extends StorageOperation>(operation:K,input:StorageOperations[K]['input'])=>this.store.execute(operation,moduleWrites.has(operation)?{...input,generation:job.payload.moduleGeneration,...job.kind==='monitor-test'?{testJobId:job.id}:{}} as StorageOperations[K]['input']:input),close:async()=>{}};
 }
 async preview(job:DurableJob,source:Source){
  this.lifetime.signal.throwIfAborted();const settings=settingsSchema.parse(job.payload.settings),direct=this.networkFor(settings.network.dnsMode),publicNetwork=this.openPublicNetwork(this.lifetime.signal,direct,settings.network.publicProxyUrl);
  const task=new SourceCollectors(this.ctx,direct,this.calls,this.store,publicNetwork).collect(job,source,true).finally(()=>this.closePublicNetwork(publicNetwork));this.previews.add(task);
  try{return await task;}finally{this.previews.delete(task);}
 }
 private execute(job:DurableJob,control:AbortController):Promise<void>{
  const signal=AbortSignal.any([this.lifetime.signal,control.signal]);const settings=settingsSchema.parse(job.payload.settings);const network=this.networkFor(settings.network.dnsMode).fork(signal);const publicNetwork=this.openPublicNetwork(signal,network,settings.network.publicProxyUrl);const unbind=this.calls.bindJob(job.id,signal,publicNetwork);
  const module=optionalJobModule(job.kind);const store=module?this.moduleStore(job):this.store;
  const leaderboard=module==='leaderboard'?new LeaderboardModule(this.ctx,store,network,this.calls,signal,publicNetwork):undefined;
  let failed=false;
  const task=(async()=>{try{
   if(job.kind==='evaluation'){await this.evaluator.run(job);await this.store.execute('finish',{id:job.id,owner:this.owner,epoch:job.epoch,now:Date.now(),result:{evaluated:true}});}
   else if(module){const state=await this.store.execute('state',{});if((job.kind!=='monitor-test'&&!(module==='leaderboard'?state.settings?.features.leaderboard:state.settings?.features.codexResetMonitor))||state.moduleGenerations[module]!==job.payload.moduleGeneration)throw new CallBlockedError('Optional module disabled or replaced',null);const result=leaderboard?await leaderboard.run(job):await new MonitorModule(this.ctx,store,this.calls,network,signal).run(job);await this.store.execute('finish',{id:job.id,owner:this.owner,epoch:job.epoch,now:Date.now(),result:{module,...result??{}}});}
   else if(job.kind==='report'){await this.reports.compose(job,settingsSchema.parse(job.payload.settings));await this.store.execute('finish',{id:job.id,owner:this.owner,epoch:job.epoch,now:Date.now(),result:{generated:true}});}
   else{const collectors=new SourceCollectors(this.ctx,network,this.calls,this.store,publicNetwork);await new NewsPipeline(this.store,this.calls,publicNetwork,collectors,new EmbeddingAdapter(this.ctx,this.store,this.calls,network)).run(job,this.owner);}
  }catch(error){
   if((error as {code?:string}).code==='HOTSTREAM_STORAGE_UNAVAILABLE')this.pauseStorage(error);
   if(signal.aborted){await this.store.execute('cancelJob',{id:job.id,owner:this.owner,epoch:job.epoch,now:Date.now(),reason:redactError(signal.reason)}).catch(()=>{});return;}
   failed=true;const message=redactError(error);
   if(job.kind==='collect')await this.store.execute('sourceFailure',{id:job.subject,revision:job.inputRevision,epoch:job.epoch,now:Date.now(),error:message,blocked:error instanceof CallBlockedError,retryAt:error instanceof CallBlockedError?error.retryAt??Number.MAX_SAFE_INTEGER:Date.now()+Math.min(21600000,60000*2**job.attempts)}).catch(()=>{});
   if(module)await store.execute('moduleStatus',{module,source:job.kind==='monitor-test'?'test':'module',state:{status:error instanceof CallBlockedError?'blocked':'failed',error:message},now:Date.now()}).catch(()=>{});
   await this.store.execute('fail',{id:job.id,owner:this.owner,epoch:job.epoch,now:Date.now(),error:message,blocked:job.kind!=='monitor-test'&&error instanceof CallBlockedError,retryAt:error instanceof CallBlockedError?error.retryAt??Number.MAX_SAFE_INTEGER:Date.now()+Math.min(3600000,30000*2**(job.attempts-1))}).catch(()=>{});
  }finally{await leaderboard?.close();await this.closePublicNetwork(publicNetwork);unbind();}})();
  if(this.ctx.get('jobs')){try{const id=this.ctx.jobs.start({kind:'hotstream',label:`Hotstream ${job.kind}`,outputLimitBytes:512,run:()=>({cancel:()=>control.abort(new Error('Hotstream batch cancelled')),done:task.then(()=>({status:signal.aborted?'killed':failed?'failed':'completed'}))})});void task.then(()=>{try{this.ctx.jobs.remove(id);}catch{/* The shared registry may already be disposing. */}});}catch(error){this.fault=redactError(error);}}
  return task;
 }
 close():Promise<void>{return this.closing??=(async()=>{this.lifetime.abort(new Error('Hotstream stopped'));if(this.timer)clearTimeout(this.timer);this.timer=undefined;await this.external.close();await this.ticking?.catch(()=>{});await Promise.allSettled([...this.active.values()].map(({job})=>this.store.execute('cancelJob',{id:job.id,owner:this.owner,epoch:job.epoch,now:Date.now(),reason:'Runtime stopped'})));await Promise.allSettled([...this.active.values()].map(v=>v.task));await Promise.allSettled([...this.previews]);await this.calls.close();await this.network.close();await Promise.allSettled([...this.networks.values()].map(network=>network.close()));this.detachJobs?.();})();}
}

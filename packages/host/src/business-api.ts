/** Business resource owner composed by the native Remote controller. */
import type {Context} from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-agent-default-model';
import {credentialKey} from '@deepseek-ai/dsh-credentials';
import {access} from 'node:fs/promises';
import {join} from 'node:path';
import {defaultSettings,settingsSchema,sourceSchema,type HotstreamStore,type RuntimeState,type Json} from 'dsh-hotstream-contracts/runtime';
import type {RuntimeResult,InitializeRequest,PreviewRequest,PreviewResult} from 'dsh-hotstream-contracts';
import {BusinessRuntime} from './runtime.ts';
import {defaultSources,defaultTopics} from './seeds.ts';
import {CallBlockedError} from './calls.ts';
export class BusinessOwner {
 private runtime:BusinessRuntime|undefined;
 private closing:Promise<void>|undefined;
 private readonly boot:Promise<void>;
 private initialized=false;
 private clearing:Promise<RuntimeState>|undefined;
 private initializing:Promise<RuntimeState>|undefined;
 private bootError:string|null=null;
 constructor(private readonly ctx:Context,readonly store:HotstreamStore,private readonly path:string,private readonly auditRoot:string){this.boot=this.load().catch(error=>{this.bootError=error instanceof Error?error.message:String(error);});}
 private async load():Promise<void>{try{await access(this.path);}catch{return;}let state=await this.store.execute('state',{});if(state.deleting){await this.store.execute('recover',{now:Date.now(),startup:true});state=await this.store.execute('state',{});}if(state.initialized){this.initialized=true;if(!this.closing){this.runtime=new BusinessRuntime(this.ctx,this.store,this.auditRoot);await this.runtime.start();}}}
 async ready():Promise<void>{await this.boot;if(this.bootError)throw new Error(this.bootError);if(this.closing)throw new Error('Hotstream is stopping');}
 async state():Promise<RuntimeResult>{await this.ready();let state:RuntimeState;if(this.initialized)state=await this.store.execute('state',{});else{try{await access(this.path);state=await this.store.execute('state',{});}catch{state={deleting:false,dataRevision:0,moduleGenerations:{leaderboard:0,monitor:0},initialized:false,epoch:0,revision:1,settings:null,schemaVersion:1,sourceCount:0,counts:{articles:0,stories:0,reports:0,jobs:0,receipts:0}};}}
  const defaultRoute=this.ctx.get('agentDefaultModel')?this.ctx.agentDefaultModel.currentSelection():null;return {state,defaultRoute,error:this.runtime?.error()??null,running:this.runtime!==undefined};
 }
 async initialize(request:InitializeRequest):Promise<RuntimeState>{return this.initializing??=(async()=>{await this.ready();if(this.clearing)throw new Error('Hotstream clear is still draining');const settings=settingsSchema.parse(defaultSettings(request.route));if(Number(process.versions.node.split('.')[0])<24)throw new Error('Hotstream requires the tested DSH Node 24 runtime');
  // Binding checks route availability without calling stream or sending a model request.
  await this.ctx.llm.prepareCall({provider:request.route.provider,model:request.route.model,maxTokens:32});const state=await this.store.execute('initialize',{commandId:request.commandId,settings,sources:defaultSources.map(s=>({...s,nextDueAt:Date.now()})),topics:defaultTopics,now:Date.now()});this.initialized=state.initialized;if(!this.runtime){this.runtime=new BusinessRuntime(this.ctx,this.store,this.auditRoot);await this.runtime.start();}return state;})().catch(error=>{this.initializing=undefined;throw error;});
 }
 async preview(request:PreviewRequest):Promise<PreviewResult>{await this.ready();const state=await this.store.execute('state',{});if(!state.initialized||!this.runtime||!state.settings)throw new Error('Initialize first');const source=(await this.store.execute('sources',{})).find(s=>s.id===request.id);if(!source)throw new Error('Source missing');const paid=source.kind==='x_search'||source.kind==='mp_account'||String(source.config.url??'').startsWith('https://r.jina.ai/');if(paid&&request.paidAcknowledged!==true)throw new Error('Confirm this paid source preview before sending a request');const now=Date.now();const job={id:request.commandId,kind:'preview',subject:source.id,key:`preview:${state.epoch}:${source.id}:${request.commandId}`,epoch:state.epoch,inputRevision:source.revision,configRevision:state.revision,payload:{settings:JSON.parse(JSON.stringify(state.settings)),collectAt:now},state:'running' as const,priority:0,attempts:1,maxAttempts:1,dueAt:now,leaseOwner:null,leaseUntil:null,error:null};const result=await this.runtime.preview(job,source);return {items:result.items,paid:source.kind==='x_search'||source.kind==='mp_account'||String(source.config.url??'').startsWith('https://r.jina.ai/'),committed:false};}
 async clear(commandId:string):Promise<RuntimeState>{return this.clearing??=(async()=>{await this.ready();const begun=await this.store.execute('beginClear',{commandId,now:Date.now()});if(!begun.deleting)return await this.store.execute('state',{});await this.runtime?.close();this.runtime=undefined;const state=await this.store.execute('clear',{commandId,now:Date.now()});this.initialized=false;this.initializing=undefined;return state;})().finally(()=>{this.clearing=undefined;});}
 resources():Record<string,number>{return {...this.store.resources?.(),...this.runtime?.resources()};}
 databasePath():string{return this.path;}
 externalState(){return this.runtime?.externalState()??{port:null,error:null};}
 async reconcile():Promise<void>{await this.runtime?.reconcile();}
 wake():void{this.runtime?.wake();}
 close():Promise<void>{return this.closing??=(async()=>{await this.boot.catch(()=>{});await this.runtime?.close();this.runtime=undefined;})();}
}
/** Secrets belong to DSH Credentials. Product source JSON cannot carry inline credentials. */
export function checkSource(source:unknown){const parsed=sourceSchema.parse(source);const inspect=(value:Json,key=''):void=>{if(typeof value==='string'&&/^(?:key|api[-_]?key|secret|token|password|authorization|cookie)$/i.test(key))throw new Error('Use plugin Credentials rather than inline secrets');if(typeof value==='string'&&/^https?:\/\//i.test(value)){const url=new URL(value);if(url.username||url.password||[...url.searchParams.keys()].some(name=>/(?:api[-_]?key|access[-_]?token|secret|password|authorization)/i.test(name)))throw new Error('Use plugin Credentials rather than secrets in URLs');}if(Array.isArray(value))value.forEach(v=>inspect(v,key));else if(value!==null&&typeof value==='object')for(const [k,v]of Object.entries(value))inspect(v,k);};inspect(parsed.config);return parsed;}

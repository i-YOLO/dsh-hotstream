import type {Context} from '@deepseek-ai/cordis';
import {credentialKey} from '@deepseek-ai/dsh-credentials';
import {METHOD_VERSION} from 'dsh-hotstream-core/leaderboard/method/consensus';
import {jsonSchema,settingsSchema,type HotstreamStore,type DurableJob,type Json} from 'dsh-hotstream-contracts/runtime';
import {PublicNetwork} from '../network.ts';
import {CallCoordinator,CallBlockedError} from '../calls.ts';
import {redactError} from '../sources/collect.ts';
import {inLeaderboardEnvironment} from './environment.ts';
import {buildInputs} from './inputs.ts';
import {fetchRegistry} from './fetch-run.ts';
import {LeaderboardComputer} from './compute.ts';
import {annotateEvaluation} from './fetch/admission.ts';
import {artificialAnalysis} from './fetch/sources/artificial-analysis.ts';
import {arena} from './fetch/sources/arena.ts';import {deepswe} from './fetch/sources/deepswe.ts';import {epoch} from './fetch/sources/epoch.ts';import {eqbench} from './fetch/sources/eqbench.ts';import {livebench} from './fetch/sources/livebench.ts';import {mercor} from './fetch/sources/mercor.ts';import {taptap} from './fetch/sources/taptap.ts';import {terminalBench} from './fetch/sources/terminal-bench.ts';import {vals} from './fetch/sources/vals.ts';
import {sha256,stableJson} from 'dsh-hotstream-core/lib/ids';
import {directorySeed,priceSeed} from './seeds.ts';
import {previousPriceFx,refreshPriceFx} from './pricing.ts';
import {leaderboardTransport} from './network.ts';
export class LeaderboardModule {
 private readonly computer:LeaderboardComputer;
 constructor(private readonly ctx:Context,private readonly store:HotstreamStore,private readonly network:PublicNetwork,private readonly calls:CallCoordinator,private readonly signal:AbortSignal,private readonly publicNetwork:PublicNetwork=network){this.computer=new LeaderboardComputer(signal);}
 async run(job:DurableJob):Promise<Record<string,Json>>{await this.enabled();let successes=0,failures=0,blocked=0;const configuration=settingsSchema.parse(job.payload.settings).leaderboard;const data=await this.store.execute('optionalData',{module:'leaderboard',limit:1,offset:0});if(data.models.length===0)await this.store.execute('lbSeed',{epoch:job.epoch,models:directorySeed.models,aliases:directorySeed.aliases,calibrations:directorySeed.calibrations,prices:{},now:Date.now()});
  const credentials:Record<string,string>={};for(const [id,name]of Object.entries({'github':'GITHUB_TOKEN','artificial-analysis':'ARTIFICIAL_ANALYSIS_API_KEY'})){const record=await this.ctx.credentials.readRecord(credentialKey('hotstream',id));if(record?.kind==='api-key'&&record.key)credentials[name]=record.key;}
  const arenaNetwork=configuration.arenaProxyUrl?PublicNetwork.viaProxy(this.signal,configuration.arenaProxyUrl):null;
  const fetch=async(url:string,options:Parameters<PublicNetwork['fetch']>[1])=>{await this.enabled();const transport=leaderboardTransport(url,options,this.network,arenaNetwork,this.publicNetwork);return await transport.fetch(url,{...options,signal:AbortSignal.any([this.signal,...options?.signal?[options.signal]:[]])});};
  try{await inLeaderboardEnvironment({fetch,credentials},async()=>{const providers=[artificialAnalysis,arena,deepswe,epoch,eqbench,livebench,mercor,taptap,terminalBench,vals];const outcomes=await fetchRegistry(providers,this.signal,async provider=>{await this.enabled();if(provider.sourceKeys.every(key=>(configuration.sources[key]??configuration.sources['*'])===false))return false;if(provider===artificialAnalysis&&(job.payload.publicOnly===true||!credentials.ARTIFICIAL_ANALYSIS_API_KEY))throw new CallBlockedError('Artificial Analysis credential missing',null);return true;},error=>error instanceof CallBlockedError);for(const [index,provider] of providers.entries()){
   if(provider.sourceKeys.every(key=>(configuration.sources[key]??configuration.sources['*'])===false)){for(const key of provider.sourceKeys)await this.store.execute('moduleStatus',{module:'leaderboard',source:key,state:{status:'disabled',error:null},now:Date.now()});continue;}
   try{await this.enabled();if(provider===artificialAnalysis&&(job.payload.publicOnly===true||!credentials.ARTIFICIAL_ANALYSIS_API_KEY))throw new CallBlockedError('Artificial Analysis credential missing',null);if(outcomes[index]!.error)throw outcomes[index]!.error;const results=outcomes[index]!.value??[];for(const original of results){if((configuration.sources[original.sourceKey]??configuration.sources['*'])===false)continue;const result=annotateEvaluation(original);await this.enabled();await this.store.execute('lbSnapshot',{epoch:job.epoch,result:JSON.parse(JSON.stringify({...result,metadata:{...result.metadata,manualAliasVersion:sha256(stableJson(configuration.aliases[result.sourceKey]??{}))}})) as Record<string,Json>,aliases:configuration.aliases[result.sourceKey]??{},now:Date.now()});await this.store.execute('moduleStatus',{module:'leaderboard',source:result.sourceKey,state:{status:'ok',lastOkAt:Date.now(),sourceUrl:result.sourceUrl,license:result.license,attributionUrl:result.attributionUrl,rows:result.rows.length},now:Date.now()});successes++;}}
   catch(error){if(this.signal.aborted)throw error;if(error instanceof CallBlockedError)blocked++;else failures++;for(const key of provider.sourceKeys)await this.store.execute('moduleStatus',{module:'leaderboard',source:key,state:{status:error instanceof CallBlockedError?'blocked':'failed',error:redactError(error)},now:Date.now()});}
  }});}finally{await arenaNetwork?.close();}
  await this.enabled();
  // Reconcile prices even for an existing library and for models discovered in this refresh.
  await this.store.execute('lbSeed',{epoch:job.epoch,models:[],aliases:{},calibrations:[],prices:priceSeed.prices,priceDates:priceSeed.priceDates,now:Date.now()});
  const fx=await refreshPriceFx(this.store,this.network,this.signal,previousPriceFx(data.state,data.sources));
  await this.enabled();if(!successes){const message=failures?'No leaderboard source returned usable evidence; check source errors and DNS settings':blocked?'Leaderboard sources need credentials or are excluded from this public-only refresh':'No leaderboard sources are enabled';if(failures)throw new Error(message);throw new CallBlockedError(message,null);}
  const inputs=await buildInputs(this.store,job.epoch,Date.now(),configuration);if(!inputs.boards.length){await this.store.execute('moduleStatus',{module:'leaderboard',source:'method',state:{status:'waiting-for-evidence',error:'No board meets the frozen calibration and evidence policy'},now:Date.now()});await this.store.execute('moduleStatus',{module:'leaderboard',source:'module',state:{status:'waiting-for-evidence',error:null,successes,failures,blocked},now:Date.now()});return {successes,failures,blocked,publishedBoards:0};}
  const boards=await this.computer.run(inputs.boards);const published=boards.filter(b=>b.publishable_connectivity===true);if(!published.length)throw new Error('Leaderboard evidence graph is disconnected');await this.enabled();await this.store.execute('lbRun',{epoch:job.epoch,version:METHOD_VERSION,boards:published,snapshotIds:inputs.snapshotIds,evidence:{evidence:inputs.evidence,exclusions:inputs.exclusions,fx},now:Date.now()});await this.store.execute('moduleStatus',{module:'leaderboard',source:'module',state:{status:failures||blocked||!fx?'partial':'ok',lastOkAt:Date.now(),error:null,successes,failures,blocked,publishedBoards:published.length},now:Date.now()});return {successes,failures,blocked,publishedBoards:published.length,fxAvailable:fx!==null};
 }
 private async enabled():Promise<void>{this.signal.throwIfAborted();const state=await this.store.execute('state',{});if(!state.settings?.features.leaderboard)throw new CallBlockedError('Leaderboard disabled',null);}
 async close():Promise<void>{await this.computer.close();}
}

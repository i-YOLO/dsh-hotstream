import {describe,it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {HotstreamDatabase} from '../../packages/storage-sqlite/lib/types/database.js';
import {defaultSettings,operationSchemas} from '../../packages/contracts/lib/types/runtime.js';
import {MonitorModule} from '../../packages/host/lib/types/monitor/module.js';
import {LeaderboardModule} from '../../packages/host/lib/types/leaderboard/manager.js';
import {CallCoordinator} from '../../packages/host/lib/types/calls.js';
import {changeCredential} from '../../packages/host/lib/types/credentials.js';
import {paidHttp} from '../../packages/host/lib/types/paid-http.js';

const source={id:'fixture',name:'Integration fixture',kind:'external',config:{},tags:[],tier:'T1',ownerEntityId:null,signalGroupId:null,participationMode:'isolated',firstParty:false,intervalMinutes:60,siteFulltext:false,enabled:false,revision:1,cursor:{},health:'unknown',lastOkAt:null,nextDueAt:null,lastError:null};
async function fixture(work){
  const root=await mkdtemp(join(tmpdir(),'hotstream-admin-')),db=new DatabaseSync(':memory:'),database=new HotstreamDatabase(db);
  const settings=defaultSettings({provider:'mock',model:'mock'});settings.autoCollectEnabled=false;settings.budgets.paidCollectorPerService={perMinute:10000,perHour:10000,per24Hours:10000};
  const state=database.execute('initialize',{commandId:randomUUID(),settings,sources:[source],now:Date.now()});
  const store={execute:async(operation,input)=>database.execute(operation,input),close:async()=>{}};
  try{await work({root,db,database,store,state});}finally{db.close();await rm(root,{recursive:true,force:true});}
}
const request=state=>({commandId:randomUUID(),revision:state.revision,acknowledged:true,now:Date.now()});
const payload=(url,data,status=200)=>({url,status,headers:new Headers({'content-type':'application/json'}),body:Buffer.from(JSON.stringify(data)),text:()=>JSON.stringify(data)});
const noReset={relevant:false,translationZh:null,contextZh:[],outage:null,needsReview:false,propositions:[]};

describe('integration commands and credential isolation',()=>{
  it('removes a provider-echoed credential before persisting the HTTP receipt',()=>fixture(async({root,database,store,state})=>{
    const secret='HOTSTREAM_PRIVATE_RESPONSE_FIXTURE',controller=new AbortController(),calls=new CallCoordinator({},store,join(root,'audit'),controller.signal);
    const job={id:randomUUID(),kind:'preview',subject:'fixture',epoch:state.epoch,key:'fixture',payload:{},leaseOwner:null,configRevision:state.revision,inputRevision:0};
    const network={fetch:async url=>payload(url,{error:'Rejected '+secret,encoded:encodeURIComponent(secret)},401)};
    try{await expect(paidHttp(calls,store,network,job,'socialdata',{purpose:'fixture'},'https://api.socialdata.tools/fixture',{headers:{authorization:'Bearer '+secret}})).rejects.toThrow('HTTP 401');const receipts=database.execute('receipts',{limit:10,offset:0});expect(receipts[0].response.credentialsRedacted).toBe(true);expect(JSON.stringify(receipts).includes(secret)).toBe(false);}finally{controller.abort();await calls.close();}
  }));
  it('requires a paused monitor, preserves other settings and starts one idempotent bounded job',()=>fixture(async({database,state})=>{
    const input=request(state),first=database.execute('monitorTestStart',input),second=database.execute('monitorTestStart',input);
    expect(second.jobId).toBe(first.jobId);expect(database.execute('jobs',{limit:100,offset:0})).toHaveLength(1);
    expect(database.execute('jobs',{limit:1,offset:0})[0]).toMatchObject({kind:'monitor-test',maxAttempts:1,configRevision:state.revision});
    expect(database.execute('state',{}).settings).toEqual(state.settings);
    expect(()=>database.execute('monitorTestStart',request(state))).toThrow('already active');
    const changed=database.execute('configure',{revision:state.revision,settings:{...state.settings,features:{...state.settings.features,codexResetMonitor:true}},now:Date.now()});
    expect(()=>database.execute('monitorTestStart',request(changed))).toThrow('Pause periodic');
    expect(()=>operationSchemas.monitorTestStart.parse({...request(changed),maximum:100})).toThrow();
  }));

  it('allows test writes only with the current running lease and fences a credential change',()=>fixture(async({database,state})=>{
    const test=database.execute('monitorTestStart',request(state));
    const write={module:'monitor',source:'test',generation:state.moduleGenerations.monitor,testJobId:test.jobId,state:{status:'running'},now:Date.now()};
    expect(()=>database.execute('moduleStatus',write)).toThrow('Stale');
    database.execute('claim',{kinds:['monitor-test'],owner:'test',now:Date.now(),leaseMs:600000});
    expect(database.execute('moduleStatus',write)).toBe(true);
    database.execute('credentialInvalidate',{service:'socialdata',now:Date.now()});
    expect(database.execute('monitorTestRead',{jobId:test.jobId}).state).toBe('cancelled');
    expect(()=>database.execute('moduleStatus',write)).toThrow('Stale');
  }));

  it('stores and removes only the plugin credential without waking or enabling collection',()=>fixture(async({store,state,database})=>{
    const secret='HOTSTREAM_TEST_ONLY_PRIVATE_VALUE';let record;let writes=0;
    const ctx={credentials:{modifyRecord:async(key,mutate)=>{writes++;record=await mutate(record);return record;}}};
    await changeCredential(ctx,store,'socialdata',secret);expect(record).toEqual({kind:'api-key',key:secret});
    expect(database.execute('state',{}).settings).toEqual(state.settings);expect(database.execute('jobs',{limit:100,offset:0})).toEqual([]);
    expect(JSON.stringify(database.execute('moduleHealth',{})).includes(secret)).toBe(false);
    await changeCredential(ctx,store,'socialdata',null);expect(record).toBeUndefined();expect(writes).toBe(2);
    ctx.credentials.modifyRecord=async()=>{throw new Error(secret);};
    const failure=await changeCredential(ctx,store,'socialdata',secret).catch(error=>error);expect(failure.message.includes(secret)).toBe(false);
  }));

  it('limits real collector code to one page, two context lookups and five model requests, without advancing the cursor',()=>fixture(async({root,database,store,state})=>{
    const started=database.execute('monitorTestStart',request(state)),job=database.execute('claim',{kinds:['monitor-test'],owner:'test',now:Date.now(),leaseMs:600000});
    const secret='HOTSTREAM_TEST_ONLY_PRIVATE_VALUE',ctx={credentials:{readRecord:async()=>({kind:'api-key',key:secret})}},controller=new AbortController();
    let searches=0,contexts=0,models=0;const user={screen_name:'thsottiaux',name:'Tibo'};
    const tweets=Array.from({length:12},(_,index)=>({id_str:String(1000+index),tweet_created_at:new Date(Date.now()-index*1000).toISOString(),full_text:'A routine update, no reset announcement.',user,...index>=10?{in_reply_to_status_id_str:String(9000+index)}:{}}));
    const network={fetch:async(url,options)=>{expect(options.headers.authorization).toBe('Bearer '+secret);if(url.includes('/search?')){searches++;return payload(url,{tweets,next_cursor:'must-not-read'});}contexts++;return payload(url,{id_str:url.split('/').at(-1),tweet_created_at:new Date().toISOString(),full_text:'Earlier context.',user});}};
    const calls=new CallCoordinator(ctx,store,join(root,'audit'),controller.signal);
    calls.model=async(current,_settings,_input)=>{models++;const reserved=await store.execute('reserve',{jobId:current.id,key:'test-model:'+current.key,service:'llm',epoch:state.epoch,requestHash:createHash('sha256').update(current.key).digest('hex'),request:{stage:'monitor'},now:Date.now()});const id=reserved.receipt.id;await store.execute('sent',{id,epoch:state.epoch,auditRef:'fixture',now:Date.now()});await store.execute('receive',{id,epoch:state.epoch,response:noReset,usage:{},now:Date.now()});return {text:JSON.stringify(noReset),receiptId:id};};
    try{const result=await new MonitorModule(ctx,store,calls,network,controller.signal).run(job);database.execute('finish',{id:job.id,owner:'test',epoch:job.epoch,now:Date.now(),result});
      expect(searches).toBe(1);expect(contexts).toBe(2);expect(models).toBe(5);expect(database.execute('monitorCursor',{})).toEqual({});
      const saved=database.execute('monitorTestRead',{jobId:started.jobId});expect(saved).toMatchObject({state:'succeeded',searchRequests:1,modelRequests:5,posts:12,recognized:5,costBasis:'estimated'});
      expect(saved.results.every(row=>row.outcome==='no-reset')).toBe(true);expect(database.execute('moduleHealth',{}).monitor.coverageComplete).toBe(false);
      expect(JSON.stringify(database.execute('receipts',{limit:100,offset:0})).includes(secret)).toBe(false);
    }finally{controller.abort();await calls.close();}
  }));

  it('does not retry an HTTP failure during a monitor test',()=>fixture(async({root,database,store,state})=>{
    database.execute('monitorTestStart',request(state));const job=database.execute('claim',{kinds:['monitor-test'],owner:'test',now:Date.now(),leaseMs:600000});let requests=0;
    const controller=new AbortController(),ctx={credentials:{readRecord:async()=>({kind:'api-key',key:'HOTSTREAM_TEST_ONLY_KEY'})}},calls=new CallCoordinator(ctx,store,join(root,'audit'),controller.signal);
    const network={fetch:async url=>{requests++;return payload(url,{error:'unauthorized'},401);}};
    try{await expect(new MonitorModule(ctx,store,calls,network,controller.signal).run(job)).rejects.toThrow('HTTP 401');expect(requests).toBe(1);expect(database.execute('monitorCursor',{})).toEqual({});}finally{controller.abort();await calls.close();}
  }));

  it('reports total leaderboard source failure and retains a previously published board',()=>fixture(async({database,store,state})=>{
    const settings={...state.settings,features:{...state.settings.features,leaderboard:true}};const configured=database.execute('configure',{revision:state.revision,settings,now:Date.now()});
    database.execute('lbSeed',{epoch:state.epoch,models:[['fixture-a','Fixture A','Fixture','fixture',null,null]],aliases:{},calibrations:[],prices:{},now:Date.now()});
    database.execute('moduleStatus',{module:'leaderboard',source:'method',state:{status:'waiting-for-evidence',error:'Previous evidence was insufficient'},now:Date.now()});
    database.execute('lbRun',{epoch:state.epoch,version:'fixture',boards:[{board:'overall',entries:[{slug:'fixture-a',rank:1,score:55}]}],snapshotIds:[],evidence:{},now:Date.now()});
    expect(database.execute('optionalData',{module:'leaderboard',limit:100,offset:0}).sources.find(source=>source.source==='method')).toMatchObject({status:'ok',error:null});
    database.execute('leaderboardRefresh',{commandId:randomUUID(),revision:configured.revision,now:Date.now()});const job=database.execute('claim',{kinds:['leaderboard'],owner:'test',now:Date.now(),leaseMs:600000}),controller=new AbortController();let requests=0;
    const network={fetch:async()=>{requests++;throw new Error('Fixture DNS timeout');}},module=new LeaderboardModule({credentials:{readRecord:async()=>undefined}},store,network,{},controller.signal);
    try{await expect(module.run(job)).rejects.toThrow('No leaderboard source');expect(requests).toBeGreaterThan(0);database.execute('fail',{id:job.id,owner:'test',epoch:job.epoch,now:Date.now(),error:'No leaderboard source returned usable evidence',blocked:false,retryAt:Date.now()});const health=database.execute('moduleHealth',{}).leaderboard;expect(health.records).toBe(1);expect(health.status).toBe('partial');expect(health.sources.some(row=>row.error?.includes('DNS timeout'))).toBe(true);expect(database.execute('optionalData',{module:'leaderboard',limit:100,offset:0}).records[0].score).toBe(55);}finally{controller.abort();await module.close();}
  }));
});

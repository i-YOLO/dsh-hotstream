import type {DatabaseSync,SQLInputValue,SQLOutputValue} from 'node:sqlite';
import {sha256,stableJson} from 'dsh-hotstream-core/lib/ids';
import type {DurableJob,EnqueueJob,RuntimeState,StorageOperations,Json} from 'dsh-hotstream-contracts/runtime';
import type {ModuleHealthResult,OptionalModuleHealth,MonitorTestResult,SourceHealth} from 'dsh-hotstream-contracts';

type Row=Record<string,SQLOutputValue>;
type Operations='monitorTestStart'|'monitorTestRead'|'moduleHealth'|'credentialInvalidate';
interface Runtime {state():RuntimeState;transaction<T>(run:()=>T):T;enqueue(input:EnqueueJob):DurableJob;}
const object=(raw:unknown):Record<string,Json>=>raw==null?{}:JSON.parse(String(raw)) as Record<string,Json>;
const timestamp=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;

/** User-triggered integration tests are durable, limited, and independent from periodic collection. */
export class IntegrationDatabase {
  constructor(private readonly db:DatabaseSync,private readonly runtime:Runtime){}
  private get(sql:string,...values:SQLInputValue[]):Row|undefined{return this.db.prepare(sql).get(...values);}
  private all(sql:string,...values:SQLInputValue[]):Row[]{return this.db.prepare(sql).all(...values);}
  private count(table:string):number{return Number(this.get(`SELECT count(*) n FROM ${table}`)?.n??0);}

  private test(jobId:string):MonitorTestResult {
    const job=this.get("SELECT * FROM jobs WHERE id=? AND kind='monitor-test' AND epoch=?",jobId,this.runtime.state().epoch);
    if(!job)throw new Error('Monitor test not found');
    const attempts=this.all('SELECT a.*,r.request FROM receipt_jobs j JOIN receipt_attempts a ON a.receipt_id=j.receipt_id JOIN receipts r ON r.id=j.receipt_id WHERE j.job_id=? ORDER BY a.reserved_at',jobId);
    const sent=attempts.filter(row=>row.sent_at!==null&&Number(row.sent_at)>=Number(job.created_at)),social=sent.filter(row=>row.service==='socialdata');
    const context=social.filter(row=>!!object(row.request).tweet).length;
    const results=this.all('SELECT DISTINCT p.id,p.url,p.recognition FROM monitor_posts p JOIN receipt_jobs j ON j.receipt_id=p.receipt_id WHERE j.job_id=? ORDER BY p.published_at DESC',jobId).map(row=>{
      const recognition=object(row.recognition),propositions=Array.isArray(recognition.propositions)?recognition.propositions:[];
      return {postId:String(row.id),url:String(row.url),outcome:recognition.needsReview?'needs-review':propositions.length?'event-evidence':recognition.relevant?'related':'no-reset'};
    });
    const paid=social.filter(row=>row.cost!==null),cost=paid.length===social.length&&social.length?paid.reduce((sum,row)=>sum+Number(row.cost),0):social.length?null:0;
    const progress=object(this.get("SELECT state FROM module_status WHERE module='monitor' AND source='test'")?.state);const outcome=object(job.result),history=this.all('SELECT started_at,finished_at FROM job_attempts WHERE job_id=? ORDER BY attempt',jobId);
    return {jobId,state:String(job.state),startedAt:timestamp(history[0]?.started_at),finishedAt:timestamp(history.at(-1)?.finished_at),error:job.error===null?null:String(job.error),searchRequests:social.length-context,contextRequests:context,modelRequests:sent.filter(row=>row.service==='llm').length,posts:Number(outcome.posts??(progress.jobId===jobId?progress.posts:0)??0),recognized:results.length,cost,currency:cost===null?null:'USD',costBasis:!social.length?'actual':cost===null?'unknown':paid.every(row=>row.cost_basis==='actual')?'actual':'estimated',receiptIds:[...new Set(attempts.map(row=>String(row.receipt_id)))],results};
  }

  private start(input:StorageOperations['monitorTestStart']['input']):MonitorTestResult {
    return this.runtime.transaction(()=>{
      const state=this.runtime.state(),hash=sha256(stableJson({revision:input.revision,acknowledged:input.acknowledged}));
      const old=this.get('SELECT * FROM command_receipts WHERE command_id=?',input.commandId);
      if(old){const saved=object(old.result);if(old.kind!=='monitor-test'||old.epoch!==state.epoch||saved.hash!==hash)throw new Error('Command identity or epoch conflict');return this.test(String(saved.jobId));}
      if(!state.initialized||state.deleting||!state.settings)throw new Error('Initialize Hotstream first');
      if(state.revision!==input.revision)throw new Error('Settings revision conflict');
      if(state.settings.features.codexResetMonitor)throw new Error('Pause periodic Tibo monitoring before a one-time test');
      if(this.get("SELECT id FROM jobs WHERE kind='monitor-test' AND epoch=? AND state IN('queued','running','retry_wait','blocked')",state.epoch))throw new Error('A monitor test is already active');
      const job=this.runtime.enqueue({kind:'monitor-test',subject:'thsottiaux',key:`monitor-test:${state.epoch}:${input.commandId}`,epoch:state.epoch,inputRevision:0,configRevision:state.revision,payload:{settings:JSON.parse(JSON.stringify(state.settings)),collectAt:input.now,moduleGeneration:state.moduleGenerations.monitor},priority:100,maxAttempts:1,dueAt:input.now});
      this.db.prepare('INSERT INTO command_receipts VALUES(?,?,?,?,?)').run(input.commandId,'monitor-test',state.epoch,input.now,JSON.stringify({hash,jobId:job.id}));
      return this.test(job.id);
    });
  }

  private health(module:'leaderboard'|'monitor'):OptionalModuleHealth {
    const state=this.runtime.state(),enabled=!!(module==='leaderboard'?state.settings?.features.leaderboard:state.settings?.features.codexResetMonitor);
    const statuses=this.all('SELECT * FROM module_status WHERE module=? ORDER BY source',module);
    const sources:SourceHealth[]=statuses.filter(row=>!['module','method','test'].includes(String(row.source))).map(row=>{
      const data=object(row.state);return {id:String(row.source),status:String(data.status??'idle'),lastAttemptAt:timestamp(row.updated_at),lastSuccessAt:timestamp(data.lastOkAt),error:typeof data.error==='string'?data.error:null,rows:timestamp(data.rows)};
    });
    const job=this.get('SELECT state,created_at,error FROM jobs WHERE kind=? AND epoch=? ORDER BY created_at DESC,id DESC LIMIT 1',module,state.epoch);
    const summary=object(statuses.find(row=>row.source==='module')?.state),method=object(statuses.find(row=>row.source==='method')?.state);
    const snapshots=this.count(module==='leaderboard'?'lb_snapshots':'monitor_posts'),records=module==='leaderboard'?Number(this.get("SELECT count(*) n FROM lb_rankings WHERE run_id=(SELECT id FROM lb_runs WHERE status='published' ORDER BY generated_at DESC LIMIT 1)")?.n??0):this.count('monitor_events');
    const lastSuccess=module==='leaderboard'?this.get("SELECT max(generated_at) at FROM lb_runs WHERE status='published'")?.at:object(statuses.find(row=>row.source==='thsottiaux')?.state).lastOkAt;
    const latest=this.get("SELECT id FROM jobs WHERE kind='monitor-test' AND epoch=? ORDER BY created_at DESC,id DESC LIMIT 1",state.epoch);
    const failed=sources.filter(source=>['failed','blocked','unconfigured'].includes(source.status));
    let status:OptionalModuleHealth['status']=!enabled?'disabled':job?.state==='running'?'running':job?.state==='queued'?'queued':'idle';
    if(enabled&&!['running','queued'].includes(status)){
      if(records)status=failed.length||['failed','blocked'].includes(String(summary.status))?'partial':'ready';
      else if(summary.status==='blocked')status='unconfigured';
      else if(summary.status==='failed'||sources.length>0&&failed.length===sources.length)status='failed';
      else if(method.status==='waiting-for-evidence'||snapshots>0)status='waiting-for-evidence';
    }
    const cursor=object(this.get("SELECT value FROM monitor_state WHERE key='cursor'")?.value);
    return {enabled,status,lastAttemptAt:timestamp(job?.created_at),lastSuccessAt:timestamp(lastSuccess),error:typeof summary.error==='string'?summary.error:status==='failed'?failed[0]?.error??null:status==='waiting-for-evidence'&&typeof method.error==='string'?method.error:null,records,snapshots,sources,latestTest:module==='monitor'&&latest?this.test(String(latest.id)):null,coverageComplete:module==='monitor'&&typeof cursor.coverageFrom==='number'&&cursor.coverageFrom<=Date.now()-90*86400000&&cursor.coverageComplete===true};
  }

  handlers():{[K in Operations]:(input:StorageOperations[K]['input'])=>StorageOperations[K]['output']} {
    return {
      monitorTestStart:input=>this.start(input),monitorTestRead:input=>this.test(input.jobId),
      moduleHealth:()=>({leaderboard:this.health('leaderboard'),monitor:this.health('monitor')} satisfies ModuleHealthResult),
      credentialInvalidate:input=>this.runtime.transaction(()=>{
        if(input.service==='socialdata'){
          this.db.prepare("UPDATE plugin_state SET module_generations=json_set(module_generations,'$.monitor',json_extract(module_generations,'$.monitor')+1) WHERE id=1").run();
          this.db.prepare("UPDATE jobs SET state='cancelled',lease_owner=NULL,lease_until=NULL,error='SocialData credential changed or removed' WHERE kind IN('monitor','monitor-test') AND state IN('queued','running','retry_wait','blocked')").run();
        }
        return true;
      }),
    };
  }
}

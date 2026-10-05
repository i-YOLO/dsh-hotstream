/** Optional embedding adapter; the target DSH has no public llm.embed API. */
import type {Context} from '@deepseek-ai/cordis';
import {credentialKey} from '@deepseek-ai/dsh-credentials';
import {z} from 'zod';
import {sha256} from 'dsh-hotstream-core/lib/ids';
import type {RuntimeSettings,DurableJob,HotstreamStore,Json} from 'dsh-hotstream-contracts/runtime';
import type {PublicNetwork} from './network.ts';
import {CallCoordinator,CallBlockedError} from './calls.ts';
import {paidHttp} from './paid-http.ts';
export class EmbeddingAdapter {
 constructor(private readonly ctx:Context,private readonly store:HotstreamStore,private readonly calls:CallCoordinator,private readonly network:PublicNetwork){}
 async vector(job:DurableJob,settings:RuntimeSettings,text:string,subjectId:string):Promise<number[]|null>{const config=settings.embedding;if(config.mode==='lexical')return null;if(!config.endpoint||!config.model||!config.dimension)throw new CallBlockedError('Vector mode requires endpoint, model and explicit dimension',null);const key=await this.ctx.credentials.readRecord(credentialKey('hotstream',config.credentialRef??'embedding'));if(key?.kind!=='api-key'||!key.key)throw new CallBlockedError('Embedding credential missing',null);const service=sha256(config.endpoint).slice(0,32),hash=sha256(text);const cached=await this.store.execute('vectorGet',{service,model:config.model,dimension:config.dimension,hash});if(cached)return cached;
  const answer=await paidHttp(this.calls,this.store,this.network,{...job,subject:subjectId},'embedding',{endpoint:config.endpoint,model:config.model,dimension:config.dimension,textHash:hash,requestBody:{model:config.model,input:text,dimensions:config.dimension}},config.endpoint,{method:'POST',headers:{authorization:`Bearer ${key.key}`,'content-type':'application/json'},body:JSON.stringify({model:config.model,input:text,dimensions:config.dimension}),timeoutMs:30000},raw=>{const parsed=z.object({usage:z.record(z.string(),z.unknown()).optional()}).parse(raw);return JSON.parse(JSON.stringify({...parsed.usage,costBasis:'unknown'})) as Record<string,Json>;});const output=z.object({data:z.array(z.object({embedding:z.array(z.number().finite())}))}).parse(JSON.parse(answer.body));const vector=output.data[0]?.embedding;if(!vector||vector.length!==config.dimension)throw new Error('Embedding response dimension differs from configured identity');await this.store.execute('vectorPut',{epoch:job.epoch,subjectId,service,model:config.model,dimension:config.dimension,hash,vector});await this.store.execute('settle',{id:answer.receiptId,attempt:answer.attempt,epoch:job.epoch,state:'completed',error:null,now:Date.now()});return vector;
 }
}
export function cosine(a:number[],b:number[]):number{if(a.length!==b.length)throw new Error('Incompatible embedding dimensions');let dot=0,x=0,y=0;for(let i=0;i<a.length;i++){dot+=a[i]!*b[i]!;x+=a[i]!**2;y+=b[i]!**2;}return x&&y?dot/Math.sqrt(x*y):0;}

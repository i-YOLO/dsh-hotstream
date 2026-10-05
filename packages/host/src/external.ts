/** Explicit loopback ingest only. There is no read, query or Agent endpoint. */
import {createServer,type Server} from 'node:http';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import type {Context} from '@deepseek-ai/cordis';
import {credentialKey} from '@deepseek-ai/dsh-credentials';
import {z} from 'zod';
import {Sanitize,Text} from 'dsh-hotstream-core';
import type {CollectionItem,HotstreamStore,Json} from 'dsh-hotstream-contracts/runtime';
export class ExternalInput {
 private server:Server|undefined;private port:number|null=null;private signature:string|null=null;private fault:string|null=null;
 constructor(private readonly ctx:Context,private readonly store:HotstreamStore,private readonly wake:()=>void){}
 address():number|null{return this.port;}
 state(){return {port:this.port,error:this.fault};}
 async sync():Promise<void>{const state=await this.store.execute('state',{});const sources=state.initialized&&state.settings?.externalIngest.enabled?(await this.store.execute('sources',{})).filter(s=>s.kind==='external'&&s.enabled):[];const record=sources.length?await this.ctx.credentials.readRecord(credentialKey('hotstream','external')):null;const signature=JSON.stringify({epoch:state.epoch,enabled:state.initialized&&state.settings?.externalIngest.enabled,sources:sources.map(s=>[s.id,s.revision]),key:record?.kind==='api-key'?record.key:null});if(this.signature===signature)return;await this.close();this.signature=signature;this.fault=null;try{await this.start();}catch(error){this.fault=error instanceof Error?error.message:String(error);}}

 async start():Promise<void>{if(this.server)return;const state=await this.store.execute('state',{});if(!state.initialized||!state.settings?.externalIngest.enabled)return;const sources=await this.store.execute('sources',{});if(!sources.some(s=>s.kind==='external'&&s.enabled))return;const record=await this.ctx.credentials.readRecord(credentialKey('hotstream','external'));if(record?.kind!=='api-key'||!record.key)throw new Error('External input requires its own plugin credential');const expected=Buffer.from(record.key);
  const server=createServer(async(req,res)=>{const end=(status:number,value:unknown)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
   if(req.method!=='POST'||req.url!=='/items'){end(404,{error:'unknown endpoint'});return;}
   if(req.headers.origin!==undefined){end(403,{error:'browser Origin refused'});return;}
   const presented=Buffer.from((req.headers.authorization??'').replace(/^Bearer /,''));if(presented.length!==expected.length||!timingSafeEqual(presented,expected)){end(401,{error:'invalid credential'});return;}
   if(Number(req.headers['content-length']??0)>2097152){end(413,{error:'batch too large'});req.destroy();return;}
   let size=0;const chunks:Buffer[]=[];try{for await(const chunk of req){size+=chunk.length;if(size>2097152){end(413,{error:'batch too large'});req.destroy();return;}chunks.push(Buffer.from(chunk));}
    const input=z.object({sourceId:z.string().min(1),items:z.array(z.object({url:z.string().url().refine(value=>/^https?:$/.test(new URL(value).protocol),'Only HTTP news URLs are accepted'),title:z.string().min(1).max(1000),publishedAt:z.string().nullable().optional(),author:z.string().nullable().optional(),excerpt:z.string().nullable().optional(),bodyText:z.string().max(500000).nullable().optional(),backfill:z.boolean().optional()}).strict()).min(1).max(100)}).strict().parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    const state=await this.store.execute('state',{});if(!state.initialized||!state.settings?.externalIngest.enabled){end(409,{error:'input disabled'});return;}const source=(await this.store.execute('sources',{})).find(s=>s.id===input.sourceId&&s.kind==='external'&&s.enabled);if(!source){end(409,{error:'enabled external source required'});return;}
    const commandId=z.string().uuid().parse(req.headers['x-request-id']??randomUUID());const items:CollectionItem[]=input.items.map(i=>({url:i.url,title:Text.collapseWhitespace(i.title),identityKey:null,author:i.author??null,language:null,publishedAt:i.publishedAt&&Number.isFinite(Date.parse(i.publishedAt))?Date.parse(i.publishedAt):null,excerpt:i.excerpt??null,bodyText:i.bodyText??null,bodyHtml:i.bodyText?Sanitize.textToHtml(i.bodyText):null,bodyStatus:i.bodyText?'ok':'pending',media:[],xPost:null,raw:null,backfillReason:i.backfill?'reported-backfill':null}));
    const job=await this.store.execute('enqueue',{kind:'ingest',subject:source.id,key:`external:${state.epoch}:${source.id}:${commandId}`,epoch:state.epoch,inputRevision:source.revision,configRevision:state.revision,payload:{items:JSON.parse(JSON.stringify(items)) as Json,settings:JSON.parse(JSON.stringify(state.settings)) as Json},priority:100,maxAttempts:3,dueAt:Date.now()});this.wake();end(202,{accepted:true,commandId,jobId:job.id});
   }catch{end(400,{error:'invalid external input'});}
  });server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=30;this.server=server;await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});});const address=server.address();this.port=address&&typeof address!=='string'?address.port:null;
 }
 async close():Promise<void>{const server=this.server;this.server=undefined;this.port=null;if(server)await new Promise<void>((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();});}
}

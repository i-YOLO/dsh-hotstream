/** Six retained entrances with provider evidence, per-source cursors and bounded previews. */
import type {Context} from '@deepseek-ai/cordis';
import {credentialKey} from '@deepseek-ai/dsh-credentials';
import {z} from 'zod';
import {Url,Sanitize,Text,Material,type Candidate,type SourceRow} from 'dsh-hotstream-core';
import {jsonSchema,type Source,type DurableJob,type CollectionItem,type Json,type HotstreamStore} from 'dsh-hotstream-contracts/runtime';
import {createRssCollector} from './rss.ts';import {createWebCollector} from './web-list.ts';import {createJsonCollector} from './json-list.ts';
import {createXCollector,ProviderRejectedError} from './x.ts';import type {SdTweet} from './socialdata.ts';
import type {CollectorIo} from './io.ts';import type {PublicNetwork,GuardedFetchOptions} from '../network.ts';
import {CallCoordinator,CallBlockedError} from '../calls.ts';import {paidHttp} from '../paid-http.ts';
export interface Collected {items:CollectionItem[];cursor:Record<string,Json>;receiptIds:string[];foundCount:number;}
export const legacySource=(s:Source):SourceRow=>({id:s.id,name:s.name,kind:s.kind,config:s.config,tier:s.tier,participation_mode:s.participationMode,first_party:s.firstParty,interval_minutes:s.intervalMinutes,enabled:s.enabled,cursor:s.cursor,fail_count:0});
const dajialaUsage=(value:unknown):Record<string,Json>=>{const p=z.object({cost_money:z.number().optional()}).passthrough().parse(value);return {cost:p.cost_money??null,currency:'CNY',costBasis:p.cost_money===undefined?'unknown':'actual'};};
export class SourceCollectors {
 constructor(private readonly ctx:Context,private readonly network:PublicNetwork,private readonly calls:CallCoordinator,private readonly store:HotstreamStore,private readonly publicNetwork:PublicNetwork=network){}
 private async json(job:DurableJob,service:string,identity:Record<string,Json>,url:string,options:GuardedFetchOptions,usage?:(value:unknown)=>Record<string,Json>){
  const read=await paidHttp(this.calls,this.store,this.network,job,service,identity,url,options,usage);
  let response:Json;try{response=jsonSchema.parse(JSON.parse(read.body));}catch{throw new Error(`${service} returned invalid JSON; its received response is retained`);}
  return {response,receiptId:read.receiptId};
 }
 private async acceptedDajiala(job:DurableJob,read:{response:Json;receiptId:string}):Promise<void>{
  const parsed=z.object({code:z.coerce.number().default(0)}).passthrough().parse(read.response);
  if(parsed.code!==0){await this.store.execute('settle',{id:read.receiptId,epoch:job.epoch,state:'failed',error:`Dajiala code ${parsed.code}`,now:Date.now()});if(parsed.code===-1)throw new ProviderRejectedError('Dajiala rate limited',429,true);throw new CallBlockedError(`Dajiala rejected account or balance (code ${parsed.code})`,null);}
 }
 async collect(job:DurableJob,source:Source,preview=false):Promise<Collected>{
  if(!source.enabled&&!preview)throw new Error('Source disabled');
  let previewPaidCalls=0;const admitPreview=()=>{if(preview&&previewPaidCalls++>=1)throw new Error('Preview is limited to one paid collection request');};
  const collectAt=Number(job.payload.collectAt??job.dueAt);const receipts=new Set<string>();const legacy=legacySource(source);if(preview)legacy.cursor={};const secrets=await this.secrets();const credential=(_scope:string,key:string)=>secrets[key]??null;
  const io:CollectorIo={fetch:this.publicNetwork.fetch,credential,jina:async(url,options)=>{
   admitPreview();const key=credential('collectors','JINA_API_KEY');if(!key)throw new CallBlockedError('Jina credential missing',null);
   const result=await paidHttp(this.calls,this.store,this.network,job,'jina',{url,purpose:options.purpose,format:options.format??'markdown',window:String(Math.floor(collectAt/3600000))},`https://r.jina.ai/${url}`,{headers:{authorization:`Bearer ${key}`,'x-return-format':options.format??'markdown'},redirectPolicy:'same-origin'});
   receipts.add(result.receiptId);return {markdown:result.body,raw:result.body};
  }};
  const rss=createRssCollector(io),web=createWebCollector(io),json=createJsonCollector(io);
  const x=createXCollector(async(query,options)=>{
   admitPreview();const key=credential('collectors','SOCIALDATA_API_KEY');if(!key)throw new CallBlockedError('SocialData credential missing',null);
   const params=new URLSearchParams({query,type:options.type??'Latest'});if(options.cursor)params.set('cursor',options.cursor);
   const answer=await this.json(job,'socialdata',{query,type:options.type??'Latest',cursor:options.cursor??null,window:options.window},`https://api.socialdata.tools/twitter/search?${params}`,{headers:{authorization:`Bearer ${key}`,accept:'application/json'},timeoutMs:60000,maxBytes:12*1024*1024},value=>{const tweets=z.object({tweets:z.array(z.unknown()).default([])}).parse(value).tweets;return {objects:tweets.length,cost:tweets.length*0.0002,currency:'USD',costBasis:'estimated'};});
   const parsed=z.object({tweets:z.array(z.object({id_str:z.string().regex(/^\d+$/),tweet_created_at:z.string(),user:z.object({name:z.string(),screen_name:z.string()}).passthrough()}).passthrough()).default([]),next_cursor:z.string().nullish()}).parse(answer.response);receipts.add(answer.receiptId);return {tweets:parsed.tweets as SdTweet[],nextCursor:parsed.next_cursor??null,receiptId:answer.receiptId,reused:false};
  },()=>collectAt);
  let candidates:Candidate[]=[];const cursor:Record<string,Json>={...source.cursor};const first=source.kind==='mp_account'?!cursor.lastCheckedAt:!cursor.initializedAt;let found=0;
  switch(source.kind){
   case 'rss':{const read=await rss.fetchRss(legacy,{force:preview});candidates=read.candidates;if(!first&&!preview)cursor.rss=JSON.parse(JSON.stringify(read.validator)) as Json;else delete cursor.rss;break;}
   case 'web_list':candidates=await web.fetchWebList(legacy);break;
   case 'json_list':candidates=await json.fetchJsonList(legacy);break;
   case 'x_search':{const read=await x.fetchXSearch(legacy);candidates=read.candidates;if(read.lastId)cursor.lastTweetId=read.lastId;cursor.xBacklog=JSON.parse(JSON.stringify(read.backlog)) as Json;break;}
   case 'mp_account':{
    admitPreview();const key=credential('collectors','DAJIALA_KEY');if(!key)throw new CallBlockedError('Dajiala credential missing',null);const ghid=String(source.config.ghid??source.config.wxid??'');if(!ghid)throw new Error('mp_account requires ghid');
    const read=await this.json(job,'dajiala',{ghid,purpose:'mp_history',window:`${preview?'m':'s'}:${Math.floor(collectAt/600000)}`},'https://www.dajiala.com/fbmain/monitor/v3/post_history',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({ghid,key,verifycode:''}),timeoutMs:30000},dajialaUsage);await this.acceptedDajiala(job,read);receipts.add(read.receiptId);
    const data=z.object({data:z.array(z.object({url:z.string().url(),title:z.string(),post_time:z.number(),digest:z.string().optional(),sn:z.string().optional(),position:z.number().optional(),cover_url:z.string().optional(),original:z.number().optional(),item_show_type:z.number().optional()}).passthrough()).default([]),remain_money:z.number().nullable().optional(),nickname:z.string().optional()}).parse(read.response);
    const posts=[...data.data].sort((a,b)=>b.post_time-a.post_time);found=posts.length;
    const identities=posts.map(p=>Url.identityKeyForUrl(p.url)).filter((key):key is string=>key!==null);const known=new Map((await this.store.execute('materialsKnown',{keys:identities})).map(r=>[r.key,r]));
    for(const p of posts){if(candidates.length>=8&&!preview)break;const publishedAt=p.post_time?new Date(p.post_time*1000):null;if(first&&publishedAt&&collectAt-publishedAt.getTime()>7*86400000)continue;const identity=Url.identityKeyForUrl(p.url);const old=identity?known.get(identity):undefined;const retry=old?.raw&&typeof old.raw==='object'&&!Array.isArray(old.raw)?(old.raw.dajiala as Record<string,Json>|undefined)?.bodyRetry as {attempts?:number}|undefined:undefined;const retryBody=!!old&&old.bodyStatus==='none'&&!!retry&&Number(retry.attempts??0)<3&&collectAt-old.discoveredAt<3*86400000;if(old&&!retryBody&&!preview)continue;
     let body:Awaited<ReturnType<SourceCollectors['mpBody']>>|null=null;let passing:string|null=null;
     if(!preview)try{body=await this.mpBody(job,p.url,p.sn??p.url);}catch(error){if(error instanceof CallBlockedError)throw error;if(!(error instanceof ProviderRejectedError)||error.retryable)passing=redactError(error);}
     const html=body?.text?Sanitize.sanitizeBody(body.text,p.url):null;const text=body?.text?Text.stripTags(body.text.replace(/<\/p>|<br\s*\/?>/gi,'\n')).trim():null;if(body)receipts.add(body.receiptId);
     candidates.push({url:p.url,title:p.title,...identity?{identityKey:identity}:{},publishedAt,author:body?.author??null,language:'zh',excerpt:p.digest??body?.desc??null,bodyHtml:html,bodyText:text||null,bodyStatus:text?'ok':'none',raw:{dajiala:{position:p.position??null,sn:p.sn??null,original:p.original??null,itemShowType:p.item_show_type??null,cover:p.cover_url??null,...passing?{bodyRetry:{attempts:old?Number(retry?.attempts??0)+1:1,error:passing}}:{}}}});
    }
    cursor.lastCheckedAt=new Date(collectAt).toISOString();cursor.lastPostTime=posts[0]?.post_time??cursor.lastPostTime??null;cursor.remainMoney=data.remain_money??null;break;
   }
   case 'external':throw new Error('External sources receive authenticated input; no polling');
  }
  if(source.kind!=='mp_account')found=candidates.length;
  candidates=candidates.filter(c=>web.allowed(c.url,legacy)&&!noise(c,legacy));if(source.config.sortByPublishedAt)candidates.sort((a,b)=>(b.publishedAt?.getTime()??0)-(a.publishedAt?.getTime()??0));
  const unique=new Map<string,Candidate>();for(const c of candidates){const rw=source.config.itemUrlPrefixRewrite as {from?:string;to?:string}|undefined;const url=rw?.from&&rw.to&&c.url.startsWith(rw.from)?rw.to+c.url.slice(rw.from.length):c.url;const identity=c.identityKey??Url.identityKeyForUrl(url,{keepFragment:source.config.preserveUrlFragment===true})??Material.identityKeyFor({...c,url,sourceId:source.id,via:'fetch'});if(!unique.has(identity))unique.set(identity,{...c,url,identityKey:identity});}
  candidates=[...unique.values()];if(first&&!preview&&source.kind!=='mp_account'){const caps=source.config._aihot as {initialBackfillLimit?:number;initialBackfillMonths?:number}|undefined;const limit=Math.max(0,Math.min(2000,Number(caps?.initialBackfillLimit??30)));const cutoff=collectAt-Number(caps?.initialBackfillMonths??12)*30*86400000;candidates=candidates.filter(c=>!c.publishedAt||!Number.isFinite(c.publishedAt.getTime())||c.publishedAt.getTime()>=cutoff).slice(0,limit);}if(preview)candidates=candidates.slice(0,100);
  const detail=source.config.detail as {maxFetches?:number;publishedAtAuthoritative?:boolean;titleSelector?:string;titleRegex?:string;titleAuthoritative?:boolean;summarySelector?:string;upgradeDatePrecision?:boolean}|undefined;let detailUsed=0;
  const known=detail?new Map((await this.store.execute('materialsKnown',{keys:candidates.map(c=>c.identityKey!)})).map(r=>[r.key,r])):new Map();
  for(const candidate of candidates){if(!detail||detailUsed>=Number(detail.maxFetches??0))break;if(detail.publishedAtAuthoritative)candidate.publishedAt=null;const old=known.get(candidate.identityKey!);if(old&&old.title===candidate.title)continue;const need={date:!candidate.publishedAt||detail.upgradeDatePrecision===true,title:!!(detail.titleSelector||detail.titleRegex)&&(detail.titleAuthoritative===true||candidate.title.length>100),summary:!!detail.summarySelector&&!candidate.excerpt,body:source.participationMode==='editorial'&&!candidate.bodyText};if(!need.date&&!need.title&&!need.summary)continue;detailUsed++;try{const got=await web.fetchDetail(candidate.url,legacy,need);if(got.title)candidate.title=got.title;if(got.summary)candidate.excerpt=got.summary;if(got.publishedAt)candidate.publishedAt=got.publishedAt;if(got.body){candidate.bodyText=got.body.text;candidate.bodyHtml=got.body.html;candidate.bodyStatus='ok';candidate.media=got.body.images;}}catch(error){if(error instanceof CallBlockedError)throw error;}}
  cursor.initializedAt=cursor.initializedAt??new Date(collectAt).toISOString();cursor.lastOkAt=new Date(collectAt).toISOString();
  return {foundCount:found,items:candidates.map(c=>({url:c.url,title:Text.collapseWhitespace(c.title).slice(0,1000),identityKey:c.identityKey??null,author:c.author??null,language:c.language??null,publishedAt:c.publishedAt&&Number.isFinite(c.publishedAt.getTime())?c.publishedAt.getTime():null,excerpt:c.excerpt??null,bodyHtml:c.bodyHtml?Sanitize.sanitizeBody(c.bodyHtml,c.url):null,bodyText:c.bodyText??null,bodyStatus:c.bodyStatus??(c.bodyText?'ok':'pending'),media:JSON.parse(JSON.stringify(c.media??[])) as Json[],xPost:JSON.parse(JSON.stringify(c.xPost??null)) as Record<string,Json>|null,raw:jsonSchema.parse(c.raw??null),backfillReason:first&&!preview?'first-import':c.backfill??null})),cursor,receiptIds:[...receipts]};
 }
 async mpBody(job:DurableJob,url:string,identity=url):Promise<{text:string;author:string|null;desc:string|null;receiptId:string}>{
  const credentials=await this.secrets();const key=credentials.DAJIALA_KEY;if(!key)throw new CallBlockedError('Dajiala credential missing',null);
  const endpoint='https://www.dajiala.com/fbmain/monitor/v3/article_detail?'+new URLSearchParams({url,key,mode:'1',verifycode:''});
  const answer=await this.json(job,'dajiala',{article:identity,purpose:'mp_article'},endpoint,{redirectPolicy:'same-origin',headers:{accept:'application/json'},timeoutMs:30000},dajialaUsage);await this.acceptedDajiala(job,answer);
  const parsed=z.object({content:z.string().default(''),author:z.string().nullish(),desc:z.string().nullish()}).parse(answer.response);return {text:parsed.content,author:parsed.author??null,desc:parsed.desc??null,receiptId:answer.receiptId};
 }
 private async secrets():Promise<Record<string,string>>{const result:Record<string,string>={};if(!this.ctx.get('credentials'))return result;for(const [id,name]of Object.entries({'socialdata':'SOCIALDATA_API_KEY','dajiala':'DAJIALA_KEY','jina':'JINA_API_KEY','github':'GITHUB_TOKEN'})){const record=await this.ctx.credentials.readRecord(credentialKey('hotstream',id));if(record?.kind==='api-key'&&record.key)result[name]=record.key;}return result;}
}
function noise(candidate:Candidate,source:SourceRow):boolean{const categories=candidate.categories??[];if(source.config.denyCategories?.some((c:string)=>categories.includes(c)))return true;if(source.config.allowCategories?.length&&!source.config.allowCategories.some((c:string)=>categories.includes(c)))return true;const rules=source.config.ingestNoiseFilter;if(!rules)return false;const title=candidate.title.toLowerCase(),text=title+'\n'+(candidate.excerpt??'').toLowerCase();const has=(hay:string,words:string[]|undefined)=>(words??[]).some(word=>hay.includes(word.toLowerCase()));return !has(text,rules.keepIfMatches)&&(has(title,rules.dropMarkersTitleOnly)||has(text,rules.dropMarkers));}
export function redactError(error:unknown):string{return (error instanceof Error?error.message:String(error)).replace(/https?:\/\/[^\s]+/g,'[source URL]').replace(/(?:Bearer|key|token|secret|authorization)\s*[:=]?\s*[^\s,;]+/gi,'[redacted]').slice(0,1000);}

/** Every direct socket rechecks DNS and every redirect checks the target. Lifetime owns the Agent. */
import { Agent,ProxyAgent,type Dispatcher,fetch as request } from 'undici';
import { Url } from 'dsh-hotstream-core';
import { addAbortListener } from 'node:events';
import {PublicDns} from './public-dns.ts';
export interface GuardedFetchOptions {method?:string|undefined;headers?:Record<string,string>|undefined;body?:string|undefined;timeoutMs?:number|undefined;maxBytes?:number|undefined;maxRedirects?:number|undefined;redirectPolicy?:'same-origin'|undefined;route?:'direct'|'egress'|undefined;signal?:AbortSignal|undefined;}
export interface GuardedResponse {status:number;url:string;headers:Headers;body:Buffer;text():string;}
export class PublicNetwork {
 private readonly agent:Dispatcher;
 private readonly ownsAgent:boolean;
 constructor(private readonly lifetime:AbortSignal,agent?:Dispatcher,private readonly resolver?:Url.PublicResolver,private readonly dns?:PublicDns,private readonly policy:{proxied?:boolean;ownsAgent?:boolean;publicFallback?:PublicNetwork}={}){this.agent=agent??new Agent({autoSelectFamily:true,autoSelectFamilyAttemptTimeout:250,connect:{lookup:((hostname:string,options:{all?:boolean;family?:number},callback:Parameters<typeof Url.guardedLookup>[2])=>Url.guardedLookup(hostname,options,callback,resolver)) as never}});this.ownsAgent=policy.ownsAgent??agent===undefined;}
 static create(lifetime:AbortSignal,mode:'system'|'public-doh'='system'):PublicNetwork{if(mode==='system')return new PublicNetwork(lifetime);const dns=new PublicDns(lifetime);return new PublicNetwork(lifetime,undefined,dns.resolve,dns);}
 /** Explicit plugin-owned proxy. It never installs a dispatcher or changes the host environment. */
 static viaProxy(lifetime:AbortSignal,proxyUrl:string):PublicNetwork{
  const proxy=new URL(proxyUrl);if(!['http:','https:'].includes(proxy.protocol)||proxy.username||proxy.password||proxy.search||proxy.hash||proxy.pathname!=='/')throw new Error('Use an HTTP(S) proxy origin without credentials');
  return new PublicNetwork(lifetime,new ProxyAgent(proxy.href),undefined,undefined,{proxied:true,ownsAgent:true});
 }
 /** Only anonymous public reads use this proxy; authenticated requests keep their original route. */
 static forPublicReads(lifetime:AbortSignal,direct:PublicNetwork,proxyUrl:string|null):PublicNetwork{
  if(!proxyUrl)return direct.fork(lifetime);
  const network=PublicNetwork.viaProxy(lifetime,proxyUrl);network.policy.publicFallback=direct;return network;
 }
 /** Scoped views share the socket owner but independently cancel their requests. */
 fork(signal:AbortSignal):PublicNetwork{return new PublicNetwork(AbortSignal.any([this.lifetime,signal]),this.agent,this.resolver,undefined,{...this.policy,ownsAgent:false});}
 fetch=async(input:string,options:GuardedFetchOptions={}):Promise<GuardedResponse>=>{
  const signal=AbortSignal.any([this.lifetime,AbortSignal.timeout(options.timeoutMs??25000),...(options.signal?[options.signal]:[])]);
  if(this.policy.publicFallback&&!anonymousPublicRead(input,options))return this.policy.publicFallback.fetch(input,{...options,signal});
  // The configured proxy resolves the origin. Refuse internal destinations and unsafe literals;
  // a poisoned local reserved/Teredo answer must not replace the proxy's actual DNS answer.
  const check=async(url:string):Promise<URL>=>{let sub:ReturnType<typeof addAbortListener>|undefined;try{return await Promise.race([Url.assertPublicUrl(url,false,this.policy.proxied??false,this.resolver),new Promise<never>((_,reject)=>{sub=addAbortListener(signal,()=>reject(signal.reason));signal.throwIfAborted();})]);}finally{sub?.[Symbol.dispose]();}};
  let url=await check(input);if(url.username||url.password)throw new Error('Credentials in source URLs are refused');
  const first=url.origin;const headers=new Headers({'user-agent':'dsh-hotstream/1.0','accept-language':'zh-CN,zh;q=0.9,en;q=0.8',...options.headers});
  const publicNames=new Set(['accept','user-agent','accept-language','cache-control','if-none-match','if-modified-since']);
  const originBound=options.redirectPolicy==='same-origin'||options.body!==undefined||Object.keys(options.headers??{}).some(k=>!publicNames.has(k.toLowerCase()));
  let method=(options.method??'GET').toUpperCase();let body=options.body;
  for(let hop=0;;hop++){
   const res=await request(url,{method,headers:Object.fromEntries(headers),...(body===undefined?{}:{body}),redirect:'manual',dispatcher:this.agent,signal}).catch(error=>{
    if(signal.aborted)throw signal.reason;
    const codes=connectionCodes(error);throw new Error(`${this.policy.proxied?'Proxy':'Direct'} request failed for ${url.hostname}${codes.length?' ('+codes.join(', ')+')':''}`,{cause:error});
   });
   const location=res.headers.get('location');if([301,302,303,307,308].includes(res.status)&&location){await res.body?.cancel();if(hop>=(options.maxRedirects??5))throw new Error('Too many redirects');const next=new URL(location,url);if(originBound&&next.origin!==first)throw new Error('Blocked cross-origin redirect for protected request');url=await check(next.href);if(url.username||url.password)throw new Error('Credentials in redirect URL are refused');if(res.status===303||([301,302].includes(res.status)&&method==='POST')){method='GET';body=undefined;headers.delete('content-type');headers.delete('content-length');}continue;}
   const chunks:Buffer[]=[];let bytes=0;try{if(res.body)for await(const chunk of res.body){bytes+=chunk.byteLength;if(bytes>(options.maxBytes??8*1024*1024))throw new Error('Source response exceeds byte limit');chunks.push(Buffer.from(chunk));}}catch(error){await res.body?.cancel().catch(()=>{});throw error;}
   const data=Buffer.concat(chunks);return {status:res.status,url:url.href,headers:new Headers(Object.fromEntries(res.headers)),body:data,text:()=>decode(data,res.headers.get('content-type'))};
  }
 };
 async close():Promise<void>{if(this.ownsAgent){await this.agent.close();await this.dns?.close();}}
}
export function anonymousPublicRead(input:string,options:GuardedFetchOptions={}):boolean{
 if(!['GET','HEAD'].includes((options.method??'GET').toUpperCase())||options.body!==undefined)return false;
 if(Object.keys(options.headers??{}).some(name=>!['accept','user-agent','accept-language','cache-control','if-none-match','if-modified-since'].includes(name.toLowerCase())))return false;
 try{const url=new URL(input);return !url.username&&!url.password&&![...url.searchParams.keys()].some(name=>/(?:^|[-_.])(?:key|token|secret|password|auth|authorization|credential)(?:$|[-_.])/i.test(name));}catch{return false;}
}
function connectionCodes(error:unknown,depth=0):string[]{if(!error||typeof error!=='object'||depth>4)return[];const value=error as {code?:unknown;cause?:unknown;errors?:unknown[]};return [...new Set([...(typeof value.code==='string'&&/^[A-Z][A-Z0-9_]{1,60}$/.test(value.code)?[value.code]:[]),...connectionCodes(value.cause,depth+1),...(Array.isArray(value.errors)?value.errors.flatMap(e=>connectionCodes(e,depth+1)):[])])].slice(0,6);}
function decode(body:Buffer,contentType:string|null):string{const match=/charset=([\w-]+)/i.exec(contentType??'');const meta=/<meta[^>]+charset=["']?([\w-]+)/i.exec(body.subarray(0,2048).toString('latin1'))??/encoding=["']([\w-]+)["']/i.exec(body.subarray(0,2048).toString('latin1'));const charset=match?.[1]??meta?.[1]??'utf-8';try{return new TextDecoder(charset==='gb2312'?'gbk':charset).decode(body).replace(/\uFFFD+/g,'\uFFFD');}catch{return body.toString('utf8');}}

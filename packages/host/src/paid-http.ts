/** Keep the received HTTP evidence before parsing or judging provider output. */
import {z} from 'zod';
import {createHash} from 'node:crypto';
import type {HotstreamStore,DurableJob,Json} from 'dsh-hotstream-contracts/runtime';
import type {PublicNetwork,GuardedFetchOptions} from './network.ts';
import type {CallCoordinator} from './calls.ts';
import {ProviderRejectedError} from './sources/x.ts';
/** Providers may echo rejected credentials. Remove these before any receipt or business write. */
export function redactPaidResponse(body:string,url:string,options:GuardedFetchOptions):string {
 const values=new Set<string>();const sensitive=/authorization|api[-_]?key|(?:^|[-_])key$|token|secret|password|cookie/i;
 for(const [name,value] of Object.entries(options.headers??{}))if(sensitive.test(name)){values.add(value);values.add(value.replace(/^Bearer\s+/i,''));}
 try{for(const [name,value] of new URL(url).searchParams)if(sensitive.test(name))values.add(value);}catch{/* The network layer validates the URL. */}
 if(options.body){try{const visit=(data:unknown)=>{if(Array.isArray(data))data.forEach(visit);else if(data&&typeof data==='object')for(const [name,value]of Object.entries(data)){if(sensitive.test(name)&&typeof value==='string')values.add(value);else visit(value);}};visit(JSON.parse(options.body));}catch{/* Non-JSON bodies have no configured credential fields. */}}
 let sanitized=body;for(const value of [...values].filter(value=>value.length>0).sort((a,b)=>b.length-a.length)){sanitized=sanitized.split(value).join('[redacted]');try{sanitized=sanitized.split(encodeURIComponent(value)).join('[redacted]');}catch{/* An invalid key still must not enter the receipt. */}sanitized=sanitized.split(JSON.stringify(value).slice(1,-1)).join('[redacted]');}
 return sanitized;
}
export async function paidHttp(calls:CallCoordinator,store:HotstreamStore,network:PublicNetwork,job:DurableJob,service:string,identity:Record<string,Json>,url:string,options:GuardedFetchOptions={},usage:(value:unknown)=>Record<string,Json>=()=>({costBasis:'unknown'}),acceptedStatuses:number[]=[]):Promise<{body:string;receiptId:string;attempt:number;status:number;legacy:Json|null}>{
 const result=await calls.paid(job,service,identity,async()=>{
  const response=await network.fetch(url,options);const body=response.text();let decoded:unknown;try{decoded=JSON.parse(body);}catch{decoded=body;}
  let metering:Record<string,Json>;try{metering=usage(decoded);}catch{metering={costBasis:'unknown'};}
  const sanitized=redactPaidResponse(body,url,options);
  return {response:{httpStatus:response.status,body:sanitized,contentType:response.headers.get('content-type'),credentialsRedacted:sanitized!==body,bodyUtf8Sha256:createHash('sha256').update(body).digest('hex')},usage:metering};
 });
 const packet=z.object({httpStatus:z.number().int(),body:z.string(),contentType:z.string().nullable()}).safeParse(result.response);
 // Existing alpha.1 receipts stored decoded JSON/text; preserve their replay without another call.
 if(!packet.success)return {body:typeof result.response==='string'?result.response:JSON.stringify(result.response),receiptId:result.receiptId,attempt:result.attempt,status:200,legacy:result.response};
 if(!acceptedStatuses.includes(packet.data.httpStatus)&&(packet.data.httpStatus<200||packet.data.httpStatus>=300)){
  await store.execute('settle',{id:result.receiptId,attempt:result.attempt,epoch:job.epoch,state:'failed',error:`HTTP ${packet.data.httpStatus}`,now:Date.now()});
  throw new ProviderRejectedError(`${service} HTTP ${packet.data.httpStatus}`,packet.data.httpStatus,packet.data.httpStatus===429||packet.data.httpStatus>=500);
 }
 return {body:packet.data.body,receiptId:result.receiptId,attempt:result.attempt,status:packet.data.httpStatus,legacy:null};
}

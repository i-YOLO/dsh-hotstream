/** Explicit HTTPS DNS mode. The actual socket still uses the validated public addresses. */
import {Agent,fetch} from 'undici';
import {isIP} from 'node:net';
import {z} from 'zod';
import {Url} from 'dsh-hotstream-core';
export class PublicDns {
 private readonly agent=new Agent({connect:{lookup:Url.guardedLookup as never}});
 private readonly cache=new Map<string,{expires:number;addresses:{address:string;family:number}[]}>();
 constructor(private readonly lifetime:AbortSignal){}
 readonly resolve:Url.PublicResolver=async hostname=>{
  const hit=this.cache.get(hostname);if(hit&&hit.expires>Date.now())return hit.addresses;
  const signal=AbortSignal.any([this.lifetime,AbortSignal.timeout(8000)]);
  let answers:{address:string;family:number}[][];try{answers=await Promise.all([1,28].map(async type=>{
   const response=await fetch('https://1.1.1.1/dns-query?'+new URLSearchParams({name:hostname,type:String(type)}),{headers:{accept:'application/dns-json'},dispatcher:this.agent,signal,redirect:'error'});
   if(response.status!==200){await response.body?.cancel();throw new Error('Public DNS request failed');}
   const chunks:Uint8Array[]=[];let bytes=0;if(response.body)for await(const chunk of response.body){bytes+=chunk.byteLength;if(bytes>262144){await response.body.cancel();throw new Error('Public DNS response too large');}chunks.push(chunk);}
   const result=z.object({Status:z.number(),Answer:z.array(z.object({type:z.number(),data:z.string(),TTL:z.number().optional()})).default([])}).parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
   if(result.Status!==0)throw new Error('Public DNS did not resolve '+hostname);
   return result.Answer.filter(answer=>answer.type===1||answer.type===28).map(answer=>({address:answer.data,family:isIP(answer.data)}));
  }));}catch(error){if(this.lifetime.aborted)throw error;throw new Error('Public DNS lookup failed for '+hostname+': '+(signal.aborted?'HTTPS resolver timed out after 8 seconds':error instanceof Error?error.message:'resolver unavailable'));}
  const addresses=answers.flat();if(!addresses.length||addresses.some(item=>!item.family||Url.isBlockedAddress(item.address)))throw new Error('Blocked public DNS answer for '+hostname);
  if(this.cache.size>=512)this.cache.delete(this.cache.keys().next().value!);
  this.cache.set(hostname,{expires:Date.now()+30000,addresses});return addresses;
 };
 async close():Promise<void>{this.cache.clear();await this.agent.close();}
}

/** Two independent reads overlap; identities/snapshots are committed later in registry order. */
import type {Fetcher,FetchResult} from './fetch/types.ts';
export interface FetchOutcome {value:FetchResult[]|null;error:unknown;disabled:boolean;}
export async function fetchRegistry(fetchers:Fetcher[],signal:AbortSignal,admit:(fetcher:Fetcher)=>Promise<boolean>,blocked:(error:unknown)=>boolean):Promise<FetchOutcome[]>{
 const output:FetchOutcome[]=new Array(fetchers.length);let next=0;
 const worker=async()=>{for(;;){const index=next++;if(index>=fetchers.length)return;signal.throwIfAborted();const fetcher=fetchers[index]!;let error:unknown=null;try{if(!await admit(fetcher)){output[index]={value:null,error:null,disabled:true};continue;}for(let attempt=0;attempt<2;attempt++){signal.throwIfAborted();try{const value=await fetcher.fetch();if(!value.length||value.every(result=>!result.rows.length))throw new Error('Source returned no evaluation evidence');output[index]={value,error:null,disabled:false};break;}catch(cause){signal.throwIfAborted();error=cause;if(blocked(cause)||attempt===1){output[index]={value:null,error,disabled:false};break;}if(!await admit(fetcher)){output[index]={value:null,error:null,disabled:true};break;}}}}catch(cause){signal.throwIfAborted();output[index]={value:null,error:cause,disabled:false};}}};
 await Promise.all([worker(),worker()]);return output;
}

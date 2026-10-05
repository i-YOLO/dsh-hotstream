/** The upstream ECB quote, fetched through the plugin's owned guarded transport. */
import {z} from 'zod';
import type {HotstreamStore,Json} from 'dsh-hotstream-contracts/runtime';
import type {PublicNetwork} from '../network.ts';
import {redactError} from '../sources/collect.ts';

export const FX_URL='https://api.frankfurter.app/latest?from=USD&to=CNY';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const time=Date.parse(value+'T00:00:00Z');return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;});
const quoteSchema=z.object({asOf:date,rate:z.number().finite().positive().max(1000000),sourceName:z.string().min(1),sourceUrl:z.string().url()});
const responseSchema=z.object({amount:z.literal(1).optional(),base:z.literal('USD'),date,rates:z.object({CNY:z.number().finite().positive().max(1000000)})});
export type FxQuote=z.infer<typeof quoteSchema>;

export function readFxQuote(value:unknown,now=Date.now()):FxQuote|null {
 const result=quoteSchema.safeParse(value);
 return result.success&&result.data.asOf<=new Date(now).toISOString().slice(0,10)?result.data:null;
}

export async function refreshPriceFx(store:HotstreamStore,network:PublicNetwork,signal:AbortSignal,previous:unknown,now=Date.now()):Promise<FxQuote|null>{
 const prior=readFxQuote(previous,now);
 let quote:FxQuote;
 try{
  signal.throwIfAborted();
  const response=await network.fetch(FX_URL,{headers:{accept:'application/json'},signal,timeoutMs:20000,maxBytes:65536});
  if(response.status!==200)throw new Error('Frankfurter HTTP '+response.status);
  const data=responseSchema.parse(JSON.parse(response.text()));
  const parsed=readFxQuote({asOf:data.date,rate:data.rates.CNY,sourceName:'欧洲央行',sourceUrl:FX_URL},now);
  if(!parsed)throw new Error('Exchange-rate observation is dated in the future');
  if(prior&&parsed.asOf<prior.asOf)throw new Error('Exchange-rate observation is older than the saved quote');
  quote=parsed;
 }catch(error){
  if(signal.aborted)throw error;
  await store.execute('moduleStatus',{module:'leaderboard',source:'exchange-rate',state:{status:'failed',error:redactError(error),sourceUrl:FX_URL,...prior?{fx:prior}:{},usingPrevious:!!prior},now});
  return prior;
 }
 await store.execute('moduleStatus',{module:'leaderboard',source:'exchange-rate',state:{status:'ok',error:null,lastOkAt:now,sourceUrl:FX_URL,fx:quote,usingPrevious:false},now});
 return quote;
}

export function previousPriceFx(state:Record<string,Json>,sources:Record<string,Json>[]):unknown {
 const summary=state.summary;
 const fromRun=summary&&typeof summary==='object'&&!Array.isArray(summary)?summary.fx:undefined;
 const fromSource=sources.find(source=>source.source==='exchange-rate')?.fx;
 const candidates=[readFxQuote(fromSource),readFxQuote(fromRun)].filter((value):value is FxQuote=>value!==null);
 return candidates.sort((a,b)=>b.asOf.localeCompare(a.asOf))[0]??null;
}

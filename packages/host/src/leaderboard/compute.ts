import {Worker} from 'node:worker_threads';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {BoardInput} from 'dsh-hotstream-core/leaderboard/method/consensus';
import {jsonObjectSchema,type Json} from 'dsh-hotstream-contracts/runtime';
export class LeaderboardComputer {
 private worker:Worker|undefined;private pending:Promise<Record<string,Json>[]>|undefined;
 constructor(private readonly signal:AbortSignal){}
 run(boards:BoardInput[]):Promise<Record<string,Json>[]>{this.signal.throwIfAborted();if(this.pending)throw new Error('Leaderboard computation is already running');const worker=new Worker(new URL('./compute-worker.js',import.meta.url),{resourceLimits:{maxOldGenerationSizeMb:512,maxYoungGenerationSizeMb:32}});this.worker=worker;const id=randomUUID();const deadline=setTimeout(()=>{void worker.terminate();},120000);
  const onAbort=()=>{void worker.terminate();};this.signal.addEventListener('abort',onAbort,{once:true});
  const task=new Promise<Record<string,Json>[]>((resolve,reject)=>{worker.once('error',reject);worker.once('exit',()=>reject(new Error('Leaderboard worker stopped before returning a result')));worker.once('message',(raw:unknown)=>{try{const reply=z.object({id:z.literal(id),ok:z.boolean(),boards:z.array(jsonObjectSchema).optional(),error:z.string().optional()}).strict().parse(raw);if(!reply.ok||!reply.boards)throw new Error(reply.error??'Leaderboard result missing');resolve(reply.boards);}catch(error){reject(error);}});worker.postMessage({id,boards});}).finally(async()=>{clearTimeout(deadline);this.signal.removeEventListener('abort',onAbort);await worker.terminate();this.worker=undefined;this.pending=undefined;});this.pending=task;return task;
 }
 async close():Promise<void>{if(this.worker)await this.worker.terminate();await this.pending?.catch(()=>{});}
}

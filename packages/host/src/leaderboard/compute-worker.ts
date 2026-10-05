/** The HiGHS/WASM solver never runs on the Host UI/control thread. */
import {parentPort} from 'node:worker_threads';
import {computeBoard,type BoardInput} from 'dsh-hotstream-core/leaderboard/method/consensus';
import {z} from 'zod';
if(!parentPort)throw new Error('Leaderboard compute requires an owned Worker');
parentPort.on('message',async(raw:unknown)=>{const message=z.object({id:z.string().uuid(),boards:z.array(z.unknown()).max(5)}).strict().parse(raw);try{const boards=message.boards as BoardInput[];if(boards.some(b=>!Array.isArray(b.models)||b.models.length>250))throw new Error('Leaderboard exceeds the desktop computation bound');const results=[];for(const board of boards)results.push(await computeBoard(board));parentPort!.postMessage({id:message.id,ok:true,boards:results});}catch(error){parentPort!.postMessage({id:message.id,ok:false,error:error instanceof Error?error.message:String(error)});}});

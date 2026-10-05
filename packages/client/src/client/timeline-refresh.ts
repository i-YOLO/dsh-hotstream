import type {TimelineResponse} from './aihot/contracts/site.ts';

/** Revalidate the loaded window through Publication while keeping its folding/scroll state. */
export async function refreshTimelineWindow(head:TimelineResponse,loaded:number,read:(cursor:string)=>Promise<TimelineResponse>,signal:AbortSignal):Promise<TimelineResponse>{
 const cards=[...head.cards],keys=new Set(cards.map(card=>card.key)),cursors=new Set<string>();
 const dayCounts={...head.dayCounts};let cursor=head.nextCursor;
 while(cursor&&cards.length<loaded){
  signal.throwIfAborted();if(cursors.has(cursor))throw new Error('Repeated reading cursor');cursors.add(cursor);
  const page=await read(cursor);signal.throwIfAborted();
  for(const card of page.cards)if(!keys.has(card.key)){keys.add(card.key);cards.push(card);}
  Object.assign(dayCounts,page.dayCounts);cursor=page.nextCursor;
 }
 signal.throwIfAborted();return {...head,cards,dayCounts,nextCursor:cursor};
}

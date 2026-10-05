/** A digest cannot turn missing summary detail into an asserted absence in the source. */
import type {Publication} from 'dsh-hotstream-contracts/runtime';
export function projectDigest(digest:string|null,articles:Publication[],sourceTexts:string[]):{digest:string|null;fallback:boolean}{
 if(!digest)return {digest:null,fallback:false};
 const absence=/(?:回应|回复)[^。！？]{0,30}(?:尚未|未见|暂无|没有)|(?:尚未|未见|暂无|没有)[^。！？]{0,35}(?:回应|回复)|\bno (?:official )?response\b/i;
 const explicitSourceAbsence=/did not respond|didn't respond|has not responded|declined to comment|(?:官方|公司|OpenAI)[^。！？]{0,30}(?:尚未|未|没有)[^。！？]{0,12}(?:回应|回复)/i;
 if(absence.test(digest)&&!sourceTexts.some(text=>explicitSourceAbsence.test(text))){
  const sorted=[...articles].sort((a,b)=>a.timelineAt-b.timelineAt||a.id.localeCompare(b.id));
  return {digest:sorted.map(item=>`${item.sourceName}：${item.summary}`).join('\n\n').slice(0,2000),fallback:true};
 }
 return {digest,fallback:false};
}

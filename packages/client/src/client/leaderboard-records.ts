import type {Json} from 'dsh-hotstream-contracts';

/** Only identified, ranked model records may become keyed leaderboard rows. */
export function leaderboardRecords(records:Record<string,Json>[]):Record<string,Json>[] {
 const seen=new Set<string>();
 return records.flatMap(row=>{
  const slug=typeof row.slug==='string'&&row.slug.trim()?row.slug.trim():typeof row.modelId==='string'?row.modelId.trim():'';
  const name=typeof row.name==='string'?row.name.trim():'';
  if(!slug||slug==='undefined'||!name||typeof row.rank!=='number'||!Number.isInteger(row.rank)||row.rank<1||seen.has(slug))return [];
  seen.add(slug);return [{...row,slug,name}];
 });
}

/** Source tier and verified authority are independent, as in the locked upstream. */
import {entityIdentity} from '../editorial/vocabulary.ts';
export interface RepresentativeIdentity {source_tier:string;publisher_role:string|null;owner_entity_id:string|null;fact_subject:string|null;}
export function representativePriority(row:Partial<RepresentativeIdentity>):number{
 if(row.source_tier==='T1')return 0;
 const owner=entityIdentity(row.owner_entity_id);const subjects=row.fact_subject?.split(/[,，、;；+＋&＆/]/u).map(subject=>entityIdentity(subject))??[];
 if(!owner||subjects.some(subject=>!subject)||!subjects.includes(owner))return 3;
 return row.publisher_role==='organization'?1:row.publisher_role==='person'?2:3;
}
export function pickRepresentative<T extends Partial<RepresentativeIdentity>&{id?:string;article_id?:string;body_mode:'full'|'summary';score:number|null;timeline_at:Date}>(rows:T[]):T{
 return [...rows].sort((a,b)=>representativePriority(a)-representativePriority(b)||Number(b.body_mode==='full')-Number(a.body_mode==='full')||Number(b.score??0)-Number(a.score??0)||a.timeline_at.getTime()-b.timeline_at.getTime()||(a.article_id??a.id??'').localeCompare(b.article_id??b.id??''))[0]!;
}

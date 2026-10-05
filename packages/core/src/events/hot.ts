/** AIHOT heat-v1 fold over current evidence; persistence and SQL stay outside Core. */
export const HOT_RULE_VERSION='heat-v1-48h-halflife24h';
export interface HeatSignal {storyId:string;participantKey:string;sourceId:string;sourceSince:number|null;at:number;editorial:boolean;}
export interface HeatAggregate {storyId:string;participants:number;editorial:number;signal:number;heat:number;previous:number;observed:number;previousObserved:number;behind:number;uncomparable:number;recent6h:number;}
export function heatIndex(heat:number):number{return Math.round(heat*100)/10;}
export function foldHeat(signals:HeatSignal[],at:number,behind:Set<string>):HeatAggregate[]{
 const previous=at-6*3600000;const from=at-48*3600000;const previousFrom=previous-48*3600000;
 const groups=new Map<string,Map<string,{last:number|null;first:number|null;previous:number|null;editorial:boolean;behind:boolean;late:boolean}>>();
 for(const signal of signals){if(signal.at<=previousFrom||signal.at>at)continue;let members=groups.get(signal.storyId);if(!members){members=new Map();groups.set(signal.storyId,members);}const member=members.get(signal.participantKey)??{last:null,first:null,previous:null,editorial:false,behind:false,late:false};
  if(signal.at>from){member.last=Math.max(member.last??-Infinity,signal.at);member.first=Math.min(member.first??Infinity,signal.at);member.editorial||=signal.editorial;}
  if(signal.at<=previous)member.previous=Math.max(member.previous??-Infinity,signal.at);
  member.behind||=behind.has(signal.sourceId);member.late||=signal.sourceSince===null||signal.sourceSince>previousFrom;members.set(signal.participantKey,member);
 }
 const rows:HeatAggregate[]=[];
 for(const [storyId,members]of groups){const row:HeatAggregate={storyId,participants:0,editorial:0,signal:0,heat:0,previous:0,observed:0,previousObserved:0,behind:0,uncomparable:0,recent6h:0};for(const member of members.values()){
  const comparable=!member.behind&&!member.late;
  if(member.last!==null){const value=0.5**((at-member.last)/3600000/24);row.participants++;row.heat+=value;member.editorial?row.editorial++:row.signal++;if(member.behind)row.behind++;if(comparable)row.observed+=value;}
  if(member.previous!==null){const value=0.5**((previous-member.previous)/3600000/24);row.previous+=value;if(comparable)row.previousObserved+=value;}
  if(!comparable&&(member.last!==null||member.previous!==null))row.uncomparable++;
  if(member.first!==null&&member.first>previous)row.recent6h++;
 }if(row.participants)rows.push(row);}
 return rows;
}
export function heatTrend(row:HeatAggregate,at:number,firstAt:number){
 const heat=heatIndex(row.heat),previous=heatIndex(row.previous);
 const current=row.uncomparable?heatIndex(row.observed):heat;
 const comparablePrevious=row.uncomparable?heatIndex(row.previousObserved):previous;
 const pct=comparablePrevious>0?(current-comparablePrevious)/comparablePrevious:null;
 const surge=row.recent6h>=3&&row.recent6h/row.participants>=0.5;const fresh=at-firstAt<6*3600000;const badges:Array<'surge'|'new'|'rising'>=[];
 if(surge)badges.push('surge');if(fresh)badges.push('new');if(!surge&&pct!==null&&pct>0.15)badges.push('rising');
 return {heat,trend:previous<=0?'new' as const:pct===null?'unknown' as const:pct>0.1?'up' as const:pct< -0.1?'down' as const:'flat' as const,trendPct:pct===null?null:Math.round(pct*1000)/10,badges};
}

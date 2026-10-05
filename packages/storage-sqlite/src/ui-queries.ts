/** AIHOT read projections over the plugin library. Never dispatches or mutates business data. */
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {Time} from 'dsh-hotstream-core';
import type {Publication,Report,RuntimeState,Json,Topic,UiFeedRequest,UiFeedResult,UiGroupRequest,UiGroupResult,UiReportIndexRequest,UiReportIndexResult,UiReportRequest,UiReportResult} from 'dsh-hotstream-contracts';
import {topicMembershipTags} from 'dsh-hotstream-core/publication/topics';
type Row=Record<string,import('node:sqlite').SQLOutputValue>;
const decode=(v:unknown)=>JSON.parse(String(v));
const obj=(v:Json|undefined):Record<string,Json>=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const citations=(r:Report)=>[...(Array.isArray(r.content.sections)?r.content.sections:[]).flatMap(s=>Array.isArray(obj(s).items)?obj(s).items as Json[]:[]),...Array.isArray(r.content.flashes)?r.content.flashes:[]].map(obj);
export class UiQueries {
 constructor(private db:DatabaseSync,private state:()=>RuntimeState,private read:(id:string)=>Publication|null,private bookmark:(id:string)=>Publication|null,private report:(row:Row)=>Report){
  db.function('hotstream_report_group',{deterministic:true},(kind,key)=>kind==='monthly'?String(key).slice(0,4):kind==='weekly'?(Time.isoWeekRange(String(key))?.start.slice(0,7)??''):String(key).slice(0,7));
 }
 private all(sql:string,...args:SQLInputValue[]):Row[]{return this.db.prepare(sql).all(...args);}
 private get(sql:string,...args:SQLInputValue[]):Row|undefined{return this.db.prepare(sql).get(...args);}
 private filters(q:{category:string|null;channel:string;tag:string|null},where:string[],args:SQLInputValue[]){
  if(q.category){where.push('p.category=?');args.push(q.category);}
  if(q.channel==='firstParty')where.push("json_extract(s.document,'$.tier')='T1'");
  if(q.channel==='x')where.push("s.kind='x_search'");else if(q.channel==='news')where.push("s.kind!='x_search'");
  if(q.tag){where.push("EXISTS(SELECT 1 FROM json_each(json_extract(p.document,'$.tags')) t WHERE t.value=?)");args.push(q.tag);}
 }
 private visible(){return ["p.visibility!='withdrawn'","p.eligible=1","p.input_revision=a.revision","coalesce(p.visible_after,0)<=?","json_extract(s.document,'$.participationMode')='editorial'"];}
 private from="FROM publications p JOIN articles a ON a.id=p.article_id JOIN sources s ON s.id=a.source_id LEFT JOIN user_marks m ON m.article_id=p.article_id";
 feed(q:UiFeedRequest):UiFeedResult {
  const state=this.state(),where=q.view==='bookmarks'?['m.bookmarked=1']:this.visible(),args:SQLInputValue[]=q.view==='bookmarks'?[]:[Date.now()];let join='';
  if(q.view==='selected')where.push('p.selected=1','p.seat=1',"p.visibility='public'");this.filters(q,where,args);
  if(q.topic){const topicRow=this.get('SELECT definition FROM topics WHERE id=?',q.topic);if(!topicRow)where.push('0=1');else{const topic=decode(topicRow.definition) as Topic,tags=topicMembershipTags(topic);if(q.view!=='bookmarks')where.push('p.selected=1','p.seat=1',"p.visibility='public'");if(!tags.length)where.push('0=1');else{where.push(`EXISTS(SELECT 1 FROM json_each(json_extract(p.document,'$.tags')) t WHERE t.value IN(${tags.map(()=>'?').join(',')}))`);args.push(...tags);if(topic.entityId){where.push('hotstream_topic_membership(p.document,?)=1');args.push(String(topicRow.definition));}}}}
  const query=q.query.trim();if(query){where.push("p.visibility!='withdrawn'");if([...query].length>=3){join=' JOIN publication_search search ON search.article_id=p.article_id';where.push('publication_search MATCH ?',"(json_extract(s.document,'$.siteFulltext')=1 AND p.visibility='public' OR instr(lower(p.title),lower(?))>0 OR instr(lower(p.summary),lower(?))>0)");args.push('"'+query.replace(/"/g,'""')+'"',query,query);}else{where.push("(instr(lower(p.title),lower(?))>0 OR instr(lower(p.summary),lower(?))>0 OR (json_extract(s.document,'$.siteFulltext')=1 AND p.visibility='public' AND instr(lower(coalesce(json_extract(a.document,'$.bodyText'),'')),lower(?))>0))");args.push(query,query,query);}}
  const base=this.from+join+' WHERE '+where.join(' AND '),total=Number(this.get('SELECT count(*) n '+base,...args)?.n??0);
  const dayCounts=this.all("SELECT date(p.publication_time/1000,'unixepoch','+8 hours') day,count(*) n "+base+" GROUP BY day ORDER BY day DESC",...args).map(r=>({day:String(r.day),count:Number(r.n)}));
  const identity=createHash('sha256').update(JSON.stringify({view:q.view,query,category:q.category,channel:q.channel,tag:q.tag,topic:q.topic,epoch:state.epoch})).digest('hex');let cursorWhere='';const cursorArgs:SQLInputValue[]=[];
  if(q.cursor){let cursor:unknown;try{cursor=JSON.parse(Buffer.from(q.cursor,'base64url').toString());}catch{throw new Error('Invalid reading cursor');}if(!Array.isArray(cursor)||cursor.length!==3||cursor[0]!==identity||typeof cursor[1]!=='number'||!Number.isFinite(cursor[1])||typeof cursor[2]!=='string')throw new Error('Reading cursor no longer matches filters');cursorWhere=' AND (p.publication_time<? OR (p.publication_time=? AND p.article_id>?))';cursorArgs.push(cursor[1],cursor[1],cursor[2]);}
  const rows=this.all('SELECT p.article_id,p.publication_time,p.fact_id,s.kind '+base+cursorWhere+' ORDER BY p.publication_time DESC,p.article_id LIMIT ? OFFSET ?',...args,...cursorArgs,q.limit+1,q.cursor?0:q.offset),page=rows.slice(0,q.limit);
  const facts=[...new Set(page.flatMap(row=>row.fact_id===null?[]:[String(row.fact_id)]))];const summaries=new Map<string,{reports:number;sources:number}>(),representatives=new Map<string,Publication>();
  if(facts.length){const gw=this.visible(),ga:SQLInputValue[]=[Date.now()];this.filters(q,gw,ga);gw.push(`p.fact_id IN(${facts.map(()=>'?').join(',')})`);ga.push(...facts);for(const row of this.all('SELECT p.fact_id,count(*) reports,count(DISTINCT a.source_id) sources '+this.from+' WHERE '+gw.join(' AND ')+' GROUP BY p.fact_id',...ga))summaries.set(String(row.fact_id),{reports:Number(row.reports),sources:Number(row.sources)});for(const row of this.all(`SELECT fact_id,article_id FROM publications WHERE selected=1 AND seat=1 AND visibility='public' AND fact_id IN(${facts.map(()=>'?').join(',')})`,...facts)){const item=this.read(String(row.article_id));if(item)representatives.set(String(row.fact_id),item);}}
  const cards=page.flatMap(row=>{const item=q.view==='bookmarks'?this.bookmark(String(row.article_id)):this.read(String(row.article_id));if(!item)return [];const group=item.factId?summaries.get(item.factId):null,representative=item.factId&&item.selected&&!item.seat?representatives.get(item.factId):null;return [{key:item.id,anchorAt:item.timelineAt,item,channel:row.kind==='x_search'?'x' as const:'news' as const,group:item.factId&&group?{factId:item.factId,reportCount:group.reports,additionalSourceCount:Math.max(0,group.sources-1)}:null,sameEvent:representative?{id:representative.id,title:representative.title}:null}];});
  const last=page.at(-1);return {cards,total,dayCounts,nextCursor:rows.length>q.limit&&last?Buffer.from(JSON.stringify([identity,Number(last.publication_time),String(last.article_id)])).toString('base64url'):null,epoch:state.epoch,dataRevision:state.dataRevision};
 }
 private groupBase(factId:string,q:{category:string|null;channel:string;tag:string|null}){const where=this.visible(),args:SQLInputValue[]=[Date.now()];where.push('p.fact_id=?');args.push(factId);this.filters(q,where,args);return {base:this.from+' WHERE '+where.join(' AND '),args};}
 private groupSources(factId:string,q:{category:string|null;channel:string;tag:string|null}):string[]{const {base,args}=this.groupBase(factId,q);return this.all('SELECT DISTINCT a.source_id '+base,...args).map(r=>String(r.source_id));}
 groups(q:UiGroupRequest):UiGroupResult{const {base,args}=this.groupBase(q.factId,q),total=Number(this.get('SELECT count(*) n '+base,...args)?.n??0);return {total,items:this.all('SELECT p.article_id '+base+' ORDER BY p.publication_time DESC,p.article_id LIMIT ? OFFSET ?',...args,q.limit,q.offset).flatMap(r=>{const p=this.read(String(r.article_id));return p?[{id:p.id,title:p.title,sourceName:p.sourceName,timelineAt:p.timelineAt,url:p.url}]:[];})};}
 reportIndex(q:UiReportIndexRequest):UiReportIndexResult{
  const args:SQLInputValue[]=[q.kind],filter=q.group?' WHERE hotstream_report_group(kind,period_key)=?':'';if(q.group)args.push(q.group);
  const total=Number(this.get('SELECT count(*) n FROM reports WHERE kind=?'+(q.group?' AND hotstream_report_group(kind,period_key)=?':''),...args)?.n??0);
  const rows=this.all("WITH editions AS(SELECT *,row_number() OVER(ORDER BY period_key) issue FROM reports WHERE kind=? AND time_zone='Asia/Shanghai') SELECT * FROM editions"+filter+' ORDER BY period_key DESC LIMIT ? OFFSET ?',...args,q.limit,q.offset);
  return {total,items:rows.map(row=>{const r=this.report(row);return {id:r.id,key:r.key,issueNumber:Number(row.issue),title:typeof obj(r.content.lead).title==='string'?obj(r.content.lead).title as string:null,count:citations(r).length,historical:obj(r.content.generator).historical===true,coverage:r.coverage};}),groups:this.all('SELECT hotstream_report_group(kind,period_key) k,count(*) n FROM reports WHERE kind=? GROUP BY k ORDER BY k DESC',q.kind).map(r=>({key:String(r.k),count:Number(r.n)}))};
 }
 reportView(q:UiReportRequest):UiReportResult{
  const index=this.reportIndex({kind:q.kind,group:null,limit:100,offset:0});const row=q.key?this.get('SELECT * FROM reports WHERE kind=? AND period_key=?',q.kind,q.key):this.get('SELECT * FROM reports WHERE kind=? ORDER BY period_key DESC LIMIT 1',q.kind);
  if(!row)return {report:null,issueNumber:null,prev:null,next:null,index,readingMinutes:0,metrics:{}};
  const report=this.report(row),entries=citations(report),all=[...entries,...entries.flatMap(e=>Array.isArray(e.related)?e.related.map(obj):[])],text=[obj(report.content.lead).leadParagraph??'',report.content.overview??'',...all.map(e=>String(e.title??'')+String(e.summary??''))].join('');
  return {report,index,issueNumber:Number(this.get('SELECT count(*) n FROM reports WHERE kind=? AND period_key<=?',q.kind,report.key)?.n??0),prev:this.get('SELECT period_key FROM reports WHERE kind=? AND period_key<? ORDER BY period_key DESC LIMIT 1',q.kind,report.key)?.period_key as string??null,next:this.get('SELECT period_key FROM reports WHERE kind=? AND period_key>? ORDER BY period_key LIMIT 1',q.kind,report.key)?.period_key as string??null,readingMinutes:Math.max(1,Math.round([...text].length/450)),metrics:{...Object.fromEntries(Object.entries(obj(report.content.metrics)).filter((e):e is [string,number]=>typeof e[1]==='number')),totalEvents:entries.length,sourcesCount:new Set(all.map(e=>e.sourceId??e.sourceName)).size,firstPartyEvents:entries.filter(e=>e.firstParty===true).length,...obj(report.content.coverage).dailyIssues!==undefined?{reportsCovered:Number(obj(report.content.coverage).dailyIssues)}:{}}};
 }
}

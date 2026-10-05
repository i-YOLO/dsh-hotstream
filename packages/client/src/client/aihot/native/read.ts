/** Compatibility transport for the copied read components: local Remote, no website request. */
import {useNative} from './context.tsx';
import {timeline} from './adapters.ts';
import type {CategoryKey,ChannelKey} from '../contracts/taxonomy.ts';
export function useNativeRead(){const {face,state}=useNative();return async(input:string,options?:{signal?:AbortSignal|undefined}):Promise<Response>=>{
 const signal=options?.signal;signal?.throwIfAborted();const url=new URL(input,'https://hotstream.invalid');if(url.origin!=='https://hotstream.invalid')throw new Error('Source UI transport is local only');let value:unknown;
 const monitorDay=url.pathname.match(/^\/api\/site\/codex-reset\/days\/(\d{4}-\d{2}-\d{2})$/);
 const group=url.pathname.match(/^\/api\/site\/groups\/([^/]+)\/reports$/),month=url.pathname.match(/^\/api\/site\/reports\/(daily|weekly|monthly)\/months\/([^/]+)$/),follow=url.pathname.match(/^\/api\/site\/stories\/([^/]+)\/followups$/);
 const filters={channel:(url.searchParams.get('channel')??'all') as ChannelKey,category:url.searchParams.get('category') as CategoryKey|null,tag:url.searchParams.get('tag')};
 if(url.pathname==='/api/site/timeline'){const feed=await face.readFeed({...filters,view:state.page==='bookmarks'?'bookmarks':state.page==='selected'?'selected':'all',query:state.query,topic:state.topic,limit:30,offset:0,cursor:url.searchParams.get('cursor')});value=timeline(feed,filters);}
 else if(monitorDay){const page=await face.readMonitor(monitorDay[1]!,signal);value={date:page.selectedDate,version:page.version,events:page.events};}
 else if(group){const result=await face.readGroups({...filters,factId:decodeURIComponent(group[1]!),limit:100,offset:0});value={reports:result.items.map(p=>({id:p.id,title:p.title,source:{name:p.sourceName},timelineAt:new Date(p.timelineAt).toISOString(),originalUrl:p.url}))};}
 else if(month){const result=await face.readReportIndex({kind:month[1] as 'daily'|'weekly'|'monthly',group:month[2]!,limit:100,offset:0});value={items:result.items};}
 else if(follow){const story=await face.readEvent(decodeURIComponent(follow[1]!));value={items:story?.facts.flatMap(f=>{const p=story.articles.find(p=>f.articleIds.includes(p.id));return p?[{factId:f.id,representative:{id:p.id,title:p.title,timelineAt:new Date(p.timelineAt).toISOString(),source:{name:p.sourceName}}}]:[];})??[],more:false};}
 else throw new Error('Unsupported source read path: '+url.pathname);
 signal?.throwIfAborted();return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
 };}
